import { describe, expect, it } from 'vitest';
import { buildFromForm } from './rencana-pernikahan';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      partner1: 'Julian',
      partner2: 'Ayudiyah',
      date: '2027-05-01',
      budget: 100_000_000,
      currency: 'IDR',
      categories: ['Gedung', 'Katering'],
      guests: ['Keluarga Budi | Keluarga pria | 4', 'Sari'],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template rencana pernikahan', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(8);
      expectNamesDefined(f, 20);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('nama, kategori, dan tamu dari form; checklist bawaan selalu ada', () => {
    const f = build({});
    const sst = sharedStrings(f);
    expect(sst).toContain('Julian');
    expect(sst).toContain('Katering');
    expect(sst).toContain('Keluarga Budi');
    expect(sst).toContain('Booking gedung / venue');
    const guests = f['xl/worksheets/sheet5.xml'];
    expect(guests).toMatch(/<c r="E6" s="\d+"><v>4<\/v>/);
  });

  it('tanggal acara masuk ke Pengaturan', () => {
    // 2027-05-01 = 46508
    expect(build({})['xl/worksheets/sheet7.xml']).toContain('<v>46508</v>');
  });
});
