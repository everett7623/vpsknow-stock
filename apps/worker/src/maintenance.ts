import { prisma } from '@vpsknow/database';

export const STOCK_CHECK_RETENTION_DAYS = 30;

export interface RetentionSummary {
  stockChecksDeleted: number;
  cutoff: Date;
}

export async function runDataRetention(now = new Date()): Promise<RetentionSummary> {
  const cutoff = new Date(now.getTime() - STOCK_CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1_000);
  const result = await prisma.stockCheck.deleteMany({
    where: { checkedAt: { lt: cutoff } },
  });
  return { stockChecksDeleted: result.count, cutoff };
}
