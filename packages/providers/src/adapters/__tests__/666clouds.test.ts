import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SixSixCloudsAdapter } from '../666clouds.js';

const category = {
  slug: 'philippines',
  location: 'Philippines',
  url: 'https://www.666clouds.com/cart.php?gid=26',
} as const;

describe('SixSixCloudsAdapter', () => {
  it('uses authoritative quantity and preserves merchant traffic labels', () => {
    const html = readFileSync(join(__dirname, 'fixtures', '666clouds.html'), 'utf8');
    const results = new SixSixCloudsAdapter().parse(html, category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: '666clouds',
      productId: '666clouds-214',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 15,
      storageType: 'SSD',
      bandwidthTb: 1,
      price: 8000,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://www.666clouds.com/cart.php?a=add&pid=214',
      displaySpecs: { bandwidth: '双向1TB流量', port: '200Mbps' },
      raw: { available: 3, category: 'philippines', pid: '214' },
    });
    expect(results[1]).toMatchObject({
      productId: '666clouds-215',
      storageType: 'NVMe',
      billingCycle: 'annually',
      inStock: false,
      raw: { available: -2 },
    });
  });
});
