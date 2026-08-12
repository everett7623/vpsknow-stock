import { resolveStockAvailability, type StockAvailability } from '@/lib/utils';

const STYLES: Record<StockAvailability, string> = {
  in: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  out: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  unknown: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
};

const LABELS: Record<StockAvailability, string> = {
  in: 'In Stock',
  out: 'Sold Out',
  unknown: 'Unknown',
};

export function StockBadge({
  inStock,
  availabilitySource,
  pulse = false,
}: {
  inStock: boolean;
  availabilitySource?: string | null;
  /** Subtle pulse for live in-stock (respects prefers-reduced-motion via CSS). */
  pulse?: boolean;
}): React.JSX.Element {
  const availability = resolveStockAvailability(inStock, availabilitySource);
  const pulseClass = pulse && availability === 'in'
    ? 'motion-safe:animate-pulse'
    : '';

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STYLES[availability]} ${pulseClass}`}
    >
      {LABELS[availability]}
    </span>
  );
}
