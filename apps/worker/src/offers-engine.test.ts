import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoverLetOffers,
  discoverLowEndBoxOffers,
  discoverLowEndSpiritOffers,
  discoverOffers,
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
  parseLowEndBoxRss: vi.fn(),
  parseLowEndBoxOffer: vi.fn(),
  parseLowEndSpiritRss: vi.fn(),
}));
const subscriberMocks = vi.hoisted(() => ({
  notifyOfferSubscribers: vi.fn(),
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
vi.mock('./subscriber-notifications.js', () => subscriberMocks);

const discussion = {
  discussionId: '12345',
  title: 'ExampleHost Limited VPS Flash Sale',
  author: 'ExampleHost',
  postedAt: new Date('2026-07-21T12:00:00.000Z'),
  url: 'https://lowendtalk.com/discussion/12345/example',
};
const parsedOffer = {
  provider: 'ExampleHost',
  title: discussion.title,
  body: '2 GB VPS $12.00 annual',
  category: 'vps',
  locations: ['Los Angeles'],
  priceCents: 1200,
  currency: 'USD',
  billingCycle: 'annually',
  couponCode: 'FLASH26',
  orderUrl: 'https://example.com/order',
  isLimitedStock: true,
  ipv4: true,
  isRecurring: false,
  isPreorder: false,
  confidence: 1,
};

const storedOffer = {
  id: 'offer-1',
  source: 'lowendtalk',
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
    databaseMocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
    sendMessage.mockResolvedValue(1001);
    subscriberMocks.notifyOfferSubscribers.mockResolvedValue(undefined);
    parserMocks.parseLetListing.mockReturnValue([discussion]);
    parserMocks.parseLetRss.mockReturnValue([discussion]);
    parserMocks.parseLetOffer.mockReturnValue(parsedOffer);
    parserMocks.parseLowEndBoxRss.mockReturnValue([]);
    parserMocks.parseLowEndBoxOffer.mockReturnValue(parsedOffer);
    parserMocks.parseLowEndSpiritRss.mockReturnValue([]);
  });

  it('establishes a first-run baseline without fetching historical offers', async () => {
    const redis = connection(null);
    const fetcher = vi.fn();

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 0,
      stored: 0,
      pushed: 0,
      skipped: 0,
      initialized: true,
    });
    expect(redis.set).toHaveBeenCalledWith('let:first-run-at', expect.any(String), 'NX');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('skips an existing discussion ID without fetching its detail page', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValue(response('<rss />'));
    databaseMocks.findUnique.mockResolvedValue({ ...storedOffer, pushed: true });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 0,
      pushed: 0,
      skipped: 1,
      initialized: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('stores a valid newly discovered offer using its discussion ID', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'lowendtalk',
        sourceId: '12345',
        threadUrl: discussion.url,
        ipv4: true,
      }),
    });
    expect(subscriberMocks.notifyOfferSubscribers).toHaveBeenCalledOnce();
  });

  it('skips offers without a category or price', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetOffer.mockReturnValue({ ...parsedOffer, category: null, priceCents: null });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 0,
      pushed: 0,
      skipped: 1,
      initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('skips an untrusted offer without an offer-trigger title', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetRss.mockReturnValue([{ ...discussion, title: 'Affordable VPS plan' }]);
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'UnknownHost',
      title: 'Affordable VPS plan',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 0,
      pushed: 0,
      skipped: 1,
      initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('stores a trusted provider offer without an offer-trigger title', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'BuyVM',
      title: 'Affordable VPS plan',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledOnce();
  });

  it('stores a priced storage VPS offer when the title has an offer trigger', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetRss.mockReturnValue([{ ...discussion, title: 'Storage VPS Offer' }]);
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'StorageHost',
      title: 'Storage VPS Offer',
      category: 'storage',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledOnce();
  });

  it('rejects an excluded offer type even when the title has an offer trigger', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetRss.mockReturnValue([
      { ...discussion, title: 'Limited shared hosting promotion' },
    ]);
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'BuyVM',
      title: 'Limited shared hosting promotion',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 0,
      pushed: 0,
      skipped: 1,
      initialized: false,
    });
    expect(databaseMocks.create).not.toHaveBeenCalled();
  });

  it('keeps a VPS offer when shared hosting appears only later in a mixed post', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLetRss.mockReturnValue([
      { ...discussion, title: 'RackNerd VPS Black Friday Deals' },
    ]);
    parserMocks.parseLetOffer.mockReturnValue({
      ...parsedOffer,
      provider: 'dustinc',
      title: 'RackNerd VPS Black Friday Deals',
      body: 'KVM VPS plans are listed first. Shared hosting plans are also available.',
    });

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledOnce();
  });

  it('falls back to the HTML listing when RSS is unavailable', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('', 503))
      .mockResolvedValueOnce(response('<html />'))
      .mockResolvedValueOnce(response('<article />'));

    await expect(discoverLetOffers(redis, fetcher)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(parserMocks.parseLetListing).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('propagates failures when RSS and the HTML listing are unavailable', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('', 503))
      .mockResolvedValueOnce(response('', 502));

    await expect(discoverLetOffers(redis, fetcher)).rejects.toThrow(
      'LowEndTalk RSS HTTP 503; listing HTTP 502',
    );
  });

  it('sends a new offer to the offers channel and records the delivery', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 1,
      skipped: 0,
      initialized: false,
    });
    expect(sendMessage).toHaveBeenCalledWith(
      '@vpsknow_offers',
      expect.stringContaining(`🔗 View offer: ${discussion.url}`),
      { disableWebPagePreview: true },
    );
    const message = sendMessage.mock.calls[0]?.[1];
    expect(message).not.toContain('🔗 Order:');
    expect(message).not.toContain('https://example.com/order');
    expect(message).not.toContain('go.uukk.de');
    expect(message).toContain('🌐 vpsknow.com');
    expect(message).toContain('💬@vpsknow | 📢@vpsknow_channel | 🤖@vpsknow_bot');
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
      discovered: 1,
      stored: 0,
      pushed: 1,
      skipped: 0,
      initialized: false,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(databaseMocks.create).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('rejects a stored offer whose URL is not from its original source', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi.fn().mockResolvedValue(response('<rss />'));
    databaseMocks.findUnique.mockResolvedValue({
      ...storedOffer,
      threadUrl: 'https://stock.vpsknow.com/go/example',
    });
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).rejects.toThrow(
      'Offer offer-1 has an invalid original source URL',
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('establishes independent baselines for all three sources without replaying history', async () => {
    const redis = connection(null);
    const fetcher = vi.fn();

    await expect(discoverOffers(redis, fetcher, disabledNotifications)).resolves.toEqual({
      discovered: 0,
      stored: 0,
      pushed: 0,
      skipped: 0,
      initialized: true,
      sources: {
        lowendtalk: {
          discovered: 0,
          stored: 0,
          pushed: 0,
          skipped: 0,
          initialized: true,
        },
        lowendbox: {
          discovered: 0,
          stored: 0,
          pushed: 0,
          skipped: 0,
          initialized: true,
        },
        lowendspirit: {
          discovered: 0,
          stored: 0,
          pushed: 0,
          skipped: 0,
          initialized: true,
        },
      },
      failedSources: [],
    });
    expect(redis.set).toHaveBeenCalledWith('let:first-run-at', expect.any(String), 'NX');
    expect(redis.set).toHaveBeenCalledWith(
      'offers:lowendbox:first-run-at',
      expect.any(String),
      'NX',
    );
    expect(redis.set).toHaveBeenCalledWith(
      'offers:lowendspirit:first-run-at',
      expect.any(String),
      'NX',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('stores a new LowEndBox article with a globally namespaced source ID', async () => {
    const lowEndBoxDiscussion = {
      discussionId: 'lowendbox:53296',
      title: 'Affordable VPS plan',
      author: 'raindog308',
      postedAt: discussion.postedAt,
      url: 'https://lowendbox.com/blog/affordable-vps-plan/',
    };
    const lowEndBoxOffer = { ...parsedOffer, title: lowEndBoxDiscussion.title };
    const lowEndBoxStored = {
      ...storedOffer,
      source: 'lowendbox',
      title: lowEndBoxDiscussion.title,
      threadUrl: lowEndBoxDiscussion.url,
    };
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLowEndBoxRss
      .mockReturnValueOnce([lowEndBoxDiscussion])
      .mockReturnValueOnce([]);
    parserMocks.parseLowEndBoxOffer.mockReturnValue(lowEndBoxOffer);
    databaseMocks.create.mockResolvedValue(lowEndBoxStored);

    await expect(
      discoverLowEndBoxOffers(redis, fetcher, disabledNotifications),
    ).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'lowendbox',
        sourceId: 'lowendbox:53296',
        threadUrl: lowEndBoxDiscussion.url,
      }),
    });
  });

  it('stores a new LowEndSpirit discussion from the curated VPS feed', async () => {
    const lowEndSpiritDiscussion = {
      discussionId: 'lowendspirit:11151',
      title: 'New UK KVM VPS Annual Promo',
      author: 'ExampleHost',
      postedAt: discussion.postedAt,
      url: 'https://lowendspirit.com/discussion/11151/new-uk-kvm-vps-annual-promo',
    };
    const lowEndSpiritStored = {
      ...storedOffer,
      source: 'lowendspirit',
      title: lowEndSpiritDiscussion.title,
      threadUrl: lowEndSpiritDiscussion.url,
    };
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    parserMocks.parseLowEndSpiritRss
      .mockReturnValueOnce([lowEndSpiritDiscussion])
      .mockReturnValueOnce([]);
    databaseMocks.create.mockResolvedValue(lowEndSpiritStored);

    await expect(
      discoverLowEndSpiritOffers(redis, fetcher, disabledNotifications),
    ).resolves.toEqual({
      discovered: 1,
      stored: 1,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(databaseMocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'lowendspirit',
        sourceId: 'lowendspirit:11151',
        threadUrl: lowEndSpiritDiscussion.url,
      }),
    });
  });

  it('does not fetch an external feed entry whose URL is outside its source domain', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<rss />'));
    parserMocks.parseLowEndBoxRss
      .mockReturnValueOnce([
        {
          discussionId: 'lowendbox:53296',
          title: 'Affordable VPS plan',
          author: 'raindog308',
          postedAt: discussion.postedAt,
          url: 'https://example.com/blog/affordable-vps-plan/',
        },
      ])
      .mockReturnValueOnce([]);

    await expect(
      discoverLowEndBoxOffers(redis, fetcher, disabledNotifications),
    ).resolves.toEqual({
      discovered: 0,
      stored: 0,
      pushed: 0,
      skipped: 0,
      initialized: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(databaseMocks.findUnique).not.toHaveBeenCalled();
  });

  it('leaves a newly stored offer eligible for retry when Telegram delivery fails', async () => {
    const redis = connection('2026-07-21T11:00:00.000Z');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('<rss />'))
      .mockResolvedValueOnce(response('<article />'));
    sendMessage.mockRejectedValueOnce(new Error('Telegram unavailable'));
    const dependencies: OfferDiscoveryDependencies = {
      ...disabledNotifications,
      offersChannelId: '@vpsknow_offers',
    };

    await expect(discoverLetOffers(redis, fetcher, dependencies)).rejects.toThrow(
      'Telegram unavailable',
    );
    expect(databaseMocks.create).toHaveBeenCalledOnce();
    expect(databaseMocks.update).not.toHaveBeenCalled();
  });
});
