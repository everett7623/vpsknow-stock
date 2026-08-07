import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  label: string;
  location: string;
  url: string;
}

const PORTAL = 'https://clients.zgovps.com';

/** HostBill cart categories covering specials + regular VPS lines (excludes VDS). */
const CATEGORIES: readonly Category[] = [
  {
    slug: 'special-offer',
    label: 'Special Offer',
    location: 'Multiple Locations',
    url: `${PORTAL}/index.php?/cart/special-offer/`,
  },
  {
    slug: 'hongkong-amd-vps',
    label: 'HongKong AMD VPS',
    location: 'Hong Kong',
    url: `${PORTAL}/index.php?/cart/hongkong-amd-vps/`,
  },
  {
    slug: 'tokyo-intel-vps',
    label: 'Tokyo Intel VPS',
    location: 'Tokyo',
    url: `${PORTAL}/index.php?/cart/tokyo-intel-vps/`,
  },
  {
    slug: 'de-frankfurt-amd-vps',
    label: 'DE Frankfurt AMD VPS',
    location: 'Frankfurt',
    url: `${PORTAL}/index.php?/cart/de-frankfurt-amd-vps/`,
  },
  {
    slug: 'los-angeles-amd-optimised-vps',
    label: 'Los Angeles AMD Optimised VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-amd-optimised-vps/`,
  },
  {
    slug: 'los-angeles-amd-isp-vps',
    label: 'Los Angeles AMD ISP VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-amd-isp-vps/`,
  },
  {
    slug: 'los-angeles-amd-intel-vps',
    label: 'Los Angeles AMD/Intel VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-amd-intel-vps/`,
  },
  {
    slug: 'los-angeles-intel-performance-vps',
    label: 'Los Angeles Intel Performance VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-intel-performance-vps/`,
  },
  {
    slug: 'los-angeles-ryzen9-performance-vps',
    label: 'Los Angeles Ryzen9 Performance VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-ryzen9-performance-vps/`,
  },
  {
    slug: 'los-angeles-global-vps',
    label: 'Los Angeles Global VPS',
    location: 'Los Angeles',
    url: `${PORTAL}/index.php?/cart/los-angeles-global-vps/`,
  },
  {
    slug: 'osaka-amd-performance-vps',
    label: 'Osaka AMD Performance VPS',
    location: 'Osaka',
    url: `${PORTAL}/index.php?/cart/osaka-amd-performance-vps/`,
  },
  {
    slug: 'osaka-amd-ryzen9-performance-vps',
    label: 'Osaka AMD Ryzen9 Performance VPS',
    location: 'Osaka',
    url: `${PORTAL}/index.php?/cart/osaka-amd-ryzen9-performance-vps/`,
  },
  {
    slug: 'falkenstein-intel-vps',
    label: 'Falkenstein Intel VPS',
    location: 'Falkenstein',
    url: `${PORTAL}/index.php?/cart/falkenstein-intel-vps/`,
  },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB)\s*(?:DDR\d(?:\s+ECC)?\s+)?RAM/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'GB' ? value * 1024 : value);
}

function capacityInGb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(G|GB|T|TB)\s*(?:PCIe\s+[\d.]+\s+)?(?:NVMe|SSD|HDD)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(/^T/i.test(match[2]!) ? value * 1024 : value);
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(G|GB|T|TB)\s*\/\s*Month/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return /^G/i.test(match[2]!) ? value / 1000 : value;
}

function billingCycleFrom(text: string, value: string): BillingCycle {
  if (value === 'q' || /quarterly/i.test(text)) return 'quarterly';
  if (value === 's' || /semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (value === 'a' || /annually|yearly/i.test(text)) return 'annually';
  if (value === 'b' || /biennially/i.test(text)) return 'biennially';
  if (value === 't' || /triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function locationFrom(planName: string, fallback: string): string {
  if (/hong\s*kong/i.test(planName)) return 'Hong Kong';
  if (/tokyo/i.test(planName)) return 'Tokyo';
  if (/osaka/i.test(planName)) return 'Osaka';
  if (/los\s*angeles/i.test(planName)) return 'Los Angeles';
  if (/falkenstein/i.test(planName)) return 'Falkenstein';
  if (/frankfurt|\bDE\b/i.test(planName)) return 'Frankfurt';
  return fallback;
}

function normalizePlanName(rawName: string, category: Category): string {
  if (/\bVPS\b/i.test(rawName) || /special/i.test(rawName)) return rawName;
  if (category.slug === 'special-offer') return rawName;
  return `${category.label} - ${rawName}`;
}

export class ZgoCloudAdapter implements ProviderAdapter {
  readonly slug = 'zgocloud';
  readonly name = 'ZgoCloud';
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
        if (parsed.length === 0) throw new Error('no parseable VPS products');
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
        `ZgoCloud returned no parseable VPS products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category?: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];
    const fallbackLocation = category?.location ?? 'Unknown';
    const activeCategory = category ?? {
      slug: 'legacy',
      label: 'ZgoCloud VPS',
      location: fallbackLocation,
      url: `${PORTAL}/index.php?/cart/special-offer/`,
    };

    $('form.bordered-section').each((_, element) => {
      const card = $(element);
      const numericId = card.find('input[name="id"]').attr('value')?.trim();
      const rawName = card.find('strong').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !/^\d+$/.test(numericId) || !rawName) return;
      // Skip VDS SKUs; keep VPS specials and tier cards (Starter/Standard/…).
      if (/\bVDS\b/i.test(rawName)) return;
      if (activeCategory.slug === 'legacy' && !/\bVPS\b/i.test(rawName)) return;

      const planName = normalizePlanName(rawName, activeCategory);
      const description = card.find('.my-3').text().replace(/\s+/g, ' ').trim();
      const text = card.text().replace(/\s+/g, ' ').trim();
      const cycleOptions = card.find('select[name="cycle"] option');
      const explicitlySelected = cycleOptions.filter('[selected]').first();
      const selectedCycle = explicitlySelected.length > 0 ? explicitlySelected : cycleOptions.first();
      const pricing = selectedCycle.text().replace(/\s+/g, ' ').trim();
      const cycleValue = selectedCycle.attr('value')?.trim().toLowerCase() ?? '';
      const orderButton = card.find('button[type="submit"]').first();
      const unavailable = orderButton.hasClass('disabled')
        || orderButton.is('[disabled]')
        || /out\s*of\s*stock|sold\s*out/i.test(text);
      const cores = Math.round(numberFrom(description, /(\d+(?:\.\d+)?)\s*Cores?/i));

      results.push({
        provider: this.slug,
        productId: `zgocloud-${numericId}`,
        planName,
        location: locationFrom(planName, fallbackLocation),
        category: 'vps',
        cpu: cores > 0 ? `${cores} Core${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(description),
        storageGb: capacityInGb(description),
        storageType: /\bNVMe\b/i.test(description) ? 'NVMe' : /\bHDD\b/i.test(description) ? 'HDD' : 'SSD',
        bandwidthTb: bandwidthInTb(description),
        ipv4: /\bIPV?4\b/i.test(description),
        ipv6: /\bIPV?6\b/i.test(description),
        price: Math.round(numberFrom(pricing, /\$\s*(\d+(?:\.\d+)?)/) * 100),
        currency: /\bEUR\b/i.test(pricing) ? 'EUR' : 'USD',
        billingCycle: billingCycleFrom(pricing, cycleValue),
        inStock: !unavailable,
        orderUrl: `${PORTAL}/?action=add&cmd=cart&id=${numericId}`,
      });
    });

    return results;
  }
}
