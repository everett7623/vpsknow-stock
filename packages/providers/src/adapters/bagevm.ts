import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://www.bagevm.com';
const CATEGORIES: readonly Category[] = [
  { slug: 'los-angeles-servers', location: 'Los Angeles', url: `${PORTAL}/index.php?language=english&rp=/store/los-angeles-servers` },
  { slug: 'los-angeles2-servers', location: 'Los Angeles', url: `${PORTAL}/index.php?language=english&rp=/store/los-angeles2-servers` },
  { slug: 'salt-lake-city-servers', location: 'Salt Lake City', url: `${PORTAL}/index.php?language=english&rp=/store/salt-lake-city-servers` },
  { slug: 'hong-kong-servers', location: 'Hong Kong', url: `${PORTAL}/index.php?language=english&rp=/store/hong-kong-servers` },
  { slug: 'hong-kong-lite-servers', location: 'Hong Kong', url: `${PORTAL}/index.php?language=english&rp=/store/hong-kong-lite-servers` },
  { slug: 'singapore-servers', location: 'Singapore', url: `${PORTAL}/index.php?language=english&rp=/store/singapore-servers` },
  { slug: 'singapore-standard-servers', location: 'Singapore', url: `${PORTAL}/index.php?language=english&rp=/store/singapore-standard-servers` },
  { slug: 'japan-servers', location: 'Tokyo', url: `${PORTAL}/index.php?language=english&rp=/store/japan-servers` },
  { slug: 'japan-standard-servers', location: 'Tokyo', url: `${PORTAL}/index.php?language=english&rp=/store/japan-standard-servers` },
  { slug: 'united-kingdom-servers', location: 'London', url: `${PORTAL}/index.php?language=english&rp=/store/united-kingdom-servers` },
  { slug: 'germany-servers', location: 'Germany', url: `${PORTAL}/index.php?language=english&rp=/store/germany-servers` },
  { slug: 'tw-hinet-vds', location: 'Taiwan', url: `${PORTAL}/index.php?language=english&rp=/store/tw-hinet-vds` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:RAM|Memory)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'GB' ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|Local\s+Disk|Disk)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:Transfer|Traffic)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase() === 'GB' ? value / 1024 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function currencyFrom(text: string): string {
  if (/\bCAD\b/i.test(text)) return 'CAD';
  if (/\bEUR\b/i.test(text)) return 'EUR';
  if (/\bCNY\b/i.test(text)) return 'CNY';
  return 'USD';
}

export class BageVMAdapter implements ProviderAdapter {
  readonly slug = 'bagevm';
  readonly name = 'BageVM';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await fetchProviderHtml(this.name, category.url);
        const parsed = this.parse(html, category);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulCategories++;

        for (const result of parsed) {
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

    if (successfulCategories === 0 || results.length === 0) {
      throw new Error(
        `BageVM returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.proprice[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const nameElement = card.find('[id$="-name"]').first().clone();
      nameElement.find('.badge').remove();
      const planName = nameElement.text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const cardText = card.text().replace(/\s+/g, ' ').trim();
      const description = card.find('[id$="-description"]').first().text().replace(/\s+/g, ' ').trim();
      const quantityMatch = card.find('.badge').first().text().match(/(\d+)\s+Available/i);
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const inStock = quantityMatch
        ? Number.parseInt(quantityMatch[1]!, 10) > 0
        : Boolean(orderHref) && !orderButton.hasClass('disabled') && !/out\s*of\s*stock/i.test(cardText);

      const pricing = card.find('.product-pricing').first().text().replace(/\s+/g, ' ').trim();
      const priceText = card.find('.product-pricing .price').first().text().trim() || pricing;
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)\s*(?:vCPU|CPU\s*Cores?|Cores?)/i));
      const storageType = /\bNVMe\b/i.test(description)
        ? 'NVMe'
        : /\bHDD\b/i.test(description)
          ? 'HDD'
          : 'SSD';

      results.push({
        provider: this.slug,
        productId: `bagevm-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType,
        bandwidthTb: bandwidthInTb(description),
        ipv4: /\bIPv4\b/i.test(description),
        ipv6: /\bIPv6\b/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: currencyFrom(pricing),
        billingCycle: billingCycleFrom(pricing),
        inStock,
        orderUrl: inStock && orderHref ? new URL(orderHref, PORTAL).href : category.url,
      });
    });

    return results;
  }
}
