import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BandwagonHostAdapter } from '../bandwagonhost.js';
import { BuyVMAdapter } from '../buyvm.js';
import { DmitAdapter } from '../dmit.js';
import { GreenCloudVPSAdapter } from '../greencloudvps.js';
import { HostHatchAdapter } from '../hosthatch.js';
import { SpartanHostAdapter } from '../spartanhost.js';

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
      orderUrl: 'https://bandwagonhost.com/vps-hosting.php',
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
      orderUrl: 'https://www.dmit.io/pages/pricing',
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

  it('parses HostHatch API stock by product and location', () => {
    const payload: unknown = JSON.parse(fixture('hosthatch.json'));
    const results = new HostHatchAdapter('test-token').parse(payload);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      provider: 'hosthatch',
      productId: 'hh-nvme-2gb-ams',
      planName: 'NVMe 2 GB',
      location: 'Amsterdam',
      category: 'vps',
      cpu: '1 Core',
      ramMb: 2048,
      storageGb: 10,
      storageType: 'NVMe',
      bandwidthTb: 1,
      price: 400,
      billingCycle: 'monthly',
      inStock: true,
    });
    expect(results[1]).toMatchObject({
      productId: 'hh-nvme-2gb-sto',
      location: 'Stockholm',
      inStock: false,
    });
    expect(results[2]).toMatchObject({
      productId: 'hh-storage-1tb-lon',
      category: 'storage',
      storageGb: 1024,
      storageType: 'HDD',
      bandwidthTb: 2.441,
      price: 500,
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
});
