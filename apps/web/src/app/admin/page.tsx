import type { Metadata } from 'next';
import { prisma } from '@vpsknow/database';
import { assertAdmin } from '@/lib/admin-auth';
import { formatDate } from '@/lib/utils';
import { overrideProductStock, setProviderActive } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: { index: false, follow: false },
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export default async function AdminPage() {
  await assertAdmin();
  const [providers, affiliateLinks] = await Promise.all([
    prisma.provider.findMany({
      orderBy: { name: 'asc' },
      include: { products: { orderBy: { planName: 'asc' } } },
    }),
    prisma.affiliateLink.findMany({
      orderBy: [{ clicks: 'desc' }, { slug: 'asc' }],
      include: { provider: { select: { name: true, slug: true } } },
    }),
  ]);

  const totalClicks = affiliateLinks.reduce((sum, link) => sum + link.clicks, 0);
  const linksWithClicks = affiliateLinks.filter((link) => link.clicks > 0).length;
  const topLinks = affiliateLinks.filter((link) => link.clicks > 0).slice(0, 25);

  const clicksByProvider = new Map<string, { name: string; slug: string; clicks: number; links: number }>();
  for (const link of affiliateLinks) {
    const key = link.providerId;
    const existing = clicksByProvider.get(key) ?? {
      name: link.provider.name,
      slug: link.provider.slug,
      clicks: 0,
      links: 0,
    };
    existing.clicks += link.clicks;
    existing.links += 1;
    clicksByProvider.set(key, existing);
  }
  const providerClickRows = [...clicksByProvider.values()]
    .filter((row) => row.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-medium text-danger">RESTRICTED</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Stock Administration</h1>
          <p className="mt-2 text-muted-foreground">
            Provider health, monitoring state, short-link clicks, and manual stock overrides.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground/80">Providers</p>
            <p className="mt-1 font-mono text-2xl text-foreground">{providers.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground/80">Active</p>
            <p className="mt-1 font-mono text-2xl text-stock">
              {providers.filter((provider) => provider.isActive).length}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground/80">Products</p>
            <p className="mt-1 font-mono text-2xl text-foreground">
              {providers.reduce((total, provider) => total + provider.products.length, 0)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground/80">Short-link clicks</p>
            <p className="mt-1 font-mono text-2xl text-foreground">{formatCount(totalClicks)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCount(linksWithClicks)} / {formatCount(affiliateLinks.length)} links with traffic
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Short-link stats</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cumulative clicks from <code className="font-mono text-xs">/go/{'{slug}'}</code> redirects.
              Counts may under-report when intermediaries cache the 302.
            </p>
          </div>

          {totalClicks === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No short-link clicks recorded yet.</p>
          ) : (
            <div className="grid gap-0 lg:grid-cols-2">
              <div className="overflow-x-auto border-b border-border lg:border-b-0 lg:border-r">
                <table className="min-w-[420px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground/80">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Links</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerClickRows.map((row) => (
                      <tr key={row.slug} className="border-t border-border/70">
                        <td className="px-4 py-3 text-foreground">{row.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {formatCount(row.links)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-stock">
                          {formatCount(row.clicks)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground/80">
                    <tr>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinks.map((link) => (
                      <tr key={link.id} className="border-t border-border/70">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          <a
                            href={`/go/${link.slug}`}
                            className="hover:text-stock"
                            target="_blank"
                            rel="noreferrer"
                          >
                            /go/{link.slug}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{link.provider.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-stock">
                          {formatCount(link.clicks)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {providers.map((provider) => {
          const lastCheckedAt = provider.products.reduce<Date | null>((latest, product) => {
            if (!product.lastCheckedAt) return latest;
            return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
          }, null);
          const stale = !lastCheckedAt || Date.now() - lastCheckedAt.getTime() > 30 * 60 * 1_000;
          return (
            <section key={provider.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-4 border-b border-border p-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{provider.name}</h2>
                  <p className={`text-xs ${stale ? 'text-amber-400' : 'text-stock'}`}>
                    {stale ? 'Stale or unchecked' : `Healthy · ${formatDate(lastCheckedAt)}`}
                  </p>
                </div>
                <form action={setProviderActive} className="ml-auto">
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="isActive" value={provider.isActive ? 'false' : 'true'} />
                  <button
                    type="submit"
                    className={`rounded px-3 py-2 text-sm font-medium ${provider.isActive ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'}`}
                  >
                    {provider.isActive ? 'Disable monitoring' : 'Enable monitoring'}
                  </button>
                </form>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground/80">
                    <tr>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last checked</th>
                      <th className="px-4 py-3">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provider.products.map((product) => (
                      <tr key={product.id} className="border-t border-border/70">
                        <td className="px-4 py-3 text-foreground">{product.planName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{product.location}</td>
                        <td className={`px-4 py-3 ${product.inStock ? 'text-stock' : 'text-danger'}`}>
                          {product.inStock ? 'In stock' : 'Out of stock'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground/80">
                          {formatDate(product.lastCheckedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <form action={overrideProductStock}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="inStock" value={product.inStock ? 'false' : 'true'} />
                            <button type="submit" className="text-xs text-warning hover:text-amber-200">
                              Mark {product.inStock ? 'sold out' : 'in stock'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
