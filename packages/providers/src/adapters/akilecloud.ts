import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

const SHOP_URL = 'https://next.akile.io/shop/server/';

function number(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function locationFrom(text: string): string {
  if (/\b(?:HKG?|Hong Kong)\b/i.test(text)) return 'Hong Kong';
  if (/\bTokyo\b/i.test(text)) return 'Tokyo';
  if (/\bOsaka\b/i.test(text)) return 'Osaka';
  if (/\bJPN?\b/i.test(text)) return 'Japan';
  if (/\b(?:SGP?|Singapore)\b/i.test(text)) return 'Singapore';
  const location = text.match(/(?:Location|Region|机房|地区)\s*[:：]?\s*([A-Za-z][A-Za-z -]+?)(?=\s+(?:CPU|Memory|RAM|Disk|Storage|Bandwidth|Traffic|IPv4|IPv6|Stock|库存)|$)/i)?.[1]?.trim();
  if (location) return location;
  return 'Unknown';
}

function storageType(text: string): string {
  if (/\bNVMe\b/i.test(text)) return 'NVMe';
  if (/\bSSD\b/i.test(text)) return 'SSD';
  if (/\bHDD\b/i.test(text)) return 'HDD';
  return 'Unknown';
}

function productId(cardId: string, href: string, planName: string): string {
  const explicit = cardId || href.match(/(?:id|plan|product)[=/](?:[^/?#]*-)?([a-z0-9-]+)/i)?.[1];
  const base = explicit || planName;
  return `akilecloud-${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export class AkileCloudAdapter implements ProviderAdapter {
  readonly slug = 'akilecloud';
  readonly name = 'AkileCloud';

  async check(): Promise<StockResult[]> {
    const response = await fetch(SHOP_URL, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'VPSKnow-Stock/1.0',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`AkileCloud HTTP ${response.status}`);
    }

    const html = await response.text();
    if (/cf-chl-|challenge-platform|just a moment|captcha/i.test(html)) {
      throw new Error('AkileCloud challenge page received');
    }

    const results = this.parse(html);
    if (results.length === 0) {
      throw new Error('AkileCloud returned no parseable products');
    }
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.server-card, .product-card, [data-plan]').each((_, element) => {
      const card = $(element);
      const planName = card
        .find('.plan-name, .product-name, [data-plan-name], h2, h3')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (!planName) return;

      const text = card.text().replace(/\s+/g, ' ').trim();
      const href = card.find('a[href*="shop"], a[href*="order"], a[href*="cart"]').first().attr('href')?.trim() ?? '';
      const stock = text.match(/(?:Stock|库存)\s*[:：]?\s*(\d+)/i);
      const inStock = stock !== null
        ? Number.parseInt(stock[1]!, 10) > 0
        : !/(?:Out of Stock|Sold Out|售罄|缺货)/i.test(text) && href.length > 0;
      const ram = number(text, /(?:Memory|RAM|内存)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(GB|MB|G|M)\b/i);
      const ramUnit = text.match(/(?:Memory|RAM|内存)\s*[:：]?\s*\d+(?:\.\d+)?\s*(GB|MB|G|M)\b/i)?.[1];
      const disk = number(text, /(?:Disk|Storage|硬盘)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(TB|GB|T|G)\b/i);
      const diskUnit = text.match(/(?:Disk|Storage|硬盘)\s*[:：]?\s*\d+(?:\.\d+)?\s*(TB|GB|T|G)\b/i)?.[1];
      const traffic = number(text, /(?:Traffic|流量)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(TB|GB|T|G)\b/i);
      const trafficUnit = text.match(/(?:Traffic|流量)\s*[:：]?\s*\d+(?:\.\d+)?\s*(TB|GB|T|G)\b/i)?.[1];
      const cores = Math.round(number(text, /(?:CPU\s*)?(\d+(?:\.\d+)?)\s*(?:Cores?|核)\b/i));
      const price = Math.round(number(text.replace(/,/g, ''), /[¥￥]\s*(\d+(?:\.\d+)?)/) * 100);

      results.push({
        provider: this.slug,
        productId: productId(card.attr('data-plan') ?? card.attr('id') ?? '', href, planName),
        planName,
        location: locationFrom(text),
        category: 'vps',
        cpu: cores > 0 ? `${cores} Core${cores === 1 ? '' : 's'}` : 'Unknown',
        ramMb: /^(?:GB|G)$/i.test(ramUnit ?? '') ? Math.round(ram * 1024) : Math.round(ram),
        storageGb: /^(?:TB|T)$/i.test(diskUnit ?? '') ? Math.round(disk * 1024) : Math.round(disk),
        storageType: storageType(text),
        bandwidthTb: /^(?:GB|G)$/i.test(trafficUnit ?? '')
          ? Math.round((traffic / 1024) * 1000) / 1000
          : traffic,
        ipv4: /IPv4\s*[:：]?\s*[1-9]|(?:1\s*)?IPv4/i.test(text),
        ipv6: /IPv6\s*[:：]?\s*[1-9]|(?:1\s*)?IPv6/i.test(text),
        price,
        currency: 'CNY',
        billingCycle: /(?:year|annual|年)/i.test(text) ? 'annually' : 'monthly',
        inStock,
        orderUrl: inStock && href ? new URL(href, SHOP_URL).href : SHOP_URL,
      });
    });

    return results;
  }
}
