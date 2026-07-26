import type { BillingCycle, ProductCategory } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

const API_URL = 'https://cloud.hosthatch.com/api/v1/products?prices';
const ORDER_URL = 'https://cloud.hosthatch.com/signup';

const LOCATIONS: Readonly<Record<string, string>> = {
  AMS: 'Amsterdam',
  CHI: 'Chicago',
  HKG: 'Hong Kong',
  LON: 'London',
  LAX: 'Los Angeles',
  NYC: 'New York',
  NY: 'New York',
  OSL: 'Oslo',
  SEL: 'Seoul',
  ICN: 'Seoul',
  SGP: 'Singapore',
  STO: 'Stockholm',
  SYD: 'Sydney',
  TOK: 'Tokyo',
  TYO: 'Tokyo',
  VIE: 'Vienna',
  ZRH: 'Zurich',
};

interface ApiProduct {
  _id?: unknown;
  name?: unknown;
  description?: unknown;
  options?: {
    locations?: unknown;
    billing_cycles?: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberFrom(description: string, pattern: RegExp): number {
  const match = description.match(pattern);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function parseSpecs(description: string): {
  cpu: string;
  ramMb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
} {
  const cpuMatch = description.match(/(\d+)\s+(?:AMD\s+EPYC\s+)?(?:vCPU\s+)?cores?/i);
  const ramAmount = numberFrom(description, /(\d+(?:\.\d+)?)\s*(GB|MB)\s+(?:DDR\d+\s+)?RAM/i);
  const ramUnit = description.match(/\d+(?:\.\d+)?\s*(GB|MB)\s+(?:DDR\d+\s+)?RAM/i)?.[1];
  const storageAmount = numberFrom(
    description,
    /(\d+(?:\.\d+)?)\s*(GB|TB)\s+(?:NVMe\s+|SSD\s+|HDD\s+)?Storage/i,
  );
  const storageUnit = description.match(
    /\d+(?:\.\d+)?\s*(GB|TB)\s+(?:NVMe\s+|SSD\s+|HDD\s+)?Storage/i,
  )?.[1];
  const storageType = description.match(/\b(NVMe|SSD|HDD)\b/i)?.[1] ?? 'Unknown';
  const bandwidth = numberFrom(description, /(\d+(?:\.\d+)?)\s*(TB|GB)\s+bandwidth/i);
  const bandwidthUnit = description.match(/\d+(?:\.\d+)?\s*(TB|GB)\s+bandwidth/i)?.[1];

  return {
    cpu: cpuMatch ? `${cpuMatch[1]} Core${cpuMatch[1] === '1' ? '' : 's'}` : 'Unknown',
    ramMb: ramUnit?.toUpperCase() === 'GB' ? Math.round(ramAmount * 1024) : Math.round(ramAmount),
    storageGb: storageUnit?.toUpperCase() === 'TB'
      ? Math.round(storageAmount * 1024)
      : Math.round(storageAmount),
    storageType,
    bandwidthTb: bandwidthUnit?.toUpperCase() === 'GB'
      ? Math.round((bandwidth / 1024) * 1000) / 1000
      : bandwidth,
  };
}

function categoryFor(name: string): ProductCategory {
  return /storage/i.test(name) ? 'storage' : 'vps';
}

function toBillingCycle(value: string): BillingCycle | undefined {
  const supported: BillingCycle[] = [
    'monthly',
    'quarterly',
    'semi-annually',
    'annually',
    'biennially',
    'triennially',
  ];
  return supported.find((cycle) => cycle === value);
}

function selectBilling(value: unknown): {
  cycle: BillingCycle;
  price: number;
  currency: string;
} {
  if (!isRecord(value)) return { cycle: 'monthly', price: 0, currency: 'USD' };

  const entries = Object.entries(value);
  const selected = entries.find(([key]) => key === 'monthly') ?? entries[0];
  if (!selected || !isRecord(selected[1])) {
    return { cycle: 'monthly', price: 0, currency: 'USD' };
  }

  const data = selected[1];
  const cycleId = typeof data._id === 'string' ? data._id : selected[0];
  const numericPrice = typeof data.price === 'number' ? data.price : Number(data.price);

  return {
    cycle: toBillingCycle(cycleId) ?? 'monthly',
    price: Number.isFinite(numericPrice) ? Math.round(numericPrice * 100) : 0,
    currency: typeof data.currency === 'string' ? data.currency : 'USD',
  };
}

export class HostHatchAdapter implements ProviderAdapter {
  readonly slug = 'hosthatch';
  readonly name = 'HostHatch';

  constructor(private readonly apiToken = process.env.HOSTHATCH_API_TOKEN) {}

  async check(): Promise<StockResult[]> {
    if (!this.apiToken) {
      throw new Error('HostHatch adapter requires HOSTHATCH_API_TOKEN');
    }

    const response = await fetch(API_URL, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
        'User-Agent': 'VPSKnow-Stock/1.0',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`HostHatch API HTTP ${response.status}`);
    }

    return this.parse(await response.json());
  }

  parse(payload: unknown): StockResult[] {
    if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.products)) {
      throw new Error('HostHatch API returned an invalid product payload');
    }

    return payload.data.products.flatMap((rawProduct: unknown): StockResult[] => {
      if (!isRecord(rawProduct)) return [];
      const product: ApiProduct = rawProduct;
      if (
        typeof product._id !== 'string'
        || typeof product.name !== 'string'
        || !isRecord(product.options)
        || !isRecord(product.options.locations)
      ) {
        return [];
      }

      const productId = product._id;
      const planName = product.name;
      const description = typeof product.description === 'string' ? product.description : '';
      const specs = parseSpecs(description);
      const billing = selectBilling(product.options.billing_cycles);

      return Object.entries(product.options.locations)
        .filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
        .map(([locationCode, inStock]) => ({
          provider: this.slug,
          productId: `hh-${productId}-${locationCode.toLowerCase()}`,
          planName,
          location: LOCATIONS[locationCode.toUpperCase()] ?? locationCode.toUpperCase(),
          category: categoryFor(planName),
          ...specs,
          ipv4: true,
          ipv6: true,
          price: billing.price,
          currency: billing.currency,
          billingCycle: billing.cycle,
          inStock,
          orderUrl: ORDER_URL,
          raw: rawProduct,
        }));
    });
  }
}
