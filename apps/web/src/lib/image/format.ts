import { fileName } from '../names';

export const OUTPUT_FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export type InputFormat = OutputFormat | 'heic' | 'gif' | 'bmp' | 'unknown';

export const MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};

export const EXT: Record<OutputFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  avif: 'avif',
};

export const FORMAT_LABEL: Record<OutputFormat, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
};

/** Format yang mendukung pengaturan kualitas (lossy). */
export const LOSSY: Record<OutputFormat, boolean> = {
  jpeg: true,
  png: false,
  webp: true,
  avif: true,
};

/** Semua input gambar yang diterima, termasuk HEIC dari iPhone. */
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.avif,.webp';

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'];

/** Tebak format dari magic bytes (bukan dari ekstensi atau tipe MIME). */
export function sniffFormat(head: Uint8Array): InputFormat {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (head[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(0, 3) === 'GIF') return 'gif';
  if (ascii(0, 2) === 'BM') return 'bmp';
  if (ascii(4, 8) === 'ftyp') {
    // brand utama + daftar brand kompatibel dalam kotak ftyp
    const size = Math.min(
      (head[0] << 24) | (head[1] << 16) | (head[2] << 8) | head[3],
      head.length,
    );
    const brands: string[] = [ascii(8, 12)];
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(i, i + 4));
    if (brands.includes('avif') || brands.includes('avis')) return 'avif';
    if (brands.some((b) => HEIC_BRANDS.includes(b)) || brands.includes('mif1')) return 'heic';
  }
  return 'unknown';
}

/** Format keluaran bila pengguna memilih "sama seperti asli". */
export function sameAsInput(input: InputFormat): OutputFormat {
  return (OUTPUT_FORMATS as readonly string[]).includes(input) ? (input as OutputFormat) : 'jpeg';
}

/** Nama file hasil: foto.HEIC -> foto.jpg, dengan akhiran opsional. */
export function outputName(original: string, format: OutputFormat, suffix = ''): string {
  const base = original.replace(/\.[^./\\]+$/, '') || fileName('image');
  return `${base}${suffix}.${EXT[format]}`;
}
