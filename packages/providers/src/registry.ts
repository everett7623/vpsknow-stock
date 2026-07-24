import type { ProviderAdapter } from './types.js';
import { BandwagonHostAdapter } from './adapters/bandwagonhost.js';
import { DmitAdapter } from './adapters/dmit.js';
import { BuyVMAdapter } from './adapters/buyvm.js';
import { GreenCloudVPSAdapter } from './adapters/greencloudvps.js';

const adapters: ProviderAdapter[] = [
  new BandwagonHostAdapter(),
  new DmitAdapter(),
  new BuyVMAdapter(),
  new GreenCloudVPSAdapter(),
];

export const registry: ReadonlyMap<string, ProviderAdapter> = new Map(
  adapters.map((a) => [a.slug, a]),
);

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return registry.get(slug);
}
