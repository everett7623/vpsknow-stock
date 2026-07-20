export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          VPSKnow Stock
        </h1>
        <p className="text-lg text-gray-400">
          Real-time VPS restock monitoring &amp; LowEndTalk offer alerts.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="https://t.me/vpsknow_stock"
            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            🟢 Restock Channel
          </a>
          <a
            href="https://t.me/vpsknow_offers"
            className="px-6 py-3 rounded-lg bg-[#12121a] border border-gray-700 hover:border-gray-500 text-white font-medium transition-colors"
          >
            🔥 Offers Channel
          </a>
        </div>
        <p className="text-sm text-gray-500 pt-8">
          Monitoring: BandwagonHost · DMIT · BuyVM — More coming soon.
        </p>
      </div>
    </main>
  );
}
