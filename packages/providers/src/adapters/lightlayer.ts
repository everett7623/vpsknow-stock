import type { BillingCycle } from '@vpsknow/shared';
import { fetchDiscoveredPoorVpsCatalog } from '../poorvps.js';
import type { ProviderAdapter, StockResult } from '../types.js';

interface BillingOption {
  amount: number;
  currency: string;
  cycle: BillingCycle;
  selected: boolean;
}

interface CatalogProduct {
  title: string;
  description: string;
  stockStatus: string;
  sourceUrl: string;
  billingOptions: BillingOption[];
  parsedSpecs: Record<string, unknown>;
  configurableOptions: Record<string, unknown>;
  raw: Record<string, unknown>;
}

const CATALOG_PAGE_URL =
  process.env.POORVPS_LIGHTLAYER_PAGE_URL?.trim() || 'https://lightlayer.cn/';
const CATALOG_NAME = 'lightlayer.json';
const ORDER_BASE = 'https://account.lightlayer.net/';
const AFFILIATE_ID = '647';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function billingCycle(value: string): BillingCycle {
  const normalized = value.toLowerCase().replace(/[-_\s]/g, '');
  if (normalized === 'quarterly') return 'quarterly';
  if (normalized === 'semiannually') return 'semi-annually';
  if (normalized === 'annually' || normalized === 'yearly') return 'annually';
  if (normalized === 'biennially') return 'biennially';
  if (normalized === 'triennially') return 'triennially';
  return 'monthly';
}

function parseBillingOption(value: unknown): BillingOption | null {
  if (!isRecord(value)) return null;
  const price = isRecord(value.parsed_price) ? value.parsed_price : null;
  const amount = price ? numberValue(price.amount) : null;
  const currency = price ? stringValue(price.currency) : null;
  const cycle = stringValue(value.value);
  if (amount === null || !currency || !cycle) return null;
  return {
    amount,
    currency,
    cycle: billingCycle(cycle),
    selected: value.is_selected === true,
  };
}

function parseCatalogProduct(value: unknown): CatalogProduct | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title);
  const description = stringValue(value.base_specs_text);
  const stockStatus = stringValue(value.stock_status);
  const sourceUrl = stringValue(value.url);
  if (!title || !description || !stockStatus || !sourceUrl) return null;

  const billingOptions = Array.isArray(value.billing_options)
    ? value.billing_options
        .map(parseBillingOption)
        .filter((item): item is BillingOption => item !== null)
    : [];
  if (billingOptions.length === 0) return null;

  return {
    title,
    description,
    stockStatus,
    sourceUrl,
    billingOptions,
    parsedSpecs: isRecord(value.parsed_base_specs) ? value.parsed_base_specs : {},
    configurableOptions: isRecord(value.configurable_options) ? value.configurable_options : {},
    raw: value,
  };
}

function lineValue(text: string, label: string): string | null {
  const match = text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() || null;
}

function capacityMb(value: string | null): number {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(Mi?B|Gi?B|Ti?B|M|G|T)\b/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  const unit = match[2]!.toUpperCase();
  if (unit.startsWith('T')) return Math.round(amount * 1024 * 1024);
  if (unit.startsWith('G')) return Math.round(amount * 1024);
  return Math.round(amount);
}

function capacityGb(value: string | null): number {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(GB|TB|G|T)\b/i);
  if (!match) return 0;
  const amount = Number.parseFloat(match[1]!);
  return Math.round(match[2]!.toUpperCase().startsWith('T') ? amount * 1024 : amount);
}

function parseBandwidth(product: CatalogProduct): { tb: number; display?: string } {
  const text = product.description;
  const match =
    text.match(/^(?:Data|Transfer|Traffic)\s*:\s*(\d+(?:\.\d+)?)\s*(TB|GB|T|G)\b/im) ??
    text.match(/^(?:Bandwidth)\s*:\s*(\d+(?:\.\d+)?)\s*(TB|GB|T|G)\b/im);
  if (match) {
    const amount = Number.parseFloat(match[1]!);
    const unit = match[2]!.toUpperCase();
    return {
      tb: unit.startsWith('G') ? amount / 1024 : amount,
      display: `${match[1]}${unit.startsWith('G') ? 'GB' : 'TB'}`,
    };
  }

  const dataTransfer = numberValue(product.parsedSpecs.data_transfer);
  return dataTransfer === null
    ? { tb: 0 }
    : { tb: dataTransfer / 1024, display: `${dataTransfer}GB` };
}

function parsePort(product: CatalogProduct): string | undefined {
  const value =
    lineValue(product.description, 'Port(?: Speed)?') ??
    lineValue(product.description, 'Bandwidth');
  const match = value?.match(/(\d+(?:\.\d+)?)\s*(Gbps|Gbit|Mbps)/i);
  if (match) return `${match[1]}${match[2]}`;

  const port = numberValue(product.parsedSpecs.port_speed);
  return port === null ? undefined : `${port}Mbps`;
}

