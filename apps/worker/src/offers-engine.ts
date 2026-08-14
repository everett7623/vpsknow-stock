import { prisma } from '@vpsknow/database';
import {
  parseLetListing,
  parseLetOffer,
  parseLetRss,
  parseLowEndBoxOffer,
  parseLowEndBoxRss,
  parseLowEndSpiritRss,
  type LetDiscussion,
  type ParsedLetOffer,
} from '@vpsknow/parsers';
import type { OfferSource } from '@vpsknow/shared';
import { formatOfferMessage, sendChannelMessage } from '@vpsknow/telegram';
import pino from 'pino';
import { notifyOfferSubscribers } from './subscriber-notifications.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

type DiscoveredOfferSource = Extract<OfferSource, 'lowendtalk' | 'lowendbox' | 'lowendspirit'>;

interface RedisConnection {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expirationMode: 'EX',
    ttlSeconds: number,
    mode?: 'NX',
  ): Promise<string | null>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

interface PushableOffer {
  id: string;
  source: string;
  provider: string | null;
  title: string;
  body: string | null;
  category: string | null;
  locations: string[];
  priceCents: number | null;
  currency: string | null;
  billingCycle: string | null;
  couponCode: string | null;
  orderUrl: string | null;
  threadUrl: string | null;
  postedAt: Date | null;
  pushed: boolean;
}

interface OfferSourceConfig {
  id: DiscoveredOfferSource;
  label: string;
  watermarkKey: string;
  feedUrls: readonly string[];
  parseFeed: (body: string) => LetDiscussion[];
  parseDetail: (title: string, body: string, author: string) => ParsedLetOffer;
  validHosts: readonly string[];
  validPath: RegExp;
  listingFallback?: {
    url: string;
    parse: (body: string, discoveredAt: Date) => LetDiscussion[];
  };
}

type Fetcher = (url: string, init: RequestInit) => Promise<FetchResponse>;

export interface OfferDiscoveryDependencies {
  offersChannelId: string | null;
  sendMessage: typeof sendChannelMessage;
  now?: () => Date;
}

export interface OfferDiscoverySummary {
  discovered: number;
  stored: number;
  pushed: number;
  skipped: number;
  initialized: boolean;
}

export interface MultiSourceOfferDiscoverySummary extends OfferDiscoverySummary {
  sources: Partial<Record<DiscoveredOfferSource, OfferDiscoverySummary>>;
  failedSources: DiscoveredOfferSource[];
}

const LOWENDTALK_SOURCE: OfferSourceConfig = {
  id: 'lowendtalk',
  label: 'LowEndTalk',
  watermarkKey: 'offers:lowendtalk:watermark:v1',
  feedUrls: ['https://lowendtalk.com/categories/offers/feeds.rss'],
  parseFeed: parseLetRss,
  parseDetail: parseLetOffer,
  validHosts: ['lowendtalk.com', 'www.lowendtalk.com'],
  validPath: /^\/discussion\/\d+(?:\/|$)/,
  listingFallback: {
    url: 'https://lowendtalk.com/categories/offers',
    parse: parseLetListing,
  },
};

const LOWENDBOX_SOURCE: OfferSourceConfig = {
  id: 'lowendbox',
  label: 'LowEndBox',
  watermarkKey: 'offers:lowendbox:watermark:v1',
  feedUrls: [
    'https://lowendbox.com/category/virtual-servers/feed/',
    'https://lowendbox.com/category/dedicated-servers/feed/',
  ],
  parseFeed: parseLowEndBoxRss,
  parseDetail: (title, body) => parseLowEndBoxOffer(title, body),
  validHosts: ['lowendbox.com', 'www.lowendbox.com'],
  validPath: /^\/blog\/[^/]+\/?$/,
};

const LOWENDSPIRIT_SOURCE: OfferSourceConfig = {
  id: 'lowendspirit',
  label: 'LowEndSpirit',
  watermarkKey: 'offers:lowendspirit:watermark:v1',
  feedUrls: [
    'https://lowendspirit.com/categories/vps/feed.rss',
    'https://lowendspirit.com/categories/dedicated-server/feed.rss',
  ],
  parseFeed: parseLowEndSpiritRss,
  parseDetail: parseLetOffer,
  validHosts: ['lowendspirit.com', 'www.lowendspirit.com'],
  validPath: /^\/discussion\/\d+(?:\/|$)/,
};

