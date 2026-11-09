import { describe, expect, it } from 'vitest';
import { buildFromForm } from './invoice-penawaran';
import { terbilang, wordTable } from './terbilang';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      business: 'Studio Uji',
      year: 2025,
      currency: 'IDR',
      vat: 11,
      payTerms: 14,
      bank: '',
      products: [],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('terbilang', () => {
  it('bahasa Indonesia', () => {
    expect(wordTable('id')[0]).toBe('');
    expect(wordTable('id')[11]).toBe('sebelas');
    expect(wordTable('id')[100]).toBe('seratus');
    expect(wordTable('id')[115]).toBe('seratus lima belas');
    expect(wordTable('id')[999]).toBe('sembilan ratus sembilan puluh sembilan');
    expect(terbilang(5_827_500, 'id')).toBe(
      'lima juta delapan ratus dua puluh tujuh ribu lima ratus',
    );
    expect(terbilang(1_000, 'id')).toBe('seribu');
    expect(terbilang(1_001_000, 'id')).toBe('satu juta seribu');
  });
  it('bahasa Inggris', () => {
    expect(wordTable('en')[42]).toBe('forty-two');
    expect(terbilang(1_250_300, 'en')).toBe('one million two hundred fifty thousand three hundred');
  });
});

describe('template invoice & penawaran', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(9);
      expectNamesDefined(f, 30);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('produk dari form "nama | harga | satuan" masuk ke sheet Produk', () => {
    const f = build({ products: ['Desain logo | 3.500.000 | paket', 'Konsultasi', ' '] });
    const sst = sharedStrings(f);
    expect(sst).toContain('Desain logo');
    expect(sst).toContain('Konsultasi');
    expect(sst).toContain('P001');
    expect(sst).toContain('paket');
    expect(f['xl/worksheets/sheet7.xml']).toContain('<v>3500000</v>');
  });

  it('contoh data: nomor dokumen berurutan per jenis, tanggal urut', () => {
    const f = build({ sample: true });
    const docs = f['xl/worksheets/sheet4.xml'];
    const dates = [...docs.matchAll(/<c r="D(\d+)" s="\d+"><v>(\d+)<\/v>/g)].map((m) =>
      Number(m[2]),
    );
    expect(dates.length).toBeGreaterThan(40);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    const sst = sharedStrings(f);
    expect(sst.some((s) => s.startsWith('INV/2025/0'))).toBe(true);
    expect(sst).toContain('Penawaran');
  });

  it('isian kosong: nama bawaan dan tahun dibatasi', () => {
    const f = build({ business: '', year: 1990 });
    expect(sharedStrings(f)).toContain('Nama Usaha Anda');
  });
});

describe('parsePrice', () => {
  it('format ribuan dan desimal', async () => {
    const { parsePrice } = await import('./invoice-penawaran');
    expect(parsePrice('3.500.000')).toBe(3_500_000);
    expect(parsePrice('Rp 3,500,000')).toBe(3_500_000);
    expect(parsePrice('12.50')).toBe(12.5);
    expect(parsePrice('12,5')).toBe(12.5);
    expect(parsePrice('85000')).toBe(85_000);
    expect(parsePrice('abc')).toBeNull();
  });
});
