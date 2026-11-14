import { describe, expect, it } from 'vitest';
import { isComplete, profileOf, questionCount, type PersonalityTest } from '.';
import { BIG_FIVE_KEYS, TRAITS } from './bigfive';
import { bigFiveTest } from './bigfive-text';
import { band, likertScores, type DiscAnswer } from './core';
import { DISC, DISC_ORDER, discCode } from './disc';
import { discTest } from './disc-text';
import { RIASEC } from './riasec';
import { riasecTest } from './riasec-text';
import { AXES, TYPE_CODES } from './types16';
import { types16Test } from './types16-text';

const LOCALES = ['id', 'en'] as const;

/** Jawaban Likert yang sepenuhnya condong ke arah kunci (setuju = skor naik). */
const keyed = (test: { items: { rev?: boolean }[] }, agree: (i: number) => boolean) =>
  test.items.map((it, i) => (agree(i) !== !!it.rev ? 5 : 1));

describe('likertScores', () => {
  it('memetakan 1-5 ke 0-100, membalik pernyataan terbalik, dan 50 bila kosong', () => {
    const items = [{ dim: 'X' }, { dim: 'X', rev: true }, { dim: 'Y' }];
    expect(likertScores(items, [5, 1, null], ['X', 'Y'])).toEqual({ X: 100, Y: 50 });
    expect(likertScores(items, [3, 3, 2], ['X', 'Y'])).toEqual({ X: 50, Y: 25 });
  });

  it('pita rendah/sedang/tinggi', () => {
    expect([band(39), band(40), band(60), band(61)]).toEqual(['low', 'mid', 'mid', 'high']);
  });
});

describe('Big Five', () => {
  it('kunci IPIP-50: 10 pernyataan per sifat dengan jumlah pernyataan terbalik yang benar', () => {
    const rev = Object.fromEntries(TRAITS.map((t) => [t, 0]));
    for (const t of TRAITS) expect(BIG_FIVE_KEYS.filter((k) => k.dim === t)).toHaveLength(10);
    for (const k of BIG_FIVE_KEYS) if (k.rev) rev[k.dim]++;
    // Dibalik untuk Neurotisisme: Emotional Stability asli punya 8 pernyataan terbalik.
    expect(rev).toEqual({ O: 3, C: 4, E: 5, A: 4, N: 2 });
  });

  it.each(LOCALES)('teks %s lengkap dan sejajar dengan kunci', (loc) => {
    const t = bigFiveTest(loc);
    expect(t.items).toHaveLength(50);
    expect(new Set(t.items.map((x) => x.text)).size).toBe(50);
    expect(t.scale).toHaveLength(5);
  });

  it('jawaban searah kunci memberi 100 di semua sifat; setengahnya 0', () => {
    const t = bigFiveTest('id');
    const all = profileOf(
      t,
      keyed(t, () => true),
    );
    expect(all.bars.map((b) => b.kind === 'uni' && b.value)).toEqual([100, 100, 100, 100, 100]);
    expect(all.short).toBe('O100 C100 E100 A100 N100');
    const noE = profileOf(
      t,
      keyed(t, (i) => t.items[i].dim !== 'E'),
    );
    expect(noE.short).toContain('E0');
    expect(noE.summary).toContain('Ekstraversi');
    // Sifat sedang tidak punya saran pengembangan.
    const mid = profileOf(t, Array(50).fill(3));
    expect(mid.sections.map((s) => s.title)).toEqual(['Kekuatanmu']);
  });
});

describe('16 tipe', () => {
  it.each(LOCALES)('teks %s: 48 pernyataan, 12 per dimensi, dan 16 tipe lengkap', (loc) => {
    const t = types16Test(loc);
    expect(t.items).toHaveLength(48);
    expect(new Set(t.items.map((x) => x.text)).size).toBe(48);
    for (const a of AXES) {
      const items = t.items.filter((x) => x.dim === a);
      expect(items).toHaveLength(12);
      expect(items.filter((x) => x.rev)).toHaveLength(6);
    }
    for (const code of TYPE_CODES) {
      const ty = t.text.types[code];
      expect(ty.name && ty.summary).toBeTruthy();
      expect(ty.strengths.length).toBeGreaterThanOrEqual(4);
      expect(ty.challenges.length).toBeGreaterThanOrEqual(3);
      expect(ty.careers).toHaveLength(6);
    }
    expect(new Set(TYPE_CODES.map((c) => t.text.types[c].name)).size).toBe(16);
  });

  it('kode tipe mengikuti kutub yang dipilih', () => {
    const t = types16Test('id');
    // Setuju dengan pernyataan E, N, F, P; tidak setuju dengan kutub lainnya.
    const want = new Set(['E', 'N', 'F', 'P']);
    const pole = (i: number) => {
      const it = t.items[i];
      return it.dim[it.rev ? 1 : 0];
    };
    const p = profileOf(
      t,
      t.items.map((_, i) => (want.has(pole(i)) ? 5 : 1)),
    );
    expect(p.code).toBe('ENFP');
    expect(p.name).toBe('Penyemangat Kreatif');
    expect(p.bars.map((b) => b.kind === 'bi' && b.value)).toEqual([100, 0, 0, 0]);
    // Semua netral: seri condong ke kutub kiri.
    expect(profileOf(t, Array(48).fill(3)).code).toBe('ESTJ');
  });
});

