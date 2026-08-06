import { JITTER_FACTOR } from './constants.js';
import type { BillingCycle } from './types.js';

const ALLOWED_OFFER_SOURCE_HOSTS = new Set([
  'lowendtalk.com',
  'www.lowendtalk.com',
  'lowendbox.com',
  'www.lowendbox.com',
  'lowendspirit.com',
  'www.lowendspirit.com',
]);

/**
 * Public Source CTA may only point at the three approved offer forums.
 * Other hosts (including competitor stock sites) must never be shown.
 */
export function allowedOfferSourceUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !ALLOWED_OFFER_SOURCE_HOSTS.has(url.hostname)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Add random jitter to an interval (±JITTER_FACTOR).
 * Returns milliseconds.
 */
export function withJitter(intervalMs: number): number {
  const jitter = intervalMs * JITTER_FACTOR;
  return intervalMs + (Math.random() * 2 - 1) * jitter;
}

/**
 * Convert a price to monthly equivalent in cents.
 */
export function toMonthlyCents(amountCents: number, cycle: BillingCycle): number {
  const divisors: Record<BillingCycle, number> = {
    monthly: 1,
    quarterly: 3,
    'semi-annually': 6,
    annually: 12,
    biennially: 24,
    triennially: 36,
  };
  return Math.round(amountCents / divisors[cycle]);
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
