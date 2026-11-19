'use client';

import { useLocale } from '@/components/locale-provider';
import { botSubscribeUrl } from '@/lib/utils';

const BOT_URL = botSubscribeUrl();
const CHANNEL_URL = 'https://t.me/vpsknow_offers';

export function SiteFooter(): React.JSX.Element {
  const { dictionary } = useLocale();

  return (
    <footer className="border-t border-border/70 bg-background/80">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-3 py-8 text-sm text-muted-foreground sm:px-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start">
          <a
            href={BOT_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stock hover:text-stock-strong"
          >
            {dictionary.footer.getAlerts}
          </a>
          <span className="hidden text-border sm:inline" aria-hidden>
            |
          </span>
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            {dictionary.footer.offersChannel}
          </a>
          <span className="hidden text-border sm:inline" aria-hidden>
            |
          </span>
          <a href="https://vpsknow.com" className="hover:text-foreground">
            VPSKnow
          </a>
        </div>
        <p className="text-center text-xs text-muted-foreground/70 sm:text-left">
          {dictionary.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
