import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProviderBySlug } from '@/lib/data';
import { formatPrice, formatDate } from '@/lib/utils';

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);
  if (!provider) notFound();

  const inStockProducts = provider.products.filter((p) => p.inStock);
  const oosProducts = provider.products.filter((p) => !p.inStock);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/providers"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Providers
          </Link>
        </div>

        <div className="flex items-baseline gap-4">
          <h1 className="text-3xl font-bold text-white">{provider.name}</h1>
          <a
            href={provider.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            {provider.website} ↗
          </a>
        </div>

        {/* Stock Summary Bar */}
        <div className="flex gap-4">
          <div className="rounded-lg bg-emerald-950/50 border border-emerald-800 px-4 py-2">
            <span className="text-emerald-400 font-mono text-lg font-bold">
              {inStockProducts.length}
            </span>
            <span className="text-emerald-400/70 text-sm ml-2">In Stock</span>
          </div>
          <div className="rounded-lg bg-red-950/30 border border-red-900/50 px-4 py-2">
            <span className="text-red-400 font-mono text-lg font-bold">
              {oosProducts.length}
            </span>
            <span className="text-red-400/70 text-sm ml-2">Out of Stock</span>
          </div>
        </div>

        {/* In-Stock Products */}
        {inStockProducts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">
              🟢 Available Plans
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-400">
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">CPU</th>
                    <th className="pb-2 pr-4">RAM</th>
                    <th className="pb-2 pr-4">Storage</th>
                    <th className="pb-2 pr-4">BW</th>
                    <th className="pb-2 pr-4">Price</th>
                    <th className="pb-2 pr-4">Last Checked</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {inStockProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/20"
                    >
                      <td className="py-3 pr-4 font-medium text-white">
                        {p.planName}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{p.location}</td>
                      <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                        {p.cpu || '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                        {p.ramMb
                          ? p.ramMb >= 1024
                            ? `${(p.ramMb / 1024).toFixed(0)} GB`
                            : `${p.ramMb} MB`
                          : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                        {p.storageGb ? `${p.storageGb} GB ${p.storageType || ''}` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                        {p.bandwidthTb ? `${p.bandwidthTb} TB` : '—'}
                      </td>
                      <td className="py-3 pr-4 text-emerald-400 font-mono">
                        {formatPrice(p)}
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">
                        {formatDate(p.lastCheckedAt)}
                      </td>
                      <td className="py-3">
                        {p.orderUrl && (
                          <a
                            href={p.orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
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
          </section>
        )}

        {/* Out of Stock Products */}
        {oosProducts.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold text-gray-400 mb-4">
              🔴 Out of Stock
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm opacity-60">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-500">
                    <th className="pb-2 pr-4">Plan</th>
                    <th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">Price</th>
                    <th className="pb-2 pr-4">Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {oosProducts.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-gray-800/30"
                    >
                      <td className="py-2 pr-4 text-gray-400">{p.planName}</td>
                      <td className="py-2 pr-4 text-gray-500">{p.location}</td>
                      <td className="py-2 pr-4 text-gray-500 font-mono">
                        {formatPrice(p)}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 text-xs">
                        {formatDate(p.lastCheckedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
