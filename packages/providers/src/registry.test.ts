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
  // Phase 4 A-Tier
  'racknerd',
  'clouvider',
  'liteserver',
  'crunchbits',
  'servarica',
  'evoxt',
  'alwyzon',
  'dedirock',
  'onidel',
  'bagevm',
  // Phase 4 B-Tier
  'tierhive',
  'gullos',
  'webhorizon',
  'vmrack',
  'gomami',
  'zgocloud',
  'colocrossing',
  'chicagovps',
  'lightlayer',
  'speedypage',
  'bestvm',
  'neburst',
  'hncloud',
  '666clouds',
  'yunyoo',
] as const;

describe('provider registry', () => {
  it('registers every provider that does not require credentials', () => {
    expect([...registry.keys()].sort()).toEqual([...REQUIRED_PROVIDERS].sort());
  });

  it('does not register Netcup for stock monitoring', () => {
    expect(registry.has('netcup')).toBe(false);
  });
});
