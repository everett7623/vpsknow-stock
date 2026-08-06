export const PROVIDER_INTERVALS = {
  bandwagonhost: 90_000,
  dmit: 120_000,
  buyvm: 90_000,
  greencloudvps: 180_000,
  spartanhost: 150_000,
  // Live app.vmiss.com is often CF-blocked; catalog fallback refreshes PIDs without stock claims.
  vmiss: 180_000,
  vps: 300_000,
  saltyfish: 300_000,
  racknerd: 180_000,
  dedirock: 180_000,
  bagevm: 180_000,
  vmrack: 300_000,
  gomami: 300_000,
  colocrossing: 300_000,
  chicagovps: 300_000,
  lightlayer: 300_000,
  speedypage: 300_000,
  bestvm: 300_000,
  neburst: 300_000,
  hncloud: 300_000,
  // Re-activated: real affiliate IDs + adapters present
  clouvider: 180_000,
  liteserver: 180_000,
  evoxt: 180_000,
  onidel: 180_000,
  tierhive: 300_000,
  zgocloud: 300_000,
} as const satisfies Record<string, number>;

const MONITORED_PROVIDER_SLUGS = new Set<string>(Object.keys(PROVIDER_INTERVALS));

export function isMonitoredProvider(slug: string): boolean {
  return MONITORED_PROVIDER_SLUGS.has(slug);
}
