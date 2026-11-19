import type { Product } from '@vpsknow/database';
import { currencyPrefix } from '@vpsknow/shared';
import { DEFAULT_LOCALE, intlLocale, type Locale } from '@/lib/i18n/config';
import { dictionaries } from '@/lib/i18n/dictionaries';

export function formatPrice(product: Product): string {
  const amount = (product.priceCents / 100).toFixed(2);
  const cycle = product.billingCycle;
  const suffix = cycle === 'monthly' ? 'mo' : cycle === 'annually' ? 'yr' : cycle;
  return `${currencyPrefix(product.currency)}${amount}/${suffix}`;
}

const BILLING_MONTHS: Readonly<Record<string, number>> = {
  monthly: 1,
  quarterly: 3,
  'semi-annually': 6,
  annually: 12,
  biennially: 24,
  triennially: 36,
};

/** Normalize mixed billing cycles before comparing plan prices. */
export function monthlyEquivalentCents(product: Pick<Product, 'priceCents' | 'billingCycle'>): number {
  return product.priceCents / (BILLING_MONTHS[product.billingCycle] ?? 1);
}

export function formatMonthlyEquivalent(
  product: Pick<Product, 'priceCents' | 'billingCycle' | 'currency'>,
): string {
  return `${currencyPrefix(product.currency)}${(monthlyEquivalentCents(product) / 100).toFixed(2)} ${product.currency}/mo`;
}

export function formatDate(date: Date | string | null, locale: Locale = DEFAULT_LOCALE): string {
  if (!date) return dictionaries[locale].common.never;
  return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
}

/** Human-friendly relative time for live monitoring UIs. */
export function formatRelativeTime(
  date: Date | string | null,
  now = Date.now(),
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (!date) return dictionaries[locale].common.unknown;
  const then = new Date(date).getTime();
  if (!Number.isFinite(then)) return dictionaries[locale].common.unknown;

  const deltaMs = then - now;
  const absMs = Math.abs(deltaMs);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });

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

/** Deep-link into the Telegram bot subscribe flow, optionally preselecting a provider. */
export function botSubscribeUrl(providerSlug?: string): string {
  const payload = providerSlug ? `subscribe_${providerSlug}` : 'subscribe';
  return `https://t.me/vpsknow_stock_bot?start=${encodeURIComponent(payload)}`;
}

export type StockAvailability = 'in' | 'out' | 'unknown';

export function resolveStockAvailability(
  inStock: boolean,
  availabilitySource?: string | null,
): StockAvailability {
  if (availabilitySource === 'catalog') return 'unknown';
  return inStock ? 'in' : 'out';
}

export function formatBandwidth(
  bandwidthTb: number | null | undefined,
  bandwidthLabel?: string | null,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const label = bandwidthLabel?.trim();
  if (label) return label;
  const t = dictionaries[locale].common;
  if (bandwidthTb == null || bandwidthTb <= 0) return t.na;
  if (bandwidthTb >= 100) return t.unlimited;
  if (bandwidthTb >= 1) {
    const rounded = Number.isInteger(bandwidthTb) ? bandwidthTb.toFixed(0) : bandwidthTb.toFixed(1);
    return `${rounded} TB`;
  }
  return `${Math.round(bandwidthTb * 1000)} GB`;
}

export function formatIpv4(ipv4: boolean | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  const t = dictionaries[locale].common;
  if (ipv4 === true) return t.yes;
  if (ipv4 === false) return t.no;
  return t.na;
}
