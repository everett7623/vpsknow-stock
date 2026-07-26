import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import { processStockResults } from './stock-engine.js';

const databaseMocks = vi.hoisted(() => ({
  providerFindUnique: vi.fn(),
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

vi.mock('@vpsknow/database', () => ({
  prisma: {
    provider: { findUnique: databaseMocks.providerFindUnique },
    product: {
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

const stockResult: StockResult = {
  provider: 'BuyVM',
  productId: 'slice-1024-lv',
  planName: 'Slice 1024',
  location: 'Las Vegas',
  category: 'vps',
  cpu: '1 Core',
  ramMb: 1024,
  storageGb: 20,
  storageType: 'SSD',
  bandwidthTb: 1,
  ipv4: true,
  ipv6: true,
  price: 350,
  currency: 'USD',
  billingCycle: 'monthly',
  inStock: false,
  orderUrl: 'https://buyvm.net/order',
};

function createProduct(inStock: boolean, consecutiveConfirm: number) {
  return {
    id: 'product-1',
    inStock,
    consecutiveConfirm,
  };
}

function createLogger() {
  return pino({ enabled: false });
}

describe('processStockResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T12:00:00.000Z'));

    databaseMocks.providerFindUnique.mockResolvedValue({
      id: 'provider-1',
      affiliateLinks: [{ shortUrl: 'https://go.uukk.de/buyvm' }],
    });
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 0));
    databaseMocks.stockCheckCreate.mockResolvedValue({ id: 'check-1' });
    databaseMocks.stockEventFindFirst.mockResolvedValue(null);
    databaseMocks.stockEventCreate.mockResolvedValue({ id: 'event-1' });
    databaseMocks.productUpdate.mockResolvedValue(createProduct(false, 0));
    databaseMocks.telegramMessageCreate.mockResolvedValue({ id: 'telegram-1' });
    telegramMocks.formatRestockMessage.mockReturnValue('formatted restock message');
    telegramMocks.sendChannelMessage.mockResolvedValue(321);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty summary when the provider is absent', async () => {
    const logger = createLogger();
    const warnSpy = vi.spyOn(logger, 'warn');
    databaseMocks.providerFindUnique.mockResolvedValue(null);

    await expect(processStockResults('missing-provider', [stockResult], logger)).resolves.toEqual({
      checked: 0,
      restocked: 0,
      soldOut: 0,
      errors: 0,
    });

    expect(warnSpy).toHaveBeenCalledWith(
      { providerSlug: 'missing-provider' },
      'Provider not found in DB',
    );
    expect(databaseMocks.productUpsert).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('records an out-of-stock check without creating an event', async () => {
    const logger = createLogger();

    await expect(processStockResults('buyvm', [stockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 0,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.productUpsert).toHaveBeenCalledOnce();
    expect(databaseMocks.stockCheckCreate).toHaveBeenCalledWith({
      data: { productId: 'product-1', inStock: false },
    });
    expect(databaseMocks.stockEventCreate).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('records a first in-stock confirmation without notifying', async () => {
    const logger = createLogger();
    const debugSpy = vi.spyOn(logger, 'debug');
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 0));
    const inStockResult = { ...stockResult, inStock: true };

    await expect(processStockResults('buyvm', [inStockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 0,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.productUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: { consecutiveConfirm: 1 },
    });
    expect(debugSpy).toHaveBeenCalledWith(
      { provider: 'buyvm', product: 'Slice 1024', confirm: 1 },
      'Restock pending confirmation',
    );
    expect(databaseMocks.stockEventCreate).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('creates and notifies a confirmed restock with serializable metadata', async () => {
    const logger = createLogger();
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));

    await expect(processStockResults('buyvm', [inStockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 1,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.stockEventCreate).toHaveBeenCalledWith({
      data: {
        productId: 'product-1',
        eventType: 'restock',
        metadata: {
          result: {
            provider: 'BuyVM',
            productId: 'slice-1024-lv',
            planName: 'Slice 1024',
            location: 'Las Vegas',
            category: 'vps',
            cpu: '1 Core',
            ramMb: 1024,
            storageGb: 20,
            storageType: 'SSD',
            bandwidthTb: 1,
            ipv4: true,
            ipv6: true,
            price: 350,
            currency: 'USD',
            billingCycle: 'monthly',
            inStock: true,
            orderUrl: 'https://buyvm.net/order',
          },
        },
      },
    });
    expect(databaseMocks.productUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        inStock: true,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date('2026-07-21T12:00:00.000Z'),
      },
    });
    expect(telegramMocks.formatRestockMessage).toHaveBeenCalledWith(
      inStockResult,
      'https://go.uukk.de/buyvm',
    );
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledWith(
      '@vpsknow_stock',
      'formatted restock message',
    );
    expect(databaseMocks.telegramMessageCreate).toHaveBeenCalledWith({
      data: {
        channelId: '@vpsknow_stock',
        messageId: 321,
        stockEventId: 'event-1',
        content: 'formatted restock message',
      },
    });
  });

  it('suppresses a restock within the cooldown while updating product state', async () => {
    const logger = createLogger();
    const debugSpy = vi.spyOn(logger, 'debug');
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));
    databaseMocks.stockEventFindFirst.mockResolvedValue({ id: 'recent-event' });

    await expect(processStockResults('buyvm', [inStockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 0,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.stockEventFindFirst).toHaveBeenCalledWith({
      where: {
        productId: 'product-1',
        eventType: 'restock',
        detectedAt: { gte: new Date('2026-07-21T11:00:00.000Z') },
      },
    });
    expect(databaseMocks.productUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        inStock: true,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date('2026-07-21T12:00:00.000Z'),
      },
    });
    expect(debugSpy).toHaveBeenCalledWith(
      { provider: 'buyvm', product: 'Slice 1024' },
      'Restock detected but within cooldown window',
    );
    expect(databaseMocks.stockEventCreate).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('records a sold-out event without notifying Telegram', async () => {
    const logger = createLogger();
    databaseMocks.productUpsert.mockResolvedValue(createProduct(true, 0));

    await expect(processStockResults('buyvm', [stockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 0,
      soldOut: 1,
      errors: 0,
    });

    expect(databaseMocks.productUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        inStock: false,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date('2026-07-21T12:00:00.000Z'),
      },
    });
    expect(databaseMocks.stockEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1',
        eventType: 'sold_out',
      }),
    });
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('preserves a restock when Telegram delivery fails', async () => {
    const logger = createLogger();
    const errorSpy = vi.spyOn(logger, 'error');
    const deliveryError = new Error('Telegram unavailable');
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));
    telegramMocks.sendChannelMessage.mockRejectedValue(deliveryError);

    await expect(processStockResults('buyvm', [inStockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 1,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.stockEventCreate).toHaveBeenCalledOnce();
    expect(databaseMocks.productUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        inStock: true,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date('2026-07-21T12:00:00.000Z'),
      },
    });
    expect(databaseMocks.telegramMessageCreate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      { provider: 'buyvm', product: 'Slice 1024', err: deliveryError },
      'Failed to send Telegram notification',
    );
  });

  it('continues processing later results after a per-result database failure', async () => {
    const logger = createLogger();
    const errorSpy = vi.spyOn(logger, 'error');
    const databaseError = new Error('Database unavailable');
    const secondResult = { ...stockResult, productId: 'slice-2048-lv', planName: 'Slice 2048' };
    databaseMocks.productUpsert
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce(createProduct(false, 0));

    await expect(processStockResults('buyvm', [stockResult, secondResult], logger)).resolves.toEqual({
      checked: 2,
      restocked: 0,
      soldOut: 0,
      errors: 1,
    });

    expect(databaseMocks.stockCheckCreate).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith(
      { provider: 'buyvm', productId: 'slice-1024-lv', err: databaseError },
      'Error processing stock result',
    );
  });
});
