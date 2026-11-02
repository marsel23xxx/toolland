import type { Locale } from './format';

export const CATEGORY_IDS = ['gambar', 'pdf', 'teks', 'developer', 'media'] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const CATEGORY_NAMES: Record<CategoryId, Record<Locale, string>> = {
  gambar: { id: 'Gambar', en: 'Images' },
  pdf: { id: 'PDF', en: 'PDF' },
  teks: { id: 'Teks', en: 'Text' },
  developer: { id: 'Developer', en: 'Developer' },
  media: { id: 'Media', en: 'Media' },
};

/** URL halaman tool: /tools/<slug> (Indonesia) atau /en/tools/<slug> (Inggris). */
export function toolPath(locale: Locale, slug: string): string {
  return locale === 'id' ? `/tools/${slug}` : `/en/tools/${slug}`;
}