const OFFER_SOURCES = [LOWENDTALK_SOURCE, LOWENDBOX_SOURCE, LOWENDSPIRIT_SOURCE] as const;
const SOURCE_BY_ID = new Map<DiscoveredOfferSource, OfferSourceConfig>(
  OFFER_SOURCES.map((source) => [source.id, source]),
);

const EXCLUDED_OFFER_PATTERN =
  /\b(shared hosting|domain|email|ssl|service transfer|wtb|free proxy|vpn)\b/i;
const SERVER_OFFER_PATTERN =
  /\b(vps|vds|kvm|virtual (?:private )?server|dedicated server|storage (?:vps|server)|cloud server)\b/i;
const OFFER_CATEGORIES = new Set(['vps', 'vds', 'nat_vps', 'dedicated', 'storage']);
const OFFER_SCAN_OVERLAP_MS = 15 * 60 * 1_000;
const OFFER_WATERMARK_TTL_SECONDS = 30 * 24 * 60 * 60;

type OfferEligibilityFailure =
  | 'missing_category'
  | 'unsupported_category'
  | 'missing_price'
  | 'invalid_price'
  | 'excluded_title';

function defaultDependencies(): OfferDiscoveryDependencies {
  return {
    offersChannelId: process.env.TELEGRAM_OFFERS_CHANNEL_ID || null,
    sendMessage: sendChannelMessage,
    now: () => new Date(),
  };
}

function requestInit(): RequestInit {
  return {
    headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
    signal: AbortSignal.timeout(15_000),
  };
}

function emptySummary(initialized: boolean): OfferDiscoverySummary {
  return { discovered: 0, stored: 0, pushed: 0, skipped: 0, initialized };
}

function eligibilityFailure(
  title: string,
  category: string | null,
  priceCents: number | null,
): OfferEligibilityFailure | null {
  if (!category) return 'missing_category';
  if (!OFFER_CATEGORIES.has(category)) return 'unsupported_category';
  if (priceCents === null) return 'missing_price';
  if (priceCents <= 0) return 'invalid_price';
  if (EXCLUDED_OFFER_PATTERN.test(title) && !SERVER_OFFER_PATTERN.test(title)) {
    return 'excluded_title';
  }
  return null;
}

function priceSummary(offer: PushableOffer): string {
  if (offer.priceCents === null) return 'Price unavailable';
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
  const currency = offer.currency || 'USD';
  return `${symbols[currency] || `${currency} `}${(offer.priceCents / 100).toFixed(2)}`;
}

function categorySummary(category: string | null): string {
  const labels: Record<string, string> = {
    vps: 'VPS',
    vds: 'VDS',
    nat_vps: 'NAT VPS',
    dedicated: 'Dedicated Server',
    storage: 'Storage VPS',
  };
  return category ? labels[category] || category : 'Not specified';
}

function billingSummary(billingCycle: string | null): string {
  const labels: Record<string, string> = {
    monthly: 'month',
    quarterly: 'quarter',
    'semi-annually': '6 months',
    annually: 'year',
    biennially: '2 years',
    triennially: '3 years',
  };
  return billingCycle ? labels[billingCycle] || billingCycle : 'see original';
}

