import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

const PRODUCTS_URL = 'https://spartanhost.org/vps';

function parseNumber(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function normalizeLocation(value: string): string | undefined {
  const location = value.toLowerCase();
  if (location.includes('seattle')) return 'Seattle';
  if (location.includes('dallas')) return 'Dallas';
  if (location.includes('ashburn')) return 'Ashburn';
  return undefined;
}

function productSlug(href: string, family: string, ramMb: number, location: string): string {
  const urlSlug = href.split('/').filter(Boolean).at(-1);
  if (urlSlug && !urlSlug.includes('.php')) return urlSlug.toLowerCase();
  return `${family}-${ramMb}mb-${location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export class SpartanHostAdapter implements ProviderAdapter {
  readonly slug = 'spartanhost';
  readonly name = 'SpartanHost';

  async check(): Promise<StockResult[]> {
    const response = await fetch(PRODUCTS_URL, {
      headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`SpartanHost HTTP ${response.status}`);
    }

    const html = await response.text();
    if (/cloudflare|attention required|captcha/i.test(html) || !html.includes('plan-box')) {
      throw new Error('SpartanHost returned a challenge or invalid product page');
    }

    return this.parse(html);
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.tab-pane').each((_, tab) => {
      const heading = $(tab).find('section h1').first().text().replace(/\s+/g, ' ').trim();
      const family = /E5 KVM/i.test(heading) ? 'E5 KVM' : 'Premium KVM';

      $(tab).find('.plan-box').each((__, box) => {
        const card = $(box);
        const text = card.text().replace(/\s+/g, ' ').trim();
        const ramMb = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*MB\s+Memory/i));
        if (ramMb === 0) return;

        const price = Math.round(parseNumber(text, /\$\s*(\d+(?:\.\d+)?)/) * 100);
        const storageGb = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*GB\s+(?:NVMe\s+)?Disk/i));
        const bandwidthGb = parseNumber(text, /(\d+(?:\.\d+)?)\s*GB\s+Transfer/i);
        const cpuCores = Math.round(parseNumber(text, /(\d+(?:\.\d+)?)\s*vCore/i));
        const storageType = /\bNVMe\b/i.test(text) ? 'NVMe' : /\bSSD\b/i.test(text) ? 'SSD' : 'HDD';
        const ipv4 = /\bIPv4\b/i.test(text);
        const ipv6 = /\bIPv6\b/i.test(text);

        card.find('a.button').each((___, anchor) => {
          const link = $(anchor);
          const label = link.text().replace(/\s+/g, ' ').trim();
          const location = normalizeLocation(label);
          if (!location) return;

          const href = link.attr('href')?.trim() ?? '';
          const inStock = href.length > 0 && !/out\s*of\s*stock/i.test(label);
          const orderUrl = inStock ? new URL(href, PRODUCTS_URL).href : PRODUCTS_URL;

          results.push({
            provider: this.slug,
            productId: `spartan-${productSlug(href, family, ramMb, location)}`,
            planName: `${family} ${ramMb}MB`,
            location,
            category: 'vps',
            cpu: cpuCores > 0 ? `${cpuCores} vCore${cpuCores === 1 ? '' : 's'}` : 'Unknown',
            ramMb,
            storageGb,
            storageType,
            bandwidthTb: Math.round((bandwidthGb / 1000) * 1000) / 1000,
            ipv4,
            ipv6,
            price,
            currency: 'USD',
            billingCycle: 'monthly',
            inStock,
            orderUrl,
          });
        });
      });
    });

    if (results.length === 0) {
      throw new Error('SpartanHost product page contained no parseable plans');
    }

    return results;
  }
}
