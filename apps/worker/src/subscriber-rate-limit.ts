import { prisma } from '@vpsknow/database';

export const USER_RATE_LIMIT_MS = 30_000;

export async function claimSubscriberRateLimit(
  subscriptionId: string,
  now: Date,
): Promise<boolean> {
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
