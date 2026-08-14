import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import { assertRssParseResult, loadRssDocument } from './rss.js';

export interface LetDiscussion {
  discussionId: string;
  title: string;
  author: string;
  postedAt: Date;
  url: string;
  contentHtml?: string;
}

export interface ParsedLetOffer {
  provider: string | null;
  title: string;
  body: string;
  category: ProductCategory | null;
  locations: string[];
  priceCents: number | null;
  priceAmount: number | null;
  priceText: string | null;
  currency: string | null;
  billingCycle: BillingCycle | null;
  couponCode: string | null;
  orderUrl: string | null;
  ipv4: boolean | null;
  isLimitedStock: boolean;
  isRecurring: boolean;
  isPreorder: boolean;
  confidence: number;
}

interface ParsedPrice {
  priceCents: number;
  priceAmount: number;
  priceText: string;
  currency: string;
  billingCycle: BillingCycle | null;
}

const PRICE_PATTERN =
  /(?:(US\s*\$|USD|\$|EUR|€|GBP|£)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(US\s*\$|USD|\$|EUR|€|GBP|£))(?![A-Za-z0-9])(?:\s*(?:\/|per\s+)?\s*(hourly|hour|hr|monthly|month|mo|quarterly|quarter|semi-annually|semiannually|annually|annual|yearly|year|yr|biennially|biennial|triennially|triennial))?/gi;

const LOCATION_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['Los Angeles', /\b(?:Los Angeles|LAX)\b/i],
  ['New York', /\b(?:New York(?: City)?|NYC)\b/i],
  ['Dallas', /\bDallas\b/i],
  ['Miami', /\bMiami\b/i],
  ['Chicago', /\bChicago\b/i],
  ['Seattle', /\bSeattle\b/i],
  ['San Jose', /\bSan Jose\b/i],
  ['Ashburn', /\bAshburn\b/i],
  ['Salt Lake City', /\bSalt Lake City\b/i],
  ['Toronto', /\bToronto\b/i],
  ['Amsterdam', /\bAmsterdam\b/i],
  ['Frankfurt', /\bFrankfurt\b/i],
  ['London', /\bLondon\b/i],
  ['Paris', /\bParis\b/i],
  ['Strasbourg', /\bStrasbourg\b/i],
  ['Tokyo', /\bTokyo\b/i],
  ['Singapore', /\bSingapore\b/i],
  ['Hong Kong', /\bHong Kong\b/i],
  ['Hanoi', /\bHanoi\b/i],
  ['Ho Chi Minh City', /\bHo Chi Minh(?: City)?\b/i],
];

function discussionIdFromUrl(url: string): string | null {
  return url.match(/\/discussion\/(\d+)/i)?.[1] ?? null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseBillingCycle(value: string): BillingCycle | null {
  const normalized = value.toLowerCase();
  if (/\b(hour|hourly|hr)\b/.test(normalized)) return 'hourly';
  if (/\b(month|monthly|mo)\b/.test(normalized)) return 'monthly';
  if (/\b(quarter|quarterly)\b/.test(normalized)) return 'quarterly';
  if (/\b(semi-annually|semiannually)\b/.test(normalized)) return 'semi-annually';
  if (/\b(biennially|biennial)\b/.test(normalized)) return 'biennially';
  if (/\b(triennially|triennial)\b/.test(normalized)) return 'triennially';
  if (/\b(year|yearly|annual|annually|yr)\b/.test(normalized)) return 'annually';
  return null;
}

function parseCategory(value: string): ProductCategory | null {
  const candidates: Array<{ category: ProductCategory; index: number; priority: number }> = [
    { category: 'nat_vps', index: value.search(/\bnat\s*vps\b/i), priority: 0 },
    { category: 'vps', index: value.search(/\b(vds|vps|kvm)\b/i), priority: 1 },
    { category: 'dedicated', index: value.search(/\bdedicated\b/i), priority: 2 },
    { category: 'storage', index: value.search(/\bstorage\b/i), priority: 3 },
  ];

  return (
    candidates
      .filter((candidate) => candidate.index >= 0)
      .sort((left, right) => left.index - right.index || left.priority - right.priority)[0]
      ?.category ?? null
  );
}

function currencyFromToken(token: string): string {
  const normalized = token.replace(/\s+/g, '').toUpperCase();
  if (normalized === 'EUR' || token === '€') return 'EUR';
  if (normalized === 'GBP' || token === '£') return 'GBP';
  return 'USD';
}

function formatPriceText(currency: string, amount: string): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
  return `${symbols[currency] || `${currency} `}${amount.replace(',', '.')}`;
}

function parsePrice(value: string): ParsedPrice | null {
  PRICE_PATTERN.lastIndex = 0;

  for (const match of value.matchAll(PRICE_PATTERN)) {
    const index = match.index;
    const amount = match[2] || match[3];
    const currencyToken = match[1] || match[4];
    if (index === undefined || !amount || !currencyToken) continue;

    const before = value.slice(Math.max(0, index - 48), index);
    const after = value.slice(index + match[0].length, index + match[0].length + 48);
    if (/\b(credits?|prizes?|refund|money[ -]?back)\b/i.test(after)) continue;
    if (/\b(giveaway|prize)\s*[:=-]?\s*$/i.test(before)) continue;
    if (/\b(regular\s+price|was)\s*[:=-]?\s*$/i.test(before)) continue;
    if (/^\s*(?:->|→)/.test(after)) continue;
    if (/\b(optional|additional)\b/i.test(before) && /\bfee\b/i.test(after)) continue;

    const numericPrice = Number.parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(numericPrice)) continue;

    const currency = currencyFromToken(currencyToken);
    return {
      priceCents: Math.round(numericPrice * 100),
      priceAmount: numericPrice,
      priceText: formatPriceText(currency, amount),
      currency,
      billingCycle: match[5]
        ? parseBillingCycle(match[5])
        : parseBillingCycle(after) ?? parseBillingCycle(before),
    };
  }

  return null;
}

