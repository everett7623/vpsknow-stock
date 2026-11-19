'use server';

import { cookies } from 'next/headers';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';

export async function setLocaleCookie(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale as Locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
