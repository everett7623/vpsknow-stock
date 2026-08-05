import * as cheerio from 'cheerio';
import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import type { AnyNode } from 'domhandler';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  category: ProductCategory;
  url: string;
}

const BILLING_ORIGIN = 'https://billing.spartanhost.net';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'cmin2-premium-kvm-vps-seattle',
    location: 'Seattle',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/cmin2-premium-kvm-vps-seattle`,
  },
  {
    slug: 'dallas-premium-vps',
    location: 'Dallas',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/dallas-premium-vps`,
  },
  {
    slug: 'ddos-protected-ssd-e5-kvm-vps-dallas',
    location: 'Dallas',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/ddos-protected-ssd-e5-kvm-vps-dallas`,
  },
  {
    slug: 'ddos-protected-ssd-e5-kvm-vps-seattle',
    location: 'Seattle',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/ddos-protected-ssd-e5-kvm-vps-seattle`,
  },
  {
    slug: 'ddos-protected-ssd-premium-kvm-vps-ashburn',
    location: 'Ashburn',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/ddos-protected-ssd-premium-kvm-vps-ashburn`,
  },
  {
    slug: 'ddos-protected-ssd-premium-kvm-vps-seattle',
    location: 'Seattle',
    category: 'vps',
    url: `${BILLING_ORIGIN}/store/ddos-protected-ssd-premium-kvm-vps-seattle`,
  },
  {
    slug: 'storage-kvm-vps-dallas',
    location: 'Dallas',
    category: 'storage',
    url: `${BILLING_ORIGIN}/store/storage-kvm-vps-dallas`,
  },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacity(value: number, unit: string): number {
  if (unit.toUpperCase() === 'TB') return Math.round(value * 1024);
  if (unit.toUpperCase() === 'GB') return Math.round(value);
  return Math.round(value / 1024);
}

function parseRamMb(description: string): number {
  const match = description.match(
    /(\d+(?:\.\d+)?)\s*(MB|GB|TB)\s+(?:DDR\d+\s+)?(?:ECC\s+)?RAM/i,
  );
  if (!match) return 0;

  const value = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  if (unit === 'TB') return Math.round(value * 1024 * 1024);
  if (unit === 'GB') return Math.round(value * 1024);
  return Math.round(value);
}

function parseStorage(description: string): { sizeGb: number; type: string } {
  const match = description.match(
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s+(?:Raid(?:\s+\d+)?\s+)?(NVMe(?:\s+SSD)?|SSD|HDD)\s+Storage/i,
  );
  if (!match) return { sizeGb: 0, type: 'Unknown' };

  return {
    sizeGb: capacity(Number.parseFloat(match[1]!), match[2]!),
    type: /^NVMe/i.test(match[3]!) ? 'NVMe' : match[3]!.toUpperCase(),
  };
}

function parseBillingCycle(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function normalizedSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function leadingCapacity(slug: string): string | null {
  return slug.match(/^(\d+(?:\.\d+)?(?:mb|gb|tb))(?:-|$)/)?.[1] ?? null;
}

function productSlug(planName: string, href: string, numericId: string): string {
  const planSlug = normalizedSlug(planName);

  try {
    const url = new URL(href, BILLING_ORIGIN);
    const orderSlug = normalizedSlug(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
    const planCapacity = leadingCapacity(planSlug);
    const orderCapacity = leadingCapacity(orderSlug);
    if (
      url.origin === BILLING_ORIGIN
      && orderSlug
      && (!planCapacity || !orderCapacity || planCapacity === orderCapacity)
    ) {
      return orderSlug;
    }
  } catch {
    // Fall back to the displayed plan identity below.
  }

  return planSlug || numericId;
}

function productDescription(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): string {
  const container = card.find('.product-desc').first();
  const segments = container
    .contents()
    .map((_, node) => $(node).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);

  return (segments.length > 0 ? segments.join(' ') : container.text())
    .replace(/\s+/g, ' ')
    .trim();
}

export class SpartanHostAdapter implements ProviderAdapter {
  readonly slug = 'spartanhost';
  readonly name = 'SpartanHost';
  warnings: readonly string[] = [];

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();
    const failures: string[] = [];
    let successfulCategories = 0;
    this.warnings = [];

    for (const category of CATEGORIES) {
      try {
        const html = await fetchProviderHtml(
          this.name,
          `${category.url}?language=english`,
        );
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
        `SpartanHost returned no parseable products; ${failures.length}/${CATEGORIES.length} categories failed. `
        + failures.slice(0, 3).join('; '),
      );
    }

    this.warnings = failures;
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('[id$="-name"]').first().text().replace(/\s+/g, ' ').trim();
      const quantityText = card.find('.qty').text().replace(/\s+/g, ' ').trim();
      const quantity = quantityText.match(/(\d+)\s+Available/i);
      const orderHref = card.find('.btn-order-now').attr('href')?.trim() ?? '';
      if (!numericId || !planName || !quantity) return;

      const description = productDescription($, card);
      const pricing = card.find('.product-pricing').text().replace(/\s+/g, ' ').trim();
      const priceText = card.find('.product-pricing .price').first().text() || pricing;
      const storage = parseStorage(description);
      const cpuCores = Math.round(
        numberFrom(description, /(\d+(?:\.\d+)?)\s+CPU\s+vCores?/i),
      );
      const available = Number.parseInt(quantity[1]!, 10);
      const inStock = available > 0;

      results.push({
        provider: this.slug,
        productId: `spartan-${productSlug(planName, orderHref, numericId)}`,
        planName,
        location: category.location,
        category: category.category,
        cpu: cpuCores > 0 ? `${cpuCores} vCore${cpuCores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: parseRamMb(description),
        storageGb: storage.sizeGb,
        storageType: storage.type,
        bandwidthTb: numberFrom(description, /(\d+(?:\.\d+)?)\s*TB\s+bandwidth/i),
        ipv4: /\bIPv4\b/i.test(description),
        ipv6: /\bIPv6\b/i.test(description) && !/\bno\s+IPv6\b/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bEUR\b/i.test(pricing) ? 'EUR' : 'USD',
        billingCycle: parseBillingCycle(pricing),
        inStock,
        orderUrl: inStock
          ? `${BILLING_ORIGIN}/cart.php?a=add&pid=${numericId}`
          : category.url,
        raw: {
          available,
          category: category.slug,
          whmcsPid: numericId,
        },
      });
    });

    return results;
  }
}
