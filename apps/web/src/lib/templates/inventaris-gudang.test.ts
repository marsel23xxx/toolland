import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildInventoryWorkbook, type InventoryOptions } from './inventaris-gudang';
import { INVENTORY_PRESETS } from './inventory-presets';

const base = (o: Partial<InventoryOptions> = {}): InventoryOptions => ({
  locale: 'id',
  business: 'Gudang Uji',
  year: 2025,
  currency: 'IDR',
  warehouses: INVENTORY_PRESETS.id.umum.warehouses,
  categories: INVENTORY_PRESETS.id.umum.categories,
  units: INVENTORY_PRESETS.id.umum.units,
  preset: 'umum',
  sample: false,
  ...o,
});

function files(o: InventoryOptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(buildInventoryWorkbook(o).toBytes())).map(([k, v]) => [
      k,
      strFromU8(v),
    ]),
  );
}

const strings = (f: Record<string, string>) =>
  [...f['xl/sharedStrings.xml'].matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1]);

describe('template inventaris & gudang', () => {
  for (const locale of ['id', 'en'] as const) {
    it(`semua sheet ada dan setiap nama rentang di rumus terdefinisi (${locale})`, () => {
      const p = INVENTORY_PRESETS[locale].kuliner;
      const f = files(
        base({
          locale,
          warehouses: p.warehouses,
          categories: p.categories,
          units: p.units,
          preset: 'kuliner',
          sample: true,
        }),
      );
      const wb = f['xl/workbook.xml'];
      const sheets = [...wb.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
      expect(sheets).toHaveLength(10);
      expect(sheets[0]).toBe('Menu');
      const defined = new Set([...wb.matchAll(/<definedName name="([^"]+)"/g)].map((m) => m[1]));
      const used = new Set<string>();
      for (const [name, xml] of Object.entries(f)) {
        if (!name.startsWith('xl/worksheets/sheet')) continue;
        for (const m of xml.matchAll(/<f>([^<]*)<\/f>/g)) {
          const formula = m[1].replace(/&quot;[^&]*&quot;/g, '').replace(/'[^']*'!/g, '');
          for (const id of formula.matchAll(/\b([A-Z][a-z]+[A-Za-z]*)\b(?!\()/g)) used.add(id[1]);
        }
      }
      expect(used.size).toBeGreaterThan(20);
      for (const n of used)
        expect(defined.has(n), `nama rentang belum didefinisikan: ${n}`).toBe(true);
      expect(Object.keys(f).filter((k) => k.startsWith('xl/charts/'))).toHaveLength(4);
    });
  }

  it('contoh data: mutasi urut tanggal, stok awal dulu, nomor dokumen per jenis', () => {
    const f = files(base({ sample: true }));
    const sst = strings(f);
    const mv = f['xl/worksheets/sheet4.xml'];
    const dates = [...mv.matchAll(/<c r="B(\d+)" s="\d+"><v>(\d+)<\/v>/g)].map((m) => Number(m[2]));
    expect(dates.length).toBeGreaterThan(300);
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    const docs = [...mv.matchAll(/<c r="C(\d+)" s="\d+" t="s"><v>(\d+)<\/v>/g)].map(
      (m) => sst[Number(m[2])],
    );
    expect(docs.slice(1, 3)).toEqual(['SA-0001', 'SA-0002']);
    expect(docs.some((d) => d.startsWith('PG-'))).toBe(true);
    expect(docs.some((d) => d.startsWith('BM-'))).toBe(true);
    expect(sst).toContain('BRG-001');
  });

  it('gudang dibatasi 6 dan isian kosong memakai preset', () => {
    const f = files(
      base({
        business: ' ',
        year: 3000,
        warehouses: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'],
        categories: [],
        units: ['  '],
      }),
    );
    const sst = strings(f);
    expect(sst).toContain('Nama Usaha Anda');
    expect(sst).toContain('G6');
    expect(sst).not.toContain('G7');
    expect(sst).toContain('Bahan baku');
    expect(sst).toContain('pcs');
    expect(f['xl/worksheets/sheet9.xml']).toContain('<v>2100</v>');
  });

  it('tanpa contoh data: sheet Barang dan Mutasi kosong', () => {
    const sst = strings(files(base()));
    expect(sst).not.toContain('BRG-001');
    expect(sst).not.toContain('SA-0001');
  });
});
