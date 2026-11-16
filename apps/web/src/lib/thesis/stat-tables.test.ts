import { strFromU8, unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  buildTable,
  clampRange,
  critical,
  digitsFor,
  lookupValid,
  pdfSafe,
  pValue,
  significant,
  toPdf,
  toTsv,
  toXlsx,
  type Labels,
} from './stat-tables';

const L: Labels = {
  title: 'Tabel r',
  note: 'Catatan',
  df: 'df',
  n: 'N',
  oneTail: 'Satu sisi',
  twoTail: 'Dua sisi',
  df1: 'df1',
  df2: 'df2',
  alpha: 'α',
};
const fmt = (x: number) => String(x).replace('.', ',');
const num = (x: number, d: number) => x.toFixed(d).replace('.', ',');

describe('susun tabel', () => {
  it('tabel r: kolom df dan N, nilai cocok', () => {
    const t = buildTable('r', 28, 30, 0.05, L, fmt);
    expect(t.intCols).toBe(2);
    expect(t.rows.map((r) => r.slice(0, 2))).toEqual([
      [28, 30],
      [29, 31],
      [30, 32],
    ]);
    expect(num(t.rows[0][3], 4)).toBe('0,3610');
    expect(t.head[1].map((c) => c.text).slice(1)).toEqual([
      '0,05',
      '0,025',
      '0,01',
      '0,005',
      '0,0005',
    ]);
  });

  it('tabel F: 15 kolom df1', () => {
    const t = buildTable('f', 20, 20, 0.05, L, fmt);
    expect(t.rows[0]).toHaveLength(16);
    expect(num(t.rows[0][3], 2)).toBe('3,10');
  });

  it('tabel chi-kuadrat: desimal menyesuaikan nilai kecil', () => {
    const t = buildTable('chi', 1, 1, 0.05, L, fmt);
    expect(num(t.rows[0][1], digitsFor('chi', t.rows[0][1]))).toBe('0,0000393');
    expect(num(t.rows[0][7], digitsFor('chi', t.rows[0][7]))).toBe('3,841');
  });

  it('rentang dibatasi', () => {
    expect(clampRange(0, 10)).toEqual([1, 10]);
    expect(clampRange(10, 5)).toEqual([10, 10]);
    expect(clampRange(1, 9999)).toEqual([1, 500]);
  });

  it('TSV berisi judul, kepala, dan baris', () => {
    const tsv = toTsv(buildTable('t', 10, 11, 0.05, L, fmt), num).split('\n');
    expect(tsv[0]).toBe('Tabel r');
    expect(tsv).toHaveLength(1 + 4 + 2);
    expect(tsv[5].split('\t')).toEqual(['10', '1,8125', '2,2281', '2,7638', '3,1693', '4,5869']);
  });
});

describe('cari nilai', () => {
  const q = { kind: 'r' as const, df: 28, df1: 1, df2: 1, alpha: 0.05, tails: 2 as const };
  it('nilai kritis, signifikansi, dan nilai p', () => {
    expect(critical(q)).toBeCloseTo(0.361, 4);
    expect(significant(q, 0.45)).toBe(true);
    expect(significant(q, -0.45)).toBe(true);
    expect(significant(q, 0.3)).toBe(false);
    expect(pValue(q, critical(q))).toBeCloseTo(0.05, 8);
    expect(pValue({ ...q, tails: 1 }, critical(q))).toBeCloseTo(0.025, 8);
    expect(critical({ ...q, kind: 'f', df1: 3, df2: 20 })).toBeCloseTo(3.0984, 4);
    expect(critical({ ...q, kind: 'chi', df: 10 })).toBeCloseTo(18.307, 3);
  });

  it('validasi', () => {
    expect(lookupValid(q)).toBe(true);
    expect(lookupValid({ ...q, df: 0 })).toBe(false);
    expect(lookupValid({ ...q, alpha: 0.6 })).toBe(false);
    expect(lookupValid({ ...q, kind: 'chi', alpha: 0.95 })).toBe(true);
    expect(lookupValid({ ...q, kind: 'f', df1: 2.5 })).toBe(false);
  });
});

describe('ekspor', () => {
  it('xlsx berisi angka dan sel gabung', async () => {
    const blob = toXlsx(buildTable('r', 1, 100, 0.05, L, fmt), 'Tabel r');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('<mergeCell');
    // df 1: α 0,10 → 0,9877 dan α 0,05 → 0,9969.
    expect(sheet).toContain('<v>0.9876');
    expect(sheet).toContain('<v>0.9969');
    expect(sheet).toContain('<pane');
  });

  it('pdf dibuat beberapa halaman', async () => {
    const t = buildTable('f', 1, 200, 0.05, { ...L, title: 'Tabel F α = 0,05' }, fmt);
    const bytes = await toPdf(t, num, (n, total) => `Halaman ${n} dari ${total}`);
    const pdf = await PDFDocument.load(bytes);
    // 200 baris df2, sekitar 60 baris per halaman.
    expect(pdf.getPageCount()).toBe(4);
  });

  it('karakter di luar font PDF diganti', () => {
    expect(pdfSafe('Tabel χ² α = 0,05 n₀ − 1 ≥ 2')).toBe('Tabel Chi² alpha = 0,05 n0 - 1 >= 2');
  });
});
