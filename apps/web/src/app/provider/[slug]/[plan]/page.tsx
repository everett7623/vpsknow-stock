import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAffiliateUrl, getProductDetail } from '@/lib/data';
import { formatDate, formatPrice } from '@/lib/utils';
import { PriceHistory } from './price-history';

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

  const specs = [
    ['CPU', product.cpu || 'N/A'],
    ['RAM', formatRam(product.ramMb)],
    [
      'Storage',
      product.storageGb
        ? `${product.storageGb} GB${product.storageType ? ` ${product.storageType}` : ''}`
        : 'N/A',
    ],
    ['Bandwidth', product.bandwidthTb ? `${product.bandwidthTb} TB` : 'N/A'],
    ['Category', product.category.toUpperCase()],
    ['Billing', product.billingCycle],
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href="/providers" className="hover:text-white">Providers</Link>
          <span>/</span>
          <Link href={`/provider/${product.provider.slug}`} className="hover:text-white">
            {product.provider.name}
          </Link>
          <span>/</span>
          <span className="text-gray-200">{product.planName}</span>
        </nav>

        <header className="rounded-xl border border-gray-800 bg-[#12121a] p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${product.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={product.inStock ? 'text-emerald-400' : 'text-red-400'}>
                  {product.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white">{product.planName}</h1>
              <p className="mt-2 text-gray-400">{product.location} · {product.provider.name}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-mono text-2xl font-bold text-emerald-400">{formatPrice(product)}</p>
              {product.inStock && product.orderUrl && (
                <a
                  href={getAffiliateUrl(product.orderUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500"
                >
                  Order Now
                </a>
              )}
            </div>
          </div>
        </header>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Specifications</h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-800 bg-gray-800 sm:grid-cols-3">
            {specs.map(([label, value]) => (
              <div key={label} className="bg-[#12121a] p-4">
                <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="mt-1 font-mono text-sm text-gray-200">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-gray-500">Last checked: {formatDate(product.lastCheckedAt)}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Price History</h2>
          <PriceHistory points={product.stockChecks} currency={product.currency} />
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Stock Timeline</h2>
          {product.stockEvents.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-[#12121a] p-6 text-gray-500">
              No stock transitions recorded yet.
            </div>
          ) : (
            <ol className="space-y-3">
              {product.stockEvents.map((event) => {
                const restock = event.eventType === 'restock';
                return (
                  <li key={event.id} className="flex items-center gap-4 rounded-lg border border-gray-800 bg-[#12121a] px-4 py-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${restock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className={restock ? 'text-emerald-400' : 'text-red-400'}>
                      {restock ? 'Restocked' : 'Sold Out'}
                    </span>
                    <time className="ml-auto font-mono text-xs text-gray-500">
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
