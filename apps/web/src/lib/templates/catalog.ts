/**
 * Katalog template Excel: kategori, URL, dan template yang belum tersedia ("segera hadir").
 * Template yang sudah tersedia punya konten di src/content/templates/<bahasa>/<slug>.md.
 */
import type { Locale } from '../format';

export const TEMPLATE_CATEGORY_IDS = ['keuangan', 'operasional', 'sdm', 'pribadi'] as const;
export type TemplateCategoryId = (typeof TEMPLATE_CATEGORY_IDS)[number];

export const TEMPLATE_CATEGORY_NAMES: Record<TemplateCategoryId, Record<Locale, string>> = {
  keuangan: { id: 'Keuangan usaha', en: 'Business finance' },
  operasional: { id: 'Inventaris & gudang', en: 'Inventory & warehouse' },
  sdm: { id: 'SDM & penggajian', en: 'HR & payroll' },
  pribadi: { id: 'Keuangan pribadi', en: 'Personal finance' },
};

export const TEMPLATE_CATEGORY_NOTES: Record<TemplateCategoryId, Record<Locale, string>> = {
  keuangan: { id: 'Kas, laba rugi, piutang, anggaran', en: 'Cash, P&L, receivables, budget' },
  operasional: { id: 'Stok, barang masuk dan keluar', en: 'Stock, goods in and out' },
  sdm: { id: 'Karyawan, absensi, gaji', en: 'Employees, attendance, payroll' },
  pribadi: { id: 'Anggaran rumah tangga, tabungan', en: 'Household budget, savings' },
};

/** Template yang sedang dibuat: tampil di katalog sebagai "segera hadir", belum bisa diunduh. */
export const UPCOMING_TEMPLATES: { category: TemplateCategoryId; name: Record<Locale, string> }[] =
  [{ category: 'pribadi', name: { id: 'Keuangan Pribadi', en: 'Personal Finance' } }];

/** Halaman katalog: /template (Indonesia) atau /en/templates (Inggris). */
export function templatesHome(locale: Locale): string {
  return locale === 'id' ? '/template' : '/en/templates';
}

export function templatePath(locale: Locale, slug: string): string {
  return `${templatesHome(locale)}/${slug}`;
}
