import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://cloud.colocrossing.com';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'specials',
    location: 'United States',
    url: `${PORTAL}/index.php?language=english&rp=/store/specials`,
  },
  {
    // Competitor "CCS_Single_Day" / evergreen cloud VPS line
    slug: 'cloud-virtual-private-servers',
    location: 'United States',
    url: `${PORTAL}/index.php?language=english&rp=/store/cloud-virtual-private-servers`,
  },
] as const;

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
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|Disk|Space)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function locationFrom(text: string, fallback: string): string {
  if (/los\s*angeles/i.test(text)) return 'Los Angeles';
  if (/buffalo/i.test(text)) return 'Buffalo';
  if (/chicago/i.test(text)) return 'Chicago';
  if (/dallas/i.test(text)) return 'Dallas';
  if (/seattle/i.test(text)) return 'Seattle';
  if (/new\s*york/i.test(text)) return 'New York';
  return fallback;
}

export class ColoCrossingAdapter implements ProviderAdapter {
  readonly slug = 'colocrossing';
  readonly name = 'ColoCrossing';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await fetchProviderHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulCategories++;

        for (const result of parsed) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${category.slug}: ${message}`);
      }
    }

    if (successfulCategories === 0 || results.length === 0) {
      throw new Error(
        `ColoCrossing returned no parseable VPS products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category?: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];
    const fallbackLocation = category?.location ?? 'United States';
    const fallbackUrl = category?.url
      ?? `${PORTAL}/index.php?language=english&rp=/store/specials`;

    $('.package[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('.package-title').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const text = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantity = text.match(/(\d+)\s+Available/i);
      const unavailable = /out\s*of\s*stock|sold\s*out/i.test(text)
        || orderButton.hasClass('disabled')
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const cores = Math.round(numberFrom(text, /(\d+(?:\.\d+)?)\s*vCPU/i));
      const bandwidthTb = numberFrom(text, /(\d+(?:\.\d+)?)\s*TB\s*(?:Bandwidth|Traffic|Transfer)/i);
      const priceText = card.find('.price-amount').first().text().replace(/\s+/g, ' ').trim();
      const cycleText = card.find('.price-cycle').first().text().replace(/\s+/g, ' ').trim();

      results.push({
        provider: this.slug,
        productId: `colocrossing-${numericId}`,
        planName,
        location: locationFrom(text, fallbackLocation),
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(text),
        storageGb: capacityInGb(text),
        storageType: /\bNVMe\b/i.test(text) ? 'NVMe' : /\bHDD\b/i.test(text) ? 'HDD' : 'SSD',
        bandwidthTb,
        ipv4: /\bIPv4\b/i.test(text),
        ipv6: /\bIPv6\b/i.test(text),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bCAD\b/i.test(priceText) ? 'CAD' : 'USD',
        billingCycle: billingCycleFrom(cycleText),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : fallbackUrl,
      });
    });

    return results;
  }
}
