import Link from 'next/link';
import type { Offer } from '@vpsknow/database';
import { allowedOfferSourceUrl } from '@vpsknow/shared';
import { StockBadge } from '@/components/stock-badge';
import {
  getLatestRestocks,
  getLimitedOffers,
  getOfferOrderUrl,
  getProductOrderUrl,
  getRecentOffers,
  getRecentStockEvents,
  getRecentlySoldOut,
  getStockSummary,
  type StockEventWithProduct,
} from '@/lib/data';
import { getDictionary } from '@/lib/i18n/get-locale';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import {
  botSubscribeUrl,
  formatDate,
  formatPrice,
  formatRelativeTime,
} from '@/lib/utils';

export const dynamic = 'force-dynamic';

const BOT_URL = botSubscribeUrl();
const CHANNEL_URL = 'https://t.me/vpsknow_offers';

function EventCard({
  event,
  kind,
  dictionary,
  locale,
}: {
  event: StockEventWithProduct;
  kind: 'restock' | 'sold_out';
  dictionary: Dictionary;
  locale: Locale;
}): React.JSX.Element {
  const planHref = `/provider/${event.product.provider.slug}/${encodeURIComponent(event.product.productId)}`;
  const providerHref = `/provider/${event.product.provider.slug}`;
  const isRestock = kind === 'restock';

  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StockBadge
          inStock={isRestock}
          availabilitySource="live"
          pulse={isRestock}
        />
        <Link
          href={providerHref}
          className="text-xs text-muted-foreground/80 hover:text-stock"
        >
          {event.product.provider.name}
        </Link>
        <span
          className="ml-auto text-xs text-muted-foreground/70"
          title={formatDate(event.detectedAt, locale)}
        >
          {formatRelativeTime(event.detectedAt, Date.now(), locale)}
        </span>
      </div>
      <h3 className="font-semibold text-foreground">
        <Link href={planHref} className="hover:text-stock">
          {event.product.planName}
        </Link>
      </h3>
      <p className="text-sm text-muted-foreground">
        {event.product.location} · {formatPrice(event.product)}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {isRestock && event.product.orderUrl && (
          <a
            href={getProductOrderUrl(event.product.provider.slug, event.product.productId)}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stock hover:text-stock-strong"
          >
            {dictionary.common.order}
          </a>
        )}
        <a
          href={botSubscribeUrl(event.product.provider.slug)}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          {dictionary.common.notifyMe}
        </a>
        <Link href={planHref} className="text-muted-foreground hover:text-foreground">
          {dictionary.common.details}
        </Link>
      </div>
    </article>
  );
}

function OfferCard({
  offer,
  dictionary,
}: {
  offer: Offer;
  dictionary: Dictionary;
}): React.JSX.Element {
  const sourceUrl = allowedOfferSourceUrl(offer.threadUrl);
  const orderUrl = getOfferOrderUrl(offer.provider, offer.orderUrl);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/80">
          {offer.provider || dictionary.home.offerFallback}
        </span>
        {offer.isLimitedStock && (
          <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            {dictionary.offerTag.limitedBadge}
          </span>
        )}
      </div>
      <h3 className="mt-2 font-semibold text-foreground">{offer.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {offer.locations.join(', ') || dictionary.home.unspecified} ·{' '}
        {offer.priceCents === null
          ? dictionary.home.priceUnavailable
          : `${offer.currency || 'USD'} ${(offer.priceCents / 100).toFixed(2)}`}
      </p>
      <div className="mt-3 flex gap-3 text-sm">
        {orderUrl && (
          <a href={orderUrl} target="_blank" rel="noreferrer" className="text-stock hover:text-stock-strong">
            {dictionary.common.order}
          </a>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
            {dictionary.common.source}
          </a>
        )}
      </div>
    </article>
  );
}

