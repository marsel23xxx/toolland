import { pageLocale } from './format';

/** Akhiran dan nama file hasil per bahasa, misalnya foto-kecil.jpg / foto-small.jpg. */
const NAMES = {
  id: {
    small: '-kecil',
    page: '-hal-',
    selection: '-pilihan',
    watermarked: '-watermark',
    numbered: '-bernomor',
    edited: '-diedit',
    signature: 'tanda-tangan',
    noBackground: '-tanpa-bg',
    merged: 'gabungan',
    images: 'gambar',
    zipImages: 'toolland-gambar',
    zipSmallImages: 'gambar-kecil',
    zipSplit: 'pdf-terpisah',
    zipSmallPdf: 'pdf-kecil',
    zipPages: 'halaman-pdf',
    zipNoBackground: 'tanpa-background',
    zipPdf: 'hasil-pdf',
    zipDocx: 'hasil-docx',
    image: 'gambar',
    converted: '-konversi',
    organized: '-diatur',
    screenRecording: 'rekaman-layar',
  },
  en: {
    small: '-small',
    page: '-page-',
    selection: '-selection',
    watermarked: '-watermarked',
    numbered: '-numbered',
    edited: '-edited',
    signature: 'signature',
    noBackground: '-no-bg',
    merged: 'merged',
    images: 'images',
    zipImages: 'toolland-images',
    zipSmallImages: 'small-images',
    zipSplit: 'split-pdf',
    zipSmallPdf: 'small-pdf',
    zipPages: 'pdf-pages',
    zipNoBackground: 'no-background',
    zipPdf: 'pdf-files',
    zipDocx: 'docx-files',
    image: 'image',
    converted: '-converted',
    organized: '-organized',
    screenRecording: 'screen-recording',
  },
} as const;

export type NameKey = keyof (typeof NAMES)['id'];

/** Nama/akhiran file untuk bahasa halaman saat ini. */
export function fileName(key: NameKey): string {
  return NAMES[pageLocale()][key];
}
