import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoverLetOffers,
  type OfferDiscoveryDependencies,
} from './offers-engine.js';

const databaseMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  telegramMessageCreate: vi.fn(),
  transaction: vi.fn(),
}));
const parserMocks = vi.hoisted(() => ({
  parseLetListing: vi.fn(),
  parseLetRss: vi.fn(),
  parseLetOffer: vi.fn(),
}));

vi.mock('@vpsknow/database', () => ({
  prisma: {
    offer: {
      findUnique: databaseMocks.findUnique,
      create: databaseMocks.create,
      update: databaseMocks.update,
    },
    telegramMessage: { create: databaseMocks.telegramMessageCreate },
    $transaction: databaseMocks.transaction,
  },
}));
vi.mock('@vpsknow/parsers', () => parserMocks);

const discussion = {
  discussionId: '12345',
  title: 'ExampleHost Limited VPS Flash Sale',
  author: 'ExampleHost',
  postedAt: new Date('2026-07-21T12:00:00.000Z'),
  url: 'https://lowendtalk.com/discussion/12345/example',
};
const parsedOffer = {
  provider: 'ExampleHost', title: discussion.title, body: '2 GB VPS $12.00 annual', category: 'vps',
  locations: ['Los Angeles'], priceCents: 1200, currency: 'USD', billingCycle: 'annually',
  couponCode: 'FLASH26', orderUrl: 'https://example.com/order', isLimitedStock: true,
  isRecurring: false, isPreorder: false, confidence: 1,
};

const storedOffer = {
  id: 'offer-1',
  ...parsedOffer,
  threadUrl: discussion.url,
  postedAt: discussion.postedAt,
  pushed: false,
};

const sendMessage = vi.fn<OfferDiscoveryDependencies['sendMessage']>();
const disabledNotifications: OfferDiscoveryDependencies = {
  offersChannelId: null,
  sendMessage,
};

function connection(firstRun: string | null) {
  return { get: vi.fn().mockResolvedValue(firstRun), set: vi.fn().mockResolvedValue('OK') };
}
function response(text: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: vi.fn().mockResolvedValue(text) };
}

describe('discoverLetOffers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TELEGRAM_OFFERS_CHANNEL_ID', '');
    databaseMocks.findUnique.mockResolvedValue(null);
    databaseMocks.create.mockResolvedValue(storedOffer);
    databaseMocks.update.mockResolvedValue({ ...storedOffer, pushed: true });
    databaseMocks.telegramMessageCreate.mockResolvedValue({ id: 'message-1' });
    databaseMocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations));
    sendMessage.mockResolvedValue(1001);
    parserMocks.parseLetListing.mockReturnValue([discussion]);
    parserMocks.parseLetRss.mockReturnValue([discussion]);
    parserMocks.parseLetOffer.mockReturnValue(parsedOffer);
  });

  it('establishes a first-run baseline without fetching historical offers', async () => {
    const redis = connection(null);
    const fetcher = vi.fn();

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 0, stored: 0, pushed: 0, skipped: 0, initialized: true,
    });
    expect(redis.set).toHaveBeenCalledWith('let:first-run-at', expect.any(String), 'NX');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('skips an existing discussion ID without fetching its detail page', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValue(response('<rss />'));
    databaseMocks.findUnique.mockResolvedValue({ ...storedOffer, pushed: true });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 0, pushed: 0, skipped: 1, initialized: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('stores a valid newly discovered offer using its discussion ID', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response('<rss />')).mockResolvedValueOnce(response('<article />'));

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 1, pushed: 0, skipped: 0, initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: 'lowendtalk', sourceId: '12345', threadUrl: discussion.url }),
    });
  });

  it('skips offers without a category or price', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response('<rss />')).mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetOffer.mockReturnValue({ ...parsedOffer, category: null, priceCents: null });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 0, pushed: 0, skipped: 1, initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('skips an untrusted offer without an offer-trigger title', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response('<rss />')).mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetRss.mockReturnValue([{ ...discussion, title: 'Affordable VPS plan' }]);
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'UnknownHost',
      title: 'Affordable VPS plan',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 0, pushed: 0, skipped: 1, initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('stores a trusted provider offer without an offer-trigger title', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response('<rss />')).mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'BuyVM',
      title: 'Affordable VPS plan',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 1, pushed: 0, skipped: 0, initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledOnce();
  });

  it('rejects excluded content even when the title matches an offer trigger', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValueOnce(response('<rss />')).mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'BuyVM',
      body: 'Limited shared hosting promotion',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 0, pushed: 0, skipped: 1, initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('falls back to the HTML listing when RSS is unavailable', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('', 503))
      .mockResolvedValueOnce(response('<html />'))
      .mockResolvedValueOnce(response('<article />'));

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1, stored: 1, pushed: 0, skipped: 0, initialized: false,
    });
    expect(parserMocks.parseLetListing).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('propagates failures when RSS and the HTML listing are unavailable', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('', 503))
      .mockResolvedValueOnce(response('', 502));

    await expect(discoverLetOffers(redis, fetcher)).rejects.toThrow(
      'LowEndTalk RSS HTTP 503; listing HTTP 502',
    );
  });

  it('sends a new offer to the offers channel and records the delivery', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).resolves.toEqual({
      discovered: 1, stored: 1, pushed: 1, skipped: 0, initialized: false,
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '@vpsknow_offers',
      expect.stringContaining('https://go.uukk.de/?url=https%3A%2F%2Fexample.com%2Forder'),
      { disableWebPagePreview: true },
    );
    expect(databaseMocks.telegramMessageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ channelId: '@vpsknow_offers', messageId: 1001 }),
    });
    expect(databaseMocks.update).toHaveBeenCalledWith({
      where: { id: 'offer-1' },
      data: { pushed: true },
    });
  });

  it('retries an existing offer that was stored but not pushed', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValue(response('<rss />'));
    databaseMocks.findUnique.mockResolvedValue(storedOffer);
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).resolves.toEqual({
      discovered: 1, stored: 0, pushed: 1, skipped: 0, initialized: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(databaseMocks.create).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('leaves a newly stored offer eligible for retry when Telegram delivery fails', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    sendMessage.mockRejectedValueOnce(new Error('Telegram unavailable'));
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).rejects.toThrow('Telegram unavailable');
    expect(databaseMocks.create).toHaveBeenCalledOnce();
    expect(databaseMocks.update).not.toHaveBeenCalled();
  });
});
