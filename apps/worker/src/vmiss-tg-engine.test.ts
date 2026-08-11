import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseVmissTgChannelHtml } from '@vpsknow/parsers';
import {
  discoverVmissTgSignals,
  stockResultFromVmissTgSignal,
} from './vmiss-tg-engine.js';

const fixtureHtml = readFileSync(
  join(__dirname, '../../../packages/parsers/src/__fixtures__/vmiss-tg-channel.html'),
  'utf8',
);

describe('stockResultFromVmissTgSignal', () => {
  it('maps TG pid to our cart URL and never keeps the foreign affiliate id', () => {
    const [restock] = parseVmissTgChannelHtml(fixtureHtml);
    expect(restock).toBeDefined();

    const result = stockResultFromVmissTgSignal(restock!);
    expect(result).toMatchObject({
      provider: 'vmiss',
      // Catalog identity for US.LA.9929.Pro (TG pid may differ).
      productId: 'vmiss-59',
      planName: 'US.LA.9929.Pro',
      inStock: true,
      orderUrl: 'https://app.vmiss.com/cart.php?a=add&pid=41',
      raw: { source: 'vmiss-tg', messageId: 700, tgPid: '41' },
    });
    expect(result?.orderUrl).not.toContain('aff=2762');
  });
});

describe('discoverVmissTgSignals', () => {
  it('baselines on first run without replaying historical restocks', async () => {
    const store = new Map<string, string>();
    const redis = {
      get: async (key: string): Promise<string | null> => store.get(key) ?? null,
      set: async (key: string, value: string): Promise<'OK'> => {
        store.set(key, value);
        return 'OK';
      },
    };
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const summary = await discoverVmissTgSignals(
      redis,
      logger as never,
      async () => fixtureHtml,
    );

    expect(summary).toMatchObject({
      fetched: 2,
      baseline: true,
      newSignals: 0,
      restocked: 0,
      soldOut: 0,
      skipped: 2,
    });
    expect(store.get('vmiss-tg:last-message-id')).toBe('701');
  });

});
