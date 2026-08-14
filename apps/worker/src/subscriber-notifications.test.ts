import { beforeEach, describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import type { StockResult } from '@vpsknow/providers';
import {
  matchesRestockSubscription,
} from './subscriber-notifications.js';
import {
  matchesOfferSubscription,
  notifyOfferSubscribers,
  retryPendingOfferNotifications,
} from './offer-subscriber-deliveries.js';

const databaseMocks = vi.hoisted(() => ({
  subscription: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  offerSubscriberDelivery: {
    createMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  telegramMessage: { create: vi.fn() },
  transaction: vi.fn(),
}));
const telegramMocks = vi.hoisted(() => ({
  formatRestockMessage: vi.fn(),
  sendChannelMessage: vi.fn(),
}));

vi.mock('@vpsknow/database', () => ({
  prisma: {
    subscription: databaseMocks.subscription,
    offerSubscriberDelivery: databaseMocks.offerSubscriberDelivery,
    telegramMessage: databaseMocks.telegramMessage,
    $transaction: databaseMocks.transaction,
  },
}));
vi.mock('@vpsknow/telegram', () => telegramMocks);

const result: StockResult = {
  provider: 'buyvm',
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
};

const logger = pino({ enabled: false });
const subscription = {
  id: 'subscription-1',
  telegramUserId: 100n,
  chatId: 200n,
  providers: [],
  regions: [],
  categories: [],
  maxPriceCents: null,
  eventTypes: ['offers'],
  isActive: true,
  mutedUntil: null,
};
const offer = {
  id: 'offer-1',
  provider: 'ExampleHost',
  locations: ['Tokyo'],
  category: 'vps',
  priceCents: 1200,
  priceAmount: 12,
  currency: 'USD',
};

describe('subscriber notification matching', () => {
  it('matches empty filters as all-inclusive', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
  });

  it('requires every configured filter to match', () => {
    expect(matchesRestockSubscription({
      providers: ['buyvm'],
      regions: ['Las Vegas'],
      categories: ['vps'],
      maxPriceCents: 500,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: ['dmit'],
      regions: ['Las Vegas'],
      categories: ['vps'],
      maxPriceCents: 500,
    }, result)).toBe(false);
  });

  it('does not compare non-USD prices against a USD limit', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: 10_000,
    }, { ...result, currency: 'EUR' })).toBe(false);
  });

  it('matches coarse and legacy region filters against free-text locations', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['US West'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Las Vegas'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Asia'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(false);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Tokyo'],
      categories: [],
      maxPriceCents: null,
    }, { ...result, location: 'Tokyo Narita' })).toBe(true);
  });

  it('matches offers using normalized providers and any overlapping region', () => {
    expect(matchesOfferSubscription({
      providers: ['greencloudvps'],
      regions: ['Asia'],
      categories: ['vps'],
      maxPriceCents: 2500,
    }, {
      provider: 'GreenCloudVPS',
      locations: ['Hong Kong', 'Tokyo'],
      category: 'vps',
      priceCents: 2400,
      currency: 'USD',
    })).toBe(true);
  });

  it('rejects offers with unknown prices when a maximum is configured', () => {
    expect(matchesOfferSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: 2500,
    }, {
      provider: 'ExampleHost',
      locations: [],
      category: 'vps',
      priceCents: null,
      currency: null,
    })).toBe(false);
  });

  it('compares sub-cent offers using their precise parsed amount', () => {
    expect(matchesOfferSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: 1,
    }, {
      provider: 'TierHive',
      locations: [],
      category: 'vps',
      priceCents: 0,
      priceAmount: 0.000135,
      currency: 'USD',
    })).toBe(true);
  });
});

