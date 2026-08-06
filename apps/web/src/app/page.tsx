import Link from 'next/link';
import type { Offer } from '@vpsknow/database';
import { allowedOfferSourceUrl } from '@vpsknow/shared';
import { BrandLogo } from '@/components/brand-logo';
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
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function EventCard({ event, badge }: { event: StockEventWithProduct; badge: string }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-1 text-xs text-foreground/80">{badge}</span>
        <Link
          href={`/providers?p=${event.product.provider.slug}`}
          className="text-xs text-muted-foreground/80 hover:text-stock"
        >
          {event.product.provider.name}
        </Link>
      </div>
      <h3 className="font-semibold text-foreground">{event.product.planName}</h3>
      <p className="text-sm text-muted-foreground">
        {event.product.location} - {formatPrice(event.product)}
      </p>
      <div className="mt-2 flex gap-3 text-sm">
        {event.product.orderUrl && (
          <a
            href={getProductOrderUrl(event.product.provider.slug, event.product.productId)}
            target="_blank"
            rel="noreferrer"
            className="text-stock hover:text-stock"
          >
            Order
          </a>
        )}
        <Link
          href={`/providers?p=${event.product.provider.slug}`}
          className="text-muted-foreground hover:text-foreground"
        >
          Monitor
        </Link>
      </div>
    </article>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const sourceUrl = allowedOfferSourceUrl(offer.threadUrl);
  const orderUrl = getOfferOrderUrl(offer.provider, offer.orderUrl);
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground/80">{offer.provider || 'Offer'}</span>
        {offer.isLimitedStock && (
          <span className="rounded bg-orange-100 px-2 py-1 text-xs text-orange-700 dark:bg-orange-950 dark:text-orange-300">LIMITED</span>
        )}
      </div>
      <h3 className="mt-2 font-semibold text-foreground">{offer.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {offer.locations.join(', ') || 'Unspecified'} - {offer.priceCents === null
          ? 'Price unavailable'
          : `${offer.currency || 'USD'} ${(offer.priceCents / 100).toFixed(2)}`}
      </p>
      <div className="mt-3 flex gap-3 text-sm">
        {orderUrl && (
          <a href={orderUrl} target="_blank" rel="noreferrer" className="text-stock hover:text-stock">
            Order
          </a>
        )}
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
            Source
          </a>
        )}
      </div>
    </article>
  );
}

export default async function HomePage() {
  const [providers, restocks, offers, limitedOffers, soldOut, recentEvents] = await Promise.all([
    getStockSummary(),
    getLatestRestocks(6),
    getRecentOffers(4),
    getLimitedOffers(4),
    getRecentlySoldOut(6),
    getRecentStockEvents(10),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-[1200px] space-y-10">
        <header className="space-y-4 pb-4 pt-8 text-center">
          <div className="flex justify-center py-2">
            <BrandLogo size="lg" />
          </div>
          <h1 className="sr-only">VPSKnow Stock</h1>
          <p className="text-lg text-muted-foreground">
            Real-time VPS restock monitoring and curated offer alerts.
          </p>
          <div className="pt-2">
            <a
              href="https://t.me/vpsknow_offers"
              className="inline-block rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-stock-strong"
            >
              Telegram Channel
            </a>
          </div>
        </header>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-foreground">Provider Status</h2>
            <Link href="/providers" className="text-sm text-stock hover:text-stock">
              Stock monitor
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Link
                key={provider.id}
                href={`/providers?p=${provider.slug}`}
                className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-stock">
                    {provider.name}
                  </h3>
                  <span className="text-xs text-muted-foreground/80">{provider.tier}-Tier</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-stock">{provider.inStockCount} in stock</span>
                  <span className="font-mono text-muted-foreground/80">{provider.totalProducts} products</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-stock">Latest Restocks</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {restocks.length > 0 ? restocks.map((event) => (
              <EventCard key={event.id} event={event} badge="RESTOCK" />
            )) : <p className="text-muted-foreground/80">No restocks yet.</p>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-warning">New Offers</h2>
            <Link href="/offers" className="text-sm text-stock hover:text-stock">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {offers.length > 0
              ? offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)
              : <p className="text-muted-foreground/80">No new offers yet.</p>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-warning">Limited Offers</h2>
            <Link href="/offers" className="text-sm text-stock hover:text-stock">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {limitedOffers.length > 0
              ? limitedOffers.map((offer) => <OfferCard key={offer.id} offer={offer} />)
              : <p className="text-muted-foreground/80">No limited offers available.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-danger">Recently Sold Out</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {soldOut.length > 0 ? soldOut.map((event) => (
              <EventCard key={event.id} event={event} badge="SOLD OUT" />
            )) : <p className="text-muted-foreground/80">No sold-out events yet.</p>}
          </div>
        </section>

        {recentEvents.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-foreground">Recent Events</h2>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/50 bg-card px-4 py-3 text-sm">
                  <span className={event.eventType === 'restock' ? 'text-stock' : 'text-danger'}>
                    {event.eventType === 'restock' ? 'RESTOCK' : 'SOLD OUT'}
                  </span>
                  <span className="font-medium text-foreground">{event.product.provider.name}</span>
                  <span className="text-muted-foreground">{event.product.planName}</span>
                  <span className="text-muted-foreground/80">{event.product.location}</span>
                  <span className="w-full font-mono text-xs text-muted-foreground/70 sm:ml-auto sm:w-auto">{formatDate(event.detectedAt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground/70">
          Powered by <a href="https://vpsknow.com" className="text-muted-foreground hover:text-foreground">VPSKnow</a>
        </footer>
      </div>
    </main>
  );
}
