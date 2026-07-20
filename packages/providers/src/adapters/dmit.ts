import * as cheerio from 'cheerio';
import type { ProviderAdapter, StockResult } from '../types.js';

const PRICING_URLS = [
  { url: 'https://www.dmit.io/pages/pricing', line: 'all' },
];

export class DmitAdapter implements ProviderAdapter {
  slug = 'dmit';
  name = 'DMIT';

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];

    for (const { url } of PRICING_URLS) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'VPSKnow-Stock/1.0' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`DMIT HTTP ${res.status}`);
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

    // DMIT pricing page has sections per product line (PVM.LAX, PVM.HKG, etc.)
    // Each section contains plan cards with specs and a deploy/order button
    $('[class*="plan"], [class*="pricing"], .product-card, .plan-card, table tbody tr').each(
      (_, el) => {
        const card = $(el);
        const text = card.text();

        // Detect product line and location
        const { productLine, location } = this.detectProductLine(text, card, $);
        if (!productLine) return;

        const planName = card.find('.plan-name, .product-title, h3, h4').first().text().trim()
          || this.extractPlanName(text);
        if (!planName) return;

        // Check stock status
        const isSoldOut =
          text.toLowerCase().includes('sold out') ||
          text.toLowerCase().includes('out of stock') ||
          text.toLowerCase().includes('waitlist');

        const deployBtn = card.find(
          'a[href*="order"], a[href*="deploy"], a[href*="cart"], button:contains("Deploy")',
        );
        const hasOrderButton = deployBtn.length > 0;
        const inStock = hasOrderButton && !isSoldOut;

        // Extract specs
        const ramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|MB)\s*(?:RAM|Memory|DDR)/i);
        const storageMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:GB|TB)\s*(?:SSD|NVMe|Storage)/i);
        const cpuMatch = text.match(/(\d+)\s*(?:x\s*)?(?:Core|vCPU|CPU)/i);
        const bwMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:TB|GB)\s*(?:BW|Bandwidth|Transfer)/i);

        // Extract price
        const priceMatch = text.match(
          /\$(\d+(?:\.\d{2})?)\s*\/\s*(mo|month|yr|year|quarterly|annual)/i,
        );
        let priceCents = 0;
        let billingCycle: StockResult['billingCycle'] = 'monthly';
        if (priceMatch) {
          priceCents = Math.round(parseFloat(priceMatch[1]!) * 100);
          const cycle = priceMatch[2]!.toLowerCase();
          if (cycle === 'yr' || cycle === 'year' || cycle === 'annual') billingCycle = 'annually';
          else if (cycle === 'quarterly') billingCycle = 'quarterly';
        }

        const orderUrl = deployBtn.attr('href')
          ? new URL(deployBtn.attr('href')!, 'https://www.dmit.io').href
          : 'https://www.dmit.io/pages/pricing';

        const productId = `dmit-${productLine.toLowerCase()}-${planName.toLowerCase().replace(/\s+/g, '-')}`;

        results.push({
          provider: this.slug,
          productId,
          planName: `${productLine} ${planName}`,
          location,
          category: 'vps',
          cpu: cpuMatch ? `${cpuMatch[1]} vCPU` : 'Unknown',
          ramMb: ramMatch
            ? text.toLowerCase().includes('mb')
              ? parseInt(ramMatch[1]!)
              : parseInt(ramMatch[1]!) * 1024
            : 0,
          storageGb: storageMatch ? parseInt(storageMatch[1]!) : 0,
          storageType: 'NVMe',
          bandwidthTb: bwMatch ? parseFloat(bwMatch[1]!) : 0,
          ipv4: true,
          ipv6: text.toLowerCase().includes('ipv6') || true,
          price: priceCents,
          currency: 'USD',
          billingCycle,
          inStock,
          orderUrl,
        });
      },
    );

    return results;
  }

  private detectProductLine(
    text: string,
    card: cheerio.Cheerio<cheerio.Element>,
    $: cheerio.CheerioAPI,
  ): { productLine: string; location: string } {
    // Check section headings above this card
    const sectionText = card.closest('section, [class*="section"]').text() || text;

    const lines: [RegExp, string, string][] = [
      [/PVM\.LAX|Premium.*Los\s*Angeles/i, 'PVM.LAX', 'Los Angeles'],
      [/PVM\.SJC|Premium.*San\s*Jose/i, 'PVM.SJC', 'San Jose'],
      [/PVM\.HKG|Premium.*Hong\s*Kong/i, 'PVM.HKG', 'Hong Kong'],
      [/PVM\.TYO|Premium.*Tokyo/i, 'PVM.TYO', 'Tokyo'],
      [/Eyeball.*LAX|LAX.*Eyeball/i, 'Eyeball.LAX', 'Los Angeles'],
      [/Lite/i, 'Lite', 'Multi-DC'],
    ];

    for (const [pattern, line, loc] of lines) {
      if (pattern.test(sectionText) || pattern.test(text)) {
        return { productLine: line, location: loc };
      }
    }

    return { productLine: '', location: '' };
  }

  private extractPlanName(text: string): string {
    const match = text.match(/(Tiny|Mini|Micro|Small|Medium|Large|Giant|Starter|Pro|Enterprise)/i);
    return match ? match[1]! : '';
  }
}
