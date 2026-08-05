import * as cheerio from 'cheerio';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface ProductPage {
  id: number;
  location: string;
}

const ORDER_BASE = 'https://vps.hosting/';
const PRODUCT_PAGES: readonly ProductPage[] = [
  { id: 238, location: 'Singapore' },
  { id: 262, location: 'Tokyo' },
] as const;

function amount(value: string): number {
  const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]!) : 0;
}

export class VpsAdapter implements ProviderAdapter {
  readonly slug = 'vps';
  readonly name = 'V.PS';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const page of PRODUCT_PAGES) {
      const url = `${ORDER_BASE}?action=add&cmd=cart&id=${page.id}`;
      const html = await fetchProviderHtml(this.name, url);
      const parsed = this.parse(html, page.location);
      if (parsed.length === 0) {
        throw new Error(`V.PS returned no parseable products for ${page.location}`);
      }

      for (const result of parsed) {
        if (!seen.has(result.productId)) {
          seen.add(result.productId);
          results.push(result);
        }
      }
    }

    if (results.length === 0) throw new Error('V.PS returned no parseable products');
    return results;
  }

  parse(html: string, location: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.cart-product').each((_, element) => {
      const card = $(element);
      const id = card.attr('data-value')?.trim();
      const planName = card.find('h4').first().text().replace(/\s+/g, ' ').trim();
      if (!id || !planName) return;

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
