import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

const PORTAL = 'https://my.speedypage.com';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'singapore',
    location: 'Singapore',
    url: `${PORTAL}/store/virtual-servers-singapore?currency=4`,
  },
  { slug: 'sydney', location: 'Sydney', url: `${PORTAL}/store/virtual-servers-sydney?currency=4` },
  { slug: 'tokyo', location: 'Tokyo', url: `${PORTAL}/store/virtual-servers-tokyo?currency=4` },
  {
    slug: 'los-angeles',
    location: 'Los Angeles',
    url: `${PORTAL}/store/vps-los-angeles-usa?currency=4`,
  },
  { slug: 'ashburn', location: 'Ashburn', url: `${PORTAL}/store/vps-ashburn-usa?currency=4` },
  { slug: 'london', location: 'London', url: `${PORTAL}/store/uk-vps?currency=4` },
  { slug: 'amsterdam', location: 'Amsterdam', url: `${PORTAL}/store/amsterdam-vps?currency=4` },
  { slug: 'stockholm', location: 'Stockholm', url: `${PORTAL}/store/vps-stockholm?currency=4` },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.replace(/,/g, '').match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function parseBillingCycle(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function parseRamMb(text: string): number {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(MB|GB|TB)\s*(?:DDR\d+\s*)?(?:RAM|Memory)/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  if (match[2]!.toUpperCase() === 'TB') return Math.round(amount * 1024 * 1024);
  if (match[2]!.toUpperCase() === 'GB') return Math.round(amount * 1024);
  return Math.round(amount);
}

function parseStorage(text: string): { sizeGb: number; type: string; display?: string } {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:Gen\d+\s*)?(NVMe|SSD|HDD)?\s*(?:Disk\s*Space|Storage)/i,
  );
  if (!match) return { sizeGb: 0, type: 'Unknown' };
  const amount = Number.parseFloat(match[1]!);
  const type = match[3]?.toUpperCase() === 'NVME' ? 'NVMe' : (match[3]?.toUpperCase() ?? 'Unknown');
  return {
    sizeGb: Math.round(match[2]!.toUpperCase() === 'TB' ? amount * 1024 : amount),
    type,
    display: `${match[1]}${match[2]!.toUpperCase()}${type === 'Unknown' ? '' : ` ${type}`}`,
  };
}

function parseBandwidth(text: string): { tb: number; display?: string } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*Bandwidth/i);
  if (!match) return { tb: 0 };
  const amount = Number.parseFloat(match[1]!);
  return {
    tb: match[2]!.toUpperCase() === 'GB' ? amount / 1024 : amount,
    display: `${match[1]}${match[2]!.toUpperCase()}`,
  };
}

export class SpeedyPageAdapter implements ProviderAdapter {
  readonly slug = 'speedypage';
  readonly name = 'SpeedyPage';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const category of CATEGORIES) {
      const html = await fetchProviderHtml(this.name, category.url);
      for (const result of this.parse(html, category)) {
        if (seen.has(result.productId)) continue;
        seen.add(result.productId);
        results.push(result);
      }
    }

    if (results.length === 0) throw new Error('SpeedyPage returned no parseable VPS products');
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.package[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('.package-title').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const description = card.find('.package-content').first().text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const cardText = card.text().replace(/\s+/g, ' ').trim();
      const quantity = cardText.match(/(\d+)\s+Available/i);
      const unavailable =
        /out\s*of\s*stock|sold\s*out/i.test(cardText) ||
        orderButton.hasClass('disabled') ||
        (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const priceText = card.find('.price-amount').first().text().replace(/\s+/g, ' ').trim();
      const cycleText = card.find('.price-cycle').first().text().replace(/\s+/g, ' ').trim();
      const storage = parseStorage(description);
      const bandwidth = parseBandwidth(description);
      const cores = Math.round(
        numberFrom(
          description,
          /(\d+(?:\.\d+)?)\s*(?:AMD®?\s+Ryzen\s+\d+\s*)?(?:CPU\s+Core|vCPU|Cores?)/i,
        ),
      );
      const port = description.match(/(\d+(?:\.\d+)?)\s*(Gbps|Mbps)\s*(?:Network\s+Uplink|Port)/i);

      results.push({
        provider: this.slug,
        productId: `speedypage-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: parseRamMb(description),
        storageGb: storage.sizeGb,
        storageType: storage.type,
        bandwidthTb: bandwidth.tb,
        ipv4: !/IPv4\s*not\s*included/i.test(description),
        ipv6: /\bIPv6\b/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bGBP\b/i.test(priceText) ? 'GBP' : /\bEUR\b/i.test(priceText) ? 'EUR' : 'USD',
        billingCycle: parseBillingCycle(cycleText),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : category.url,
        displaySpecs: {
          storage: storage.display,
          bandwidth: bandwidth.display,
          port: port ? `${port[1]}${port[2]}` : undefined,
        },
      });
    });

    return results;
  }
}
