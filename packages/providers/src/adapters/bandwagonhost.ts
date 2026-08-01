import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const CART_URL = 'https://bandwagonhost.com/cart.php';

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function billingCycleFrom(value: string): BillingCycle {
  if (/semi[- ]?annually/i.test(value)) return 'semi-annually';
  if (/quarter/i.test(value)) return 'quarterly';
  if (/bienn/i.test(value)) return 'biennially';
  if (/trienn/i.test(value)) return 'triennially';
  if (/annual|year|\byr\b/i.test(value)) return 'annually';
  return 'monthly';
}

function priceFrom(text: string): { billingCycle: BillingCycle; price: number } {
  const match = text.match(
    /\$\s*(\d+(?:\.\d+)?)\s*(?:USD)?\s*(?:\/\s*)?(Monthly|Quarterly|Semi[- ]?Annually|Annually|Biennially|Triennially|mo|yr|year|month)/i,
  );
  return {
    billingCycle: billingCycleFrom(match?.[2] ?? 'monthly'),
    price: match ? Math.round(Number.parseFloat(match[1]!) * 100) : 0,
  };
}

function memoryInMb(text: string): number {
  const match = text.match(/RAM\s*:?\s*(\d+(?:\.\d+)?)\s*(GB|MB)/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)\s*RAM/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  return Math.round(amount * (match[2]!.toUpperCase() === 'GB' ? 1_024 : 1));
}

function storageInGb(text: string): number {
  const match = text.match(/(?:NVMe|SSD|HDD)\s*:?\s*(\d+(?:\.\d+)?)\s*(GB|TB)/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:NVMe|SSD|HDD|RAID|Storage)/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  return Math.round(amount * (match[2]!.toUpperCase() === 'TB' ? 1_000 : 1));
}

function cpuFrom(text: string): string {
  const match = text.match(/CPU\s*:?\s*(\d+)\s*x?/i)
    ?? text.match(/(\d+)\s*(?:x\s*)?(?:Core|vCPU|CPU)/i);
  return match ? `${match[1]} Core` : 'Unknown';
}

function bandwidthInTb(text: string): number {
  const match = text.match(/(?:Transfer|Bandwidth|BW)\s*:?\s*(\d+(?:\.\d+)?)\s*(TB|GB)/i)
    ?? text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:BW|Bandwidth|Transfer)/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  return amount * (match[2]!.toUpperCase() === 'GB' ? 0.001 : 1);
}

