import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://bytevirt.com';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'la-china-optimized-cn2-gia',
    location: 'Los Angeles',
    url: `${PORTAL}/store/la-china-optimized-cn2-gia`,
  },
  {
    slug: 'la9929',
    location: 'Los Angeles',
    url: `${PORTAL}/store/la9929`,
  },
  {
    slug: 'tokyo-china-optimized',
    location: 'Tokyo',
    url: `${PORTAL}/store/tokyo-china-optimized`,
  },
] as const;

type FetchHtml = (provider: string, url: string) => Promise<string>;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:RAM|Memory)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'GB' ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|Disk)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:@|Bandwidth|Traffic|Transfer|per month)/i);
  if (!match) {
    const alt = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\b(?![^@]*Mbps)/i);
    if (!alt) return 0;
    const value = Number.parseFloat(alt[1]!);
    return alt[2]!.toUpperCase() === 'GB' ? value / 1024 : value;
  }
  const value = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase() === 'GB' ? value / 1024 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class ByteVirtAdapter implements ProviderAdapter {
  readonly slug = 'bytevirt';
  readonly name = 'ByteVirt';
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
        `ByteVirt returned no parseable VPS products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.package[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('.package-title').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const description = card.find('.package-content').first().text().replace(/\s+/g, ' ').trim();
      const text = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantity =
        card.find('.package-qty').first().text().match(/(\d+)\s+Available/i)
        ?? text.match(/(\d+)\s+Available/i);
      const unavailable =
        /out\s*of\s*stock|sold\s*out/i.test(text)
        || orderButton.hasClass('disabled')
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)\s*Core/i));
      const priceText = card.find('.price-amount').first().text().replace(/\s+/g, ' ').trim();
      const cycleText = card.find('.price-cycle').first().text().replace(/\s+/g, ' ').trim();
      const port = description.match(/@\s*(\d+(?:\.\d+)?)\s*(Gbps|Mbps)/i);
      const bandwidthMatch = description.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:@|Bandwidth|Traffic|Transfer|per month)/i);

      results.push({
        provider: this.slug,
        productId: `bytevirt-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : /\bHDD\b/i.test(description) ? 'HDD' : 'SSD',
        bandwidthTb: bandwidthInTb(description),
        ipv4: /\bIPv4\b/i.test(description),
        ipv6: /\bIPv6\b/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bCAD\b/i.test(priceText) ? 'CAD' : /\bEUR\b/i.test(priceText) ? 'EUR' : 'USD',
        billingCycle: billingCycleFrom(cycleText),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        displaySpecs: {
          bandwidth: bandwidthMatch
            ? `${bandwidthMatch[1]}${bandwidthMatch[2]!.toUpperCase()}`
            : undefined,
          port: port ? `${port[1]}${port[2]}` : undefined,
        },
        raw: quantity ? { available: Number.parseInt(quantity[1]!, 10) } : undefined,
      });
    });

    return results;
  }
}
