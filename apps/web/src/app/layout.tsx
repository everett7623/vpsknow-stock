import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { LocaleProvider } from '@/components/locale-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { getDictionary } from '@/lib/i18n/get-locale';
import { htmlLang } from '@/lib/i18n/config';
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

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary } = await getDictionary();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://stock.vpsknow.com'),
    title: {
      default: dictionary.meta.titleDefault,
      template: dictionary.meta.titleTemplate,
    },
    description: dictionary.meta.description,
    applicationName: 'VPSKnow Stock',
    icons: {
      icon: [{ url: '/brand/favicon.png', type: 'image/png' }],
      apple: [{ url: '/apple-icon.png', type: 'image/png' }],
    },
    openGraph: {
      type: 'website',
      siteName: 'VPSKnow Stock',
      title: dictionary.meta.titleDefault,
      description: dictionary.meta.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: dictionary.meta.titleDefault,
      description: dictionary.meta.description,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDictionary();

  return (
    <html
      lang={htmlLang(locale)}
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <SiteHeader />
            {children}
            <SiteFooter />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
