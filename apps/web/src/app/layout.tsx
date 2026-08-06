import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'),
  title: {
    default: 'VPSKnow Stock — VPS Restock Alerts',
    template: '%s | VPSKnow Stock',
  },
  description: 'Real-time VPS restock monitoring and curated offer aggregation.',
  applicationName: 'VPSKnow Stock',
  icons: {
    icon: [{ url: '/brand/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    siteName: 'VPSKnow Stock',
    title: 'VPSKnow Stock — VPS Restock Alerts',
    description: 'Real-time VPS restock monitoring and curated offer aggregation.',
    images: [
      {
        url: '/brand/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'VPSKnow Stock — Restock Alerts, Live Stock, Offers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VPSKnow Stock — VPS Restock Alerts',
    description: 'Real-time VPS restock monitoring and curated offer aggregation.',
    images: ['/brand/og-image.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
