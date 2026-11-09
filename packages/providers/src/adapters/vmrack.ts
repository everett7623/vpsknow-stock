import * as cheerio from 'cheerio';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const PRODUCT_URL = 'https://www.vmrack.net/vps';
const PLAN_PATTERN = /\b(?:L\d\.)?B?VPS(?:\.[A-Z0-9]+)+\b/i;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

interface Candidate {
  planName: string;
  text: string;
}

export class VMRackAdapter implements ProviderAdapter {
  readonly slug = 'vmrack';
  readonly name = 'VMRack';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, PRODUCT_URL);
    const results = this.parse(html);
    if (results.length === 0) throw new Error('VMRack returned no parseable featured VPS products');
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const candidates = new Map<string, Candidate>();

    $('div, article, li, tr').each((_, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      const planNames = text.match(new RegExp(PLAN_PATTERN.source, 'gi')) ?? [];
      const uniquePlanNames = [...new Map(planNames.map((name) => [name.toLowerCase(), name])).values()];
      if (uniquePlanNames.length !== 1) return;
      if (!/\$\s*\d+(?:\.\d+)?\s*\/\s*(?:mo|yr|year)/i.test(text)) return;
      if (
        !/\d+(?:\.\d+)?\s*(?:GB|TB)/i.test(text)
        || !/Sold Out|Low Stock|In Stock|Get Started|Buy now|Order|Deploy|Configure/i.test(text)
      ) {
        return;
      }

      const planName = uniquePlanNames[0]!;
      const current = candidates.get(planName);
      if (!current || text.length < current.text.length) {
        candidates.set(planName, { planName, text });
      }
    });

    return [...candidates.values()].map(({ planName, text }) => {
      const ramGb = numberFrom(text, /(\d+(?:\.\d+)?)\s*GB(?:\s+Memory)?/i);
      const storageGb = numberFrom(text, /(\d+(?:\.\d+)?)\s*GB\s*(?:System\s+Disk|Storage)/i);
      const cores = Math.round(numberFrom(text, /(\d+(?:\.\d+)?)\s*vCPU/i));
      const trafficTb = numberFrom(text, /(\d+(?:\.\d+)?)\s*TB\s*\/\s*mo/i);
      const trafficGb = numberFrom(text, /(\d+(?:\.\d+)?)\s*GB\s*\/\s*mo/i);
      const bandwidthTb = trafficTb > 0 ? trafficTb : trafficGb / 1024;
      const soldOut = /Sold Out/i.test(text);
      const yearly = /\$\s*\d+(?:\.\d+)?\s*\/\s*(?:yr|year)/i.test(text)
        && !/\$\s*\d+(?:\.\d+)?\s*\/\s*mo/i.test(text);
      const priceMatch = text.match(
        yearly
          ? /\$\s*(\d+(?:\.\d+)?)\s*\/\s*(?:yr|year)/i
          : /\$\s*(\d+(?:\.\d+)?)\s*\/\s*mo/i,
      );

      return {
        provider: this.slug,
        productId: `vmrack-${planName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        planName,
        location: /Los Angeles/i.test(text) ? 'Los Angeles' : 'Unknown',
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: Math.round(ramGb * 1024),
        storageGb: Math.round(storageGb),
        storageType: /\bNVMe\b/i.test(text)
          ? 'NVMe'
          : /\bHDD\b/i.test(text)
            ? 'HDD'
            : /\bSSD\b/i.test(text)
              ? 'SSD'
              : 'Unknown',
        bandwidthTb,
        ipv4: /\bIPv4\b/i.test(text),
        ipv6: /\bIPv6\b/i.test(text),
        price: Math.round(Number.parseFloat(priceMatch?.[1] ?? '0') * 100),
        currency: 'USD',
        billingCycle: yearly ? 'annually' as const : 'monthly' as const,
        inStock: !soldOut && /Low Stock|In Stock|Get Started|Buy now|Order|Deploy|Configure/i.test(text),
        orderUrl: PRODUCT_URL,
      };
    });
  }
}
