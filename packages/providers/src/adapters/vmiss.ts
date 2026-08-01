import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const CATEGORIES: readonly Category[] = [
  { slug: 'hk-bgp', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hong-kong-bgp' },
  { slug: 'hk-bgp-dc2', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hk-bgp-v2' },
  { slug: 'hk-bgp-dc3', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hk-bgp-v3' },
  { slug: 'hk-intl', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hong-kong-intl' },
  { slug: 'osaka-iij', location: 'Osaka', url: 'https://app.vmiss.com/store/jp-osaka-iij' },
  { slug: 'tokyo-bgp', location: 'Tokyo', url: 'https://app.vmiss.com/store/jp-tokyo-bgp' },
  { slug: 'tokyo-iij', location: 'Tokyo', url: 'https://app.vmiss.com/store/jp-tokyo-iij' },
  { slug: 'tokyo-tri', location: 'Tokyo', url: 'https://app.vmiss.com/store/jp-tokyo-tri' },
  { slug: 'seoul-intl', location: 'Seoul', url: 'https://app.vmiss.com/store/kr-seoul-intl' },
  { slug: 'la-tri', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-tri' },
  { slug: 'la-tri-dc2', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-bgp' },
  { slug: 'la-9929', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-9929' },
  { slug: 'la-cmin2', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-cmin2' },
  { slug: 'la-cn2-gia', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-cn2' },
] as const;

function parseNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function storageType(text: string): string {
  if (/\bNVMe\b/i.test(text)) return 'NVMe';
  if (/\bSSD\b/i.test(text)) return 'SSD';
  if (/\bHDD\b/i.test(text)) return 'HDD';
  return 'Unknown';
}

function billingCycleFrom(text: string): BillingCycle {
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function idFrom(cardId: string, href: string, categorySlug: string, planName: string): string {
  const numericId = cardId.match(/(\d+)/)?.[1] ?? href.match(/[?&]pid=(\d+)/)?.[1];
  if (numericId) return `vmiss-${numericId}`;

  const orderSlug = href.split('/').filter(Boolean).at(-1);
  const base = orderSlug && !orderSlug.includes('.php') ? orderSlug : `${categorySlug}-${planName}`;
  return `vmiss-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export class VmissAdapter implements ProviderAdapter {
  readonly slug = 'vmiss';
  readonly name = 'VMISS';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const url = `${category.url}?language=english`;
        const html = await fetchProviderHtml(this.name, url);
        const parsed = this.parse(html, { ...category, url });
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulCategories++;

        for (const result of parsed) {
          const key = `${result.productId}:${result.location}`;
          if (!seen.has(key)) {
            seen.add(key);
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
        `VMISS returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
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
      const planName = card
        .find('[id$="-name"], .product-name, header span, header')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (!planName) return;

      const text = card.text().replace(/\s+/g, ' ').trim();
      const orderLink = card.find('a[href*="cart"], a.btn-order-now, a:contains("Order Now")').first();
      const href = orderLink.attr('href')?.trim() ?? '';
      const quantity = text.match(/(\d+)\s+Available/i);
      const explicitlyUnavailable = /out\s*of\s*stock/i.test(text)
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const inStock = !explicitlyUnavailable && href.length > 0;

      const ramMb = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*(GB|MB)(?:\s+RAM)?/i));
      const ramUnit = text.match(/\d+(?:\.\d+)?\s*(GB|MB)(?:\s+RAM)?/i)?.[1];
      const storageGb = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD)/i));
      const storageUnit = text.match(/\d+(?:\.\d+)?\s*(GB|TB)\s*(?:NVMe|SSD|HDD)/i)?.[1];
      const bandwidthGb = parseNumber(text, /(\d+(?:\.\d+)?)\s*GB\s+Bandwidth/i);
      const cores = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*Cores?/i));
      const price = Math.round(parseNumber(text, /\$\s*(\d+(?:\.\d+)?)/) * 100);
      const cardId = card.attr('id') ?? '';

      results.push({
        provider: this.slug,
        productId: idFrom(cardId, href, category.slug, planName),
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} Core${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: ramUnit?.toUpperCase() === 'GB' ? ramMb * 1024 : ramMb,
        storageGb: storageUnit?.toUpperCase() === 'TB' ? storageGb * 1024 : storageGb,
        storageType: storageType(text),
        bandwidthTb: Math.round((bandwidthGb / 1000) * 1000) / 1000,
        ipv4: /\bIPv4\b/i.test(text),
        ipv6: /\bIPv6\b/i.test(text),
        price,
        currency: /\bCAD\b/i.test(text) ? 'CAD' : 'USD',
        billingCycle: billingCycleFrom(text),
        inStock,
        orderUrl: inStock ? new URL(href, category.url).href : category.url,
      });
    });

    return results;
  }
}
