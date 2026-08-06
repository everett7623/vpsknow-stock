import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductDetail, getProductOrderUrl } from '@/lib/data';
import { formatDate, formatPrice, formatBandwidth, formatIpv4, resolveStockAvailability, botSubscribeUrl } from '@/lib/utils';
import { PriceHistory } from './price-history';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; plan: string }>;
}): Promise<Metadata> {
  const { slug, plan } = await params;
  const product = await getProductDetail(slug, decodeURIComponent(plan));
  if (!product) return { title: 'Plan Not Found' };
  const description = `${product.planName} by ${product.provider.name} in ${product.location}: ${formatPrice(product)}, ${product.inStock ? 'currently in stock' : 'currently out of stock'}.`;
  return {
    title: `${product.planName} — ${product.provider.name}`,
    description,
    alternates: {
      canonical: `/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`,
    },
    openGraph: { title: product.planName, description },
  };
}

function formatRam(ramMb: number | null): string {
  if (!ramMb) return 'N/A';
  return ramMb >= 1024 ? `${ramMb / 1024} GB` : `${ramMb} MB`;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; plan: string }>;
}) {
  const { slug, plan } = await params;
  const product = await getProductDetail(slug, decodeURIComponent(plan));
  if (!product) notFound();

  const availability = resolveStockAvailability(product.inStock, product.availabilitySource);
  const specs = [
    ['CPU', product.cpu || 'N/A'],
    ['RAM', formatRam(product.ramMb)],
    [
      'Storage',
      product.storageGb
        ? `${product.storageGb} GB${product.storageType ? ` ${product.storageType}` : ''}`
        : 'N/A',
    ],
    ['Bandwidth', formatBandwidth(product.bandwidthTb, product.bandwidthLabel)],
    ['IPv4', formatIpv4(product.ipv4)],
    ['Category', product.category.toUpperCase()],
    ['Billing', product.billingCycle],
    [
      'Availability',
      availability === 'in' ? 'In stock' : availability === 'unknown' ? 'Unknown (catalog)' : 'Sold out',
    ],
  ];
  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'}/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.planName,
    description: `${product.cpu || 'VPS'}, ${formatRam(product.ramMb)}, ${product.location}`,
    brand: { '@type': 'Brand', name: product.provider.name },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency,
      price: (product.priceCents / 100).toFixed(2),
      availability:
        availability === 'in'
          ? 'https://schema.org/InStock'
          : availability === 'unknown'
            ? 'https://schema.org/LimitedAvailability'
            : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/providers?p=${product.provider.slug}`} className="hover:text-foreground">Stock</Link>
          <span>/</span>
          <Link href={`/providers?p=${product.provider.slug}`} className="hover:text-foreground">
            {product.provider.name}
          </Link>
          <span>/</span>
          <span className="min-w-0 break-words text-foreground">{product.planName}</span>
        </nav>

        <header className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    availability === 'in'
                      ? 'bg-stock'
                      : availability === 'unknown'
                        ? 'bg-warning'
                        : 'bg-danger'
                  }`}
                />
                <span
                  className={
                    availability === 'in'
                      ? 'text-stock'
                      : availability === 'unknown'
                        ? 'text-warning'
                        : 'text-danger'
                  }
                >
                  {availability === 'in'
                    ? 'In Stock'
                    : availability === 'unknown'
                      ? 'Stock Unknown'
                      : 'Out of Stock'}
                </span>
              </div>
              <h1 className="break-words text-2xl font-bold text-foreground sm:text-3xl">{product.planName}</h1>
              <p className="mt-2 text-muted-foreground">{product.location} · {product.provider.name}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-mono text-2xl font-bold text-stock">{formatPrice(product)}</p>
              {availability === 'in' && product.orderUrl ? (
                <a
                  href={getProductOrderUrl(product.provider.slug, product.productId)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-lg bg-accent px-5 py-2 font-medium text-accent-foreground hover:bg-stock-strong"
                >
                  Order Now
                </a>
              ) : (
                <a
                  href={botSubscribeUrl(product.provider.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-lg border border-sky-300 bg-sky-50 px-5 py-2 font-medium text-sky-700 hover:border-sky-500 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                >
                  Notify Me
                </a>
              )}
            </div>
          </div>
        </header>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Specifications</h2>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-muted sm:grid-cols-2 lg:grid-cols-3">
            {specs.map(([label, value]) => (
              <div key={label} className="bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground/80">{label}</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground/80">Last checked: {formatDate(product.lastCheckedAt)}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Price History</h2>
          <PriceHistory points={product.stockChecks} currency={product.currency} />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Stock Timeline</h2>
          {product.stockEvents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground/80">
              No stock transitions recorded yet.
            </div>
          ) : (
            <ol className="space-y-3">
              {product.stockEvents.map((event) => {
                const restock = event.eventType === 'restock';
                const manual = event.eventType === 'manual_override';
                return (
                  <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${restock ? 'bg-stock' : 'bg-danger'}`} />
                    <span className={restock ? 'text-stock' : manual ? 'text-warning' : 'text-danger'}>
                      {restock ? 'Restocked' : manual ? 'Manual Override' : 'Sold Out'}
                    </span>
                    <time className="w-full font-mono text-xs text-muted-foreground/80 sm:ml-auto sm:w-auto">
                      {formatDate(event.detectedAt)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
