import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { PTKP, TER, pasal17, terRate } from './payroll-rules';
import { DEFAULT_DEPARTMENTS, type PayrollOptions, buildPayrollWorkbook } from './sdm-penggajian';

const base = (o: Partial<PayrollOptions> = {}): PayrollOptions => ({
  locale: 'id',
  company: 'PT Uji',
  year: 2025,
  departments: DEFAULT_DEPARTMENTS.id,
  jkk: 0.24,
  sample: false,
  ...o,
});

function files(o: PayrollOptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(buildPayrollWorkbook(o).toBytes())).map(([k, v]) => [k, strFromU8(v)]),
  );
}

const strings = (f: Record<string, string>) =>
  [...f['xl/sharedStrings.xml'].matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1]);

describe('aturan penggajian', () => {
  it('jumlah lapisan TER sesuai PP 58/2023', () => {
    expect(TER.A).toHaveLength(44);
    expect(TER.B).toHaveLength(40);
    expect(TER.C).toHaveLength(41);
    for (const cat of ['A', 'B', 'C'] as const) {
      const caps = TER[cat].map(([c]) => c);
      expect([...caps].sort((a, b) => a - b)).toEqual(caps);
      expect(TER[cat].at(-1)).toEqual([Infinity, 34]);
    }
  });

  it('tarif TER dan Pasal 17 untuk contoh yang diketahui', () => {
    expect(terRate('A', 5_400_000)).toBe(0);
    expect(terRate('A', 6_657_956)).toBe(1);
    expect(terRate('B', 7_019_411)).toBe(0.75);
    expect(terRate('B', 18_571_800)).toBe(8);
    expect(terRate('C', 6_600_001)).toBe(0.25);
    expect(pasal17(60_000_000)).toBe(3_000_000);
    expect(pasal17(163_434_000)).toBe(3_000_000 + 103_434_000 * 0.15);
    expect(pasal17(0)).toBe(0);
  });

  it('PTKP dan kategori', () => {
    expect(Object.fromEntries(PTKP.map(([s, , c]) => [s, c]))).toEqual({
      'TK/0': 'A',
      'TK/1': 'A',
      'K/0': 'A',
      'TK/2': 'B',
      'TK/3': 'B',
      'K/1': 'B',
      'K/2': 'B',
      'K/3': 'C',
    });
  });
});

describe('template sdm & penggajian', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`semua sheet ada dan setiap nama rentang di rumus terdefinisi (${locale})`, () => {
      const f = files(base({ locale, departments: DEFAULT_DEPARTMENTS[locale], sample: true }));
      const wb = f['xl/workbook.xml'];
      const sheets = [...wb.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
      expect(sheets).toHaveLength(10);
      const defined = new Set([...wb.matchAll(/<definedName name="([^"]+)"/g)].map((m) => m[1]));
      const used = new Set<string>();
      for (const [name, xml] of Object.entries(f)) {
        if (!name.startsWith('xl/worksheets/sheet')) continue;
        for (const m of xml.matchAll(/<f>([^<]*)<\/f>/g)) {
          const formula = m[1].replace(/&quot;[^&]*&quot;/g, '').replace(/'[^']*'!/g, '');
          for (const id of formula.matchAll(/\b([A-Z][a-z]+[A-Za-z0-9]*)\b(?!\()/g))
            used.add(id[1]);
        }
      }
      expect(used.size).toBeGreaterThan(30);
      for (const n of used)
        expect(defined.has(n), `nama rentang belum didefinisikan: ${n}`).toBe(true);
      expect(Object.keys(f).filter((k) => k.startsWith('xl/charts/'))).toHaveLength(3);
    });
  }

  it('contoh data: 12 karyawan, satu masuk April, gaji 12 bulan', () => {
    const f = files(base({ sample: true }));
    const sst = strings(f);
    expect(sst).toContain('K-012');
    expect(sst).toContain('Budi Santoso');
    const pay = f['xl/worksheets/sheet4.xml'];
    const ids = [...pay.matchAll(/<c r="C(\d+)" s="\d+" t="s"><v>(\d+)<\/v>/g)].map(
      (m) => sst[Number(m[2])],
    );
    expect(ids.filter((x) => x === 'K-001')).toHaveLength(12);
    expect(ids.filter((x) => x === 'K-012')).toHaveLength(9);
  });

  it('isian aneh: tahun dibatasi, JKK tidak dikenal jadi 0,24%, departemen bawaan', () => {
    const f = files(base({ company: '', year: 1500, jkk: 9, departments: [' '] }));
    const sst = strings(f);
    expect(sst).toContain('Nama Perusahaan Anda');
    expect(sst).toContain('Operasional');
    expect(f['xl/worksheets/sheet9.xml']).toContain('<v>2000</v>');
    expect(f['xl/worksheets/sheet8.xml']).toContain('<v>0.24</v>');
    expect(sst).not.toContain('K-001');
  });
});
