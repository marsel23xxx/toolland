import type { OutputFormat } from './format';
import type { Rect, ResizeSpec } from './geometry';

export interface ImageJob {
  /** Format keluaran, atau 'same' = sama dengan format asli (HEIC/GIF/BMP menjadi JPG). */
  format: OutputFormat | 'same';
  /** Kualitas 1-100 untuk JPG/WebP/AVIF. */
  quality: number;
  /** WebP lossless. */
  lossless?: boolean;
  /** Potong dulu (koordinat piksel gambar asli), lalu resize. */
  crop?: Rect;
  resize?: ResizeSpec;
  /** Warna latar untuk area transparan (JPG) dan ruang kosong (contain). */
  background?: string;
  /** Untuk kompres: bila hasil tidak lebih kecil, kembalikan file asli. */
  keepIfLarger?: boolean;
}

export interface ImageResult {
  buffer: ArrayBuffer;
  format: OutputFormat;
  width: number;
  height: number;
  /** true bila file asli dikembalikan karena sudah optimal. */
  unchanged: boolean;
}

/** Error dengan kode yang bisa diterjemahkan di UI. */
export type ImageErrorCode = 'unsupported' | 'decode' | 'memory' | 'encode';
