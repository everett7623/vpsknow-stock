import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BestVMAdapter } from '../bestvm.js';

const category = {
  slug: 'jp-b',
  location: 'Tokyo',
  url: 'https://bestvm.cloud/store/jp-b',
} as const;

describe('BestVMAdapter', () => {
  it('parses authoritative quantity, Chinese specifications, and WHMCS product IDs', () => {
    const html = readFileSync(join(__dirname, 'fixtures', 'bestvm.html'), 'utf8');
    const results = new BestVMAdapter().parse(html, category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'bestvm',
      productId: 'bestvm-373',
      planName: '日本BGP-B-1T',
      location: 'Tokyo',
      cpu: '1 vCPU',
      ramMb: 512,
      storageGb: 5,
      storageType: 'SSD',
      bandwidthTb: 1000 / 1024,
      ipv4: true,
      ipv6: true,
      price: 2200,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: false,
      orderUrl: 'https://bestvm.cloud/store/jp-b/1t',
      raw: { available: 0 },
    });
    expect(results[1]).toMatchObject({
      productId: 'bestvm-374',
      cpu: '2 vCPUs',
      ramMb: 2048,
      storageGb: 1024,
      storageType: 'NVMe',
      bandwidthTb: 2,
      price: 123450,
      billingCycle: 'annually',
      inStock: true,
      raw: { available: 8 },
    });
  });
});
