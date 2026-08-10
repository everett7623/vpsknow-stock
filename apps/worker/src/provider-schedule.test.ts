import { describe, expect, it } from 'vitest';
import { ACTIVE_PROVIDER_SLUGS } from '@vpsknow/shared';
import { registry } from '@vpsknow/providers';
import { PROVIDER_INTERVALS, isMonitoredProvider } from './provider-schedule.js';

describe('provider scheduling allowlist', () => {
  it('schedules approved providers that have implemented adapters', () => {
    expect(Object.keys(PROVIDER_INTERVALS).sort()).toEqual([...ACTIVE_PROVIDER_SLUGS].sort());
    expect(Object.keys(PROVIDER_INTERVALS).every((slug) => registry.has(slug))).toBe(true);
  });

  it('rejects providers with PLACEHOLDER affiliates or missing adapters', () => {
    expect(isMonitoredProvider('servarica')).toBe(false);
    expect(isMonitoredProvider('webhorizon')).toBe(false);
    expect(isMonitoredProvider('crunchbits')).toBe(false);
    expect(isMonitoredProvider('alwyzon')).toBe(false);
    expect(isMonitoredProvider('gullos')).toBe(false);
    expect(isMonitoredProvider('onidel')).toBe(false);
    expect(isMonitoredProvider('tierhive')).toBe(false);
    expect(isMonitoredProvider('clouvider')).toBe(false);
    expect(isMonitoredProvider('liteserver')).toBe(false);
    expect(isMonitoredProvider('evoxt')).toBe(false);
    expect(isMonitoredProvider('highendnetwork')).toBe(false);
  });
});
