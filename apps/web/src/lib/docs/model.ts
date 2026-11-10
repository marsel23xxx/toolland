/**
 * Model dokumen untuk template surat dan CV. Satu model dirender dua kali: ke PDF (pdf.ts) dan ke
 * Word .docx (docx.ts), jadi isi dan urutannya selalu sama. Satuan ukuran: point (1/72 inci).
 */

export type DocFont = 'sans' | 'serif';

export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  /** Warna hex tanpa "#", misalnya "1f3a5f". */
  color?: string;
  href?: string;
  /** Garis bawah. */
  u?: boolean;
}

interface Spacing {
  /** Jarak sebelum dan sesudah blok, dalam pt. */
  before?: number;
  after?: number;
}

export type Block =
  | ({
      t: 'p';
      runs: Run[];
      size?: number;
      align?: 'left' | 'center' | 'right' | 'justify';
      color?: string;
      /** Tinggi baris relatif terhadap ukuran huruf. */
      lead?: number;
    } & Spacing)
  | ({
      t: 'h';
      text: string;
      size?: number;
      color?: string;
      /** Warna garis di bawah judul; tanpa garis bila kosong. */
      rule?: string;
      caps?: boolean;
      /** Jarak antarhuruf dalam pt (hanya PDF dan Word yang mendukung). */
      track?: number;
    } & Spacing)
  | ({ t: 'list'; items: Run[][]; size?: number; numbered?: boolean; color?: string } & Spacing)
  | ({ t: 'row'; left: Run[]; right: Run[]; size?: number; color?: string } & Spacing)
  | ({
      t: 'kv';
      rows: [string, string][];
      /** Lebar kolom label dalam pt. */
      label: number;
      size?: number;
    } & Spacing)
  | ({ t: 'rule'; color?: string; weight?: number } & Spacing)
  | { t: 'gap'; h: number }
  | ({
      t: 'cols';
      /** Isi tiap kolom. Kolom tidak dipecah antarhalaman. */
      cols: Block[][];
      /** Perbandingan lebar kolom; bawaan sama rata. */
      widths?: number[];
      gap?: number;
    } & Spacing)
  | ({
      t: 'box';
      runs: Run[];
      size?: number;
      align?: 'left' | 'center' | 'right';
      /** Warna garis tepi; tanpa garis bila kosong. */
      border?: string;
      dash?: boolean;
      fill?: string;
      pad?: number;
      /** Lebar kotak dalam pt; bawaan selebar kolom. Kotak sempit diletakkan sesuai `place`. */
      w?: number;
      /** Tinggi minimal dalam pt. */
      h?: number;
      place?: 'left' | 'center' | 'right';
      color?: string;
    } & Spacing)
  | ({
      t: 'img';
      data: Uint8Array;
      type: 'png' | 'jpeg';
      /** Ukuran tampil dalam pt. */
      w: number;
      h: number;
      align?: 'left' | 'center' | 'right';
    } & Spacing);

export interface DocSpec {
  title: string;
  author: string;
  lang: 'id' | 'en';
  font: DocFont;
  /** Ukuran huruf dasar dalam pt. */
  size: number;
  /** Warna teks dasar (hex tanpa "#"). */
  color: string;
  /** Ukuran halaman dalam pt; bawaan A4 tegak. */
  page?: { w: number; h: number };
  /** Margin halaman dalam pt. */
  margin: number;
  main: Block[];
  /** Kolom samping berwarna (CV profesional). Dirender sebagai tabel di Word. */
  side?: { width: number; bg: string; color: string; blocks: Block[] };
}

export const A4 = { w: 595.28, h: 841.89 } as const;
/** A5 mendatar (untuk kwitansi). */
export const A5_LANDSCAPE = { w: 595.28, h: 419.53 } as const;
export const DEFAULT_LEAD = 1.35;

export const run = (text: string, extra: Omit<Run, 'text'> = {}): Run => ({ text, ...extra });
export const para = (text: string, extra: Omit<Extract<Block, { t: 'p' }>, 't' | 'runs'> = {}) =>
  ({ t: 'p', runs: [run(text)], ...extra }) as Block;
