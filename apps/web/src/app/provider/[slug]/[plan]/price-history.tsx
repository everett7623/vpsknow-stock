import { currencyPrefix } from '@vpsknow/shared';

interface PricePoint {
  id: string;
  priceCents: number | null;
  checkedAt: Date;
}

function money(priceCents: number, currency: string): string {
  return `${currencyPrefix(currency)}${(priceCents / 100).toFixed(2)}`;
}

export function PriceHistory({
  points,
  currency,
}: {
  points: PricePoint[];
  currency: string;
}) {
  const values = points
    .filter((point): point is PricePoint & { priceCents: number } => point.priceCents !== null)
    .reverse();

  if (values.length < 2) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground/80">
        Price history will appear after at least two stock checks.
      </div>
    );
  }

  const width = 720;
  const height = 220;
  const padding = 28;
  const prices = values.map((point) => point.priceCents);
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const range = maximum - minimum || 1;
  const coordinates = values.map((point, index) => {
    const x = padding + (index / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.priceCents - minimum) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const first = values[0]!;
  const last = values.at(-1)!;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Price history from ${money(first.priceCents, currency)} to ${money(last.priceCents, currency)}`}
        className="h-auto w-full"
      >
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" className="text-border" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" className="text-border" />
        <polyline points={coordinates} fill="none" stroke="currentColor" className="text-stock" strokeWidth="3" strokeLinejoin="round" />
        <text x={padding} y="18" fill="currentColor" className="text-muted-foreground" fontSize="12">{money(maximum, currency)}</text>
        <text x={padding} y={height - 7} fill="currentColor" className="text-muted-foreground" fontSize="12">{money(minimum, currency)}</text>
      </svg>
      <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground/80">
        <span>{first.checkedAt.toISOString().slice(0, 10)}</span>
        <span>{values.length} checks</span>
        <span>{last.checkedAt.toISOString().slice(0, 10)}</span>
      </div>
    </div>
  );
}
