import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const PORTAL = 'https://cloud.colocrossing.com';
const SPECIALS_URL = `${PORTAL}/index.php?language=english&rp=/store/specials`;

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
  const match = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|Disk|Space)/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase() === 'TB' ? value * 1024 : value);
}

function billingCycleFrom(text: string): BillingCycle {
  if (/quarterly/i.test(text)) return 'quarterly';
  if (/semi[- ]?annually/i.test(text)) return 'semi-annually';
  if (/annually|yearly/i.test(text)) return 'annually';
  if (/biennially/i.test(text)) return 'biennially';
  if (/triennially/i.test(text)) return 'triennially';
  return 'monthly';
}

function locationFrom(text: string): string {
  if (/los\s*angeles/i.test(text)) return 'Los Angeles';
  if (/buffalo/i.test(text)) return 'Buffalo';
  if (/chicago/i.test(text)) return 'Chicago';
  if (/dallas/i.test(text)) return 'Dallas';
  if (/seattle/i.test(text)) return 'Seattle';
  if (/new\s*york/i.test(text)) return 'New York';
  return 'United States';
}

export class ColoCrossingAdapter implements ProviderAdapter {
  readonly slug = 'colocrossing';
  readonly name = 'ColoCrossing';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, SPECIALS_URL);
    const results = this.parse(html);
    if (results.length === 0) throw new Error('ColoCrossing returned no parseable special VPS products');
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.package[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card.find('.package-title').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !planName) return;

      const text = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantity = text.match(/(\d+)\s+Available/i);
      const unavailable = /out\s*of\s*stock|sold\s*out/i.test(text)
        || orderButton.hasClass('disabled')
        || (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const cores = Math.round(numberFrom(text, /(\d+(?:\.\d+)?)\s*vCPU/i));
      const bandwidthTb = numberFrom(text, /(\d+(?:\.\d+)?)\s*TB\s*(?:Bandwidth|Traffic|Transfer)/i);
      const priceText = card.find('.price-amount').first().text().replace(/\s+/g, ' ').trim();
      const cycleText = card.find('.price-cycle').first().text().replace(/\s+/g, ' ').trim();

      results.push({
        provider: this.slug,
        productId: `colocrossing-${numericId}`,
        planName,
        location: locationFrom(text),
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: capacityInMb(text),
        storageGb: capacityInGb(text),
        storageType: /\bNVMe\b/i.test(text) ? 'NVMe' : /\bHDD\b/i.test(text) ? 'HDD' : 'SSD',
        bandwidthTb,
        ipv4: /\bIPv4\b/i.test(text),
        ipv6: /\bIPv6\b/i.test(text),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bCAD\b/i.test(priceText) ? 'CAD' : 'USD',
        billingCycle: billingCycleFrom(cycleText),
        inStock: !unavailable && orderHref.length > 0,
        orderUrl: orderHref ? new URL(orderHref, PORTAL).href : SPECIALS_URL,
      });
    });

    return results;
  }
}
