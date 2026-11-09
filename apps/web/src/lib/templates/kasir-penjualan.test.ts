import { describe, expect, it } from 'vitest';
import { buildFromForm } from './kasir-penjualan';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      shop: 'Toko Uji',
      year: 2025,
      currency: 'IDR',
      target: 1_000_000,
      cashiers: ['Ani'],
      categories: ['Minuman'],
      products: ['Es teh | 5.000 | 1.500', 'Kopi | 12000'],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template kasir & penjualan', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(9);
      expectNamesDefined(f, 25);
      expect(chartCount(f)).toBe(4);
    });
  }

  it('produk, kasir, dan kategori dari form', () => {
    const f = build({});
    const sst = sharedStrings(f);
    expect(sst).toContain('Es teh');
    expect(sst).toContain('Ani');
    expect(sst).toContain('Minuman');
    expect(sst).toContain('QRIS');
    const prod = f['xl/worksheets/sheet7.xml'];
    expect(prod).toContain('<v>5000</v>');
    expect(prod).toContain('<v>1500</v>');
  });

  it('contoh: tanggal penjualan urut dan dalam tahun yang dipilih', () => {
    const f = build({ sample: true, year: 2025 });
    const sales = f['xl/worksheets/sheet3.xml'];
    const dates = [...sales.matchAll(/<c r="B(\d+)" s="\d+"><v>(\d+)<\/v>/g)].map((m) =>
      Number(m[2]),
    );
    expect(dates.length).toBeGreaterThan(1000);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    // 2025-01-01 = 45658, 2025-12-31 = 46022
    expect(Math.min(...dates)).toBeGreaterThanOrEqual(45658);
    expect(Math.max(...dates)).toBeLessThanOrEqual(46022);
  });
});
