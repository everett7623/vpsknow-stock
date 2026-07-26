import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';

export interface LetDiscussion {
  discussionId: string;
  title: string;
  author: string;
  postedAt: Date;
  url: string;
}

export interface ParsedLetOffer {
  provider: string | null;
  title: string;
  body: string;
  category: ProductCategory | null;
  locations: string[];
  priceCents: number | null;
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

function discussionIdFromUrl(url: string): string | null {
  return url.match(/\/discussion\/(\d+)/i)?.[1] ?? null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseBillingCycle(value: string): BillingCycle | null {
  const normalized = value.toLowerCase();
  if (/\b(month|monthly|mo)\b/.test(normalized)) return 'monthly';
  if (/\b(quarter|quarterly)\b/.test(normalized)) return 'quarterly';
  if (/\b(semi-annually|semiannually)\b/.test(normalized)) return 'semi-annually';
  if (/\b(biennially|biennial)\b/.test(normalized)) return 'biennially';
  if (/\b(triennially|triennial)\b/.test(normalized)) return 'triennially';
  if (/\b(year|yearly|annual|annually|yr)\b/.test(normalized)) return 'annually';
  return null;
}

function parseCategory(value: string): ProductCategory | null {
  if (/\bnat\s*vps\b/i.test(value)) return 'nat_vps';
  if (/\bstorage\b/i.test(value)) return 'storage';
  if (/\bdedicated\b/i.test(value)) return 'dedicated';
  if (/\b(vds|vps|kvm)\b/i.test(value)) return 'vps';
  return null;
}

export function parseLetRss(xml: string): LetDiscussion[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const discussions: LetDiscussion[] = [];

  $('item').each((_, item) => {
    const title = normalizeText($(item).find('title').first().text());
    const url = normalizeText($(item).find('link').first().text() || $(item).find('guid').first().text());
    const author = normalizeText($(item).find('creator, author').first().text());
    const postedAt = new Date(normalizeText($(item).find('pubDate, date').first().text()));
    const discussionId = discussionIdFromUrl(url);

    if (!discussionId || !title || !url || Number.isNaN(postedAt.getTime())) return;

    discussions.push({ discussionId, title, author, postedAt, url });
  });

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
  const body = normalizeText($('article, .Message, .message, .Item-Body').first().text() || $.text());
  const combined = `${title} ${body}`;
  const priceMatch = combined.match(/(?:US\s*)?\$(\d+(?:\.\d{1,2})?)(?:\s*\/\s*([\w-]+))?/i);
  const orderUrl = $('a[href]').filter((_, link) => /order|cart|billing|store/i.test($(link).attr('href') || '')).first().attr('href') ?? null;
  const locations = [...combined.matchAll(/\b(Los Angeles|New York|Dallas|Miami|Chicago|Seattle|Amsterdam|Frankfurt|London|Tokyo|Singapore|Hong Kong)\b/gi)].map((match) => match[1]!);
  const couponMatch = combined.match(/(?:coupon(?:\s+code)?|promo(?:tion)?\s*code)\s*[:=-]?\s*([A-Z0-9-]{3,})/i);
  const billingCycle = parseBillingCycle(priceMatch?.[2] || combined);
  const category = parseCategory(combined);
  const priceCents = priceMatch ? Math.round(Number.parseFloat(priceMatch[1]!) * 100) : null;
  const provider = author || null;
  const confidence = [provider, category, priceCents, billingCycle, orderUrl].filter(Boolean).length / 5;
  const ipv4 = /\b(?:no\s+ipv4|without\s+ipv4|ipv6[\s-]+only)\b/i.test(combined)
    ? false
    : /\b(?:dedicated\s+ipv4|ipv4\s*(?:included|available|[:=-]\s*(?:yes|[1-9]))|[1-9]\s*(?:x\s*)?ipv4)\b/i.test(combined)
      ? true
      : null;

  return {
    provider,
    title,
    body,
    category,
    locations: [...new Set(locations)],
    priceCents,
    currency: priceCents === null ? null : 'USD',
    billingCycle,
    couponCode: couponMatch?.[1] ?? null,
    orderUrl,
    ipv4,
    isLimitedStock: /\b(limited|flash|restock|stock)\b/i.test(combined),
    isRecurring: /\b(recurring|renewal)\b/i.test(combined),
    isPreorder: /\b(pre[ -]?order)\b/i.test(combined),
    confidence,
  };
}
