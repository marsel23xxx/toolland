import { describe, expect, it } from 'vitest';
import { buildFromForm } from './nilai-siswa';
import { chartCount, expectNamesDefined, sharedStrings, sheetNames, unzipXlsx } from './test-utils';

const build = (o: Record<string, unknown>) =>
  unzipXlsx(
    buildFromForm({
      locale: 'id',
      school: 'SMP Uji',
      teacher: 'Bu Guru',
      subject: 'IPA',
      academicYear: '2025/2026',
      semester: 'Genap',
      kktp: 70,
      classes: ['8A', '8B'],
      students: ['Citra | 8A', 'Doni | 8B', ' '],
      sample: false,
      ...o,
    } as never).toBytes(),
  );

describe('template nilai siswa', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`sheet, nama rentang, dan grafik (${locale})`, () => {
      const f = build({ locale, sample: true });
      expect(sheetNames(f)).toHaveLength(8);
      expectNamesDefined(f, 25);
      expect(chartCount(f)).toBe(3);
    });
  }

  it('kelas, siswa, KKTP, dan semester dari form', () => {
    const f = build({});
    const sst = sharedStrings(f);
    expect(sst).toContain('8B');
    expect(sst).toContain('Doni');
    expect(sst).toContain('IPA');
    expect(sst).toContain('Genap');
    expect(f['xl/worksheets/sheet7.xml']).toContain('<v>70</v>');
  });

  it('nilai akhir = rata-rata berbobot dari komponen yang terisi', () => {
    const grades = build({})['xl/worksheets/sheet3.xml'];
    expect(grades).toContain('IF($K6=&quot;&quot;,0,$K6*WTask)');
    expect(grades).toContain('ROUND(AVERAGE(E6:J6),1)');
  });

  it('contoh: 90 siswa dalam 3 kelas', () => {
    const f = build({ sample: true, classes: ['X'] });
    const sst = sharedStrings(f);
    expect(sst).toContain('VII B');
    const stu = f['xl/worksheets/sheet6.xml'];
    expect(
      [...stu.matchAll(/<c r="E(\d+)" s="\d+" t="s">/g)].filter((m) => Number(m[1]) >= 6),
    ).toHaveLength(90);
  });
});
