import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import {
  fetchProviderPagesWithBrowser,
  type BrowserPageResult,
} from '../browser.js';
import { fetchProviderHtml, resolveProviderProxyUrl } from '../http.js';
import { detectOptimizedLine, type BillingCycle } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

const PRICING_URL = 'https://www.dmit.io/pages/pricing?language=english';

type FetchHtml = (provider: string, url: string) => Promise<string>;
type FetchBrowserPages = (
  provider: string,
  urls: readonly string[],
  readySelector: string,
) => Promise<BrowserPageResult[]>;

const LOCATIONS: Readonly<Record<string, string>> = {
  hkg: 'Hong Kong',
  lax: 'Los Angeles',
  tyo: 'Tokyo',
};

const NETWORK_CODES: Readonly<Record<string, string>> = {
  eyeball: 'EB',
  premium: 'Pro',
  tier1: 'T1',
};

function slugPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function billingCycleFrom(value: string): BillingCycle {
  if (/annually|yearly/i.test(value)) return 'annually';
  if (/semi-annually/i.test(value)) return 'semi-annually';
  if (/quarterly/i.test(value)) return 'quarterly';
  if (/biennially/i.test(value)) return 'biennially';
  if (/triennially/i.test(value)) return 'triennially';
  return 'monthly';
}

