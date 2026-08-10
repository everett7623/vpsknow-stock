import Link from 'next/link';
import type { Metadata } from 'next';
import { listRegions, resolveRegion } from '@vpsknow/shared';
import {
  getProductOrderUrl,
  getProviderSiteUrl,
  getProviders,
  type ProviderWithProducts,
} from '@/lib/data';
import {
  categoryLabel,
  detectPlanOfferTag,
  lineTypeLabel,
  offerTagLabel,
  type PlanOfferTag,
} from '@/lib/plan-tags';
import { formatDate, formatPrice, formatRelativeTime, botSubscribeUrl, formatBandwidth, formatIpv4, resolveStockAvailability } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VPS Stock Monitor',
  description: 'Browse monitored VPS providers and live plan availability.',
};

type StockFilter = 'all' | 'in' | 'out' | 'unknown';
type OfferFilter = 'all' | 'special' | 'promo' | 'limited' | 'regular';
type SortKey = 'price_asc' | 'price_desc' | 'name';

const RAM_PRESETS = [
  { value: 'all', label: 'Any RAM' },
  { value: '1024', label: '≥ 1 GB' },
  { value: '2048', label: '≥ 2 GB' },
  { value: '4096', label: '≥ 4 GB' },
  { value: '8192', label: '≥ 8 GB' },
  { value: '16384', label: '≥ 16 GB' },
] as const;

const STORAGE_PRESETS = [
  { value: 'all', label: 'Any disk' },
  { value: '20', label: '≥ 20 GB' },
  { value: '40', label: '≥ 40 GB' },
  { value: '80', label: '≥ 80 GB' },
  { value: '160', label: '≥ 160 GB' },
  { value: '320', label: '≥ 320 GB' },
  { value: '500', label: '≥ 500 GB' },
  { value: '1000', label: '≥ 1 TB' },
] as const;

const BANDWIDTH_PRESETS = [
  { value: 'all', label: 'Any bandwidth' },
  { value: '0.5', label: '≥ 0.5 TB' },
  { value: '1', label: '≥ 1 TB' },
  { value: '2', label: '≥ 2 TB' },
  { value: '5', label: '≥ 5 TB' },
  { value: '10', label: '≥ 10 TB' },
  { value: '100', label: 'Unmetered / ≥ 100 TB' },
] as const;

const CPU_PRESETS = [
  { value: 'all', label: 'Any CPU' },
  { value: '1', label: '≥ 1 vCPU' },
  { value: '2', label: '≥ 2 vCPU' },
  { value: '4', label: '≥ 4 vCPU' },
  { value: '8', label: '≥ 8 vCPU' },
] as const;

const DISK_TYPE_PRESETS = [
  { value: 'all', label: 'Any disk type' },
  { value: 'nvme', label: 'NVMe' },
  { value: 'ssd', label: 'SSD' },
  { value: 'hdd', label: 'HDD' },
] as const;

interface SearchParams {
  p?: string;
  stock?: string;
  location?: string;
  region?: string;
  category?: string;
  line?: string;
  offer?: string;
  ram?: string;
  storage?: string;
  disk?: string;
  bw?: string;
  cpu?: string;
  billing?: string;
  ipv4?: string;
  minPrice?: string;
  maxPrice?: string;
  q?: string;
  sort?: string;
}

function parseStock(value: string | undefined): StockFilter {
  if (value === 'in' || value === 'out' || value === 'unknown') return value;
  return 'all';
}

function parseOffer(value: string | undefined): OfferFilter {
  if (value === 'special' || value === 'promo' || value === 'limited' || value === 'regular') {
    return value;
  }
  return 'all';
}

