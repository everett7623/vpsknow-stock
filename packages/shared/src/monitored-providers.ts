/**
 * Single source of truth for the active monitoring allowlist.
 * Seed `isActive`, worker check intervals, and bot subscribe list must all derive from this.
 */
export const MONITORED_PROVIDERS = [
  { slug: 'bandwagonhost', name: 'BandwagonHost', intervalMs: 90_000 },
  { slug: 'dmit', name: 'DMIT', intervalMs: 120_000 },
  { slug: 'buyvm', name: 'BuyVM', intervalMs: 90_000 },
  { slug: 'greencloudvps', name: 'GreenCloudVPS', intervalMs: 180_000 },
  { slug: 'spartanhost', name: 'SpartanHost', intervalMs: 150_000 },
  // Live app.vmiss.com is often CF-blocked; catalog/PID-watch refresh without false stock claims.
  { slug: 'vmiss', name: 'VMISS', intervalMs: 180_000 },
  { slug: 'vps', name: 'V.PS', intervalMs: 300_000 },
  { slug: 'saltyfish', name: 'SaltyFish', intervalMs: 300_000 },
  { slug: 'racknerd', name: 'RackNerd', intervalMs: 180_000 },
  { slug: 'dedirock', name: 'DediRock', intervalMs: 180_000 },
  { slug: 'bagevm', name: 'BageVM', intervalMs: 180_000 },
  { slug: 'vmrack', name: 'VMRack', intervalMs: 300_000 },
  { slug: 'gomami', name: 'GoMami', intervalMs: 300_000 },
  { slug: 'colocrossing', name: 'ColoCrossing', intervalMs: 300_000 },
  { slug: 'chicagovps', name: 'ChicagoVPS', intervalMs: 300_000 },
  { slug: 'lightlayer', name: 'LightLayer', intervalMs: 300_000 },
  { slug: 'speedypage', name: 'SpeedyPage', intervalMs: 300_000 },
  { slug: 'bestvm', name: 'BestVM', intervalMs: 300_000 },
  { slug: 'neburst', name: 'Neburst', intervalMs: 300_000 },
  { slug: 'hncloud', name: 'HNCloud', intervalMs: 300_000 },
  // zgocloud: removed from monitoring (poor reputation); adapter/seed record kept inactive.
] as const;

export type MonitoredProviderSlug = (typeof MONITORED_PROVIDERS)[number]['slug'];

export const ACTIVE_PROVIDER_SLUGS: readonly MonitoredProviderSlug[] = MONITORED_PROVIDERS.map(
  (provider) => provider.slug,
);

/** Bot subscribe keyboard entries: `[slug, displayName]`. */
export const MONITORED_PROVIDER_ENTRIES: ReadonlyArray<
  readonly [MonitoredProviderSlug, string]
> = MONITORED_PROVIDERS.map((provider) => [provider.slug, provider.name]);

export function isActiveProviderSlug(slug: string): slug is MonitoredProviderSlug {
  return ACTIVE_PROVIDER_SLUGS.includes(slug as MonitoredProviderSlug);
}
