import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BandwagonHostAdapter } from '../bandwagonhost.js';
import { BuyVMAdapter } from '../buyvm.js';
import { DmitAdapter } from '../dmit.js';
import { GreenCloudVPSAdapter } from '../greencloudvps.js';
import { SpartanHostAdapter } from '../spartanhost.js';
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
import { ChicagoVPSAdapter } from '../chicagovps.js';
import { LightLayerAdapter } from '../lightlayer.js';
import { SpeedyPageAdapter } from '../speedypage.js';

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

  it('falls back to the official BandwagonHost mirror without changing order URLs', async () => {
    const fetchHtml = vi.fn(async (_provider: string, url: string): Promise<string> => {
      if (url === 'https://bandwagonhost.com/cart.php') {
        throw new Error('connection timed out');
      }
      return fixture('bandwagonhost-cart.html');
    });
    const results = await new BandwagonHostAdapter(fetchHtml).check();

    expect(fetchHtml).toHaveBeenNthCalledWith(
      1,
      'BandwagonHost',
      'https://bandwagonhost.com/cart.php',
    );
    expect(fetchHtml).toHaveBeenNthCalledWith(
      2,
      'BandwagonHost',
      'https://bwh81.net/cart.php',
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.orderUrl).toBe('https://bandwagonhost.com/cart.php?a=add&pid=95');
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

  it('falls back to one browser page when DMIT direct HTTP is challenged', async () => {
    const fetchHtml = vi.fn(async (): Promise<string> => {
      throw new Error('HTTP 403');
    });
    const fetchBrowserPages = vi.fn(
      async (_provider: string, urls: readonly string[], _readySelector: string) => ([{
        url: urls[0]!,
        ok: true as const,
        html: fixture('dmit-modern.html'),
      }]),
    );
    const results = await new DmitAdapter(fetchHtml, fetchBrowserPages).check();

    expect(fetchHtml).toHaveBeenCalledWith(
      'DMIT',
      'https://www.dmit.io/pages/pricing?language=english',
    );
    expect(fetchBrowserPages).toHaveBeenCalledWith(
      'DMIT',
      ['https://www.dmit.io/pages/pricing?language=english'],
      '.plan-group',
    );
    expect(results).toHaveLength(2);
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

  it('preserves GreenCloudVPS source units and optional VPS specifications', () => {
    const results = new GreenCloudVPSAdapter().parse(
      `
        <div class="product" id="product2305">
          <span id="product2305-name">CN Premium Optimized Plan Mini (Singapore)</span>
          <span class="qty">10 Available</span>
          <ul class="product-desc">
            <li><span class="feature-value">2GB</span> RAM</li>
            <li><span class="feature-value">20GB NVMe RAID-10</span> Hard drive</li>
            <li><span class="feature-value">1 core @ EPYC Milan</span> CPU</li>
            <li><span class="feature-value">1</span> IPv4</li>
            <li><span class="feature-value">/64</span> IPv6</li>
            <li><span class="feature-value">500GB</span> Bandwidth</li>
            <li><span class="feature-value">500Mbps</span> Port</li>
            <li><span class="feature-value">Linux</span> OS</li>
            <li><span class="feature-value">Singapore Premium Line</span> Location</li>
            <li><span class="feature-value">Virtfusion</span> Control Panel</li>
            <li><span class="feature-value">Daily Backups</span> Backup/Snapshot</li>
            <li><span class="feature-value">No refund/Money back on this plan.</span> Note</li>
          </ul>
          <div class="product-pricing">$25.00 USD Monthly</div>
          <a class="btn-order-now" href="/billing/cart.php?a=add&amp;pid=2305">Order</a>
        </div>
      `,
      'vps',
    );

    expect(results[0]).toMatchObject({
      productId: 'gc-2305',
      bandwidthTb: 0.488,
      storageGb: 20,
      storageType: 'NVMe',
      displaySpecs: {
        storage: '20GB NVMe RAID-10',
        bandwidth: '500GB',
        port: '500Mbps',
        remark:
          'OS: Linux; Control Panel: Virtfusion; Backup/Snapshot: Daily Backups; Note: No refund/Money back on this plan.',
      },
    });
  });

  it('parses SpartanHost WHMCS quantity as the authoritative stock state', () => {
    const results = new SpartanHostAdapter().parse(fixture('spartanhost.html'), {
      slug: 'dallas-premium-vps',
      location: 'Dallas',
      category: 'vps',
      url: 'https://billing.spartanhost.net/store/dallas-premium-vps',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'spartanhost',
      productId: 'spartan-1024mb-dalkvm',
      planName: '1024MB DALKVM',
      location: 'Dallas',
      cpu: '1 vCore',
      ramMb: 1024,
      storageGb: 25,
      storageType: 'NVMe',
      bandwidthTb: 2,
      ipv6: true,
      price: 600,
      inStock: true,
      orderUrl: 'https://billing.spartanhost.net/cart.php?a=add&pid=317',
      raw: { available: 10, whmcsPid: '317' },
    });
    expect(results[1]).toMatchObject({
      productId: 'spartan-20480mb-dalkvm',
      inStock: false,
      orderUrl: 'https://billing.spartanhost.net/store/dallas-premium-vps',
      raw: { available: 0, whmcsPid: '389' },
    });
  });

  it('parses SpartanHost storage plans without treating their HDD capacity as RAM', () => {
    const results = new SpartanHostAdapter().parse(
      `
        <div class="product" id="product88">
          <span id="product88-name">1000GB KVM</span>
          <span class="qty">1 Available</span>
          <div class="product-desc">
            1024MB DDR4 ECC RAM
            1 CPU vCore
            1000GB Raid 10 HDD Storage
            3TB bandwidth @ 10Gb/s
            1 IPv4, /64 IPv6
          </div>
          <div class="product-pricing">Starting from $6.00 USD Monthly</div>
          <a class="btn-order-now" href="/store/storage-kvm-vps-dallas/1000gb-kvm">Order Now</a>
        </div>
      `,
      {
        slug: 'storage-kvm-vps-dallas',
        location: 'Dallas',
        category: 'storage',
        url: 'https://billing.spartanhost.net/store/storage-kvm-vps-dallas',
      },
    );

    expect(results[0]).toMatchObject({
      category: 'storage',
      ramMb: 1024,
      storageGb: 1000,
      storageType: 'HDD',
      bandwidthTb: 3,
      ipv6: true,
    });
  });

  it('continues SpartanHost checks when one official category is invalid', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const html = url.pathname.includes('cmin2-premium')
        ? '<html><title>Shopping Cart - Spartan Host Ltd</title></html>'
        : fixture('spartanhost.html');
      return new Response(html, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const adapter = new SpartanHostAdapter();
      const results = await adapter.check();

      expect(fetchMock).toHaveBeenCalledTimes(7);
      expect(results).toHaveLength(2);
      expect(adapter.warnings).toHaveLength(1);
      expect(adapter.warnings[0]).toContain('cmin2-premium-kvm-vps-seattle');
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('accepts V.PS order pages that embed checkout Turnstile', async () => {
    const html = `${fixture('vps.html')}
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha"></script>`;
    const fetchMock = vi.fn(async () => new Response(html, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const results = await new VpsAdapter().check();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
      expect(results.map((result) => result.inStock)).toEqual([true, false]);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('falls back to one sequential browser session for SaltyFish categories', async () => {
    const fetchHtml = vi.fn(async (): Promise<string> => {
      throw new Error('HTTP 403');
    });
    const fetchBrowserPages = vi.fn(
      async (_provider: string, urls: readonly string[], _readySelector: string) => (
        urls.map((url) => ({
          url,
          ok: true as const,
          html: fixture('saltyfish.html'),
        }))
      ),
    );
    const adapter = new SaltyFishAdapter(fetchHtml, fetchBrowserPages);
    const results = await adapter.check();

    expect(fetchHtml).toHaveBeenCalledTimes(1);
    expect(fetchBrowserPages).toHaveBeenCalledTimes(1);
    expect(fetchBrowserPages.mock.calls[0]?.[0]).toBe('SaltyFish');
    expect(fetchBrowserPages.mock.calls[0]?.[1]).toContain(
      'https://portal.saltyfish.io/index.php?rp=/store/frankfurt-elite',
    );
    expect(fetchBrowserPages.mock.calls[0]?.[2]).toBe('.product');
    expect(results).toHaveLength(2);
    expect(adapter.warnings).toHaveLength(0);
  });

  // Phase 4 A-Tier tests
  it('parses RackNerd WHMCS plans with multiple locations', () => {
    const category = {
      slug: 'kvm-los-angeles',
      location: 'Los Angeles',
      category: 'vps' as const,
      url: 'https://my.racknerd.com/index.php?rp=/store/kvm-vps',
    };
    const results = new RackNerdAdapter().parse(fixture('racknerd.html'), category);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('provider', 'racknerd');
    expect(results[0]).toHaveProperty('planName');
    expect(results[0]).toHaveProperty('location', 'Los Angeles');
    expect(results[0]).toHaveProperty('inStock');
  });

  it('parses RackNerd dedicated plans and preserves the WHMCS product ID', () => {
    const category = {
      slug: 'dedicated',
      location: 'Multiple Locations',
      category: 'dedicated' as const,
      url: 'https://my.racknerd.com/index.php?rp=/store/dedicated-servers',
    };
    const results = new RackNerdAdapter().parse(fixture('racknerd-dedicated.html'), category);

    expect(results).toEqual([
      expect.objectContaining({
        provider: 'racknerd',
        productId: 'racknerd-871',
        category: 'dedicated',
        cpu: 'Dual Intel Xeon E5-2650 v2',
        ramMb: 131_072,
        storageGb: 4096,
        storageType: 'Mixed',
        bandwidthTb: 50,
        price: 24_500,
        inStock: true,
        orderUrl:
          'https://my.racknerd.com/index.php?rp=/store/dedicated-servers/dual-intel-xeon-e5-2650-v2-128gb-ram-1tb-ssd-3tb-hdd',
      }),
    ]);
  });

  it('falls back to one browser session and warns on failed RackNerd categories', async () => {
    const fetchHtml = vi.fn(async (): Promise<string> => {
      throw new Error('HTTP 403');
    });
    const fetchBrowserPages = vi.fn(
      async (_provider: string, urls: readonly string[], _readySelector: string) => (
        urls.map((url, index) => index === 1
          ? { url, ok: false as const, error: 'HTTP 503' }
          : { url, ok: true as const, html: fixture('racknerd.html') })
      ),
    );
    const adapter = new RackNerdAdapter(fetchHtml, fetchBrowserPages);
    const results = await adapter.check();

    expect(fetchHtml).toHaveBeenCalledTimes(1);
    expect(fetchBrowserPages).toHaveBeenCalledTimes(1);
    expect(fetchBrowserPages.mock.calls[0]?.[0]).toBe('RackNerd');
    expect(fetchBrowserPages.mock.calls[0]?.[1]).toHaveLength(8);
    expect(fetchBrowserPages.mock.calls[0]?.[1]).toContain(
      'https://my.racknerd.com/index.php?rp=/store/windows-vps-with-nvme-ssd',
    );
    expect(fetchBrowserPages.mock.calls[0]?.[1]).toContain(
      'https://my.racknerd.com/index.php?rp=/store/hybrid-dedicated-servers',
    );
    expect(fetchBrowserPages.mock.calls[0]?.[2]).toBe('.product');
    expect(results.length).toBeGreaterThan(0);
    expect(adapter.warnings).toEqual([
      expect.stringContaining('windows-vps-with-nvme-ssd: HTTP 503'),
    ]);
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

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'dedirock',
      productId: 'dedirock-301',
      planName: 'DediRock VPS 2G',
      category: 'vps',
      ramMb: 2048,
      storageGb: 20,
      storageType: 'NVMe',
      inStock: true,
      orderUrl: 'https://billing.dedirock.com/cart.php?a=add&pid=301',
    });
    expect(results[1]).toMatchObject({
      productId: 'dedirock-302',
      inStock: false,
      orderUrl: category.url,
    });
  });

  it('parses DediRock storage VPS units without losing MB RAM or TB storage', () => {
    const category = {
      slug: 'vps-storage',
      location: 'United States',
      url: 'https://billing.dedirock.com/index.php?rp=/store/vps-storage',
    };
    const results = new DediRockAdapter().parse(
      `
        <div class="product" id="product57">
          <div id="57-name">Storage Starter</div>
          <div class="product-desc">
            512 MB RAM / 1x vCPU core / 1 TB Space / 1 TB Bandwidth
          </div>
          <div class="qty">3 Available</div>
          <div class="product-pricing"><span class="price">3.99</span> USD Monthly</div>
          <a class="btn-order-now" href="/cart.php?a=add&pid=57">Order Now</a>
        </div>
      `,
      category,
    );

    expect(results[0]).toMatchObject({
      productId: 'dedirock-57',
      ramMb: 512,
      storageGb: 1024,
      storageType: 'Storage',
      orderUrl: 'https://billing.dedirock.com/cart.php?a=add&pid=57',
    });
  });

  it('checks every current public DediRock VPS catalog', async () => {
    const fetchMock = vi.fn(
      async (_url: string) => new Response(fixture('dedirock.html'), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    try {
      const results = await new DediRockAdapter().check();

      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        'https://billing.dedirock.com/index.php?rp=/store/kvm-vps-hosting',
        'https://billing.dedirock.com/index.php?rp=/store/buffalo-kvm-vps',
        'https://billing.dedirock.com/index.php?rp=/store/promo-performance',
        'https://billing.dedirock.com/index.php?rp=/store/promo-storage-new-york',
        'https://billing.dedirock.com/index.php?rp=/store/promo-vps-los-angeles',
        'https://billing.dedirock.com/index.php?rp=/store/promo-vp',
        'https://billing.dedirock.com/index.php?rp=/store/the-i9-dream',
        'https://billing.dedirock.com/index.php?rp=/store/vps-storage',
      ]);
      expect(results).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }
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
      orderUrl:
        'https://cloud.colocrossing.com/index.php?rp=/store/specials/2gb-ram-seattle-special',
    });
  });

  it('parses ChicagoVPS public VPS catalogs and excludes Cloud Metal servers', () => {
    const results = new ChicagoVPSAdapter().parse(fixture('chicagovps.html'), {
      slug: 'cloud-vps',
      location: 'United States',
      url: 'https://billing.chicagovps.net/index.php?rp=/store/cloud-vps',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'chicagovps',
      productId: 'chicagovps-597',
      planName: '1GB RAM',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 25,
      storageType: 'SSD',
      bandwidthTb: 0,
      price: 395,
      billingCycle: 'monthly',
      inStock: true,
      displaySpecs: {
        storage: '25GB SSD',
        bandwidth: 'Unmetered',
        port: '1Gbps',
      },
    });
    expect(results[1]).toMatchObject({
      productId: 'chicagovps-594',
      storageType: 'NVMe',
      bandwidthTb: 20,
      billingCycle: 'annually',
      inStock: false,
    });
  });

  it('parses the hidden ChicagoVPS Standard VPS by its official PID page', () => {
    const result = new ChicagoVPSAdapter().parseProductPage(
      `
        <form id="frmConfigureProduct">
          <div class="product-info">
            <p class="product-title">Standard</p>
            <p>
              1GB Dedicated Ram / 30 GB Pure SSD Diskspace /
              1 CPU Cores on Dual Xeon E5 CPU / 2TB Bandwidth /
              1000Mbps Port / 1 x IPv4 Address
            </p>
          </div>
          <select id="inputBillingcycle">
            <option value="monthly" selected>1 Month Price - $6.95 USD</option>
          </select>
          <button id="btnCompleteProductConfig">Continue</button>
        </form>
      `,
      {
        id: '453',
        location: 'United States',
        url: 'https://billing.chicagovps.net/cart.php?a=add&pid=453',
      },
    );

    expect(result).toMatchObject({
      productId: 'chicagovps-453',
      planName: 'Standard',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 30,
      storageType: 'SSD',
      bandwidthTb: 2,
      price: 695,
      inStock: true,
      orderUrl: 'https://billing.chicagovps.net/cart.php?a=add&pid=453',
    });
  });

  it('parses LightLayer VPS products from PoorVPS without importing its affiliate ID', () => {
    const results = new LightLayerAdapter().parse({
      '102': {
        title: 'LA-VP03',
        base_specs_text:
          'LA-VP03\nCore:1vCPU\nRAM:1GB\nStorage:50GB NVMe\nBandwidth:30 Mbps\nData:1T\nIPv4:1 IP\nNetwork:Global\nUpgrade:NOT available',
        stock_status: 'Out of Stock',
        url: 'https://account.lightlayer.net/?cmd=cart&action=add&affid=893&id=102',
        billing_options: [
          {
            is_selected: true,
            parsed_price: { amount: 4, currency: 'USD' },
            value: 'monthly',
          },
        ],
        configurable_options: {
          location: {
            label: 'Location',
            options: [{ is_selected: true, text: 'Los Angeles', value: 'la' }],
          },
        },
        parsed_base_specs: {
          cpu_cores_base: '1 CPU Core',
          ram_base: 1,
          storage_amount_unit: 50,
          storage_type: 'NVME',
          data_transfer: 1024,
          port_speed: 30,
        },
      },
      '153': {
        title: 'RTX 4090 - Dallas',
        base_specs_text: 'CPU:Intel Xeon\nRAM:512GB\nGPU:RTX4090 * 8',
        stock_status: 'In Stock',
        url: 'https://account.lightlayer.net/?cmd=cart&action=add&affid=893&id=153',
        billing_options: [
          {
            is_selected: true,
            parsed_price: { amount: 1000, currency: 'USD' },
            value: 'monthly',
          },
        ],
      },
    });

    expect(results).toEqual([
      expect.objectContaining({
        provider: 'lightlayer',
        productId: 'lightlayer-102',
        planName: 'LA-VP03',
        location: 'Los Angeles',
        cpu: '1vCPU',
        ramMb: 1024,
        storageGb: 50,
        storageType: 'NVMe',
        bandwidthTb: 1,
        price: 400,
        inStock: false,
        orderUrl: 'https://account.lightlayer.net/?cmd=cart&action=add&affid=647&id=102',
        displaySpecs: {
          storage: '50GB NVMe',
          bandwidth: '1TB',
          port: '30Mbps',
          remark: 'Network: Global; Upgrade: NOT available',
        },
      }),
    ]);
  });

  it('parses SpeedyPage VPS quantities and keeps display units', () => {
    const results = new SpeedyPageAdapter().parse(fixture('speedypage.html'), {
      slug: 'singapore',
      location: 'Singapore',
      url: 'https://my.speedypage.com/store/virtual-servers-singapore?currency=4',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'speedypage',
      productId: 'speedypage-116',
      planName: 'SG-KVM-1G',
      location: 'Singapore',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 15,
      storageType: 'NVMe',
      bandwidthTb: 2,
      price: 536,
      inStock: true,
      displaySpecs: {
        storage: '15GB NVMe',
        bandwidth: '2TB',
        port: '10Gbps',
      },
    });
    expect(results[1]).toMatchObject({
      productId: 'speedypage-120',
      inStock: false,
    });
  });
});
