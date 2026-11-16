/**
 * Uji Validitas & Reliabilitas kuesioner: baca data yang ditempel dari Excel/SPSS/CSV, hitung
 * korelasi item-total (Pearson dan corrected item-total), bandingkan dengan r tabel, lalu
 * hitung Cronbach's alpha (termasuk alpha jika item dihapus). Hasilnya sama dengan output SPSS
 * "Bivariate Correlations" dan "Reliability Analysis".
 */
import { colName } from '../xlsx/ref';
import { Workbook } from '../xlsx/workbook';
import { rCrit, rTwoTail } from './dist';

export interface ParsedData {
  /** Nama item (dari baris judul, atau "Item 1", "Item 2", ... bila tidak ada judul). */
  headers: string[];
  /** Matriks skor: baris = responden, kolom = item. Hanya baris lengkap. */
  rows: number[][];
  hasHeader: boolean;
  /** Kolom yang diabaikan (nomor/nama responden, total). */
  skipped: string[];
  /** Nomor baris data (mulai 1) yang dibuang karena kosong atau bukan angka. */
  dropped: number[];
}

const ID_RE = /^(no\.?|nomor|resp(onden)?\.?|nama|name|id|kode|code|#)$/i;
const TOTAL_RE = /^(total|jumlah|jml|skor\s*total|total\s*skor|sum|score|skor|∑|Σ)/i;

/**
 * Ubah teks sel menjadi angka. Koma atau titik sama-sama boleh sebagai desimal ("3,5" dan
 * "3.5"); bila keduanya ada, yang terakhir adalah desimal ("1.234,5").
 */
export function toNumber(s: string): number | null {
  let t = s.trim().replace(/\s/g, '');
  if (!t) return null;
  const comma = t.lastIndexOf(',');
  const dot = t.lastIndexOf('.');
  if (comma > dot) t = t.replace(/\./g, '').replace(',', '.');
  else if (comma >= 0) t = t.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  return Number(t);
}

/** Pecah teks menjadi sel: tab (salinan Excel/SPSS), titik koma, koma (CSV), atau spasi. */
function splitRows(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  const sep = text.includes('\t')
    ? '\t'
    : text.includes(';')
      ? ';'
      : text.includes(',')
        ? ','
        : null;
  const cells = lines.map((l) =>
    (sep ? l.split(sep) : l.trim().split(/\s+/)).map((c) => c.trim().replace(/^"(.*)"$/, '$1')),
  );
  return cells;
}

export function parseData(text: string): ParsedData {
  const cells = splitRows(text);
  const empty: ParsedData = { headers: [], rows: [], hasHeader: false, skipped: [], dropped: [] };
  if (!cells.length) return empty;
  const width = Math.max(...cells.map((r) => r.length));
  const grid = cells.map((r) => [...r, ...Array<string>(width - r.length).fill('')]);
  const num = toNumber;

  const hasHeader = grid[0].some((c) => c !== '' && num(c) === null);
  const body = hasHeader ? grid.slice(1) : grid;
  const headers = hasHeader
    ? grid[0].map((h, i) => h || `Item ${i + 1}`)
    : grid[0].map((_, i) => `Item ${i + 1}`);

  // Kolom nomor/nama responden dan kolom total diabaikan.
  const keep: number[] = [];
  const skipped: string[] = [];
  for (let c = 0; c < width; c++) {
    const col = body.map((r) => r[c]);
    const nonNum = col.filter((v) => v !== '' && num(v) === null).length;
    const h = hasHeader ? grid[0][c] : '';
    const sequential =
      body.length > 7 && col.every((v, i) => num(v) === i + 1) && (c === 0 || ID_RE.test(h));
    const isId = (hasHeader && ID_RE.test(h)) || nonNum > col.length / 2 || sequential;
    const isTotal =
      (hasHeader && TOTAL_RE.test(h)) ||
      (c === width - 1 && c >= 2 && !hasHeader && isRowSum(body, c, num));
    if (isId || isTotal) skipped.push(h || `#${c + 1}`);
    else keep.push(c);
  }

  const rows: number[][] = [];
  const dropped: number[] = [];
  body.forEach((r, i) => {
    const vals = keep.map((c) => num(r[c]));
    if (vals.every((v) => v !== null)) rows.push(vals as number[]);
    else dropped.push(i + 1);
  });
  return { headers: keep.map((c) => headers[c]), rows, hasHeader, skipped, dropped };
}

/** Kolom terakhir tanpa judul yang isinya selalu jumlah kolom lain = kolom total. */
function isRowSum(body: string[][], c: number, num: (s: string) => number | null): boolean {
  if (body.length < 3) return false;
  return body.every((r) => {
    const total = num(r[c]);
    let sum = 0;
    for (let k = 0; k < c; k++) {
      const v = num(r[k]);
      if (v === null) return false;
      sum += v;
    }
    return total !== null && Math.abs(total - sum) < 1e-9;
  });
}

/**
 * Kelompokkan item per variabel dari nama kolom: "X1.1", "X1_2", "X1-3" → X1; "Y1", "Y2" → Y.
 * Hanya dipakai bila ada lebih dari satu kelompok dan setiap kelompok punya minimal 2 item.
 */
export function groupItems(headers: string[]): { name: string; cols: number[] }[] | null {
  const groups = new Map<string, number[]>();
  headers.forEach((h, i) => {
    const m = /^(.*?[A-Za-z][A-Za-z0-9]*?)(?:[._\-\s]+(\d+)|(\d+))$/.exec(h.trim());
    const key = m ? m[1].replace(/[._\-\s]+$/, '') : h;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });
  const list = [...groups].map(([name, cols]) => ({ name, cols }));
  if (list.length < 2 || list.some((g) => g.cols.length < 2)) return null;
  return list;
}

// --- Statistik -----------------------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Varians sampel (pembagi n − 1), sama seperti SPSS dan VAR.S di Excel. */
export function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

/** Korelasi Pearson; null bila salah satu variabel konstan. */
export function pearson(x: number[], y: number[]): number | null {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx < 1e-12 || syy < 1e-12) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Cronbach's alpha untuk kolom-kolom item; null bila kurang dari 2 item atau total konstan. */
export function cronbach(cols: number[][]): number | null {
  const k = cols.length;
  if (k < 2) return null;
  const n = cols[0].length;
  const totals = Array.from({ length: n }, (_, i) => cols.reduce((a, c) => a + c[i], 0));
  const vt = variance(totals);
  if (vt < 1e-12) return null;
  const sumVar = cols.reduce((a, c) => a + variance(c), 0);
  return (k / (k - 1)) * (1 - sumVar / vt);
}

export type ValidityMethod = 'pearson' | 'corrected';

export interface AnalyzeOptions {
  alpha: number;
  tails: 1 | 2;
  method: ValidityMethod;
  /** Batas Cronbach's alpha untuk dinyatakan reliabel (0,6 atau 0,7). */
  threshold: number;
}

export interface ItemResult {
  name: string;
  mean: number;
  sd: number;
  /** Korelasi item dengan skor total (Pearson product moment). */
  r: number | null;
  /** Corrected item-total correlation (skor total tanpa item ini). */
  rCorrected: number | null;
  /** r yang dipakai untuk keputusan (sesuai metode). */
  rUsed: number | null;
  /** Nilai Sig. untuk rUsed. */
  p: number | null;
  valid: boolean;
  /** Cronbach's alpha bila item ini dihapus. */
  alphaIfDeleted: number | null;
}

export interface VariableResult {
  name: string;
  n: number;
  df: number;
  rTable: number;
  items: ItemResult[];
  alpha: number | null;
  /** Alpha dari item valid saja (null bila semua valid atau item valid kurang dari 2). */
  alphaValid: number | null;
  validCount: number;
  reliable: boolean;
}

export function analyze(
  name: string,
  headers: string[],
  rows: number[][],
  opts: AnalyzeOptions,
): VariableResult | null {
  const n = rows.length;
  const k = headers.length;
  if (n < 3 || k < 2) return null;
  const cols = headers.map((_, j) => rows.map((r) => r[j]));
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0));
  const df = n - 2;
  const rTable = rCrit(opts.alpha, df, opts.tails);
  const items: ItemResult[] = cols.map((c, j) => {
    const r = pearson(c, totals);
    const rest = totals.map((t, i) => t - c[i]);
    const rCorrected = pearson(c, rest);
    const rUsed = opts.method === 'pearson' ? r : rCorrected;
    const p = rUsed === null ? null : rTwoTail(rUsed, df) / (opts.tails === 1 ? 2 : 1);
    const others = cols.filter((_, x) => x !== j);
    return {
      name: headers[j],
      mean: mean(c),
      sd: Math.sqrt(variance(c)),
      r,
      rCorrected,
      rUsed,
      p,
      valid: rUsed !== null && rUsed >= rTable,
      alphaIfDeleted: cronbach(others),
    };
  });
  const alpha = cronbach(cols);
  const validCols = cols.filter((_, j) => items[j].valid);
  const validCount = validCols.length;
  const alphaValid = validCount < k && validCount >= 2 ? cronbach(validCols) : null;
  const used = validCount < k && alphaValid !== null ? alphaValid : alpha;
  return {
    name,
    n,
    df,
    rTable,
    items,
    alpha,
    alphaValid,
    validCount,
    reliable: used !== null && used >= opts.threshold,
  };
}

