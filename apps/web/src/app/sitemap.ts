import type { MetadataRoute } from 'next';
import { getProviders } from '@/lib/data';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const providers = await getProviders();
  const dynamicRoutes: MetadataRoute.Sitemap = providers.flatMap((provider) => [
    {
      url: `${siteUrl}/provider/${provider.slug}`,
      lastModified: provider.updatedAt,
      changeFrequency: 'hourly',
      priority: 0.8,
    },
    ...provider.products.map((product) => ({
      url: `${siteUrl}/provider/${provider.slug}/${encodeURIComponent(product.productId)}`,
      lastModified: product.updatedAt,
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    })),
  ]);

  return [
    { url: siteUrl, changeFrequency: 'hourly', priority: 1 },
    { url: `${siteUrl}/providers`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/offers`, changeFrequency: 'hourly', priority: 0.9 },
    ...dynamicRoutes,
  ];
}
