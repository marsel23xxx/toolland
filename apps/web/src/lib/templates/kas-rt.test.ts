import { describe, expect, it } from 'vitest';
import { buildFromForm } from './kas-rt';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      org: 'RT Uji',
      year: 2025,
      currency: 'IDR',
      dues: 30000,
      opening: 500000,
      members: ['Ani | A-1', 'Bima', ' '],
      incomes: ['Donasi'],
      expenses: ['Kebersihan'],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template kas RT', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(8);
      expectNamesDefined(f, 25);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('warga dan kategori dari form', () => {
    const f = build({});
    const sst = sharedStrings(f);
    expect(sst).toContain('Ani');
    expect(sst).toContain('A-1');
    expect(sst).toContain('Bima');
    expect(sst).toContain('Kebersihan');
    expect(f['xl/worksheets/sheet7.xml']).toContain('<v>30000</v>');
  });

  it('contoh: 40 warga, kategori RT dipakai walau form berbeda', () => {
    const f = build({ sample: true, expenses: ['Kopi'] });
    const sst = sharedStrings(f);
    expect(sst).toContain('Keamanan');
    expect(sst).not.toContain('Kopi');
    const mem = f['xl/worksheets/sheet6.xml'];
    expect(
      [...mem.matchAll(/<c r="C(\d+)" s="\d+" t="s">/g)].filter((m) => Number(m[1]) >= 6),
    ).toHaveLength(40);
  });
});
