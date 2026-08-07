import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const CART_URL = 'https://bandwagonhost.com/cart.php';
const OFFICIAL_CART_URLS = [
  CART_URL,
  'https://bwh81.net/cart.php',
] as const;

/**
 * Limited / high-signal PIDs tracked by stock.bwh91.com + HostMonit.
 * Cart scrape alone misses these while OOS (they disappear from cart.php).
 */
const WATCHED_PIDS: readonly {
  pid: number;
  planName: string;
  location: string;
}[] = [
  { pid: 151, planName: 'DC99 Minibox', location: 'DC99' },
  { pid: 152, planName: 'DC99 Biggerbox', location: 'DC99' },
  { pid: 153, planName: 'DC99 Powerbox', location: 'DC99' },
  { pid: 156, planName: 'DC1 Biggerbox Pro', location: 'DC1' },
  { pid: 157, planName: 'DC1 Megabox Pro', location: 'DC1' },
  { pid: 149, planName: 'DC6 THE PLAN', location: 'DC6 CN2 GIA-E' },
  { pid: 145, planName: 'DC9 THE PLAN', location: 'DC9 CN2 GIA' },
  { pid: 158, planName: 'FMT Minichicken', location: 'Fremont' },
  { pid: 159, planName: 'DCNL Netherlands', location: 'Amsterdam' },
  { pid: 163, planName: 'DC39 Tokyo v1', location: 'Tokyo' },
  { pid: 146, planName: 'DC39 Tokyo v2', location: 'Tokyo' },
  { pid: 147, planName: 'Japan Softbank', location: 'Tokyo' },
  { pid: 94, planName: 'Classic Plan V1', location: 'Multi-DC' },
  { pid: 87, planName: 'SPECIAL 20G CN2 GIA ECOMMERCE', location: 'Los Angeles' },
  { pid: 44, planName: '20G KVM PROMO (Basic)', location: 'Multi-DC' },
  { pid: 134, planName: 'Osaka CN2 GIA', location: 'Osaka' },
  { pid: 108, planName: 'Tokyo CN2 GIA', location: 'Tokyo' },
  { pid: 95, planName: 'Hong Kong CN2 GIA', location: 'Hong Kong' },
  { pid: 173, planName: 'Singapore CN2 GIA', location: 'Singapore' },
  { pid: 164, planName: 'Los Angeles SLA CN2 GIA', location: 'Los Angeles' },
] as const;

type FetchHtml = (provider: string, url: string) => Promise<string>;

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

function detectLocation(text: string): string {
  const locations: [RegExp, string][] = [
    [/DC6|CN2\s*GIA-E/i, 'DC6 CN2 GIA-E'],
    [/Hong\s*Kong|\bHK\b/i, 'Hong Kong'],
    [/Japan|Tokyo|\bTYO\b/i, 'Tokyo'],
    [/Osaka|\bOSA\b/i, 'Osaka'],
    [/Singapore|\bSG\b/i, 'Singapore'],
    [/DC9/i, 'DC9 CN2 GIA'],
    [/DC99/i, 'DC99'],
    [/Fremont|\bFMT\b/i, 'Fremont'],
    [/Los\s*Angeles|\bLA\b|\bLAX\b/i, 'Los Angeles'],
    [/New\s*York|\bNY\b|\bNYC\b/i, 'New York'],
    [/Amsterdam|\bAMS\b|\bNL\b|Netherlands/i, 'Amsterdam'],
    [/Vancouver|Canada/i, 'Vancouver'],
  ];

  for (const [pattern, name] of locations) {
    if (pattern.test(text)) return name;
  }
  return 'Multi-DC';
}

export class BandwagonHostAdapter implements ProviderAdapter {
  readonly slug = 'bandwagonhost';
  readonly name = 'BandwagonHost';
  warnings: readonly string[] = [];

  constructor(private readonly fetchHtml: FetchHtml = fetchProviderHtml) {}

  async check(): Promise<StockResult[]> {
    const failures: string[] = [];
    let cartResults: StockResult[] = [];

    for (const url of OFFICIAL_CART_URLS) {
      try {
        const html = await this.fetchHtml(this.name, url);
        const results = this.parse(html);
        if (results.length > 0) {
          cartResults = results;
          break;
        }
        failures.push(`${new URL(url).hostname}: no parseable products`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${new URL(url).hostname}: ${message}`);
      }
    }

    const seen = new Set(cartResults.map((item) => item.productId));
    const pidFailures: string[] = [];

    for (const watched of WATCHED_PIDS) {
      const productId = `bwg-${watched.pid}`;
      if (seen.has(productId)) continue;

      try {
        const url = `${CART_URL}?a=add&pid=${watched.pid}`;
        const html = await this.fetchHtml(this.name, url);
        const result = this.parseProductPage(html, watched);
        if (!result) {
          pidFailures.push(`pid=${watched.pid}: unparseable`);
          continue;
        }
        if (!seen.has(result.productId)) {
          seen.add(result.productId);
          cartResults.push(result);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pidFailures.push(`pid=${watched.pid}: ${message}`);
      }
    }

    this.warnings = [...failures, ...pidFailures];

    if (cartResults.length === 0) {
      throw new Error(
        `BandwagonHost official cart endpoints failed; ${failures.join('; ') || 'no results'}`,
      );
    }

    return cartResults;
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
      const location = detectLocation(text);
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

  parseProductPage(
    html: string,
    watched: { pid: number; planName: string; location: string },
  ): StockResult | null {
    const $ = cheerio.load(html);
    const text = $.root().text().replace(/\s+/g, ' ').trim();
    const unavailable = /\.errorbox[\s\S]*?Out of Stock|Out of Stock/i.test(html)
      || /out of stock|sold out/i.test(text);
    const canOrder = $('input[type="submit"][value*="Add to Cart" i]').length > 0
      || /Billing Cycle/i.test(text);

    const strongName = $('strong').filter((_, el) => /VPS|KVM|SPECIAL|PROMO|PLAN/i.test($(el).text()))
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    const planName = strongName.replace(/^VPS\s*-\s*Self-managed\s*-\s*/i, '') || watched.planName;
    const location = detectLocation(`${planName} ${text}`) !== 'Multi-DC'
      ? detectLocation(`${planName} ${text}`)
      : watched.location;
    const pricing = priceFrom(text);
    const orderUrl = `${CART_URL}?a=add&pid=${watched.pid}`;

    return {
      provider: this.slug,
      productId: `bwg-${watched.pid}`,
      planName,
      location,
      category: 'vps',
      cpu: cpuFrom(text),
      ramMb: memoryInMb(text),
      storageGb: storageInGb(text),
      storageType: /NVMe/i.test(text) ? 'NVMe' : /SSD|RAID/i.test(text) ? 'SSD' : 'HDD',
      bandwidthTb: bandwidthInTb(text),
      ipv4: true,
      ipv6: /IPv6/i.test(text),
      price: pricing.price,
      currency: 'USD',
      billingCycle: pricing.billingCycle,
      inStock: !unavailable && canOrder,
      orderUrl,
    };
  }
}
