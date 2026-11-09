/**
 * Kata untuk angka 0-999 (Indonesia dan Inggris). Disimpan sebagai tabel di sheet tersembunyi,
 * lalu rumus terbilang di Excel menyusun ribuan, jutaan, dan seterusnya dari tabel ini.
 */
import type { Locale } from '../format';

const ID_UNITS = [
  '',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

function idWords(n: number): string {
  if (n < 12) return ID_UNITS[n];
  if (n < 20) return `${ID_UNITS[n - 10]} belas`;
  if (n < 100) return `${ID_UNITS[Math.floor(n / 10)]} puluh ${ID_UNITS[n % 10]}`.trim();
  const h = Math.floor(n / 100);
  return `${h === 1 ? 'seratus' : `${ID_UNITS[h]} ratus`} ${idWords(n % 100)}`.trim();
}

const EN_UNITS = [
  '',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function enWords(n: number): string {
  if (n < 20) return EN_UNITS[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? `-${EN_UNITS[n % 10]}` : '');
  return `${EN_UNITS[Math.floor(n / 100)]} hundred${n % 100 ? ` ${enWords(n % 100)}` : ''}`;
}

/** Kata untuk 0..999 (indeks = angka). */
export function wordTable(locale: Locale): string[] {
  return Array.from({ length: 1000 }, (_, n) => (locale === 'id' ? idWords(n) : enWords(n)));
}

/** Terbilang lengkap (untuk tes): bilangan bulat 0..999 triliun. */
export function terbilang(n: number, locale: Locale): string {
  const t = wordTable(locale);
  const scales =
    locale === 'id'
      ? ['triliun', 'miliar', 'juta', 'ribu', '']
      : ['trillion', 'billion', 'million', 'thousand', ''];
  const groups = [1e12, 1e9, 1e6, 1e3, 1].map((d) => Math.floor(n / d) % 1000);
  const parts = groups.map((g, i) => {
    if (!g) return '';
    if (locale === 'id' && i === 3 && g === 1) return 'seribu';
    return `${t[g]} ${scales[i]}`.trim();
  });
  const s = parts.filter(Boolean).join(' ');
  return s || (locale === 'id' ? 'nol' : 'zero');
}
