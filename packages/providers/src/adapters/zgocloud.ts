import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const PORTAL = 'https://clients.zgovps.com';
const CATALOG_URL = `${PORTAL}/?action=add&cmd=cart&id=114`;

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

function locationFrom(planName: string): string {
  if (/hong\s*kong/i.test(planName)) return 'Hong Kong';
  if (/tokyo/i.test(planName)) return 'Tokyo';
  if (/osaka/i.test(planName)) return 'Osaka';
  if (/los\s*angeles/i.test(planName)) return 'Los Angeles';
  if (/falkenstein|frankfurt|\bDE\b/i.test(planName)) return 'Frankfurt';
  return 'Unknown';
}

export class ZgoCloudAdapter implements ProviderAdapter {
  readonly slug = 'zgocloud';
  readonly name = 'ZgoCloud';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, CATALOG_URL);
    const results = this.parse(html);
    if (results.length === 0) throw new Error('ZgoCloud returned no parseable VPS products');
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('form.bordered-section').each((_, element) => {
      const card = $(element);
      const numericId = card.find('input[name="id"]').attr('value')?.trim();
      const planName = card.find('strong').first().text().replace(/\s+/g, ' ').trim();
      if (!numericId || !/^\d+$/.test(numericId) || !/\bVPS\b/i.test(planName)) return;

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
        location: locationFrom(planName),
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
