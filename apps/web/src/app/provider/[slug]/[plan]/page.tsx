import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAffiliateUrl, getProductDetail } from '@/lib/data';
import { formatDate, formatPrice } from '@/lib/utils';
import { PriceHistory } from './price-history';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; plan: string }>;
}): Promise<Metadata> {
  const { slug, plan } = await params;
  const product = await getProductDetail(slug, decodeURIComponent(plan));
  if (!product) return { title: 'Plan Not Found' };
  const description = `${product.planName} by ${product.provider.name} in ${product.location}: ${formatPrice(product)}, ${product.inStock ? 'currently in stock' : 'currently out of stock'}.`;
  return {
    title: `${product.planName} — ${product.provider.name}`,
    description,
    alternates: {
      canonical: `/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`,
    },
    openGraph: { title: product.planName, description },
  };
}

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
  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'}/provider/${product.provider.slug}/${encodeURIComponent(product.productId)}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.planName,
    description: `${product.cpu || 'VPS'}, ${formatRam(product.ramMb)}, ${product.location}`,
    brand: { '@type': 'Brand', name: product.provider.name },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency,
      price: (product.priceCents / 100).toFixed(2),
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <div className="mx-auto max-w-4xl space-y-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <Link href={`/providers?p=${product.provider.slug}`} className="hover:text-white">Stock</Link>
          <span>/</span>
          <Link href={`/providers?p=${product.provider.slug}`} className="hover:text-white">
            {product.provider.name}
          </Link>
          <span>/</span>
          <span className="min-w-0 break-words text-gray-200">{product.planName}</span>
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
              <h1 className="break-words text-2xl font-bold text-white sm:text-3xl">{product.planName}</h1>
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
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-gray-800 bg-gray-800 sm:grid-cols-2 lg:grid-cols-3">
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
                const manual = event.eventType === 'manual_override';
                return (
                  <li key={event.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-800 bg-[#12121a] px-4 py-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${restock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className={restock ? 'text-emerald-400' : manual ? 'text-amber-300' : 'text-red-400'}>
                      {restock ? 'Restocked' : manual ? 'Manual Override' : 'Sold Out'}
                    </span>
                    <time className="w-full font-mono text-xs text-gray-500 sm:ml-auto sm:w-auto">
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
