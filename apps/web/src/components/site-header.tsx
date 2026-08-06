import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';

const links = [
  { href: '/', label: 'Home' },
  { href: '/providers', label: 'Stock' },
  { href: '/offers', label: 'Offers' },
] as const;

export function SiteHeader(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="transition-opacity hover:opacity-90">
          <BrandLogo size="sm" />
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <a
            href="https://t.me/vpsknow_offers"
            target="_blank"
            rel="noreferrer"
            className="text-stock hover:opacity-90"
          >
            Telegram
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
