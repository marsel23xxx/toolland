/**
 * Logika tes kecepatan mengetik: pemilihan kata, hitungan KPM (kata per menit, 1 kata = 5
 * karakter), akurasi, konsistensi, seri per detik untuk grafik, dan nilai huruf ala game.
 * Semua fungsi murni agar mudah diuji; komponen hanya mencatat ketukan lalu memanggil ini.
 */

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [25, 50, 100] as const;
export type TypingLang = 'id' | 'en';
export type TypingMode = 'time' | 'words';

/** Satu ketukan karakter (bukan backspace): t = ms sejak mulai, ok = sesuai huruf target. */
export interface Keystroke {
  t: number;
  ok: boolean;
}

export interface SecondPoint {
  /** Detik ke-n (mulai 1). */
  sec: number;
  /** KPM sesaat pada detik itu (semua ketukan, benar maupun salah). */
  wpm: number;
  errors: number;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Summary {
  wpm: number;
  raw: number;
  /** Persen ketukan yang benar (0-100). */
  accuracy: number;
  /** Kestabilan tempo antar detik (0-100). */
  consistency: number;
  correctChars: number;
  errors: number;
  keystrokes: number;
  seconds: number;
  grade: Grade;
  series: SecondPoint[];
}

/** Ambil n kata acak dari daftar, tanpa kata yang sama dua kali berturut-turut. */
export function pickWords(
  list: readonly string[],
  n: number,
  rnd: () => number = Math.random,
): string[] {
  const out: string[] = [];
  let prev = '';
  for (let i = 0; i < n; i++) {
    let w = list[Math.floor(rnd() * list.length)] ?? '';
    for (let tries = 0; w === prev && tries < 8; tries++)
      w = list[Math.floor(rnd() * list.length)] ?? '';
    out.push(w);
    prev = w;
  }
  return out;
}

/** KPM bersih: hanya karakter dari kata yang benar. 1 kata = 5 karakter. */
export function netWpm(correctChars: number, ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(correctChars / 5 / (ms / 60_000));
}

/** KPM kotor: semua ketukan, benar maupun salah. */
export function rawWpm(keystrokes: number, ms: number): number {
  return netWpm(keystrokes, ms);
}

export function accuracy(ok: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((ok / total) * 100);
}

/** Kelompokkan ketukan per detik untuk grafik tempo. Detik terakhir yang terpotong digabung. */
export function perSecond(keys: readonly Keystroke[], totalMs: number): SecondPoint[] {
  const n = Math.max(1, Math.round(totalMs / 1000));
  const out: SecondPoint[] = Array.from({ length: n }, (_, i) => ({
    sec: i + 1,
    wpm: 0,
    errors: 0,
  }));
  for (const k of keys) {
    const p = out[Math.min(n - 1, Math.max(0, Math.floor(k.t / 1000)))];
    p.wpm += 12; // 1 karakter per detik = 12 KPM (60 / 5)
    if (!k.ok) p.errors++;
  }
  return out;
}

/** Konsistensi tempo: 100% berarti kecepatan tiap detik sama persis. */
export function consistency(series: readonly number[]): number {
  const vals = series.filter((v) => v > 0);
  if (vals.length < 2) return vals.length ? 100 : 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return Math.round(Math.min(1, Math.max(0, 1 - sd / mean)) * 100);
}

/** Nilai ala game: ditentukan KPM, tapi akurasi rendah menurunkan batas nilai tertinggi. */
export function gradeOf(wpm: number, acc: number): Grade {
  const byWpm: Grade = wpm >= 90 ? 'S' : wpm >= 70 ? 'A' : wpm >= 50 ? 'B' : wpm >= 30 ? 'C' : 'D';
  const cap: Grade = acc < 75 ? 'C' : acc < 85 ? 'B' : acc < 93 ? 'A' : 'S';
  const order: Grade[] = ['D', 'C', 'B', 'A', 'S'];
  return order[Math.min(order.indexOf(byWpm), order.indexOf(cap))];
}

export function summarize(keys: readonly Keystroke[], correctChars: number, ms: number): Summary {
  const ok = keys.reduce((a, k) => a + (k.ok ? 1 : 0), 0);
  const series = perSecond(keys, ms);
  const wpm = netWpm(correctChars, ms);
  const acc = accuracy(ok, keys.length);
  return {
    wpm,
    raw: rawWpm(keys.length, ms),
    accuracy: acc,
    consistency: consistency(series.map((p) => p.wpm)),
    correctChars,
    errors: keys.length - ok,
    keystrokes: keys.length,
    seconds: Math.round(ms / 100) / 10,
    grade: gradeOf(wpm, acc),
    series,
  };
}

/** Karakter yang benar dari kata yang baru diketik sebagian (prefiks yang cocok). */
export function prefixCorrect(target: string, typed: string): number {
  let n = 0;
  for (let i = 0; i < Math.min(target.length, typed.length); i++) if (typed[i] === target[i]) n++;
  return n;
}
