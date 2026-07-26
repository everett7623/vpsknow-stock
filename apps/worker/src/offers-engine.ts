import { prisma } from '@vpsknow/database';
import { parseLetListing, parseLetOffer, parseLetRss } from '@vpsknow/parsers';
import { formatOfferMessage, sendChannelMessage } from '@vpsknow/telegram';

const RSS_URL = 'https://lowendtalk.com/categories/offers/feeds.rss';
const LISTING_URL = 'https://lowendtalk.com/categories/offers';
const FIRST_RUN_KEY = 'let:first-run-at';

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
const OFFER_TITLE_PATTERN = /\b(limited|flash|restock|stock|let special)\b/i;
const EXCLUDED_OFFER_PATTERN = /\b(shared hosting|domain|email|ssl|service transfer|wtb|free proxy|vpn)\b/i;

function defaultDependencies(): OfferDiscoveryDependencies {
  return {
    offersChannelId: process.env.TELEGRAM_OFFERS_CHANNEL_ID || null,
    sendMessage: sendChannelMessage,
  };
}

function isEligible(
  title: string,
  body: string,
  provider: string | null,
  category: string | null,
  priceCents: number | null,
): boolean {
  if (!category || !['vps', 'vds', 'nat_vps', 'dedicated'].includes(category) || priceCents === null) {
    return false;
  }

  const content = `${title} ${body}`;
  if (EXCLUDED_OFFER_PATTERN.test(content)) return false;

  return TRUSTED_PROVIDERS.has(provider?.toLowerCase() || '') || OFFER_TITLE_PATTERN.test(title);
}

function affiliateUrl(orderUrl: string | null): string {
  if (!orderUrl) return 'Not provided';
  const baseUrl = (process.env.AFFILIATE_BASE_URL || 'https://go.uukk.de').replace(/\/$/, '');
  return `${baseUrl}/?url=${encodeURIComponent(orderUrl)}`;
}

function specsSummary(offer: PushableOffer): string {
  const body = offer.body?.replace(/\s+/g, ' ').trim() || '';
  const excerpt = body.length > 140 ? `${body.slice(0, 137)}...` : body;
  const coupon = offer.couponCode ? `Coupon: ${offer.couponCode}` : '';
  return [excerpt, coupon].filter(Boolean).join(' | ') || 'See thread for full specifications';
}

function priceSummary(offer: PushableOffer): string {
  if (offer.priceCents === null) return 'Price unavailable';
  return `${offer.currency || 'USD'} ${(offer.priceCents / 100).toFixed(2)}`;
}

async function pushOffer(
  offer: PushableOffer,
  dependencies: OfferDiscoveryDependencies,
): Promise<boolean> {
  if (offer.pushed || !dependencies.offersChannelId) return false;

  const message = formatOfferMessage({
    provider: offer.provider || 'LowEndTalk',
    title: offer.title,
    specs: specsSummary(offer),
    locations: offer.locations.join(', ') || 'Unspecified',
    price: priceSummary(offer),
    category: offer.category || 'Unspecified',
    billing: offer.billingCycle || 'Unspecified',
    postedAt: offer.postedAt?.toISOString().slice(0, 10) || 'Unknown',
    orderUrl: affiliateUrl(offer.orderUrl),
    threadUrl: offer.threadUrl || 'Not provided',
  });
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

  return true;
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
    if (!isEligible(discussion.title, offer.body, offer.provider, offer.category, offer.priceCents)) {
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
        isLimitedStock: offer.isLimitedStock,
        isRecurring: offer.isRecurring,
        isPreorder: offer.isPreorder,
        confidence: offer.confidence,
        postedAt: discussion.postedAt,
      },
    });
    summary.stored++;

    if (await pushOffer(storedOffer, dependencies)) summary.pushed++;
  }

  return summary;
}
