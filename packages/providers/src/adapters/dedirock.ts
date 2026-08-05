import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://billing.dedirock.com';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'kvm-vps-hosting',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?rp=/store/kvm-vps-hosting`,
  },
  {
    slug: 'buffalo-kvm-vps',
    location: 'Buffalo, New York',
    url: `${PORTAL}/index.php?rp=/store/buffalo-kvm-vps`,
  },
  {
    slug: 'promo-performance',
    location: 'Buffalo, New York',
    url: `${PORTAL}/index.php?rp=/store/promo-performance`,
  },
  {
    slug: 'promo-storage-new-york',
    location: 'Buffalo, New York',
    url: `${PORTAL}/index.php?rp=/store/promo-storage-new-york`,
  },
  {
    slug: 'promo-vps-los-angeles',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?rp=/store/promo-vps-los-angeles`,
  },
  {
    slug: 'promo-vp',
    location: 'Buffalo, New York',
    url: `${PORTAL}/index.php?rp=/store/promo-vp`,
  },
  {
    slug: 'the-i9-dream',
    location: 'Buffalo, New York',
    url: `${PORTAL}/index.php?rp=/store/the-i9-dream`,
  },
  {
    slug: 'vps-storage',
    location: 'United States',
    url: `${PORTAL}/index.php?rp=/store/vps-storage`,
  },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function parseRamMb(description: string): number {
  const ramMb = numberFrom(description, /(\d+(?:\.\d+)?)\s*MB\s+RAM/i);
  if (ramMb > 0) return Math.round(ramMb);

  return Math.round(numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+RAM/i) * 1024);
}

function parseStorageGb(description: string): number {
  const storageTb = numberFrom(
    description,
    /(\d+(?:\.\d+)?)\s*TB\s+(?:NVMe|SSD|HDD|Space|Storage)/i,
  );
  if (storageTb > 0) return Math.round(storageTb * 1024);

  return Math.round(
    numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe|SSD|HDD|Space|Storage)/i),
  );
}

function parseStorageType(description: string): string {
  if (/\bNVMe\b/i.test(description)) return 'NVMe';
  if (/\bSSD\b/i.test(description)) return 'SSD';
  if (/\bHDD\b/i.test(description)) return 'HDD';
  return 'Storage';
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
      const html = await fetchProviderHtml(this.name, category.url);

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
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)x?\s*(?:vCPU|vCores?|Cores?)/i));
      const bwTb = numberFrom(description, /(\d+(?:\.\d+)?)\s*TB\s+(?:BW|Bandwidth|Transfer)/i);

      results.push({
        provider: this.slug,
        productId: `dedirock-${numericId}`,
        planName,
        location: category.location,
        category: /\bdedicated\b/i.test(planName) ? 'dedicated' : 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: parseRamMb(description),
        storageGb: parseStorageGb(description),
        storageType: parseStorageType(description),
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
