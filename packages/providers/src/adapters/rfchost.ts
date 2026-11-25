import * as cheerio from 'cheerio';
import { detectOptimizedLine, type BillingCycle } from '@vpsknow/shared';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  lineHint?: string;
  url: string;
}

const PORTAL = 'https://my.rfchost.com';

/** Store groups linked from the public marketing site (HK optimized / CMI). */
const CATEGORIES: readonly Category[] = [
  {
    slug: 'hkg1-china-opt',
    location: 'Hong Kong',
    lineHint: 'China Optimization',
    url: `${PORTAL}/index.php?rp=/store/hong-kong-1-china-optimization-network`,
  },
  {
    slug: 'hkg1-premium-cmi',
    location: 'Hong Kong',
    lineHint: 'CMI',
    url: `${PORTAL}/index.php?rp=/store/hong-kong-1-premium-cmi`,
  },
] as const;

type FetchHtml = (provider: string, url: string) => Promise<string>;
type FetchBrowserPages = (
  provider: string,
  urls: readonly string[],
  readySelector: string,
) => Promise<BrowserPageResult[]>;

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

function isChallengeHtml(html: string): boolean {
  return /cf-chl-|captcha|just a moment/i.test(html);
}

export class RfcHostAdapter implements ProviderAdapter {
  readonly slug = 'rfchost';
  readonly name = 'RfcHost';
  warnings?: string[];

  constructor(
    private readonly fetchHtml: FetchHtml = fetchProviderHtml,
    private readonly fetchBrowserPages: FetchBrowserPages = fetchProviderPagesWithBrowser,
  ) {}

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    this.warnings = undefined;

    for (const category of CATEGORIES) {
      try {
        let html: string;
        try {
          html = await this.fetchHtml(this.slug, category.url);
          if (isChallengeHtml(html)) {
            throw new Error('challenge page');
          }
        } catch {
          const browserPages = await this.fetchBrowserPages(
            this.slug,
            [category.url],
            '.product, .products, #products, .product-desc',
          );
          const page = browserPages[0];
          if (!page || !page.ok) {
            throw new Error(page && !page.ok ? page.error : 'browser fetch failed');
          }
          html = page.html;
          if (isChallengeHtml(html)) {
            throw new Error(`RfcHost returned a challenge page for ${category.slug}`);
          }
        }

        for (const result of this.parse(html, category)) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${category.slug}: ${message}`);
      }
    }

    if (results.length === 0) {
      throw new Error(
        failures.length > 0
          ? `RfcHost returned no parseable products (${failures.join('; ')})`
          : 'RfcHost returned no parseable products',
      );
    }

    if (failures.length > 0) {
      this.warnings = failures;
    }

    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/product(\d+)/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().trim()
        || card.find('.product-title, h3, h4').first().text().trim();
      if (!numericId || !planName) return;

      const description = card.find('.product-desc').text().replace(/\s+/g, ' ').trim()
        || card.text().replace(/\s+/g, ' ').trim();
      const quantityText = card.find('.qty').text().trim();
      const quantity = quantityText.match(/(\d+)\s+Available/i);
      const orderHref = card.find('.btn-order-now, a[href*="a=add"]').attr('href')?.trim() ?? '';
      const inStock = quantity
        ? Number.parseInt(quantity[1]!, 10) > 0
        : orderHref.length > 0 && !/out\s*of\s*stock|售罄|缺货/i.test(card.text());

      const pricing = card.find('.product-pricing').text().replace(/\s+/g, ' ').trim();
      const priceText = card.find('.product-pricing .price').first().text()
        || pricing.match(/\$?\s*(\d+(?:\.\d+)?)/)?.[1]
        || '0';
      const ramGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+RAM/i)
        || numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s*内存/i);
      const storageGb = numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe|SSD|HDD)/i);
      const cores = Math.round(
        numberFrom(description, /(\d+(?:\.\d+)?)x?\s*(?:vCPU|vCores?|Cores?|核)/i),
      );
      const bwTb = numberFrom(description, /(\d+(?:\.\d+)?)\s*TB\s+(?:BW|Bandwidth|Transfer|流量)/i)
        || numberFrom(description, /(\d+(?:\.\d+)?)\s*GB\s+(?:BW|Bandwidth|Transfer|流量)/i) / 1024;

      const lineType =
        detectOptimizedLine(`${planName} ${description} ${category.lineHint ?? ''}`)
        ?? category.lineHint
        ?? null;

      const absoluteOrderUrl = orderHref.startsWith('http')
        ? orderHref
        : orderHref
          ? new URL(orderHref, PORTAL).toString()
          : `${PORTAL}/cart.php?a=add&pid=${numericId}`;

      results.push({
        provider: this.slug,
        productId: `rfchost-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : 'SSD',
        bandwidthTb: Number.isFinite(bwTb) ? bwTb : 0,
        ipv4: true,
        ipv6: /ipv6/i.test(description),
        price: Math.round(Number.parseFloat(priceText.replace(/[^0-9.]/g, '')) * 100),
        currency: /€|EUR/i.test(pricing) ? 'EUR' : 'USD',
        billingCycle: parseBillingCycle(pricing),
        inStock,
        orderUrl: absoluteOrderUrl,
        ...(lineType ? { lineType } : {}),
      });
    });

    return results;
  }
}
