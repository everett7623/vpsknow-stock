import Link from 'next/link';
import type { Metadata } from 'next';
import { getProductOrderUrl, getProviders, type ProviderWithProducts } from '@/lib/data';
import { formatDate, formatPrice } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VPS Stock Monitor',
  description: 'Browse monitored VPS providers and live plan availability.',
};

type StockFilter = 'all' | 'in' | 'out';
type SortKey = 'price_asc' | 'price_desc' | 'name';

interface SearchParams {
  p?: string;
  stock?: string;
  location?: string;
  q?: string;
  sort?: string;
}

function parseStock(value: string | undefined): StockFilter {
  if (value === 'in' || value === 'out') return value;
  return 'all';
}

function parseSort(value: string | undefined): SortKey {
  if (value === 'price_desc' || value === 'name') return value;
  return 'price_asc';
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== 'all' && value !== 'price_asc') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function filterProducts(
  provider: ProviderWithProducts,
  stock: StockFilter,
  location: string,
  query: string,
  sort: SortKey,
) {
  const needle = query.trim().toLowerCase();
  let products = provider.products.filter((product) => {
    if (stock === 'in' && !product.inStock) return false;
    if (stock === 'out' && product.inStock) return false;
    if (location !== 'all' && product.location !== location) return false;
    if (!needle) return true;
    return (
      product.planName.toLowerCase().includes(needle) ||
      product.location.toLowerCase().includes(needle) ||
      product.productId.toLowerCase().includes(needle)
    );
  });

  products = [...products].sort((a, b) => {
    if (sort === 'name') return a.planName.localeCompare(b.planName);
    const left = a.priceCents ?? Number.POSITIVE_INFINITY;
    const right = b.priceCents ?? Number.POSITIVE_INFINITY;
    return sort === 'price_desc' ? right - left : left - right;
  });

  return products;
}

function StockBadge({ inStock }: { inStock: boolean }) {
  return inStock ? (
    <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-300">
      In Stock
    </span>
  ) : (
    <span className="rounded bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-300">
      Sold Out
    </span>
  );
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const providers = await getProviders();
  const selectedSlug = params.p || providers[0]?.slug || '';
  const selected =
    providers.find((provider) => provider.slug === selectedSlug) ?? providers[0] ?? null;
  const stock = parseStock(params.stock);
  const sort = parseSort(params.sort);
  const location = params.location?.trim() || 'all';
  const query = params.q?.trim() || '';

  const locations = selected
    ? [...new Set(selected.products.map((product) => product.location))].sort()
    : [];
  const products = selected
    ? filterProducts(selected, stock, location, query, sort)
    : [];
  const inStockCount = selected?.products.filter((product) => product.inStock).length ?? 0;
  const lastCheckedAt =
    selected?.products.reduce<Date | null>((latest, product) => {
      if (!product.lastCheckedAt) return latest;
      return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
    }, null) ?? null;

  const sharedParams = {
    p: selected?.slug,
    stock: stock === 'all' ? undefined : stock,
    location: location === 'all' ? undefined : location,
    q: query || undefined,
    sort: sort === 'price_asc' ? undefined : sort,
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-gray-800 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="sticky top-0 space-y-4 p-4 sm:p-5">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">Providers</h1>
              <p className="text-xs text-gray-500">{providers.length} monitored</p>
            </div>

            <nav className="max-h-[40vh] space-y-1 overflow-y-auto lg:max-h-[calc(100vh-8rem)]">
              {providers.map((provider) => {
                const inStock = provider.products.filter((product) => product.inStock).length;
                const active = provider.slug === selected?.slug;
                return (
                  <Link
                    key={provider.id}
                    href={`/providers${buildQuery({
                      ...sharedParams,
                      p: provider.slug,
                      location: undefined,
                    })}`}
                    className={`block rounded-md px-3 py-2 transition-colors ${
                      active
                        ? 'bg-emerald-950/50 text-emerald-300'
                        : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{provider.name}</span>
                      <span className="shrink-0 font-mono text-xs text-gray-500">
                        {inStock}/{provider.products.length}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-5 p-4 sm:p-6">
          {!selected ? (
            <p className="text-gray-500">No active providers.</p>
          ) : (
            <>
              <header className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="text-2xl font-bold text-white">{selected.name}</h2>
                  <a
                    href={selected.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    Official site
                  </a>
                  <Link
                    href={`/provider/${selected.slug}`}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Full page
                  </Link>
                </div>
                <p className="text-sm text-gray-500">
                  {inStockCount} in stock · {selected.products.length} plans · Last checked:{' '}
                  {lastCheckedAt ? formatDate(lastCheckedAt) : 'Unknown'}
                </p>
              </header>

              <form
                method="get"
                className="grid gap-3 rounded-lg border border-gray-800 bg-[#12121a] p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <input type="hidden" name="p" value={selected.slug} />
                <label className="space-y-1 text-xs text-gray-500">
                  Stock
                  <select
                    name="stock"
                    defaultValue={stock}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0f] px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="all">All</option>
                    <option value="in">In stock</option>
                    <option value="out">Sold out</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-500">
                  Location
                  <select
                    name="location"
                    defaultValue={location}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0f] px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="all">All locations</option>
                    {locations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-500">
                  Sort
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="w-full rounded border border-gray-700 bg-[#0a0a0f] px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="price_asc">Price ↑</option>
                    <option value="price_desc">Price ↓</option>
                    <option value="name">Plan name</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-gray-500">
                  Search
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Plan / location / ID"
                    className="w-full rounded border border-gray-700 bg-[#0a0a0f] px-3 py-2 text-sm text-gray-200"
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-4">
                  <button
                    type="submit"
                    className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                  >
                    Apply filters
                  </button>
                </div>
              </form>

              <div className="overflow-x-auto rounded-lg border border-gray-800">
                <table className="min-w-[920px] w-full text-sm">
                  <thead className="bg-[#12121a] text-left text-gray-400">
                    <tr className="border-b border-gray-800">
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">CPU</th>
                      <th className="px-4 py-3">RAM</th>
                      <th className="px-4 py-3">Storage</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                          No plans match the current filters.
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => (
                        <tr key={product.id} className="border-b border-gray-800/60">
                          <td className="px-4 py-3 font-medium text-white">
                            <Link
                              href={`/provider/${selected.slug}/${encodeURIComponent(product.productId)}`}
                              className="hover:text-emerald-300"
                            >
                              {product.planName}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{product.location}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">
                            {product.cpu || 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">
                            {product.ramMb
                              ? `${product.ramMb >= 1024 ? product.ramMb / 1024 : product.ramMb} ${
                                  product.ramMb >= 1024 ? 'GB' : 'MB'
                                }`
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">
                            {product.storageGb
                              ? `${product.storageGb} GB ${product.storageType || ''}`.trim()
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            {formatPrice(product)}
                          </td>
                          <td className="px-4 py-3">
                            <StockBadge inStock={product.inStock} />
                          </td>
                          <td className="px-4 py-3">
                            {product.orderUrl ? (
                              <a
                                href={getProductOrderUrl(selected.slug, product.productId)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                Order
                              </a>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
