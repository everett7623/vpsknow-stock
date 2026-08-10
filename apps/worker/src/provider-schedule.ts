import {
  ACTIVE_PROVIDER_SLUGS,
  MONITORED_PROVIDERS,
  type MonitoredProviderSlug,
} from '@vpsknow/shared';

type ProviderIntervals = { readonly [K in MonitoredProviderSlug]: number };

export const PROVIDER_INTERVALS: ProviderIntervals = Object.fromEntries(
  MONITORED_PROVIDERS.map((provider) => [provider.slug, provider.intervalMs]),
) as ProviderIntervals;

const MONITORED_PROVIDER_SLUGS = new Set<string>(ACTIVE_PROVIDER_SLUGS);

export function isMonitoredProvider(slug: string): boolean {
  return MONITORED_PROVIDER_SLUGS.has(slug);
}
