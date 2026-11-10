/**
 * Katalog template (dokumen, Excel, dan nanti PPT): format, kategori, URL, dan template yang belum
 * tersedia ("segera hadir"). Template yang sudah tersedia punya konten di
 * src/content/templates/<bahasa>/<slug>.md.
 */
import type { Locale } from '../format';

/** Format file template. Urutan ini juga urutan tab di katalog. */
export const TEMPLATE_FORMATS = ['dokumen', 'excel', 'ppt'] as const;
export type TemplateFormat = (typeof TEMPLATE_FORMATS)[number];

export const TEMPLATE_FORMAT_NAMES: Record<TemplateFormat, Record<Locale, string>> = {
  dokumen: { id: 'Dokumen', en: 'Documents' },
  excel: { id: 'Excel', en: 'Excel' },
  ppt: { id: 'PPT', en: 'PowerPoint' },
};

export const TEMPLATE_FORMAT_NOTES: Record<TemplateFormat, Record<Locale, string>> = {
  dokumen: { id: 'Surat dan CV, unduh PDF atau Word', en: 'Letters and CVs, as PDF or Word' },
  excel: {
    id: 'Spreadsheet dengan rumus dan dashboard',
    en: 'Spreadsheets with formulas and dashboards',
  },
  ppt: { id: 'Slide presentasi', en: 'Presentation slides' },
};

/** Format yang belum punya template: tab-nya tampil sebagai "segera hadir". */
export const UPCOMING_FORMATS: TemplateFormat[] = ['ppt'];

export const TEMPLATE_CATEGORY_IDS = [
  'karier',
  'surat',
  'keuangan',
  'operasional',
  'proyek',
  'sdm',
  'komunitas',
  'pribadi',
] as const;
export type TemplateCategoryId = (typeof TEMPLATE_CATEGORY_IDS)[number];

export const TEMPLATE_CATEGORY_NAMES: Record<TemplateCategoryId, Record<Locale, string>> = {
  karier: { id: 'Lamaran & karier', en: 'Jobs & career' },
  surat: { id: 'Surat umum', en: 'Everyday letters' },
  keuangan: { id: 'Keuangan usaha', en: 'Business finance' },
  operasional: { id: 'Operasional & penjualan', en: 'Operations & sales' },
  proyek: { id: 'Proyek & konstruksi', en: 'Projects & construction' },
  sdm: { id: 'SDM & penggajian', en: 'HR & payroll' },
  komunitas: { id: 'Sekolah & organisasi', en: 'School & community' },
  pribadi: { id: 'Pribadi & keluarga', en: 'Personal & family' },
};

export const TEMPLATE_CATEGORY_NOTES: Record<TemplateCategoryId, Record<Locale, string>> = {
  karier: {
    id: 'Lamaran, CV, pernyataan, paklaring',
    en: 'Cover letters, resumes, statements, references',
  },
  surat: { id: 'Surat kuasa, surat izin', en: 'Authorization and leave letters' },
  keuangan: { id: 'Kas, laba rugi, invoice, piutang', en: 'Cash, P&L, invoices, receivables' },
  operasional: { id: 'Stok barang, kasir, penjualan', en: 'Stock, point of sale, sales' },
  proyek: { id: 'RAB, jadwal, Gantt chart', en: 'Cost estimates, schedules, Gantt' },
  sdm: { id: 'Karyawan, absensi, gaji', en: 'Employees, attendance, payroll' },
  komunitas: { id: 'Nilai siswa, kas RT, iuran', en: 'Grades, community cash, dues' },
  pribadi: { id: 'Anggaran, tabungan, pernikahan', en: 'Budget, savings, wedding' },
};

/**
 * Template yang sedang dibuat: tampil di katalog dan navbar sebagai "segera hadir", belum bisa
 * diunduh. Kosong saat semua template sudah tersedia.
 */
export const UPCOMING_TEMPLATES: { category: TemplateCategoryId; name: Record<Locale, string> }[] =
  [];

/** Halaman katalog: /template (Indonesia) atau /en/templates (Inggris). */
export function templatesHome(locale: Locale): string {
  return locale === 'id' ? '/template' : '/en/templates';
}

export function templatePath(locale: Locale, slug: string): string {
  return `${templatesHome(locale)}/${slug}`;
}
