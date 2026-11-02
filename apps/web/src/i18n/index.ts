import { fill, type Locale } from '../lib/format';
import en from './en.json';
import id from './id.json';

export type { Locale };
export type UiKey = keyof typeof id;

// Bahasa Indonesia lengkap; bahasa lain boleh belum lengkap dan jatuh ke Indonesia.
const dictionaries: Record<Locale, Partial<Record<UiKey, string>>> = { id, en };

function lookup(locale: Locale, key: UiKey): string {
  return dictionaries[locale][key] ?? id[key];
}

/** Ambil fungsi terjemahan untuk satu bahasa (dipakai di file .astro saat build). */
export function useTranslations(locale: Locale) {
  return (key: UiKey, vars: Record<string, string | number> = {}) =>
    fill(lookup(locale, key), vars);
}

type Strip<P extends string, K> = K extends `${P}.${infer R}` ? R : never;
/** Semua teks dengan awalan "<prefix>." tanpa awalannya, misalnya Messages<'wordCounter'>. */
export type Messages<P extends string> = { [K in UiKey as Strip<P, K>]: string };

/**
 * Teks UI untuk satu komponen, disiapkan saat build lalu dikirim ke island sebagai props.
 * Island hanya menerima teks bahasa halaman itu, bukan seluruh kamus.
 */
export function messages<P extends string>(locale: Locale, prefix: P): Messages<P> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(id) as UiKey[]) {
    if (key.startsWith(`${prefix}.`)) out[key.slice(prefix.length + 1)] = lookup(locale, key);
  }
  return out as Messages<P>;
}

/** Bahasa dari URL saat build: /en/... = Inggris, selain itu Indonesia. */
export function getLocale(url: URL): Locale {
  return url.pathname === '/en' || url.pathname.startsWith('/en/') ? 'en' : 'id';
}

/** Teks bersama (salin, unduh, ...) ditambah teks khusus satu tool. */
export type ToolMessages<P extends string> = Messages<'common'> & Messages<P>;

export function toolMessages<P extends string>(locale: Locale, prefix: P): ToolMessages<P> {
  return { ...messages(locale, 'common'), ...messages(locale, prefix) };
}