function isValidSourceUrl(source: OfferSourceConfig, value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      source.validHosts.includes(url.hostname) &&
      source.validPath.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function originalOfferUrl(offer: PushableOffer): string {
  if (!offer.threadUrl) {
    throw new Error(`Offer ${offer.id} is missing its original source URL`);
  }

  let url: URL;
  try {
    url = new URL(offer.threadUrl);
  } catch {
    throw new Error(`Offer ${offer.id} has an invalid original source URL`);
  }

  const source = SOURCE_BY_ID.get(offer.source as DiscoveredOfferSource);
  if (!source || !isValidSourceUrl(source, url.href)) {
    throw new Error(`Offer ${offer.id} has an invalid original source URL`);
  }
  return url.href;
}

async function pushOffer(
  offer: PushableOffer,
  dependencies: OfferDiscoveryDependencies,
  notifySubscribers = false,
): Promise<boolean> {
  if (offer.pushed) return false;
  const originalUrl = originalOfferUrl(offer);

  const message = formatOfferMessage({
    provider: offer.provider?.trim() || 'Unknown',
    title: offer.title,
    locations: offer.locations.join(', ') || 'Not specified',
    price: priceSummary(offer),
    category: categorySummary(offer.category),
    billing: billingSummary(offer.billingCycle),
    postedAt: offer.postedAt?.toISOString().slice(0, 10) || 'Unknown',
    couponCode: offer.couponCode,
    originalUrl,
    orderUrl: offer.orderUrl,
  });
  let channelPushed = false;
  let channelError: unknown;
  if (dependencies.offersChannelId) {
    try {
      const messageId = await dependencies.sendMessage(dependencies.offersChannelId, message, {
        disableWebPagePreview: true,
      });

      await prisma.$transaction([
        prisma.telegramMessage.create({
          data: {
            channelId: dependencies.offersChannelId,
            messageId,
            content: message,
            status: 'sent',
          },
        }),
        prisma.offer.update({
          where: { id: offer.id },
          data: { pushed: true },
        }),
      ]);
      channelPushed = true;
    } catch (error) {
      channelError = error;
    }
  }

  if (notifySubscribers) {
    await notifyOfferSubscribers(offer, message, logger);
  }
  if (channelError) throw channelError;
  return channelPushed;
}

async function readSourceDiscussions(
  source: OfferSourceConfig,
  fetcher: Fetcher,
  discoveredAt: Date,
): Promise<{ discussions: LetDiscussion[]; complete: boolean }> {
  const discussions = new Map<string, LetDiscussion>();
  const failures: string[] = [];
  let successfulFeeds = 0;

  for (const feedUrl of source.feedUrls) {
    const response = await fetcher(feedUrl, requestInit());
    if (!response.ok) {
      failures.push(`${feedUrl} HTTP ${response.status}`);
      continue;
    }

    successfulFeeds++;
    for (const discussion of source.parseFeed(await response.text())) {
      const expectedPrefix = source.id === 'lowendtalk' ? null : `${source.id}:`;
      if (
        !isValidSourceUrl(source, discussion.url) ||
        (expectedPrefix && !discussion.discussionId.startsWith(expectedPrefix))
      ) {
        logger.warn(
          { source: source.id, sourceId: discussion.discussionId, url: discussion.url },
          'Ignoring offer feed entry outside its source boundary',
        );
        continue;
      }
      discussions.set(discussion.discussionId, discussion);
    }
  }

  if (successfulFeeds === 0 && source.listingFallback) {
    const listingResponse = await fetcher(source.listingFallback.url, requestInit());
    if (!listingResponse.ok) {
      const rssStatus = failures[0]?.match(/HTTP (\d+)$/)?.[1] ?? 'unknown';
      throw new Error(
        `${source.label} RSS HTTP ${rssStatus}; listing HTTP ${listingResponse.status}`,
      );
    }
    return {
      discussions: source.listingFallback.parse(await listingResponse.text(), discoveredAt),
      complete: true,
    };
  }

  if (successfulFeeds === 0) {
    throw new Error(`${source.label} feeds unavailable: ${failures.join('; ')}`);
  }

  if (failures.length > 0) {
    logger.warn({ source: source.id, failures }, 'Offer source completed with partial feed failures');
  }

  return {
    discussions: [...discussions.values()],
    complete: failures.length === 0,
  };
}

async function discoverSourceOffers(
  source: OfferSourceConfig,
  connection: RedisConnection,
  fetcher: Fetcher,
  dependencies: OfferDiscoveryDependencies,
): Promise<OfferDiscoverySummary> {
  const now = dependencies.now?.() ?? new Date();
  const watermarkValue = await connection.get(source.watermarkKey);
  if (!watermarkValue) {
    await connection.set(
      source.watermarkKey,
      now.toISOString(),
      'EX',
      OFFER_WATERMARK_TTL_SECONDS,
      'NX',
    );
    return emptySummary(true);
  }

  const watermark = new Date(watermarkValue);
  if (Number.isNaN(watermark.getTime())) {
    throw new Error(`${source.label} discovery watermark is invalid`);
  }

  const sourceRead = await readSourceDiscussions(source, fetcher, now);
  const scanCutoff = new Date(watermark.getTime() - OFFER_SCAN_OVERLAP_MS);
  const recentDiscussions = sourceRead.discussions.filter((item) => item.postedAt >= scanCutoff);
  const summary: OfferDiscoverySummary = {
    ...emptySummary(false),
    discovered: recentDiscussions.length,
  };
  let shouldAdvanceWatermark = sourceRead.complete;

  for (const discussion of recentDiscussions) {
    const existing = await prisma.offer.findUnique({
      where: { sourceId: discussion.discussionId },
    });
    if (existing) {
      if (await pushOffer(existing, dependencies)) summary.pushed++;
      else summary.skipped++;
      continue;
    }

    let detailHtml = discussion.contentHtml ?? null;
    if (source.id === 'lowendbox' || !detailHtml) {
      const detailResponse = await fetcher(discussion.url, requestInit());
      if (detailResponse.ok) {
        detailHtml = await detailResponse.text();
      } else if (!detailHtml) {
        shouldAdvanceWatermark = false;
        logger.warn(
          {
            source: source.id,
            sourceId: discussion.discussionId,
            status: detailResponse.status,
          },
          'Skipping offer whose detail and feed content are unavailable',
        );
        summary.skipped++;
        continue;
      } else {
        logger.warn(
          {
            source: source.id,
            sourceId: discussion.discussionId,
            status: detailResponse.status,
          },
          'Using offer feed content after detail request failed',
        );
      }
    }

    const offer = source.parseDetail(
      discussion.title,
      detailHtml,
      discussion.author,
    );
    const failure = eligibilityFailure(discussion.title, offer.category, offer.priceCents);
    if (failure) {
      if (discussion.postedAt >= watermark) {
        logger.info(
          {
            source: source.id,
            sourceId: discussion.discussionId,
            reason: failure,
            category: offer.category,
            priceCents: offer.priceCents,
            title: discussion.title,
          },
          'Offer skipped by eligibility filter',
        );
      }
      summary.skipped++;
      continue;
    }

    const storedOffer = await prisma.offer.create({
      data: {
        source: source.id,
        sourceId: discussion.discussionId,
        provider: offer.provider,
        title: offer.title,
        body: offer.body,
        category: offer.category,
        locations: offer.locations,
        priceCents: offer.priceCents,
        currency: offer.currency,
        billingCycle: offer.billingCycle,
        couponCode: offer.couponCode,
        orderUrl: offer.orderUrl,
        threadUrl: discussion.url,
        ipv4: offer.ipv4,
        isLimitedStock: offer.isLimitedStock,
        isRecurring: offer.isRecurring,
        isPreorder: offer.isPreorder,
        confidence: offer.confidence,
        postedAt: discussion.postedAt,
      },
    });
    summary.stored++;

    if (await pushOffer(storedOffer, dependencies, true)) summary.pushed++;
  }

  if (shouldAdvanceWatermark) {
    await connection.set(
      source.watermarkKey,
      now.toISOString(),
      'EX',
      OFFER_WATERMARK_TTL_SECONDS,
    );
  } else {
    logger.warn(
      { source: source.id, watermark: watermark.toISOString() },
      'Offer discovery watermark retained for retry',
    );
  }

  return summary;
}

export function discoverLetOffers(
  connection: RedisConnection,
  fetcher: Fetcher = fetch,
  dependencies: OfferDiscoveryDependencies = defaultDependencies(),
): Promise<OfferDiscoverySummary> {
  return discoverSourceOffers(LOWENDTALK_SOURCE, connection, fetcher, dependencies);
}

export function discoverLowEndBoxOffers(
  connection: RedisConnection,
  fetcher: Fetcher = fetch,
  dependencies: OfferDiscoveryDependencies = defaultDependencies(),
): Promise<OfferDiscoverySummary> {
  return discoverSourceOffers(LOWENDBOX_SOURCE, connection, fetcher, dependencies);
}

export function discoverLowEndSpiritOffers(
  connection: RedisConnection,
  fetcher: Fetcher = fetch,
  dependencies: OfferDiscoveryDependencies = defaultDependencies(),
): Promise<OfferDiscoverySummary> {
  return discoverSourceOffers(LOWENDSPIRIT_SOURCE, connection, fetcher, dependencies);
}

export async function discoverOffers(
  connection: RedisConnection,
  fetcher: Fetcher = fetch,
  dependencies: OfferDiscoveryDependencies = defaultDependencies(),
): Promise<MultiSourceOfferDiscoverySummary> {
  const summary: MultiSourceOfferDiscoverySummary = {
    ...emptySummary(false),
    sources: {},
    failedSources: [],
  };

  for (const source of OFFER_SOURCES) {
    try {
      const sourceSummary = await discoverSourceOffers(source, connection, fetcher, dependencies);
      summary.sources[source.id] = sourceSummary;
      summary.discovered += sourceSummary.discovered;
      summary.stored += sourceSummary.stored;
      summary.pushed += sourceSummary.pushed;
      summary.skipped += sourceSummary.skipped;
      summary.initialized ||= sourceSummary.initialized;
    } catch (error) {
      summary.failedSources.push(source.id);
      logger.error({ source: source.id, err: error }, 'Offer source discovery failed');
    }
  }

  if (summary.failedSources.length === OFFER_SOURCES.length) {
    throw new Error(`All offer sources failed: ${summary.failedSources.join(', ')}`);
  }

  return summary;
}
