import { prisma } from '@vpsknow/database';
import type { StockResult } from '@vpsknow/providers';
import { resolveRegion } from '@vpsknow/shared';
import { formatRestockMessage, sendChannelMessage } from '@vpsknow/telegram';
import type { Logger } from 'pino';

const USER_RATE_LIMIT_MS = 30_000;

export interface RestockSubscription {
  providers: string[];
  regions: string[];
  categories: string[];
  maxPriceCents: number | null;
}

export interface OfferNotificationInput {
  provider: string | null;
  locations: string[];
  category: string | null;
  priceCents: number | null;
  currency: string | null;
}

/**
 * Match subscription region filters against a free-text location.
 * Supports coarse regions (Asia, US West, …) and legacy city values (Tokyo → Asia).
 */
export function locationMatchesRegions(location: string, selectedRegions: string[]): boolean {
  if (selectedRegions.length === 0) return true;

  const resolvedLocation = resolveRegion(location);
  return selectedRegions.some((selected) => {
    if (selected === location) return true;
    if (selected === resolvedLocation) return true;
    return resolveRegion(selected) === resolvedLocation;
  });
}

export function matchesRestockSubscription(
  subscription: RestockSubscription,
  result: StockResult,
): boolean {
  if (subscription.providers.length > 0 && !subscription.providers.includes(result.provider)) {
    return false;
  }
  if (!locationMatchesRegions(result.location, subscription.regions)) {
    return false;
  }
  if (subscription.categories.length > 0 && !subscription.categories.includes(result.category)) {
    return false;
  }
  if (subscription.maxPriceCents !== null) {
    if (result.currency !== 'USD' || result.price > subscription.maxPriceCents) return false;
  }
  return true;
}

export function matchesOfferSubscription(
  subscription: RestockSubscription,
  offer: OfferNotificationInput,
): boolean {
  const provider = offer.provider?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? null;
  if (subscription.providers.length > 0 && (!provider || !subscription.providers.includes(provider))) {
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
    if (
      offer.currency !== 'USD'
      || offer.priceCents === null
      || offer.priceCents > subscription.maxPriceCents
    ) {
      return false;
    }
  }
  return true;
}

async function claimRateLimit(subscriptionId: string, now: Date): Promise<boolean> {
  const claimed = await prisma.subscription.updateMany({
    where: {
      id: subscriptionId,
      OR: [
        { lastNotifiedAt: null },
        { lastNotifiedAt: { lte: new Date(now.getTime() - USER_RATE_LIMIT_MS) } },
      ],
    },
    data: { lastNotifiedAt: now },
  });
  return claimed.count > 0;
}

export async function notifyRestockSubscribers(
  result: StockResult,
  affiliateUrl: string | undefined,
  logger: Logger,
): Promise<void> {
  try {
    const now = new Date();
    const subscriptions = await prisma.subscription.findMany({
      where: {
        isActive: true,
        eventTypes: { has: 'restock' },
        OR: [{ mutedUntil: null }, { mutedUntil: { lte: now } }],
      },
    });

    for (const subscription of subscriptions) {
      if (!matchesRestockSubscription(subscription, result)) continue;

      const channelId = subscription.chatId.toString();
      if (!await claimRateLimit(subscription.id, now)) {
        logger.debug({ telegramUserId: subscription.telegramUserId }, 'Subscriber notification rate limited');
        continue;
      }

      try {
        const message = formatRestockMessage(result, affiliateUrl);
        const messageId = await sendChannelMessage(channelId, message);
        await prisma.telegramMessage.create({
          data: { channelId, messageId, content: message, status: 'sent' },
        });
      } catch (error) {
        logger.error(
          { telegramUserId: subscription.telegramUserId, err: error },
          'Failed to send subscriber restock notification',
        );
      }
    }
  } catch (error) {
    logger.error({ provider: result.provider, err: error }, 'Failed to query restock subscribers');
  }
}

export async function notifyOfferSubscribers(
  offer: OfferNotificationInput,
  message: string,
  logger: Logger,
): Promise<void> {
  try {
    const now = new Date();
    const subscriptions = await prisma.subscription.findMany({
      where: {
        isActive: true,
        eventTypes: { has: 'offers' },
        OR: [{ mutedUntil: null }, { mutedUntil: { lte: now } }],
      },
    });

    for (const subscription of subscriptions) {
      if (!matchesOfferSubscription(subscription, offer)) continue;
      if (!await claimRateLimit(subscription.id, now)) {
        logger.debug({ telegramUserId: subscription.telegramUserId }, 'Subscriber notification rate limited');
        continue;
      }

      const channelId = subscription.chatId.toString();
      try {
        const messageId = await sendChannelMessage(channelId, message, {
          disableWebPagePreview: true,
        });
        await prisma.telegramMessage.create({
          data: { channelId, messageId, content: message, status: 'sent' },
        });
      } catch (error) {
        logger.error(
          { telegramUserId: subscription.telegramUserId, err: error },
          'Failed to send subscriber offer notification',
        );
      }
    }
  } catch (error) {
    logger.error({ provider: offer.provider, err: error }, 'Failed to query offer subscribers');
  }
}
