import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { YunyooAdapter } from '../yunyoo.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8');
}

const category = {
  slug: 'los-angeles-c-std',
  location: 'Los Angeles',
  url: 'https://yunyoo.cc/cart?fid=1&gid=13',
} as const;

describe('YunyooAdapter', () => {
  it('parses public VPS availability, specifications, and merchant CNY pricing', () => {
    const results = new YunyooAdapter().parse(fixture('yunyoo.html'), category);

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'yunyoo',
      planName: '洛杉矶C.Std.T - Basic',
      location: 'Los Angeles',
      cpu: '2 vCPUs',
      ramMb: 1024,
      storageGb: 30,
      storageType: 'SSD',
      bandwidthTb: 600 / 1024,
      ipv4: true,
      ipv6: false,
      price: 1999,
      currency: 'CNY',
      billingCycle: 'monthly',
      inStock: true,
      orderUrl: 'https://yunyoo.cc/cart?action=configureproduct&pid=151',
      raw: { availability: '充足', category: 'los-angeles-c-std', pid: '151' },
    });
    expect(results[1]).toMatchObject({
      ramMb: 2048,
      bandwidthTb: 700 / 1024,
      ipv6: true,
      inStock: false,
      orderUrl: category.url,
      raw: { availability: '售罄', category: 'los-angeles-c-std' },
    });
  });

  it('checks PID 82 through the order summary before reporting it in stock', async () => {
    const fetchHtml = vi.fn(async (_provider: string, url: string): Promise<string> =>
      url.includes('pid=82') ? fixture('yunyoo-pid82.html') : fixture('yunyoo.html'),
    );
    const quoteFetcher = vi.fn(async (): Promise<string> => fixture('yunyoo-pid82-quote.html'));

    const results = await new YunyooAdapter(fetchHtml, quoteFetcher).check();
    const watched = results.find((result) => result.productId === 'yunyoo-82');

    expect(fetchHtml).toHaveBeenCalledTimes(12);
    expect(quoteFetcher).toHaveBeenCalledOnce();
    expect(watched).toMatchObject({
      planName: '美国一区 CVM - Basic',
      location: 'United States',
      cpu: '2 vCPUs',
      ramMb: 1024,
      storageGb: 30,
      ipv4: true,
      price: 1799,
      currency: 'CNY',
      inStock: true,
      orderUrl: 'https://yunyoo.cc/cart?action=configureproduct&pid=82&aff=HYWEANDG',
      raw: { pid: '82', quoteValidated: true },
    });
  });

  it('records an explicit PID 82 out-of-stock sentinel', async () => {
    const fetchHtml = vi.fn(async (_provider: string, url: string): Promise<string> =>
      url.includes('pid=82') ? fixture('yunyoo-pid82.html') : fixture('yunyoo.html'),
    );
    const quoteFetcher = vi.fn(async (): Promise<string> => fixture('yunyoo-pid82-oos-quote.html'));

    const results = await new YunyooAdapter(fetchHtml, quoteFetcher).check();

    expect(results.find((result) => result.productId === 'yunyoo-82')).toMatchObject({ inStock: false });
  });

  it('does not produce PID 82 when the order summary cannot establish stock state', async () => {
    const fetchHtml = vi.fn(async (_provider: string, url: string): Promise<string> =>
      url.includes('pid=82') ? fixture('yunyoo-pid82.html') : fixture('yunyoo.html'),
    );
    const quoteFetcher = vi.fn(async (): Promise<string> => '<div>unexpected response</div>');
    const adapter = new YunyooAdapter(fetchHtml, quoteFetcher);

    const results = await adapter.check();

    expect(results.some((result) => result.productId === 'yunyoo-82')).toBe(false);
    expect(adapter.warnings.some((warning) => /pid-82:.*summary source is missing/i.test(warning))).toBe(true);
  });
});
