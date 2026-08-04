import { prisma } from '@vpsknow/database';
import type { StockResult } from '@vpsknow/providers';
import { RESTOCK_COOLDOWN_MS } from '@vpsknow/shared';
import { formatRestockMessage, sendChannelMessage } from '@vpsknow/telegram';
import type { Logger } from 'pino';

const PUBLIC_CHANNEL_ID = process.env.TELEGRAM_OFFERS_CHANNEL_ID?.trim() || '@vpsknow_offers';

export type PendingNotificationResult = 'none' | 'sent' | 'failed';

export async function deliverRestockNotification(
  eventId: string,
  result: StockResult,
  shortUrl: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const message = formatRestockMessage(result, shortUrl);
    const messageId = await sendChannelMessage(PUBLIC_CHANNEL_ID, message);

    await prisma.$transaction([
      prisma.telegramMessage.create({
        data: {
          channelId: PUBLIC_CHANNEL_ID,
          messageId,
          stockEventId: eventId,
          content: message,
        },
      }),
      prisma.stockEvent.update({
        where: { id: eventId },
        data: { notified: true },
      }),
    ]);

    logger.info(
      { provider: result.provider, product: result.planName, location: result.location },
      'RESTOCK notification sent',
    );
    return true;
  } catch (error) {
    logger.error(
      { provider: result.provider, product: result.planName, err: error },
      'Failed to send Telegram notification',
    );
    return false;
  }
}

export async function retryPendingRestockNotification(
  productId: string,
  result: StockResult,
  shortUrl: string,
  logger: Logger,
): Promise<PendingNotificationResult> {
  const retryCutoff = new Date(Date.now() - RESTOCK_COOLDOWN_MS);
  const pendingEvent = await prisma.stockEvent.findFirst({
    where: {
      productId,
      eventType: 'restock',
      notified: false,
      detectedAt: { gte: retryCutoff },
      telegramMessages: { none: {} },
    },
    orderBy: { detectedAt: 'desc' },
    select: { id: true },
  });

  if (!pendingEvent) return 'none';

  logger.warn(
    { provider: result.provider, product: result.planName, eventId: pendingEvent.id },
    'Retrying pending RESTOCK notification',
  );
  const delivered = await deliverRestockNotification(pendingEvent.id, result, shortUrl, logger);
  return delivered ? 'sent' : 'failed';
}