describe('DISC', () => {
  it('24 permutasi berbeda, tiap kelompok berisi D, I, S, C', () => {
    expect(new Set(DISC_ORDER.map((p) => p.join(''))).size).toBe(24);
    for (const loc of LOCALES) {
      const t = discTest(loc);
      expect(t.groups).toHaveLength(24);
      for (const g of t.groups)
        expect(g.words.map((w) => w.dim).sort()).toEqual(['C', 'D', 'I', 'S']);
      const words = t.groups.flatMap((g) => g.words.map((w) => w.text.toLowerCase()));
      expect(new Set(words).size).toBe(96);
    }
  });

  it('skor paling dikurangi paling tidak, dengan gaya kedua bila di atas nol', () => {
    const t = discTest('id');
    const pick = (most: string, least: string): DiscAnswer[] =>
      t.groups.map((g) => ({
        most: g.words.findIndex((w) => w.dim === most),
        least: g.words.findIndex((w) => w.dim === least),
      }));
    const d = profileOf(t, pick('D', 'C'));
    expect(d.code).toBe('D');
    expect(d.bars.map((b) => b.kind === 'uni' && b.text)).toEqual(['+24', '0', '0', '-24']);
    // Setengah D, setengah I sebagai paling sesuai; S selalu paling tidak sesuai.
    const di = pick('D', 'S').map((a, i) =>
      i % 2 ? { ...a, most: t.groups[i].words.findIndex((w) => w.dim === 'I') } : a,
    );
    expect(profileOf(t, di).code).toBe('DI');
    expect(discCode({ D: 3, I: 0, S: -1, C: -2 })).toEqual(['D']);
    expect(discCode({ D: 0, I: 0, S: 0, C: 0 })).toEqual(['D']);
    for (const k of DISC) expect(t.text.styles[k].careers.length).toBeGreaterThan(0);
  });
});

describe('Minat karier (RIASEC)', () => {
  it.each(LOCALES)('teks %s: 48 kegiatan, 8 per tipe', (loc) => {
    const t = riasecTest(loc);
    expect(t.items).toHaveLength(48);
    expect(new Set(t.items.map((x) => x.text)).size).toBe(48);
    for (const k of RIASEC) expect(t.items.filter((x) => x.dim === k)).toHaveLength(8);
  });

  it('kode tiga huruf dari skor tertinggi, saran jurusan tanpa duplikat', () => {
    const t = riasecTest('id');
    const like: Record<string, number> = { R: 1, I: 5, A: 4, S: 2, E: 3, C: 1 };
    const p = profileOf(
      t,
      t.items.map((x) => like[x.dim]),
    );
    expect(p.code).toBe('IAE');
    expect(p.name).toBe('Investigatif');
    const majors = p.sections[0].list!;
    expect(majors).toContain('Kedokteran');
    expect(majors).toContain('Desain Komunikasi Visual');
    expect(new Set(majors).size).toBe(majors.length);
  });
});

describe('isComplete', () => {
  it('Likert butuh semua jawaban; DISC butuh paling dan paling tidak', () => {
    const b: PersonalityTest = bigFiveTest('id');
    expect(questionCount(b)).toBe(50);
    expect(isComplete(b, Array(50).fill(3))).toBe(true);
    expect(isComplete(b, [...Array(49).fill(3), null])).toBe(false);
    const d: PersonalityTest = discTest('id');
    const full = Array.from({ length: 24 }, () => ({ most: 0, least: 1 }));
    expect(isComplete(d, full)).toBe(true);
    expect(isComplete(d, [...full.slice(1), { most: 0, least: null }])).toBe(false);
  });
});
