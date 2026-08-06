import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';
import { VMISS_CATALOG } from './vmiss-catalog.js';

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

type FetchHtml = (provider: string, url: string) => Promise<string>;
type FetchBrowserPages = (
  provider: string,
  urls: readonly string[],
  readySelector: string,
) => Promise<BrowserPageResult[]>;

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

function englishUrl(category: Category): string {
  return `${category.url}?language=english`;
}

function orderUrlForPid(pid: string): string {
  return `https://app.vmiss.com/cart.php?a=add&pid=${pid}`;
}

export class VmissAdapter implements ProviderAdapter {
  readonly slug = 'vmiss';
  readonly name = 'VMISS';
  warnings: readonly string[] = [];

  constructor(
    private readonly fetchHtml: FetchHtml = fetchProviderHtml,
    private readonly fetchBrowserPages: FetchBrowserPages = fetchProviderPagesWithBrowser,
  ) {}

  async check(): Promise<StockResult[]> {
    this.warnings = [];

    const direct = await this.checkDirect();
    if (direct.results.length > 0) {
      this.warnings = direct.failures;
      return direct.results;
    }

    const pages = await this.fetchBrowserPages(
      this.name,
      CATEGORIES.map(englishUrl),
      '.product',
    );
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];

    for (const [index, page] of pages.entries()) {
      const category = CATEGORIES[index];
      if (!category) continue;
      if (!page.ok) {
        failures.push(`${category.slug}: ${page.error}`);
        continue;
      }

      const parsed = this.parse(page.html, { ...category, url: englishUrl(category) });
      if (parsed.length === 0) {
        failures.push(`${category.slug}: no parseable products`);
        continue;
      }

      for (const result of parsed) {
        const key = `${result.productId}:${result.location}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(result);
        }
      }
    }

    if (results.length > 0) {
      this.warnings = failures;
      return results;
    }

    // Cloudflare often blocks app.vmiss.com from the worker IP. Fall back to the
    // published WHMCS PID catalog so the site still has orderable plans/PIDs.
    // Treat catalog rows as in-stock for display/order; live stock resumes when scrape works.
    const catalog = this.parseCatalog();
    this.warnings = [
      `live scrape blocked; using published PID catalog (${catalog.length} plans)`,
      ...direct.failures.slice(0, 2),
      ...failures.slice(0, 2),
    ];
    return catalog;
  }

  /** Build StockResult rows from the published PID catalog. */
  parseCatalog(): StockResult[] {
    return VMISS_CATALOG.map((plan) => ({
      provider: this.slug,
      productId: `vmiss-${plan.pid}`,
      planName: plan.planName,
      location: plan.location,
      category: 'vps' as const,
      cpu: `${plan.cpuCores} Core${plan.cpuCores === 1 ? '' : 's'}`,
      ramMb: plan.ramMb,
      storageGb: plan.storageGb,
      storageType: 'SSD',
      bandwidthTb: plan.bandwidthTb,
      ipv4: true,
      ipv6: false,
      price: plan.priceCents,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      inStock: true,
      orderUrl: orderUrlForPid(plan.pid),
      displaySpecs: {
        port: `${plan.portMbps}Mbps`,
      },
      raw: { source: 'published-catalog', pid: plan.pid },
    }));
  }

  private async checkDirect(): Promise<{ results: StockResult[]; failures: string[] }> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];

    for (const category of CATEGORIES) {
      try {
        const url = englishUrl(category);
        const html = await this.fetchHtml(this.name, url);
        const parsed = this.parse(html, { ...category, url });
        if (parsed.length === 0) throw new Error('no parseable products');

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

    return { results, failures };
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
