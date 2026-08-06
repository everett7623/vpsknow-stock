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
  set(key: string, value: string, mode: 'NX'): Promise<string | null>;
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
  baselineKey: string;
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
  baselineKey: 'let:first-run-at',
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
  baselineKey: 'offers:lowendbox:first-run-at',
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
  baselineKey: 'offers:lowendspirit:first-run-at',
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

const TRUSTED_PROVIDERS = new Set(['bandwagonhost', 'buyvm', 'dmit', 'greencloudvps']);
const OFFER_TITLE_PATTERN =
  /\b(limited|flash|restock|stock|sale|special|deals?|offers?|promo(?:tion)?|discount|off)\b/i;
const EXCLUDED_OFFER_PATTERN =
  /\b(shared hosting|domain|email|ssl|service transfer|wtb|free proxy|vpn)\b/i;

function defaultDependencies(): OfferDiscoveryDependencies {
  return {
    offersChannelId: process.env.TELEGRAM_OFFERS_CHANNEL_ID || null,
    sendMessage: sendChannelMessage,
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

function isEligible(
  source: DiscoveredOfferSource,
  title: string,
  provider: string | null,
  category: string | null,
  priceCents: number | null,
): boolean {
  if (
    !category ||
    !['vps', 'vds', 'nat_vps', 'dedicated', 'storage'].includes(category) ||
    priceCents === null
  ) {
    return false;
  }

  if (EXCLUDED_OFFER_PATTERN.test(title)) return false;
  if (source !== 'lowendtalk') return true;

  return TRUSTED_PROVIDERS.has(provider?.toLowerCase() || '') || OFFER_TITLE_PATTERN.test(title);
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
  // Validate the discovery thread URL for integrity, but never surface forum/source hosts in Telegram.
  originalOfferUrl(offer);

  const message = formatOfferMessage({
    provider: offer.provider?.trim() || 'Unknown',
    title: offer.title,
    locations: offer.locations.join(', ') || 'Not specified',
    price: priceSummary(offer),
    category: categorySummary(offer.category),
    billing: billingSummary(offer.billingCycle),
    postedAt: offer.postedAt?.toISOString().slice(0, 10) || 'Unknown',
    couponCode: offer.couponCode,
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
): Promise<LetDiscussion[]> {
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
    return source.listingFallback.parse(await listingResponse.text(), discoveredAt);
  }

  if (successfulFeeds === 0) {
    throw new Error(`${source.label} feeds unavailable: ${failures.join('; ')}`);
  }

  if (failures.length > 0) {
    logger.warn({ source: source.id, failures }, 'Offer source completed with partial feed failures');
  }

  return [...discussions.values()];
}

async function discoverSourceOffers(
  source: OfferSourceConfig,
  connection: RedisConnection,
  fetcher: Fetcher,
  dependencies: OfferDiscoveryDependencies,
): Promise<OfferDiscoverySummary> {
  const now = new Date();
  const firstRun = await connection.get(source.baselineKey);
  if (!firstRun) {
    await connection.set(source.baselineKey, now.toISOString(), 'NX');
    return emptySummary(true);
  }

  const baseline = new Date(firstRun);
  if (Number.isNaN(baseline.getTime())) {
    throw new Error(`${source.label} first-run baseline is invalid`);
  }

  const discussions = await readSourceDiscussions(source, fetcher, now);
  const recentDiscussions = discussions.filter((item) => item.postedAt >= baseline);
  const summary: OfferDiscoverySummary = {
    ...emptySummary(false),
    discovered: recentDiscussions.length,
  };

  for (const discussion of recentDiscussions) {
    const existing = await prisma.offer.findUnique({
      where: { sourceId: discussion.discussionId },
    });
    if (existing) {
      if (await pushOffer(existing, dependencies)) summary.pushed++;
      else summary.skipped++;
      continue;
    }

    const detailResponse = await fetcher(discussion.url, requestInit());
    if (!detailResponse.ok) {
      throw new Error(`${source.label} offer detail HTTP ${detailResponse.status}`);
    }

    const offer = source.parseDetail(
      discussion.title,
      await detailResponse.text(),
      discussion.author,
    );
    if (
      !isEligible(source.id, discussion.title, offer.provider, offer.category, offer.priceCents)
    ) {
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