/** Data contoh: 30 responden, 10 item Likert 1–5, satu item (P7) sengaja tidak valid. */
export function sampleData(): string {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const head = ['No', ...Array.from({ length: 10 }, (_, i) => `P${i + 1}`)];
  const lines = [head.join('\t')];
  for (let r = 1; r <= 30; r++) {
    const trait = rnd() * 4 - 2;
    const row = [String(r)];
    for (let i = 1; i <= 10; i++) {
      const noise = (rnd() - 0.5) * 3.6;
      const v = i === 7 ? 1 + Math.floor(rnd() * 5) : Math.round(3 + trait * 0.9 + noise);
      row.push(String(Math.min(5, Math.max(1, v))));
    }
    lines.push(row.join('\t'));
  }
  return lines.join('\n');
}

// --- Ekspor --------------------------------------------------------------------------------------

export interface SheetTable {
  name: string;
  head: string[];
  rows: (string | number | null)[][];
  /** Format angka per kolom (indeks kolom → kode format Excel). */
  numFmt?: Record<number, string>;
}

/** Tabel hasil ke .xlsx, satu sheet per tabel. */
export function tablesToXlsx(title: string, tables: SheetTable[]): Blob {
  const wb = new Workbook({ title });
  const line = { style: 'thin' as const, color: '8A8174' };
  for (const t of tables) {
    const sh = wb.addSheet(t.name.slice(0, 31), { gridlines: false, fitWidth: true });
    t.head.forEach((h, c) =>
      sh.cell(c + 1, 1, h, {
        font: { bold: true },
        fill: 'EFE9DF',
        align: { h: 'center', v: 'center', wrap: true },
        border: { top: line, bottom: line },
      }),
    );
    t.rows.forEach((row, r) =>
      row.forEach((v, c) =>
        sh.cell(c + 1, r + 2, v ?? '', {
          numFmt: typeof v === 'number' ? t.numFmt?.[c] : undefined,
          align: { h: typeof v === 'number' ? 'right' : 'left' },
        }),
      ),
    );
    sh.freeze('A2');
    t.head.forEach((h, c) =>
      sh.width(
        colName(c + 1),
        Math.min(
          40,
          Math.max(10, h.length + 2, ...t.rows.map((r) => String(r[c] ?? '').length + 2)),
        ),
      ),
    );
  }
  return wb.toBlob();
}
