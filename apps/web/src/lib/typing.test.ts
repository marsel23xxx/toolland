import { describe, expect, it } from 'vitest';
import {
  accuracy,
  consistency,
  gradeOf,
  netWpm,
  perSecond,
  pickWords,
  prefixCorrect,
  summarize,
  type Keystroke,
} from './typing';
import { WORD_LISTS } from './typing-words';

describe('daftar kata', () => {
  for (const [lang, list] of Object.entries(WORD_LISTS)) {
    it(`${lang}: unik, huruf kecil a-z, panjang wajar`, () => {
      expect(list.length).toBeGreaterThanOrEqual(250);
      expect(new Set(list).size).toBe(list.length);
      for (const w of list) {
        expect(w).toMatch(/^[a-z]+$/);
        expect(w.length).toBeLessThanOrEqual(12);
      }
    });
  }

  it('pickWords tidak mengulang kata yang sama berturut-turut', () => {
    // rnd sering memberi indeks yang sama berturut-turut; fungsi harus mencoba ulang.
    let i = 0;
    const vals = [0.5, 0.5, 0.51, 0.5, 0.9, 0.5, 0.52];
    const rnd = () => vals[i++ % vals.length];
    const words = pickWords(['a', 'b', 'c', 'd'] as const, 50, rnd);
    expect(words).toHaveLength(50);
    for (let k = 1; k < words.length; k++) expect(words[k]).not.toBe(words[k - 1]);
  });
});

describe('hitungan', () => {
  it('KPM: 25 karakter benar dalam 6 detik = 50', () => {
    expect(netWpm(25, 6000)).toBe(50);
    expect(netWpm(0, 6000)).toBe(0);
    expect(netWpm(25, 0)).toBe(0);
  });

  it('akurasi dibulatkan dan 100 saat belum mengetik', () => {
    expect(accuracy(0, 0)).toBe(100);
    expect(accuracy(9, 10)).toBe(90);
    expect(accuracy(1, 3)).toBe(33);
  });

  it('perSecond mengelompokkan ketukan dan kesalahan per detik', () => {
    const keys: Keystroke[] = [
      { t: 100, ok: true },
      { t: 900, ok: false },
      { t: 1500, ok: true },
      { t: 2990, ok: true },
      { t: 3400, ok: true }, // melewati durasi -> digabung ke detik terakhir
    ];
    const s = perSecond(keys, 3000);
    expect(s.map((p) => p.wpm)).toEqual([24, 12, 24]);
    expect(s.map((p) => p.errors)).toEqual([1, 0, 0]);
    expect(s.map((p) => p.sec)).toEqual([1, 2, 3]);
  });

  it('konsistensi: tempo rata = 100, tempo kosong = 0', () => {
    expect(consistency([48, 48, 48])).toBe(100);
    expect(consistency([])).toBe(0);
    expect(consistency([60, 30, 60, 30])).toBeLessThan(80);
  });

  it('nilai huruf mengikuti KPM dan dibatasi akurasi', () => {
    expect(gradeOf(95, 98)).toBe('S');
    expect(gradeOf(95, 90)).toBe('A');
    expect(gradeOf(95, 80)).toBe('B');
    expect(gradeOf(60, 99)).toBe('B');
    expect(gradeOf(31, 99)).toBe('C');
    expect(gradeOf(10, 50)).toBe('D');
  });

  it('summarize menggabungkan semuanya', () => {
    const keys: Keystroke[] = Array.from({ length: 50 }, (_, i) => ({
      t: i * 200,
      ok: i % 10 !== 9,
    }));
    const s = summarize(keys, 42, 10_000);
    expect(s.keystrokes).toBe(50);
    expect(s.errors).toBe(5);
    expect(s.accuracy).toBe(90);
    expect(s.wpm).toBe(netWpm(42, 10_000));
    expect(s.raw).toBe(netWpm(50, 10_000));
    expect(s.series).toHaveLength(10);
    expect(s.seconds).toBe(10);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(s.grade);
  });

  it('prefixCorrect menghitung huruf benar pada kata yang belum selesai', () => {
    expect(prefixCorrect('rumah', 'rum')).toBe(3);
    expect(prefixCorrect('rumah', 'ruxah')).toBe(4);
    expect(prefixCorrect('rumah', 'rumahku')).toBe(5);
    expect(prefixCorrect('rumah', '')).toBe(0);
  });
});
