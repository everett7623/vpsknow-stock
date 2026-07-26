import { prisma } from '@vpsknow/database';
import type { StockResult } from '@vpsknow/providers';
import { formatRestockMessage, sendChannelMessage } from '@vpsknow/telegram';
import type { Logger } from 'pino';

const USER_RATE_LIMIT_MS = 30_000;

export interface RestockSubscription {
  providers: string[];
  regions: string[];
  categories: string[];
  maxPriceCents: number | null;
}

export function matchesRestockSubscription(
  subscription: RestockSubscription,
  result: StockResult,
): boolean {
  if (subscription.providers.length > 0 && !subscription.providers.includes(result.provider)) {
    return false;
  }
  if (subscription.regions.length > 0 && !subscription.regions.includes(result.location)) {
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
      const claimed = await prisma.subscription.updateMany({
        where: {
          id: subscription.id,
          OR: [
            { lastNotifiedAt: null },
            { lastNotifiedAt: { lte: new Date(now.getTime() - USER_RATE_LIMIT_MS) } },
          ],
        },
        data: { lastNotifiedAt: now },
      });
      if (claimed.count === 0) {
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
