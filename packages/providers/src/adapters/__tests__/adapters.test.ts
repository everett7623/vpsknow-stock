import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BandwagonHostAdapter } from '../bandwagonhost.js';
import { BuyVMAdapter } from '../buyvm.js';
import { DmitAdapter } from '../dmit.js';
import { GreenCloudVPSAdapter } from '../greencloudvps.js';
import {
  applySpartanWhmcsPids,
  parseSpartanWhmcsPidMap,
  SpartanHostAdapter,
} from '../spartanhost.js';
import { VmissAdapter } from '../vmiss.js';
import { VpsAdapter } from '../vps.js';
import { SaltyFishAdapter } from '../saltyfish.js';
// Phase 4 adapters
import { RackNerdAdapter } from '../racknerd.js';
import { ClouviderAdapter } from '../clouvider.js';
import { LiteServerAdapter } from '../liteserver.js';
import { CrunchbitsAdapter } from '../crunchbits.js';
import { ServaRICAAdapter } from '../servarica.js';
import { EvoxtAdapter } from '../evoxt.js';
import { AlwyzonAdapter } from '../alwyzon.js';
import { DediRockAdapter } from '../dedirock.js';
import { OnidelAdapter } from '../onidel.js';
import { BageVMAdapter } from '../bagevm.js';
import { TierHiveAdapter } from '../tierhive.js';
import { GullosAdapter } from '../gullos.js';
import { WebHorizonAdapter } from '../webhorizon.js';
import { VMRackAdapter } from '../vmrack.js';
import { GoMamiAdapter } from '../gomami.js';
import { ZgoCloudAdapter } from '../zgocloud.js';
import { ColoCrossingAdapter } from '../colocrossing.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

