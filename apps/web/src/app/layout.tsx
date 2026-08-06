import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'),
  title: {
    default: 'VPSKnow Stock — VPS Restock Alerts',
    template: '%s | VPSKnow Stock',
  },
  description: 'Real-time VPS restock monitoring and curated offer aggregation.',
  openGraph: {
    type: 'website',
    siteName: 'VPSKnow Stock',
    title: 'VPSKnow Stock — VPS Restock Alerts',
    description: 'Real-time VPS restock monitoring and curated offer aggregation.',
  },
  twitter: {
    card: 'summary',
    title: 'VPSKnow Stock — VPS Restock Alerts',
    description: 'Real-time VPS restock monitoring and curated offer aggregation.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-gray-100 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
