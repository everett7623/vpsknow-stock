import { prisma } from '@vpsknow/database';

export async function getProviders() {
  return prisma.provider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getProviderBySlug(slug: string) {
  return prisma.provider.findUnique({
    where: { slug },
    include: {
      products: {
        orderBy: [{ inStock: 'desc' }, { planName: 'asc' }],
      },
    },
  });
}

export async function getRecentStockEvents(limit = 20) {
  return prisma.stockEvent.findMany({
    take: limit,
    orderBy: { detectedAt: 'desc' },
    include: {
      product: {
        include: { provider: true },
      },
    },
  });
}

export async function getStockSummary() {
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    include: {
      products: {
        select: { inStock: true },
      },
    },
  });

  return providers.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    website: p.website,
    tier: p.tier,
    totalProducts: p.products.length,
    inStockCount: p.products.filter((prod) => prod.inStock).length,
  }));
}
