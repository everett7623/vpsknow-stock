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
// Phase 4 — A-Tier
import { RackNerdAdapter } from './adapters/racknerd.js';
import { ClouviderAdapter } from './adapters/clouvider.js';
import { LiteServerAdapter } from './adapters/liteserver.js';
import { CrunchbitsAdapter } from './adapters/crunchbits.js';
import { ServaRICAAdapter } from './adapters/servarica.js';
import { EvoxtAdapter } from './adapters/evoxt.js';
import { AlwyzonAdapter } from './adapters/alwyzon.js';
import { DediRockAdapter } from './adapters/dedirock.js';
import { OnidelAdapter } from './adapters/onidel.js';
// Phase 4 — B-Tier
import { TierHiveAdapter } from './adapters/tierhive.js';
import { GullosAdapter } from './adapters/gullos.js';
import { WebHorizonAdapter } from './adapters/webhorizon.js';

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
  // Phase 4 A-Tier
  new RackNerdAdapter(),
  new ClouviderAdapter(),
  new LiteServerAdapter(),
  new CrunchbitsAdapter(),
  new ServaRICAAdapter(),
  new EvoxtAdapter(),
  new AlwyzonAdapter(),
  new DediRockAdapter(),
  new OnidelAdapter(),
  // Phase 4 B-Tier
  new TierHiveAdapter(),
  new GullosAdapter(),
  new WebHorizonAdapter(),
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
