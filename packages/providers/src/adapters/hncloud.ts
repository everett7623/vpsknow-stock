import * as cheerio from 'cheerio';
import type { BillingCycle } from '@vpsknow/shared';
import { fetchProviderHtml } from '../http.js';
import type { ProviderAdapter, StockResult } from '../types.js';

const ACTIVITY_URL = 'https://www.hncloud.com/activity/activity_2026summer.html';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function capacityInGb(value: string | null): number {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(TB|T|GB|G|MB|M)\b/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  if (unit === 'TB' || unit === 'T') return Math.round(amount * 1024);
  if (unit === 'MB' || unit === 'M') return Math.round(amount / 1024);
  return Math.round(amount);
}

function billingCycle(duration: number): BillingCycle {
  if (duration === 3) return 'quarterly';
  if (duration === 6) return 'semi-annually';
  if (duration === 12) return 'annually';
  if (duration === 24) return 'biennially';
  if (duration === 36) return 'triennially';
  return 'monthly';
}

export class HNCloudAdapter implements ProviderAdapter {
  readonly slug = 'hncloud';
  readonly name = 'HNCloud';

  async check(): Promise<StockResult[]> {
    const html = await fetchProviderHtml(this.name, ACTIVITY_URL);
    const results = this.parse(html);
    if (results.length === 0) {
      throw new Error('HNCloud returned no parseable limited-stock activity products');
    }
    return results;
  }

  parse(html: string): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $('.module-flash-sale .daily-card[data-value]').each((_, element) => {
      const card = $(element);
      const serialized = card.attr('data-value');
      if (!serialized) return;

      let payload: unknown;
      try {
        payload = JSON.parse(serialized);
      } catch {
        return;
      }
      if (!isRecord(payload) || payload.product_group !== 'ecs') return;

      const options = payload.option_json;
      const prices = payload.price_list;
      const stats = payload.stat;
      if (!isRecord(options) || !isRecord(prices) || !isRecord(stats)) return;

      const productId = numberValue(payload, 'product_id');
      const stock = numberValue(payload, 'stock');
      const sold = numberValue(stats, 'buy_num');
      const status = numberValue(stats, 'status');
      const title = stringValue(payload, 'title');
      const location = stringValue(payload, 'bandwidth_region_txt');
      const cpu = numberValue(options, 'cpu');
      const memoryMb = numberValue(options, 'memory');
      const duration = numberValue(prices, 'duration');
      const price = numberValue(prices, 'custom_price');

      if (
        productId === null ||
        stock === null ||
        sold === null ||
        status === null ||
        !title ||
        !location ||
        cpu === null ||
        memoryMb === null ||
        duration === null ||
        price === null
      ) {
        return;
      }

      const remaining = Math.max(0, stock - sold);
      const memoryLabel = stringValue(options, 'memoryG') ?? `${Math.round(memoryMb / 1024)}G`;
      const cpuLabel = stringValue(options, 'cpuH') ?? `${cpu}H`;
      const flowGb = numberValue(options, 'flow') ?? 0;
      const bandwidth = stringValue(payload, 'bandwidth_txt');
      const flow = stringValue(options, 'flow_desc');

      results.push({
        provider: this.slug,
        productId: `hncloud-${productId}`,
        planName: `${title} ${cpuLabel}${memoryLabel}`,
        location,
        category: 'vps',
        cpu: `${cpu} vCPU${cpu === 1 ? '' : 's'}`,
        ramMb: Math.round(memoryMb),
        storageGb: capacityInGb(stringValue(options, 'sys_disk')),
        storageType: 'Unknown',
        bandwidthTb: flowGb > 0 ? flowGb / 1024 : 0,
        ipv4: true,
        ipv6: false,
        price: Math.round(price * 100),
        currency: 'CNY',
        billingCycle: billingCycle(duration),
        inStock: status === 0 && remaining > 0 && card.find('.btn.buy').length > 0,
        orderUrl: ACTIVITY_URL,
        displaySpecs: {
          storage: stringValue(options, 'sys_disk') ?? undefined,
          bandwidth: [bandwidth, flow].filter(Boolean).join('; ') || undefined,
          remark: stringValue(payload, 'desc') ?? undefined,
        },
        raw: {
          stock,
          sold,
          remaining,
          status,
          statId: numberValue(stats, 'id'),
          sectionId: numberValue(payload, 'section_id'),
        },
      });
    });

    return results;
  }
}
