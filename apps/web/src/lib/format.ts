export const LOCALE_TAGS = { id: 'id-ID', en: 'en-US' } as const;
export type Locale = keyof typeof LOCALE_TAGS;

/** Format ukuran file sesuai bahasa, misalnya "4,2 MB". */
export function formatBytes(bytes: number, locale: Locale = 'id'): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString(LOCALE_TAGS[locale], { maximumFractionDigits: digits })} ${units[unit]}`;
}

/** Ganti placeholder {nama} di template teks. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}
