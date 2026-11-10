import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ByteVirtAdapter } from '../bytevirt.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const category = {
  slug: 'la-china-optimized-cn2-gia',
  location: 'Los Angeles',
  url: 'https://bytevirt.com/store/la-china-optimized-cn2-gia',
};

describe('ByteVirtAdapter', () => {
  it('parses Lagom packages with Available qty and disabled OOS buttons', () => {
    const results = new ByteVirtAdapter().parse(fixture('bytevirt.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'bytevirt',
      productId: 'bytevirt-329',
      planName: 'VPS-512-KVM-CN2 GIA LA',
      location: 'Los Angeles',
      cpu: '1 vCPU',
      ramMb: 512,
      storageGb: 15,
      storageType: 'SSD',
      bandwidthTb: 500 / 1024,
      ipv4: true,
      ipv6: true,
      price: 6600,
      currency: 'USD',
      billingCycle: 'annually',
      inStock: true,
      orderUrl: 'https://bytevirt.com/store/la-china-optimized-cn2-gia/vps-512-kvm-cn2-gia-la',
    });
    expect(results[1]).toMatchObject({
      productId: 'bytevirt-330',
      ramMb: 1024,
      inStock: false,
      orderUrl: 'https://bytevirt.com/store/la-china-optimized-cn2-gia/vps-1024-kvm-cn2-gia-la-v2',
    });
  });

  it('checks CN2 / 9929 / Tokyo China-optimized stores', async () => {
    const fetchHtml = vi.fn(async (_provider: string, _url: string): Promise<string> =>
      fixture('bytevirt.html'),
    );
    const results = await new ByteVirtAdapter(fetchHtml).check();

    expect(fetchHtml.mock.calls.map(([, url]) => url)).toEqual([
      'https://bytevirt.com/store/la-china-optimized-cn2-gia',
      'https://bytevirt.com/store/la9929',
      'https://bytevirt.com/store/tokyo-china-optimized',
    ]);
    expect(results).toHaveLength(2);
  });
});
