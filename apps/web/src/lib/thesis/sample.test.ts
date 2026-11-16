import { describe, expect, it } from 'vitest';
import {
  allocate,
  ceil,
  cochran,
  krejcie,
  lemeshow,
  sampleSizes,
  slovin,
  steps,
  withDropout,
} from './sample';

describe('rumus ukuran sampel', () => {
  it('Slovin', () => {
    expect(slovin(100, 5)).toBeCloseTo(80, 6);
    expect(ceil(slovin(1000, 5))).toBe(286);
    expect(ceil(slovin(500, 10))).toBe(84);
  });

  it('Lemeshow populasi tidak diketahui: 1,96² × 0,25 / 0,1² = 96,04 → 97', () => {
    expect(lemeshow(95, 10, 50)).toBeCloseTo(96.04, 6);
    expect(ceil(lemeshow(95, 5, 50))).toBe(385);
  });

  it('Krejcie-Morgan cocok dengan tabel aslinya (95%, 5%)', () => {
    const table: [number, number][] = [
      [10, 10],
      [50, 44],
      [100, 80],
      [200, 132],
      [500, 217],
      [1000, 278],
      [10000, 370],
    ];
    for (const [N, s] of table) expect(Math.round(krejcie(N, 95, 5, 50))).toBe(s);
  });

  it('Cochran dengan koreksi populasi terbatas', () => {
    expect(ceil(cochran(1000, 95, 5, 50))).toBe(278);
    expect(cochran(1e9, 95, 5, 50)).toBeCloseTo(lemeshow(95, 5, 50), 3);
  });

  it('sampleSizes memilih rumus yang sesuai dan tidak melebihi populasi', () => {
    expect(sampleSizes({ population: null, confidence: 95, error: 5, proportion: 50 })).toEqual([
      { id: 'lemeshow', raw: expect.closeTo(384.16, 2), n: 385 },
    ]);
    const r = sampleSizes({ population: 100, confidence: 95, error: 5, proportion: 50 });
    expect(r.map((x) => [x.id, x.n])).toEqual([
      ['slovin', 80],
      ['cochran', 80],
      ['krejcie', 80],
    ]);
    const tiny = sampleSizes({ population: 5, confidence: 99, error: 1, proportion: 50 });
    expect(tiny.every((x) => x.n <= 5)).toBe(true);
    expect(sampleSizes({ population: 1, confidence: 95, error: 5, proportion: 50 })).toEqual([]);
    expect(sampleSizes({ population: 100, confidence: 95, error: 0, proportion: 50 })).toEqual([]);
  });

  it('cadangan drop out', () => {
    expect(withDropout(80, 10)).toBe(89);
    expect(withDropout(80, 0)).toBe(80);
  });
});

describe('alokasi proporsional', () => {
  it('total selalu tepat n', () => {
    const out = allocate(
      [
        { name: 'X', size: 120 },
        { name: 'XI', size: 110 },
        { name: 'XII', size: 95 },
      ],
      80,
    );
    expect(out.reduce((a, b) => a + b, 0)).toBe(80);
    expect(out).toEqual([30, 27, 23]);
  });

  it('strata kecil tetap terwakili', () => {
    const out = allocate(
      [
        { name: 'A', size: 990 },
        { name: 'B', size: 10 },
      ],
      20,
    );
    expect(out).toEqual([19, 1]);
  });

  it('strata kosong mendapat 0', () => {
    expect(
      allocate(
        [
          { name: 'A', size: 0 },
          { name: 'B', size: 50 },
        ],
        10,
      ),
    ).toEqual([0, 10]);
  });
});

describe('langkah perhitungan', () => {
  const num = (x: number, d = 0) =>
    x.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  it('Slovin dengan koma desimal', () => {
    expect(
      steps('slovin', { population: 100, confidence: 95, error: 5, proportion: 50 }, num),
    ).toEqual([
      'n = N / (1 + N·e²)',
      'n = 100 / (1 + 100 × 0,05²)',
      'n = 100 / 1,25',
      'n = 80 ≈ 80',
    ]);
  });
});
