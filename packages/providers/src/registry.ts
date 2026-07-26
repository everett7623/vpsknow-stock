import type { ProviderAdapter } from './types.js';
import { BandwagonHostAdapter } from './adapters/bandwagonhost.js';
import { DmitAdapter } from './adapters/dmit.js';
import { BuyVMAdapter } from './adapters/buyvm.js';
import { GreenCloudVPSAdapter } from './adapters/greencloudvps.js';
import { HostHatchAdapter } from './adapters/hosthatch.js';
import { SpartanHostAdapter } from './adapters/spartanhost.js';
import { VmissAdapter } from './adapters/vmiss.js';
import { VpsAdapter } from './adapters/vps.js';
import { SaltyFishAdapter } from './adapters/saltyfish.js';
import { AkileCloudAdapter } from './adapters/akilecloud.js';

const adapters: ProviderAdapter[] = [
  new BandwagonHostAdapter(),
  new DmitAdapter(),
  new BuyVMAdapter(),
  new GreenCloudVPSAdapter(),
  new SpartanHostAdapter(),
  new VmissAdapter(),
  new VpsAdapter(),
  new SaltyFishAdapter(),
  new AkileCloudAdapter(),
];

if (process.env.HOSTHATCH_API_TOKEN) {
  adapters.push(new HostHatchAdapter());
}

export const registry: ReadonlyMap<string, ProviderAdapter> = new Map(
  adapters.map((a) => [a.slug, a]),
);

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return registry.get(slug);
}
