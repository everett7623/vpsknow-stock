import { JITTER_FACTOR } from './constants.js';
import type { BillingCycle } from './types.js';

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
