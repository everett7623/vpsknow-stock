import type { BillingCycle, ProductCategory } from '@vpsknow/shared';

export interface StockDisplaySpecs {
  storage?: string;
  bandwidth?: string;
  port?: string;
  remark?: string;
}

export interface StockResult {
  provider: string;
  productId: string;
  planName: string;
  location: string;
  category: ProductCategory;
  cpu: string;
  ramMb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  ipv4: boolean;
  ipv6: boolean;
  price: number; // cents
  currency: string;
  billingCycle: BillingCycle;
  inStock: boolean;
  orderUrl: string;
  displaySpecs?: StockDisplaySpecs;
  raw?: unknown;
}

export interface ProviderAdapter {
  slug: string;
  name: string;
  warnings?: readonly string[];
  check(): Promise<StockResult[]>;
}
