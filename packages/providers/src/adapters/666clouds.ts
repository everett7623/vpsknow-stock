import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

type FetchHtml = (provider: string, url: string) => Promise<string>;

const PORTAL = 'https://www.666clouds.com';
const SHOP_URL = `${PORTAL}/shop`;

const REGION_LOCATIONS: Readonly<Record<string, string>> = {
  特价专区: 'Germany',
  美国US: 'United States',
  菲律宾PH: 'Philippines',
  韩国KR: 'Seoul',
  香港HK: 'Hong Kong',
  德国DE: 'Germany',
  英国GB: 'United Kingdom',
  日本JP: 'Japan',
};

interface PlanPriceMap {
  monthly?: string;
  quarterly?: string;
  semiannually?: string;
  annually?: string;
  biennially?: string;
  triennially?: string;
}

interface NativePlan {
  subId: number;
  name: string;
  cpu?: number;
  memMb?: number;
  sysDiskGb?: number;
  bwMbps?: number;
  flowGb?: number;
  stock?: number;
  prices?: PlanPriceMap;
  windows?: boolean;
}

interface CatalogProduct {
  id: number;
  name: string;
  description?: string;
  monthly?: string | null;
  annually?: string | null;
  stockNote?: string;
  planOptions?: {
    revision?: number;
    plans?: NativePlan[];
  };
}

interface CatalogGroup {
  id: number;
  name: string;
  products?: CatalogProduct[];
}

function unescapeRsc(str: string): string {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1]!;
      if (next === '"' || next === '\\' || next === '/') {
        out += next;
        i++;
        continue;
      }
      // Preserve JSON escapes (\n, \uXXXX, ...) for JSON.parse.
      out += '\\';
      out += next;
      i++;
      continue;
    }
    out += str[i];
  }
  return out;
}

function extractGroupsJson(html: string): CatalogGroup[] {
  const escapedLit = '{\\"groups\\":';
  const start = html.indexOf(escapedLit);
  if (start < 0) {
    throw new Error('666Clouds shop page missing embedded groups catalog');
  }

  const valueStart = start + escapedLit.length;
  const open = html[valueStart];
  if (open !== '[' && open !== '{') {
    throw new Error('666Clouds shop catalog payload is malformed');
  }
  const close = open === '[' ? ']' : '}';

  let depth = 0;
  let out = '';
  let esc = false;
  for (let i = valueStart; i < html.length; i++) {
    const ch = html[i]!;
    out += ch;
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) break;
    }
  }

  const parsed: unknown = JSON.parse(unescapeRsc(out));
  if (!Array.isArray(parsed)) {
    throw new Error('666Clouds shop catalog groups payload is not an array');
  }
  return parsed as CatalogGroup[];
}

function positivePrice(value: string | null | undefined): number | null {
  if (value == null) return null;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function pickPrice(prices: PlanPriceMap | undefined, product: CatalogProduct): {
  amount: number;
  billingCycle: BillingCycle;
} {
  const candidates: ReadonlyArray<{ key: keyof PlanPriceMap; cycle: BillingCycle }> = [
    { key: 'monthly', cycle: 'monthly' },
    { key: 'quarterly', cycle: 'quarterly' },
    { key: 'semiannually', cycle: 'semi-annually' },
    { key: 'annually', cycle: 'annually' },
    { key: 'biennially', cycle: 'biennially' },
    { key: 'triennially', cycle: 'triennially' },
  ];

  for (const candidate of candidates) {
    const amount = positivePrice(prices?.[candidate.key]);
    if (amount != null) return { amount, billingCycle: candidate.cycle };
  }

  const monthly = positivePrice(product.monthly);
  if (monthly != null) return { amount: monthly, billingCycle: 'monthly' };
  const annually = positivePrice(product.annually);
  if (annually != null) return { amount: annually, billingCycle: 'annually' };
  return { amount: 0, billingCycle: 'monthly' };
}

function locationFor(groupName: string): string {
  return REGION_LOCATIONS[groupName] ?? groupName;
}

function isPlanInStock(stock: number | undefined, stockNote: string | undefined): boolean {
  if (typeof stock === 'number') {
    // -1 is used by the merchant for “unlimited / always orderable”.
    return stock !== 0;
  }
  if (!stockNote) return false;
  return !/暂时缺货|售罄|无货|缺货/.test(stockNote);
}

export class SixSixCloudsAdapter implements ProviderAdapter {
  readonly slug = '666clouds';
  readonly name = '666Clouds';
  warnings: readonly string[] = [];

  constructor(private readonly fetchHtml: FetchHtml = fetchProviderHtml) {}

  async check(): Promise<StockResult[]> {
    this.warnings = [];
    const html = await this.fetchHtml(this.name, SHOP_URL);
    const results = this.parse(html);
    if (results.length === 0) {
      throw new Error('666Clouds returned no parseable products from /shop catalog');
    }
    return results;
  }

  parse(html: string): StockResult[] {
    const groups = extractGroupsJson(html);
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      const location = locationFor(group.name);
      for (const product of group.products ?? []) {
        const plans = product.planOptions?.plans ?? [];
        if (plans.length === 0) {
          const productId = `666clouds-${product.id}`;
          if (seen.has(productId)) continue;
          seen.add(productId);
          const price = pickPrice(undefined, product);
          results.push({
            provider: this.slug,
            productId,
            planName: product.name,
            location,
            category: 'vps',
            cpu: 'Unknown',
            ramMb: 0,
            storageGb: 0,
            storageType: 'Unknown',
            bandwidthTb: 0,
            ipv4: true,
            ipv6: false,
            price: Math.round(price.amount * 100),
            currency: 'CNY',
            billingCycle: price.billingCycle,
            inStock: isPlanInStock(undefined, product.stockNote),
            orderUrl: `${PORTAL}/shop/${product.id}`,
            raw: {
              groupId: group.id,
              productId: product.id,
              stockNote: product.stockNote,
            },
          });
          continue;
        }

        for (const plan of plans) {
          const productId = `666clouds-${product.id}-${plan.subId}`;
          if (seen.has(productId)) continue;
          seen.add(productId);

          const price = pickPrice(plan.prices, product);
          const flowGb = plan.flowGb ?? 0;
          const bwMbps = plan.bwMbps;
          const orderUrl = new URL(
            `/shop/${product.id}?planSubId=${plan.subId}&cycle=${price.billingCycle === 'semi-annually' ? 'semiannually' : price.billingCycle}`,
            PORTAL,
          ).href;

          results.push({
            provider: this.slug,
            productId,
            planName: `${product.name} · ${plan.name}`,
            location,
            category: 'vps',
            cpu: plan.cpu && plan.cpu > 0
              ? `${plan.cpu} vCPU${plan.cpu === 1 ? '' : 's'}`
              : 'Unknown',
            ramMb: plan.memMb ?? 0,
            storageGb: plan.sysDiskGb ?? 0,
            storageType: 'SSD',
            bandwidthTb: flowGb / 1024,
            ipv4: true,
            ipv6: false,
            price: Math.round(price.amount * 100),
            currency: 'CNY',
            billingCycle: price.billingCycle,
            inStock: isPlanInStock(plan.stock, product.stockNote),
            orderUrl,
            displaySpecs: {
              bandwidth: flowGb > 0 ? `${flowGb}GB流量` : undefined,
              port: bwMbps ? `${bwMbps}Mbps` : undefined,
            },
            raw: {
              groupId: group.id,
              productId: product.id,
              planSubId: plan.subId,
              stock: plan.stock,
              stockNote: product.stockNote,
            },
          });
        }
      }
    }

    return results;
  }
}
