'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocaleCookie } from '@/app/locale-actions';
import { useLocale } from '@/components/locale-provider';
import type { Locale } from '@/lib/i18n/config';

export function LocaleSwitcher(): React.JSX.Element {
  const router = useRouter();
  const { locale, dictionary } = useLocale();
  const [pending, startTransition] = useTransition();
  const nextLocale: Locale = locale === 'en' ? 'zh' : 'en';
  const label = nextLocale === 'zh' ? dictionary.common.switchToZh : dictionary.common.switchToEn;

  function selectLocale(): void {
    if (pending) return;
    startTransition(async () => {
      await setLocaleCookie(nextLocale);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={selectLocale}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-stock/50 hover:text-foreground disabled:opacity-60"
      aria-label={label}
      title={label}
    >
      {locale === 'en' ? (
        <span className="text-sm font-semibold leading-none" aria-hidden>
          中
        </span>
      ) : (
        <span className="text-[11px] font-semibold leading-none tracking-wide" aria-hidden>
          EN
        </span>
      )}
    </button>
  );
}