describe('provider adapters', () => {
  it('parses BandwagonHost stock state, specs, pricing, and location', () => {
    const results = new BandwagonHostAdapter().parse(fixture('bandwagonhost.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'bandwagonhost',
      planName: 'CN2 GIA-E 20',
      location: 'DC6 CN2 GIA-E',
      cpu: '2 Core',
      ramMb: 2048,
      storageGb: 40,
      storageType: 'NVMe',
      bandwidthTb: 2,
      price: 4999,
      billingCycle: 'annually',
      inStock: true,
      orderUrl: 'https://bandwagonhost.com/cart.php?a=add&pid=20',
    });
    expect(results[1]).toMatchObject({
      location: 'Los Angeles',
      inStock: false,
      billingCycle: 'monthly',
      orderUrl: 'https://bandwagonhost.com/cart.php',
    });
  });

  it('parses the current BandwagonHost WHMCS cart without treating OS names as plans', () => {
    const results = new BandwagonHostAdapter().parse(fixture('bandwagonhost-cart.html'));

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      productId: 'bwg-hk-cn2gia',
      planName: 'SPECIAL 40G KVM PROMO V5 - HONG KONG CN2 GIA VPS',
      location: 'Hong Kong',
      cpu: '2 Core',
      ramMb: 2048,
      storageGb: 40,
      bandwidthTb: 0.5,
      price: 8999,
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://bandwagonhost.com/cart.php?a=add&pid=95',
    });
  });

  it('parses DMIT plan availability and resolves deployment links', () => {
    const results = new DmitAdapter().parse(fixture('dmit.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'dmit',
      planName: 'PVM.LAX Starter',
      location: 'Los Angeles',
      cpu: '1 vCPU',
      ramMb: 2048,
      storageGb: 40,
      bandwidthTb: 2,
      price: 799,
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://www.dmit.io/order/pvm-lax-starter',
    });
    expect(results[1]).toMatchObject({
      planName: 'PVM.LAX Mini',
      inStock: false,
      orderUrl: 'https://www.dmit.io/pages/pricing?language=english',
    });
  });

  it('parses DMIT current location, hardware, and network plan groups', () => {
    const results = new DmitAdapter().parse(fixture('dmit-modern.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      productId: 'dmit-pvm-lax-tiny',
      planName: 'LAX.AS3.Pro.TINY',
      location: 'Los Angeles',
      cpu: '1 vCore',
      ramMb: 2048,
      storageGb: 20,
      bandwidthTb: 1,
      price: 1090,
      inStock: true,
      orderUrl: 'https://www.dmit.io/cart.php?a=add&pid=253',
    });
    expect(results[1]).toMatchObject({
      productId: 'dmit-pvm-lax-mini',
      planName: 'LAX.AS3.Pro.MINI',
      inStock: false,
      orderUrl: 'https://www.dmit.io/pages/pricing?language=english',
    });
  });

  it('parses BuyVM stock state and resolves cart links', () => {
    const results = new BuyVMAdapter().parseGroup(
      fixture('buyvm.html'),
      'Las Vegas',
      'KVM Slices - Las Vegas',
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'buyvm',
      planName: 'Slice 1024',
      location: 'Las Vegas',
      category: 'vps',
      cpu: '1 Core',
      ramMb: 1024,
      storageGb: 20,
      storageType: 'SSD',
      bandwidthTb: 1,
      price: 350,
      inStock: true,
      orderUrl: 'https://my.frantech.ca/cart.php?a=add&pid=1024',
    });
    expect(results[1]).toMatchObject({
      planName: 'Slice 2048',
      inStock: false,
    });
  });

  it('parses GreenCloudVPS quantity, features, billing cycle, and availability', () => {
    const results = new GreenCloudVPSAdapter().parse(fixture('greencloudvps.html'), 'vps');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'greencloudvps',
      productId: 'gc-101',
      planName: 'Tokyo KVM 2',
      location: 'Tokyo',
      category: 'vps',
      cpu: '2 vCPU',
      ramMb: 2048,
      storageGb: 40,
      storageType: 'NVMe',
      bandwidthTb: 2,
      ipv4: true,
      ipv6: true,
      price: 2400,
      billingCycle: 'annually',
      inStock: true,
      orderUrl: 'https://greencloudvps.com/billing/cart.php?a=add&pid=101',
    });
    expect(results[1]).toMatchObject({
      productId: 'gc-102',
      inStock: false,
    });
  });

  it('parses SpartanHost plans as independent per-location stock results', () => {
    const results = new SpartanHostAdapter().parse(fixture('spartanhost.html'));

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      provider: 'spartanhost',
      productId: 'spartan-premium-kvm-1024mb-seattle',
      planName: 'Premium KVM 1024MB',
      location: 'Seattle',
      cpu: '1 vCore',
      ramMb: 1024,
      storageGb: 25,
      storageType: 'NVMe',
      bandwidthTb: 2,
      price: 600,
      inStock: false,
      orderUrl: 'https://spartanhost.org/vps',
    });
    expect(results[1]).toMatchObject({
      productId: 'spartan-1024mb-dalkvm',
      location: 'Dallas',
      inStock: true,
    });
    expect(results[2]).toMatchObject({
      productId: 'spartan-2048mb-seabkvm',
      planName: 'E5 KVM 2048MB',
      location: 'Seattle',
      cpu: '2 vCores',
      price: 1000,
      inStock: true,
    });
  });

  it('maps SpartanHost WHMCS card IDs to exact cart order URLs', () => {
    const results = new SpartanHostAdapter().parse(fixture('spartanhost.html'));
    const pidByOrderUrl = parseSpartanWhmcsPidMap(`
      <div class="product clearfix" id="product317">
        <a href="/store/dallas-premium-vps/1024mb-dalkvm"
           id="product317-order-button">Order Now</a>
      </div>
      <div class="product clearfix" id="product402">
        <a href="/store/e5-seattle/2048mb-seabkvm"
           id="product402-order-button">Order Now</a>
      </div>
    `);
    const mapped = applySpartanWhmcsPids(results, pidByOrderUrl);

    expect(mapped[0]?.orderUrl).toBe('https://spartanhost.org/vps');
    expect(mapped[1]?.orderUrl).toBe('https://billing.spartanhost.net/cart.php?a=add&pid=317');
    expect(mapped[2]?.orderUrl).toBe('https://billing.spartanhost.net/cart.php?a=add&pid=402');
  });

  it('parses VMISS WHMCS quantity as authoritative stock state', () => {
    const results = new VmissAdapter().parse(fixture('vmiss.html'), {
      slug: 'la-cmin2',
      location: 'Los Angeles',
      url: 'https://app.vmiss.com/store/us-los-angeles-cmin2',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'vmiss',
      productId: 'vmiss-101',
      planName: 'US.LA.CMIN2.Basic',
      location: 'Los Angeles',
      cpu: '1 Core',
      ramMb: 1024,
      storageGb: 10,
      storageType: 'SSD',
      bandwidthTb: 0.4,
      ipv4: true,
      ipv6: false,
      price: 500,
      currency: 'CAD',
      inStock: false,
    });
    expect(results[1]).toMatchObject({
      productId: 'vmiss-102',
      planName: 'US.LA.CMIN2.Elite',
      cpu: '2 Cores',
      ramMb: 4096,
      storageGb: 40,
      bandwidthTb: 2,
      ipv6: true,
      price: 3000,
      inStock: true,
      orderUrl: 'https://app.vmiss.com/cart.php?a=add&pid=102',
    });
  });

  it('parses V.PS HostBill products and out-of-stock class', () => {
    const results = new VpsAdapter().parse(fixture('vps.html'), 'Singapore');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'vps',
      productId: 'vps-235',
      planName: 'Singapore EPYC Explorer',
      location: 'Singapore',
      cpu: '2 Cores',
      ramMb: 2048,
      storageGb: 30,
      storageType: 'NVMe',
      bandwidthTb: 1,
      ipv4: true,
      ipv6: true,
      price: 4695,
      currency: 'EUR',
      inStock: true,
    });
    expect(results[1]).toMatchObject({
      productId: 'vps-236',
      ramMb: 4096,
      price: 8495,
      inStock: false,
    });
  });

  it('parses SaltyFish WHMCS quantity and network plans', () => {
    const results = new SaltyFishAdapter().parse(fixture('saltyfish.html'), {
      slug: 'sjc-elite',
      location: 'San Jose',
      url: 'https://portal.saltyfish.io/index.php?rp=/store/sjc-elite',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'saltyfish',
      productId: 'saltyfish-109',
      planName: 'sjc.e1.mini',
      location: 'San Jose',
      cpu: '1 vCore',
      ramMb: 1024,
      storageGb: 10,
      storageType: 'SSD',
      bandwidthTb: 1.2,
      price: 2250,
      billingCycle: 'quarterly',
      inStock: false,
    });
    expect(results[1]).toMatchObject({
      productId: 'saltyfish-137',
      cpu: '2 vCores',
      ramMb: 4096,
      storageGb: 30,
      bandwidthTb: 4,
      price: 2900,
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://portal.saltyfish.io/store/sjc-elite/e1medium',
    });
  });

  // Phase 4 A-Tier tests
  it('parses RackNerd WHMCS plans with multiple locations', () => {
    const category = {
      slug: 'kvm-los-angeles',
      location: 'Los Angeles',
      url: 'https://my.racknerd.com/index.php?rp=/store/kvm-vps',
    };
    const results = new RackNerdAdapter().parse(fixture('racknerd.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'racknerd');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('location', 'Los Angeles');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Clouvider products with pricing and availability', () => {
    const category = {
      slug: 'cloud-us',
      location: 'United States',
      url: 'https://www.clouvider.com/cloud-servers/usa/',
    };
    const results = new ClouviderAdapter().parse(fixture('clouvider.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'clouvider');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses LiteServer Netherlands VPS offerings', () => {
    const category = {
      slug: 'vps-nl',
      location: 'Netherlands',
      url: 'https://liteserver.nl/en/vps/',
    };
    const results = new LiteServerAdapter().parse(fixture('liteserver.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'liteserver');
    expect(results[0]).toHaveProperty('location', 'Netherlands');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Crunchbits stock and plan details', () => {
    const category = {
      slug: 'vps-us',
      location: 'United States',
      url: 'https://crunchbits.com/vps/',
    };
    const results = new CrunchbitsAdapter().parse(fixture('crunchbits.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'crunchbits');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses ServaRICA product availability', () => {
    const category = { slug: 'vps-ca', location: 'Canada', url: 'https://servarica.com/vps/' };
    const results = new ServaRICAAdapter().parse(fixture('servarica.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'servarica');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Evoxt VPS plans and stock state', () => {
    const category = { slug: 'vps-us', location: 'United States', url: 'https://evoxt.com/vps/' };
    const results = new EvoxtAdapter().parse(fixture('evoxt.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'evoxt');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Alwyzon product catalog', () => {
    const category = { slug: 'vps-de', location: 'Germany', url: 'https://alwyzon.com/vps/' };
    const results = new AlwyzonAdapter().parse(fixture('alwyzon.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'alwyzon');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses DediRock dedicated and VPS offerings', () => {
    const category = {
      slug: 'vps-us',
      location: 'United States',
      url: 'https://dedirock.com/vps/',
    };
    const results = new DediRockAdapter().parse(fixture('dedirock.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'dedirock');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Onidel product availability', () => {
    const category = { slug: 'vps-us', location: 'United States', url: 'https://onidel.com/vps/' };
    const results = new OnidelAdapter().parse(fixture('onidel.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'onidel');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses BageVM quantity as authoritative stock with VPS specifications', () => {
    const category = {
      slug: 'japan-servers',
      location: 'Tokyo',
      url: 'https://www.bagevm.com/index.php?language=english&rp=/store/japan-servers',
    };
    const results = new BageVMAdapter().parse(fixture('bagevm.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'bagevm',
      productId: 'bagevm-33',
      planName: 'Japan - SMALL',
      location: 'Tokyo',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 10,
      storageType: 'SSD',
      bandwidthTb: 2,
      ipv4: true,
      ipv6: true,
      price: 399,
      currency: 'USD',
      billingCycle: 'monthly',
      inStock: false,
      orderUrl: category.url,
    });
    expect(results[1]).toMatchObject({
      productId: 'bagevm-29',
      planName: 'Japan - MEDIUM',
      cpu: '2 vCPUs',
      ramMb: 4096,
      storageGb: 30,
      storageType: 'NVMe',
      bandwidthTb: 12,
      price: 1599,
      inStock: true,
      orderUrl: 'https://www.bagevm.com/index.php/store/japan-servers/japan-medium',
    });
  });

  // Phase 4 B-Tier tests
  it('parses TierHive VPS plans', () => {
    const category = {
      slug: 'vps-us',
      location: 'United States',
      url: 'https://tierhive.com/vps/',
    };
    const results = new TierHiveAdapter().parse(fixture('tierhive.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'tierhive');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses Gullos hosting offerings', () => {
    const category = { slug: 'vps-us', location: 'United States', url: 'https://gullos.com/vps/' };
    const results = new GullosAdapter().parse(fixture('gullos.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'gullos');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses WebHorizon VPS stock state', () => {
    const category = { slug: 'vps-in', location: 'India', url: 'https://webhorizon.in/vps/' };
    const results = new WebHorizonAdapter().parse(fixture('webhorizon.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'webhorizon');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses VMRack featured plans without inventing a WHMCS PID', () => {
    const results = new VMRackAdapter().parse(fixture('vmrack.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'vmrack',
      productId: 'vmrack-l3-vps-dc2-2c2g-base',
      planName: 'L3.VPS.DC2.2C2G.Base',
      location: 'Los Angeles',
      cpu: '2 vCPUs',
      ramMb: 2048,
      storageGb: 20,
      bandwidthTb: 1,
      price: 999,
      inStock: false,
      orderUrl: 'https://www.vmrack.net/vps',
    });
    expect(results[1]).toMatchObject({
      productId: 'vmrack-l3-vps-dc2-2c4g-pro',
      ramMb: 4096,
      storageGb: 40,
      bandwidthTb: 3,
      price: 3699,
      inStock: true,
    });
  });

  it('parses GoMami WHMCS product IDs, specs, and stock state', () => {
    const category = {
      slug: 'hkg-pulse',
      location: 'Hong Kong',
      url: 'https://gomami.io/store/hkg-pulse',
    };
    const results = new GoMamiAdapter().parse(fixture('gomami.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'gomami',
      productId: 'gomami-26',
      planName: 'HKG.Pulse.Nano',
      location: 'Hong Kong',
      cpu: '2 vCPUs',
      ramMb: 2048,
      storageGb: 40,
      storageType: 'NVMe',
      bandwidthTb: 0.5,
      price: 4900,
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://gomami.io/store/hkg-pulse/hkgpulsenano',
    });
    expect(results[1]).toMatchObject({
      productId: 'gomami-27',
      inStock: false,
      orderUrl: category.url,
    });
  });

  it('parses ZgoCloud HostBill product IDs and excludes VDS products', () => {
    const results = new ZgoCloudAdapter().parse(fixture('zgocloud.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'zgocloud',
      productId: 'zgocloud-136',
      location: 'Los Angeles',
      cpu: '2 Cores',
      ramMb: 2048,
      storageGb: 20,
      storageType: 'NVMe',
      bandwidthTb: 2,
      price: 9600,
      billingCycle: 'annually',
      inStock: true,
      orderUrl: 'https://clients.zgovps.com/?action=add&cmd=cart&id=136',
    });
    expect(results[1]).toMatchObject({
      productId: 'zgocloud-160',
      location: 'Frankfurt',
      bandwidthTb: 0.5,
      inStock: false,
    });
  });

  it('parses ColoCrossing specials with authoritative WHMCS quantities', () => {
    const results = new ColoCrossingAdapter().parse(fixture('colocrossing.html'));

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'colocrossing',
      productId: 'colocrossing-63',
      planName: '1GB RAM Spring Special',
      location: 'United States',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 25,
      bandwidthTb: 40,
      price: 395,
      billingCycle: 'monthly',
      inStock: false,
    });
    expect(results[1]).toMatchObject({
      productId: 'colocrossing-64',
      location: 'Seattle',
      storageType: 'NVMe',
      billingCycle: 'annually',
      inStock: true,
      orderUrl: 'https://cloud.colocrossing.com/index.php?rp=/store/specials/2gb-ram-seattle-special',
    });
  });
});