describe('offer subscriber delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseMocks.subscription.findMany.mockResolvedValue([subscription]);
    databaseMocks.subscription.updateMany.mockResolvedValue({ count: 1 });
    databaseMocks.offerSubscriberDelivery.createMany.mockResolvedValue({ count: 1 });
    databaseMocks.offerSubscriberDelivery.updateMany.mockResolvedValue({ count: 1 });
    databaseMocks.offerSubscriberDelivery.update.mockResolvedValue({ attempts: 1 });
    databaseMocks.offerSubscriberDelivery.findMany.mockResolvedValue([
      { id: 'delivery-1', subscriptionId: 'subscription-1' },
    ]);
    databaseMocks.telegramMessage.create.mockResolvedValue({ id: 'telegram-1' });
    databaseMocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    telegramMocks.sendChannelMessage.mockResolvedValue(3001);
  });

  it('persists and sends a matching offer delivery', async () => {
    await notifyOfferSubscribers(offer, 'offer message', logger);

    expect(databaseMocks.offerSubscriberDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          offerId: 'offer-1',
          subscriptionId: 'subscription-1',
          content: 'offer message',
        }),
      ],
      skipDuplicates: true,
    });
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledWith(
      '200',
      'offer message',
      { disableWebPagePreview: true },
    );
    expect(databaseMocks.transaction).toHaveBeenCalledOnce();
  });

  it('queues a failed Telegram send for a later retry', async () => {
    telegramMocks.sendChannelMessage.mockRejectedValueOnce(new Error('Telegram unavailable'));

    await notifyOfferSubscribers(offer, 'offer message', logger);

    expect(databaseMocks.offerSubscriberDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({
        status: 'failed',
        lastError: 'Telegram unavailable',
      }),
    });
    expect(databaseMocks.transaction).not.toHaveBeenCalled();
  });

  it('defers a delivery when the subscriber rate limit is active', async () => {
    databaseMocks.subscription.updateMany.mockResolvedValueOnce({ count: 0 });

    await notifyOfferSubscribers(offer, 'offer message', logger);

    expect(databaseMocks.offerSubscriberDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: expect.objectContaining({ status: 'pending', nextAttemptAt: expect.any(Date) }),
    });
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('does not create a delivery for subscriptions excluded by the active mute query', async () => {
    databaseMocks.subscription.findMany.mockResolvedValueOnce([]);

    await notifyOfferSubscribers(offer, 'offer message', logger);

    expect(databaseMocks.subscription.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        eventTypes: { has: 'offers' },
        OR: [{ mutedUntil: null }, { mutedUntil: { lte: expect.any(Date) } }],
      },
    });
    expect(databaseMocks.offerSubscriberDelivery.createMany).not.toHaveBeenCalled();
  });

  it('defers an existing delivery until a newly configured mute expires', async () => {
    const mutedUntil = new Date(Date.now() + 60_000);
    databaseMocks.offerSubscriberDelivery.findMany.mockReset().mockResolvedValueOnce([
      {
        id: 'delivery-1',
        content: 'offer message',
        subscription: { ...subscription, mutedUntil },
      },
    ]);

    await retryPendingOfferNotifications(logger);

    expect(databaseMocks.offerSubscriberDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-1' },
      data: { status: 'pending', nextAttemptAt: mutedUntil },
    });
    expect(databaseMocks.offerSubscriberDelivery.updateMany).not.toHaveBeenCalled();
    expect(telegramMocks.sendChannelMessage).not.toHaveBeenCalled();
  });

  it('retries only the indexed due-delivery batch', async () => {
    databaseMocks.offerSubscriberDelivery.findMany.mockReset().mockResolvedValueOnce([
      {
        id: 'delivery-1',
        attempts: 1,
        content: 'offer message',
        subscription,
      },
    ]);

    await retryPendingOfferNotifications(logger);

    expect(databaseMocks.offerSubscriberDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        orderBy: { nextAttemptAt: 'asc' },
        include: { subscription: true },
      }),
    );
    expect(telegramMocks.sendChannelMessage).toHaveBeenCalledOnce();
  });
});