export default async function HomePage(): Promise<React.JSX.Element> {
  const [{ locale, dictionary }, providers, restocks, offers, limitedOffers, soldOut, recentEvents] =
    await Promise.all([
      getDictionary(),
      getStockSummary(),
      getLatestRestocks(6),
      getRecentOffers(4),
      getLimitedOffers(4),
      getRecentlySoldOut(6),
      getRecentStockEvents(10),
    ]);
  const t = dictionary.home;

  return (
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-10">
        <header className="space-y-4 pb-2 pt-6 text-center sm:pt-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            VPSKnow Stock
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t.tagline}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-stock-strong"
            >
              {t.getAlerts}
            </a>
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-muted-foreground/40"
            >
              {t.offersChannel}
            </a>
            <Link
              href="/providers"
              className="inline-flex rounded-lg px-3 py-2.5 text-sm font-medium text-stock hover:text-stock-strong"
            >
              {t.browseStock}
            </Link>
          </div>
        </header>

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-foreground">{t.providerStatus}</h2>
            <Link href="/providers" className="text-sm text-stock hover:text-stock-strong">
              {t.stockMonitor}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const ratio = provider.totalProducts > 0
                ? Math.round((provider.inStockCount / provider.totalProducts) * 100)
                : 0;
              return (
                <article
                  key={provider.id}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      <Link
                        href={`/provider/${provider.slug}`}
                        className="hover:text-stock"
                      >
                        {provider.name}
                      </Link>
                    </h3>
                    <span className="text-xs text-muted-foreground/80">{provider.tier}-Tier</span>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-stock"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-mono text-stock">
                      {provider.inStockCount} {t.inStockCount}
                    </span>
                    {provider.unknownCount > 0 && (
                      <span className="font-mono text-warning">
                        {provider.unknownCount} {t.unknownCount}
                      </span>
                    )}
                    <span className="font-mono text-muted-foreground/80">
                      {provider.totalProducts} {t.productsCount}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <Link
                      href={`/providers?p=${provider.slug}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {dictionary.common.monitor}
                    </Link>
                    <a
                      href={botSubscribeUrl(provider.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-stock hover:text-stock-strong"
                    >
                      {dictionary.common.subscribe}
                    </a>
                    <span
                      className="ml-auto text-xs text-muted-foreground/70"
                      title={formatDate(provider.lastCheckedAt, locale)}
                    >
                      {provider.lastCheckedAt
                        ? `${t.checked} ${formatRelativeTime(provider.lastCheckedAt, Date.now(), locale)}`
                        : dictionary.common.notChecked}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-stock">{t.latestRestocks}</h2>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-stock hover:text-stock-strong"
            >
              {dictionary.common.subscribe}
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {restocks.length > 0 ? (
              restocks.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  kind="restock"
                  dictionary={dictionary}
                  locale={locale}
                />
              ))
            ) : (
              <p className="text-muted-foreground/80">{t.noRestocks}</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-warning">{t.newOffers}</h2>
            <Link href="/offers" className="text-sm text-stock hover:text-stock-strong">
              {t.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {offers.length > 0
              ? offers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} dictionary={dictionary} />
                ))
              : <p className="text-muted-foreground/80">{t.noOffers}</p>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-warning">{t.limitedOffers}</h2>
            <Link href="/offers" className="text-sm text-stock hover:text-stock-strong">
              {t.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {limitedOffers.length > 0
              ? limitedOffers.map((offer) => (
                  <OfferCard key={offer.id} offer={offer} dictionary={dictionary} />
                ))
              : <p className="text-muted-foreground/80">{t.noLimitedOffers}</p>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-semibold text-danger">{t.recentlySoldOut}</h2>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t.catchNext}
            </a>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {soldOut.length > 0 ? (
              soldOut.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  kind="sold_out"
                  dictionary={dictionary}
                  locale={locale}
                />
              ))
            ) : (
              <p className="text-muted-foreground/80">{t.noSoldOut}</p>
            )}
          </div>
        </section>

        {recentEvents.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-foreground">{t.recentEvents}</h2>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm"
                >
                  <StockBadge
                    inStock={event.eventType === 'restock'}
                    availabilitySource="live"
                  />
                  <Link
                    href={`/provider/${event.product.provider.slug}`}
                    className="font-medium text-foreground hover:text-stock"
                  >
                    {event.product.provider.name}
                  </Link>
                  <Link
                    href={`/provider/${event.product.provider.slug}/${encodeURIComponent(event.product.productId)}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {event.product.planName}
                  </Link>
                  <span className="text-muted-foreground/80">{event.product.location}</span>
                  <span
                    className="w-full text-xs text-muted-foreground/70 sm:ml-auto sm:w-auto"
                    title={formatDate(event.detectedAt, locale)}
                  >
                    {formatRelativeTime(event.detectedAt, Date.now(), locale)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
