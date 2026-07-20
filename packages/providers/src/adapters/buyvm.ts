import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

// BuyVM product group IDs for different categories
const PRODUCT_GROUPS = [
  { gid: 39, label: 'KVM Slices - Las Vegas', location: 'Las Vegas' },
  { gid: 40, label: 'KVM Slices - New York', location: 'New York' },
  { gid: 41, label: 'KVM Slices - Luxembourg', location: 'Luxembourg' },
  { gid: 42, label: 'KVM Slices - Miami', location: 'Miami' },
  { gid: 48, label: 'Storage Slices - Las Vegas', location: 'Las Vegas' },
  { gid: 49, label: 'Storage Slices - New York', location: 'New York' },
  { gid: 50, label: 'Storage Slices - Luxembourg', location: 'Luxembourg' },
];

export class BuyVMAdapter implements ProviderAdapter {
  slug = 'buyvm';
  name = 'BuyVM';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];

    for (const group of PRODUCT_GROUPS) {
      const url = `https://my.frantech.ca/cart.php?gid=${group.gid}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`BuyVM HTTP ${res.status} for gid=${group.gid}`);
      }

      const html = await res.text();
      const parsed = this.parseGroup(html, group.location, group.label);
      results.push(...parsed);
    }

    return results;
  }

  parseGroup(html: string, location: string, groupLabel: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];
    const isStorage = groupLabel.toLowerCase().includes('storage');

    // BuyVM WHMCS lists products as individual items with "Order Now" or "Out of Stock"
    $('.product, .product-item, [class*="product"]').each((_, el) => {
      const item = $(el);
      const text = item.text();

      const planName = item.find('.product-name, .product-title, h3, h4').first().text().trim();
      if (!planName) return;

      const orderLink = item.find('a:contains("Order Now"), a[href*="cart.php?a=add"]').attr('href');
      const isOutOfStock =
        text.toLowerCase().includes('out of stock') ||
        text.toLowerCase().includes('sold out') ||
        !orderLink;

      // Extract specs
      const ramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|MB)\s*(?:RAM|Memory)/i);
      const storageMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|TB)\s*(?:SSD|NVMe|HDD|Storage|Disk)/i);
      const cpuMatch = text.match(/(\d+)\s*(?:x\s*)?(?:Core|CPU|vCPU)/i);
      const bwMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:TB|GB)\s*(?:BW|Bandwidth)/i);

      // Extract price
      const priceMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/\s*mo|USD\s*Monthly)/i);
      const priceCents = priceMatch ? Math.round(parseFloat(priceMatch[1]!) * 100) : 0;

      const productId = `buyvm-${planName.toLowerCase().replace(/\s+/g, '-')}-${location.toLowerCase().replace(/\s+/g, '-')}`;

      results.push({
        provider: this.slug,
        productId,
        planName,
        location,
        category: isStorage ? 'storage' : 'vps',
        cpu: cpuMatch ? `${cpuMatch[1]} Core` : '1 Core',
        ramMb: ramMatch
          ? text.toLowerCase().includes('mb ram')
            ? parseInt(ramMatch[1]!)
            : parseInt(ramMatch[1]!) * 1024
          : 0,
        storageGb: storageMatch ? parseInt(storageMatch[1]!) : 0,
        storageType: isStorage ? 'HDD' : 'SSD',
        bandwidthTb: bwMatch ? parseFloat(bwMatch[1]!) : 0,
        ipv4: true,
        ipv6: true,
        price: priceCents,
        currency: 'USD',
        billingCycle: 'monthly',
        inStock: !isOutOfStock,
        orderUrl: orderLink
          ? new URL(orderLink, 'https://my.frantech.ca').href
          : `https://my.frantech.ca/cart.php?gid=${PRODUCT_GROUPS[0]!.gid}`,
      });
    });

    return results;
  }
}
