import { describe, expect, it } from 'vitest';
import { registry } from '@vpsknow/providers';
import { PROVIDER_INTERVALS, isMonitoredProvider } from './provider-schedule.js';

const IMPLEMENTED_ALLOWLIST = [
  'bandwagonhost',
  'dmit',
  'buyvm',
  'greencloudvps',
  'spartanhost',
  // vmiss: temporarily unscheduled — Cloudflare 403 from worker IP
  'vps',
  'saltyfish',
  'racknerd',
  'dedirock',
  'bagevm',
  'vmrack',
  'gomami',
  'colocrossing',
  'chicagovps',
  'lightlayer',
  'speedypage',
  'bestvm',
  'neburst',
  'hncloud',
] as const;

describe('provider scheduling allowlist', () => {
  it('schedules only the approved providers with implemented adapters', () => {
    expect(Object.keys(PROVIDER_INTERVALS).sort()).toEqual([...IMPLEMENTED_ALLOWLIST].sort());
    expect(Object.keys(PROVIDER_INTERVALS).every((slug) => registry.has(slug))).toBe(true);
    expect(registry.has('vmiss')).toBe(true);
    expect(isMonitoredProvider('vmiss')).toBe(false);
  });

  it('rejects registered providers outside the approved monitoring scope', () => {
    expect(isMonitoredProvider('liteserver')).toBe(false);
    expect(isMonitoredProvider('servarica')).toBe(false);
    expect(isMonitoredProvider('webhorizon')).toBe(false);
  });

  it('keeps providers without adapters out of scheduling until implementation', () => {
    expect(isMonitoredProvider('highendnetwork')).toBe(false);
  });
});
