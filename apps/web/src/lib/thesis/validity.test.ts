import { describe, expect, it } from 'vitest';
import { rCrit } from './dist';
import {
  analyze,
  cronbach,
  groupItems,
  parseData,
  pearson,
  sampleData,
  toNumber,
  variance,
} from './validity';

describe('baca data', () => {
  it('angka dengan koma atau titik desimal', () => {
    expect(toNumber('3,5')).toBe(3.5);
    expect(toNumber('3.5')).toBe(3.5);
    expect(toNumber('1.234,5')).toBe(1234.5);
    expect(toNumber(' 4 ')).toBe(4);
    expect(toNumber('')).toBeNull();
    expect(toNumber('SS')).toBeNull();
  });

  it('salinan Excel: judul, kolom No dan Total diabaikan, baris kosong dibuang', () => {
    const text = [
      'No\tP1\tP2\tP3\tTotal',
      '1\t4\t5\t4\t13',
      '2\t3\t\t3\t6',
      '3\t5\t5\t4\t14',
      '4\t2\t3\t2\t7',
    ].join('\n');
    const d = parseData(text);
    expect(d.hasHeader).toBe(true);
    expect(d.headers).toEqual(['P1', 'P2', 'P3']);
    expect(d.skipped).toEqual(['No', 'Total']);
    expect(d.dropped).toEqual([2]);
    expect(d.rows).toEqual([
      [4, 5, 4],
      [5, 5, 4],
      [2, 3, 2],
    ]);
  });

  it('CSV dan data tanpa judul (dipisah spasi)', () => {
    const csv = parseData('a,b,c\n1.5,2,3\n2,3,4\n');
    expect(csv.headers).toEqual(['a', 'b', 'c']);
    expect(csv.rows[0]).toEqual([1.5, 2, 3]);
    const sp = parseData('4 5 4\n3 3 3\n5 4 5');
    expect(sp.hasHeader).toBe(false);
    expect(sp.headers).toEqual(['Item 1', 'Item 2', 'Item 3']);
    expect(sp.rows).toHaveLength(3);
  });

  it('kolom nama responden diabaikan', () => {
    const d = parseData('Nama\tA\tB\nAni\t4\t5\nBudi\t3\t3\nCici\t5\t4');
    expect(d.headers).toEqual(['A', 'B']);
    expect(d.skipped).toEqual(['Nama']);
  });

  it('kolom total tanpa judul dikenali dari jumlahnya', () => {
    const d = parseData('4\t5\t4\t13\n3\t3\t3\t9\n5\t4\t5\t14\n2\t2\t3\t7');
    expect(d.headers).toHaveLength(3);
  });

  it('kelompok variabel dari nama kolom', () => {
    expect(groupItems(['X1.1', 'X1.2', 'X2_1', 'X2_2', 'Y1', 'Y2'])).toEqual([
      { name: 'X1', cols: [0, 1] },
      { name: 'X2', cols: [2, 3] },
      { name: 'Y', cols: [4, 5] },
    ]);
    expect(groupItems(['P1', 'P2', 'P3'])).toBeNull();
    expect(groupItems(['X1.1', 'X1.2', 'Y1'])).toBeNull();
  });
});

describe('statistik', () => {
  it('Pearson dan varians sampel', () => {
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(0.7746, 4);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(variance([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(4.5714, 4);
  });

  it('Cronbach alpha sama dengan rumus kovarians', () => {
    const cols = [
      [4, 5, 3, 4, 2, 5, 4, 3],
      [4, 4, 3, 5, 2, 4, 4, 2],
      [5, 4, 2, 4, 3, 5, 3, 3],
      [3, 5, 3, 4, 2, 4, 5, 2],
    ];
    const n = cols[0].length;
    const k = cols.length;
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
    const cov = (x: number[], y: number[]) =>
      x.reduce((a, xi, i) => a + (xi - mean(x)) * (y[i] - mean(y)), 0) / (n - 1);
    let off = 0;
    let all = 0;
    for (let i = 0; i < k; i++)
      for (let j = 0; j < k; j++) {
        all += cov(cols[i], cols[j]);
        if (i !== j) off += cov(cols[i], cols[j]);
      }
    expect(cronbach(cols)).toBeCloseTo((k / (k - 1)) * (off / all), 12);
    // Item identik: alpha = 1.
    expect(cronbach([cols[0], cols[0], cols[0]])).toBeCloseTo(1, 12);
    expect(cronbach([cols[0]])).toBeNull();
  });
});

describe('analisis', () => {
  const opts = { alpha: 0.05, tails: 2 as const, method: 'pearson' as const, threshold: 0.6 };

  it('data contoh: P7 tidak valid, sisanya valid, reliabel', () => {
    const d = parseData(sampleData());
    expect(d.rows).toHaveLength(30);
    expect(d.headers).toHaveLength(10);
    const res = analyze('Data', d.headers, d.rows, opts)!;
    expect(res.df).toBe(28);
    expect(res.rTable).toBeCloseTo(rCrit(0.05, 28), 12);
    const invalid = res.items.filter((x) => !x.valid).map((x) => x.name);
    expect(invalid).toEqual(['P7']);
    expect(res.validCount).toBe(9);
    expect(res.alpha!).toBeGreaterThan(0.7);
    expect(res.alphaValid!).toBeGreaterThan(res.alpha!);
    expect(res.reliable).toBe(true);
    // Alpha jika P7 dihapus = alpha item valid.
    expect(res.items[6].alphaIfDeleted).toBeCloseTo(res.alphaValid!, 12);
  });

  it('corrected item-total lebih kecil dari Pearson item-total', () => {
    const d = parseData(sampleData());
    const p = analyze('Data', d.headers, d.rows, opts)!;
    const c = analyze('Data', d.headers, d.rows, { ...opts, method: 'corrected' })!;
    for (let j = 0; j < 10; j++) {
      expect(p.items[j].rCorrected!).toBeLessThan(p.items[j].r!);
      expect(c.items[j].rUsed).toBe(c.items[j].rCorrected);
    }
  });

  it('item konstan tidak valid dan tidak merusak hasil', () => {
    const rows = [
      [4, 4, 3],
      [5, 4, 5],
      [2, 4, 2],
      [3, 4, 3],
    ];
    const res = analyze('V', ['A', 'B', 'C'], rows, opts)!;
    expect(res.items[1].r).toBeNull();
    expect(res.items[1].valid).toBe(false);
    expect(res.alpha).not.toBeNull();
  });

  it('data terlalu sedikit', () => {
    expect(analyze('V', ['A', 'B'], [[1, 2]], opts)).toBeNull();
    expect(analyze('V', ['A'], [[1], [2], [3]], opts)).toBeNull();
  });
});
