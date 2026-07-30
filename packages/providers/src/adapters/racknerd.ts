import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://my.racknerd.com';
const CATEGORIES: readonly Category[] = [
  { slug: 'kvm-los-angeles', location: 'Los Angeles', url: `${PORTAL}/index.php?rp=/store/kvm-vps` },
  { slug: 'kvm-chicago', location: 'Chicago', url: `${PORTAL}/index.php?rp=/store/chicago-kvm` },
  { slug: 'kvm-new-york', location: 'New York', url: `${PORTAL}/index.php?rp=/store/new-york-kvm` },
  { slug: 'kvm-seattle', location: 'Seattle', url: `${PORTAL}/index.php?rp=/store/seattle-kvm` },
  { slug: 'kvm-atlanta', location: 'Atlanta', url: `${PORTAL}/index.php?rp=/store/atlanta-kvm` },
  { slug: 'kvm-dallas', location: 'Dallas', url: `${PORTAL}/index.php?rp=/store/dallas-kvm` },
  { slug: 'kvm-san-jose', location: 'San Jose', url: `${PORTAL}/index.php?rp=/store/sj-kvm` },
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

export class RackNerdAdapter implements ProviderAdapter {
  readonly slug = 'racknerd';
  readonly name = 'RackNerd';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const response = await fetch(category.url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`RackNerd HTTP ${response.status} for ${category.slug}`);

      const html = await response.text();
      if (/cf-chl-|captcha|just a moment/i.test(html)) {
        throw new Error(`RackNerd returned a challenge page for ${category.slug}`);
      }

      for (const result of this.parse(html, category)) {
        if (!seen.has(result.productId)) {
          seen.add(result.productId);
          results.push(result);
        }
      }
    }

    if (results.length === 0) throw new Error('RackNerd returned no parseable products');
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
      const storageGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe|SSD|HDD|SAS)/i);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)x?\s*vCPU|vCores?|Cores?/i));
      const bwTb = numberFrom(description, /(\d+(?:\.\d+)?)\s*TB\s+(?:BW|Bandwidth|Transfer)/i);

      results.push({
        provider: this.slug,
        productId: `racknerd-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : 'SSD',
        bandwidthTb: bwTb,
        ipv4: true,
        ipv6: /ipv6/i.test(description),
        price: Math.round(numberFrom(priceText || pricing, /(\d+(?:\.\d+)?)/) * 100),
        currency: 'USD',
        billingCycle: parseBillingCycle(pricing),
        inStock,
        orderUrl: inStock ? new URL(orderHref, PORTAL).href : `${PORTAL}/index.php?rp=/store/kvm-vps`,
      });
    });

    return results;
  }
}
