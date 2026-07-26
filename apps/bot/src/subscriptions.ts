interface SubscriptionStatus {
  providers: string[];
  regions: string[];
  categories: string[];
  maxPriceCents: number | null;
  eventTypes: string[];
  isActive: boolean;
  mutedUntil: Date | null;
}

export const PROVIDERS = [
  ['bandwagonhost', 'BandwagonHost'],
  ['dmit', 'DMIT'],
  ['buyvm', 'BuyVM'],
  ['greencloudvps', 'GreenCloudVPS'],
  ['hosthatch', 'HostHatch'],
  ['spartanhost', 'SpartanHost'],
  ['vmiss', 'VMISS'],
  ['vps', 'V.PS'],
  ['saltyfish', 'SaltyFish'],
  ['akilecloud', 'AkileCloud'],
] as const;

export const REGIONS = [
  'Hong Kong',
  'Tokyo',
  'Singapore',
  'Los Angeles',
  'Seattle',
  'Dallas',
  'San Jose',
  'New York',
  'Amsterdam',
  'Frankfurt',
] as const;

export const CATEGORIES = [
  ['vps', 'VPS'],
  ['storage', 'Storage'],
  ['dedicated', 'Dedicated'],
  ['nat_vps', 'NAT VPS'],
] as const;

export function toggleFilter(selected: string[], value: string): string[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

export function toggleProvider(selected: string[], slug: string): string[] {
  return toggleFilter(selected, slug);
}

export function parseMuteHours(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return 8;
  if (!/^\d+$/.test(normalized)) return null;
  const hours = Number.parseInt(normalized, 10);
  return hours >= 1 && hours <= 168 ? hours : null;
}

export function parseMaxPriceCents(value: string): number | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (['off', 'any', 'none'].includes(normalized)) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const amount = Number.parseFloat(normalized);
  if (amount < 0.01 || amount > 100_000) return undefined;
  return Math.round(amount * 100);
}

function list(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'All';
}

export function formatSubscriptionStatus(subscription: SubscriptionStatus | null): string {
  if (!subscription) return 'No subscription found. Use /subscribe to get started.';

  const muted = subscription.mutedUntil && subscription.mutedUntil > new Date()
    ? `Muted until ${subscription.mutedUntil.toISOString()}`
    : subscription.isActive ? 'Active' : 'Disabled';
  const price = subscription.maxPriceCents === null
    ? 'Any'
    : `USD ${(subscription.maxPriceCents / 100).toFixed(2)}`;

  return [
    '📌 Subscription status',
    '',
    `Status: ${muted}`,
    `Events: ${list(subscription.eventTypes)}`,
    `Providers: ${list(subscription.providers)}`,
    `Regions: ${list(subscription.regions)}`,
    `Categories: ${list(subscription.categories)}`,
    `Max price: ${price}`,
  ].join('\n');
}
