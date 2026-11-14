import type { NumberPosition } from './geometry';

export type PdfErrorCode = 'encrypted' | 'invalid' | 'memory';

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  /** 0-1 */
  opacity: number;
  /** derajat, berlawanan arah jarum jam */
  rotation: number;
  color: string;
  mode: 'center' | 'tile';
}

export interface PageNumberOptions {
  position: NumberPosition;
  /** Template dengan {n} dan {total}, misalnya "Halaman {n} dari {total}". */
  template: string;
  start: number;
  fontSize: number;
  skipFirst: boolean;
}

export interface ImagePageInput {
  bytes: ArrayBuffer;
  kind: 'jpeg' | 'png';
}

export interface ImagesToPdfOptions {
  pageSize: 'a4' | 'letter' | 'fit';
  orientation: 'auto' | 'portrait' | 'landscape';
  /** margin dalam point (1 mm = 2.835 pt) */
  margin: number;
}

export type CompressLevel = 'low' | 'medium' | 'high';

/** Pengaturan kompres per level: kualitas JPEG dan sisi terpanjang gambar. */
export const COMPRESS_PRESETS: Record<CompressLevel, { quality: number; maxSide: number }> = {
  low: { quality: 80, maxSide: 2400 },
  medium: { quality: 65, maxSide: 1600 },
  high: { quality: 50, maxSide: 1100 },
};

export interface CompressResult {
  bytes: Uint8Array;
  imagesTotal: number;
  imagesRecompressed: number;
  unchanged: boolean;
}

/**
 * Objek PDF Editor. Posisi dalam point, origin kiri atas halaman seperti terlihat di layar
 * (sudah memperhitungkan rotasi halaman).
 */
export type EditItem =
  | {
      type: 'text';
      page: number;
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      bold: boolean;
      italic: boolean;
      font: 'helvetica' | 'times' | 'courier';
      /** Jarak baseline baris pertama dari atas kotak, dibanding ukuran huruf (diukur di browser). */
      baseline: number;
      /** Edit tulisan asli: kotak warna latar yang menutup tulisan lama. */
      cover?: { x: number; y: number; w: number; h: number; color: string };
    }
  | { type: 'rect'; page: number; x: number; y: number; w: number; h: number; color: string }
  | { type: 'image'; page: number; x: number; y: number; w: number; h: number; image: string };

/** Gambar yang dipakai objek 'image', dikirim sekali walau dipasang di banyak halaman. */
export interface EditImage {
  bytes: ArrayBuffer;
  kind: 'png' | 'jpeg';
}

/** Tinggi baris teks dibanding ukuran huruf, sama di layar dan di PDF. */
export const EDIT_LINE_HEIGHT = 1.2;

/** Satu halaman hasil Atur Halaman: indeks halaman asal (mulai 0) dan putaran tambahan. */
export interface OrganizePage {
  index: number;
  /** Derajat searah jarum jam: 0, 90, 180, atau 270. */
  rotate: number;
}
