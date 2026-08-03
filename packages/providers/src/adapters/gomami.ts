import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://gomami.io';
const CATEGORIES: readonly Category[] = [
  { slug: 'hkg-turin', location: 'Hong Kong', url: `${PORTAL}/store/hkg-turin` },
  { slug: 'hkg-pulse', location: 'Hong Kong', url: `${PORTAL}/store/hkg-pulse` },
  { slug: 'jpn-pulse', location: 'Tokyo', url: `${PORTAL}/store/jpn-pulse` },
  { slug: 'sin-pulse', location: 'Singapore', url: `${PORTAL}/store/sin-pulse` },
  { slug: 'lax-pulse', location: 'Los Angeles', url: `${PORTAL}/store/lax-pulse` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:Memory|RAM)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'GB' ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:Traffic|Transfer)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase() === 'GB' ? value / 1000 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class GoMamiAdapter implements ProviderAdapter {
  readonly slug = 'gomami';
  readonly name = 'GoMami';
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
        `GoMami returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const text = card.text().replace(/\s+/g, ' ').trim();
      const description = card.find('.product-desc').text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantity = text.match(/(\d+)\s+Available/i);
      const unavailable = /out\s*of\s*stock|sold\s*out/i.test(text)
        || orderButton.hasClass('disabled')
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const pricing = card.find('.product-pricing').text().replace(/\s+/g, ' ').trim();
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)x?\s*vCPUs?/i));

      results.push({
        provider: this.slug,
        productId: `gomami-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : /\bHDD\b/i.test(description) ? 'HDD' : 'SSD',
        bandwidthTb: bandwidthInTb(description),
        ipv4: true,
        ipv6: /\bIPv6\b/i.test(description),
        price: Math.round(numberFrom(pricing, /\$\s*(\d+(?:\.\d+)?)/) * 100),
        currency: /\bCAD\b/i.test(pricing) ? 'CAD' : 'USD',
        billingCycle: billingCycleFrom(pricing),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
