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

/** Keterangan singkat kategori untuk beranda. */
export const CATEGORY_NOTES: Record<CategoryId, Record<Locale, string>> = {
  gambar: { id: 'Foto, grafis, dan AI', en: 'Photos, graphics, and AI' },
  pdf: { id: 'Dokumen dan formulir', en: 'Documents and forms' },
  teks: { id: 'Tulisan dan caption', en: 'Writing and captions' },
  developer: { id: 'Data dan kode', en: 'Data and code' },
  media: { id: 'Video dan audio', en: 'Video and audio' },
};

/** Kelompok tool di dalam kategori: konverter tampil sebagai chip, tes sebagai daftar sendiri. */
export const GROUP_IDS = ['konversi', 'tes'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

/** Judul kelompok di beranda dan navbar. */
export const GROUP_NAMES: Record<GroupId, Record<Locale, string>> = {
  konversi: { id: 'Konversi format', en: 'Convert formats' },
  tes: { id: 'Tes & Psikotes', en: 'Tests & assessments' },
};
