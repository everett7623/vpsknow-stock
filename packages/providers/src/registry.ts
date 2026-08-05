import type { ProviderAdapter } from './types.js';
import { BandwagonHostAdapter } from './adapters/bandwagonhost.js';
import { DmitAdapter } from './adapters/dmit.js';
import { BuyVMAdapter } from './adapters/buyvm.js';
import { GreenCloudVPSAdapter } from './adapters/greencloudvps.js';
import { SpartanHostAdapter } from './adapters/spartanhost.js';
import { VmissAdapter } from './adapters/vmiss.js';
import { VpsAdapter } from './adapters/vps.js';
import { SaltyFishAdapter } from './adapters/saltyfish.js';
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
import { BageVMAdapter } from './adapters/bagevm.js';
// Phase 4 — B-Tier
import { TierHiveAdapter } from './adapters/tierhive.js';
import { GullosAdapter } from './adapters/gullos.js';
import { WebHorizonAdapter } from './adapters/webhorizon.js';
import { VMRackAdapter } from './adapters/vmrack.js';
import { GoMamiAdapter } from './adapters/gomami.js';
import { ZgoCloudAdapter } from './adapters/zgocloud.js';
import { ColoCrossingAdapter } from './adapters/colocrossing.js';
import { ChicagoVPSAdapter } from './adapters/chicagovps.js';
import { LightLayerAdapter } from './adapters/lightlayer.js';
import { SpeedyPageAdapter } from './adapters/speedypage.js';
import { BestVMAdapter } from './adapters/bestvm.js';
import { NeburstAdapter } from './adapters/neburst.js';
import { HNCloudAdapter } from './adapters/hncloud.js';

const adapters: ProviderAdapter[] = [
  new BandwagonHostAdapter(),
  new DmitAdapter(),
  new BuyVMAdapter(),
  new GreenCloudVPSAdapter(),
  new SpartanHostAdapter(),
  new VmissAdapter(),
  new VpsAdapter(),
  new SaltyFishAdapter(),
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
  new BageVMAdapter(),
  // Phase 4 B-Tier
  new TierHiveAdapter(),
  new GullosAdapter(),
  new WebHorizonAdapter(),
  new VMRackAdapter(),
  new GoMamiAdapter(),
  new ZgoCloudAdapter(),
  new ColoCrossingAdapter(),
  new ChicagoVPSAdapter(),
  new LightLayerAdapter(),
  new SpeedyPageAdapter(),
  new BestVMAdapter(),
  new NeburstAdapter(),
  new HNCloudAdapter(),
];

export const registry: ReadonlyMap<string, ProviderAdapter> = new Map(
  adapters.map((a) => [a.slug, a]),
);

export function getAdapter(slug: string): ProviderAdapter | undefined {
  return registry.get(slug);
}
