import type { Metadata } from 'next';
import { prisma } from '@vpsknow/database';
import { assertAdmin } from '@/lib/admin-auth';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { overrideProductStock, setProviderActive } from './actions';
import { loadShortLinkStats } from './short-link-stats';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Admin Dashboard',
  robots: { index: false, follow: false },
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function hostFromReferer(referer: string | null): string {
  if (!referer) return '—';
  try {
    return new URL(referer).host || referer;
  } catch {
    return referer.slice(0, 48);
  }
}

export default async function AdminPage() {
  await assertAdmin();
  const [providers, shortLinkStats] = await Promise.all([
    prisma.provider.findMany({
      orderBy: { name: 'asc' },
      include: { products: { orderBy: { planName: 'asc' } } },
    }),
    loadShortLinkStats(),
  ]);

  const maxDaily = Math.max(1, ...shortLinkStats.daily.map((bucket) => bucket.clicks));
  const hasAnyClicks = shortLinkStats.totals.all > 0 || shortLinkStats.totals.d30 > 0;

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
            <p className="text-xs uppercase text-muted-foreground/80">Short links</p>
            <p className="mt-1 font-mono text-2xl text-foreground">
              {formatCount(shortLinkStats.linkCount)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCount(shortLinkStats.linksWithTraffic)} with traffic
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">Short-link stats</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-click events from <code className="font-mono text-xs">/go/{'{slug}'}</code>.
              Today uses Asia/Shanghai calendar day; 7d/30d are rolling windows. All-time uses the
              cumulative counter.
            </p>
          </div>

          <div className="grid gap-4 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <p className="text-xs uppercase text-muted-foreground/80">Today</p>
              <p className="mt-1 font-mono text-2xl text-stock">
                {formatCount(shortLinkStats.totals.today)}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <p className="text-xs uppercase text-muted-foreground/80">Last 7 days</p>
              <p className="mt-1 font-mono text-2xl text-foreground">
                {formatCount(shortLinkStats.totals.d7)}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <p className="text-xs uppercase text-muted-foreground/80">Last 30 days</p>
              <p className="mt-1 font-mono text-2xl text-foreground">
                {formatCount(shortLinkStats.totals.d30)}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-3">
              <p className="text-xs uppercase text-muted-foreground/80">All time</p>
              <p className="mt-1 font-mono text-2xl text-foreground">
                {formatCount(shortLinkStats.totals.all)}
              </p>
            </div>
          </div>

          <div className="border-b border-border p-4">
            <p className="mb-3 text-xs uppercase text-muted-foreground/80">Last 14 days (Shanghai)</p>
            <div className="flex h-24 items-end gap-1">
              {shortLinkStats.daily.map((bucket) => {
                const height = Math.max(4, Math.round((bucket.clicks / maxDaily) * 100));
                return (
                  <div key={bucket.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {bucket.clicks > 0 ? formatCount(bucket.clicks) : ''}
                    </span>
                    <div
                      className="w-full rounded-sm bg-stock/80"
                      style={{ height: `${height}%` }}
                      title={`${bucket.day}: ${bucket.clicks}`}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground/80">
                      {bucket.day.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {!hasAnyClicks ? (
            <p className="p-4 text-sm text-muted-foreground">
              No short-link clicks recorded yet. New clicks will appear here with period breakdowns.
            </p>
          ) : (
            <div className="grid gap-0 xl:grid-cols-2">
              <div className="overflow-x-auto border-b border-border xl:border-b-0 xl:border-r">
                <table className="min-w-[560px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground/80">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3 text-right">Today</th>
                      <th className="px-4 py-3 text-right">7d</th>
                      <th className="px-4 py-3 text-right">30d</th>
                      <th className="px-4 py-3 text-right">All</th>
                      <th className="px-4 py-3">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortLinkStats.providers.map((row) => (
                      <tr key={row.slug} className="border-t border-border/70">
                        <td className="px-4 py-3 text-foreground">
                          {row.name}
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            {formatCount(row.links)} links
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-stock">
                          {formatCount(row.today)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {formatCount(row.d7)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCount(row.d30)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCount(row.all)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatRelativeTime(row.lastClickedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto border-b border-border xl:border-b-0">
                <table className="min-w-[640px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground/80">
                    <tr>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3 text-right">Today</th>
                      <th className="px-4 py-3 text-right">7d</th>
                      <th className="px-4 py-3 text-right">30d</th>
                      <th className="px-4 py-3 text-right">All</th>
                      <th className="px-4 py-3">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortLinkStats.topLinks.map((link) => (
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
                          <div className="text-[10px] text-muted-foreground">{link.providerName}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-stock">
                          {formatCount(link.today)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground">
                          {formatCount(link.d7)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCount(link.d30)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                          {formatCount(link.all)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatRelativeTime(link.lastClickedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {shortLinkStats.recent.length > 0 ? (
            <div className="overflow-x-auto border-t border-border">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Recent clicks</h3>
              </div>
              <table className="min-w-[720px] w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground/80">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Referer</th>
                  </tr>
                </thead>
                <tbody>
                  {shortLinkStats.recent.map((row) => (
                    <tr key={row.id} className="border-t border-border/70">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{formatRelativeTime(row.clickedAt)}</div>
                        <div className="font-mono text-[10px] text-muted-foreground/70">
                          {formatDate(row.clickedAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        /go/{row.slug}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.providerName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {hostFromReferer(row.referer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
