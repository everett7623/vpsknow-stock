import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NeburstAdapter } from '../neburst.js';

function fixture(): unknown {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'neburst.json'), 'utf8')) as unknown;
}

describe('NeburstAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges duplicate backend shapes per region and preserves authoritative availability', () => {
    const results = new NeburstAdapter().parse(fixture());

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'neburst',
      planName: 'S3N-1C2G',
      location: 'Hong Kong (HKG)',
      cpu: '1 vCPU',
      ramMb: 2048,
      storageGb: 20,
      storageType: 'SSD',
      bandwidthTb: 500 / 1024,
      price: 3990,
      currency: 'USD',
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://neburst.com/product/checkout',
      raw: { regionCode: 'asia-hk', shapeIds: ['shape-a', 'shape-b'] },
    });
    expect(results[1]).toMatchObject({
      location: 'Tokyo (NRT)',
      inStock: false,
      raw: { regionCode: 'asia-jp', shapeIds: ['shape-a', 'shape-b'] },
    });
  });

  it('signs the public pricing request with the exact user agent', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('User-Agent')).toBe('VPSKnow-Stock/1.0');
      expect(headers.get('Neburst-Request-Time')).toMatch(/^\d+$/);
      expect(headers.get('Neburst-Request-Id')).toMatch(/^[a-f0-9]{32}$/);
      return Response.json(fixture());
    });
    vi.stubGlobal('fetch', fetchMock);

    const results = await new NeburstAdapter().check();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toHaveLength(2);
  });
});
