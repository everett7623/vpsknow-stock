import { prisma, Prisma } from '@vpsknow/database';

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
} as const;

export type ProductDetail = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

const AFFILIATE_BASE = process.env.AFFILIATE_BASE_URL || 'https://go.uukk.de';
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

export async function getRecentLetOffers(limit = 30) {
  if (!hasDatabase) return [];
  return prisma.offer.findMany({
    where: {
      source: 'lowendtalk',
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

  const offers = await prisma.offer.findMany({
    where: { confidence: { gte: 0.6 } },
    select: { provider: true, category: true, locations: true, billingCycle: true },
  });
  const values = <T>(items: T[]): T[] => [...new Set(items)].sort();

  return {
    providers: values(offers.flatMap((offer) => offer.provider ? [offer.provider] : [])),
    categories: values(offers.flatMap((offer) => offer.category ? [offer.category] : [])),
    locations: values(offers.flatMap((offer) => offer.locations)),
    billingCycles: values(offers.flatMap((offer) => offer.billingCycle ? [offer.billingCycle] : [])),
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
  const providers = await getProviders();
  return providers.map((provider) => ({
    id: provider.id,
    slug: provider.slug,
    name: provider.name,
    website: provider.website,
    tier: provider.tier,
    totalProducts: provider.products.length,
    inStockCount: provider.products.filter((product) => product.inStock).length,
  }));
}

export function getAffiliateUrl(orderUrl: string | null): string {
  if (!orderUrl) return '#';
  return `${AFFILIATE_BASE}/?url=${encodeURIComponent(orderUrl)}`;
}
