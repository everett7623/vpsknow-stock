import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface ProductGroup {
  gid: number;
  label: string;
  location: string;
  category: 'vps' | 'storage';
}

/**
 * FranTech/BuyVM WHMCS group IDs aligned with HostMonit + live cart.php?gid=…
 * (legacy Slice GIDs 39–42/48–50 no longer map to these catalogs).
 */
const PRODUCT_GROUPS: readonly ProductGroup[] = [
  { gid: 37, label: 'Las Vegas AMD RYZEN KVM', location: 'Las Vegas', category: 'vps' },
  { gid: 38, label: 'New York AMD RYZEN KVM', location: 'New York', category: 'vps' },
  { gid: 39, label: 'Switzerland AMD RYZEN KVM', location: 'Switzerland', category: 'vps' },
  { gid: 48, label: 'Miami AMD RYZEN KVM', location: 'Miami', category: 'vps' },
  { gid: 42, label: 'Las Vegas Block Storage', location: 'Las Vegas', category: 'storage' },
  { gid: 45, label: 'New York Block Storage', location: 'New York', category: 'storage' },
  { gid: 46, label: 'Switzerland Block Storage', location: 'Switzerland', category: 'storage' },
  { gid: 49, label: 'Miami Block Storage', location: 'Miami', category: 'storage' },
] as const;

const PORTAL = 'https://my.frantech.ca';

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:DDR\d+\s+)?(?:RAM|Memory)/i)
    ?? text.match(/\b(\d+(?:\.\d+)?)\s*(MB|GB)\b/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'GB' ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  // Require a storage keyword so RAM lines like "1GB DDR4 RAM" are not mistaken for disk.
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|Storage|Disk|Space)/i,
  );
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  if (/unmetered/i.test(text)) return 0;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:BW|Bandwidth|Transfer)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return match[2]!.toUpperCase() === 'GB' ? value / 1000 : value;
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly|\/\s*yr/i.test(text)) return 'annually';
  return 'monthly';
}

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export class BuyVMAdapter implements ProviderAdapter {
  readonly slug = 'buyvm';
  readonly name = 'BuyVM';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulGroups = 0;
    this.warnings = [];

    for (const group of PRODUCT_GROUPS) {
      try {
        const url = `${PORTAL}/cart.php?gid=${group.gid}`;
        const html = await fetchProviderHtml(this.name, url);
        const parsed = this.parseGroup(html, group.location, group.label, group.category, group.gid);
        if (parsed.length === 0) throw new Error('no parseable products');
        successfulGroups++;

        for (const result of parsed) {
          if (!seen.has(result.productId)) {
            seen.add(result.productId);
            results.push(result);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`gid=${group.gid}: ${message}`);
      }
    }

    if (successfulGroups === 0 || results.length === 0) {
      throw new Error(
        `BuyVM returned no parseable products; ${failures.length}/${PRODUCT_GROUPS.length} groups failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parseGroup(
    html: string,
    location: string,
    groupLabel: string,
    category: 'vps' | 'storage' = groupLabel.toLowerCase().includes('storage') ? 'storage' : 'vps',
    gid: number = PRODUCT_GROUPS[0]!.gid,
  ): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];
    const isStorage = category === 'storage';

    const packages = $('.package[id^="product"]');
    const cards = packages.length > 0
      ? packages
      : $('.product, .product-item');

    cards.each((_, el) => {
      const item = $(el);
      const text = item.text().replace(/\s+/g, ' ').trim();
      const planName = item.find('.package-name, .product-name, .product-title, h3, h4').first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (!planName) return;

      const orderHref = item.find('a[href*="cart.php?a=add"], a[href*="pid="]').first().attr('href')?.trim()
        ?? '';
      const pid = orderHref.match(/[?&]pid=(\d+)/)?.[1]
        ?? item.attr('id')?.match(/^product(\d+)$/)?.[1];
      const quantity = text.match(/(\d+)\s+Available/i);
      const unavailable = /out\s*of\s*stock|sold\s*out/i.test(text)
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0)
        || orderHref.length === 0;

      const features = item.find('.package-content, .package-features, .product-desc').text()
        || text;
      const priceText = item.find('.price, .package-price').first().text().replace(/\s+/g, ' ').trim()
        || text;
      const cores = Math.round(numberFrom(features, /(\d+(?:\.\d+)?)\s*(?:CPU\s+)?Cores?/i));
      const ramMb = capacityInMb(features);
      const storageGb = capacityInGb(features);
      const storageType = /\bNVMe\b/i.test(features)
        ? 'NVMe'
        : /\bHDD\b/i.test(features)
          ? 'HDD'
          : isStorage
            ? 'Storage'
            : 'SSD';

      results.push({
        provider: this.slug,
        productId: pid
          ? `buyvm-${pid}`
          : `buyvm-${slugPart(planName)}-${slugPart(location)}`,
        planName,
        location,
        category: isStorage ? 'storage' : 'vps',
        cpu: cores > 0 ? `${cores} Core${cores === 1 ? '' : 's'}` : isStorage ? '—' : 'Unknown',
        ramMb,
        storageGb,
        storageType,
        bandwidthTb: bandwidthInTb(features),
        ipv4: /\bIPv4\b/i.test(features),
        ipv6: /\bIPv6\b/i.test(features),
        price: Math.round(numberFrom(priceText, /\$\s*(\d+(?:\.\d+)?)/) * 100),
        currency: 'USD',
        billingCycle: billingCycleFrom(priceText),
        inStock: !unavailable,
        orderUrl: orderHref
          ? new URL(orderHref, PORTAL).href
          : `${PORTAL}/cart.php?gid=${gid}`,
      });
    });

    return results;
  }
}
