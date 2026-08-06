import { prisma, Prisma } from '@vpsknow/database';
import { buildStockGoUrl, resolveAffiliateProviderSlug } from '@vpsknow/shared';

const providerInclude = {
  products: { orderBy: { priceCents: 'asc' as const } },
} as const;

export type ProviderWithProducts = Prisma.ProviderGetPayload<{
  include: typeof providerInclude;
}>;

const stockEventInclude = {
  product: { include: { provider: true } },
} as const;

export type StockEventWithProduct = Prisma.StockEventGetPayload<{
  include: typeof stockEventInclude;
}>;

const productDetailInclude = {
  provider: true,
  stockEvents: {
    orderBy: { detectedAt: 'desc' as const },
    take: 50,
  },
  stockChecks: {
    where: { priceCents: { not: null } },
    orderBy: { checkedAt: 'desc' as const },
    take: 100,
  },
} as const;

export type ProductDetail = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

const hasDatabase = Boolean(process.env.DATABASE_URL);

export async function getProviders(): Promise<ProviderWithProducts[]> {
  if (!hasDatabase) return [];
  return prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: providerInclude,
  });
}

export async function getProviderBySlug(
  slug: string,
): Promise<ProviderWithProducts | null> {
  if (!hasDatabase) return null;
  return prisma.provider.findUnique({
    where: { slug },
    include: providerInclude,
  });
}

export async function getProductDetail(
  providerSlug: string,
  productId: string,
): Promise<ProductDetail | null> {
  if (!hasDatabase) return null;
  return prisma.product.findFirst({
    where: {
      productId,
      provider: { slug: providerSlug, isActive: true },
    },
    include: productDetailInclude,
  });
}

export async function getLatestRestocks(
  limit = 10,
): Promise<StockEventWithProduct[]> {
  if (!hasDatabase) return [];
  return prisma.stockEvent.findMany({
    where: { eventType: 'restock' },
    orderBy: { detectedAt: 'desc' },
    take: limit,
    include: stockEventInclude,
  });
}

export async function getRecentlySoldOut(
  limit = 10,
): Promise<StockEventWithProduct[]> {
  if (!hasDatabase) return [];
  return prisma.stockEvent.findMany({
    where: { eventType: 'sold_out' },
    orderBy: { detectedAt: 'desc' },
    take: limit,
    include: stockEventInclude,
  });
}

export async function getRecentStockEvents(
  limit = 20,
): Promise<StockEventWithProduct[]> {
  if (!hasDatabase) return [];
  return prisma.stockEvent.findMany({
    take: limit,
    orderBy: { detectedAt: 'desc' },
    include: stockEventInclude,
  });
}

