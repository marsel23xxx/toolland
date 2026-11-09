/**
 * Aturan penggajian Indonesia yang ditulis ke sheet "Tarif & BPJS" (semua bisa diubah di file).
 *
 * - TER PPh 21 bulanan: Lampiran PP 58/2023 (kategori A 44 lapisan, B 40, C 41). Angka di bawah
 *   adalah batas bawah tiap lapisan dan tarifnya (dalam %).
 * - PTKP: PMK 101/2016. Kategori TER per status: PP 58/2023 pasal 2.
 * - Tarif Pasal 17 ayat (1) huruf a: UU 7/2021 (HPP).
 * - Iuran BPJS: PP 44/2015, PP 45/2015, Perpres 82/2018 (dan perubahannya). Batas upah Jaminan
 *   Pensiun Rp10.547.400 berlaku sejak Maret 2025 dan disesuaikan BPJS setiap tahun.
 */

/** [batas atas lapisan (Rp), tarif %]; baris terakhir tanpa batas atas (Infinity). */
type Ter = [number, number][];

const M = 1_000_000;

export const TER: Record<'A' | 'B' | 'C', Ter> = {
  A: [
    [5.4 * M, 0],
    [5.65 * M, 0.25],
    [5.95 * M, 0.5],
    [6.3 * M, 0.75],
    [6.75 * M, 1],
    [7.5 * M, 1.25],
    [8.55 * M, 1.5],
    [9.65 * M, 1.75],
    [10.05 * M, 2],
    [10.35 * M, 2.25],
    [10.7 * M, 2.5],
    [11.05 * M, 3],
    [11.6 * M, 3.5],
    [12.5 * M, 4],
    [13.75 * M, 5],
    [15.1 * M, 6],
    [16.95 * M, 7],
    [19.75 * M, 8],
    [24.15 * M, 9],
    [26.45 * M, 10],
    [28 * M, 11],
    [30.05 * M, 12],
    [32.4 * M, 13],
    [35.4 * M, 14],
    [39.1 * M, 15],
    [43.85 * M, 16],
    [47.8 * M, 17],
    [51.4 * M, 18],
    [56.3 * M, 19],
    [62.2 * M, 20],
    [68.6 * M, 21],
    [77.5 * M, 22],
    [89 * M, 23],
    [103 * M, 24],
    [125 * M, 25],
    [157 * M, 26],
    [206 * M, 27],
    [337 * M, 28],
    [454 * M, 29],
    [550 * M, 30],
    [695 * M, 31],
    [910 * M, 32],
    [1400 * M, 33],
    [Infinity, 34],
  ],
  B: [
    [6.2 * M, 0],
    [6.5 * M, 0.25],
    [6.85 * M, 0.5],
    [7.3 * M, 0.75],
    [9.2 * M, 1],
    [10.75 * M, 1.5],
    [11.25 * M, 2],
    [11.6 * M, 2.5],
    [12.6 * M, 3],
    [13.6 * M, 4],
    [14.95 * M, 5],
    [16.4 * M, 6],
    [18.45 * M, 7],
    [21.85 * M, 8],
    [26 * M, 9],
    [27.7 * M, 10],
    [29.35 * M, 11],
    [31.45 * M, 12],
    [33.95 * M, 13],
    [37.1 * M, 14],
    [41.1 * M, 15],
    [45.8 * M, 16],
    [49.5 * M, 17],
    [53.8 * M, 18],
    [58.5 * M, 19],
    [64 * M, 20],
    [71 * M, 21],
    [80 * M, 22],
    [93 * M, 23],
    [109 * M, 24],
    [129 * M, 25],
    [163 * M, 26],
    [211 * M, 27],
    [374 * M, 28],
    [459 * M, 29],
    [555 * M, 30],
    [704 * M, 31],
    [957 * M, 32],
    [1405 * M, 33],
    [Infinity, 34],
  ],
  C: [
    [6.6 * M, 0],
    [6.95 * M, 0.25],
    [7.35 * M, 0.5],
    [7.8 * M, 0.75],
    [8.85 * M, 1],
    [9.8 * M, 1.25],
    [10.95 * M, 1.5],
    [11.2 * M, 1.75],
    [12.05 * M, 2],
    [12.95 * M, 3],
    [14.15 * M, 4],
    [15.55 * M, 5],
    [17.05 * M, 6],
    [19.5 * M, 7],
    [22.7 * M, 8],
    [26.6 * M, 9],
    [28.1 * M, 10],
    [30.1 * M, 11],
    [32.6 * M, 12],
    [35.4 * M, 13],
    [38.9 * M, 14],
    [43 * M, 15],
    [47.4 * M, 16],
    [51.2 * M, 17],
    [55.8 * M, 18],
    [60.4 * M, 19],
    [66.7 * M, 20],
    [74.5 * M, 21],
    [83.2 * M, 22],
    [95.6 * M, 23],
    [110 * M, 24],
    [134 * M, 25],
    [169 * M, 26],
    [221 * M, 27],
    [390 * M, 28],
    [463 * M, 29],
    [561 * M, 30],
    [709 * M, 31],
    [965 * M, 32],
    [1419 * M, 33],
    [Infinity, 34],
  ],
};

/** Status PTKP, PTKP setahun, dan kategori TER. */
export const PTKP: [string, number, 'A' | 'B' | 'C'][] = [
  ['TK/0', 54 * M, 'A'],
  ['TK/1', 58.5 * M, 'A'],
  ['TK/2', 63 * M, 'B'],
  ['TK/3', 67.5 * M, 'B'],
  ['K/0', 58.5 * M, 'A'],
  ['K/1', 63 * M, 'B'],
  ['K/2', 67.5 * M, 'B'],
  ['K/3', 72 * M, 'C'],
];

/** Pasal 17: batas atas lapisan PKP setahun dan tarif %. */
export const PASAL17: [number, number][] = [
  [60 * M, 5],
  [250 * M, 15],
  [500 * M, 25],
  [5000 * M, 30],
  [Infinity, 35],
];

export const BPJS = {
  kesEr: 4,
  kesEe: 1,
  kesCap: 12 * M,
  jhtEr: 3.7,
  jhtEe: 2,
  jpEr: 2,
  jpEe: 1,
  jpCap: 10_547_400,
  jkm: 0.3,
};

/** Tarif JKK menurut tingkat risiko lingkungan kerja (%). */
export const JKK_RATES = [0.24, 0.54, 0.89, 1.27, 1.74] as const;

/** Biaya jabatan: 5% dari bruto, maksimal Rp500.000 sebulan (Rp6 juta setahun). */
export const BIAYA_JABATAN = { rate: 5, maxMonth: 500_000 };

/** Pajak Pasal 17 setahun dari PKP (untuk tes dan contoh). */
export function pasal17(pkp: number): number {
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of PASAL17) {
    if (pkp <= prev) break;
    tax += (Math.min(pkp, cap) - prev) * (rate / 100);
    prev = cap;
  }
  return tax;
}

/** Tarif TER (%) untuk penghasilan bruto sebulan. */
export function terRate(cat: 'A' | 'B' | 'C', gross: number): number {
  return TER[cat].find(([cap]) => gross <= cap)![1];
}
