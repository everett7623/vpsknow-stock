import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HNCloudAdapter } from '../hncloud.js';

function fixture(): string {
  return readFileSync(join(__dirname, 'fixtures', 'hncloud.html'), 'utf8');
}

describe('HNCloudAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses activity inventory and the rendered sale button as the stock authority', () => {
    const results = new HNCloudAdapter().parse(fixture());

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      provider: 'hncloud',
      productId: 'hncloud-715',
      planName: 'Japan Cloud Server 1H1G',
      location: 'Tokyo, Japan',
      cpu: '1 vCPU',
      ramMb: 1024,
      storageGb: 50,
      price: 1990,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: true,
      raw: { stock: 10, sold: 2, remaining: 8, status: 0 },
    });
    expect(results[1]).toMatchObject({
      productId: 'hncloud-60',
      inStock: false,
      raw: { stock: 10, sold: 10, remaining: 0 },
    });
    expect(results[2]).toMatchObject({
      productId: 'hncloud-771',
      bandwidthTb: 1600 / 1024,
      inStock: false,
      raw: { stock: 10, sold: 0, remaining: 10 },
    });
  });

  it('requests the limited-stock activity page with the required user agent', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('User-Agent')).toBe('VPSKnow-Stock/1.0');
      return new Response(fixture(), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await new HNCloudAdapter().check();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toHaveLength(3);
  });
});
