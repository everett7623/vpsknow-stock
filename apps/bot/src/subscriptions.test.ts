import { describe, expect, it, vi } from 'vitest';
import {
  PROVIDERS,
  REGIONS,
  formatSubscriptionStatus,
  normalizeSubscriptionRegions,
  parseMaxPriceCents,
  parseMuteHours,
  parseSubscribeStartPayload,
  toggleFilter,
  toggleProvider,
} from './subscriptions.js';

describe('subscription helpers', () => {
  it('exposes the full active monitoring provider set', () => {
    const slugs = PROVIDERS.map(([slug]) => slug);
    expect(slugs).toHaveLength(22);
    expect(slugs).toEqual(
      expect.arrayContaining(['hncloud', 'buyvm', 'dmit', 'evoxt', '666clouds', 'yunyoo']),
    );
    expect(slugs).not.toContain('zgocloud');
    expect(slugs).not.toContain('vmiss');
    expect(slugs).not.toEqual(
      expect.arrayContaining(['onidel', 'tierhive', 'clouvider', 'liteserver']),
    );
  });

  it('uses coarse regions shared with the website', () => {
    expect(REGIONS).toEqual(expect.arrayContaining(['Asia', 'US West', 'Europe', 'Other']));
    expect(normalizeSubscriptionRegions(['Tokyo', 'Los Angeles'])).toEqual(['Asia', 'US West']);
  });

  it('parses subscribe deep-link payloads with optional provider slug', () => {
    expect(parseSubscribeStartPayload('subscribe')).toEqual({
      mode: 'subscribe',
      providerSlug: null,
    });
    expect(parseSubscribeStartPayload('subscribe_buyvm')).toEqual({
      mode: 'subscribe',
      providerSlug: 'buyvm',
    });
    expect(parseSubscribeStartPayload('subscribe_unknownhost')).toEqual({
      mode: 'subscribe',
      providerSlug: null,
    });
    expect(parseSubscribeStartPayload('')).toBeNull();
  });
  it('parses mute duration with an eight-hour default and safe bounds', () => {
    expect(parseMuteHours('')).toBe(8);
    expect(parseMuteHours(' 24 ')).toBe(24);
    expect(parseMuteHours('0')).toBeNull();
    expect(parseMuteHours('169')).toBeNull();
    expect(parseMuteHours('eight')).toBeNull();
  });

  it('parses a maximum USD price and explicit limit removal', () => {
    expect(parseMaxPriceCents('12.50')).toBe(1250);
    expect(parseMaxPriceCents('off')).toBeNull();
    expect(parseMaxPriceCents('0')).toBeUndefined();
    expect(parseMaxPriceCents('12.999')).toBeUndefined();
  });

  it('formats active filters and preserves all-provider defaults', () => {
    expect(formatSubscriptionStatus({
      providers: [],
      regions: ['Tokyo'],
      categories: ['vps'],
      maxPriceCents: 1200,
      eventTypes: ['restock'],
      isActive: true,
      mutedUntil: null,
    })).toContain('Regions: Asia');
  });

  it('reports an active future mute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T00:00:00.000Z'));
    expect(formatSubscriptionStatus({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: null,
      eventTypes: ['restock', 'offers'],
      isActive: true,
      mutedUntil: new Date('2026-07-27T08:00:00.000Z'),
    })).toContain('Muted until 2026-07-27T08:00:00.000Z');
    vi.useRealTimers();
  });

  it('toggles provider whitelist entries without duplicates', () => {
    expect(toggleProvider([], 'buyvm')).toEqual(['buyvm']);
    expect(toggleProvider(['buyvm', 'dmit'], 'buyvm')).toEqual(['dmit']);
    expect(toggleFilter(['Asia'], 'Europe')).toEqual(['Asia', 'Europe']);
  });
});
