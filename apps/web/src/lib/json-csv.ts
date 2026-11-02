import Papa from 'papaparse';

export type Delimiter = ',' | ';' | '\t';

/** Ratakan objek bertingkat menjadi kunci bertitik: {a:{b:1}} -> {"a.b":1}. Array disimpan sebagai JSON. */
export function flatten(
  obj: Record<string, unknown>,
  prefix = '',
  out: Record<string, unknown> = {},
) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v))
      flatten(v as Record<string, unknown>, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

/** JSON (array objek, atau satu objek) ke CSV. */
export function jsonToCsv(json: unknown, delimiter: Delimiter = ','): string {
  const rows = Array.isArray(json) ? json : [json];
  if (rows.length === 0) return '';
  const flat: Record<string, unknown>[] = rows.map((r) =>
    r && typeof r === 'object' && !Array.isArray(r)
      ? flatten(r as Record<string, unknown>)
      : { value: r },
  );
  // gabungan semua kolom, urut kemunculan
  const columns = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  return Papa.unparse(
    { fields: columns, data: flat.map((r) => columns.map((c) => r[c] ?? '')) },
    { delimiter },
  );
}

export interface CsvResult {
  rows: Record<string, unknown>[];
  errors: { row?: number; message: string }[];
}

/** CSV ke array objek; baris pertama sebagai header, angka dan boolean dikenali otomatis. */
export function csvToJson(csv: string, delimiter?: Delimiter): CsvResult {
  const result = Papa.parse<Record<string, unknown>>(csv.trim(), {
    header: true,
    delimiter: delimiter ?? '',
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return {
    rows: result.data,
    errors: result.errors.map((e) => ({ row: e.row, message: e.message })),
  };
}
