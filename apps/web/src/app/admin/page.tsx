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

export default async function AdminPage() {
  await assertAdmin();
  const providers = await prisma.provider.findMany({
    orderBy: { name: 'asc' },
    include: { products: { orderBy: { planName: 'asc' } } },
  });

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-gray-100">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="text-sm font-medium text-red-400">RESTRICTED</p>
          <h1 className="mt-1 text-3xl font-bold text-white">Stock Administration</h1>
          <p className="mt-2 text-gray-400">Provider health, monitoring state, and manual stock overrides.</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-[#12121a] p-4">
            <p className="text-xs uppercase text-gray-500">Providers</p>
            <p className="mt-1 font-mono text-2xl text-white">{providers.length}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#12121a] p-4">
            <p className="text-xs uppercase text-gray-500">Active</p>
            <p className="mt-1 font-mono text-2xl text-emerald-400">
              {providers.filter((provider) => provider.isActive).length}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-[#12121a] p-4">
            <p className="text-xs uppercase text-gray-500">Products</p>
            <p className="mt-1 font-mono text-2xl text-white">
              {providers.reduce((total, provider) => total + provider.products.length, 0)}
            </p>
          </div>
        </section>

        {providers.map((provider) => {
          const lastCheckedAt = provider.products.reduce<Date | null>((latest, product) => {
            if (!product.lastCheckedAt) return latest;
            return !latest || product.lastCheckedAt > latest ? product.lastCheckedAt : latest;
          }, null);
          const stale = !lastCheckedAt || Date.now() - lastCheckedAt.getTime() > 30 * 60 * 1_000;
          return (
            <section key={provider.id} className="overflow-hidden rounded-xl border border-gray-800 bg-[#12121a]">
              <div className="flex flex-wrap items-center gap-4 border-b border-gray-800 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{provider.name}</h2>
                  <p className={`text-xs ${stale ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {stale ? 'Stale or unchecked' : `Healthy · ${formatDate(lastCheckedAt)}`}
                  </p>
                </div>
                <form action={setProviderActive} className="ml-auto">
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="isActive" value={provider.isActive ? 'false' : 'true'} />
                  <button
                    type="submit"
                    className={`rounded px-3 py-2 text-sm font-medium ${provider.isActive ? 'bg-red-950 text-red-300' : 'bg-emerald-900 text-emerald-200'}`}
                  >
                    {provider.isActive ? 'Disable monitoring' : 'Enable monitoring'}
                  </button>
                </form>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-sm">
                  <thead className="text-left text-xs uppercase text-gray-500">
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
                      <tr key={product.id} className="border-t border-gray-800/70">
                        <td className="px-4 py-3 text-white">{product.planName}</td>
                        <td className="px-4 py-3 text-gray-400">{product.location}</td>
                        <td className={`px-4 py-3 ${product.inStock ? 'text-emerald-400' : 'text-red-400'}`}>
                          {product.inStock ? 'In stock' : 'Out of stock'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {formatDate(product.lastCheckedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <form action={overrideProductStock}>
                            <input type="hidden" name="productId" value={product.id} />
                            <input type="hidden" name="inStock" value={product.inStock ? 'false' : 'true'} />
                            <button type="submit" className="text-xs text-amber-300 hover:text-amber-200">
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
