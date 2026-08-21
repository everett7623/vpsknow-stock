import * as cheerio from 'cheerio';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

type FetchHtml = (provider: string, url: string) => Promise<string>;
type QuoteFetcher = (url: string, body: URLSearchParams) => Promise<string>;

const PORTAL = 'https://yunyoo.cc';
const WATCHED_PID = '82';
const WATCHED_PID_URL = `${PORTAL}/cart?action=configureproduct&pid=${WATCHED_PID}&aff=HYWEANDG`;
const ORDER_SUMMARY_URL = `${PORTAL}/cart?action=ordersummary`;
const CATEGORIES: readonly Category[] = [
  { slug: 'hong-kong-kowloon', location: 'Hong Kong', url: `${PORTAL}/cart?fid=5&gid=16` },
  { slug: 'hong-kong-tsuen-wan', location: 'Hong Kong', url: `${PORTAL}/cart?fid=1&gid=27` },
  { slug: 'hong-kong-tseung-kwan-o', location: 'Hong Kong', url: `${PORTAL}/cart?fid=5&gid=31` },
  { slug: 'tokyo-iij', location: 'Tokyo', url: `${PORTAL}/cart?fid=5&gid=21` },
  { slug: 'tokyo-lite', location: 'Tokyo', url: `${PORTAL}/cart?fid=5&gid=23` },
  { slug: 'los-angeles-c-std', location: 'Los Angeles', url: `${PORTAL}/cart?fid=1&gid=13` },
  { slug: 'los-angeles-c-pre', location: 'Los Angeles', url: `${PORTAL}/cart?fid=1&gid=28` },
  { slug: 'los-angeles-isp', location: 'Los Angeles', url: `${PORTAL}/cart?fid=5&gid=24` },
  { slug: 'kansas-city', location: 'Kansas City', url: `${PORTAL}/cart?fid=5&gid=30` },
  { slug: 'los-angeles-international', location: 'Los Angeles', url: `${PORTAL}/cart?fid=5&gid=32` },
  { slug: 'newcastle', location: 'Newcastle, United Kingdom', url: `${PORTAL}/cart?fid=5&gid=18` },
] as const;

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|M|GB|G)\b/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase().startsWith('G') ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const range = text.match(/(\d+(?:\.\d+)?)\s*-\s*\d+(?:\.\d+)?\s*(TB|T|GB|G)\b/i);
  if (range) {
    const value = Number.parseFloat(range[1]!);
    return Math.round(range[2]!.toUpperCase().startsWith('T') ? value * 1024 : value);
  }
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\b/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase().startsWith('T') ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\s*(?:双向|流量|Traffic|Transfer)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase().startsWith('G') ? value / 1024 : value;
}

function storageType(text: string): string {
  if (/NVMe/i.test(text)) return 'NVMe';
  if (/HDD/i.test(text)) return 'HDD';
  if (/SSD/i.test(text)) return 'SSD';
  return 'Unknown';
}

function selectedFieldText(
  $: cheerio.CheerioAPI,
  label: RegExp,
): string {
  const field = $('#addCartForm').find('.yy-config-field').filter((_, element) =>
    label.test(normalize($(element).find('.form-label').first().text())),
  ).first();
  return normalize(field.text());
}

function selectedFormFields($: cheerio.CheerioAPI): URLSearchParams {
  const fields = new URLSearchParams();
  $('#addCartForm').find('input[name], select[name], textarea[name]').each((_, element) => {
    const field = $(element);
    const name = field.attr('name');
    if (!name || field.attr('disabled') !== undefined) return;

    const tagName = element.tagName.toLowerCase();
    const type = field.attr('type')?.toLowerCase();
    if (tagName === 'input' && (type === 'radio' || type === 'checkbox') && !field.is(':checked')) {
      return;
    }

    if (tagName === 'select') {
      const selected = field.find('option:selected').first();
      const firstOption = field.find('option').first();
      const value = selected.attr('value') ?? firstOption.attr('value');
      if (value !== undefined) fields.append(name, value);
      return;
    }

    fields.append(name, field.attr('value') ?? '');
  });
  return fields;
}

async function fetchOrderSummary(url: string, body: URLSearchParams): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'VPSKnow-Stock/1.0',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const html = await response.text();
  if (!response.ok) throw new Error(`order summary HTTP ${response.status}`);
  return html;
}

export class YunyooAdapter implements ProviderAdapter {
  readonly slug = 'yunyoo';
  readonly name = 'YUNYOO';
  warnings: readonly string[] = [];

