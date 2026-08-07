import * as cheerio from 'cheerio';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface CatalogPage {
  slug: string;
  location: string;
  url: string;
}

const ORDER_BASE = 'https://vps.hosting/';

/**
 * Location-specific HostBill carts covering competitor-watched lines:
 * Singapore/Tokyo performance, Edge CN routes, EU/US/Asia cloud, storage, BF nanos.
 */
const CATALOG_PAGES: readonly CatalogPage[] = [
  {
    slug: 'singapore-performance',
    location: 'Singapore',
    url: `${ORDER_BASE}cart/singapore-performance-kvm-vps/`,
  },
  {
    slug: 'tokyo-performance-gen2',
    location: 'Tokyo',
    url: `${ORDER_BASE}cart/tokyo-performance-kvm-vps-gen-2/`,
  },
  {
    slug: 'singapore-edge',
    location: 'Singapore',
    url: `${ORDER_BASE}cart/singapore-edge-kvm-vps/`,
  },
  {
    slug: 'osaka-edge',
    location: 'Osaka',
    url: `${ORDER_BASE}cart/osaka-edge-kvm-vps/`,
  },
  {
    slug: 'amsterdam-cloud',
    location: 'Amsterdam',
    url: `${ORDER_BASE}cart/amsterdam-cloud-kvm-vps/`,
  },
  {
    slug: 'frankfurt-cloud',
    location: 'Frankfurt',
    url: `${ORDER_BASE}cart/frankfurt-cloud-kvm-vps/`,
  },
  {
    slug: 'duesseldorf-cloud',
    location: 'Düsseldorf',
    url: `${ORDER_BASE}cart/duesseldorf-cloud-kvm-vps/`,
  },
  {
    slug: 'tallinn-cloud',
    location: 'Tallinn',
    url: `${ORDER_BASE}cart/tallinn-cloud-kvm-vps/`,
  },
  {
    slug: 'london-cloud',
    location: 'London',
    url: `${ORDER_BASE}cart/london-cloud-kvm-vps/`,
  },
  {
    slug: 'newyork-cloud',
    location: 'New York',
    url: `${ORDER_BASE}cart/newyork-cloud-kvm-vps/`,
  },
  {
    slug: 'seattle-cloud',
    location: 'Seattle',
    url: `${ORDER_BASE}cart/seattle-cloud-kvm-vps/`,
  },
  {
    slug: 'san-jose-cloud',
    location: 'San Jose',
    url: `${ORDER_BASE}cart/san-jose-cloud-kvm-vps/`,
  },
  {
    slug: 'hong-kong-cloud',
    location: 'Hong Kong',
    url: `${ORDER_BASE}cart/hong-kong-cloud-kvm-vps/`,
  },
  {
    slug: 'tokyo-cloud',
    location: 'Tokyo',
    url: `${ORDER_BASE}cart/tokyo-cloud-kvm-vps/`,
  },
  {
    slug: 'osaka-cloud',
    location: 'Osaka',
    url: `${ORDER_BASE}cart/osaka-cloud-kvm-vps/`,
  },
  {
    slug: 'sydney-cloud',
    location: 'Sydney',
    url: `${ORDER_BASE}cart/sydney-cloud-kvm-vps/`,
  },
  {
    slug: 'amsterdam-storage',
    location: 'Amsterdam',
    url: `${ORDER_BASE}cart/amsterdam-storage-kvm-vps/`,
  },
  {
    slug: 'frankfurt-nano-promo',
    location: 'Frankfurt',
    url: `${ORDER_BASE}?action=add&cmd=cart&id=231`,
  },
  {
    slug: 'amsterdam-nano-promo',
    location: 'Amsterdam',
    url: `${ORDER_BASE}?action=add&cmd=cart&id=232`,
  },
] as const;

function amount(value: string): number {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function planNameFrom(rawName: string, location: string): string {
  if (new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(rawName)) {
    return rawName;
  }
  if (/^edge\b/i.test(rawName) || /^(starter|essential|pro|premium|ultra|nano|small|medium|large)/i.test(rawName)) {
    return `${location} ${rawName}`;
  }
  return rawName;
}

export class VpsAdapter implements ProviderAdapter {
  readonly slug = 'vps';
  readonly name = 'V.PS';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulPages = 0;
    this.warnings = [];

    for (const page of CATALOG_PAGES) {
      try {
        const html = await fetchProviderHtml(this.name, page.url);
        const parsed = this.parse(html, page.location);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulPages++;

        for (const result of parsed) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${page.slug}: ${message}`);
      }
    }

    if (successfulPages === 0 || results.length === 0) {
      throw new Error(
        `V.PS returned no parseable products; ${failures.length}/${CATALOG_PAGES.length} pages failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, location: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.cart-product').each((_, element) => {
      const card = $(element);
      const id = card.attr('data-value')?.trim();
      const rawName = card.find('h4').first().text().replace(/\s+/g, ' ').trim();
      if (!id || !rawName) return;
      // Shared hosting / non-VPS SKUs occasionally appear on promo carts.
      if (/\bHosting\b/i.test(rawName) && !/\bVPS\b|\bEPYC\b|\bEdge\b|\bNano\b/i.test(rawName)) return;

      const planName = planNameFrom(rawName, location);
      const features = new Map<string, string>();
      card.find('.row.mx-3').each((__, row) => {
        const cells = $(row).find('.col-6');
        const label = cells.eq(0).text().replace(/\s+/g, ' ').trim().toLowerCase();
        const value = cells.eq(1).text().replace(/\s+/g, ' ').trim();
        if (label && value) features.set(label, value);
      });

      const memory = features.get('memory') ?? '';
      const storage = features.get('nvme storage') ?? features.get('storage') ?? '';
      const transfer = features.get('data transfer') ?? '';
      const cpu = features.get('amd epyc cpu') ?? features.get('cpu') ?? 'Unknown';
      const priceText = card.find('.product-price.cycle-m').first().text();
      const description = card.find('.vtip_features').attr('title') ?? '';
      const inStock = !card.hasClass('outofstock')
        && card.find('.cart-product-outofstock-badge').length === 0;

      results.push({
        provider: this.slug,
        productId: `vps-${id}`,
        planName,
        location,
        category: 'vps',
        cpu,
        ramMb: Math.round(amount(memory) * (/GB/i.test(memory) ? 1024 : 1)),
        storageGb: Math.round(amount(storage) * (/TB/i.test(storage) ? 1024 : 1)),
        storageType: /NVMe/i.test(storage) || features.has('nvme storage') ? 'NVMe' : 'Unknown',
        bandwidthTb: amount(transfer) * (/GB/i.test(transfer) ? 1 / 1000 : 1),
        ipv4: /IPv4/i.test(description),
        ipv6: /IPv6/i.test(description),
        price: Math.round(amount(priceText) * 100),
        currency: 'EUR',
        billingCycle: 'monthly',
        inStock,
        orderUrl: `${ORDER_BASE}?action=add&cmd=cart&id=${id}`,
      });
    });

    return results;
  }
}
