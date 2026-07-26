import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAffiliateUrl, getProviderBySlug } from '@/lib/data';
import { formatDate, formatPrice } from '@/lib/utils';

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

  const inStockProducts = provider.products.filter((product) => product.inStock);
  const outOfStockProducts = provider.products.filter((product) => !product.inStock);
  const lastCheckedAt = provider.products.reduce<Date | null>((latest, product) => {
    if (!product.lastCheckedAt) return latest;
    return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
  }, null);
  const isStale = !lastCheckedAt || Date.now() - lastCheckedAt.getTime() > 30 * 60 * 1_000;

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/providers" className="text-gray-400 transition-colors hover:text-white">
          Providers
        </Link>

        <header className="space-y-2">
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-bold text-white">{provider.name}</h1>
            <a
              href={provider.website}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Official website
            </a>
          </div>
          <p className="text-sm text-gray-400">
            Last checked: {isStale ? 'Status Unknown' : formatDate(lastCheckedAt)}
          </p>
        </header>

        <div className="flex gap-4">
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-2">
            <span className="font-mono text-lg font-bold text-emerald-400">{inStockProducts.length}</span>
            <span className="ml-2 text-sm text-emerald-400/70">In Stock</span>
          </div>
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2">
            <span className="font-mono text-lg font-bold text-red-400">{outOfStockProducts.length}</span>
            <span className="ml-2 text-sm text-red-400/70">Out of Stock</span>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Available Plans</h2>
          {inStockProducts.length === 0 ? <p className="text-gray-500">No in-stock plans.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-gray-400">
                    <th className="pb-2 pr-4">Plan</th><th className="pb-2 pr-4">Location</th>
                    <th className="pb-2 pr-4">CPU</th><th className="pb-2 pr-4">RAM</th>
                    <th className="pb-2 pr-4">Storage</th><th className="pb-2 pr-4">Price</th>
                    <th className="pb-2 pr-4">Last Checked</th><th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inStockProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-800/50">
                      <td className="py-3 pr-4 font-medium text-white">
                        <Link
                          href={`/provider/${provider.slug}/${encodeURIComponent(product.productId)}`}
                          className="hover:text-emerald-300"
                        >
                          {product.planName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-gray-300">{product.location}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300">{product.cpu || 'N/A'}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                        {product.ramMb ? `${product.ramMb >= 1024 ? product.ramMb / 1024 : product.ramMb} ${product.ramMb >= 1024 ? 'GB' : 'MB'}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-gray-300">
                        {product.storageGb ? `${product.storageGb} GB ${product.storageType || ''}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4 font-mono text-emerald-400">{formatPrice(product)}</td>
                      <td className="py-3 pr-4 text-xs text-gray-500">{formatDate(product.lastCheckedAt)}</td>
                      <td className="py-3">
                        {product.orderUrl && (
                          <a
                            href={getAffiliateUrl(product.orderUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
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

        <section>
          <h2 className="mb-4 text-xl font-semibold text-gray-400">Out of Stock</h2>
          {outOfStockProducts.length === 0 ? <p className="text-gray-500">No sold-out plans.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full opacity-60 text-sm">
                <thead><tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="pb-2 pr-4">Plan</th><th className="pb-2 pr-4">Location</th>
                  <th className="pb-2 pr-4">Price</th><th className="pb-2">Last Checked</th>
                </tr></thead>
                <tbody>{outOfStockProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-800/30">
                    <td className="py-2 pr-4 text-gray-400">
                      <Link
                        href={`/provider/${provider.slug}/${encodeURIComponent(product.productId)}`}
                        className="hover:text-white"
                      >
                        {product.planName}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{product.location}</td>
                    <td className="py-2 pr-4 font-mono text-gray-500">{formatPrice(product)}</td>
                    <td className="py-2 text-xs text-gray-600">{formatDate(product.lastCheckedAt)}</td>
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
