import { describe, expect, it, vi } from 'vitest';
import {
  formatSubscriptionStatus,
  parseMuteHours,
  toggleFilter,
  toggleProvider,
} from './subscriptions.js';

describe('subscription helpers', () => {
  it('parses mute duration with an eight-hour default and safe bounds', () => {
    expect(parseMuteHours('')).toBe(8);
    expect(parseMuteHours(' 24 ')).toBe(24);
    expect(parseMuteHours('0')).toBeNull();
    expect(parseMuteHours('169')).toBeNull();
    expect(parseMuteHours('eight')).toBeNull();
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
    })).toContain('Providers: All');
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
    expect(toggleFilter(['Tokyo'], 'Singapore')).toEqual(['Tokyo', 'Singapore']);
  });
});
