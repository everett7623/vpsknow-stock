import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CloudSilkAdapter } from '../cloudsilk.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const category = {
  slug: 'mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837',
  location: 'San Jose',
  url: 'https://cloudsilk.io/store/mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837',
};

describe('CloudSilkAdapter', () => {
  it('parses Chinese WHMCS cards and treats 0 可用 as out of stock', () => {
    const results = new CloudSilkAdapter().parse(fixture('cloudsilk.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'cloudsilk',
      productId: 'cloudsilk-mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837-mei-guo-tao-can-a',
      planName: '美国-大陆优化BGP-套餐A',
      location: 'San Jose',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 10,
      storageType: 'SSD',
      bandwidthTb: 800 / 1024,
      price: 15999,
      currency: 'CNY',
      billingCycle: 'annually',
      inStock: false,
      orderUrl: 'https://cloudsilk.io/store/mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837/mei-guo-tao-can-a',
    });
    expect(results[1]).toMatchObject({
      productId: 'cloudsilk-mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837-mei-guo-tao-can-b',
      cpu: '2 vCPUs',
      ramMb: 2048,
      inStock: true,
      orderUrl: 'https://cloudsilk.io/store/mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837/mei-guo-tao-can-b',
    });
  });

  it('checks every public China-optimized CloudSilk store', async () => {
    const fetchHtml = vi.fn(async (_provider: string, _url: string): Promise<string> =>
      fixture('cloudsilk.html'),
    );
    const results = await new CloudSilkAdapter(fetchHtml).check();

    expect(fetchHtml.mock.calls.map(([, url]) => url)).toEqual([
      'https://cloudsilk.io/store/mei-guo-sheng-he-sai-da-lu-you-hua-bgp4837',
      'https://cloudsilk.io/store/mei-guo-sheng-he-sai-jing-pin-da-lu-you-hua-bgp9929',
      'https://cloudsilk.io/store/de-guo-fa-lan-ke-fu-da-lu-jing-pin-you-hua-bgp',
    ]);
    // Same fixture reused per category; product IDs include the store slug.
    expect(results).toHaveLength(6);
  });
});