export async function getRecentOffers(limit = 30) {
  if (!hasDatabase) return [];
  return prisma.offer.findMany({
    where: {
      source: { in: ['lowendtalk', 'lowendbox', 'lowendspirit'] },
      confidence: { gte: 0.6 },
      isLimitedStock: false,
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });
}

export async function getLimitedOffers(limit = 30) {
  if (!hasDatabase) return [];
  return prisma.offer.findMany({
    where: {
      confidence: { gte: 0.6 },
      isLimitedStock: true,
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });
}

export type OfferSort = 'newest' | 'price_asc' | 'price_desc';

export interface OfferFilters {
  provider?: string;
  category?: string;
  location?: string;
  billingCycle?: string;
  ipv4?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: OfferSort;
}

export interface OfferFilterOptions {
  providers: string[];
  categories: string[];
  locations: string[];
  billingCycles: string[];
}

function offerWhere(filters: OfferFilters): Prisma.OfferWhereInput {
  const hasPriceFilter = filters.minPriceCents !== undefined || filters.maxPriceCents !== undefined;

  return {
    confidence: { gte: 0.6 },
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.location ? { locations: { has: filters.location } } : {}),
    ...(filters.billingCycle ? { billingCycle: filters.billingCycle } : {}),
    ...(filters.ipv4 === true ? { ipv4: true } : {}),
    ...(hasPriceFilter ? {
      priceCents: {
        ...(filters.minPriceCents !== undefined ? { gte: filters.minPriceCents } : {}),
        ...(filters.maxPriceCents !== undefined ? { lte: filters.maxPriceCents } : {}),
      },
    } : {}),
  };
}

function offerOrderBy(sort: OfferSort | undefined): Prisma.OfferOrderByWithRelationInput {
  if (sort === 'price_asc') return { priceCents: 'asc' };
  if (sort === 'price_desc') return { priceCents: 'desc' };
  return { postedAt: 'desc' };
}

export async function getOffers(filters: OfferFilters = {}, limit = 60) {
  if (!hasDatabase) return [];
  return prisma.offer.findMany({
    where: offerWhere(filters),
    orderBy: offerOrderBy(filters.sort),
    take: limit,
  });
}

export async function getOfferFilterOptions(): Promise<OfferFilterOptions> {
  if (!hasDatabase) {
    return { providers: [], categories: [], locations: [], billingCycles: [] };
  }

  const eligible = { confidence: { gte: 0.6 } };
  const [providerRows, categoryRows, locationRows, billingRows] = await Promise.all([
    prisma.offer.findMany({
      where: { ...eligible, provider: { not: null } },
      select: { provider: true },
      distinct: ['provider'],
    }),
    prisma.offer.findMany({
      where: { ...eligible, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    }),
    prisma.offer.findMany({
      where: eligible,
      select: { locations: true },
    }),
    prisma.offer.findMany({
      where: { ...eligible, billingCycle: { not: null } },
      select: { billingCycle: true },
      distinct: ['billingCycle'],
    }),
  ]);
  const values = <T>(items: T[]): T[] => [...new Set(items)].sort();

  return {
    providers: values(providerRows.flatMap((offer) => offer.provider ? [offer.provider] : [])),
    categories: values(categoryRows.flatMap((offer) => offer.category ? [offer.category] : [])),
    locations: values(locationRows.flatMap((offer) => offer.locations)),
    billingCycles: values(billingRows.flatMap((offer) => offer.billingCycle ? [offer.billingCycle] : [])),
  };
}

export async function getStockSummary(): Promise<
  Array<{
    id: string;
    slug: string;
    name: string;
    website: string;
    tier: string;
    totalProducts: number;
    inStockCount: number;
  }>
> {
  if (!hasDatabase) return [];
  const [providers, inStockGroups] = await Promise.all([
    prisma.provider.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        website: true,
        tier: true,
        _count: { select: { products: true } },
      },
    }),
    prisma.product.groupBy({
      by: ['providerId'],
      where: { inStock: true, provider: { isActive: true } },
      _count: { _all: true },
    }),
  ]);
  const inStockByProvider = new Map(
    inStockGroups.map((group) => [group.providerId, group._count._all]),
  );
  return providers.map((provider) => ({
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    website: provider.website,
    tier: provider.tier,
    totalProducts: provider._count.products,
    inStockCount: inStockByProvider.get(provider.id) ?? 0,
  }));
}

/**
 * Product Order CTA → internal short link (stock.vpsknow.com/go/...).
 * Aff+pid stay server-side in affiliate_links.targetUrl.
 */
export function getProductOrderUrl(providerSlug: string, productId: string): string {
  return buildStockGoUrl(providerSlug, productId);
}

/**
 * Provider Official site CTA → /go/{slug} when affiliate is configured,
 * otherwise fall back to the provider website URL.
 */
export function getProviderSiteUrl(
  providerSlug: string,
  websiteFallback?: string | null,
): string {
  const slug = resolveAffiliateProviderSlug(providerSlug);
  if (slug) return buildStockGoUrl(slug);
  return websiteFallback?.trim() || '#';
}

/**
 * Offer Order CTA: prefer provider-level /go/{slug} when the merchant maps to a
 * configured affiliate. Otherwise omit Order (Source forum link remains).
 */
export function getOfferOrderUrl(
  provider: string | null,
  orderUrl: string | null,
): string | null {
  if (!orderUrl) return null;
  const slug = resolveAffiliateProviderSlug(provider);
  if (!slug) return null;
  return buildStockGoUrl(slug);
}
