import pino from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import { buildProductAffiliateUrl, extractWhmcsPid } from '@vpsknow/shared';
import { processStockResults } from './stock-engine.js';

const databaseMocks = vi.hoisted(() => ({
  providerFindUnique: vi.fn(),
  productFindUnique: vi.fn(),
  productUpsert: vi.fn(),
  productUpdate: vi.fn(),
  stockCheckCreate: vi.fn(),
  stockEventFindFirst: vi.fn(),
  stockEventCreate: vi.fn(),
  stockEventUpdate: vi.fn(),
  telegramMessageCreate: vi.fn(),
  affiliateLinkUpsert: vi.fn(),
  transaction: vi.fn(),
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
      update: databaseMocks.stockEventUpdate,
    },
    telegramMessage: { create: databaseMocks.telegramMessageCreate },
    affiliateLink: { upsert: databaseMocks.affiliateLinkUpsert },
    $transaction: databaseMocks.transaction,
  },
}));

vi.mock('@vpsknow/telegram', () => ({
  formatRestockMessage: telegramMocks.formatRestockMessage,
  sendChannelMessage: telegramMocks.sendChannelMessage,
}));
vi.mock('./subscriber-notifications.js', () => subscriberMocks);

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
      affiliateLinks: [
        {
          slug: 'buyvm',
          targetUrl: 'https://my.frantech.ca/aff.php?aff=123',
          shortUrl: 'https://go.uukk.de/buyvm',
        },
      ],
    });
    databaseMocks.productFindUnique.mockResolvedValue({ id: 'product-1' });
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 0));
    databaseMocks.stockCheckCreate.mockResolvedValue({ id: 'check-1' });
    databaseMocks.stockEventFindFirst.mockResolvedValue(null);
    databaseMocks.stockEventCreate.mockResolvedValue({ id: 'event-1' });
    databaseMocks.stockEventUpdate.mockResolvedValue({ id: 'event-1', notified: true });
    databaseMocks.productUpdate.mockResolvedValue(createProduct(false, 0));
    databaseMocks.telegramMessageCreate.mockResolvedValue({ id: 'telegram-1' });
    databaseMocks.affiliateLinkUpsert.mockImplementation(async ({ create }) => create);
    databaseMocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    telegramMocks.formatRestockMessage.mockReturnValue('formatted restock message');
    telegramMocks.sendChannelMessage.mockResolvedValue(321);
    subscriberMocks.notifyRestockSubscribers.mockResolvedValue(undefined);
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
      data: { productId: 'product-1', inStock: false, priceCents: 350 },
    });
    expect(databaseMocks.stockEventCreate).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('records a newly discovered in-stock product as a baseline without notifying', async () => {
    const logger = createLogger();
    const infoSpy = vi.spyOn(logger, 'info');
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productFindUnique.mockResolvedValue(null);
    databaseMocks.productUpsert.mockResolvedValue(createProduct(true, 0));

    await expect(processStockResults('buyvm', [inStockResult], logger)).resolves.toEqual({
      checked: 1,
      restocked: 0,
      soldOut: 0,
      errors: 0,
    });

    expect(databaseMocks.productUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ inStock: true, consecutiveConfirm: 0 }),
      }),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      { provider: 'buyvm', product: 'Slice 1024', inStock: true },
      'New product baseline recorded without notification',
    );
    expect(databaseMocks.productUpdate).not.toHaveBeenCalled();
    expect(databaseMocks.stockEventCreate).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it.each([
    {
      productId: 'gc-101',
      planName: 'Tokyo KVM 2',
      orderUrl: 'https://greencloudvps.com/billing/cart.php?a=add&pid=101',
      pid: '101',
    },
    {
      productId: 'gc-2081',
      planName: 'CN Premium Optimized Plan 3 (Tokyo)',
      orderUrl:
        'https://greencloudvps.com/billing/store/cn-premium-optimized/cn-premium-optimized-plan-3',
      pid: '2081',
    },
  ])(
    'registers GreenCloud product link for $productId with PID $pid',
    async ({ productId, planName, orderUrl, pid }) => {
      const logger = createLogger();
      const greenCloudResult: StockResult = {
        ...stockResult,
        provider: 'greencloudvps',
        productId,
        planName,
        orderUrl,
      };
      databaseMocks.providerFindUnique.mockResolvedValue({
        id: 'greencloud-provider',
        affiliateLinks: [
          {
            slug: 'greencloudvps',
            targetUrl: 'https://greencloudvps.com/billing/aff.php?aff=6807',
            shortUrl: 'https://stock.vpsknow.com/go/greencloudvps',
          },
        ],
      });

      await processStockResults('greencloudvps', [greenCloudResult], logger);

      expect(databaseMocks.productUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ whmcsPid: pid }),
          create: expect.objectContaining({ whmcsPid: pid }),
        }),
      );
      const slug = `greencloudvps-${productId}`;
      const targetUrl = `https://greencloudvps.com/billing/aff.php?aff=6807&pid=${pid}`;
      const shortUrl = `https://stock.vpsknow.com/go/${slug}`;
      expect(databaseMocks.affiliateLinkUpsert).toHaveBeenCalledWith({
        where: { slug },
        update: { targetUrl, shortUrl },
        create: {
          providerId: 'greencloud-provider',
          slug,
          targetUrl,
          shortUrl,
        },
      });
    },
  );

  it('does not duplicate a provider prefix already present in the product ID', async () => {
    const logger = createLogger();
    const zgoCloudResult: StockResult = {
      ...stockResult,
      provider: 'zgocloud',
      productId: 'zgocloud-121',
      planName: 'Hong Kong VPS',
      orderUrl: 'https://clients.zgovps.com/?action=add&cmd=cart&id=121',
    };
    databaseMocks.providerFindUnique.mockResolvedValue({
      id: 'zgocloud-provider',
      affiliateLinks: [],
    });

    await processStockResults('zgocloud', [zgoCloudResult], logger);

    expect(databaseMocks.affiliateLinkUpsert).toHaveBeenCalledWith({
      where: { slug: 'zgocloud-121' },
      update: {
        targetUrl: 'https://clients.zgovps.com/?action=add&cmd=cart&id=121&affid=488',
        shortUrl: 'https://stock.vpsknow.com/go/zgocloud-121',
      },
      create: {
        providerId: 'zgocloud-provider',
        slug: 'zgocloud-121',
        targetUrl: 'https://clients.zgovps.com/?action=add&cmd=cart&id=121&affid=488',
        shortUrl: 'https://stock.vpsknow.com/go/zgocloud-121',
      },
    });
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
    const inStockResult = {
      ...stockResult,
      inStock: true,
      displaySpecs: {
        storage: '20GB NVMe RAID-10',
        bandwidth: '500GB',
        port: '500Mbps',
        remark: 'OS: Linux',
      },
    };
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
            displaySpecs: {
              storage: '20GB NVMe RAID-10',
              bandwidth: '500GB',
              port: '500Mbps',
              remark: 'OS: Linux',
            },
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
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
    );
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledWith(
      '@vpsknow_offers',
      'formatted restock message',
    );
    expect(databaseMocks.telegramMessageCreate).toHaveBeenCalledWith({
      data: {
        channelId: '@vpsknow_offers',
        messageId: 321,
        stockEventId: 'event-1',
        content: 'formatted restock message',
      },
    });
    expect(databaseMocks.stockEventUpdate).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { notified: true },
    });
    expect(databaseMocks.transaction).toHaveBeenCalledOnce();
    expect(subscriberMocks.notifyRestockSubscribers).toHaveBeenCalledWith(
      inStockResult,
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
      logger,
    );
  });

  it('suppresses a restock within the cooldown while updating product state', async () => {
    const logger = createLogger();
    const debugSpy = vi.spyOn(logger, 'debug');
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));
    databaseMocks.stockEventFindFirst
      .mockResolvedValueOnce({ id: 'recent-event' })
      .mockResolvedValueOnce(null);

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

  it('retries a recent unsent restock while the product remains in stock', async () => {
    const logger = createLogger();
    const warnSpy = vi.spyOn(logger, 'warn');
    const inStockResult = { ...stockResult, inStock: true };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(true, 0));
    databaseMocks.stockEventFindFirst.mockResolvedValue({ id: 'pending-event' });

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
        notified: false,
        detectedAt: { gte: new Date('2026-07-21T11:00:00.000Z') },
        telegramMessages: { none: {} },
      },
      orderBy: { detectedAt: 'desc' },
      select: { id: true },
    });
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledWith(
      '@vpsknow_offers',
      'formatted restock message',
    );
    expect(databaseMocks.stockEventUpdate).toHaveBeenCalledWith({
      where: { id: 'pending-event' },
      data: { notified: true },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      { provider: 'BuyVM', product: 'Slice 1024', eventId: 'pending-event' },
      'Retrying pending RESTOCK notification',
    );
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
      errors: 1,
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
    expect(databaseMocks.stockEventUpdate).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      { provider: 'BuyVM', product: 'Slice 1024', err: deliveryError },
      'Failed to send Telegram notification',
    );
  });

  it('notifies only the lowest-priced VMRack configuration in the same plan group', async () => {
    const logger = createLogger();
    const vmrackBase = {
      ...stockResult,
      provider: 'vmrack',
      location: 'Los Angeles',
      storageGb: 20,
      storageType: 'SSD',
      bandwidthTb: 1,
      price: 1_150,
      inStock: true,
      orderUrl: 'https://www.vmrack.net/vps',
    };
    const lowest = {
      ...vmrackBase,
      productId: 'vmrack-l3-vps-dc2-1c1g',
      planName: 'L3.VPS.DC2.1C1G',
      cpu: '1 vCPU',
      ramMb: 1_024,
    };
    const middle = {
      ...vmrackBase,
      productId: 'vmrack-l3-vps-dc2-2c2g',
      planName: 'L3.VPS.DC2.2C2G',
      cpu: '2 vCPUs',
      ramMb: 2_048,
      price: 1_300,
    };
    const highest = {
      ...vmrackBase,
      productId: 'vmrack-l3-vps-dc2-4c4g',
      planName: 'L3.VPS.DC2.4C4G',
      cpu: '4 vCPUs',
      ramMb: 4_096,
      price: 2_000,
    };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));

    await expect(processStockResults('vmrack', [highest, middle, lowest], logger)).resolves.toEqual(
      {
        checked: 3,
        restocked: 3,
        soldOut: 0,
        errors: 0,
      },
    );

    expect(databaseMocks.stockEventCreate).toHaveBeenCalledTimes(3);
    expect(telegramMocks.formatRestockMessage).toHaveBeenCalledOnce();
    expect(telegramMocks.formatRestockMessage).toHaveBeenCalledWith(
      lowest,
      'https://stock.vpsknow.com/go/vmrack-l3-vps-dc2-1c1g',
    );
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledOnce();
    expect(subscriberMocks.notifyRestockSubscribers).toHaveBeenCalledOnce();
    expect(subscriberMocks.notifyRestockSubscribers).toHaveBeenCalledWith(
      lowest,
      'https://stock.vpsknow.com/go/vmrack-l3-vps-dc2-1c1g',
      logger,
    );
  });

  it('keeps separate VMRack route series eligible for notification', async () => {
    const logger = createLogger();
    const common = {
      ...stockResult,
      provider: 'vmrack',
      location: 'Los Angeles',
      storageGb: 20,
      bandwidthTb: 1,
      inStock: true,
      orderUrl: 'https://www.vmrack.net/vps',
    };
    const l2Plan = {
      ...common,
      productId: 'vmrack-l2-vps-dc2-1c1g',
      planName: 'L2.VPS.DC2.1C1G',
      price: 1_000,
    };
    const l3Plan = {
      ...common,
      productId: 'vmrack-l3-vps-dc2-1c1g',
      planName: 'L3.VPS.DC2.1C1G',
      price: 1_150,
    };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(false, 1));

    await processStockResults('vmrack', [l2Plan, l3Plan], logger);

    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledTimes(2);
    expect(subscriberMocks.notifyRestockSubscribers).toHaveBeenCalledTimes(2);
  });

  it('retries only the lowest-priced pending VMRack configuration while it remains available', async () => {
    const logger = createLogger();
    const lowest = {
      ...stockResult,
      provider: 'vmrack',
      productId: 'vmrack-l3-vps-dc2-1c1g',
      planName: 'L3.VPS.DC2.1C1G',
      location: 'Los Angeles',
      storageGb: 20,
      bandwidthTb: 1,
      price: 1_150,
      inStock: true,
      orderUrl: 'https://www.vmrack.net/vps',
    };
    const higher = {
      ...lowest,
      productId: 'vmrack-l3-vps-dc2-2c2g',
      planName: 'L3.VPS.DC2.2C2G',
      cpu: '2 vCPUs',
      ramMb: 2_048,
      price: 1_300,
    };
    databaseMocks.productUpsert.mockResolvedValue(createProduct(true, 0));
    databaseMocks.stockEventFindFirst.mockResolvedValue({ id: 'pending-event' });

    await processStockResults('vmrack', [higher, lowest], logger);

    expect(databaseMocks.stockEventFindFirst).toHaveBeenCalledOnce();
    expect(telegramMocks.formatRestockMessage).toHaveBeenCalledOnce();
    expect(telegramMocks.formatRestockMessage).toHaveBeenCalledWith(
      lowest,
      'https://stock.vpsknow.com/go/vmrack-l3-vps-dc2-1c1g',
    );
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledOnce();
  });

  it('continues processing later results after a per-result database failure', async () => {
    const logger = createLogger();
    const errorSpy = vi.spyOn(logger, 'error');
    const databaseError = new Error('Database unavailable');
    const secondResult = { ...stockResult, productId: 'slice-2048-lv', planName: 'Slice 2048' };
    databaseMocks.productUpsert
      .mockRejectedValueOnce(databaseError)
      .mockResolvedValueOnce(createProduct(false, 0));

    await expect(
      processStockResults('buyvm', [stockResult, secondResult], logger),
    ).resolves.toEqual({
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

describe('product affiliate mapping', () => {
  it.each([
    [
      'bandwagonhost',
      'bwg-hk-cn2gia',
      'https://bandwagonhost.com/cart.php?a=add&pid=95',
      '95',
      'https://bandwagonhost.com/aff.php?aff=68376&pid=95',
    ],
    [
      'dmit',
      'dmit-pvm-lax-tiny',
      'https://www.dmit.io/cart.php?a=add&pid=253',
      '253',
      'https://www.dmit.io/aff.php?aff=6077&pid=253',
    ],
    [
      'buyvm',
      'slice-1024-lv',
      'https://my.frantech.ca/cart.php?a=add&pid=1024',
      '1024',
      'https://my.frantech.ca/aff.php?aff=6836&pid=1024',
    ],
    [
      'spartanhost',
      'spartan-1024mb-dalkvm',
      'https://billing.spartanhost.net/cart.php?a=add&pid=317',
      '317',
      'https://billing.spartanhost.net/aff.php?aff=2459&pid=317',
    ],
    [
      'greencloudvps',
      'gc-2081',
      'https://greencloudvps.com/billing/store/cn-premium-optimized/cn-premium-optimized-plan-3',
      '2081',
      'https://greencloudvps.com/billing/aff.php?aff=6807&pid=2081',
    ],
    [
      'vmiss',
      'vmiss-101',
      'https://app.vmiss.com/store/vps/plan-a',
      '101',
      'https://app.vmiss.com/aff.php?aff=1922&pid=101',
    ],
    [
      'saltyfish',
      'saltyfish-137',
      'https://portal.saltyfish.io/store/hong-kong/plan-a',
      '137',
      'https://portal.saltyfish.io/aff.php?aff=575&pid=137',
    ],
    [
      'racknerd',
      'racknerd-871',
      'https://my.racknerd.com/index.php?rp=/store/dedicated-servers/dual-intel-xeon-e5-2650-v2-128gb-ram-1tb-ssd-3tb-hdd',
      '871',
      'https://my.racknerd.com/aff.php?aff=5550&pid=871',
    ],
    [
      'liteserver',
      'liteserver-407',
      'https://clients.liteserver.nl/index.php?rp=/store/hdd-storage-vps/hdd-1g-1',
      '407',
      'https://clients.liteserver.nl/aff.php?aff=771&pid=407',
    ],
    [
      'dedirock',
      'dedirock-36',
      'https://billing.dedirock.com/index.php/store/kvm-vps-hosting/kvm-vps-start',
      '36',
      'https://billing.dedirock.com/aff.php?aff=77&pid=36',
    ],
    [
      'bagevm',
      'bagevm-29',
      'https://www.bagevm.com/index.php?rp=/store/japan-servers/plan-a',
      '29',
      'https://www.bagevm.com/aff.php?aff=10&pid=29',
    ],
    [
      'gomami',
      'gomami-26',
      'https://gomami.io/store/hkg-pulse/hkgpulsenano',
      '26',
      'https://gomami.io/aff.php?aff=209&pid=26',
    ],
    [
      'colocrossing',
      'colocrossing-63',
      'https://cloud.colocrossing.com/index.php?rp=/store/specials/1gb-ram-spring-special',
      '63',
      'https://cloud.colocrossing.com/aff.php?aff=467&pid=63',
    ],
    [
      'chicagovps',
      'chicagovps-597',
      'https://billing.chicagovps.net/index.php?rp=/store/cloud-vps/1gb-ram',
      '597',
      'https://billing.chicagovps.net/aff.php?aff=2611&pid=597',
    ],
    [
      'speedypage',
      'speedypage-116',
      'https://my.speedypage.com/store/virtual-servers-singapore/sg-kvm-1g',
      '116',
      'https://my.speedypage.com/aff.php?aff=405&pid=116',
    ],
  ])('maps %s to its verified product PID', (provider, productId, orderUrl, pid, expected) => {
    const extracted = extractWhmcsPid(provider, orderUrl, productId);

    expect(extracted).toBe(pid);
    expect(buildProductAffiliateUrl(provider, orderUrl, extracted)).toBe(expected);
  });

  it('does not infer a PID suffix for providers configured to use the order URL', () => {
    const orderUrl = 'https://bandwagonhost.com/cart.php';

    expect(extractWhmcsPid('bandwagonhost', orderUrl, 'bwg-plan-95')).toBeNull();
    expect(buildProductAffiliateUrl('bandwagonhost', orderUrl, null)).toBe(orderUrl);
  });

  it('merges the verified V.PS HostBill affiliate parameter into the exact product URL', () => {
    const orderUrl = 'https://vps.hosting/?action=add&cmd=cart&id=235';

    expect(extractWhmcsPid('vps', orderUrl, 'vps-235')).toBeNull();
    expect(buildProductAffiliateUrl('vps', orderUrl, null)).toBe(
      'https://vps.hosting/?action=add&cmd=cart&id=235&affid=723',
    );
  });

  it('does not merge the V.PS affiliate parameter into an unexpected origin', () => {
    const orderUrl = 'https://example.com/?action=add&cmd=cart&id=235';

    expect(buildProductAffiliateUrl('vps', orderUrl, null)).toBe(orderUrl);
  });

  it('merges the verified ZgoCloud HostBill affiliate parameter into the exact product URL', () => {
    const orderUrl = 'https://clients.zgovps.com/?action=add&cmd=cart&id=136';

    expect(extractWhmcsPid('zgocloud', orderUrl, 'zgocloud-136')).toBeNull();
    expect(buildProductAffiliateUrl('zgocloud', orderUrl, null)).toBe(
      'https://clients.zgovps.com/?action=add&cmd=cart&id=136&affid=488',
    );
  });

  it('replaces the PoorVPS LightLayer affiliate ID with the configured project ID', () => {
    const orderUrl = 'https://account.lightlayer.net/?cmd=cart&action=add&affid=893&id=102';

    expect(extractWhmcsPid('lightlayer', orderUrl, 'lightlayer-102')).toBeNull();
    expect(buildProductAffiliateUrl('lightlayer', orderUrl, null)).toBe(
      'https://account.lightlayer.net/?cmd=cart&action=add&affid=647&id=102',
    );
  });

  it('adds the VMRack referral code only to the verified official origin', () => {
    const orderUrl = 'https://www.vmrack.net/vps';

    expect(extractWhmcsPid('vmrack', orderUrl, 'vmrack-l3-vps-dc2-2c4g-pro')).toBeNull();
    expect(buildProductAffiliateUrl('vmrack', orderUrl, null)).toBe(
      'https://www.vmrack.net/vps?ref_code=5YrpHKG16xf',
    );
    expect(buildProductAffiliateUrl('vmrack', 'https://example.com/vps', null)).toBe(
      'https://example.com/vps',
    );
  });

  it('keeps Evoxt on its exact deploy URL without guessing a legacy WHMCS PID', () => {
    const orderUrl = 'https://console.evoxt.com/deploy.php';

    expect(extractWhmcsPid('evoxt', orderUrl, 'evoxt-uk-london-vm-1')).toBeNull();
    expect(buildProductAffiliateUrl('evoxt', orderUrl, null)).toBe(orderUrl);
  });
});