  constructor(
    private readonly fetchHtml: FetchHtml = fetchProviderHtml,
    private readonly quoteFetcher: QuoteFetcher = fetchOrderSummary,
  ) {}

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const failures: string[] = [];
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await this.fetchHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        results.push(...parsed);
      } catch (error) {
        failures.push(`${category.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (results.length === 0) {
      throw new Error(
        `YUNYOO returned no parseable public VPS products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    try {
      const watched = await this.checkWatchedPid();
      if (watched) results.push(watched);
    } catch (error) {
      failures.push(`pid-${WATCHED_PID}: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('article.yy-cart-product').each((_, element) => {
      const card = $(element);
      const planName = normalize(card.find('.yy-cart-product-name').first().text());
      const specs = normalize(card.find('.yy-cart-product-specs').first().text());
      const stock = normalize(card.find('.yy-cart-stock').first().text());
      const buyLink = card.find('a.yy-cart-buy').first();
      const href = buyLink.attr('href')?.trim() ?? '';
      if (!planName || !specs || !stock) return;

      const cpu = Math.round(numberFrom(specs, /CPU\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(?:核心|核|vCPU)/i));
      const ram = capacityInMb(
        normalize(card.find('.yy-cart-product-specs li').filter((_, item) => /内存/.test($(item).text())).first().text()),
      );
      const storage = normalize(
        card.find('.yy-cart-product-specs li').filter((_, item) => /系统盘/.test($(item).text())).first().text(),
      );
      const bandwidth = normalize(
        card.find('.yy-cart-product-specs li').filter((_, item) => /带宽/.test($(item).text())).first().text(),
      );
      const priceText = normalize(card.find('.yy-cart-price-current').first().text());
      const pid = href.match(/[?&]pid=(\d+)/)?.[1] ?? null;
      const inStock = /^(?:充足|较少)$/.test(stock) && href.length > 0;

      results.push({
        provider: this.slug,
        productId: `yunyoo-${category.slug}-${slugify(planName)}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cpu > 0 ? `${cpu} vCPU${cpu === 1 ? '' : 's'}` : 'Unknown',
        ramMb: ram,
        storageGb: capacityInGb(storage),
        storageType: storageType(storage),
        bandwidthTb: bandwidthInTb(bandwidth),
        ipv4: /IPv4/i.test(specs),
        ipv6: /IPv6/i.test(specs),
        price: Math.round(numberFrom(priceText, /[¥￥]\s*(\d+(?:\.\d+)?)/) * 100),
        currency: 'CNY',
        billingCycle: 'monthly',
        inStock,
        orderUrl: href ? new URL(href, PORTAL).href : category.url,
        displaySpecs: {
          storage: storage || undefined,
          bandwidth: bandwidth || undefined,
        },
        raw: {
          availability: stock,
          category: category.slug,
          ...(pid ? { pid } : {}),
        },
      });
    });

    return results;
  }

  private async checkWatchedPid(): Promise<StockResult | null> {
    const html = await this.fetchHtml(this.name, WATCHED_PID_URL);
    const $ = cheerio.load(html);
    const form = $('#addCartForm').first();
    if (!form.length) throw new Error('PID 82 configuration form is missing');

    const quote = await this.quoteFetcher(ORDER_SUMMARY_URL, selectedFormFields($));
    const quoteDocument = cheerio.load(quote);
    const quoteSource = quoteDocument('[data-order-summary-source]').first();
    if (!quoteSource.length) throw new Error('PID 82 order summary source is missing');

    const subtitle = normalize($('.page-subtitle').first().text());
    const planName = subtitle.match(/当前产品：\s*(.+?)\s*[·]/)?.[1] ?? 'YUNYOO PID 82';
    const cpuField = selectedFieldText($, /CPU/);
    const memoryField = selectedFieldText($, /内存/);
    const storageField = selectedFieldText($, /系统盘/);
    const bandwidthField = selectedFieldText($, /带宽/);
    const ipv4Field = selectedFieldText($, /IPv4/);
    const monthlyPrice = Number.parseFloat(quoteSource.attr('data-yy-recurring-price') ?? '');
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      throw new Error('PID 82 order summary price is invalid');
    }

    const cpu = Math.round(numberFrom(cpuField, /(\d+(?:\.\d+)?)\s*(?:核心|核|vCPU)/i));
    const outOfStock = quoteSource.find('.yy-stock-sentinel').length > 0;
    return {
      provider: this.slug,
      productId: `yunyoo-${WATCHED_PID}`,
      planName,
      location: 'United States',
      category: 'vps',
      cpu: cpu > 0 ? `${cpu} vCPU${cpu === 1 ? '' : 's'}` : 'Unknown',
      ramMb: capacityInMb(memoryField),
      storageGb: capacityInGb(storageField),
      storageType: storageType(storageField),
      bandwidthTb: 0,
      ipv4: /(?:\d+\s*个\s*IPv4|IPv4[^0-9]*\d+\s*个)/i.test(ipv4Field),
      ipv6: false,
      price: Math.round(monthlyPrice * 100),
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: !outOfStock,
      orderUrl: WATCHED_PID_URL,
      displaySpecs: {
        storage: storageField || undefined,
        bandwidth: bandwidthField || undefined,
      },
      raw: { pid: WATCHED_PID, quoteValidated: true },
    };
  }
}
