import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyVMAdapter } from '@vpsknow/providers';
import { processStockResults } from './stock-engine.js';

const databaseMocks = vi.hoisted(() => ({
  providerFindUnique: vi.fn(),
  productFindUnique: vi.fn(),
  productUpsert: vi.fn(),
  productUpdate: vi.fn(),
  stockCheckCreate: vi.fn(),
  stockEventFindFirst: vi.fn(),
  stockEventCreate: vi.fn(),
  telegramMessageCreate: vi.fn(),
}));

const telegramMocks = vi.hoisted(() => ({
  formatRestockMessage: vi.fn(),
  sendChannelMessage: vi.fn(),
}));

const subscriberMocks = vi.hoisted(() => ({
  notifyRestockSubscribers: vi.fn(),
}));

vi.mock('@vpsknow/database', () => ({
  prisma: {
    provider: { findUnique: databaseMocks.providerFindUnique },
    product: {
      findUnique: databaseMocks.productFindUnique,
      upsert: databaseMocks.productUpsert,
      update: databaseMocks.productUpdate,
    },
    stockCheck: { create: databaseMocks.stockCheckCreate },
    stockEvent: {
      findFirst: databaseMocks.stockEventFindFirst,
      create: databaseMocks.stockEventCreate,
    },
    telegramMessage: { create: databaseMocks.telegramMessageCreate },
  },
}));

vi.mock('@vpsknow/telegram', () => ({
  formatRestockMessage: telegramMocks.formatRestockMessage,
  sendChannelMessage: telegramMocks.sendChannelMessage,
}));

vi.mock('./subscriber-notifications.js', () => subscriberMocks);

describe('stock pipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.providerFindUnique.mockResolvedValue({
      id: 'provider-buyvm',
      affiliateLinks: [{ shortUrl: 'https://go.uukk.de/buyvm' }],
    });
    databaseMocks.productFindUnique.mockResolvedValue({ id: 'product-slice-1024' });
    databaseMocks.productUpsert
      .mockResolvedValueOnce({ id: 'product-slice-1024', inStock: false, consecutiveConfirm: 0 })
      .mockResolvedValueOnce({ id: 'product-slice-1024', inStock: false, consecutiveConfirm: 1 });
    databaseMocks.productUpdate.mockResolvedValue({ id: 'product-slice-1024' });
    databaseMocks.stockCheckCreate.mockResolvedValue({ id: 'check' });
    databaseMocks.stockEventFindFirst.mockResolvedValue(null);
    databaseMocks.stockEventCreate.mockResolvedValue({ id: 'event-restock' });
    databaseMocks.telegramMessageCreate.mockResolvedValue({ id: 'message' });
    telegramMocks.formatRestockMessage.mockReturnValue('formatted BuyVM restock');
    telegramMocks.sendChannelMessage.mockResolvedValue(1001);
    subscriberMocks.notifyRestockSubscribers.mockResolvedValue(undefined);
  });

  it('parses a fixture and notifies only after two in-stock confirmations', async () => {
    const html = readFileSync(
      join(__dirname, '../../../packages/providers/src/adapters/__tests__/fixtures/buyvm.html'),
      'utf8',
    );
    const [result] = new BuyVMAdapter().parseGroup(html, 'Las Vegas', 'KVM Slices - Las Vegas');
    expect(result).toMatchObject({
      provider: 'buyvm',
      productId: 'buyvm-slice-1024-las-vegas',
      planName: 'Slice 1024',
      inStock: true,
    });

    const logger = pino({ enabled: false });
    await expect(processStockResults('buyvm', [result!], logger)).resolves.toMatchObject({
      checked: 1,
      restocked: 0,
    });
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();

    await expect(processStockResults('buyvm', [result!], logger)).resolves.toMatchObject({
      checked: 1,
      restocked: 1,
    });
    expect(databaseMocks.stockCheckCreate).toHaveBeenCalledTimes(2);
    expect(databaseMocks.stockEventCreate).toHaveBeenCalledOnce();
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledWith(
      '@vpsknow_stock',
      'formatted BuyVM restock',
    );
    expect(subscriberMocks.notifyRestockSubscribers).toHaveBeenCalledOnce();
  });
});
