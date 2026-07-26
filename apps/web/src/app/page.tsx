import Link from 'next/link';
import {
  getAffiliateUrl,
  getLatestRestocks,
  getRecentOffers,
  getRecentStockEvents,
  getRecentlySoldOut,
  getStockSummary,
  type StockEventWithProduct,
} from '@/lib/data';
import { formatDate, formatPrice } from '@/lib/utils';

function EventCard({ event, badge }: { event: StockEventWithProduct; badge: string }) {
  return (
    <article className="rounded-lg border border-gray-800 bg-[#12121a] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">{badge}</span>
        <span className="text-xs text-gray-500">{event.product.provider.name}</span>
      </div>
      <h3 className="font-semibold text-white">{event.product.planName}</h3>
      <p className="text-sm text-gray-400">
        {event.product.location} - {formatPrice(event.product)}
      </p>
      {event.product.orderUrl && (
        <a
          href={getAffiliateUrl(event.product.orderUrl)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-emerald-400 hover:text-emerald-300"
        >
          Order
        </a>
      )}
    </article>
  );
}

export default async function HomePage() {
  const [providers, restocks, offers, soldOut, recentEvents] = await Promise.all([
    getStockSummary(),
    getLatestRestocks(6),
    getRecentOffers(4),
    getRecentlySoldOut(6),
    getRecentStockEvents(10),
  ]);

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-4 pb-4 pt-8 text-center">
          <h1 className="text-4xl font-bold text-white">VPSKnow Stock</h1>
          <p className="text-lg text-gray-400">
            Real-time VPS restock monitoring and LowEndTalk offer alerts.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <a
              href="https://t.me/vpsknow_stock"
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Restock Channel
            </a>
            <a
              href="https://t.me/vpsknow_offers"
              className="rounded-lg border border-gray-700 bg-[#12121a] px-5 py-2 text-sm font-medium text-white transition-colors hover:border-gray-500"
            >
              Offers Channel
            </a>
          </div>
        </header>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-white">Provider Status</h2>
            <Link href="/providers" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => (
              <Link
                key={provider.id}
                href={`/provider/${provider.slug}`}
                className="group rounded-lg border border-gray-800 bg-[#12121a] p-4 transition-colors hover:border-gray-600"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-emerald-400">
                    {provider.name}
                  </h3>
                  <span className="text-xs text-gray-500">{provider.tier}-Tier</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-emerald-400">{provider.inStockCount} in stock</span>
                  <span className="font-mono text-gray-500">{provider.totalProducts} products</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-emerald-400">Latest Restocks</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {restocks.length > 0 ? restocks.map((event) => (
              <EventCard key={event.id} event={event} badge="RESTOCK" />
            )) : <p className="text-gray-500">No restocks yet.</p>}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-orange-400">Latest Offers</h2>
            <Link href="/offers" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {offers.length > 0 ? offers.map((offer) => (
              <article key={offer.id} className="rounded-lg border border-gray-800 bg-[#12121a] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">{offer.provider || 'LowEndTalk'}</span>
                  {offer.isLimitedStock && (
                    <span className="rounded bg-orange-950 px-2 py-1 text-xs text-orange-300">LIMITED</span>
                  )}
                </div>
                <h3 className="mt-2 font-semibold text-white">{offer.title}</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {offer.locations.join(', ') || 'Unspecified'} - {offer.priceCents === null ? 'Price unavailable' : `${offer.currency || 'USD'} ${(offer.priceCents / 100).toFixed(2)}`}
                </p>
                <div className="mt-3 flex gap-3 text-sm">
                  {offer.orderUrl && <a href={getAffiliateUrl(offer.orderUrl)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">Order</a>}
                  {offer.threadUrl && <a href={offer.threadUrl} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white">Thread</a>}
                </div>
              </article>
            )) : <p className="text-gray-500">No offers yet.</p>}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-red-400">Recently Sold Out</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {soldOut.length > 0 ? soldOut.map((event) => (
              <EventCard key={event.id} event={event} badge="SOLD OUT" />
            )) : <p className="text-gray-500">No sold-out events yet.</p>}
          </div>
        </section>

        {recentEvents.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Recent Events</h2>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex gap-4 rounded-lg border border-gray-800/50 bg-[#12121a] px-4 py-3 text-sm">
                  <span className={event.eventType === 'restock' ? 'text-emerald-400' : 'text-red-400'}>
                    {event.eventType === 'restock' ? 'RESTOCK' : 'SOLD OUT'}
                  </span>
                  <span className="font-medium text-white">{event.product.provider.name}</span>
                  <span className="text-gray-400">{event.product.planName}</span>
                  <span className="text-gray-500">{event.product.location}</span>
                  <span className="ml-auto font-mono text-xs text-gray-600">{formatDate(event.detectedAt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-gray-800/50 py-8 text-center text-sm text-gray-600">
          Powered by <a href="https://vpsknow.com" className="text-gray-400 hover:text-white">VPSKnow</a>
        </footer>
      </div>
    </main>
  );
}
