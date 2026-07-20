export type BillingCycle =
  | 'monthly'
  | 'quarterly'
  | 'semi-annually'
  | 'annually'
  | 'biennially'
  | 'triennially';

export type ProductCategory = 'vps' | 'vds' | 'dedicated' | 'nat_vps' | 'storage';

export type StockStatus = 'in_stock' | 'out_of_stock' | 'limited' | 'unknown';

export type EventType = 'restock' | 'sold_out';

export type AdapterStatus = 'healthy' | 'degraded' | 'paused' | 'broken';

export type OfferSource = 'lowendtalk' | 'provider_blog' | 'manual';

export interface NormalizedPrice {
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
  monthlyEquivalentCents: number;
}
