import { notFound } from 'next/navigation';
import { getProviderBySlug, getAffiliateUrl } from '@/lib/data';
import { formatPrice, formatDate } from '@/lib/utils';

export default async function ProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);
  if (!provider) notFound();

  const inStock = provider.products.filter((p) => p.inStock);
  const soldOut = provider.products.filter((p) => !p.inStock);

  const now = Date.now();
  const staleThreshold = 30 * 60 * 1000;
  const isStale = provider.products.every((p) => !p.lastCheckedAt || now - new Date(p.lastCheckedAt).getTime() > staleThreshold);

  return (
    <main className='min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-8'>
      <div className='max-w-4xl mx-auto space-y-6'>
        <header className='space-y-2'>
          <h1 className='text-3xl font-bold text-white'>{provider.name}</h1>
          <p className='text-sm text-gray-400'>Last checked: {isStale ? 'Status Unknown' : formatDate(provider.products[0]?.lastCheckedAt ?? null)}</p>
          <a href={provider.website} className='text-blue-400 hover:underline text-sm' target='_blank' rel='noreferrer'>Official website</a>
        </header>

        <section>
          <h2 className='text-xl font-semibold text-emerald-400 mb-4'>In Stock</h2>
          {inStock.length > 0 ? (
            <ul className='space-y-3'>
              {inStock.map((p) => (
                <li key={p.id} className='rounded-lg border border-gray-800 bg-[#12121a] p-4'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                    <div>
                      <h3 className='font-semibold text-white'>{p.planName}</h3>
                      <p className='text-sm text-gray-400'>{p.location} · {p.cpu ?? 'N/A'} · {p.ramMb ?? 0} MB · {p.storageGb ?? 0} GB {p.storageType ?? ''}</p>
                    </div>
                    <div className='text-right'>
                      <p className='font-medium text-white'>{formatPrice(p)}</p>
                      <a href={getAffiliateUrl(p.orderUrl)} className='text-sm text-blue-400 hover:underline' target='_blank' rel='noreferrer'>Order</a>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className='text-gray-500'>No in-stock plans.</p>}
        </section>

        <section>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>Sold Out</h2>
          {soldOut.length > 0 ? (
            <ul className='space-y-3'>
              {soldOut.map((p) => (
                <li key={p.id} className='rounded-lg border border-gray-800 bg-[#12121a] p-4 opacity-60'>
                  <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
                    <div>
                      <h3 className='font-semibold text-white'>{p.planName}</h3>
                      <p className='text-sm text-gray-400'>{p.location} · {p.cpu ?? 'N/A'} · {p.ramMb ?? 0} MB · {p.storageGb ?? 0} GB {p.storageType ?? ''}</p>
                    </div>
                    <div className='text-right'>
                      <p className='font-medium text-gray-500'>{formatPrice(p)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className='text-gray-500'>No sold-out plans.</p>}
        </section>
      </div>
    </main>
  );
}