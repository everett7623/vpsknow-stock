import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductOrderUrl, getProviderBySlug, getProviderSiteUrl } from '@/lib/data';
import { formatDate, formatPrice, botSubscribeUrl, formatBandwidth, resolveStockAvailability } from '@/lib/utils';
import { lineTypeLabel, detectPlanOfferTag } from '@/lib/plan-tags';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);
  if (!provider) return { title: 'Provider Not Found' };
  const inStock = provider.products.filter((product) => product.inStock).length;
  const description = `${provider.name} VPS stock status, plans, prices, and recent availability. ${inStock} plans currently in stock.`;
  return {
    title: `${provider.name} VPS Stock`,
    description,
    alternates: { canonical: `/provider/${provider.slug}` },
    openGraph: { title: `${provider.name} VPS Stock`, description },
  };
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);
  if (!provider) notFound();

  const inStockProducts = provider.products.filter(
    (product) => resolveStockAvailability(product.inStock, product.availabilitySource) === 'in',
  );
  const outOfStockProducts = provider.products.filter(
    (product) => resolveStockAvailability(product.inStock, product.availabilitySource) === 'out',
  );
  const unknownProducts = provider.products.filter(
    (product) => resolveStockAvailability(product.inStock, product.availabilitySource) === 'unknown',
  );
  const lastCheckedAt = provider.products.reduce<Date | null>((latest, product) => {
    if (!product.lastCheckedAt) return latest;
    return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
  }, null);
  const isStale = !lastCheckedAt || Date.now() - lastCheckedAt.getTime() > 30 * 60 * 1_000;

  const pinPromoThenPrice = <T extends {
    planName: string;
    productId: string;
    priceCents: number;
  }>(products: T[]): T[] => [...products].sort((a, b) => {
    const tagRank = (planName: string, productId: string): number => {
      const tag = detectPlanOfferTag(planName, productId);
      if (tag === 'promo') return 0;
      if (tag === 'limited') return 1;
      if (tag === 'special') return 2;
      return 3;
    };
    const offerDelta = tagRank(a.planName, a.productId) - tagRank(b.planName, b.productId);
    if (offerDelta !== 0) return offerDelta;
    return a.priceCents - b.priceCents;
  });

  const inStockProductsSorted = pinPromoThenPrice(inStockProducts);
  const outOfStockProductsSorted = pinPromoThenPrice(outOfStockProducts);
  const unknownProductsSorted = pinPromoThenPrice(unknownProducts);

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        <Link href={`/providers?p=${provider.slug}`} className="text-muted-foreground transition-colors hover:text-foreground">
          Stock monitor
        </Link>

        <header className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{provider.name}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={getProviderSiteUrl(provider.slug, provider.website)}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-stock hover:opacity-90"
              >
                Official website
              </a>
              <a
                href={botSubscribeUrl(provider.slug)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:border-sky-500 hover:text-sky-800 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
              >
                Subscribe on Telegram
              </a>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last checked: {isStale ? 'Status Unknown' : formatDate(lastCheckedAt)}
          </p>
        </header>

        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-950/50">
            <span className="font-mono text-lg font-bold text-stock">{inStockProducts.length}</span>
            <span className="ml-2 text-sm text-stock/70">In Stock</span>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/40">
            <span className="font-mono text-lg font-bold text-amber-800 dark:text-amber-300">{unknownProducts.length}</span>
            <span className="ml-2 text-sm text-amber-700/80 dark:text-amber-300/80">Unknown</span>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-950/30">
            <span className="font-mono text-lg font-bold text-danger">{outOfStockProducts.length}</span>
            <span className="ml-2 text-sm text-danger/70">Out of Stock</span>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">Available Plans</h2>
          {inStockProducts.length === 0 ? <p className="text-muted-foreground/80">No in-stock plans.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Plan</th><th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">Line</th>
                    <th className="pb-2 pr-4">CPU</th><th className="pb-2 pr-4">RAM</th>
                    <th className="pb-2 pr-4">Storage</th><th className="pb-2 pr-4">Bandwidth</th>
                    <th className="pb-2 pr-4">Price</th>
                    <th className="pb-2 pr-4">Last Checked</th><th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inStockProductsSorted.map((product) => (
                    <tr key={product.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        <Link
                          href={`/provider/${provider.slug}/${encodeURIComponent(product.productId)}`}
                          className="hover:text-stock"
                        >
                          {product.planName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-foreground/80">{product.location}</td>
                      <td className="py-3 pr-4 text-xs text-foreground/80">{lineTypeLabel(product.lineType)}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">{product.cpu || 'N/A'}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {product.ramMb ? `${product.ramMb >= 1024 ? product.ramMb / 1024 : product.ramMb} ${product.ramMb >= 1024 ? 'GB' : 'MB'}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {product.storageGb ? `${product.storageGb} GB ${product.storageType || ''}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {formatBandwidth(product.bandwidthTb, product.bandwidthLabel)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-stock">{formatPrice(product)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground/80">{formatDate(product.lastCheckedAt)}</td>
                      <td className="py-3">
                        {product.orderUrl && (
                          <a
                            href={getProductOrderUrl(provider.slug, product.productId)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-stock-strong"
                          >
                            Order
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {unknownProducts.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-amber-800 dark:text-amber-300">Stock Unknown</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Catalog-only refresh — live inventory is not confirmed (for example VMISS behind Cloudflare).
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground/80">
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">Line</th>
                    <th className="pb-2 pr-4">Price</th>
                    <th className="pb-2">Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {unknownProductsSorted.map((product) => (
                    <tr key={product.id} className="border-b border-border/30">
                      <td className="py-2 pr-4 text-foreground/80">
                        <Link
                          href={`/provider/${provider.slug}/${encodeURIComponent(product.productId)}`}
                          className="hover:text-foreground"
                        >
                          {product.planName}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground/80">{product.location}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground/80">{lineTypeLabel(product.lineType)}</td>
                      <td className="py-2 pr-4 font-mono text-muted-foreground/80">{formatPrice(product)}</td>
                      <td className="py-2 text-xs text-muted-foreground/70">{formatDate(product.lastCheckedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-semibold text-muted-foreground">Out of Stock</h2>
          {outOfStockProducts.length === 0 ? <p className="text-muted-foreground/80">No sold-out plans.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm opacity-60">
                <thead><tr className="border-b border-border text-left text-muted-foreground/80">
                  <th className="pb-2 pr-4">Plan</th><th className="pb-2 pr-4">Location</th>
                  <th className="pb-2 pr-4">Line</th>
                  <th className="pb-2 pr-4">Price</th><th className="pb-2">Last Checked</th>
                </tr></thead>
                <tbody>{outOfStockProductsSorted.map((product) => (
                  <tr key={product.id} className="border-b border-border/30">
                    <td className="py-2 pr-4 text-muted-foreground">
                      <Link
                        href={`/provider/${provider.slug}/${encodeURIComponent(product.productId)}`}
                        className="hover:text-foreground"
                      >
                        {product.planName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground/80">{product.location}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground/80">{lineTypeLabel(product.lineType)}</td>
                    <td className="py-2 pr-4 font-mono text-muted-foreground/80">{formatPrice(product)}</td>
                    <td className="py-2 text-xs text-muted-foreground/70">{formatDate(product.lastCheckedAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
