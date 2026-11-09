import { describe, expect, it } from 'vitest';
import { buildFromForm } from './rab-proyek';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      project: 'Proyek Uji',
      currency: 'IDR',
      start: '2026-02-02',
      weeks: 10,
      overhead: 10,
      vat: 11,
      sections: ['Persiapan', 'Struktur'],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template RAB proyek', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(10);
      expectNamesDefined(f, 30);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('bab dari form dan harga dasar bawaan selalu ada', () => {
    const f = build({});
    const sst = sharedStrings(f);
    expect(sst).toContain('Persiapan');
    expect(sst).toContain('Struktur');
    expect(sst).toContain('Semen PC 50 kg');
    expect(sst).toContain('AN-03');
    expect(sst).not.toContain('Pembersihan lahan Bu Sari');
  });

  it('contoh data memakai bab renovasi dan 20 pekerjaan', () => {
    const f = build({ sample: true, sections: ['X'] });
    const sst = sharedStrings(f);
    expect(sst).toContain('Pekerjaan Dinding');
    expect(sst).not.toContain('X');
    const rab = f['xl/worksheets/sheet4.xml'];
    const qty = [...rab.matchAll(/<c r="F(\d+)" s="\d+"><v>([\d.]+)<\/v>/g)];
    expect(qty).toHaveLength(20);
  });

  it('durasi dibatasi 1-52 minggu', () => {
    const f = build({ weeks: 400, project: '' });
    expect(f['xl/worksheets/sheet9.xml']).toContain('<v>52</v>');
    expect(sharedStrings(f)).toContain('Nama Proyek');
  });
});
