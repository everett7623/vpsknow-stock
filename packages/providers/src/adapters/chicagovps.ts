import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface Category {
  slug: string;
  location: string;
  url: string;
}

interface ProductPage {
  id: string;
  location: string;
  url: string;
}

const PORTAL = 'https://billing.chicagovps.net';
const CATEGORIES: readonly Category[] = [
  {
    slug: 'cloud-vps',
    location: 'United States',
    url: `${PORTAL}/index.php?rp=/store/cloud-vps`,
  },
  {
    slug: 'specials',
    location: 'United States',
    url: `${PORTAL}/index.php?rp=/store/specials`,
  },
  {
    slug: 'blackfriday-specials',
    location: 'United States',
    url: `${PORTAL}/index.php?rp=/store/blackfriday-specials`,
  },
] as const;
const HIDDEN_VPS_PRODUCTS: readonly ProductPage[] = [
  {
    id: '453',
    location: 'United States',
    url: `${PORTAL}/cart.php?a=add&pid=453`,
  },
] as const;

function numberFrom(text: string, pattern: RegExp): number {
  const match = text.replace(/,/g, '').match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function parseRamMb(text: string): number {
  const value = numberFrom(text, /(\d+(?:\.\d+)?)\s*(MB|GB|TB)\s+(?:Dedicated\s+)?(?:RAM|Memory)/i);
  const unit = text
    .match(/\d+(?:\.\d+)?\s*(MB|GB|TB)\s+(?:Dedicated\s+)?(?:RAM|Memory)/i)?.[1]
    ?.toUpperCase();
  if (unit === 'TB') return Math.round(value * 1024 * 1024);
  if (unit === 'GB') return Math.round(value * 1024);
  return Math.round(value);
}

function parseStorage(text: string): { sizeGb: number; type: string; display?: string } {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s*(?:(?:(?:Gen\d+|Pure)\s*)?(NVMe|SSD|HDD)(?:\s*(?:Disk\s*Space|Diskspace|Space|Storage))?|(?:Disk\s*Space|Diskspace|Space|Storage))/i,
  );
  if (!match) return { sizeGb: 0, type: 'Unknown' };
  const amount = Number.parseFloat(match[1]!);
  const sizeGb = Math.round(match[2]!.toUpperCase() === 'TB' ? amount * 1024 : amount);
  const type = match[3]?.toUpperCase() === 'NVME' ? 'NVMe' : (match[3]?.toUpperCase() ?? 'Unknown');
  return {
    sizeGb,
    type,
    display: `${match[1]}${match[2]!.toUpperCase()}${type === 'Unknown' ? '' : ` ${type}`}`,
  };
}