function orderUrlFrom(card: cheerio.Cheerio<AnyNode>): string | null {
  const control = card.find(
    'a[href*="cart"], a[href*="order"], input[value*="Order"], button:contains("Order")',
  ).first();
  const href = control.attr('href');
  if (href) return new URL(href, CART_URL).href;

  const attributes = control.get(0)?.attribs ?? {};
  const attributeText = Object.values(attributes).join(' ');
  const path = attributeText.match(/(?:https?:\/\/[^'"\s]+|\/?cart\.php\?[^'"\s]+)/i)?.[0];
  if (path) return new URL(path.replaceAll('&amp;', '&'), CART_URL).href;

  const form = control.closest('form');
  const pid = form.find('input[name="pid"]').attr('value')
    ?? attributeText.match(/[?&]pid=(\d+)/)?.[1];
  return pid ? new URL(`/cart.php?a=add&pid=${pid}`, CART_URL).href : null;
}

function productIdFor(planName: string, text: string, orderUrl: string | null, location: string): string {
  const combined = `${planName} ${text}`;
  if (/\bTHE PLAN\b/i.test(combined) && /DC6/i.test(combined)) return 'bwg-the-plan-dc6';
  if (/\b20G KVM\b.*CN2\s*GIA-?E/i.test(planName)) return 'bwg-20g-kvm-dc6';
  if (/\b40G KVM\b.*CN2\s*GIA-?E/i.test(planName)) return 'bwg-40g-kvm-dc6';
  if (/HK\s*85\s*PCCW|85.*Hong Kong.*PCCW/i.test(combined)) return 'bwg-hk-pccw';
  if (/\b40G KVM\b/i.test(planName) && /HONG KONG.*CN2 GIA/i.test(combined)) return 'bwg-hk-cn2gia';
  if (/\b40G KVM\b/i.test(planName) && /TOKYO.*CN2 GIA/i.test(combined)) return 'bwg-jp-cn2gia';

  const pid = orderUrl ? new URL(orderUrl).searchParams.get('pid') : null;
  return pid ? `bwg-${pid}` : `bwg-${slugPart(planName)}-${slugPart(location)}`;
}

export class BandwagonHostAdapter implements ProviderAdapter {
  readonly slug = 'bandwagonhost';
  readonly name = 'BandwagonHost';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, CART_URL);
    const results = this.parse(html);
    if (results.length === 0) throw new Error('BandwagonHost returned no parseable products');
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];
    const seen = new Set<string>();

    $('.product, table tbody tr, .plan-row, .product-row').each((_, element) => {
      const card = $(element);
      const text = card.text().replace(/\s+/g, ' ').trim();
      const planName = card.find(
        '.plan-name, .product-name, [id$="-name"], header span, header, h3, h4, td:first-child strong, td:first-child b',
      ).first().text().replace(/\s+/g, ' ').trim()
        || card.find('td:first-child').first().text().replace(/\s+/g, ' ').trim();
      if (!planName || /^(Plan|Product\/Service)$/i.test(planName)) return;

      const ramMb = memoryInMb(text);
      const storageGb = storageInGb(text);
      const cpu = cpuFrom(text);
      const pricing = priceFrom(text);
      if (ramMb === 0 || storageGb === 0 || cpu === 'Unknown' || pricing.price === 0) return;

      const explicitOutOfStock = /out of stock|sold out|unavailable/i.test(text);
      const orderUrl = orderUrlFrom(card);
      const inStock = !explicitOutOfStock && orderUrl !== null;
      const location = this.detectLocation(text);
      const productId = productIdFor(planName, text, orderUrl, location);
      if (seen.has(productId)) return;
      seen.add(productId);

      results.push({
        provider: this.slug,
        productId,
        planName,
        location,
        category: 'vps',
        cpu,
        ramMb,
        storageGb,
        storageType: /NVMe/i.test(text) ? 'NVMe' : /SSD/i.test(text) ? 'SSD' : 'HDD',
        bandwidthTb: bandwidthInTb(text),
        ipv4: true,
        ipv6: /IPv6/i.test(text),
        price: pricing.price,
        currency: 'USD',
        billingCycle: pricing.billingCycle,
        inStock,
        orderUrl: orderUrl ?? CART_URL,
      });
    });

    return results;
  }

  private detectLocation(text: string): string {
    const locations: [RegExp, string][] = [
      [/DC6|CN2\s*GIA-E/i, 'DC6 CN2 GIA-E'],
      [/Hong\s*Kong|\bHK\b/i, 'Hong Kong'],
      [/Japan|Tokyo|\bTYO\b/i, 'Tokyo'],
      [/Osaka|\bOSA\b/i, 'Osaka'],
      [/Singapore|\bSG\b/i, 'Singapore'],
      [/DC9/i, 'DC9 CN2 GIA'],
      [/Los\s*Angeles|\bLA\b|\bLAX\b/i, 'Los Angeles'],
      [/New\s*York|\bNY\b|\bNYC\b/i, 'New York'],
      [/Amsterdam|\bAMS\b|\bNL\b/i, 'Amsterdam'],
      [/Vancouver|Canada/i, 'Vancouver'],
    ];

    for (const [pattern, name] of locations) {
      if (pattern.test(text)) return name;
    }
    return 'Multi-DC';
  }
}
