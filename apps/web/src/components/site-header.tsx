'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';

const links = [
  { href: '/', label: 'Home' },
  { href: '/providers', label: 'Stock' },
  { href: '/offers', label: 'Offers' },
] as const;

export function SiteHeader(): React.JSX.Element {
  const pathname = usePathname();
  const isProviders = pathname.startsWith('/providers');

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div
        className={
          isProviders
            ? 'flex w-full items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-4 lg:px-5'
            : 'mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-5 lg:px-6'
        }
      >
        <Link href="/" className="min-w-0 shrink transition-opacity hover:opacity-90">
          <BrandLogo size="sm" />
        </Link>
        <nav className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm text-muted-foreground [-webkit-overflow-scrolling:touch] sm:gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-md px-1.5 py-1 hover:text-foreground sm:px-0 sm:py-0"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://t.me/vpsknow_offers"
            target="_blank"
            rel="noreferrer"
            className="hidden shrink-0 text-stock hover:opacity-90 sm:inline"
          >
            Telegram
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
