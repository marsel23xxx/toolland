import { pageLocale } from './format';

/** Akhiran dan nama file hasil per bahasa, misalnya foto-kecil.jpg / foto-small.jpg. */
const NAMES = {
  id: {
    small: '-kecil',
    resized: '-resize',
    cropped: '-crop',
    passport: '-pasfoto',
    page: '-hal-',
    selection: '-pilihan',
    watermarked: '-watermark',
    numbered: '-bernomor',
    signed: '-ttd',
    clip: '-potongan',
    noBackground: '-tanpa-bg',
    blurred: '-blur',
    merged: 'gabungan',
    images: 'gambar',
    zipImages: 'toolland-gambar',
    zipSmallImages: 'gambar-kecil',
    zipResized: 'gambar-resize',
    zipSplit: 'pdf-terpisah',
    zipSmallPdf: 'pdf-kecil',
    zipPages: 'halaman-pdf',
    zipNoBackground: 'tanpa-background',
    zipPdf: 'hasil-pdf',
    image: 'gambar',
  },
  en: {
    small: '-small',
    resized: '-resized',
    cropped: '-cropped',
    passport: '-passport',
    page: '-page-',
    selection: '-selection',
    watermarked: '-watermarked',
    numbered: '-numbered',
    signed: '-signed',
    clip: '-clip',
    noBackground: '-no-bg',
    blurred: '-blurred',
    merged: 'merged',
    images: 'images',
    zipImages: 'toolland-images',
    zipSmallImages: 'small-images',
    zipResized: 'resized-images',
    zipSplit: 'split-pdf',
    zipSmallPdf: 'small-pdf',
    zipPages: 'pdf-pages',
    zipNoBackground: 'no-background',
    zipPdf: 'pdf-files',
    image: 'image',
  },
} as const;

export type NameKey = keyof (typeof NAMES)['id'];

/** Nama/akhiran file untuk bahasa halaman saat ini. */
export function fileName(key: NameKey): string {
  return NAMES[pageLocale()][key];
}
