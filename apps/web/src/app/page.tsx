import Link from 'next/link';
import { getLatestRestocks, getRecentlySoldOut, getProviders, getAffiliateUrl } from '@/lib/data';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@vpsknow/database';

function ProductCard({ product, badge }: { product: Product & { provider: { name: string } }; badge: string }) {
  return (
    <div className='rounded-lg border border-gray-800 bg-[#12121a] p-4'>
      <div className='flex items-center gap-2 mb-2'>
        <span className='text-xs px-2 py-1 rounded bg-gray-800 text-gray-300'>{badge}</span>
        <span className='text-xs text-gray-500'>{product.provider.name}</span>
      </div>
      <h3 className='font-semibold text-white'>{product.planName}</h3>
      <p className='text-sm text-gray-400'>{product.location} · {formatPrice(product)}</p>
      <a href={getAffiliateUrl(product.orderUrl)} className='text-sm text-blue-400 hover:underline' target='_blank' rel='noreferrer'>Order</a>
    </div>
  );
}

export default async function HomePage() {
  const providers = await getProviders();
  const restocks = await getLatestRestocks(6);
  const soldOut = await getRecentlySoldOut(6);

  return (
    <main className='min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-8'>
      <div className='max-w-5xl mx-auto space-y-10'>
        <header className='text-center space-y-2'>
          <h1 className='text-4xl font-bold text-white'>VPSKnow Stock</h1>
          <p className='text-gray-400'>Real-time VPS restock monitoring</p>
        </header>

        <section>
          <h2 className='text-xl font-semibold text-emerald-400 mb-4'>Latest Restocks</h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {restocks.length > 0 ? restocks.map((e) => (
              <ProductCard key={e.id} product={e.product as Product & { provider: { name: string } }} badge='RESTOCK' />
            )) : <p className='text-gray-500'>No restocks yet.</p>}
          </div>
        </section>

        <section>
          <h2 className='text-xl font-semibold text-white mb-4'>Providers</h2>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            {providers.map((p) => (
              <Link key={p.id} href={'/provider/' + p.slug} className='rounded-lg border border-gray-800 bg-[#12121a] p-4 hover:border-gray-600 transition-colors'>
                <h3 className='font-semibold text-white'>{p.name}</h3>
                <p className='text-sm text-gray-400'>{p.slug}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className='text-xl font-semibold text-red-400 mb-4'>Recently Sold Out</h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {soldOut.length > 0 ? soldOut.map((e) => (
              <ProductCard key={e.id} product={e.product as Product & { provider: { name: string } }} badge='SOLD OUT' />
            )) : <p className='text-gray-500'>No sold-out events yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}