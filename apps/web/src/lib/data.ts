import { prisma, Prisma } from "@vpsknow/database";

const providerInclude = { products: { orderBy: { priceCents: "asc" } } } as const;
type ProviderWithProducts = Prisma.ProviderGetPayload<{ include: typeof providerInclude }>;

const restockInclude = { product: { include: { provider: true } } } as const;
type RestockEvent = Prisma.StockEventGetPayload<{ include: typeof restockInclude }>;
type SoldOutEvent = Prisma.StockEventGetPayload<{ include: typeof restockInclude }>;

const AFFILIATE_BASE = process.env.AFFILIATE_BASE_URL || "https://go.uukk.de";
const hasDatabase = !!process.env.DATABASE_URL;

export async function getProviders(): Promise<ProviderWithProducts[]> {
  if (!hasDatabase) return [];
  return prisma.provider.findMany({
    orderBy: { name: "asc" },
    include: providerInclude,
  });
}

export async function getProviderBySlug(slug: string): Promise<ProviderWithProducts | null> {
  if (!hasDatabase) return null;
  return prisma.provider.findUnique({
    where: { slug },
    include: providerInclude,
  });
}

export async function getLatestRestocks(limit = 10): Promise<RestockEvent[]> {
  if (!hasDatabase) return [];
  return prisma.stockEvent.findMany({
    where: { eventType: "restock" },
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: restockInclude,
  });
}

export async function getRecentlySoldOut(limit = 10): Promise<SoldOutEvent[]> {
  if (!hasDatabase) return [];
  return prisma.stockEvent.findMany({
    where: { eventType: "sold_out" },
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: restockInclude,
  });
}

export function getAffiliateUrl(orderUrl: string | null): string {
  if (!orderUrl) return "#";
  try {
    const encoded = encodeURIComponent(orderUrl);
    return AFFILIATE_BASE + "/?url=" + encoded;
  } catch {
    return orderUrl;
  }
}