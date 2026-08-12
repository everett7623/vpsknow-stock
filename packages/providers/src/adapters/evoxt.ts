import * as cheerio from 'cheerio';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const PRICING_URL = 'https://evoxt.com/pricing/';
const DEPLOY_URL = 'https://console.evoxt.com/deploy.php';

interface NetworkGroup {
  readonly id: string;
  readonly lineType: string;
  readonly location: string;
}

const NETWORK_GROUPS: Readonly<Record<string, NetworkGroup>> = {
  'global-regions': {
    id: 'standard',
    lineType: 'Standard',
    location: 'Global Standard Regions',
  },
  'hk-osaka-regions': {
    id: 'premium',
    lineType: 'Premium',
    location: 'Hong Kong / Osaka',
  },
  'my-premium-region': {
    id: 'premium-plus',
    lineType: 'Premium Plus',
    location: 'Malaysia',
  },
};

const EXPECTED_PLANS = [
  'VM-0.5',
  'VM-0.75',
  'VM-1',
  'VM-1.5',
  'VM-2',
  'VM-3',
  'VM-4',
  'VM-6',
  'VM-8',
  'VM-12',
  'VM-16',
] as const;

const MAX_MISSING_PLANS_PER_CHECK = 3;

function amount(text: string): number {
  const match = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function ramInMb(text: string): number {
  const value = amount(text);
  return /\bGB\b/i.test(text) ? Math.round(value * 1024) : Math.round(value);
}

function bandwidthInTb(text: string): number {
  const value = amount(text);
  return /\bTB\b/i.test(text) ? value : value / 1000;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function missingPlanResult(planName: string, group: NetworkGroup): StockResult {
  return {
    provider: 'evoxt',
    productId: `evoxt-${group.id}-${slugify(planName)}`,
    planName: `${planName} (${group.lineType})`,
    location: group.location,
    category: 'vps',
    cpu: 'Unknown',
    ramMb: 0,
    storageGb: 0,
    storageType: 'NVMe',
    bandwidthTb: 0,
    lineType: group.lineType,
    ipv4: true,
    ipv6: true,
    price: 0,
    currency: 'USD',
    billingCycle: 'monthly',
    inStock: false,
    orderUrl: DEPLOY_URL,
    raw: { source: 'official-pricing', networkGroup: group.id, missingFromPricing: true },
  };
}

export class EvoxtAdapter implements ProviderAdapter {
  readonly slug = 'evoxt';
  readonly name = 'Evoxt';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, PRICING_URL);
    const results = this.parse(html);
    const parsedGroups = new Set(results.map((result) => result.lineType));

    if (results.length === 0) {
      throw new Error('Evoxt pricing page returned no parseable products');
    }
    if (parsedGroups.size !== Object.keys(NETWORK_GROUPS).length) {
      throw new Error(
        `Evoxt pricing page returned ${parsedGroups.size}/${Object.keys(NETWORK_GROUPS).length} network groups`,
      );
    }

    const returnedIds = new Set(results.map((result) => result.productId));
    const missing = Object.values(NETWORK_GROUPS).flatMap((group) =>
      EXPECTED_PLANS
        .filter((planName) => !returnedIds.has(`evoxt-${group.id}-${slugify(planName)}`))
        .map((planName) => missingPlanResult(planName, group)),
    );
    if (missing.length > MAX_MISSING_PLANS_PER_CHECK) {
      throw new Error(
        `Evoxt pricing page omitted ${missing.length} known plans; refusing mass sold-out update`,
      );
    }

    return [...results, ...missing];
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    for (const [sectionId, group] of Object.entries(NETWORK_GROUPS)) {
      const section = $(`section#${sectionId}`);
      if (section.length === 0) continue;

      section.find('table.pricing-table tbody tr').each((_, element) => {
        const row = $(element);
        const cells = row.find('td');
        if (cells.length < 8) return;

        const planName = row.find('.plan-name').first().text().trim() || cells.eq(0).text().trim();
        const cpuText = cells.eq(1).text().replace(/\s+/g, ' ').trim();
        const ramText = cells.eq(2).text().trim();
        const storageText = cells.eq(3).text().trim();
        const bandwidthText = cells.eq(4).text().trim();
        const priceText = cells.eq(6).text().trim();
        const action = cells.eq(7);
        const actionText = action.text().replace(/\s+/g, ' ').trim();
        const deployLink = action.find('a[href*="deploy.php"]').first();
        const unavailable = /out\s*of\s*stock|sold\s*out|unavailable/i.test(actionText)
          || action.find('[disabled], .disabled, [aria-disabled="true"]').length > 0;
        const inStock = deployLink.length > 0 && !unavailable;

        if (!planName || amount(cpuText) <= 0 || ramInMb(ramText) <= 0 || amount(priceText) <= 0) {
          return;
        }

        results.push({
          provider: this.slug,
          productId: `evoxt-${group.id}-${slugify(planName)}`,
          planName: `${planName} (${group.lineType})`,
          location: group.location,
          category: 'vps',
          cpu: `${Math.round(amount(cpuText))} vCPU`,
          ramMb: ramInMb(ramText),
          storageGb: Math.round(amount(storageText)),
          storageType: 'NVMe',
          bandwidthTb: bandwidthInTb(bandwidthText),
          lineType: group.lineType,
          ipv4: true,
          ipv6: true,
          price: Math.round(amount(priceText) * 100),
          currency: 'USD',
          billingCycle: 'monthly',
          inStock,
          orderUrl: deployLink.attr('href')?.trim() || DEPLOY_URL,
          displaySpecs: {
            bandwidth: bandwidthText,
            port: '1 Gbps',
            remark: 'Weekly automatic backup',
          },
          raw: { source: 'official-pricing', networkGroup: group.id },
        });
      });
    }

    return results;
  }
}
