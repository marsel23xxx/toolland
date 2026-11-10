/**
 * Konfigurasi form template dokumen (surat dan CV). Halaman mengirim konfigurasi ini ke
 * DocumentBuilder.vue (harus bisa diserialisasi: tanpa fungsi). Isian dikirim balik ke fungsi
 * buildDoc() milik template, yang menghasilkan DocSpec untuk PDF dan Word.
 */
import type { DeckSpec } from '../slides/model';
import type { DocSpec } from './model';

export type DocItem = Record<string, string>;
export type DocValue = string | DocItem[];
export type DocValues = Record<string, DocValue>;

export interface DocField {
  key: string;
  kind: 'text' | 'textarea' | 'date' | 'month' | 'select' | 'swatch' | 'image';
  label: string;
  placeholder?: string;
  hint?: string;
  /** select dan swatch. Untuk swatch, value adalah warna hex tanpa "#". */
  options?: { value: string; label: string }[];
  rows?: number;
  /** Lebar di grid 2 kolom. */
  span?: 1 | 2;
  max?: number;
  /** image: "photo" dipotong persegi (JPEG), "signature" tetap transparan (PNG). */
  /** photo: dipotong persegi; cover: foto utuh diperkecil (JPEG); signature/logo: PNG transparan. */
  image?: 'photo' | 'signature' | 'logo' | 'cover';
  /** Tautan bantuan di bawah field. */
  link?: { href: string; label: string };
}

export interface DocRepeat {
  key: string;
  kind: 'repeat';
  label: string;
  add: string;
  /** Field yang dipakai sebagai judul item saat dilipat. */
  title: string;
  fields: DocField[];
  max: number;
  hint?: string;
}

export interface DocSection {
  id: string;
  title: string;
  items: (DocField | DocRepeat)[];
}

export interface DocForm {
  /** Kunci pemuat kode template di DocumentBuilder.vue. */
  template: string;
  /** "deck" untuk template PPT (unduh PPTX + PDF); bawaan dokumen (PDF + Word). */
  output?: 'doc' | 'deck';
  /** Kunci penyimpanan isian di browser; CV ATS dan CV profesional berbagi "cv". */
  storage: string;
  fileBase: string;
  /** Field yang ikut masuk nama file. */
  fileKey: string;
  sections: DocSection[];
  /** Isian contoh (juga isian awal). */
  sample: DocValues;
  /**
   * Teks contoh per bahasa dokumen. Saat bahasa diganti, field yang isinya masih sama dengan
   * contoh bahasa lama diganti dengan contoh bahasa baru.
   */
  langText?: Record<'id' | 'en', Record<string, string>>;
  /**
   * Field pilihan "jenis" yang mengisi ulang field lain, misalnya jenis surat izin. Field yang
   * sudah diubah pengguna (bukan teks preset mana pun) tidak ditimpa.
   */
  presets?: { key: string; fill: Record<string, Record<string, string>> };
}

/** Gambar yang sudah diproses komponen: foto persegi (JPEG), versi bulat (PNG), tanda tangan. */
export type DocAssets = Record<
  string,
  { data: Uint8Array; type: 'png' | 'jpeg'; w: number; h: number }
>;

export interface DocModule {
  buildDoc?(v: DocValues, assets: DocAssets): DocSpec;
  buildDeck?(v: DocValues, assets: DocAssets): DeckSpec;
}

export function text(v: DocValues, key: string, max = 200): string {
  const x = v[key];
  return typeof x === 'string'
    ? x
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, max)
    : '';
}

/** Teks panjang: baris baru dipertahankan, baris kosong berlebih dirapikan. */
export function longText(v: DocValues, key: string, max = 3000): string {
  const x = v[key];
  return typeof x === 'string'
    ? x
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, max)
    : '';
}

export function lines(s: string, max = 30): string[] {
  return s
    .split('\n')
    .map((x) => x.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}

export function paragraphs(s: string): string[] {
  return s
    .split(/\n\s*\n/)
    .map((x) => x.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export function items(v: DocValues, key: string, max = 20): DocItem[] {
  const x = v[key];
  return Array.isArray(x) ? x.filter((it) => it && typeof it === 'object').slice(0, max) : [];
}

export function itemText(it: DocItem, key: string, max = 200): string {
  return typeof it[key] === 'string'
    ? it[key]
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, max)
    : '';
}

export function choice<T extends string>(
  v: DocValues,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const x = v[key];
  return allowed.includes(x as T) ? (x as T) : fallback;
}

/** Ganti token {nama} dengan nilainya; token tanpa nilai dibiarkan apa adanya. */
export function fillTokens(s: string, map: Record<string, string>): string {
  return s.replace(/\{([a-z_]+)\}/g, (all, k: string) => map[k] || all);
}

const MONTHS = {
  id: [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};
const SHORT = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "2026-11-10" -> "10 November 2026" (id) atau "10 November 2026" (en, gaya Inggris). */
export function longDate(iso: string, lang: 'id' | 'en'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return '';
  return lang === 'en'
    ? `${MONTHS.en[mo - 1]} ${Number(m[3])}, ${m[1]}`
    : `${Number(m[3])} ${MONTHS.id[mo - 1]} ${m[1]}`;
}

/** "2021-03" -> "Mar 2021"; kosong -> "". */
export function monthYear(ym: string, lang: 'id' | 'en'): string {
  const m = /^(\d{4})-(\d{2})/.exec(ym);
  if (!m) return /^\d{4}$/.test(ym.trim()) ? ym.trim() : '';
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? `${SHORT[lang][mo - 1]} ${m[1]}` : m[1];
}

/** Rentang waktu: "Mar 2021 – Sekarang". Tanpa awal: hanya akhir. */
export function period(start: string, end: string, lang: 'id' | 'en', ongoing = true): string {
  const a = monthYear(start, lang);
  const b = monthYear(end, lang) || (a && ongoing ? (lang === 'id' ? 'Sekarang' : 'Present') : '');
  return a && b ? `${a} – ${b}` : a || b;
}

/** Tanggal hari ini "YYYY-MM-DD" waktu lokal. */
export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nama file aman: "CV-ATS-Julian-Marcell". */
export function safeFileName(...parts: string[]): string {
  return parts
    .map((p) =>
      p
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40),
    )
    .filter(Boolean)
    .join('-');
}
