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
