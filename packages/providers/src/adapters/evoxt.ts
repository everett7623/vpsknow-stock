import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://evoxt.com';
const CATEGORIES: readonly Category[] = [
  { slug: 'us-california', location: 'Los Angeles', url: `${PORTAL}/products/vps-usa` },
  { slug: 'de-frankfurt', location: 'Frankfurt', url: `${PORTAL}/products/vps-germany` },
  { slug: 'uk-london', location: 'London', url: `${PORTAL}/products/vps-uk` },
  { slug: 'my-kuala-lumpur', location: 'Kuala Lumpur', url: `${PORTAL}/products/vps-malaysia` },
  { slug: 'jp-tokyo', location: 'Tokyo', url: `${PORTAL}/products/vps-japan` },
  { slug: 'hk-hongkong', location: 'Hong Kong', url: `${PORTAL}/products/vps-hongkong` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function parseBillingCycle(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi-annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class EvoxtAdapter implements ProviderAdapter {
  readonly slug = 'evoxt';
  readonly name = 'Evoxt';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const response = await fetch(category.url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Evoxt HTTP ${response.status} for ${category.slug}`);

      const html = await response.text();
      if (/cf-chl-|captcha|just a moment/i.test(html)) {
        throw new Error(`Evoxt returned a challenge page for ${category.slug}`);
      }

      for (const result of this.parse(html, category)) {
        if (!seen.has(result.productId)) {
          seen.add(result.productId);
          results.push(result);
        }
      }
    }

    if (results.length === 0) throw new Error('Evoxt returned no parseable products');
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    // Evoxt uses a custom product card layout
    $('.pricing-card, .plan-card, .product-card, [class*="pricing"]').each((_, element) => {
      const card = $(element);
      const planName = card.find('h3, h4, .plan-name, .plan-title').first().text().trim();
      if (!planName) return;

      const text = card.text().replace(/\s+/g, ' ');
      const orderHref = card.find('a[href*="order"], a[href*="cart"], .btn-order').attr('href')?.trim() ?? '';
      const inStock = orderHref.length > 0
        && !/out\s*of\s*stock|sold\s*out|unavailable/i.test(text);

      const ramGb = numberFrom(text, /(\d+(?:\.\d+)?)\s*GB\s+RAM/i);
      const storageGb = numberFrom(text, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe|SSD|HDD)/i);
      const cores = Math.round(numberFrom(text, /(\d+(?:\.\d+)?)x?\s*(?:vCPU|vCores?|Cores?)/i));
      const bwTb = numberFrom(text, /(\d+(?:\.\d+)?)\s*TB\s+(?:BW|Bandwidth|Transfer)/i);
      const priceMatch = text.match(/\$\s*(\d+(?:\.\d+)?)\s*(?:\/\s*mo|per\s*month)/i)
        ?? text.match(/(\d+(?:\.\d+)?)\s*USD\s*(?:\/\s*mo|per\s*month)/i);

      const slug = planName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      results.push({
        provider: this.slug,
        productId: `evoxt-${category.slug}-${slug}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(text) ? 'NVMe' : 'SSD',
        bandwidthTb: bwTb,
        ipv4: true,
        ipv6: /ipv6/i.test(text),
        price: priceMatch ? Math.round(Number.parseFloat(priceMatch[1]!) * 100) : 0,
        currency: 'USD',
        billingCycle: parseBillingCycle(text),
        inStock,
        orderUrl: inStock ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
