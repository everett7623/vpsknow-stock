import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}
const PORTAL = 'https://bestvm.cloud';
const CATEGORIES: readonly Category[] = [
  { slug: 'de-pro', location: 'Germany', url: `${PORTAL}/store/de-pro` },
  { slug: 'us1', location: 'United States', url: `${PORTAL}/store/us1` },
  { slug: 'jpbgp', location: 'Tokyo', url: `${PORTAL}/store/jpbgp` },
  { slug: 'jp-b', location: 'Tokyo', url: `${PORTAL}/store/jp-b` },
  { slug: 'standard', location: 'Hong Kong', url: `${PORTAL}/store/standard` },
  { slug: 'hkbgp-a', location: 'Hong Kong', url: `${PORTAL}/store/hkbgp-a` },
  { slug: 'hgc1', location: 'Hong Kong', url: `${PORTAL}/store/hgc1` },
  { slug: 'twbgp', location: 'Taiwan', url: `${PORTAL}/store/twbgp` },
  { slug: 'hkbgp-lite', location: 'Hong Kong', url: `${PORTAL}/store/hkbgp-lite` },
  { slug: 'sgbgp-lite', location: 'Singapore', url: `${PORTAL}/store/sgbgp-lite` },
  { slug: 'jpbgp-lite', location: 'Tokyo', url: `${PORTAL}/store/jpbgp-lite` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.replace(/,/g, '').match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/内存\s*[：:]\s*(\d+(?:\.\d+)?)\s*(MB|M|GB|G|TB|T)\b/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  if (unit === 'TB' || unit === 'T') return Math.round(value * 1024 * 1024);
  if (unit === 'GB' || unit === 'G') return Math.round(value * 1024);
  return Math.round(value);
}

function parseStorage(text: string): { sizeGb: number; type: string } {
  const match = text.match(
    /硬盘\s*[：:]\s*(\d+(?:\.\d+)?)\s*(GB|G|TB|T)(?:\s*[（(]\s*(NVMe|SSD|HDD)\s*[）)])?/i,
  );
  if (!match) return { sizeGb: 0, type: 'Unknown' };
  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  const type = match[3]?.toUpperCase() === 'NVME' ? 'NVMe' : (match[3]?.toUpperCase() ?? 'Unknown');
  return {
    sizeGb: Math.round(unit === 'TB' || unit === 'T' ? value * 1024 : value),
    type,
  };
}

function bandwidthInTb(text: string): number {
  const match = text.match(/流量\s*[：:]\s*(\d+(?:\.\d+)?)\s*(GB|G|TB|T)\b/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  return unit === 'GB' || unit === 'G' ? value / 1024 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/按季|quarterly/i.test(text)) return 'quarterly';
  if (/半年|semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/按年|annually|yearly/i.test(text)) return 'annually';
  if (/两年|biennially/i.test(text)) return 'biennially';
  if (/三年|triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

export class BestVMAdapter implements ProviderAdapter {
  readonly slug = 'bestvm';
  readonly name = 'BestVM';
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
        successfulCategories++;

        for (const result of parsed) {
          if (seen.has(result.productId)) continue;
          seen.add(result.productId);
          results.push(result);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${category.slug}: ${message}`);
      }
    }

    if (successfulCategories === 0 || results.length === 0) {
      throw new Error(
        `BestVM returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const description = card.find('.product-desc').text().replace(/\s+/g, ' ').trim();
      const cardText = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantityMatch = cardText.match(/(\d+)\s*可用/i);
      const quantity = quantityMatch ? Number.parseInt(quantityMatch[1]!, 10) : null;
      const unavailable =
        /缺货|售罄|out\s*of\s*stock|sold\s*out|unavailable/i.test(cardText) ||
        orderButton.hasClass('disabled') ||
        quantity === 0;
      const pricing = card.find('.product-pricing').text().replace(/\s+/g, ' ').trim();
      const storage = parseStorage(description);
      const cores = Math.round(numberFrom(description, /CPU\s*[：:]\s*(\d+(?:\.\d+)?)\s*核/i));

      results.push({
        provider: this.slug,
        productId: `bestvm-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: storage.sizeGb,
        storageType: storage.type,
        bandwidthTb: bandwidthInTb(description),
        ipv4: /IPv4\s*[：:]\s*[1-9]\d*/i.test(description),
        ipv6: /IPv6\s*[：:]\s*[1-9]\d*/i.test(description),
        price: Math.round(numberFrom(pricing, /[¥￥]\s*(\d+(?:\.\d+)?)/) * 100),
        currency: /\bUSD\b/i.test(pricing) ? 'USD' : 'CNY',
        billingCycle: billingCycleFrom(pricing),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        raw: quantity === null ? undefined : { available: quantity },
      });
    });

    return results;
  }
}
