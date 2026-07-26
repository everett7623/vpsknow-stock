import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const CATEGORIES: readonly Category[] = [
  { slug: 'hk-bgp', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hk-bgp-v3' },
  { slug: 'hk-intl', location: 'Hong Kong', url: 'https://app.vmiss.com/store/cn-hongkong-intl' },
  { slug: 'tokyo-bgp', location: 'Tokyo', url: 'https://app.vmiss.com/store/jp-tokyo-bgp' },
  { slug: 'tokyo-iij', location: 'Tokyo', url: 'https://app.vmiss.com/store/jp-tokyo-iij' },
  { slug: 'seoul-intl', location: 'Seoul', url: 'https://app.vmiss.com/store/kr-seoul-intl' },
  { slug: 'la-tri', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-tri' },
  { slug: 'la-9929', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-9929' },
  { slug: 'la-cmin2', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-cmin2' },
  { slug: 'la-cn2-gia', location: 'Los Angeles', url: 'https://app.vmiss.com/store/us-los-angeles-cn2-gia' },
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

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const response = await fetch(category.url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'VPSKnow-Stock/1.0',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`VMISS HTTP ${response.status} for ${category.slug}`);
      }

      const html = await response.text();
      if (/cf-chl-|challenge-platform|just a moment|captcha/i.test(html)) {
        throw new Error(`VMISS Cloudflare challenge for ${category.slug}`);
      }

      const parsed = this.parse(html, category);
      for (const result of parsed) {
        const key = `${result.productId}:${result.location}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(result);
        }
      }
    }

    if (results.length === 0) {
      throw new Error('VMISS returned no parseable products');
    }

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
        billingCycle: /annual|yearly/i.test(text) ? 'annually' : 'monthly',
        inStock,
        orderUrl: inStock ? new URL(href, category.url).href : category.url,
      });
    });

    return results;
  }
}
