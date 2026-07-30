import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://billing.dedirock.com';
const CATEGORIES: readonly Category[] = [
  { slug: 'vps-us', location: 'Los Angeles', url: `${PORTAL}/index.php?rp=/store/us-vps` },
  { slug: 'vps-eu', location: 'Frankfurt', url: `${PORTAL}/index.php?rp=/store/eu-vps` },
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

export class DediRockAdapter implements ProviderAdapter {
  readonly slug = 'dedirock';
  readonly name = 'DediRock';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const response = await fetch(category.url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`DediRock HTTP ${response.status} for ${category.slug}`);

      const html = await response.text();
      if (/cf-chl-|captcha|just a moment/i.test(html)) {
        throw new Error(`DediRock returned a challenge page for ${category.slug}`);
      }

      for (const result of this.parse(html, category)) {
        if (!seen.has(result.productId)) {
          seen.add(result.productId);
          results.push(result);
        }
      }
    }

    if (results.length === 0) throw new Error('DediRock returned no parseable products');
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/product(\d+)/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().trim();
      if (!numericId || !planName) return;

      const description = card.find('.product-desc').text().replace(/\s+/g, ' ').trim();
      const quantityText = card.find('.qty').text().trim();
      const quantity = quantityText.match(/(\d+)\s+Available/i);
      const orderHref = card.find('.btn-order-now').attr('href')?.trim() ?? '';
      const inStock = quantity
        ? Number.parseInt(quantity[1]!, 10) > 0
        : orderHref.length > 0 && !/out\s*of\s*stock/i.test(card.text());

      const pricing = card.find('.product-pricing').text().replace(/\s+/g, ' ').trim();
      const priceText = card.find('.product-pricing .price').first().text();
      const ramGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+RAM/i);
      const storageGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe|SSD|HDD)/i);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)x?\s*(?:vCPU|vCores?|Cores?)/i));
      const bwTb = numberFrom(description, /(\d+(?:\.\d+)?)\s*TB\s+(?:BW|Bandwidth|Transfer)/i);

      results.push({
        provider: this.slug,
        productId: `dedirock-${numericId}`,
        planName,
        location: category.location,
        category: /dedi|dedicated/i.test(planName) ? 'dedicated' : 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : 'SSD',
        bandwidthTb: bwTb,
        ipv4: true,
        ipv6: /ipv6/i.test(description),
        price: Math.round(numberFrom(priceText || pricing, /(\d+(?:\.\d+)?)/) * 100),
        currency: /€|EUR/i.test(pricing) ? 'EUR' : 'USD',
        billingCycle: parseBillingCycle(pricing),
        inStock,
        orderUrl: inStock ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
