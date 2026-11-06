export interface JsonError {
  message: string;
  line?: number;
  column?: number;
}

export type JsonResult = { ok: true; value: unknown } | { ok: false; error: JsonError };

/** Baris dan kolom (mulai dari 1) untuk posisi karakter. */
export function positionToLineCol(text: string, pos: number): { line: number; column: number } {
  const before = text.slice(0, pos);
  const line = before.split('\n').length;
  return { line, column: pos - before.lastIndexOf('\n') };
}

type RawJson = { rawJSON(text: string): unknown; isRawJSON(v: unknown): boolean };
const RAW = (JSON as unknown as Partial<RawJson>).rawJSON ? (JSON as unknown as RawJson) : null;

/** Angka besar hasil parseJson (lihat keepBigNumbers) sebagai teks aslinya, atau undefined. */
export function rawNumber(v: unknown): string | undefined {
  return RAW?.isRawJSON(v) ? (v as { rawJSON: string }).rawJSON : undefined;
}

/**
 * Angka yang tidak muat di number JavaScript (ID 64-bit, NIK, angka desimal panjang) disimpan
 * persis seperti tulisan aslinya, supaya tidak berubah saat diformat. Butuh JSON.rawJSON
 * (browser baru); di browser lama angka tetap dibulatkan seperti biasa.
 */
function keepBigNumbers(_key: string, value: unknown, ctx?: { source?: string }) {
  if (RAW && typeof value === 'number' && ctx?.source && String(value) !== ctx.source)
    return RAW.rawJSON(ctx.source);
  return value;
}

/** Parse JSON dengan lokasi error (baris/kolom) bila ada. */
export function parseJson(text: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(text, RAW ? (keepBigNumbers as never) : undefined) };
  } catch (e) {
    const message = (e as Error).message;
    const lc = /line (\d+) column (\d+)/.exec(message);
    if (lc) return { ok: false, error: { message, line: +lc[1], column: +lc[2] } };
    const pos = /position (\d+)/.exec(message);
    if (pos) return { ok: false, error: { message, ...positionToLineCol(text, +pos[1]) } };
    return { ok: false, error: { message } };
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object' && !RAW?.isRawJSON(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export type Indent = 2 | 4 | 'tab' | 0;

export function formatJson(value: unknown, indent: Indent, sortKeys = false): string {
  const v = sortKeys ? sortKeysDeep(value) : value;
  return JSON.stringify(v, null, indent === 'tab' ? '\t' : indent);
}
