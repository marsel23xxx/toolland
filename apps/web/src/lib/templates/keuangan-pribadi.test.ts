import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildPersonalWorkbook, type PersonalOptions } from './keuangan-pribadi';
import { PERSONAL_PRESETS, PERSONAL_WALLETS } from './personal-presets';

const base = (o: Partial<PersonalOptions> = {}): PersonalOptions => ({
  locale: 'id',
  name: 'Uji',
  year: 2025,
  currency: 'IDR',
  wallets: PERSONAL_WALLETS.id,
  incomeCats: PERSONAL_PRESETS.id.lajang.income,
  expenseCats: PERSONAL_PRESETS.id.lajang.expense,
  preset: 'lajang',
  sample: false,
  ...o,
});

function files(o: PersonalOptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(buildPersonalWorkbook(o).toBytes())).map(([k, v]) => [
      k,
      strFromU8(v),
    ]),
  );
}

const strings = (f: Record<string, string>) =>
  [...f['xl/sharedStrings.xml'].matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1]);

describe('template keuangan pribadi', () => {
  for (const locale of ['id', 'en'] as const) {
    for (const preset of ['keluarga', 'mahasiswa'] as const) {
      it(`nama rentang di rumus terdefinisi (${locale}, ${preset})`, () => {
        const p = PERSONAL_PRESETS[locale][preset];
        const f = files(
          base({
            locale,
            wallets: PERSONAL_WALLETS[locale],
            incomeCats: p.income,
            expenseCats: p.expense,
            preset,
            sample: true,
          }),
        );
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
        expect(used.size).toBeGreaterThan(25);
        for (const n of used)
          expect(defined.has(n), `nama rentang belum didefinisikan: ${n}`).toBe(true);
        expect(Object.keys(f).filter((k) => k.startsWith('xl/charts/'))).toHaveLength(3);
      });
    }
  }

  it('contoh data: transaksi urut, setoran tertaut ke tujuan, cicilan ke utang', () => {
    const p = PERSONAL_PRESETS.id.keluarga;
    const f = files(
      base({ incomeCats: p.income, expenseCats: p.expense, preset: 'keluarga', sample: true }),
    );
    const sst = strings(f);
    const tx = f['xl/worksheets/sheet3.xml'];
    const dates = [...tx.matchAll(/<c r="B(\d+)" s="\d+"><v>(\d+)<\/v>/g)].map((m) => Number(m[2]));
    expect(dates.length).toBeGreaterThan(300);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    const links = [...tx.matchAll(/<c r="H(\d+)" s="\d+" t="s"><v>(\d+)<\/v>/g)].map(
      (m) => sst[Number(m[2])],
    );
    expect(links).toContain('Dana darurat');
    expect(links).toContain('KPR rumah');
    expect(sst).toContain('Rumah');
  });

  it('kategori dari form: kelompok dan anggaran preset dipakai bila namanya cocok', () => {
    const f = files(
      base({
        expenseCats: [
          ['  Kos / sewa ', 'N', 1_500_000],
          ['Kopi', 'W', 0],
        ],
      }),
    );
    const sst = strings(f);
    expect(sst).toContain('Kos / sewa');
    expect(sst).toContain('Kopi');
    expect(sst).toContain('Keinginan');
    expect(f['xl/worksheets/sheet9.xml']).toContain('<v>1500000</v>');
  });

  it('isian kosong memakai bawaan', () => {
    const f = files(base({ name: '', year: 9999, wallets: [], incomeCats: [], expenseCats: [] }));
    const sst = strings(f);
    expect(sst).toContain('Nama Kamu');
    expect(sst).toContain('Dompet tunai');
    expect(sst).toContain('Gaji');
    expect(sst).toContain('Makan &amp; minum');
    expect(f['xl/worksheets/sheet9.xml']).toContain('<v>2100</v>');
  });
});
