import { prisma } from '@vpsknow/database';
import { parseLetListing, parseLetOffer, parseLetRss } from '@vpsknow/parsers';
import { formatOfferMessage, sendChannelMessage } from '@vpsknow/telegram';
import pino from 'pino';
import { notifyOfferSubscribers } from './subscriber-notifications.js';

const RSS_URL = 'https://lowendtalk.com/categories/offers/feeds.rss';
const LISTING_URL = 'https://lowendtalk.com/categories/offers';
const FIRST_RUN_KEY = 'let:first-run-at';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

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

function isEligible(
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

function originalOfferUrl(offer: PushableOffer): string {
  if (!offer.threadUrl) {
    throw new Error(`Offer ${offer.id} is missing its original LowEndTalk URL`);
  }

  let url: URL;
  try {
    url = new URL(offer.threadUrl);
  } catch {
    throw new Error(`Offer ${offer.id} has an invalid LowEndTalk URL`);
  }
  if (
    !['lowendtalk.com', 'www.lowendtalk.com'].includes(url.hostname) ||
    !/^\/discussion\/\d+(?:\/|$)/.test(url.pathname)
  ) {
    throw new Error(`Offer ${offer.id} has an invalid LowEndTalk URL`);
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
    provider: offer.provider || 'LowEndTalk',
    title: offer.title,
    locations: offer.locations.join(', ') || 'Not specified',
    price: priceSummary(offer),
    category: categorySummary(offer.category),
    billing: billingSummary(offer.billingCycle),
    postedAt: offer.postedAt?.toISOString().slice(0, 10) || 'Unknown',
    couponCode: offer.couponCode,
    originalUrl,
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

export async function discoverLetOffers(
  connection: RedisConnection,
  fetcher: Fetcher = fetch,
  dependencies: OfferDiscoveryDependencies = defaultDependencies(),
): Promise<OfferDiscoverySummary> {
  const now = new Date();
  const firstRun = await connection.get(FIRST_RUN_KEY);
  if (!firstRun) {
    await connection.set(FIRST_RUN_KEY, now.toISOString(), 'NX');
    return { discovered: 0, stored: 0, pushed: 0, skipped: 0, initialized: true };
  }

  const baseline = new Date(firstRun);
  const requestInit = {
    headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
    signal: AbortSignal.timeout(15_000),
  };
  const rssResponse = await fetcher(RSS_URL, requestInit);
  const discussions = rssResponse.ok
    ? parseLetRss(await rssResponse.text())
    : await (async () => {
        const listingResponse = await fetcher(LISTING_URL, requestInit);
        if (!listingResponse.ok) {
          throw new Error(
            `LowEndTalk RSS HTTP ${rssResponse.status}; listing HTTP ${listingResponse.status}`,
          );
        }
        return parseLetListing(await listingResponse.text(), now);
      })();

  const recentDiscussions = discussions.filter((item) => item.postedAt >= baseline);
  const summary: OfferDiscoverySummary = {
    discovered: recentDiscussions.length,
    stored: 0,
    pushed: 0,
    skipped: 0,
    initialized: false,
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

    const detailResponse = await fetcher(discussion.url, {
      headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!detailResponse.ok) {
      throw new Error(`LowEndTalk discussion HTTP ${detailResponse.status}`);
    }

    const offer = parseLetOffer(discussion.title, await detailResponse.text(), discussion.author);
    if (!isEligible(discussion.title, offer.provider, offer.category, offer.priceCents)) {
      summary.skipped++;
      continue;
    }

    const storedOffer = await prisma.offer.create({
      data: {
        source: 'lowendtalk',
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