function parseLocations(value: string): string[] {
  return LOCATION_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(
    ([location]) => location,
  );
}

function normalizeExternalUrl(href: string | null): string | null {
  if (!href) return null;

  try {
    const url = new URL(href, 'https://lowendtalk.com');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseLetRss(xml: string): LetDiscussion[] {
  const $ = loadRssDocument(xml, 'LowEndTalk');
  const discussions: LetDiscussion[] = [];
  const itemCount = $('item').length;

  $('item').each((_, item) => {
    const title = normalizeText($(item).find('title').first().text());
    const url = normalizeText(
      $(item).find('link').first().text() || $(item).find('guid').first().text(),
    );
    const author = normalizeText($(item).find('dc\\:creator, creator, author').first().text());
    const postedAt = new Date(normalizeText($(item).find('pubDate, date').first().text()));
    const discussionId = discussionIdFromUrl(url);
    const contentHtml = $(item).find('description').first().text().trim();

    if (!discussionId || !title || !url || Number.isNaN(postedAt.getTime())) return;

    discussions.push({
      discussionId,
      title,
      author,
      postedAt,
      url,
      ...(contentHtml ? { contentHtml } : {}),
    });
  });

  assertRssParseResult('LowEndTalk', itemCount, discussions.length);
  return discussions;
}

export function parseLetListing(html: string, discoveredAt: Date): LetDiscussion[] {
  const $ = cheerio.load(html);
  const discussions = new Map<string, LetDiscussion>();

  $('a[href*="/discussion/"]').each((_, link) => {
    const href = $(link).attr('href');
    const title = normalizeText($(link).text());
    if (!href || !title) return;

    const url = new URL(href, 'https://lowendtalk.com').href;
    const discussionId = discussionIdFromUrl(url);
    if (!discussionId || discussions.has(discussionId)) return;

    discussions.set(discussionId, {
      discussionId,
      title,
      author: '',
      postedAt: discoveredAt,
      url,
    });
  });

  return [...discussions.values()];
}

export function parseLetOffer(title: string, html: string, author: string): ParsedLetOffer {
  const $ = cheerio.load(html);
  const firstPost = $('article, .Message, .message, .Item-Body').first();
  const contentRoot = firstPost.length > 0 ? firstPost : $('body');
  const body = normalizeText(contentRoot.text() || $.text());
  const combined = `${title} ${body}`;
  const parsedPrice = parsePrice(title) ?? parsePrice(body);
  const orderHref =
    contentRoot
      .find('a[href]')
      .filter((_, link) => {
        const linkText = normalizeText($(link).text());
        const href = $(link).attr('href') || '';
        return /\b(order|cart|checkout|buy now)\b/i.test(`${linkText} ${href}`);
      })
      .first()
      .attr('href') ?? null;
  const orderUrl = normalizeExternalUrl(orderHref);
  const locations = parseLocations(combined);
  const couponMatch = combined.match(
    /(?:coupon(?:\s+code)?|promo(?:tion)?\s*code)\s*[:=-]?\s*([A-Z0-9-]{3,})/i,
  );
  const category = parseCategory(combined);
  const detectedAuthor = normalizeText(
    contentRoot.closest('.Item, article, li').find('.Username').first().text(),
  );
  const provider = normalizeText(author) || detectedAuthor || null;
  const confidence =
    [provider, category, parsedPrice?.priceCents, parsedPrice?.billingCycle, orderUrl].filter(
      (value) => value !== null && value !== undefined,
    ).length / 5;
  const ipv4 = /\b(?:no\s+ipv4|without\s+ipv4|ipv6[\s-]+only)\b/i.test(combined)
    ? false
    : /\b(?:dedicated\s+ipv4|ipv4\s*(?:included|available|[:=-]\s*(?:yes|[1-9]))|[1-9]\s*(?:x\s*)?ipv4)\b/i.test(
          combined,
        )
      ? true
      : null;

  return {
    provider,
    title,
    body,
    category,
    locations,
    priceCents: parsedPrice?.priceCents ?? null,
    priceAmount: parsedPrice?.priceAmount ?? null,
    priceText: parsedPrice?.priceText ?? null,
    currency: parsedPrice?.currency ?? null,
    billingCycle: parsedPrice?.billingCycle ?? null,
    couponCode: couponMatch?.[1] ?? null,
    orderUrl,
    ipv4,
    isLimitedStock: /\b(limited|flash|restock|stock)\b/i.test(combined),
    isRecurring: /\b(recurring|renewal)\b/i.test(combined),
    isPreorder: /\b(pre[ -]?order)\b/i.test(combined),
    confidence,
  };
}
