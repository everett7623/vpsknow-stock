import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

type FetchHtml = (provider: string, url: string) => Promise<string>;

const PORTAL = 'https://www.666clouds.com';
const CATEGORIES: readonly Category[] = [
  { slug: 'philippines', location: 'Philippines', url: `${PORTAL}/cart.php?gid=26` },
  { slug: 'south-korea', location: 'Seoul', url: `${PORTAL}/cart.php?gid=16` },
  { slug: 'hong-kong', location: 'Hong Kong', url: `${PORTAL}/cart.php?gid=6` },
  { slug: 'germany', location: 'Germany', url: `${PORTAL}/cart.php?gid=25` },
  { slug: 'united-kingdom', location: 'United Kingdom', url: `${PORTAL}/cart.php?gid=22` },
  { slug: 'united-states', location: 'United States', url: `${PORTAL}/cart.php?gid=21` },
  { slug: 'japan', location: 'Japan', url: `${PORTAL}/cart.php?gid=19` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.replace(/,/g, '').match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(
    /(?:内存\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(MB|M|GB|G)|(?:^|\s)(\d+(?:\.\d+)?)\s*(MB|M|GB|G)\s*内存)/i,
  );
  if (!match) return 0;
  const amount = Number.parseFloat(match[1] ?? match[3] ?? '0');
  const unit = (match[2] ?? match[4] ?? '').toUpperCase();
  return Math.round(unit === 'GB' || unit === 'G' ? amount * 1024 : amount);
}

function capacityInGb(text: string, patterns: readonly RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number.parseFloat(match[1]!);
    const unit = match[2]!.toUpperCase();
    return Math.round(unit === 'TB' || unit === 'T' ? value * 1024 : value);
  }
  return 0;
}

function storageInGb(text: string): number {
  return capacityInGb(text, [
    /(?:系统盘|硬盘)\s*[：:]?\s*(\d+(?:\.\d+)?)\s*(TB|T|GB|G)/i,
    /(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\s*(?:NVMe|SSD|HDD)/i,
  ]);
}

function bandwidthInTb(text: string): number {
  const match = text.match(
    /(?:流量\s*[：:]?\s*|双向\s*)(\d+(?:\.\d+)?)\s*(TB|T|GB|G)(?:流量)?/i,
  );
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase().startsWith('G') ? amount / 1024 : amount;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/每年|年付|annually|yearly/i.test(text)) return 'annually';
  if (/每季|季付|quarterly/i.test(text)) return 'quarterly';
  if (/半年|semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/两年|biennially/i.test(text)) return 'biennially';
  if (/三年|triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function storageType(text: string): string {
  if (/NVMe/i.test(text)) return 'NVMe';
  if (/HDD/i.test(text)) return 'HDD';
  if (/SSD/i.test(text)) return 'SSD';
  return 'Unknown';
}

function portLabel(text: string): string | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(Gbps|Gbits|Mbps|Mbits)\b/i);
  return match ? `${match[1]}${match[2]}` : undefined;
}

function trafficLabel(text: string): string | undefined {
  const match = text.match(/(?:双向\s*)?\d+(?:\.\d+)?\s*(?:TB|T|GB|G)\s*流量/i);
  return match?.[0]?.replace(/\s+/g, '') ?? undefined;
}

function cpuCores(text: string): number {
  const match = text.match(/(?:CPU\s*[：:]?\s*)?(\d+(?:\.\d+)?)\s*(?:vCPU|核心|核)/i);
  return match ? Math.round(Number.parseFloat(match[1]!)) : 0;
}

export class SixSixCloudsAdapter implements ProviderAdapter {
  readonly slug = '666clouds';
  readonly name = '666Clouds';
  warnings: readonly string[] = [];

  constructor(private readonly fetchHtml: FetchHtml = fetchProviderHtml) {}

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const failures: string[] = [];
    const seen = new Set<string>();
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await this.fetchHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        for (const result of parsed) {
          if (seen.has(result.productId)) continue;
          seen.add(result.productId);
          results.push(result);
        }
      } catch (error) {
        failures.push(
          `${category.slug}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (results.length === 0) {
      throw new Error(
        `666Clouds returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product[id^="product"]').each((_, element) => {
      const card = $(element);
      const planName = card.find('[id$="-name"]').first().text().replace(/\s+/g, ' ').trim();
      const description = card
        .find('.product-desc, [id$="-description"]')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      const cardText = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now, [id$="-order-button"]').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const pid = orderHref.match(/[?&]pid=(\d+)/)?.[1]
        ?? card.attr('data-pid')?.match(/^\d+$/)?.[0];
      if (!pid || !planName || !description) return;

      const quantityMatch = cardText.match(/(-?\d+)\s*(?:可用|Available)/i);
      const quantity = quantityMatch ? Number.parseInt(quantityMatch[1]!, 10) : null;
      const unavailable = /out\s*of\s*stock|sold\s*out|缺货|售罄/i.test(cardText)
        || orderButton.hasClass('disabled')
        || (quantity !== null && quantity <= 0);
      const pricing = card.find('.product-pricing').first().text().replace(/\s+/g, ' ').trim();
      const cores = cpuCores(description);
      const port = portLabel(description);
      const bandwidth = trafficLabel(description);

      results.push({
        provider: this.slug,
        productId: `666clouds-${pid}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: storageInGb(description),
        storageType: storageType(description),
        bandwidthTb: bandwidthInTb(description),
        ipv4: true,
        ipv6: /IPv6/i.test(description),
        price: Math.round(numberFrom(pricing, /[¥￥]\s*(\d+(?:\.\d+)?)/) * 100),
        currency: /\b(?:USD|CNY|EUR|GBP|CAD)\b/i.exec(pricing)?.[0]?.toUpperCase() ?? 'CNY',
        billingCycle: billingCycleFrom(pricing),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        displaySpecs: {
          bandwidth,
          port,
        },
        raw: {
          available: quantity,
          category: category.slug,
          pid,
        },
      });
    });

    return results;
  }
}
