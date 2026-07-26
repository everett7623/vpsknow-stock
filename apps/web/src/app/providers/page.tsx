import Link from "next/link";
import { getProviders } from "@/lib/data";

export default async function ProvidersPage() {
  const providers = await getProviders();
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-6 text-gray-100 sm:py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Providers</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providers.map((p) => (
            <Link key={p.id} href={"/provider/" + p.slug} className="rounded-lg border border-gray-800 bg-[#12121a] p-4 hover:border-gray-600 transition-colors">
              <h2 className="text-lg font-semibold text-white">{p.name}</h2>
              <p className="break-all text-sm text-gray-400">{p.website}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
