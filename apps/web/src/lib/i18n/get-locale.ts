import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { dictionaries, type Dictionary } from './dictionaries';

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<{ locale: Locale; dictionary: Dictionary }> {
  const locale = await getLocale();
  return { locale, dictionary: dictionaries[locale] };
}
