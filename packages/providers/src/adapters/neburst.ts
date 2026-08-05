import { createHash } from 'node:crypto';
import type { BillingCycle } from '@vpsknow/shared';
import type { ProviderAdapter, StockResult } from '../types.js';

const USER_AGENT = 'VPSKnow-Stock/1.0';
const PRICING_URL = 'https://neburst.com/api/v1/public/pricing/cloud?include_unpriced=true';
const ORDER_URL = 'https://neburst.com/product/checkout';

interface Metric {
  value: number;
  unit: string;
}
interface Region {
  code: string;
  display: string;
  available: boolean;
}

interface Shape {
  id: string;
  displayName: string;
  group: string;
  groupOrder: number;
  cpu: Metric;
  memory: Metric;
  disk: Metric;
  bandwidth: Metric;
  networkSpeed: Metric;
}

interface Price {
  payCycle: BillingCycle;
  priceCents: number;
  currency: string;
}

interface PricingData {
  regions: Region[];
  shapes: Record<string, Shape>;
  prices: Record<string, Price[]>;
  availability: Record<string, boolean>;
}

interface AggregatedPlan {
  result: StockResult;
  shapeIds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`missing ${key}`);
  return value;
}

function requiredNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`missing ${key}`);
  return value;
}

function parseMetric(value: unknown, key: string): Metric {
  if (!isRecord(value)) throw new Error(`missing ${key}`);
  return {
    value: requiredNumber(value, 'default'),
    unit: requiredString(value, 'unit'),
  };
}

function parseRegions(value: unknown): Region[] {
  if (!Array.isArray(value)) throw new Error('missing regions');
  return value.map((entry) => {
    if (!isRecord(entry)) throw new Error('invalid region');
    return {
      code: requiredString(entry, 'code'),
      display: requiredString(entry, 'display'),
      available: entry.available === true,
    };
  });
}

function parseShapes(value: unknown): Record<string, Shape> {
  if (!isRecord(value)) throw new Error('missing shapes');
  const shapes: Record<string, Shape> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) throw new Error(`invalid shape ${key}`);
    const metadata = isRecord(entry.metadata) ? entry.metadata : {};
    shapes[key] = {
      id: requiredString(entry, 'id'),
      displayName: requiredString(entry, 'display_name'),
      group: requiredString(entry, 'group'),
      groupOrder: typeof metadata.group_order === 'number' ? metadata.group_order : 0,
      cpu: parseMetric(entry.cpu, 'cpu'),
      memory: parseMetric(entry.memory, 'memory'),
      disk: parseMetric(entry.disk, 'disk'),
      bandwidth: parseMetric(entry.bandwidth, 'bandwidth'),
      networkSpeed: parseMetric(entry.network_speed, 'network_speed'),
    };
  }

  return shapes;
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return (
    value === 'monthly' ||
    value === 'quarterly' ||
    value === 'semi-annually' ||
    value === 'annually' ||
    value === 'biennially' ||
    value === 'triennially'
  );
}

function parsePrices(value: unknown): Record<string, Price[]> {
  if (!isRecord(value)) throw new Error('missing prices');
  const prices: Record<string, Price[]> = {};

  for (const [shapeId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) throw new Error(`invalid prices for ${shapeId}`);
    prices[shapeId] = entries.flatMap((entry) => {
      if (!isRecord(entry) || !isBillingCycle(entry.pay_cycle)) return [];
      if (typeof entry.price_cents !== 'number' || typeof entry.currency !== 'string') return [];
      return [
        {
          payCycle: entry.pay_cycle,
          priceCents: entry.price_cents,
          currency: entry.currency,
        },
      ];
    });
  }

  return prices;
}

function parseAvailability(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) throw new Error('missing availability');
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, available]) =>
      typeof available === 'boolean' ? [[key, available]] : [],
    ),
  );
}

function parsePricingData(payload: unknown): PricingData {
  if (!isRecord(payload)) throw new Error('invalid JSON response');
  if (payload.code !== 0) {
    const message = typeof payload.msg === 'string' ? payload.msg : 'unknown API error';
    throw new Error(`Neburst API error: ${message}`);
  }
  if (!isRecord(payload.data)) throw new Error('Neburst API returned no pricing data');

  return {
    regions: parseRegions(payload.data.regions),
    shapes: parseShapes(payload.data.shapes),
    prices: parsePrices(payload.data.prices),
    availability: parseAvailability(payload.data.availability),
  };
}

