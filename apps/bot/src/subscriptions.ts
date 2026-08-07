import { listRegions, resolveRegion } from '@vpsknow/shared';

interface SubscriptionStatus {
  providers: string[];
  regions: string[];
  categories: string[];
  maxPriceCents: number | null;
  eventTypes: string[];
  isActive: boolean;
  mutedUntil: Date | null;
}

/** Must stay aligned with seed ACTIVE_PROVIDER_SLUGS / worker PROVIDER_INTERVALS. */
export const PROVIDERS = [
  ['bandwagonhost', 'BandwagonHost'],
  ['dmit', 'DMIT'],
  ['buyvm', 'BuyVM'],
  ['greencloudvps', 'GreenCloudVPS'],
  ['spartanhost', 'SpartanHost'],
  ['vmiss', 'VMISS'],
  ['vps', 'V.PS'],
  ['saltyfish', 'SaltyFish'],
  ['racknerd', 'RackNerd'],
  ['dedirock', 'DediRock'],
  ['bagevm', 'BageVM'],
  ['vmrack', 'VMRack'],
  ['gomami', 'GoMami'],
  ['colocrossing', 'ColoCrossing'],
  ['chicagovps', 'ChicagoVPS'],
  ['lightlayer', 'LightLayer'],
  ['speedypage', 'SpeedyPage'],
  ['bestvm', 'BestVM'],
  ['neburst', 'Neburst'],
  ['hncloud', 'HNCloud'],
  ['zgocloud', 'ZgoCloud'],
] as const;

/** Coarse regions shared with the stock website filters. */
export const REGIONS = listRegions();

export const CATEGORIES = [
  ['vps', 'VPS'],
  ['storage', 'Storage'],
  ['dedicated', 'Dedicated'],
  ['nat_vps', 'NAT VPS'],
] as const;

/**
 * Migrate legacy city filters (e.g. Tokyo) to coarse regions (Asia).
 */
export function normalizeSubscriptionRegions(regions: string[]): string[] {
  if (regions.length === 0) return [];
  const allowed = new Set(listRegions());
  const normalized = new Set<string>();
  for (const region of regions) {
    if (allowed.has(region)) {
      normalized.add(region);
      continue;
    }
    normalized.add(resolveRegion(region));
  }
  return [...normalized];
}

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
    `Regions: ${list(normalizeSubscriptionRegions(subscription.regions))}`,
    `Categories: ${list(subscription.categories)}`,
    `Max price: ${price}`,
  ].join('\n');
}

export function parseSubscribeStartPayload(payload: string): {
  mode: 'subscribe';
  providerSlug: string | null;
} | null {
  const normalized = payload.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'subscribe') return { mode: 'subscribe', providerSlug: null };
  if (normalized.startsWith('subscribe_')) {
    const slug = normalized.slice('subscribe_'.length);
    if (!slug || !PROVIDERS.some(([providerSlug]) => providerSlug === slug)) {
      return { mode: 'subscribe', providerSlug: null };
    }
    return { mode: 'subscribe', providerSlug: slug };
  }
  return null;
}
