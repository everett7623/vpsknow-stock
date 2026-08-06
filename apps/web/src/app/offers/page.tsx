import Link from 'next/link';
import { allowedOfferSourceUrl, listRegions } from '@vpsknow/shared';
import {
  getOfferFilterOptions,
  getOfferOrderUrl,
  getOffers,
  type OfferFilters,
} from '@/lib/data';
import { formatRelativeTime } from '@/lib/utils';

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
  const region = firstValue(searchParams.region);
  return {
    provider: firstValue(searchParams.provider),
    category: firstValue(searchParams.category),
    location: firstValue(searchParams.location),
    region: region && region !== 'all' ? region : undefined,
    billingCycle: firstValue(searchParams.billing),
    ipv4: firstValue(searchParams.ipv4) === '1' ? true : undefined,
    limitedOnly: firstValue(searchParams.limited) === '1' ? true : undefined,
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
  return `${formatRelativeTime(value)} (${value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
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
    <main className="min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        <header className="space-y-2">
          <div>
            <p className="text-sm font-medium text-warning">CURATED VPS DEALS</p>
            <h1 className="mt-1 text-3xl font-bold text-foreground">Latest VPS Offers</h1>
            <p className="mt-2 text-muted-foreground">Curated VPS deals with pricing, locations, and order links.</p>
          </div>
        </header>

        <form method="get" className="grid gap-3 border-y border-border py-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Provider
            <select name="provider" defaultValue={filters.provider || ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">All providers</option>
              {options.providers.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Category
            <select name="category" defaultValue={filters.category || ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">All categories</option>
              {options.categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Region
            <select name="region" defaultValue={filters.region || 'all'} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="all">All regions</option>
              {listRegions().map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Location
            <select name="location" defaultValue={filters.location || ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">All locations</option>
              {options.locations.map((location) => <option key={location} value={location}>{location}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Billing
            <select name="billing" defaultValue={filters.billingCycle || ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">All billing cycles</option>
              {options.billingCycles.map((billingCycle) => <option key={billingCycle} value={billingCycle}>{label(billingCycle)}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Network
            <select name="ipv4" defaultValue={filters.ipv4 ? '1' : ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">Any network</option>
              <option value="1">IPv4 included</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Availability
            <select name="limited" defaultValue={filters.limitedOnly ? '1' : ''} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="">Any stock</option>
              <option value="1">Limited only</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Min price (USD)
            <input name="minPrice" type="number" min="0" max={maxPrice || undefined} step="0.01" defaultValue={minPrice} placeholder="Any" className="h-10 min-w-0 border border-border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Max price (USD)
            <input name="maxPrice" type="number" min={minPrice || '0'} step="0.01" defaultValue={maxPrice} placeholder="Any" className="h-10 min-w-0 border border-border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-accent" />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Sort
            <select name="sort" defaultValue={filters.sort || 'newest'} className="h-10 border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-accent">
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-4 xl:col-span-5">
            <button type="submit" className="h-10 bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-stock-strong">
              Apply filters
            </button>
            <Link href="/offers" className="h-10 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              Reset
            </Link>
            <span className="w-full py-2 text-sm text-muted-foreground/80 sm:ml-auto sm:w-auto">{offers.length} offers</span>
          </div>
        </form>

        {offers.length === 0 ? (
          <div className="border border-border bg-card p-8 text-center text-muted-foreground">
            No offers match the current filters.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {offers.map((offer) => (
              <article key={offer.id} className="border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{offer.provider || 'Offer'}</span>
                  {offer.isLimitedStock && <span className="bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-300">LIMITED</span>}
                </div>
                <h2 className="text-lg font-semibold text-foreground">{offer.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{offer.body || 'Offer details available after opening the order link.'}</p>
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground/80">Price</p>
                    <p className="font-mono text-stock">{formatPrice(offer.priceCents, offer.currency, offer.billingCycle)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/80">Locations</p>
                    <p className="text-foreground/80">{offer.locations.join(', ') || 'Unspecified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/80">IPv4</p>
                    <p className="text-foreground/80">
                      {offer.ipv4 === true ? 'Included' : offer.ipv4 === false ? 'Not included' : 'Unspecified'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground/80">{formatPostedAt(offer.postedAt)}</span>
                  <div className="flex gap-3">
                    {(() => {
                      const orderUrl = getOfferOrderUrl(offer.provider, offer.orderUrl);
                      return orderUrl ? (
                        <a href={orderUrl} target="_blank" rel="noreferrer" className="text-stock hover:text-stock">Order</a>
                      ) : null;
                    })()}
                    {(() => {
                      const sourceUrl = allowedOfferSourceUrl(offer.threadUrl);
                      return sourceUrl ? (
                        <a href={sourceUrl} target="_blank" rel="noreferrer" className="text-foreground/80 hover:text-foreground">Source</a>
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
