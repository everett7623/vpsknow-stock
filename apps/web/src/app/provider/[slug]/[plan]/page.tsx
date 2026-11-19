import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StockBadge } from '@/components/stock-badge';
import { getProductDetail, getProductOrderUrl } from '@/lib/data';
import { getDictionary } from '@/lib/i18n/get-locale';
import { formatDate, formatPrice, formatBandwidth, formatIpv4, resolveStockAvailability, botSubscribeUrl } from '@/lib/utils';
import { PriceHistory } from './price-history';
import { lineTypeLabel } from '@/lib/plan-tags';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; plan: string }>;
}): Promise<Metadata> {
  const { slug, plan } = await params;
  const [{ dictionary }, product] = await Promise.all([
    getDictionary(),
    getProductDetail(slug, decodeURIComponent(plan)),
  ]);
  if (!product) return { title: dictionary.plan.notFound };
  const isZh = dictionary.nav.home === '首页';
  const availabilityText = product.inStock
    ? dictionary.plan.currentlyInStock
    : dictionary.plan.currentlyOutOfStock;
  const description = isZh
    ? `${product.provider.name} 的 ${product.planName}（${product.location}）：${formatPrice(product)}，${availabilityText}。`
    : `${product.planName} by ${product.provider.name} in ${product.location}: ${formatPrice(product)}, ${availabilityText}.`;
  return {
    title: `${product.planName} — ${product.provider.name}`,
    description,
    alternates: {
      canonical: `/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`,
    },
    openGraph: { title: product.planName, description },
  };
}

function formatRam(ramMb: number | null, na: string): string {
  if (!ramMb) return na;
  return ramMb >= 1024 ? `${ramMb / 1024} GB` : `${ramMb} MB`;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string; plan: string }>;
}) {
  const { slug, plan } = await params;
  const [{ locale, dictionary }, product] = await Promise.all([
    getDictionary(),
    getProductDetail(slug, decodeURIComponent(plan)),
  ]);
  if (!product) notFound();
  const t = dictionary.plan;

  const availability = resolveStockAvailability(product.inStock, product.availabilitySource);
  const specs = [
    [t.cpu, product.cpu || dictionary.common.na],
    [t.ram, formatRam(product.ramMb, dictionary.common.na)],
    [
      t.storage,
      product.storageGb
        ? `${product.storageGb} GB${product.storageType ? ` ${product.storageType}` : ''}`
        : dictionary.common.na,
    ],
    [t.bandwidth, formatBandwidth(product.bandwidthTb, product.bandwidthLabel, locale)],
    [t.optimizedLine, lineTypeLabel(product.lineType, dictionary.providers.standardLine)],
    [t.ipv4, formatIpv4(product.ipv4, locale)],
    [t.category, product.category.toUpperCase()],
    [t.billing, product.billingCycle],
    [
      t.availability,
      availability === 'in'
        ? t.inStock
        : availability === 'unknown'
          ? t.unknownCatalog
          : t.soldOutStatus,
    ],
  ];
  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'}/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.planName,
    description: `${product.cpu || 'VPS'}, ${formatRam(product.ramMb, dictionary.common.na)}, ${product.location}`,
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
          <Link href={`/providers?p=${product.provider.slug}`} className="hover:text-foreground">
            {t.stock}
          </Link>
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
              <div className="mb-3">
                <StockBadge
                  inStock={product.inStock}
                  availabilitySource={product.availabilitySource}
                  pulse={availability === 'in'}
                />
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
                  {dictionary.common.orderNow}
                </a>
              ) : (
                <a
                  href={botSubscribeUrl(product.provider.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-lg border border-sky-300 bg-sky-50 px-5 py-2 font-medium text-sky-700 hover:border-sky-500 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                >
                  {dictionary.common.notifyMe}
                </a>
              )}
            </div>
          </div>
        </header>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">{t.specifications}</h2>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-muted sm:grid-cols-2 lg:grid-cols-3">
            {specs.map(([label, value]) => (
              <div key={label} className="bg-card p-4">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground/80">{label}</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground/80">
            {t.lastChecked}{formatDate(product.lastCheckedAt, locale)}
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">{t.priceHistory}</h2>
          <PriceHistory points={product.stockChecks} currency={product.currency} />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">{t.stockTimeline}</h2>
          {product.stockEvents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground/80">
              {t.noTransitions}
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
                      {restock ? t.restocked : manual ? t.manualOverride : t.soldOut}
                    </span>
                    <time className="w-full font-mono text-xs text-muted-foreground/80 sm:ml-auto sm:w-auto">
                      {formatDate(event.detectedAt, locale)}
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
