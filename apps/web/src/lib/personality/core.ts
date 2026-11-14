/**
 * Mesin bersama tes kepribadian (Big Five, 16 tipe, DISC, minat karier). Setiap tes punya data
 * per bahasa (pernyataan dan deskripsi) yang disiapkan saat build lalu dikirim ke island sebagai
 * props, dan fungsi `profile` yang mengubah jawaban menjadi hasil dengan bentuk yang sama, supaya
 * satu komponen bisa menampilkan dan mencetak semua tes.
 */

/** Batang skor. `uni`: 0-100 dari kiri. `bi`: dua kutub, value = persen ke kutub kiri. */
export type Bar =
  | {
      kind: 'uni';
      label: string;
      value: number;
      text: string;
      note?: string;
      /** Tandai garis tengah (skor bisa negatif, misalnya DISC). */
      mid?: boolean;
      strong?: boolean;
    }
  | { kind: 'bi'; left: string; right: string; value: number; note?: string };

export interface Section {
  title: string;
  text?: string;
  list?: string[];
}

export interface Profile {
  eyebrow: string;
  /** Kode singkat yang besar di kartu, misalnya "INTJ", "DI", "RIA". */
  code?: string;
  name: string;
  summary: string;
  barsTitle: string;
  bars: Bar[];
  sections: Section[];
  /** Angka ringkas di kartu utama bila tidak ada kode tipe (Big Five: O 72, C 55, ...). */
  chips?: { label: string; value: string }[];
  /** Ringkasan sangat pendek untuk riwayat ("INTJ", "O72 C55 ..."). */
  short: string;
}

/** Teks pembuka dan kartu hasil yang sama bentuknya di semua tes. */
export interface TestMeta {
  /** Kunci penyimpanan lokal, juga dipakai di atribut data-*. */
  id: string;
  title: string;
  intro: string[];
  disclaimer: string;
  minutes: number;
  /** Awalan nama file kartu hasil. */
  file: string;
}

export interface LikertItem {
  text: string;
  dim: string;
  /** Pernyataan terbalik: setuju berarti skor dimensi turun. */
  rev?: boolean;
}

/** Jawaban Likert 1-5. */
export type LikertAnswer = 1 | 2 | 3 | 4 | 5;

/** Kelompok kata DISC: pilih satu yang paling sesuai dan satu yang paling tidak sesuai. */
export interface DiscGroup {
  words: { text: string; dim: DiscDim }[];
}
export type DiscDim = 'D' | 'I' | 'S' | 'C';
export interface DiscAnswer {
  most: number | null;
  least: number | null;
}

/**
 * Skor 0-100 per dimensi dari jawaban Likert: rata-rata jawaban (pernyataan terbalik dibalik
 * dulu) dipetakan dari 1-5 ke 0-100. Jawaban kosong dilewati; dimensi tanpa jawaban = 50.
 */
export function likertScores(
  items: { dim: string; rev?: boolean }[],
  answers: (number | null)[],
  dims: readonly string[],
): Record<string, number> {
  const sum: Record<string, number> = {};
  const n: Record<string, number> = {};
  items.forEach((it, i) => {
    const a = answers[i];
    if (a == null) return;
    sum[it.dim] = (sum[it.dim] ?? 0) + (it.rev ? 6 - a : a);
    n[it.dim] = (n[it.dim] ?? 0) + 1;
  });
  const out: Record<string, number> = {};
  for (const d of dims) out[d] = n[d] ? Math.round(((sum[d] / n[d] - 1) / 4) * 100) : 50;
  return out;
}

/** Skor DISC: jumlah "paling sesuai" dikurangi "paling tidak sesuai" per dimensi. */
export function discScores(
  groups: DiscGroup[],
  answers: DiscAnswer[],
): {
  most: Record<DiscDim, number>;
  least: Record<DiscDim, number>;
  diff: Record<DiscDim, number>;
} {
  const zero = (): Record<DiscDim, number> => ({ D: 0, I: 0, S: 0, C: 0 });
  const most = zero();
  const least = zero();
  groups.forEach((g, i) => {
    const a = answers[i];
    if (a?.most != null) most[g.words[a.most].dim]++;
    if (a?.least != null) least[g.words[a.least].dim]++;
  });
  const diff = zero();
  for (const d of ['D', 'I', 'S', 'C'] as const) diff[d] = most[d] - least[d];
  return { most, least, diff };
}

/** Urutkan kunci dari skor tertinggi; seri dipecah dengan urutan asli. */
export function ranked<K extends string>(scores: Record<K, number>, order: readonly K[]): K[] {
  return [...order].sort((a, b) => scores[b] - scores[a] || order.indexOf(a) - order.indexOf(b));
}

/** Rendah / sedang / tinggi dari skor 0-100. */
export function band(v: number): 'low' | 'mid' | 'high' {
  return v < 40 ? 'low' : v > 60 ? 'high' : 'mid';
}