function numberFrom(value: string, pattern: RegExp): number {
  const match = value.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function capacityInGb(value: string): number {
  const amount = numberFrom(value, /(\d+(?:\.\d+)?)/);
  if (/MB/i.test(value)) return amount / 1_024;
  return /TB/i.test(value) ? amount * 1_000 : amount;
}

function legacyProductId(locationCode: string, hardware: string, network: string, plan: string): string {
  const key = `${locationCode}:${hardware}:${network}:${plan.toLowerCase()}`;
  const knownProducts: Readonly<Record<string, string>> = {
    'hkg:as3:premium:mini': 'dmit-pvm-hkg-mini',
    'hkg:as3:premium:tiny': 'dmit-pvm-hkg-tiny',
    'lax:as3:eyeball:tiny': 'dmit-eyeball-lax-tiny',
    'lax:as3:premium:mini': 'dmit-pvm-lax-mini',
    'lax:as3:premium:tiny': 'dmit-pvm-lax-tiny',
    'tyo:as3:premium:tiny': 'dmit-pvm-tyo-tiny',
  };

  return knownProducts[key]
    ?? `dmit-${slugPart(locationCode)}-${slugPart(hardware)}-${slugPart(network)}-${slugPart(plan)}`;
}

function orderUrlFrom(card: cheerio.Cheerio<AnyNode>): string {
  const button = card.find('.btn-order, a[href*="cart.php"], a[href*="order"]').first();
  const href = button.attr('href');
  if (href) return new URL(href, PRICING_URL).href;

  const attributes = button.get(0)?.attribs ?? {};
  const pid = Object.values(attributes).join(' ').match(/[?&]pid=(\d+)/)?.[1];
  return pid ? new URL(`/cart.php?a=add&pid=${pid}`, PRICING_URL).href : PRICING_URL;
}

export class DmitAdapter implements ProviderAdapter {
  readonly slug = 'dmit';
  readonly name = 'DMIT';

  constructor(
    private readonly fetchHtml: FetchHtml = (provider, url) =>
      fetchProviderHtml(provider, url, { proxyUrl: resolveProviderProxyUrl(provider) }),
    private readonly fetchBrowserPages: FetchBrowserPages = fetchProviderPagesWithBrowser,
  ) {}

  async check(): Promise<StockResult[]> {
    let html: string;
    try {
      html = await this.fetchHtml(this.name, PRICING_URL);
    } catch (directError) {
      const [page] = await this.fetchBrowserPages(this.name, [PRICING_URL], '.plan-group');
      if (!page?.ok) {
        const directMessage = directError instanceof Error
          ? directError.message
          : String(directError);
        throw new Error(
          `DMIT request failed; direct HTTP: ${directMessage}; `
          + `browser: ${page?.error ?? 'returned no result'}`,
        );
      }
      html = page.html;
    }

    const results = this.parse(html);
    if (results.length === 0) throw new Error('DMIT returned no parseable products');
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const modernResults = this.parseModern($);
    return modernResults.length > 0 ? modernResults : this.parseLegacy($);
  }

  private parseModern($: cheerio.CheerioAPI): StockResult[] {
    const results: StockResult[] = [];

    $('.plan-group').each((_, groupElement) => {
      const group = $(groupElement);
      const locationCode = group.attr('data-loc')?.toLowerCase() ?? '';
      const hardware = group.attr('data-hw')?.toLowerCase() ?? '';
      const network = group.attr('data-net')?.toLowerCase() ?? '';
      const location = LOCATIONS[locationCode];
      const networkCode = NETWORK_CODES[network];
      if (!location || !hardware || !networkCode) return;

      group.find('.plan-card').each((__, cardElement) => {
        const card = $(cardElement);
        const plan = card.find('.plan-card-name').text().replace(/\s+/g, ' ').trim();
        if (!plan) return;

        const specs = card.find('.plan-spec').map((___, element) => (
          $(element).text().replace(/\s+/g, ' ').trim()
        )).get();
        const cpuText = specs[0] ?? '';
        const ramText = specs[1] ?? '';
        const storageText = specs[2] ?? '';
        const bandwidthText = specs[3] ?? '';
        const action = card.find('.btn-order').first();
        const actionText = action.text().replace(/\s+/g, ' ').trim();
        const inStock = /order now/i.test(actionText)
          && !action.hasClass('btn-order-disabled')
          && !/out of stock/i.test(card.text());
        const priceText = card.find('.plan-card-price').text().replace(/\s+/g, ' ').trim();
        const ramGb = capacityInGb(ramText);
        const storageGb = capacityInGb(storageText);
        const bandwidthGb = capacityInGb(bandwidthText);
        const planName = `${locationCode.toUpperCase()}.${hardware.toUpperCase()}.${networkCode}.${plan}`;

        results.push({
          provider: this.slug,
          productId: legacyProductId(locationCode, hardware, network, plan),
          planName,
          location,
          category: 'vps',
          cpu: cpuText || 'Unknown',
          ramMb: Math.round(ramGb * 1_024),
          storageGb: Math.round(storageGb),
          storageType: /NVMe/i.test(storageText) ? 'NVMe' : /SSD/i.test(storageText) ? 'SSD' : 'Unknown',
          bandwidthTb: Math.round((bandwidthGb / 1_000) * 1_000) / 1_000,
          lineType: network === 'premium'
            ? 'Premium'
            : network === 'eyeball'
              ? 'Eyeball'
              : network === 'tier1'
                ? 'Tier 1'
                : detectOptimizedLine(`${planName} ${network}`) ?? undefined,
          ipv4: true,
          ipv6: true,
          price: Math.round(numberFrom(priceText, /\$\s*(\d+(?:\.\d+)?)/) * 100),
          currency: 'USD',
          billingCycle: billingCycleFrom(priceText),
          inStock,
          orderUrl: inStock ? orderUrlFrom(card) : PRICING_URL,
        });
      });
    });

    return results;
  }

  private parseLegacy($: cheerio.CheerioAPI): StockResult[] {
    const results: StockResult[] = [];

    $('[class*="plan"], [class*="pricing"], .product-card, .plan-card, table tbody tr').each(
      (_, element) => {
        const card = $(element);
        const text = card.text().replace(/\s+/g, ' ').trim();
        const { productLine, location } = this.detectProductLine(text, card);
        if (!productLine) return;

        const planName = card.find('.plan-name, .product-title, h3, h4').first().text().trim()
          || this.extractPlanName(text);
        if (!planName) return;

        const isSoldOut = /sold out|out of stock|waitlist/i.test(text);
        const deployButton = card.find(
          'a[href*="order"], a[href*="deploy"], a[href*="cart"], button:contains("Deploy")',
        ).first();
        const inStock = deployButton.length > 0 && !isSoldOut;
        const ramMatch = text.match(/(\d+(?:\.\d+)?)\s*(GB|MB)\s*(?:RAM|Memory|DDR)/i);
        const storageMatch = text.match(/(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:SSD|NVMe|Storage)/i);
        const cpuMatch = text.match(/(\d+)\s*(?:x\s*)?(?:Core|vCPU|CPU)/i);
        const bandwidthMatch = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:BW|Bandwidth|Transfer)/i);
        const priceMatch = text.match(
          /\$(\d+(?:\.\d{2})?)\s*\/\s*(mo|month|yr|year|quarterly|annual)/i,
        );
        const price = priceMatch ? Math.round(Number.parseFloat(priceMatch[1]!) * 100) : 0;
        const orderHref = deployButton.attr('href');
        const productId = `dmit-${productLine.toLowerCase()}-${slugPart(planName)}`;

        results.push({
          provider: this.slug,
          productId,
          planName: `${productLine} ${planName}`,
          location,
          category: 'vps',
          cpu: cpuMatch ? `${cpuMatch[1]} vCPU` : 'Unknown',
          ramMb: ramMatch
            ? Math.round(Number.parseFloat(ramMatch[1]!) * (ramMatch[2]!.toUpperCase() === 'GB' ? 1_024 : 1))
            : 0,
          storageGb: storageMatch
            ? Math.round(Number.parseFloat(storageMatch[1]!) * (storageMatch[2]!.toUpperCase() === 'TB' ? 1_000 : 1))
            : 0,
          storageType: /NVMe/i.test(text) ? 'NVMe' : 'SSD',
          bandwidthTb: bandwidthMatch
            ? Number.parseFloat(bandwidthMatch[1]!) * (bandwidthMatch[2]!.toUpperCase() === 'GB' ? 0.001 : 1)
            : 0,
          lineType: detectOptimizedLine(`${productLine} ${planName} ${text}`) ?? undefined,
          ipv4: true,
          ipv6: true,
          price,
          currency: 'USD',
          billingCycle: billingCycleFrom(priceMatch?.[2] ?? 'monthly'),
          inStock,
          orderUrl: orderHref ? new URL(orderHref, PRICING_URL).href : PRICING_URL,
        });
      },
    );

    return results;
  }

  private detectProductLine(
    text: string,
    card: cheerio.Cheerio<AnyNode>,
  ): { productLine: string; location: string } {
    const sectionText = card.closest('section, [class*="section"]').text() || text;
    const lines: [RegExp, string, string][] = [
      [/PVM\.LAX|Premium.*Los\s*Angeles/i, 'PVM.LAX', 'Los Angeles'],
      [/PVM\.SJC|Premium.*San\s*Jose/i, 'PVM.SJC', 'San Jose'],
      [/PVM\.HKG|Premium.*Hong\s*Kong/i, 'PVM.HKG', 'Hong Kong'],
      [/PVM\.TYO|Premium.*Tokyo/i, 'PVM.TYO', 'Tokyo'],
      [/Eyeball.*LAX|LAX.*Eyeball/i, 'Eyeball.LAX', 'Los Angeles'],
      [/Lite/i, 'Lite', 'Multi-DC'],
    ];

    for (const [pattern, line, location] of lines) {
      if (pattern.test(sectionText) || pattern.test(text)) return { productLine: line, location };
    }
    return { productLine: '', location: '' };
  }

  private extractPlanName(text: string): string {
    return text.match(/(Tiny|Pocket|Mini|Micro|Small|Medium|Large|Giant|Starter|Pro|Enterprise)/i)?.[1]
      ?? '';
  }
}
