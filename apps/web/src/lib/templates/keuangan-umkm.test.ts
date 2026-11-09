import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FINANCE_DEFAULT_ACCOUNTS, FINANCE_PRESETS } from './finance-presets';
import { buildFinanceWorkbook, type FinanceOptions } from './keuangan-umkm';
import { cleanList, moneyFmt } from './kit';

const base = (o: Partial<FinanceOptions> = {}): FinanceOptions => ({
  locale: 'id',
  business: 'Toko Uji',
  year: 2026,
  currency: 'IDR',
  accounts: FINANCE_DEFAULT_ACCOUNTS.id,
  incomeCats: FINANCE_PRESETS.id.umum.income,
  expenseCats: FINANCE_PRESETS.id.umum.expense,
  sample: false,
  ...o,
});

function files(o: FinanceOptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(buildFinanceWorkbook(o).toBytes())).map(([k, v]) => [k, strFromU8(v)]),
  );
}

describe('template keuangan umkm', () => {
  it('daftar dari form dirapikan', () => {
    expect(cleanList(['  Kas  ', '', 'kas', 'Bank   BCA', 'x'.repeat(80)], 10)).toEqual([
      'Kas',
      'Bank BCA',
      'x'.repeat(60),
    ]);
    expect(cleanList(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });

  it('format uang per mata uang', () => {
    expect(moneyFmt('IDR')).toBe('"Rp "#,##0;[Red]-"Rp "#,##0;"-"');
    expect(moneyFmt('USD')).toBe('"$ "#,##0.00;[Red]-"$ "#,##0.00;"-"');
  });

  for (const locale of ['id', 'en'] as const) {
    it(`semua sheet ada dan setiap nama rentang di rumus terdefinisi (${locale})`, () => {
      const f = files(
        base({
          locale,
          accounts: FINANCE_DEFAULT_ACCOUNTS[locale],
          incomeCats: FINANCE_PRESETS[locale].kuliner.income,
          expenseCats: FINANCE_PRESETS[locale].kuliner.expense,
          sample: true,
        }),
      );
      const wb = f['xl/workbook.xml'];
      const sheets = [...wb.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
      expect(sheets).toHaveLength(9);
      expect(sheets[0]).toBe('Menu');
      const defined = new Set([...wb.matchAll(/<definedName name="([^"]+)"/g)].map((m) => m[1]));
      for (const n of [
        'Accounts',
        'Categories',
        'FiscalYear',
        'TxAmount',
        'TxType',
        'ArBalance',
        'ApDue',
        'Months',
      ])
        expect(defined.has(n), n).toBe(true);
      // Nama yang dipakai di rumus (TxDate, IncomeCats, ...) harus terdaftar.
      const used = new Set<string>();
      for (const [name, xml] of Object.entries(f)) {
        if (!name.startsWith('xl/worksheets/sheet')) continue;
        for (const m of xml.matchAll(/<f>([^<]*)<\/f>/g)) {
          const formula = m[1].replace(/&quot;[^&]*&quot;/g, '').replace(/'[^']*'!/g, '');
          for (const id of formula.matchAll(/\b([A-Z][a-z]+[A-Za-z]*)\b(?!\()/g)) used.add(id[1]);
        }
      }
      for (const n of used)
        expect(defined.has(n), `nama rentang belum didefinisikan: ${n}`).toBe(true);
      expect(Object.keys(f).filter((k) => k.startsWith('xl/charts/'))).toHaveLength(3);
    });
  }

  it('contoh data: transaksi urut tanggal dan nomor bukti berurutan', () => {
    const f = files(base({ sample: true, year: 2025 }));
    const sst = [
      ...f['xl/sharedStrings.xml'].matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g),
    ].map((m) => m[1]);
    const tx = f['xl/worksheets/sheet3.xml'];
    const dates = [...tx.matchAll(/<c r="B(\d+)" s="\d+"><v>(\d+)<\/v>/g)].map((m) => Number(m[2]));
    expect(dates.length).toBeGreaterThan(200);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    const refs = [...tx.matchAll(/<c r="C(\d+)" s="\d+" t="s"><v>(\d+)<\/v>/g)].map(
      (m) => sst[Number(m[2])],
    );
    expect(refs.slice(1, 4)).toEqual(['TRX-0001', 'TRX-0002', 'TRX-0003']);
  });

  it('isian kosong atau aneh tetap menghasilkan file yang benar', () => {
    const f = files(
      base({ business: '   ', year: 1700, accounts: [], incomeCats: [' '], expenseCats: [] }),
    );
    const set = f['xl/worksheets/sheet8.xml'];
    const sst = f['xl/sharedStrings.xml'];
    expect(sst).toContain('Nama Usaha Anda');
    expect(set).toContain('<v>2000</v>');
    expect(sst).toContain('Kas tunai');
    expect(sst).toContain('Pembelian stok/bahan');
  });
});
