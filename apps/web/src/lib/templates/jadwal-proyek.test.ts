import { describe, expect, it } from 'vitest';
import { buildFromForm } from './jadwal-proyek';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      project: 'Proyek Uji',
      start: '2026-03-02',
      phases: ['Riset', 'Eksekusi'],
      team: ['Ani', 'Bima', ' '],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template jadwal proyek', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(8);
      expectNamesDefined(f, 15);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('fase dan tim dari form', () => {
    const sst = sharedStrings(build({}));
    expect(sst).toContain('Riset');
    expect(sst).toContain('Bima');
    expect(sst).not.toContain('Kickoff meeting');
  });

  it('contoh: 20 tugas dengan pendahulu, mulai hari Senin', () => {
    const f = build({ sample: true });
    const sst = sharedStrings(f);
    expect(sst).toContain('Go-live');
    expect(sst).toContain('T019');
    const tasks = f['xl/worksheets/sheet3.xml'];
    const start = Number(/<c r="F6" s="\d+"><v>(\d+)<\/v>/.exec(tasks)?.[1]);
    // Nomor seri Excel: (serial - 2) mod 7 = 0 untuk hari Senin.
    expect((start - 2) % 7).toBe(0);
  });

  it('Gantt memakai format bersyarat, bukan rumus per sel hari', () => {
    const gantt = build({})['xl/worksheets/sheet4.xml'];
    expect(gantt).toContain('<conditionalFormatting');
    expect(gantt).not.toMatch(/<c r="H8"[^>]*><f>/);
  });
});
