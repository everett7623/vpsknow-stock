import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://portal.saltyfish.io';
const CATEGORIES: readonly Category[] = [
  { slug: 'fra-premium', location: 'Frankfurt', url: `${PORTAL}/index.php?rp=/store/fra-premium` },
  { slug: 'frankfurt-elite', location: 'Frankfurt', url: `${PORTAL}/index.php?rp=/store/frankfurt-elite` },
  { slug: 'sjc-premium', location: 'San Jose', url: `${PORTAL}/index.php?rp=/store/sjc-premium` },
  { slug: 'sjc-elite', location: 'San Jose', url: `${PORTAL}/index.php?rp=/store/sjc-elite` },
  { slug: 'sjc-standard', location: 'San Jose', url: `${PORTAL}/index.php?rp=/store/sjc-standard` },
  { slug: 'ams-premium', location: 'Amsterdam', url: `${PORTAL}/index.php?rp=/store/ams-premium` },
] as const;

type FetchHtml = (url: string) => Promise<string>;
type FetchBrowserPages = (
  provider: string,
  urls: readonly string[],
  readySelector: string,
) => Promise<BrowserPageResult[]>;

async function fetchDirectHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function billingCycle(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi-annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class SaltyFishAdapter implements ProviderAdapter {
  readonly slug = 'saltyfish';
  readonly name = 'SaltyFish';
  warnings: readonly string[] = [];

  constructor(
    private readonly fetchHtml: FetchHtml = fetchDirectHtml,
    private readonly fetchBrowserPages: FetchBrowserPages = fetchProviderPagesWithBrowser,
  ) {}

  async check(): Promise<StockResult[]> {
    this.warnings = [];

    try {
      const results: StockResult[] = [];
      const seen = new Set<string>();

      for (const category of CATEGORIES) {
        const html = await this.fetchHtml(category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error(`${category.slug}: no parseable products`);

        for (const result of parsed) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      }

      if (results.length === 0) throw new Error('no parseable products');
      return results;
    } catch (directError) {
      const pages = await this.fetchBrowserPages(
        this.name,
        CATEGORIES.map((category) => category.url),
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

        const parsed = this.parse(page.html, category);
        if (parsed.length === 0) {
          failures.push(`${category.slug}: no parseable products`);
          continue;
        }

        for (const result of parsed) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      }

      if (results.length === 0) {
        const directMessage = directError instanceof Error
          ? directError.message
          : String(directError);
        throw new Error(
          `SaltyFish returned no parseable products; direct HTTP: ${directMessage}; `
          + `browser: ${failures.slice(0, 3).join('; ') || 'no successful categories'}`,
        );
      }

      this.warnings = failures;
      return results;
    }
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
      const trafficGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+Traffic/i);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)x?\s*vCores?/i));

      results.push({
        provider: this.slug,
        productId: `saltyfish-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCore${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : /\bSSD\b/i.test(description) ? 'SSD' : 'HDD',
        bandwidthTb: Math.round((trafficGb / 1000) * 1000) / 1000,
        ipv4: true,
        ipv6: false,
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bEUR\b/i.test(priceText) ? 'EUR' : 'USD',
        billingCycle: billingCycle(pricing),
        inStock,
        orderUrl: inStock ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
