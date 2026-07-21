import Link from "next/link";
import { getProviders } from "@/lib/data";

export default async function ProvidersPage() {
  const providers = await getProviders();
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-gray-100 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white">Providers</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.map((p) => (
            <Link key={p.id} href={"/provider/" + p.slug} className="rounded-lg border border-gray-800 bg-[#12121a] p-4 hover:border-gray-600 transition-colors">
              <h2 className="text-lg font-semibold text-white">{p.name}</h2>
              <p className="text-sm text-gray-400">{p.website}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
