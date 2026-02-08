'use client';

import { createContext, useContext } from 'react';
import { Dict, Locale } from './types';
import { en } from './en';
import { es } from './es';

const dictionaries = {
  en,
  es,
};

const LocaleContext = createContext<{ dict: Dict; locale: Locale } | null>(null);

export function LocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const dict = dictionaries[locale] ?? en;
  return (
    <LocaleContext.Provider value={{ dict, locale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useT = (): Dict => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useT must be used within a LocaleProvider');
  }
  return context.dict;
};

export const useLocale = (): Locale => {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error('useLocale must be used within a LocaleProvider');
    }
    return context.locale;
}
