/**
 * Model presentasi untuk template PPT. Satu model dirender dua kali: ke PDF (pdf.ts) dan ke
 * PowerPoint .pptx (pptx.ts), jadi pratinjau di web sama dengan hasil unduhan. Koordinat dalam
 * point dari pojok kiri atas slide 16:9 berukuran 960 x 540 pt.
 */

export const SLIDE = { w: 960, h: 540 } as const;

export interface Fill {
  /** Warna hex tanpa "#". */
  color?: string;
  /** Gradien linear. angle dalam derajat: 0 = kiri ke kanan, 90 = atas ke bawah. */
  grad?: { angle: number; stops: [color: string, pos: number][] };
  /** 0..1 */
  opacity?: number;
}

export interface TextRun {
  text: string;
  b?: boolean;
  i?: boolean;
  color?: string;
}

export interface TextPara {
  runs: TextRun[];
  align?: 'l' | 'c' | 'r';
  /** Ukuran huruf paragraf; bawaan ukuran kotak teks. */
  size?: number;
  /** Tinggi baris relatif ukuran huruf. */
  lead?: number;
  /** Jarak setelah paragraf dalam pt. */
  after?: number;
  bullet?: 'dot' | 'num';
  color?: string;
}

export type El =
  | {
      t: 'shape';
      geom: 'rect' | 'round' | 'ellipse' | 'poly' | 'line';
      x: number;
      y: number;
      w: number;
      h: number;
      /** poly: titik relatif 0..1 terhadap kotak. */
      pts?: [number, number][];
      /** round: jari-jari sudut dalam pt. */
      r?: number;
      fill?: Fill;
      line?: { color: string; w: number; opacity?: number };
      /** Rotasi searah jarum jam dalam derajat. */
      rot?: number;
    }
  | {
      t: 'text';
      x: number;
      y: number;
      w: number;
      h: number;
      paras: TextPara[];
      size: number;
      color: string;
      valign?: 't' | 'm' | 'b';
      /** Jarak teks ke tepi kotak (pt). */
      pad?: number;
      /** Perkecil huruf agar muat di kotak (sampai 55%). */
      fit?: boolean;
      /** Dengan fit: perkecil juga sampai setiap paragraf muat satu baris (angka besar). */
      oneLine?: boolean;
      /** Spasi antarhuruf (pt). */
      track?: number;
    }
  | {
      t: 'img';
      x: number;
      y: number;
      w: number;
      h: number;
      data: Uint8Array;
      type: 'png' | 'jpeg';
      /** Ukuran asli gambar (px) untuk memotong agar memenuhi kotak. */
      iw: number;
      ih: number;
      /** contain: gambar utuh di dalam kotak (logo); cover: memenuhi kotak (foto). */
      mode?: 'cover' | 'contain';
      shape?: 'rect' | 'round' | 'ellipse';
      r?: number;
    };

export interface Slide {
  bg: Fill;
  els: El[];
}

export interface DeckSpec {
  title: string;
  author: string;
  lang: 'id' | 'en';
  font: 'sans' | 'serif';
  slides: Slide[];
  /** Warna tema PowerPoint (accent1..6), agar palet muncul di pemilih warna. */
  colors?: string[];
}

export type TextEl = Extract<El, { t: 'text' }>;
export type ShapeEl = Extract<El, { t: 'shape' }>;
export type ImgEl = Extract<El, { t: 'img' }>;

/** Kotak gambar mode cover: bagian sumber (relatif 0..1) yang dipotong di tiap sisi. */
export function coverCrop(el: Pick<ImgEl, 'w' | 'h' | 'iw' | 'ih'>) {
  const box = el.w / el.h;
  const img = el.iw / el.ih;
  if (img > box) {
    const keep = box / img;
    return { l: (1 - keep) / 2, r: (1 - keep) / 2, t: 0, b: 0 };
  }
  const keep = img / box;
  return { l: 0, r: 0, t: (1 - keep) / 2, b: (1 - keep) / 2 };
}

/** Kotak gambar mode contain: posisi dan ukuran gambar utuh di tengah kotak. */
export function containBox(el: Pick<ImgEl, 'x' | 'y' | 'w' | 'h' | 'iw' | 'ih'>) {
  const s = Math.min(el.w / el.iw, el.h / el.ih);
  const w = el.iw * s;
  const h = el.ih * s;
  return { x: el.x + (el.w - w) / 2, y: el.y + (el.h - h) / 2, w, h };
}