function toGb(metric: Metric): number {
  const unit = metric.unit.toUpperCase();
  if (unit === 'TB' || unit === 'T') return Math.round(metric.value * 1024);
  if (unit === 'MB' || unit === 'M') return Math.round(metric.value / 1024);
  return Math.round(metric.value);
}

function toMb(metric: Metric): number {
  const unit = metric.unit.toUpperCase();
  if (unit === 'TB' || unit === 'T') return Math.round(metric.value * 1024 * 1024);
  if (unit === 'GB' || unit === 'G') return Math.round(metric.value * 1024);
  return Math.round(metric.value);
}

function toTb(metric: Metric): number {
  const unit = metric.unit.toUpperCase();
  if (unit === 'GB' || unit === 'G') return metric.value / 1024;
  if (unit === 'MB' || unit === 'M') return metric.value / (1024 * 1024);
  return metric.value;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function displayMetric(metric: Metric): string {
  return `${metric.value}${metric.unit}`;
}

export class NeburstAdapter implements ProviderAdapter {
  readonly slug = 'neburst';
  readonly name = 'Neburst';

  async check(): Promise<StockResult[]> {
    const url = new URL(PRICING_URL);
    const timestamp = Date.now().toString();
    const requestId = createHash('md5')
      .update(`${url.pathname}GET${timestamp}${USER_AGENT}`)
      .digest('hex');
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Neburst-Request-Language': 'en-us',
        'Neburst-Request-Time': timestamp,
        'Neburst-Request-Id': requestId,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Neburst HTTP ${response.status} for public cloud pricing`);
    }

    const payload: unknown = await response.json();
    const results = this.parse(payload);
    if (results.length === 0) throw new Error('Neburst returned no parseable cloud products');
    return results;
  }

  parse(payload: unknown): StockResult[] {
    const data = parsePricingData(payload);
    const plans = new Map<string, AggregatedPlan>();

    for (const region of data.regions) {
      for (const [shapeId, shape] of Object.entries(data.shapes)) {
        const price = data.prices[shapeId]?.find((entry) => entry.payCycle === 'monthly')
          ?? data.prices[shapeId]?.[0];
        if (!price) continue;

        const signature = [
          region.code,
          shape.displayName,
          shape.group,
          shape.cpu.value,
          shape.memory.value,
          shape.disk.value,
          shape.bandwidth.value,
          price.priceCents,
        ].join('|');
        const available = region.available && data.availability[`${region.code}:${shapeId}`] === true;
        const existing = plans.get(signature);

        if (existing) {
          existing.result.inStock ||= available;
          existing.shapeIds.push(shape.id);
          existing.result.raw = {
            regionCode: region.code,
            shapeIds: existing.shapeIds,
          };
          continue;
        }

        const groupSlug = slugPart(shape.group) || `group-${shape.groupOrder}`;
        const planSlug = slugPart(shape.displayName) || shape.id.slice(0, 12);
        plans.set(signature, {
          shapeIds: [shape.id],
          result: {
            provider: this.slug,
            productId: `neburst-${region.code}-${groupSlug}-${planSlug}-${price.priceCents}`,
            planName: shape.displayName,
            location: region.display,
            category: 'vps',
            cpu: `${shape.cpu.value} ${shape.cpu.unit}`,
            ramMb: toMb(shape.memory),
            storageGb: toGb(shape.disk),
            storageType: 'SSD',
            bandwidthTb: toTb(shape.bandwidth),
            ipv4: true,
            ipv6: true,
            price: price.priceCents,
            currency: price.currency,
            billingCycle: price.payCycle,
            inStock: available,
            orderUrl: ORDER_URL,
            displaySpecs: {
              storage: `${displayMetric(shape.disk)} SSD`,
              bandwidth: displayMetric(shape.bandwidth),
              port: displayMetric(shape.networkSpeed),
              remark: shape.group,
            },
            raw: {
              regionCode: region.code,
              shapeIds: [shape.id],
            },
          },
        });
      }
    }

    return [...plans.values()].map(({ result }) => result);
  }
}
