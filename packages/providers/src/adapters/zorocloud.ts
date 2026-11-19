import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  category: ProductCategory;
  url: string;
}

const PORTAL = 'https://my.zorocloud.com';

/** Store groups HostMonit tracks. Out-of-stock cards stay on the page with `0 可用`. */
const CATEGORIES: readonly Category[] = [
  { slug: 'cuii-9929', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/cuii-9929` },
  { slug: 'de-9929', location: 'Frankfurt', category: 'vps', url: `${PORTAL}/store/de-9929` },
  { slug: 'isp-4837', location: 'London', category: 'vps', url: `${PORTAL}/store/isp-4837` },
  { slug: '9929cmin2', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/9929cmin2` },
  { slug: 'cuvip-isp', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/cuvip-isp` },
  { slug: 'hkcn2', location: 'Hong Kong', category: 'vps', url: `${PORTAL}/store/hkcn2` },
  { slug: 'jp-cn2', location: 'Tokyo', category: 'vps', url: `${PORTAL}/store/jp-cn2` },
  { slug: 'cn2-9929-cmin2', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/cn2-9929-cmin2` },
  { slug: 'cn2gia', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/cn2gia` },
  { slug: 'deisp', location: 'Frankfurt', category: 'vps', url: `${PORTAL}/store/deisp` },
  { slug: 'kr-isp', location: 'Seoul', category: 'vps', url: `${PORTAL}/store/kr-isp` },
  { slug: 'jp-isp-ntt', location: 'Tokyo', category: 'vps', url: `${PORTAL}/store/jp-isp-ntt` },
  { slug: 'uk-isp', location: 'London', category: 'vps', url: `${PORTAL}/store/uk-isp` },
  { slug: 'uk-jk', location: 'London', category: 'vps', url: `${PORTAL}/store/uk-jk` },
  { slug: 'att-isp', location: 'Los Angeles', category: 'vps', url: `${PORTAL}/store/att-isp` },
  { slug: 'hk-bgp-isp', location: 'Hong Kong', category: 'vps', url: `${PORTAL}/store/hk-bgp-isp` },
  { slug: 'id-isp', location: 'Jakarta', category: 'vps', url: `${PORTAL}/store/id-isp` },
  { slug: 'jpisp', location: 'Tokyo', category: 'vps', url: `${PORTAL}/store/jpisp` },
  { slug: 'sg-bgp', location: 'Singapore', category: 'vps', url: `${PORTAL}/store/sg-bgp` },
  { slug: 'mysisp', location: 'Malaysia', category: 'vps', url: `${PORTAL}/store/mysisp` },
  { slug: 'dfhk', location: 'Hong Kong', category: 'dedicated', url: `${PORTAL}/store/dfhk` },
  { slug: 'jpcn2', location: 'Tokyo', category: 'dedicated', url: `${PORTAL}/store/jpcn2` },
  { slug: 'kr-nc2', location: 'Seoul', category: 'dedicated', url: `${PORTAL}/store/kr-nc2` },
  { slug: 'tw-cn2', location: 'Taipei', category: 'dedicated', url: `${PORTAL}/store/tw-cn2` },
  { slug: 'yn-cn2', location: 'Vietnam', category: 'dedicated', url: `${PORTAL}/store/yn-cn2` },
  { slug: 'jpz-cn2', location: 'Cambodia', category: 'dedicated', url: `${PORTAL}/store/jpz-cn2` },
  { slug: 'th-cn2', location: 'Thailand', category: 'dedicated', url: `${PORTAL}/store/th-cn2` },
] as const;

type FetchHtml = (provider: string, url: string) => Promise<string>;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function coresFrom(text: string): number {
  const starred = text.match(/(\d+)\s*\*/);
  if (starred) return Math.round(Number.parseFloat(starred[1]!));
  const labeled = text.match(/(\d+(?:\.\d+)?)\s*H?\s*(?:vCPU|CPU|核|Core)/i);
  return labeled ? Math.round(Number.parseFloat(labeled[1]!)) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:DDR|RAM|内存)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(/G/i.test(match[2]!) ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:NVMe|SSD|HDD)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(/T/i.test(match[2]!) ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:Monthly|流量|Transfer|Bandwidth)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return /G/i.test(match[2]!) ? value / 1024 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/季缴|季度|quarterly/i.test(text)) return 'quarterly';
  if (/半年|semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/年缴|每年|annually|yearly/i.test(text)) return 'annually';
  if (/两年|biennially/i.test(text)) return 'biennially';
  if (/三年|triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class ZoroCloudAdapter implements ProviderAdapter {
  readonly slug = 'zorocloud';
  readonly name = 'ZoroCloud';
  warnings: readonly string[] = [];

  constructor(private readonly fetchHtml: FetchHtml = fetchProviderHtml) {}

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await this.fetchHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulCategories++;

        for (const result of parsed) {
          if (seen.has(result.productId)) continue;
          seen.add(result.productId);
          results.push(result);
        }
      } catch (error) {
        failures.push(`${category.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (successfulCategories === 0 || results.length === 0) {
      throw new Error(
        `ZoroCloud returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.package[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('.package-title').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const description = card.find('.package-content').first().text().replace(/\s+/g, ' ').trim();
      const text = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const qtyText = card.find('.package-qty').first().text().replace(/\s+/g, ' ').trim();
      const quantity = qtyText.match(/(\d+)\s*可用/i) ?? qtyText.match(/(\d+)\s+Available/i);
      const unavailable =
        orderButton.hasClass('disabled')
        || /售罄|缺货|out\s*of\s*stock|sold\s*out/i.test(text)
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const priceText = card.find('.price-amount').first().text().replace(/\s+/g, ' ').trim();
      const cycleText = card.find('.price-cycle').first().text().replace(/\s+/g, ' ').trim();
      const cores = coresFrom(description);

      results.push({
        provider: this.slug,
        productId: `zorocloud-${numericId}`,
        planName,
        location: category.location,
        category: category.category,
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : /\bHDD\b/i.test(description) ? 'HDD' : 'SSD',
        bandwidthTb: bandwidthInTb(description),
        ipv4: !/no\s*ipv4|nat\s*only/i.test(text),
        ipv6: /ipv6/i.test(text),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /¥|CNY|RMB/i.test(priceText) ? 'CNY' : /€|EUR/i.test(priceText) ? 'EUR' : 'USD',
        billingCycle: billingCycleFrom(cycleText),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        raw: quantity ? { available: Number.parseInt(quantity[1]!, 10) } : undefined,
      });
    });

    return results;
  }
}
