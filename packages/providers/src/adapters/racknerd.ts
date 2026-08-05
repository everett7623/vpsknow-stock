import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
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
    slug: 'kvm-vps',
    location: 'Multiple Locations',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/kvm-vps`,
  },
  {
    slug: 'windows-vps-with-nvme-ssd',
    location: 'Multiple Locations',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/windows-vps-with-nvme-ssd`,
  },
  {
    slug: 'amd-ryzen-vps-linux',
    location: 'Multiple Locations',
    category: 'vps',
    url: `${PORTAL}/index.php?rp=/store/amd-ryzen-vps-linux`,
  },
  {
    slug: 'hybrid-dedicated-servers',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/hybrid-dedicated-servers`,
  },
  {
    slug: 'dedicated-servers',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/dedicated-servers`,
  },
  {
    slug: 'high-bandwidth-unmetered-dedicated-servers',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/high-bandwidth-unmetered-dedicated-servers`,
  },
  {
    slug: 'amd-ryzenepyc-dedicated-servers',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/amd-ryzenepyc-dedicated-servers`,
  },
  {
    slug: 'seo-dedicated-servers',
    location: 'Multiple Locations',
    category: 'dedicated',
    url: `${PORTAL}/index.php?rp=/store/seo-dedicated-servers`,
  },
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
        if (/cf-chl-|captcha|just a moment/i.test(html)) {
          throw new Error(`${category.slug}: challenge page`);
        }

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

      for (const [index, category] of CATEGORIES.entries()) {
        const page = pages[index];
        if (!page) {
          failures.push(`${category.slug}: browser returned no result`);
          continue;
        }
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
          `RackNerd returned no parseable products; direct HTTP: ${directMessage}; `
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
