import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
import { fetchProviderHtml, resolveProviderProxyUrl } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';
import { VMISS_CATALOG, type VmissCatalogPlan } from './vmiss-catalog.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

interface WatchedPid {
  pid: string;
  planName: string;
  location: string;
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

/**
 * High-signal WHMCS PIDs polled via cart.php when category pages are CF-blocked.
 * Prefer Basic (+ Core for popular LA CN routes) — these restock most often.
 */
const HIGH_SIGNAL_PLAN_RE =
  /^(?:US\.LA\.(?:9929|CMIN2|CN2|TRI)\.(?:Basic|Core)|CN\.HK\.(?:BGP|BGP-V2|INTL)\.Basic|JP\.(?:TKY|OSA)\.(?:IIJ|BGP|TRI)\.Basic|KR\.SEL\.BGP\.Basic)$/i;

function buildWatchedPids(catalog: readonly VmissCatalogPlan[]): readonly WatchedPid[] {
  return catalog
    .filter((plan) => HIGH_SIGNAL_PLAN_RE.test(plan.planName))
    .map((plan) => ({
      pid: plan.pid,
      planName: plan.planName,
      location: plan.location,
    }));
}

const WATCHED_PIDS: readonly WatchedPid[] = buildWatchedPids(VMISS_CATALOG);

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

function catalogPlanByPid(pid: string): VmissCatalogPlan | undefined {
  return VMISS_CATALOG.find((plan) => plan.pid === pid);
}

function stockResultFromCatalog(
  plan: VmissCatalogPlan,
  overrides: Partial<StockResult> & { inStock: boolean; raw?: StockResult['raw'] },
): StockResult {
  return {
    provider: 'vmiss',
    productId: `vmiss-${plan.pid}`,
    planName: plan.planName,
    location: plan.location,
    category: 'vps',
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
    orderUrl: orderUrlForPid(plan.pid),
    displaySpecs: {
      port: `${plan.portMbps}Mbps`,
    },
    ...overrides,
  };
}

export class VmissAdapter implements ProviderAdapter {
  readonly slug = 'vmiss';
  readonly name = 'VMISS';
  warnings: readonly string[] = [];

  constructor(
    private readonly fetchHtml: FetchHtml = (provider, url) =>
      fetchProviderHtml(provider, url, { proxyUrl: resolveProviderProxyUrl(provider) }),
    private readonly fetchBrowserPages: FetchBrowserPages = fetchProviderPagesWithBrowser,
  ) {}

  /** Exposed for tests — high-signal PID watch list. */
  static watchedPids(): readonly WatchedPid[] {
    return WATCHED_PIDS;
  }

