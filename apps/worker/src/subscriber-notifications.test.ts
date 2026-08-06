import { describe, expect, it } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import {
  matchesOfferSubscription,
  matchesRestockSubscription,
} from './subscriber-notifications.js';

const result: StockResult = {
  provider: 'buyvm',
  productId: 'slice-1024-lv',
  planName: 'Slice 1024',
  location: 'Las Vegas',
  category: 'vps',
  cpu: '1 Core',
  ramMb: 1024,
  storageGb: 20,
  storageType: 'SSD',
  bandwidthTb: 1,
  ipv4: true,
  ipv6: true,
  price: 350,
  currency: 'USD',
  billingCycle: 'monthly',
  inStock: true,
  orderUrl: 'https://buyvm.net/order',
};

describe('subscriber notification matching', () => {
  it('matches empty filters as all-inclusive', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
  });

  it('requires every configured filter to match', () => {
    expect(matchesRestockSubscription({
      providers: ['buyvm'],
      regions: ['Las Vegas'],
      categories: ['vps'],
      maxPriceCents: 500,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: ['dmit'],
      regions: ['Las Vegas'],
      categories: ['vps'],
      maxPriceCents: 500,
    }, result)).toBe(false);
  });

  it('does not compare non-USD prices against a USD limit', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: 10_000,
    }, { ...result, currency: 'EUR' })).toBe(false);
  });

  it('matches coarse and legacy region filters against free-text locations', () => {
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['US West'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Las Vegas'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(true);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Asia'],
      categories: [],
      maxPriceCents: null,
    }, result)).toBe(false);
    expect(matchesRestockSubscription({
      providers: [],
      regions: ['Tokyo'],
      categories: [],
      maxPriceCents: null,
    }, { ...result, location: 'Tokyo Narita' })).toBe(true);
  });

  it('matches offers using normalized providers and any overlapping region', () => {
    expect(matchesOfferSubscription({
      providers: ['greencloudvps'],
      regions: ['Asia'],
      categories: ['vps'],
      maxPriceCents: 2500,
    }, {
      provider: 'GreenCloudVPS',
      locations: ['Hong Kong', 'Tokyo'],
      category: 'vps',
      priceCents: 2400,
      currency: 'USD',
    })).toBe(true);
  });

  it('rejects offers with unknown prices when a maximum is configured', () => {
    expect(matchesOfferSubscription({
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: 2500,
    }, {
      provider: 'ExampleHost',
      locations: [],
      category: 'vps',
      priceCents: null,
      currency: null,
    })).toBe(false);
  });
});
