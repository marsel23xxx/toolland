/** Alat bantu tes template Excel (hanya dipakai file *.test.ts). */
import { strFromU8, unzipSync } from 'fflate';
import { expect } from 'vitest';

export function unzipXlsx(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(Object.entries(unzipSync(bytes)).map(([k, v]) => [k, strFromU8(v)]));
}

export const sheetNames = (f: Record<string, string>) =>
  [...f['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);

export const sharedStrings = (f: Record<string, string>) =>
  [...f['xl/sharedStrings.xml'].matchAll(/<t xml:space="preserve">([^<]*)<\/t>/g)].map((m) => m[1]);

export const chartCount = (f: Record<string, string>) =>
  Object.keys(f).filter((k) => k.startsWith('xl/charts/')).length;

/** Setiap nama rentang yang dipakai di rumus harus didefinisikan di workbook. */
export function expectNamesDefined(f: Record<string, string>, minUsed = 10): void {
  const defined = new Set(
    [...f['xl/workbook.xml'].matchAll(/<definedName name="([^"]+)"/g)].map((m) => m[1]),
  );
  const used = new Set<string>();
  for (const [name, xml] of Object.entries(f)) {
    if (!name.startsWith('xl/worksheets/sheet')) continue;
    for (const m of xml.matchAll(/<f>([^<]*)<\/f>/g)) {
      const formula = m[1].replace(/&quot;[^&]*&quot;/g, '').replace(/'[^']*'!/g, '');
      for (const id of formula.matchAll(/\b([A-Z][a-z]+[A-Za-z0-9]*)\b(?!\()/g)) used.add(id[1]);
    }
  }
  expect(used.size).toBeGreaterThan(minUsed);
  for (const n of used) expect(defined.has(n), `nama rentang belum didefinisikan: ${n}`).toBe(true);
}
