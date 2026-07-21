import Link from 'next/link';
import { getStockSummary, getRecentStockEvents } from '@/lib/data';
import { formatDate } from '@/lib/utils';

export default async function HomePage() {
  const [providers, recentEvents] = await Promise.all([
    getStockSummary(),
    getRecentStockEvents(10),
  ]);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4 pt-8 pb-4">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            VPSKnow Stock
          </h1>
          <p className="text-lg text-gray-400">
            Real-time VPS restock monitoring &amp; LowEndTalk offer alerts.
          </p>
          <div className="flex gap-4 justify-center pt-2">
            <a
              href="https://t.me/vpsknow_stock"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              🟢 Restock Channel
            </a>
            <a
              href="https://t.me/vpsknow_offers"
              className="px-5 py-2 rounded-lg bg-[#12121a] border border-gray-700 hover:border-gray-500 text-white text-sm font-medium transition-colors"
            >
              🔥 Offers Channel
            </a>
          </div>
        </div>

        {/* Provider Stock Overview */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Provider Status</h2>
            <Link href="/providers" className="text-sm text-emerald-400 hover:text-emerald-300">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((p) => (
              <Link
                key={p.id}
                href={`/provider/${p.slug}`}
                className="rounded-lg border border-gray-800 bg-[#12121a] p-4 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    {p.name}
                  </h3>
                  <span className="text-xs text-gray-500">{p.tier}-Tier</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-400 font-mono">
                    {p.inStockCount} in stock
                  </span>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500 font-mono">
                    {p.totalProducts} products
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Events Timeline */}
        {recentEvents.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">Recent Events</h2>
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 rounded-lg bg-[#12121a] border border-gray-800/50 px-4 py-3 text-sm"
                >
                  <span className={event.eventType === 'restock' ? 'text-emerald-400' : 'text-red-400'}>
                    {event.eventType === 'restock' ? '🟢' : '🔴'}
                  </span>
                  <span className="text-white font-medium">
                    {event.product.provider.name}
                  </span>
                  <span className="text-gray-400">
                    {event.product.planName}
                  </span>
                  <span className="text-gray-500">
                    {event.product.location}
                  </span>
                  <span className="ml-auto text-gray-600 text-xs font-mono">
                    {formatDate(event.detectedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-gray-600 py-8 border-t border-gray-800/50">
          Powered by{' '}
          <a href="https://vpsknow.com" className="text-gray-400 hover:text-white transition-colors">
            VPSKnow
          </a>
        </footer>
      </div>
    </main>
  );
}
