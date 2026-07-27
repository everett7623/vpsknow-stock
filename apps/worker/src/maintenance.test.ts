import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDataRetention } from './maintenance.js';

const databaseMocks = vi.hoisted(() => ({
  stockCheckDeleteMany: vi.fn(),
}));

vi.mock('@vpsknow/database', () => ({
  prisma: {
    stockCheck: { deleteMany: databaseMocks.stockCheckDeleteMany },
  },
}));

describe('data retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.stockCheckDeleteMany.mockResolvedValue({ count: 42 });
  });

  it('deletes stock checks older than 30 days', async () => {
    const now = new Date('2026-07-28T00:00:00.000Z');
    await expect(runDataRetention(now)).resolves.toEqual({
      stockChecksDeleted: 42,
      cutoff: new Date('2026-06-28T00:00:00.000Z'),
    });
    expect(databaseMocks.stockCheckDeleteMany).toHaveBeenCalledWith({
      where: { checkedAt: { lt: new Date('2026-06-28T00:00:00.000Z') } },
    });
  });
});
