import { prisma } from '@vpsknow/database';
import { sendChannelMessage } from '@vpsknow/telegram';
import type { Logger } from 'pino';
import {
  locationMatchesRegions,
  type RestockSubscription,
} from './subscriber-notifications.js';
import {
  claimSubscriberRateLimit,
  USER_RATE_LIMIT_MS,
} from './subscriber-rate-limit.js';

const OFFER_DELIVERY_LEASE_MS = 5 * 60_000;
const OFFER_DELIVERY_CREATE_BATCH_SIZE = 100;
const OFFER_DELIVERY_RETRY_BATCH_SIZE = 5;
const OFFER_DELIVERY_MAX_BACKOFF_MS = 6 * 60 * 60_000;

export interface OfferNotificationInput {
  id?: string;
  provider: string | null;
  locations: string[];
  category: string | null;
  priceCents: number | null;
  priceAmount?: number | null;
  currency: string | null;
}

interface OfferDeliveryInput extends OfferNotificationInput {
  id: string;
}

interface DeliverySubscription {
  id: string;
  chatId: bigint;
  isActive: boolean;
  eventTypes: string[];
  mutedUntil: Date | null;
}

export function matchesOfferSubscription(
  subscription: RestockSubscription,
  offer: OfferNotificationInput,
): boolean {
  const provider = offer.provider?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? null;
  if (
    subscription.providers.length > 0
    && (!provider || !subscription.providers.includes(provider))
  ) {
    return false;
  }
  if (subscription.regions.length > 0) {
    const locations = offer.locations.length > 0 ? offer.locations : [''];
    if (!locations.some((location) => locationMatchesRegions(location, subscription.regions))) {
      return false;
    }
  }
  if (
    subscription.categories.length > 0
    && (!offer.category || !subscription.categories.includes(offer.category))
  ) {
    return false;
  }
  if (subscription.maxPriceCents !== null) {
    const priceCents = offer.priceAmount == null
      ? offer.priceCents
      : offer.priceAmount * 100;
    if (
      offer.currency !== 'USD'
      || priceCents === null
      || priceCents > subscription.maxPriceCents
    ) {
      return false;
    }
  }
  return true;
}

export async function notifyOfferSubscribers(
  offer: OfferDeliveryInput,
  message: string,
  logger: Logger,
): Promise<void> {
  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      eventTypes: { has: 'offers' },
      OR: [{ mutedUntil: null }, { mutedUntil: { lte: now } }],
    },
  });

  const matchedSubscriptions = subscriptions.filter((subscription) =>
    matchesOfferSubscription(subscription, offer),
  );
  for (
    let offset = 0;
    offset < matchedSubscriptions.length;
    offset += OFFER_DELIVERY_CREATE_BATCH_SIZE
  ) {
    const batch = matchedSubscriptions.slice(offset, offset + OFFER_DELIVERY_CREATE_BATCH_SIZE);
    await prisma.offerSubscriberDelivery.createMany({
      data: batch.map((subscription) => ({
        offerId: offer.id,
        subscriptionId: subscription.id,
        content: message,
        nextAttemptAt: now,
      })),
      skipDuplicates: true,
    });
    const deliveries = await prisma.offerSubscriberDelivery.findMany({
      where: {
        offerId: offer.id,
        subscriptionId: { in: batch.map((subscription) => subscription.id) },
      },
      select: { id: true, subscriptionId: true },
    });
    const deliveryBySubscription = new Map(
      deliveries.map((delivery) => [delivery.subscriptionId, delivery.id]),
    );

    for (const subscription of batch) {
      const deliveryId = deliveryBySubscription.get(subscription.id);
      if (!deliveryId) {
        throw new Error(`Offer delivery was not created for subscription ${subscription.id}`);
      }
      await attemptOfferDelivery(deliveryId, subscription, message, logger, now);
    }
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(
    OFFER_DELIVERY_MAX_BACKOFF_MS,
    USER_RATE_LIMIT_MS * 2 ** Math.max(0, attempts - 1),
  );
}

async function deferOfferDelivery(deliveryId: string, nextAttemptAt: Date): Promise<void> {
  await prisma.offerSubscriberDelivery.update({
    where: { id: deliveryId },
    data: { status: 'pending', nextAttemptAt },
  });
}

async function attemptOfferDelivery(
  deliveryId: string,
  subscription: DeliverySubscription,
  message: string,
  logger: Logger,
  now: Date,
): Promise<void> {
  if (!subscription.isActive || !subscription.eventTypes.includes('offers')) {
    await prisma.offerSubscriberDelivery.update({
      where: { id: deliveryId },
      data: { status: 'cancelled' },
    });
    return;
  }

  if (subscription.mutedUntil && subscription.mutedUntil > now) {
    await deferOfferDelivery(deliveryId, subscription.mutedUntil);
    return;
  }

  const leaseCutoff = new Date(now.getTime() - OFFER_DELIVERY_LEASE_MS);
  const claimed = await prisma.offerSubscriberDelivery.updateMany({
    where: {
      id: deliveryId,
      OR: [
        {
          status: { in: ['pending', 'failed'] },
          nextAttemptAt: { lte: now },
        },
        {
          status: 'sending',
          lastAttemptAt: { lte: leaseCutoff },
        },
      ],
    },
    data: { status: 'sending', lastAttemptAt: now },
  });
  if (claimed.count === 0) return;

  if (!await claimSubscriberRateLimit(subscription.id, now)) {
    await deferOfferDelivery(deliveryId, new Date(now.getTime() + USER_RATE_LIMIT_MS));
    logger.debug({ subscriptionId: subscription.id }, 'Subscriber notification rate limited');
    return;
  }

  const delivery = await prisma.offerSubscriberDelivery.update({
    where: { id: deliveryId },
    data: { attempts: { increment: 1 } },
    select: { attempts: true },
  });

  const channelId = subscription.chatId.toString();
  try {
    const messageId = await sendChannelMessage(channelId, message, {
      disableWebPagePreview: true,
    });
    await prisma.$transaction([
      prisma.telegramMessage.create({
        data: { channelId, messageId, content: message, status: 'sent' },
      }),
      prisma.offerSubscriberDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'sent',
          messageId,
          sentAt: now,
          lastError: null,
        },
      }),
    ]);
  } catch (error) {
    const lastError = (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
    await prisma.offerSubscriberDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        nextAttemptAt: new Date(now.getTime() + retryDelayMs(delivery.attempts)),
        lastError,
      },
    });
    logger.error(
      { subscriptionId: subscription.id, err: error },
      'Failed to send subscriber offer notification; queued for retry',
    );
  }
}

export async function retryPendingOfferNotifications(logger: Logger): Promise<void> {
  const now = new Date();
  const leaseCutoff = new Date(now.getTime() - OFFER_DELIVERY_LEASE_MS);
  const deliveries = await prisma.offerSubscriberDelivery.findMany({
    where: {
      OR: [
        {
          status: { in: ['pending', 'failed'] },
          nextAttemptAt: { lte: now },
        },
        {
          status: 'sending',
          lastAttemptAt: { lte: leaseCutoff },
        },
      ],
    },
    include: { subscription: true },
    orderBy: { nextAttemptAt: 'asc' },
    take: OFFER_DELIVERY_RETRY_BATCH_SIZE,
  });

  for (const delivery of deliveries) {
    await attemptOfferDelivery(
      delivery.id,
      delivery.subscription,
      delivery.content,
      logger,
      now,
    );
  }
}