  async check(): Promise<StockResult[]> {
    this.warnings = [];
    const proxyConfigured = Boolean(resolveProviderProxyUrl(this.name));

    const direct = await this.checkDirect();
    if (direct.results.length > 0) {
      const watched = await this.checkWatchedPids(new Set(direct.results.map((item) => item.productId)));
      this.warnings = [...direct.failures, ...watched.failures];
      return this.mergeLiveResults(direct.results, watched.results);
    }

    const pages = await this.fetchBrowserPages(
      this.name,
      CATEGORIES.map(englishUrl),
      '.product',
    );
    const browserResults: StockResult[] = [];
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
          browserResults.push(result);
        }
      }
    }

    if (browserResults.length > 0) {
      const watched = await this.checkWatchedPids(
        new Set(browserResults.map((item) => item.productId)),
      );
      this.warnings = [...failures, ...watched.failures];
      return this.mergeLiveResults(browserResults, watched.results);
    }

    // Category pages blocked — poll high-signal cart PIDs for live stock, then
    // fill remaining rows from the published catalog (no stock claims).
    const watched = await this.checkWatchedPids(new Set());
    const catalog = this.parseCatalog().filter(
      (item) => !watched.results.some((live) => live.productId === item.productId),
    );

    const proxyHint = proxyConfigured
      ? 'VMISS_PROXY_URL/PROVIDER_PROXY_URL is set'
      : 'no VMISS_PROXY_URL/PROVIDER_PROXY_URL configured — residential egress may be required';

    this.warnings = [
      `live category scrape blocked; PID watch returned ${watched.results.length}/${WATCHED_PIDS.length} live results (${proxyHint})`,
      catalog.length > 0
        ? `using published PID catalog without stock claims for ${catalog.length} remaining plans`
        : 'published PID catalog unused (all watched PIDs returned live)',
      ...direct.failures.slice(0, 2),
      ...failures.slice(0, 2),
      ...watched.failures.slice(0, 4),
    ];

    return [...watched.results, ...catalog];
  }

  /** Build StockResult rows from the published PID catalog (stock unknown). */
  parseCatalog(): StockResult[] {
    return VMISS_CATALOG.map((plan) =>
      stockResultFromCatalog(plan, {
        inStock: false,
        raw: { source: 'published-catalog', pid: plan.pid },
      }),
    );
  }

  private mergeLiveResults(primary: StockResult[], watched: StockResult[]): StockResult[] {
    const seen = new Set(primary.map((item) => item.productId));
    const merged = [...primary];
    for (const result of watched) {
      if (seen.has(result.productId)) continue;
      seen.add(result.productId);
      merged.push(result);
    }
    return merged;
  }

  private async checkWatchedPids(
    alreadySeen: ReadonlySet<string>,
  ): Promise<{ results: StockResult[]; failures: string[] }> {
    const results: StockResult[] = [];
    const failures: string[] = [];

    for (const watched of WATCHED_PIDS) {
      const productId = `vmiss-${watched.pid}`;
      if (alreadySeen.has(productId)) continue;

      try {
        const html = await this.fetchHtml(this.name, orderUrlForPid(watched.pid));
        const result = this.parseProductPage(html, watched);
        if (!result) {
          failures.push(`pid=${watched.pid}: unparseable`);
          continue;
        }
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`pid=${watched.pid}: ${message}`);
      }
    }

    return { results, failures };
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

  /**
   * Parse a WHMCS cart.php?a=add&pid=N product page for live stock.
   * Specs fall back to the published catalog so OOS stubs do not wipe metadata.
   */
  parseProductPage(html: string, watched: WatchedPid): StockResult | null {
    if (isChallengePage(html)) return null;

    const $ = cheerio.load(html);
    const text = $.root().text().replace(/\s+/g, ' ').trim();
    const unavailable = /\.errorbox[\s\S]*?Out of Stock|Out of Stock/i.test(html)
      || /out of stock|sold out|unavailable/i.test(text)
      || /product is unavailable/i.test(text);
    const canOrder = $('input[type="submit"][value*="Add to Cart" i]').length > 0
      || $('button[type="submit"]').filter((_, el) => /add to cart/i.test($(el).text())).length > 0
      || (/Billing Cycle/i.test(text) && /\$\s*\d+/i.test(text) && !unavailable);

    const catalog = catalogPlanByPid(watched.pid);
    if (!catalog && unavailable && !canOrder) {
      // Still emit an OOS signal with watched metadata when cart confirms unavailability.
      return {
        provider: this.slug,
        productId: `vmiss-${watched.pid}`,
        planName: watched.planName,
        location: watched.location,
        category: 'vps',
        cpu: 'Unknown',
        ramMb: 0,
        storageGb: 0,
        storageType: 'Unknown',
        bandwidthTb: 0,
        ipv4: true,
        ipv6: false,
        price: 0,
        currency: 'CAD',
        billingCycle: 'monthly',
        inStock: false,
        orderUrl: orderUrlForPid(watched.pid),
        raw: { source: 'pid-watch', pid: watched.pid },
      };
    }

    if (!catalog) return null;

    // Ambiguous challenge-like / empty cart pages without a clear stock signal.
    if (!unavailable && !canOrder && !/\$\s*\d+/i.test(text) && text.length < 80) {
      return null;
    }

    const inStock = !unavailable && canOrder;
    return stockResultFromCatalog(catalog, {
      inStock,
      // Live PID watch — stock-engine may fire transitions.
      raw: { source: 'pid-watch', pid: watched.pid },
      orderUrl: orderUrlForPid(watched.pid),
    });
  }
}

function isChallengePage(html: string): boolean {
  return /<title>\s*(?:just a moment|attention required)|id=["']challenge-form["']|cf-browser-verification/i.test(html);
}
