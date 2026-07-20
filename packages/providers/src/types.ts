import type { BillingCycle, ProductCategory } from '@vpsknow/shared';

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
  raw?: unknown;
}

export interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
