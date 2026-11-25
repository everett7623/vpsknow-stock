export const LOCALES = ['zh', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh';

/** Bumped so browsers that cached the prior English-default cookie start on Chinese. */
export const LOCALE_COOKIE = 'vpsknow_locale_v2';

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh' || value === 'en';
}

export function htmlLang(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en';
}

export function intlLocale(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}
