'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';
import { dictionaries, type Dictionary } from '@/lib/i18n/dictionaries';

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dictionary: dictionaries[DEFAULT_LOCALE],
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = useMemo(
    () => ({
      locale,
      dictionary: dictionaries[locale],
    }),
    [locale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
