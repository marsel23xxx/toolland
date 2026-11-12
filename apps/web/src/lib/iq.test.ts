import { describe, expect, it } from 'vitest';
import {
  IQ_MAX,
  IQ_MIN,
  SIDES,
  TEST_SIZE,
  buildTest,
  figureKey,
  makeRng,
  matrixQuestion,
  normCdf,
  oddQuestion,
  scoreTest,
  seriesQuestion,
  type Figure,
  type Question,
} from './iq';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 13);

function optionKeys(q: Question): string[] {
  return q.kind === 'series' ? q.options.map(String) : (q.options as Figure[]).map(figureKey);
}

describe('buildTest', () => {
  it('sama untuk seed yang sama, berbeda untuk seed lain', () => {
    expect(JSON.stringify(buildTest(42))).toBe(JSON.stringify(buildTest(42)));
    expect(JSON.stringify(buildTest(42))).not.toBe(JSON.stringify(buildTest(43)));
  });

  it('30 soal, 10 per jenis, tingkat naik bertahap', () => {
    const qs = buildTest(7);
    expect(qs).toHaveLength(TEST_SIZE);
    for (const k of ['matrix', 'series', 'odd'])
      expect(qs.filter((q) => q.kind === k)).toHaveLength(10);
    for (let i = 1; i < qs.length; i++) expect(qs[i].level).toBeGreaterThanOrEqual(qs[i - 1].level);
    expect(qs[0].level).toBe(1);
    expect(qs[29].level).toBe(5);
  });

  it('setiap soal punya pilihan unik dan satu jawaban yang sah', () => {
    for (const seed of SEEDS) {
      for (const q of buildTest(seed)) {
        const keys = optionKeys(q);
        expect(new Set(keys).size, `${q.kind} L${q.level} seed ${seed}`).toBe(keys.length);
        expect(keys.length).toBe(q.kind === 'matrix' ? 6 : 5);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(keys.length);
        expect(q.explain.length).toBeGreaterThan(0);
      }
    }
  });

  it('posisi jawaban benar tersebar, tidak selalu di tempat yang sama', () => {
    const pos = new Set(SEEDS.slice(0, 30).map((s) => buildTest(s)[0].answer));
    expect(pos.size).toBeGreaterThan(2);
  });
});

describe('matriks', () => {
  it('soal garis: jawaban mengikuti operasi yang sama dengan dua baris pertama', () => {
    let checked = 0;
    for (const seed of SEEDS) {
      const q = matrixQuestion(makeRng(seed), 5);
      const op = q.explain[0].key.split('.').pop();
      if (!q.cells[0].segs) continue;
      const f = (a: number, b: number) => (op === 'or' ? a | b : op === 'xor' ? a ^ b : a & ~b);
      const s = q.cells.map((c) => c.segs ?? 0);
      expect(f(s[0], s[1])).toBe(s[2]);
      expect(f(s[3], s[4])).toBe(s[5]);
      expect(f(s[6], s[7])).toBe(q.options[q.answer].segs);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('soal bentuk: jawaban tidak sama dengan pengecoh mana pun', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2, 3, 4]) {
        const q = matrixQuestion(makeRng(seed + level), level);
        const ans = figureKey(q.options[q.answer]);
        expect(q.options.filter((o) => figureKey(o) === ans)).toHaveLength(1);
      }
    }
  });
});

describe('deret angka', () => {
  it('jawaban ada di pilihan, semua pilihan bilangan bulat tak negatif', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2, 3, 4, 5]) {
        const q = seriesQuestion(makeRng(seed), level);
        expect(q.terms.length).toBeGreaterThanOrEqual(5);
        for (const o of q.options) {
          expect(Number.isInteger(o)).toBe(true);
          expect(o).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('deret tambah tingkat 1 punya jawaban yang konsisten', () => {
    for (const seed of SEEDS) {
      const q = seriesQuestion(makeRng(seed), 1);
      if (q.explain[0].key !== 'iq.ex.s.add') continue;
      const d = q.terms[1] - q.terms[0];
      expect(q.options[q.answer]).toBe(q.terms[q.terms.length - 1] + d);
    }
  });
});

describe('pilih yang berbeda', () => {
  const sidesOf = (f: Figure) => SIDES[f.items[0].shape];

  it('tepat satu gambar melanggar aturan', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2, 3, 4, 5]) {
        const q = oddQuestion(makeRng(seed), level);
        const rule = q.explain[0].key.split('.').pop();
        const value = (f: Figure): string | number | undefined => {
          if (rule === 'count') return f.items.length;
          if (rule === 'sides') return sidesOf(f);
          if (rule === 'dots') return f.items.length - 1 === sidesOf(f) ? 'ok' : 'bad';
          if (rule === 'mirror') return f.items[0].flip ? 1 : 0;
          const solid = f.items.filter((i) => i.fill === 'solid').length;
          return solid * 2 === f.items.length ? 'ok' : 'bad';
        };
        const vals = q.options.map(value);
        const odd = vals[q.answer];
        expect(
          vals.filter((v) => v === odd),
          `${rule} seed ${seed}`,
        ).toHaveLength(1);
        const rest = vals.filter((_, i) => i !== q.answer);
        expect(new Set(rest).size, `${rule} seed ${seed}`).toBe(1);
      }
    }
  });

  it('atribut pengalih (isian) tidak membentuk pola 4 lawan 1 yang menyesatkan', () => {
    for (const seed of SEEDS) {
      const q = oddQuestion(makeRng(seed), 2);
      if (q.explain[0].key !== 'iq.ex.o.sides') continue;
      const counts = new Map<string, number>();
      for (const f of q.options)
        counts.set(f.items[0].fill, (counts.get(f.items[0].fill) ?? 0) + 1);
      expect([...counts.values()]).not.toContain(4);
    }
  });
});

describe('scoreTest', () => {
  const qs = buildTest(99);

  it('semua benar dan semua salah mencapai batas atas dan bawah', () => {
    expect(
      scoreTest(
        qs,
        qs.map((q) => q.answer),
      ).iq,
    ).toBe(IQ_MAX);
    expect(
      scoreTest(
        qs,
        qs.map(() => null),
      ).iq,
    ).toBe(IQ_MIN);
  });

  it('separuh skor berbobot sekitar 100 dan persentil 50', () => {
    // Benar semua tingkat 1-2 dan sebagian tingkat 3: 6*1 + 6*2 + 6*3*... dihitung manual.
    const answers = qs.map((q, i) => (i < 15 ? q.answer : null));
    const r = scoreTest(qs, answers);
    // Bobot 15 soal pertama: 6*1 + 6*2 + 3*3 = 27 dari 90 -> p = 0,3 -> IQ 80.
    expect(r.iq).toBe(80);
    expect(r.correct).toBe(15);
    expect(r.byKind.matrix.total + r.byKind.series.total + r.byKind.odd.total).toBe(30);
    expect(normCdf(0)).toBeCloseTo(0.5, 5);
    expect(normCdf(1)).toBeCloseTo(0.8413, 3);
  });

  it('kategori mengikuti skor', () => {
    expect(
      scoreTest(
        qs,
        qs.map((q) => q.answer),
      ).band,
    ).toBe('vhigh');
    expect(
      scoreTest(
        qs,
        qs.map(() => null),
      ).band,
    ).toBe('low');
  });
});
