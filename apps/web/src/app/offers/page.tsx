import Link from 'next/link';
import { allowedOfferSourceUrl } from '@vpsknow/shared';
import {
  getOfferFilterOptions,
  getOfferOrderUrl,
  getOffers,
  type OfferFilters,
} from '@/lib/data';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function priceCents(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function offerFilters(searchParams: SearchParams): OfferFilters {
  const sort = firstValue(searchParams.sort);
  return {
    provider: firstValue(searchParams.provider),
    category: firstValue(searchParams.category),
    location: firstValue(searchParams.location),
    billingCycle: firstValue(searchParams.billing),
    ipv4: firstValue(searchParams.ipv4) === '1' ? true : undefined,
    minPriceCents: priceCents(firstValue(searchParams.minPrice)),
    maxPriceCents: priceCents(firstValue(searchParams.maxPrice)),
    sort: sort === 'price_asc' || sort === 'price_desc' || sort === 'newest' ? sort : 'newest',
  };
}

function formatPrice(priceCents: number | null, currency: string | null, billingCycle: string | null): string {
  if (priceCents === null || !currency) return 'Price unavailable';
  return `${currency} ${(priceCents / 100).toFixed(2)}${billingCycle ? ` / ${billingCycle}` : ''}`;
}

function formatPostedAt(value: Date | null): string {
  if (!value) return 'Recently discovered';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function label(value: string): string {
  return value.replace(/[-_]/g, ' ');
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = offerFilters(await searchParams);
  const [offers, options] = await Promise.all([
    getOffers(filters),
    getOfferFilterOptions(),
  ]);
  const minPrice = filters.minPriceCents === undefined ? '' : (filters.minPriceCents / 100).toString();
  const maxPrice = filters.maxPriceCents === undefined ? '' : (filters.maxPriceCents / 100).toString();

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <div className="mx-auto max-w-[1400px] space-y-8">
        <header className="space-y-2">
          <div>
            <p className="text-sm font-medium text-orange-400">CURATED VPS DEALS</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Latest VPS Offers</h1>
            <p className="mt-2 text-gray-400">Curated VPS deals with pricing, locations, and order links.</p>
          </div>
        </header>

        <form method="get" className="grid gap-3 border-y border-gray-800 py-5 sm:grid-cols-2 lg:grid-cols-8">
          <label className="grid gap-1 text-xs text-gray-400">
            Provider
            <select name="provider" defaultValue={filters.provider || ''} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="">All providers</option>
              {options.providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Category
            <select name="category" defaultValue={filters.category || ''} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="">All categories</option>
              {options.categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Location
            <select name="location" defaultValue={filters.location || ''} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="">All locations</option>
              {options.locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Billing
            <select name="billing" defaultValue={filters.billingCycle || ''} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="">All billing cycles</option>
              {options.billingCycles.map((billingCycle) => <option key={billingCycle} value={billingCycle}>{label(billingCycle)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Network
            <select name="ipv4" defaultValue={filters.ipv4 ? '1' : ''} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="">Any network</option>
              <option value="1">IPv4 included</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Min price (USD)
            <input name="minPrice" type="number" min="0" max={maxPrice || undefined} step="0.01" defaultValue={minPrice} placeholder="Any" className="h-10 min-w-0 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500" />
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Max price (USD)
            <input name="maxPrice" type="number" min={minPrice || '0'} step="0.01" defaultValue={maxPrice} placeholder="Any" className="h-10 min-w-0 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500" />
          </label>
          <label className="grid gap-1 text-xs text-gray-400">
            Sort
            <select name="sort" defaultValue={filters.sort || 'newest'} className="h-10 border border-gray-700 bg-[#12121a] px-3 text-sm text-white outline-none focus:border-emerald-500">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-8">
            <button type="submit" className="h-10 bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-500">
              Apply filters
            </button>
            <Link href="/offers" className="h-10 px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white">
              Reset
            </Link>
            <span className="w-full py-2 text-sm text-gray-500 sm:ml-auto sm:w-auto">{offers.length} offers</span>
          </div>
        </form>

        {offers.length === 0 ? (
          <div className="border border-gray-800 bg-[#12121a] p-8 text-center text-gray-400">
            No offers match the current filters.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((offer) => (
              <article key={offer.id} className="border border-gray-800 bg-[#12121a] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-gray-400">{offer.provider || 'Offer'}</span>
                  {offer.isLimitedStock && <span className="bg-orange-950 px-2 py-1 text-xs font-medium text-orange-300">LIMITED</span>}
                </div>
                <h2 className="text-lg font-semibold text-white">{offer.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-gray-400">{offer.body || 'Offer details available after opening the order link.'}</p>
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-800 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-gray-500">Price</p>
                    <p className="font-mono text-emerald-400">{formatPrice(offer.priceCents, offer.currency, offer.billingCycle)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Locations</p>
                    <p className="text-gray-300">{offer.locations.join(', ') || 'Unspecified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">IPv4</p>
                    <p className="text-gray-300">
                      {offer.ipv4 === true ? 'Included' : offer.ipv4 === false ? 'Not included' : 'Unspecified'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-gray-500">{formatPostedAt(offer.postedAt)}</span>
                  <div className="flex gap-3">
                    {(() => {
                      const orderUrl = getOfferOrderUrl(offer.provider, offer.orderUrl);
                      return orderUrl ? (
                        <a href={orderUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">Order</a>
                      ) : null;
                    })()}
                    {(() => {
                      const sourceUrl = allowedOfferSourceUrl(offer.threadUrl);
                      return sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white">Source</a>
                      ) : null;
                    })()}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
