import { fill, type Locale } from '../lib/format';
import en from './en.json';
import id from './id.json';

export type { Locale };
export type UiKey = keyof typeof id;

const dictionaries: Record<Locale, Record<UiKey, string>> = { id, en };

/** Ambil fungsi terjemahan untuk satu bahasa (dipakai di file .astro saat build). */
export function useTranslations(locale: Locale) {
  return (key: UiKey, vars: Record<string, string | number> = {}) =>
    fill(dictionaries[locale][key], vars);
}

/** Bahasa dari URL saat build: /en/... = Inggris, selain itu Indonesia. */
export function getLocale(url: URL): Locale {
  return url.pathname === '/en' || url.pathname.startsWith('/en/') ? 'en' : 'id';
}
