import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/providers', label: 'Stock' },
  { href: '/offers', label: 'Offers' },
] as const;

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="border-b border-gray-800/80 bg-[#0a0a0f]/">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-wide text-white hover:text-emerald-300">
          VPSKnow Stock
        </Link>
        <nav className="flex items-center gap-4 text-sm text-gray-400">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
          <a
            href="https://t.me/vpsknow_offers"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Telegram
          </a>
        </nav>
      </div>
    </header>
  );
}