function parseBandwidth(text: string): { tb: number; display?: string } {
  if (/unmetered\s+bandwidth|bandwidth\s+unmetered/i.test(text)) {
    return { tb: 0, display: 'Unmetered' };
  }
  const match = text.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\s*(?:Bandwidth|Transfer|Traffic)/i);
  if (!match) return { tb: 0 };
  const amount = Number.parseFloat(match[1]!);
  return {
    tb: match[2]!.toUpperCase() === 'GB' ? amount / 1024 : amount,
    display: `${match[1]}${match[2]!.toUpperCase()}`,
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

export class ChicagoVPSAdapter implements ProviderAdapter {
  readonly slug = 'chicagovps';
  readonly name = 'ChicagoVPS';

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

    for (const product of HIDDEN_VPS_PRODUCTS) {
      const html = await fetchProviderHtml(this.name, product.url);
      const result = this.parseProductPage(html, product);
      if (result && !seen.has(result.productId)) {
        seen.add(result.productId);
        results.push(result);
      }
    }

    if (results.length === 0) throw new Error('ChicagoVPS returned no parseable VPS products');
    return results;
  }

  parse(html: string, category: Category): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.product[id^="product"], #products > ul > li[id^="product"]').each((_, element) => {
      const card = $(element);
      const numericId = card.attr('id')?.match(/^product(\d+)$/)?.[1];
      const planName = card
        .find('[id$="-name"], .package-title')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (!numericId || !planName || /cloud\s+metal/i.test(planName)) return;

      const description = card
        .find('.product-desc, [id$="-description"], .package-content')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      const cardText = card.text().replace(/\s+/g, ' ').trim();
      const orderButton = card.find('.btn-order-now, .order-button').first();
      const orderHref = orderButton.attr('href')?.trim() ?? '';
      const quantity = cardText.match(/(\d+)\s+Available/i);
      const unavailable =
        /out\s*of\s*stock|sold\s*out|unavailable/i.test(cardText) ||
        orderButton.hasClass('disabled') ||
        (quantity !== null && Number.parseInt(quantity[1]!, 10) === 0);
      const priceText = card
        .find('.product-pricing .price, [id$="-price"] span, .price-amount')
        .first()
        .text();
      const pricingText = card
        .find('.product-pricing, [id$="-price"], .price-cycle')
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      const storage = parseStorage(description);
      const bandwidth = parseBandwidth(description);
      const cores = Math.round(
        numberFrom(description, /(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:vCPU|CPU\s+Cores?|Cores?)/i),
      );
      const port = description.match(
        /(\d+(?:\.\d+)?)\s*(Gbps|Mbps)(?:\s+Port|\s+Unmetered\s+Bandwidth|\s*$)/i,
      );

      results.push({
        provider: this.slug,
        productId: `chicagovps-${numericId}`,
        planName,
        location: category.location,
        category: 'vps',
        cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: parseRamMb(description),
        storageGb: storage.sizeGb,
        storageType: storage.type,
        bandwidthTb: bandwidth.tb,
        ipv4: /\bIPv4\b/i.test(description),
        ipv6: /\bIPv6\b/i.test(description),
        price: Math.round(numberFrom(priceText, /(\d+(?:\.\d+)?)/) * 100),
        currency: /\bCAD\b/i.test(priceText) ? 'CAD' : 'USD',
        billingCycle: parseBillingCycle(pricingText),
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

  parseProductPage(html: string, product: ProductPage): StockResult | null {
    const $ = cheerio.load(html);
    const productInfo = $('.product-info').first();
    const planName = productInfo.find('.product-title').first().text().replace(/\s+/g, ' ').trim();
    const description = productInfo
      .find('p:not(.product-title)')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
    if (!planName || !description) return null;

    const selectedCycle = $('#inputBillingcycle option:selected').first();
    const cycleText = selectedCycle.text().replace(/\s+/g, ' ').trim();
    const cycleValue = selectedCycle.attr('value') ?? '';
    const storage = parseStorage(description);
    const bandwidth = parseBandwidth(description);
    const cores = Math.round(
      numberFrom(description, /(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:vCPU|CPU\s+Cores?|Cores?)/i),
    );
    const port = description.match(/(\d+(?:\.\d+)?)\s*(Gbps|Mbps)\s+Port/i);
    const unavailable = /out\s*of\s*stock|sold\s*out|unavailable/i.test($.root().text());

    return {
      provider: this.slug,
      productId: `chicagovps-${product.id}`,
      planName,
      location: product.location,
      category: 'vps',
      cpu: cores > 0 ? `${cores} vCPU${cores === 1 ? '' : 's'}` : 'Unknown',
      ramMb: parseRamMb(description),
      storageGb: storage.sizeGb,
      storageType: storage.type,
      bandwidthTb: bandwidth.tb,
      ipv4: /\bIPv4\b/i.test(description),
      ipv6: /\bIPv6\b/i.test(description),
      price: Math.round(numberFrom(cycleText, /\$(\d+(?:\.\d+)?)/) * 100),
      currency: /\bCAD\b/i.test(cycleText) ? 'CAD' : 'USD',
      billingCycle: parseBillingCycle(cycleValue || cycleText),
      inStock:
        !unavailable &&
        $('#frmConfigureProduct').length > 0 &&
        $('#btnCompleteProductConfig').length > 0,
      orderUrl: product.url,
      displaySpecs: {
        storage: storage.display,
        bandwidth: bandwidth.display,
        port: port ? `${port[1]}${port[2]}` : undefined,
      },
    };
  }
}
