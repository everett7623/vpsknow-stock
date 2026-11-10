import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://cloudsilk.io';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837',
    location: 'San Jose',
    url: `${PORTAL}/store/mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837`,
  },
  {
    slug: 'mei-guo-sheng-he-sai-jing-pin-da-lu-you-hua-bgp9929',
    location: 'San Jose',
    url: `${PORTAL}/store/mei-guo-sheng-he-sai-jing-pin-da-lu-you-hua-bgp9929`,
  },
  {
    slug: 'de-guo-fa-lan-ke-fu-da-lu-jing-pin-you-hua-bgp',
    location: 'Frankfurt',
    url: `${PORTAL}/store/de-guo-fa-lan-ke-fu-da-lu-jing-pin-you-hua-bgp`,
  },
] as const;

type FetchHtml = (provider: string, url: string) => Promise<string>;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB|G|M)\s*(?:内存|RAM|Memory)?/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(/G/i.test(match[2]!) ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\s*(?:SSD|NVMe|HDD|硬盘|Disk)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(/T/i.test(match[2]!) ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\s*(?:流量|Traffic|Transfer|Bandwidth)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return /G/i.test(match[2]!) ? value / 1024 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/季度|quarterly/i.test(text)) return 'quarterly';
  if (/半年|semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/每年|一年|annually|yearly/i.test(text)) return 'annually';
  if (/两年|biennially/i.test(text)) return 'biennially';
  if (/三年|triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/[\u4e00-\u9fff]/g, (char) => `u${char.codePointAt(0)!.toString(16)}`)
    .slice(0, 64);
}

function productKey(category: Category, orderHref: string, planName: string, numericId: string): string {
  const pathSlug = orderHref.split('/').filter(Boolean).at(-1);
  if (pathSlug) return `cloudsilk-${category.slug}-${pathSlug}`;
  const nameSlug = slugify(planName);
  if (nameSlug) return `cloudsilk-${category.slug}-${nameSlug}`;
  return `cloudsilk-${category.slug}-${numericId}`;
}

export class CloudSilkAdapter implements ProviderAdapter {
  readonly slug = 'cloudsilk';
  readonly name = 'CloudSilk';
  warnings: readonly string[] = [];

  constructor(private readonly fetchHtml: FetchHtml = fetchProviderHtml) {}

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await this.fetchHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulCategories++;

        for (const result of parsed) {
          if (seen.has(result.productId)) continue;
          seen.add(result.productId);
          results.push(result);
        }
      } catch (error) {
        failures.push(`${category.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (successfulCategories === 0 || results.length === 0) {
      throw new Error(
        `CloudSilk returned no parseable VPS products; ${failures.length}/${CATEGORIES.length} categories failed. `
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
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      // WHMCS nests <div> inside <p id="*-description">; cheerio repairs that and
      // can empty the paragraph, so prefer the whole product-desc / card text.
      const description = [
        card.find('.product-desc').first().text(),
        card.find('[id$="-description"]').first().text(),
        card.text(),
      ]
        .map((value) => value.replace(/\s+/g, ' ').trim())
        .find((value) => value.length > 0) ?? '';
      const pricing = card.find('.product-pricing').first().text().replace(/\s+/g, ' ').trim();
      const priceText = card.find('.product-pricing .price').first().text().replace(/\s+/g, ' ').trim() || pricing;
      const qtyText = card.find('.qty').first().text().replace(/\s+/g, ' ').trim();
      const quantity = qtyText.match(/(\d+)\s*可用/i) ?? qtyText.match(/(\d+)\s+Available/i);
      const orderButton = card.find('[id$="-order-button"], a.btn-success, a.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const unavailable =
        /售罄|缺货|out\s*of\s*stock|sold\s*out/i.test(description)
        || orderButton.hasClass('disabled')
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)\s*(?:核心|核|vCPU|CPU\s*Cores?|Cores?)/i));
      const storageType = /\bNVMe\b/i.test(description)
        ? 'NVMe'
        : /\bHDD\b/i.test(description)
          ? 'HDD'
          : /\bSSD\b/i.test(description)
            ? 'SSD'
            : 'Unknown';
      const port = description.match(/(\d+(?:\.\d+)?)\s*(Gbps|Mbps)/i);

      results.push({
        provider: this.slug,
        productId: productKey(category, orderHref, planName, numericId),
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType,
        bandwidthTb: bandwidthInTb(description),
        ipv4: /IPv4/i.test(description) || /独立IP|公网IP/i.test(description),
        ipv6: /IPv6/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /CNY|￥|¥/i.test(priceText) ? 'CNY' : /EUR/i.test(priceText) ? 'EUR' : 'USD',
        billingCycle: billingCycleFrom(pricing || description),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        displaySpecs: {
          bandwidth: (() => {
            const match = description.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G)\s*(?:流量|Traffic|Transfer)/i);
            return match ? `${match[1]}${/G/i.test(match[2]!) ? 'GB' : 'TB'}` : undefined;
          })(),
          port: port ? `${port[1]}${port[2]}` : undefined,
        },
        raw: quantity ? { available: Number.parseInt(quantity[1]!, 10) } : undefined,
      });
    });

    return results;
  }
}
