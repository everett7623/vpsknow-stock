import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SixSixCloudsAdapter } from '../666clouds.js';

describe('SixSixCloudsAdapter', () => {
  it('parses embedded /shop catalog stock and plan SKUs', () => {
    const html = readFileSync(join(__dirname, 'fixtures', '666clouds.html'), 'utf8');
    const results = new SixSixCloudsAdapter().parse(html);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      provider: '666clouds',
      productId: '666clouds-214-80',
      planName: '菲律宾双ISP - 1TB流量 · 1核1G',
      location: 'Philippines',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 15,
      storageType: 'SSD',
      bandwidthTb: 1,
      price: 8000,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://www.666clouds.com/shop/214?planSubId=80&cycle=monthly',
      displaySpecs: { bandwidth: '1024GB流量', port: '200Mbps' },
      raw: {
        groupId: 26,
        productId: 214,
        planSubId: 80,
        stock: 3,
        stockNote: '现货',
      },
    });
    expect(results[1]).toMatchObject({
      productId: '666clouds-214-81',
      billingCycle: 'annually',
      price: 96000,
      inStock: false,
      raw: { stock: 0 },
    });
    expect(results[2]).toMatchObject({
      productId: '666clouds-187',
      location: 'United States',
      inStock: false,
    });
  });
});
