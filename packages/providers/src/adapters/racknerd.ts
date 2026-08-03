import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  category: ProductCategory;
  url: string;
}

const PORTAL = 'https://my.racknerd.com';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'kvm-los-angeles',
    location: 'Los Angeles',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/kvm-vps`,
  },
  {
    slug: 'kvm-chicago',
    location: 'Chicago',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/chicago-kvm`,
  },
  {
    slug: 'kvm-new-york',
    location: 'New York',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/new-york-kvm`,
  },
  {
    slug: 'kvm-seattle',
    location: 'Seattle',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/seattle-kvm`,
  },
  {
    slug: 'kvm-atlanta',
    location: 'Atlanta',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/atlanta-kvm`,
  },
  {
    slug: 'kvm-dallas',
    location: 'Dallas',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/dallas-kvm`,
  },
  {
    slug: 'kvm-san-jose',
    location: 'San Jose',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/sj-kvm`,
  },
  {
    slug: 'dedicated',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/dedicated-servers`,
  },
  {
    slug: 'dedicated-unmetered',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/high-bandwidth-unmetered-dedicated-servers`,
  },
  {
    slug: 'dedicated-amd',
    location: 'Utah',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/amd-ryzenepyc-dedicated-servers`,
  },
  {
    slug: 'dedicated-seo',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/seo-dedicated-servers`,
  },
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

function parseRamMb(description: string): number {
  const match = description.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)(?:\s+DDR\d+)?\s+RAM/i);
  if (!match) return 0;

  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  if (unit === 'TB') return Math.round(value * 1024 * 1024);
  if (unit === 'GB') return Math.round(value * 1024);
  return Math.round(value);
}

function parseStorage(description: string): { sizeGb: number; type: string } {
  const pattern = /(?:(\d+)\s*x\s*)?(\d+(?:\.\d+)?)\s*(GB|TB)\s*(NVMe|SSD|HDD|SAS)/gi;
  const types = new Set<string>();
  let sizeGb = 0;

  for (const match of description.matchAll(pattern)) {
    const quantity = Number.parseInt(match[1] ?? '1', 10);
    const size = Number.parseFloat(match[2]!);
    const unitMultiplier = match[3]!.toUpperCase() === 'TB' ? 1024 : 1;
    sizeGb += quantity * size * unitMultiplier;
    types.add(match[4]!.toUpperCase() === 'NVME' ? 'NVMe' : match[4]!.toUpperCase());
  }

  return {
    sizeGb: Math.round(sizeGb),
    type: types.size === 0 ? 'Unknown' : types.size === 1 ? [...types][0]! : 'Mixed',
  };
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
      const storage = parseStorage(description);
      const cores = Math.round(
        numberFrom(description, /(\d+(?:\.\d+)?)\s*x?\s*(?:vCPUs?|vCores?|Cores?)/i),
      );
      const bwTb = numberFrom(
        description,
        /(\d+(?:\.\d+)?)\s*TB(?:\s+Monthly)?\s+(?:BW|Bandwidth|Transfer)/i,
      );
      const cpu =
        category.category === 'dedicated'
          ? planName.split('|')[0]!.trim()
          : cores > 0
            ? `${cores} vCPU${cores === 1 ? '' : 's'}`
            : 'Unknown';

      results.push({
        provider: this.slug,
        productId: `racknerd-${numericId}`,
        planName,
        location: category.location,
        category: category.category,
        cpu,
        ramMb: parseRamMb(description),
        storageGb: storage.sizeGb,
        storageType: storage.type,
        bandwidthTb: bwTb,
        ipv4: true,
        ipv6: /ipv6/i.test(description),
        price: Math.round(numberFrom(priceText || pricing, /(\d+(?:\.\d+)?)/) * 100),
        currency: 'USD',
        billingCycle: parseBillingCycle(pricing),
        inStock,
        orderUrl: inStock ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
