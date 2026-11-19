import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProductOrderUrl, getProviderBySlug, getProviderSiteUrl } from '@/lib/data';
import { getDictionary } from '@/lib/i18n/get-locale';
import { formatDate, formatPrice, botSubscribeUrl, formatBandwidth, resolveStockAvailability } from '@/lib/utils';
import { lineTypeLabel, detectPlanOfferTag } from '@/lib/plan-tags';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [{ dictionary }, provider] = await Promise.all([
    getDictionary(),
    getProviderBySlug(slug),
  ]);
  if (!provider) return { title: dictionary.provider.notFound };
  const inStock = provider.products.filter((product) => product.inStock).length;
  const isZh = dictionary.nav.home === '首页';
  const description = isZh
    ? `${provider.name} VPS 库存、套餐、价格与近期可用性。当前有货 ${inStock} 个套餐。`
    : `${provider.name} VPS stock status, plans, prices, and recent availability. ${inStock} plans currently in stock.`;
  const title = isZh ? `${provider.name} VPS 库存` : `${provider.name} VPS Stock`;
  return {
    title,
    description,
    alternates: { canonical: `/provider/${provider.slug}` },
    openGraph: { title, description },
  };
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ locale, dictionary }, provider] = await Promise.all([
    getDictionary(),
    getProviderBySlug(slug),
  ]);
  if (!provider) notFound();
  const t = dictionary.provider;

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
          {t.stockMonitor}
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
                {dictionary.common.officialWebsite}
              </a>
              <a
                href={botSubscribeUrl(provider.slug)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:border-sky-500 hover:text-sky-800 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:border-sky-500 dark:hover:text-sky-200"
              >
                {t.subscribeTelegram}
              </a>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.lastChecked}{isStale ? t.statusUnknown : formatDate(lastCheckedAt, locale)}
          </p>
        </header>

        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800 dark:bg-emerald-950/50">
            <span className="font-mono text-lg font-bold text-stock">{inStockProducts.length}</span>
            <span className="ml-2 text-sm text-stock/70">{dictionary.stock.inStock}</span>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/40">
            <span className="font-mono text-lg font-bold text-amber-800 dark:text-amber-300">{unknownProducts.length}</span>
            <span className="ml-2 text-sm text-amber-700/80 dark:text-amber-300/80">{dictionary.stock.unknown}</span>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 dark:border-red-900/50 dark:bg-red-950/30">
            <span className="font-mono text-lg font-bold text-danger">{outOfStockProducts.length}</span>
            <span className="ml-2 text-sm text-danger/70">{dictionary.stock.outOfStock}</span>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-foreground">{t.availablePlans}</h2>
          {inStockProducts.length === 0 ? <p className="text-muted-foreground/80">{t.noInStock}</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">{t.plan}</th><th className="pb-2 pr-4">{t.location}</th>
                    <th className="pb-2 pr-4">{t.line}</th>
                    <th className="pb-2 pr-4">{t.cpu}</th><th className="pb-2 pr-4">{t.ram}</th>
                    <th className="pb-2 pr-4">{t.storage}</th><th className="pb-2 pr-4">{t.bandwidth}</th>
                    <th className="pb-2 pr-4">{t.price}</th>
                    <th className="pb-2 pr-4">{t.lastCheckedCol}</th><th className="pb-2">{t.action}</th>
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
                      <td className="py-3 pr-4 text-xs text-foreground/80">
                        {lineTypeLabel(product.lineType, dictionary.providers.standardLine)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">{product.cpu || dictionary.common.na}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {product.ramMb ? `${product.ramMb >= 1024 ? product.ramMb / 1024 : product.ramMb} ${product.ramMb >= 1024 ? 'GB' : 'MB'}` : dictionary.common.na}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {product.storageGb ? `${product.storageGb} GB ${product.storageType || ''}` : dictionary.common.na}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-foreground/80">
                        {formatBandwidth(product.bandwidthTb, product.bandwidthLabel, locale)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-stock">{formatPrice(product)}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground/80">{formatDate(product.lastCheckedAt, locale)}</td>
                      <td className="py-3">
                        {product.orderUrl && (
                          <a
                            href={getProductOrderUrl(provider.slug, product.productId)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:bg-stock-strong"
                          >
                            {dictionary.common.order}
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
            <h2 className="mb-4 text-xl font-semibold text-amber-800 dark:text-amber-300">{t.stockUnknown}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {t.catalogOnly}
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground/80">
                    <th className="pb-2 pr-4">{t.plan}</th>
                    <th className="pb-2 pr-4">{t.location}</th>
                    <th className="pb-2 pr-4">{t.line}</th>
                    <th className="pb-2 pr-4">{t.price}</th>
                    <th className="pb-2">{t.lastCheckedCol}</th>
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
                      <td className="py-2 pr-4 text-xs text-muted-foreground/80">
                        {lineTypeLabel(product.lineType, dictionary.providers.standardLine)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-muted-foreground/80">{formatPrice(product)}</td>
                      <td className="py-2 text-xs text-muted-foreground/70">{formatDate(product.lastCheckedAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-semibold text-muted-foreground">{t.outOfStock}</h2>
          {outOfStockProducts.length === 0 ? <p className="text-muted-foreground/80">{t.noSoldOut}</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-[560px] w-full text-sm opacity-60">
                <thead><tr className="border-b border-border text-left text-muted-foreground/80">
                  <th className="pb-2 pr-4">{t.plan}</th><th className="pb-2 pr-4">{t.location}</th>
                  <th className="pb-2 pr-4">{t.line}</th>
                  <th className="pb-2 pr-4">{t.price}</th><th className="pb-2">{t.lastCheckedCol}</th>
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
                    <td className="py-2 pr-4 text-xs text-muted-foreground/80">
                      {lineTypeLabel(product.lineType, dictionary.providers.standardLine)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-muted-foreground/80">{formatPrice(product)}</td>
                    <td className="py-2 text-xs text-muted-foreground/70">{formatDate(product.lastCheckedAt, locale)}</td>
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
