import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

const PLAN_URLS = [
  'https://bandwagonhost.com/vps-hosting.php',
];

export class BandwagonHostAdapter implements ProviderAdapter {
  slug = 'bandwagonhost';
  name = 'BandwagonHost';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];

    for (const url of PLAN_URLS) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`BandwagonHost HTTP ${res.status}`);
      }

      const html = await res.text();
      const parsed = this.parse(html);
      results.push(...parsed);
    }

    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    // BandwagonHost lists plans in a table; each row has plan specs + order link or "Out of Stock"
    $('table tbody tr, .plan-row, .product-row').each((_, el) => {
      const row = $(el);
      const text = row.text();

      // Skip header rows
      if (text.includes('Plan') && text.includes('Price')) return;

      const planName = row.find('td:first-child, .plan-name').text().trim();
      if (!planName) return;

      const orderLink = row.find('a[href*="cart"], a[href*="order"]').attr('href');
      const isOutOfStock =
        text.toLowerCase().includes('out of stock') ||
        text.toLowerCase().includes('sold out') ||
        !orderLink;

      // Extract price
      const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*\/(mo|yr|year|month|quarterly)/i);
      let priceCents = 0;
      let billingCycle: StockResult['billingCycle'] = 'annually';
      if (priceMatch) {
        priceCents = Math.round(parseFloat(priceMatch[1]!) * 100);
        const cycle = priceMatch[2]!.toLowerCase();
        if (cycle === 'mo' || cycle === 'month') billingCycle = 'monthly';
        else if (cycle === 'quarterly') billingCycle = 'quarterly';
        else billingCycle = 'annually';
      }

      // Extract specs from text
      const ramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|MB)\s*RAM/i);
      const storageMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|TB)\s*(?:SSD|NVMe|HDD|RAID|Storage)/i);
      const cpuMatch = text.match(/(\d+)\s*(?:x\s*)?(?:Core|CPU|vCPU)/i);
      const bwMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:TB|GB)\s*(?:BW|Bandwidth|Transfer)/i);

      // Detect location from text or data attributes
      const location = this.detectLocation(text);

      const productId = `bwg-${planName.toLowerCase().replace(/\s+/g, '-')}-${location.toLowerCase().replace(/\s+/g, '-')}`;

      results.push({
        provider: this.slug,
        productId,
        planName,
        location,
        category: 'vps',
        cpu: cpuMatch ? `${cpuMatch[1]} Core` : 'Unknown',
        ramMb: ramMatch
          ? text.toLowerCase().includes('mb ram')
            ? parseInt(ramMatch[1]!)
            : parseInt(ramMatch[1]!) * 1024
          : 0,
        storageGb: storageMatch ? parseInt(storageMatch[1]!) : 0,
        storageType: text.match(/NVMe/i) ? 'NVMe' : text.match(/SSD/i) ? 'SSD' : 'HDD',
        bandwidthTb: bwMatch ? parseFloat(bwMatch[1]!) : 0,
        ipv4: true,
        ipv6: text.toLowerCase().includes('ipv6'),
        price: priceCents,
        currency: 'USD',
        billingCycle,
        inStock: !isOutOfStock,
        orderUrl: orderLink
          ? new URL(orderLink, 'https://bandwagonhost.com').href
          : 'https://bandwagonhost.com/vps-hosting.php',
      });
    });

    return results;
  }

  private detectLocation(text: string): string {
    const locations: [RegExp, string][] = [
      [/DC6|CN2\s*GIA-E/i, 'DC6 CN2 GIA-E'],
      [/DC9|CN2\s*GIA(?!\s*-E)/i, 'DC9 CN2 GIA'],
      [/Hong\s*Kong|HK/i, 'Hong Kong'],
      [/Japan|Tokyo|JP/i, 'Tokyo'],
      [/Los\s*Angeles|LA|LAX/i, 'Los Angeles'],
      [/New\s*York|NY|NYC/i, 'New York'],
      [/Amsterdam|AMS|NL/i, 'Amsterdam'],
      [/Vancouver|Canada/i, 'Vancouver'],
    ];

    for (const [pattern, name] of locations) {
      if (pattern.test(text)) return name;
    }

    return 'Multi-DC';
  }
}
