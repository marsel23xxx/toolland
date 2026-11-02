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

/** Parse JSON dengan lokasi error (baris/kolom) bila ada. */
export function parseJson(text: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(text) };
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
  if (value && typeof value === 'object') {
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
