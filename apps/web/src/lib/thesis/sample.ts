/**
 * Kalkulator ukuran sampel untuk skripsi: Slovin, Lemeshow (populasi tidak diketahui), Cochran
 * dengan koreksi populasi terbatas, dan Krejcie-Morgan. Semua hasil dibulatkan ke atas, seperti
 * kebiasaan di metodologi penelitian (sampel tidak boleh kurang dari hasil rumus).
 */

export const CONFIDENCE = [90, 95, 99] as const;
export type Confidence = (typeof CONFIDENCE)[number];

/** Nilai Z dua sisi untuk tingkat kepercayaan. */
export const Z: Record<Confidence, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
/** Chi-kuadrat derajat bebas 1 (dipakai Krejcie-Morgan; tabel aslinya memakai 3,841). */
export const CHI2: Record<Confidence, number> = { 90: 2.706, 95: 3.841, 99: 6.635 };

export type MethodId = 'slovin' | 'lemeshow' | 'cochran' | 'krejcie';

export interface SampleInput {
  /** Jumlah populasi; null = tidak diketahui atau sangat besar. */
  population: number | null;
  confidence: Confidence;
  /** Margin of error dalam persen (misalnya 5). */
  error: number;
  /** Perkiraan proporsi dalam persen; 50 bila belum diketahui (hasil paling aman). */
  proportion: number;
}

export interface MethodResult {
  id: MethodId;
  /** Hasil sebelum dibulatkan. */
  raw: number;
  /** Hasil akhir (dibulatkan ke atas, tidak melebihi populasi). */
  n: number;
}

/** Bulatkan ke atas tanpa terganggu galat pecahan biner (80,0000000001 tetap 80). */
export function ceil(x: number): number {
  return Math.ceil(x - 1e-9);
}

function finish(id: MethodId, raw: number, population: number | null): MethodResult {
  const n = ceil(raw);
  return { id, raw, n: population === null ? n : Math.min(n, population) };
}

/** Slovin: n = N / (1 + N·e²). Hanya untuk populasi yang diketahui. */
export function slovin(population: number, error: number): number {
  const e = error / 100;
  return population / (1 + population * e * e);
}

/** Lemeshow / Cochran tanpa populasi: n₀ = Z²·p(1−p) / e². */
export function lemeshow(confidence: Confidence, error: number, proportion: number): number {
  const z = Z[confidence];
  const p = proportion / 100;
  const e = error / 100;
  return (z * z * p * (1 - p)) / (e * e);
}

/** Cochran dengan koreksi populasi terbatas: n = n₀ / (1 + (n₀ − 1) / N). */
export function cochran(
  population: number,
  confidence: Confidence,
  error: number,
  proportion: number,
): number {
  const n0 = lemeshow(confidence, error, proportion);
  return n0 / (1 + (n0 - 1) / population);
}

/** Krejcie-Morgan: s = χ²·N·P(1−P) / (d²(N−1) + χ²·P(1−P)). */
export function krejcie(
  population: number,
  confidence: Confidence,
  error: number,
  proportion: number,
): number {
  const x = CHI2[confidence];
  const p = proportion / 100;
  const d = error / 100;
  return (x * population * p * (1 - p)) / (d * d * (population - 1) + x * p * (1 - p));
}

export function isValid(i: SampleInput): boolean {
  const popOk = i.population === null || (Number.isInteger(i.population) && i.population >= 2);
  return (
    popOk &&
    CONFIDENCE.includes(i.confidence) &&
    i.error > 0 &&
    i.error <= 50 &&
    i.proportion > 0 &&
    i.proportion < 100
  );
}

/** Hasil semua rumus yang berlaku untuk input ini. */
export function sampleSizes(i: SampleInput): MethodResult[] {
  if (!isValid(i)) return [];
  const { population: N, confidence, error, proportion } = i;
  if (N === null) return [finish('lemeshow', lemeshow(confidence, error, proportion), null)];
  return [
    finish('slovin', slovin(N, error), N),
    finish('cochran', cochran(N, confidence, error, proportion), N),
    finish('krejcie', krejcie(N, confidence, error, proportion), N),
  ];
}

/** Tambah cadangan untuk responden yang tidak mengembalikan kuesioner (drop out, dalam persen). */
export function withDropout(n: number, dropout: number): number {
  if (!(dropout > 0) || dropout >= 100) return n;
  return ceil(n / (1 - dropout / 100));
}