function parseSort(value: string | undefined): SortKey {
  if (value === 'price_desc' || value === 'name') return value;
  return 'price_asc';
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value || value === 'all') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function parsePriceCents(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const dollars = Number(value);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function parseCpuCores(cpu: string | null | undefined): number {
  if (!cpu) return 0;
  const match = cpu.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function matchesDiskType(storageType: string | null | undefined, disk: string): boolean {
  if (disk === 'all') return true;
  const normalized = (storageType ?? '').toLowerCase();
  if (!normalized || normalized === 'unknown') return false;
  if (disk === 'nvme') return normalized.includes('nvme');
  // SSD filter includes NVMe — both are flash storage vs HDD.
  if (disk === 'ssd') return normalized.includes('ssd') || normalized.includes('nvme');
  if (disk === 'hdd') return normalized.includes('hdd') || normalized.includes('hard');
  return true;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== 'all' && value !== 'price_asc') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function matchesBandwidthMin(
  bandwidthTb: number | null | undefined,
  bandwidthLabel: string | null | undefined,
  bandwidthMinTb: number | null,
): boolean {
  if (bandwidthMinTb === null) return true;
  const label = bandwidthLabel ?? '';
  if (/unmetered|unlimited/i.test(label) || (bandwidthTb ?? 0) >= 100) return true;
  if (bandwidthMinTb >= 100) return false;
  return (bandwidthTb ?? 0) >= bandwidthMinTb;
}

function filterProducts(
  provider: ProviderWithProducts,
  stock: StockFilter,
  location: string,
  region: string,
  category: string,
  line: string,
  offer: OfferFilter,
  ramMinMb: number | null,
  storageMinGb: number | null,
  diskType: string,
  bandwidthMinTb: number | null,
  cpuMinCores: number | null,
  ipv4Filter: string,
  billing: string,
  minPriceCents: number | undefined,
  maxPriceCents: number | undefined,
  query: string,
  sort: SortKey,
) {
  const needle = query.trim().toLowerCase();
  let products = provider.products.filter((product) => {
    const availability = resolveStockAvailability(product.inStock, product.availabilitySource);
    if (stock === 'in' && availability !== 'in') return false;
    if (stock === 'out' && availability !== 'out') return false;
    if (stock === 'unknown' && availability !== 'unknown') return false;
    if (location !== 'all' && product.location !== location) return false;
    if (region !== 'all' && resolveRegion(product.location) !== region) return false;
    if (category !== 'all' && product.category !== category) return false;
    if (line !== 'all' && (line === 'standard' ? product.lineType !== null : product.lineType !== line)) {
      return false;
    }
    if (billing !== 'all' && product.billingCycle !== billing) return false;
    if (ipv4Filter === 'yes' && product.ipv4 !== true) return false;
    if (ipv4Filter === 'no' && product.ipv4 !== false) return false;
    if (ramMinMb !== null && (product.ramMb ?? 0) < ramMinMb) return false;
    if (storageMinGb !== null && (product.storageGb ?? 0) < storageMinGb) return false;
    if (!matchesDiskType(product.storageType, diskType)) return false;
    if (!matchesBandwidthMin(product.bandwidthTb, product.bandwidthLabel, bandwidthMinTb)) return false;
    if (cpuMinCores !== null && parseCpuCores(product.cpu) < cpuMinCores) return false;
    if (minPriceCents !== undefined && product.priceCents < minPriceCents) return false;
    if (maxPriceCents !== undefined && product.priceCents > maxPriceCents) return false;

    const tag = detectPlanOfferTag(product.planName, product.productId);
    if (offer === 'regular' && tag !== null) return false;
    if (offer !== 'all' && offer !== 'regular' && tag !== offer) return false;

    if (!needle) return true;
    return (
      product.planName.toLowerCase().includes(needle) ||
      product.location.toLowerCase().includes(needle) ||
      product.productId.toLowerCase().includes(needle) ||
      product.category.toLowerCase().includes(needle) ||
      (product.storageType ?? '').toLowerCase().includes(needle) ||
      (product.cpu ?? '').toLowerCase().includes(needle) ||
      (product.bandwidthLabel ?? '').toLowerCase().includes(needle) ||
      (product.lineType ?? '').toLowerCase().includes(needle)
    );
  });

  products = [...products].sort((a, b) => {
    // Default browsing: Regular plans above Promo/Special/Limited, then price.
    // Also sink $0 / missing-spec / Unknown-heavy junk so restock-relevant plans surface.
    const junkDelta = planJunkRank(a) - planJunkRank(b);
    if (junkDelta !== 0) return junkDelta;

    const offerDelta = planOfferRank(a.planName, a.productId) - planOfferRank(b.planName, b.productId);
    if (offerDelta !== 0) return offerDelta;

    if (sort === 'name') return a.planName.localeCompare(b.planName);
    const left = a.priceCents ?? Number.POSITIVE_INFINITY;
    const right = b.priceCents ?? Number.POSITIVE_INFINITY;
    return sort === 'price_desc' ? right - left : left - right;
  });

  return products;
}

/** Lower rank sorts first. Regular (null tag) = 0; Limited/Special/Promo demoted. */
function planOfferRank(planName: string, productId: string): number {
  const tag = detectPlanOfferTag(planName, productId);
  if (tag === null) return 0;
  if (tag === 'limited') return 1;
  if (tag === 'special') return 2;
  return 3; // promo
}

/** Sink unusable rows ($0, missing RAM/disk, Unknown CPU) below real plans. */
function planJunkRank(product: {
  priceCents: number;
  ramMb: number | null;
  storageGb: number | null;
  cpu: string | null;
}): number {
  const missingSpecs = (product.ramMb ?? 0) <= 0
    || (product.storageGb ?? 0) <= 0
    || !product.cpu
    || product.cpu === 'Unknown';
  const zeroPrice = (product.priceCents ?? 0) <= 0;
  if (zeroPrice || missingSpecs) return 1;
  return 0;
}

function StockBadge({
  inStock,
  availabilitySource,
}: {
  inStock: boolean;
  availabilitySource?: string | null;
}) {
  const availability = resolveStockAvailability(inStock, availabilitySource);
  if (availability === 'in') {
    return (
      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        In Stock
      </span>
    );
  }
  if (availability === 'unknown') {
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Unknown
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
      Sold Out
    </span>
  );
}

function OfferBadge({ tag }: { tag: PlanOfferTag }) {
  const label = offerTagLabel(tag);
  if (!label || !tag) return <span className="text-muted-foreground/70">—</span>;

  const styles =
    tag === 'special'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-warning'
      : tag === 'promo'
        ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300'
        : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>
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
  const region = params.region?.trim() || 'all';
  const category = params.category?.trim() || 'all';
  const line = params.line?.trim() || 'all';
  const offer = parseOffer(params.offer);
  const ram = params.ram?.trim() || 'all';
  const ramMinMb = parsePositiveNumber(ram);
  const storage = params.storage?.trim() || 'all';
  const storageMinGb = parsePositiveNumber(storage);
  const disk = params.disk?.trim() || 'all';
  const bw = params.bw?.trim() || 'all';
  const bandwidthMinTb = parsePositiveNumber(bw);
  const cpu = params.cpu?.trim() || 'all';
  const cpuMinCores = parsePositiveNumber(cpu);
  const ipv4Filter = params.ipv4?.trim() || 'all';
  const billing = params.billing?.trim() || 'all';
  const minPrice = params.minPrice?.trim() || '';
  const maxPrice = params.maxPrice?.trim() || '';
  const minPriceCents = parsePriceCents(minPrice || undefined);
  const maxPriceCents = parsePriceCents(maxPrice || undefined);
  const query = params.q?.trim() || '';

  const locations = selected
    ? [...new Set(selected.products.map((product) => product.location))].sort()
    : [];
  const categories = selected
    ? [...new Set(selected.products.map((product) => product.category))].sort()
    : [];
  const lineTypes = selected
    ? [...new Set(selected.products.flatMap((product) => product.lineType ? [product.lineType] : []))].sort()
    : [];
  const billingCycles = selected
    ? [...new Set(selected.products.map((product) => product.billingCycle))].sort()
    : [];
  const products = selected
    ? filterProducts(
        selected,
        stock,
        location,
        region,
        category,
        line,
        offer,
        ramMinMb,
        storageMinGb,
        disk,
        bandwidthMinTb,
        cpuMinCores,
        ipv4Filter,
        billing,
        minPriceCents,
        maxPriceCents,
        query,
        sort,
      )
    : [];
  const inStockCount = selected?.products.filter(
    (product) => resolveStockAvailability(product.inStock, product.availabilitySource) === 'in',
  ).length ?? 0;
  const lastCheckedAt =
    selected?.products.reduce<Date | null>((latest, product) => {
      if (!product.lastCheckedAt) return latest;
      return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
    }, null) ?? null;

  const sharedParams = {
    p: selected?.slug,
    stock: stock === 'all' ? undefined : stock,
    location: location === 'all' ? undefined : location,
    region: region === 'all' ? undefined : region,
    category: category === 'all' ? undefined : category,
    line: line === 'all' ? undefined : line,
    offer: offer === 'all' ? undefined : offer,
    ram: ram === 'all' ? undefined : ram,
    storage: storage === 'all' ? undefined : storage,
    disk: disk === 'all' ? undefined : disk,
    bw: bw === 'all' ? undefined : bw,
    cpu: cpu === 'all' ? undefined : cpu,
    ipv4: ipv4Filter === 'all' ? undefined : ipv4Filter,
    billing: billing === 'all' ? undefined : billing,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    q: query || undefined,
    sort: sort === 'price_asc' ? undefined : sort,
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col lg:flex-row">
        <aside className="border-b border-border lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r xl:w-72">
          <div className="space-y-3 p-3 sm:p-4 lg:space-y-4 lg:p-5">
            <div className="flex items-baseline justify-between gap-3 lg:block lg:space-y-1">
              <h1 className="text-lg font-bold text-foreground sm:text-xl">Providers</h1>
              <p className="text-xs text-muted-foreground/80">{providers.length} monitored</p>
            </div>

            <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0 lg:pb-0">
              {providers.map((provider) => {
                const active = provider.slug === selected?.slug;
                return (
                  <Link
                    key={provider.id}
                    href={`/providers${buildQuery({
                      ...sharedParams,
                      p: provider.slug,
                      location: undefined,
                      region: undefined,
                      category: undefined,
                      line: undefined,
                      offer: undefined,
                      ram: undefined,
                      storage: undefined,
                      disk: undefined,
                      bw: undefined,
                      cpu: undefined,
                      ipv4: undefined,
                    })}`}
                    className={`shrink-0 rounded-md px-3 py-2 transition-colors lg:block lg:w-full ${
                      active
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-muted/60 text-foreground/80 hover:bg-muted hover:text-foreground lg:bg-transparent'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="whitespace-nowrap text-sm font-medium lg:truncate">
                        {provider.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground/80">
                        {provider.products.filter(
                          (product) =>
                            resolveStockAvailability(product.inStock, product.availabilitySource) === 'in',
                        ).length}
                        /{provider.products.length}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-5 p-3 sm:p-5 lg:p-6">
          {!selected ? (
            <p className="text-muted-foreground/80">No active providers.</p>
          ) : (
            <>
              <header className="space-y-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2 className="text-xl font-bold text-foreground sm:text-2xl">{selected.name}</h2>
                  <a
                    href={getProviderSiteUrl(selected.slug, selected.website)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-stock hover:opacity-90"
                  >
                    Official site
                  </a>
                  <Link
                    href={`/provider/${selected.slug}`}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Full page
                  </Link>
                </div>
                <p className="text-sm text-muted-foreground/80">
                  {inStockCount} in stock · {selected.products.length} plans · Last checked:{' '}
                  {lastCheckedAt
                    ? `${formatRelativeTime(lastCheckedAt)} (${formatDate(lastCheckedAt)})`
                    : 'Unknown'}
                </p>
              </header>

              <form
                method="get"
                className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
              >
                <input type="hidden" name="p" value={selected.slug} />
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Stock
                  <select
                    name="stock"
                    defaultValue={stock}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="in">In stock</option>
                    <option value="out">Sold out</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Region
                  <select
                    name="region"
                    defaultValue={region}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All regions</option>
                    {listRegions().map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Location
                  <select
                    name="location"
                    defaultValue={location}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All locations</option>
                    {locations.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Category
                  <select
                    name="category"
                    defaultValue={category}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All types</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {categoryLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Optimized line
                  <select
                    name="line"
                    defaultValue={line}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All lines</option>
                    {lineTypes.map((item) => (
                      <option key={item} value={item}>
                        {lineTypeLabel(item)}
                      </option>
                    ))}
                    <option value="standard">Standard / unclassified</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  RAM
                  <select
                    name="ram"
                    defaultValue={ram}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {RAM_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Storage
                  <select
                    name="storage"
                    defaultValue={storage}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {STORAGE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Disk type
                  <select
                    name="disk"
                    defaultValue={disk}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {DISK_TYPE_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Bandwidth
                  <select
                    name="bw"
                    defaultValue={bw}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {BANDWIDTH_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  CPU
                  <select
                    name="cpu"
                    defaultValue={cpu}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {CPU_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  IPv4
                  <select
                    name="ipv4"
                    defaultValue={ipv4Filter}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">Any</option>
                    <option value="yes">Included</option>
                    <option value="no">Not included</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Billing
                  <select
                    name="billing"
                    defaultValue={billing}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All cycles</option>
                    {billingCycles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Offer
                  <select
                    name="offer"
                    defaultValue={offer}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">All offers</option>
                    <option value="special">Special</option>
                    <option value="promo">Promo</option>
                    <option value="limited">Limited</option>
                    <option value="regular">Regular</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Min price
                  <input
                    name="minPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={minPrice}
                    placeholder="Any"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Max price
                  <input
                    name="maxPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={maxPrice}
                    placeholder="Any"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80">
                  Sort
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="price_asc">Price ↑ (regular first)</option>
                    <option value="price_desc">Price ↓</option>
                    <option value="name">Plan name</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-muted-foreground/80 sm:col-span-2 xl:col-span-2">
                  Search
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Plan / location / ID"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-3 sm:col-span-2 xl:col-span-2 2xl:col-span-1">
                  <button
                    type="submit"
                    className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-stock-strong"
                  >
                    Apply filters
                  </button>
                  <Link
                    href={`/providers?p=${selected.slug}`}
                    className="rounded px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Link>
                  <span className="pb-2 text-xs text-muted-foreground/80">{products.length} shown</span>
                </div>
              </form>

              <div className="overflow-x-auto rounded-lg border border-border [-webkit-overflow-scrolling:touch]">
                <table className="min-w-[1180px] w-full text-sm">
                  <thead className="bg-card text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Line</th>
                      <th className="px-4 py-3">CPU</th>
                      <th className="px-4 py-3">RAM</th>
                      <th className="px-4 py-3">Storage</th>
                      <th className="px-4 py-3">Bandwidth</th>
                      <th className="px-4 py-3">IPv4</th>
                      <th className="px-4 py-3">Offer</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-4 py-8 text-center text-muted-foreground/80">
                          No plans match the current filters.
                        </td>
                      </tr>
                    ) : (
                      products.map((product) => {
                        const tag = detectPlanOfferTag(product.planName, product.productId);
                        const availability = resolveStockAvailability(
                          product.inStock,
                          product.availabilitySource,
                        );
                        return (
                          <tr key={product.id} className="border-b border-border/60">
                            <td className="px-4 py-3 font-medium text-foreground">
                              <Link
                                href={`/provider/${selected.slug}/${encodeURIComponent(product.productId)}`}
                                className="hover:text-stock"
                              >
                                {product.planName}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {categoryLabel(product.category)}
                            </td>
                            <td className="px-4 py-3 text-foreground/80">{product.location}</td>
                            <td className="px-4 py-3 text-xs text-foreground/80">
                              <span className={product.lineType ? 'font-medium text-sky-700 dark:text-sky-300' : 'text-muted-foreground/70'}>
                                {lineTypeLabel(product.lineType)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                              {product.cpu || 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                              {product.ramMb
                                ? `${product.ramMb >= 1024 ? product.ramMb / 1024 : product.ramMb} ${
                                    product.ramMb >= 1024 ? 'GB' : 'MB'
                                  }`
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                              {product.storageGb
                                ? `${product.storageGb} GB ${product.storageType || ''}`.trim()
                                : 'N/A'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                              {formatBandwidth(product.bandwidthTb, product.bandwidthLabel)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                              {formatIpv4(product.ipv4)}
                            </td>
                            <td className="px-4 py-3">
                              <OfferBadge tag={tag} />
                            </td>
                            <td className="px-4 py-3 font-mono text-stock">
                              {formatPrice(product)}
                            </td>
                            <td className="px-4 py-3">
                              <StockBadge
                                inStock={product.inStock}
                                availabilitySource={product.availabilitySource}
                              />
                            </td>
                            <td className="px-4 py-3">
                              {product.orderUrl && availability === 'in' ? (
                                <a
                                  href={getProductOrderUrl(selected.slug, product.productId)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-stock hover:text-stock"
                                >
                                  Order
                                </a>
                              ) : availability !== 'in' ? (
                                <a
                                  href={botSubscribeUrl(selected.slug)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-600 hover:text-sky-500 dark:text-sky-300"
                                >
                                  Notify Me
                                </a>
                              ) : (
                                <span className="text-muted-foreground/70">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
