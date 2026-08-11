import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseVmissTgChannelHtml } from './vmiss-tg.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}

describe('parseVmissTgChannelHtml', () => {
  it('parses restock and sold-out signals with pid and ignores foreign aff ids', () => {
    const signals = parseVmissTgChannelHtml(fixture('vmiss-tg-channel.html'));

    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      messageId: 700,
      planName: 'US.LA.9929.Pro',
      pid: '41',
      inStock: true,
      priceCents: 1600,
      currency: 'CAD',
      ramMb: 2048,
      storageGb: 20,
      portMbps: 300,
      ipv4: true,
    });
    expect(signals[0]!.statusAt?.toISOString()).toBe('2026-08-10T04:52:07.000Z');
    expect(signals[0]!.locationHint).toContain('洛杉矶');

    expect(signals[1]).toMatchObject({
      messageId: 701,
      planName: 'US.LA.CMIN2.Basic',
      pid: '44',
      inStock: false,
      priceCents: 500,
    });
    expect(signals[1]!.statusAt?.toISOString()).toBe('2026-08-10T06:09:13.000Z');
  });

  it('returns an empty list for unrelated HTML', () => {
    expect(parseVmissTgChannelHtml('<html><body>no messages</body></html>')).toEqual([]);
  });
});