function parseLocation(product: CatalogProduct): string {
  const descriptionLocation = lineValue(product.description, 'Location');
  if (descriptionLocation) return descriptionLocation;

  const parsedLocation = stringValue(product.parsedSpecs.location);
  if (parsedLocation) return parsedLocation;

  for (const option of Object.values(product.configurableOptions)) {
    if (!isRecord(option) || !/location/i.test(stringValue(option.label) ?? '')) continue;
    if (!Array.isArray(option.options)) continue;
    const selected = option.options.find((item) => isRecord(item) && item.is_selected === true);
    if (!isRecord(selected)) continue;
    const text = stringValue(selected.text) ?? stringValue(selected.original_text);
    if (text) return text.replace(/\s*\(Test IP:.*\)$/i, '').trim();
  }

  return 'Multiple Locations';
}

function parseRemark(description: string): string | undefined {
  const remarks = ['Network', 'Upgrade', 'Note']
    .map((label) => {
      const value = lineValue(description, label);
      return value ? `${label}: ${value}` : null;
    })
    .filter((value): value is string => value !== null);
  return remarks.length > 0 ? remarks.join('; ') : undefined;
}

function buildOrderUrl(productId: string): string {
  const url = new URL(ORDER_BASE);
  url.searchParams.set('cmd', 'cart');
  url.searchParams.set('action', 'add');
  url.searchParams.set('affid', AFFILIATE_ID);
  url.searchParams.set('id', productId);
  return url.href;
}

function isVirtualServer(product: CatalogProduct): boolean {
  return /^Core\s*:/im.test(product.description);
}

function hasOfficialSource(product: CatalogProduct, productId: string): boolean {
  try {
    const url = new URL(product.sourceUrl);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'account.lightlayer.net' &&
      url.searchParams.get('cmd') === 'cart' &&
      url.searchParams.get('action') === 'add' &&
      url.searchParams.get('id') === productId
    );
  } catch {
    return false;
  }
}

export class LightLayerAdapter implements ProviderAdapter {
  readonly slug = 'lightlayer';
  readonly name = 'LightLayer';

  async check(): Promise<StockResult[]> {
    const catalog = await fetchDiscoveredPoorVpsCatalog(this.name, CATALOG_PAGE_URL, CATALOG_NAME);
    const results = this.parse(catalog);
    if (results.length === 0) throw new Error('LightLayer returned no parseable VPS products');
    return results;
  }

  parse(catalog: Record<string, unknown>): StockResult[] {
    const results: StockResult[] = [];

    for (const [productId, value] of Object.entries(catalog)) {
      if (!/^\d+$/.test(productId)) continue;
      const product = parseCatalogProduct(value);
      if (!product || !isVirtualServer(product) || !hasOfficialSource(product, productId)) continue;

      const normalizedStatus = product.stockStatus.toLowerCase();
      if (normalizedStatus !== 'in stock' && normalizedStatus !== 'out of stock') continue;

      const price =
        product.billingOptions.find((option) => option.selected) ?? product.billingOptions[0]!;
      const cpu =
        lineValue(product.description, 'Core') ??
        stringValue(product.parsedSpecs.cpu_description) ??
        stringValue(product.parsedSpecs.cpu_cores_base) ??
        'Unknown';
      const memory = lineValue(product.description, 'RAM');
      const storageText = lineValue(product.description, 'Storage');
      const storageType = /NVMe/i.test(storageText ?? '')
        ? 'NVMe'
        : /SSD/i.test(storageText ?? '')
          ? 'SSD'
          : /HDD/i.test(storageText ?? '')
            ? 'HDD'
            : (stringValue(product.parsedSpecs.storage_type) ?? 'Unknown');
      const bandwidth = parseBandwidth(product);

      results.push({
        provider: this.slug,
        productId: `lightlayer-${productId}`,
        planName: product.title,
        location: parseLocation(product),
        category: 'vps',
        cpu,
        ramMb:
          capacityMb(memory) || Math.round((numberValue(product.parsedSpecs.ram_base) ?? 0) * 1024),
        storageGb:
          capacityGb(storageText) ||
          Math.round(numberValue(product.parsedSpecs.storage_amount_unit) ?? 0),
        storageType,
        bandwidthTb: bandwidth.tb,
        ipv4: /IPv4\s*:\s*[1-9]/i.test(product.description),
        ipv6: /IPv6\s*:\s*[1-9/]/i.test(product.description),
        price: Math.round(price.amount * 100),
        currency: price.currency,
        billingCycle: price.cycle,
        inStock: normalizedStatus === 'in stock',
        orderUrl: buildOrderUrl(productId),
        displaySpecs: {
          storage: storageText ?? undefined,
          bandwidth: bandwidth.display,
          port: parsePort(product),
          remark: parseRemark(product.description),
        },
        raw: product.raw,
      });
    }

    return results;
  }
}
