import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ZoroCloudAdapter } from '../zorocloud.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const category = {
  slug: 'hkcn2',
  location: 'Hong Kong',
  category: 'vps' as const,
  url: 'https://my.zorocloud.com/store/hkcn2',
};

describe('ZoroCloudAdapter', () => {
  it('treats a disabled order button and 0 可用 as out of stock', () => {
    const results = new ZoroCloudAdapter().parse(fixture('zorocloud.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'zorocloud',
      productId: 'zorocloud-42',
      planName: 'HK-CN2GIA-Plus',
      location: 'Hong Kong',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 20,
      storageType: 'SSD',
      bandwidthTb: 200 / 1024,
      price: 4900,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://my.zorocloud.com/store/hkcn2/hk-cn2gia-a',
    });
    expect(results[1]).toMatchObject({
      productId: 'zorocloud-339',
      planName: 'ID-BGP-Plus',
      cpu: '1 vCPU',
      inStock: false,
      raw: { available: 0 },
    });
  });

  it('checks every tracked ZoroCloud store group', async () => {
    const fetchHtml = vi.fn(async (_provider: string, _url: string) => fixture('zorocloud.html'));
    const results = await new ZoroCloudAdapter(fetchHtml).check();

    expect(fetchHtml).toHaveBeenCalledTimes(27);
    expect(fetchHtml.mock.calls.map(([, url]) => url)).toContain(
      'https://my.zorocloud.com/store/hkcn2',
    );
    expect(fetchHtml.mock.calls.map(([, url]) => url)).toContain(
      'https://my.zorocloud.com/store/id-isp',
    );
    // Same fixture reused per category; WHMCS product IDs are global, so they dedupe.
    expect(results).toHaveLength(2);
  });
});
