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
  telegramMessageCreate: vi.fn(),
  affiliateLinkUpsert: vi.fn(),
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
    affiliateLink: { upsert: databaseMocks.affiliateLinkUpsert },
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
    databaseMocks.productUpdate.mockResolvedValue(createProduct(false, 0));
    databaseMocks.telegramMessageCreate.mockResolvedValue({ id: 'telegram-1' });
    databaseMocks.affiliateLinkUpsert.mockImplementation(async ({ create }) => create);
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
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
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
      'racknerd-301',
      'https://my.racknerd.com/cart.php?a=add&pid=301',
      '301',
      'https://my.racknerd.com/aff.php?aff=5550&pid=301',
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

  it('keeps Evoxt on its exact deploy URL without guessing a legacy WHMCS PID', () => {
    const orderUrl = 'https://console.evoxt.com/deploy.php';

    expect(extractWhmcsPid('evoxt', orderUrl, 'evoxt-uk-london-vm-1')).toBeNull();
    expect(buildProductAffiliateUrl('evoxt', orderUrl, null)).toBe(orderUrl);
  });
});
