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
