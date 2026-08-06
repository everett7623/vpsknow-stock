import type { Product } from '@vpsknow/database';

export function formatPrice(product: Product): string {
  const amount = (product.priceCents / 100).toFixed(2);
  const cycle = product.billingCycle;
  const symbol = product.currency === 'EUR' ? '€' : product.currency === 'CNY' ? '¥' : '$';
  const suffix = cycle === 'monthly' ? 'mo' : cycle === 'annually' ? 'yr' : cycle;
  return `${symbol}${amount}/${suffix}`;
}

export function formatDate(date: Date | string | null): string {
  if (!date) return 'never';
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

/** Human-friendly relative time for live monitoring UIs. */
export function formatRelativeTime(date: Date | string | null, now = Date.now()): string {
  if (!date) return 'unknown';
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return 'unknown';

  const deltaMs = then - now;
  const absMs = Math.abs(deltaMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (absMs < 45_000) {
    value = Math.round(absMs / 1000);
    unit = 'second';
  } else if (minutes < 60) {
    value = minutes;
    unit = 'minute';
  } else if (hours < 48) {
    value = hours;
    unit = 'hour';
  } else {
    value = days;
    unit = 'day';
  }

  return rtf.format(deltaMs < 0 ? -value : value, unit);
}
