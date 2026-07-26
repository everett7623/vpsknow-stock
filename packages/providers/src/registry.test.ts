import { describe, expect, it } from 'vitest';
import { registry } from './registry.js';

const REQUIRED_PROVIDERS = [
  'bandwagonhost',
  'dmit',
  'buyvm',
  'greencloudvps',
  'spartanhost',
  'vmiss',
  'vps',
  'saltyfish',
  'akilecloud',
] as const;

describe('provider registry', () => {
  it('registers every provider that does not require credentials', () => {
    expect([...registry.keys()].sort()).toEqual([...REQUIRED_PROVIDERS].sort());
  });

  it('does not register Netcup for stock monitoring', () => {
    expect(registry.has('netcup')).toBe(false);
  });
});