export interface Stratum {
  name: string;
  size: number;
}

/**
 * Alokasi proporsional (proportionate stratified random sampling): nᵢ = Nᵢ/N × n, dibulatkan
 * dengan metode sisa terbesar supaya totalnya tepat n. Setiap strata yang punya anggota mendapat
 * minimal 1 bila n cukup.
 */
export function allocate(strata: Stratum[], n: number): number[] {
  const sizes = strata.map((s) => (Number.isFinite(s.size) && s.size > 0 ? Math.floor(s.size) : 0));
  const total = sizes.reduce((a, b) => a + b, 0);
  if (total === 0 || n <= 0) return sizes.map(() => 0);
  const target = Math.min(n, total);
  const exact = sizes.map((s) => (s / total) * target);
  const out = exact.map((x, k) => Math.min(Math.floor(x + 1e-9), sizes[k]));
  let left = target - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, k) => ({ k, rem: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.rem - a.rem || sizes[b.k] - sizes[a.k]);
  for (let pass = 0; left > 0 && pass < 2; pass++) {
    for (const { k } of order) {
      if (left === 0) break;
      if (out[k] < sizes[k]) {
        out[k]++;
        left--;
      }
    }
  }
  // Strata kecil yang dapat 0: ambil satu dari strata terbesar (bila masih lebih dari 1).
  for (let k = 0; k < out.length; k++) {
    if (sizes[k] > 0 && out[k] === 0) {
      const big = out.indexOf(Math.max(...out));
      if (out[big] > 1) {
        out[big]--;
        out[k] = 1;
      }
    }
  }
  return out;
}

/**
 * Langkah perhitungan (hanya rumus dan angka) untuk disalin ke bab metodologi. `num` memformat
 * angka sesuai bahasa halaman (koma desimal untuk Indonesia).
 */
export function steps(id: MethodId, i: SampleInput, num: (x: number, digits?: number) => string) {
  const e = i.error / 100;
  const p = i.proportion / 100;
  const z = Z[i.confidence];
  const N = i.population ?? 0;
  const pq = `${num(p, 2)} × ${num(1 - p, 2)}`;
  switch (id) {
    case 'slovin': {
      const den = 1 + N * e * e;
      const raw = slovin(N, i.error);
      return [
        'n = N / (1 + N·e²)',
        `n = ${num(N)} / (1 + ${num(N)} × ${num(e, 2)}²)`,
        `n = ${num(N)} / ${num(den, 4)}`,
        `n = ${num(raw, 2)} ≈ ${num(ceil(raw))}`,
      ];
    }
    case 'lemeshow': {
      const raw = lemeshow(i.confidence, i.error, i.proportion);
      return [
        'n = Z²·p(1 − p) / e²',
        `n = ${num(z, 3)}² × ${pq} / ${num(e, 2)}²`,
        `n = ${num(z * z * p * (1 - p), 4)} / ${num(e * e, 4)}`,
        `n = ${num(raw, 2)} ≈ ${num(ceil(raw))}`,
      ];
    }
    case 'cochran': {
      const n0 = lemeshow(i.confidence, i.error, i.proportion);
      const raw = cochran(N, i.confidence, i.error, i.proportion);
      return [
        'n₀ = Z²·p(1 − p) / e²',
        `n₀ = ${num(z, 3)}² × ${pq} / ${num(e, 2)}² = ${num(n0, 2)}`,
        'n = n₀ / (1 + (n₀ − 1) / N)',
        `n = ${num(n0, 2)} / (1 + (${num(n0, 2)} − 1) / ${num(N)})`,
        `n = ${num(raw, 2)} ≈ ${num(Math.min(ceil(raw), N))}`,
      ];
    }
    case 'krejcie': {
      const x = CHI2[i.confidence];
      const raw = krejcie(N, i.confidence, i.error, i.proportion);
      const top = x * N * p * (1 - p);
      const bot = e * e * (N - 1) + x * p * (1 - p);
      return [
        's = χ²·N·P(1 − P) / (d²(N − 1) + χ²·P(1 − P))',
        `s = ${num(x, 3)} × ${num(N)} × ${pq} / (${num(e, 2)}² × ${num(N - 1)} + ${num(x, 3)} × ${pq})`,
        `s = ${num(top, 3)} / ${num(bot, 4)}`,
        `s = ${num(raw, 2)} ≈ ${num(Math.min(ceil(raw), N))}`,
      ];
    }
  }
}
