/**
 * Tabel Statistik (r, t, F, chi-kuadrat): susun baris tabel untuk rentang derajat bebas tertentu,
 * lalu ekspor ke .xlsx atau PDF untuk lampiran skripsi. Teks judul dan kepala kolom diberikan
 * oleh pemanggil (sesuai bahasa halaman).
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { colName as colRef } from '../xlsx/ref';
import { Workbook } from '../xlsx/workbook';
import { chiCrit, chiUpper, fCrit, fUpper, rCrit, rTwoTail, tCrit, tTwoTail } from './dist';

export type Kind = 'r' | 't' | 'f' | 'chi';
export const KINDS: Kind[] = ['r', 't', 'f', 'chi'];

/** Taraf signifikansi dua sisi untuk kolom tabel r dan t (satu sisi = setengahnya). */
export const TWO_TAIL = [0.1, 0.05, 0.02, 0.01, 0.001];
/** Taraf signifikansi (ekor atas) untuk kolom tabel chi-kuadrat. */
export const CHI_ALPHA = [0.995, 0.99, 0.975, 0.95, 0.9, 0.1, 0.05, 0.025, 0.01, 0.005];
/** Pilihan α untuk tabel F (satu tabel per α). */
export const F_ALPHA = [0.1, 0.05, 0.025, 0.01];
/** Jumlah kolom df1 pada tabel F. */
export const F_COLS = 15;
/** Batas derajat bebas dan jumlah baris sekali tampil. */
export const MAX_DF = 5000;
export const MAX_ROWS = 500;

export interface Labels {
  title: string;
  note: string;
  df: string;
  n: string;
  oneTail: string;
  twoTail: string;
  /** Kepala kolom df1 untuk tabel F, misalnya "df1 (pembilang)". */
  df1: string;
  /** Kepala kolom df2 untuk tabel F. */
  df2: string;
  /** Kepala kolom α untuk tabel chi-kuadrat. */
  alpha: string;
}

export interface HeadCell {
  text: string;
  span: number;
}

export interface Table {
  kind: Kind;
  title: string;
  note: string;
  head: HeadCell[][];
  /** Setiap baris: kolom bilangan bulat di depan (df, dan N untuk tabel r), lalu nilai kritis. */
  rows: number[][];
  intCols: number;
}

/** Jumlah desimal yang ditampilkan untuk sebuah nilai tabel. */
export function digitsFor(kind: Kind, v: number): number {
  if (kind === 'f') return 2;
  if (kind === 'chi') return v >= 1 ? 3 : Math.max(3, 2 - Math.floor(Math.log10(v)));
  return 4;
}

export function clampRange(from: number, to: number): [number, number] {
  const a = Math.min(Math.max(1, Math.floor(from) || 1), MAX_DF);
  const b = Math.min(Math.max(a, Math.floor(to) || a), MAX_DF, a + MAX_ROWS - 1);
  return [a, b];
}

export function buildTable(
  kind: Kind,
  from: number,
  to: number,
  fAlpha: number,
  L: Labels,
  fmtAlpha: (x: number) => string,
): Table {
  const [a, b] = clampRange(from, to);
  const rows: number[][] = [];
  let head: HeadCell[][];
  let intCols = 1;
  if (kind === 'r' || kind === 't') {
    intCols = kind === 'r' ? 2 : 1;
    const lead = kind === 'r' ? [L.df, L.n] : [L.df];
    head = [
      [
        { text: '', span: intCols },
        { text: L.oneTail, span: TWO_TAIL.length },
      ],
      [{ text: '', span: intCols }, ...TWO_TAIL.map((x) => ({ text: fmtAlpha(x / 2), span: 1 }))],
      [
        { text: '', span: intCols },
        { text: L.twoTail, span: TWO_TAIL.length },
      ],
      [
        ...lead.map((text) => ({ text, span: 1 })),
        ...TWO_TAIL.map((x) => ({ text: fmtAlpha(x), span: 1 })),
      ],
    ];
    for (let df = a; df <= b; df++) {
      const vals = TWO_TAIL.map((x) => (kind === 'r' ? rCrit(x, df) : tCrit(x, df)));
      rows.push(kind === 'r' ? [df, df + 2, ...vals] : [df, ...vals]);
    }
  } else if (kind === 'f') {
    const cols = Array.from({ length: F_COLS }, (_, i) => i + 1);
    head = [
      [
        { text: '', span: 1 },
        { text: L.df1, span: F_COLS },
      ],
      [{ text: L.df2, span: 1 }, ...cols.map((c) => ({ text: String(c), span: 1 }))],
    ];
    for (let df2 = a; df2 <= b; df2++) rows.push([df2, ...cols.map((c) => fCrit(fAlpha, c, df2))]);
  } else {
    head = [
      [
        { text: '', span: 1 },
        { text: L.alpha, span: CHI_ALPHA.length },
      ],
      [{ text: L.df, span: 1 }, ...CHI_ALPHA.map((x) => ({ text: fmtAlpha(x), span: 1 }))],
    ];
    for (let df = a; df <= b; df++) rows.push([df, ...CHI_ALPHA.map((x) => chiCrit(x, df))]);
  }
  return { kind, title: L.title, note: L.note, head, rows, intCols };
}

export interface Lookup {
  kind: Kind;
  /** df untuk r (= N − 2), t, dan chi-kuadrat. */
  df: number;
  df1: number;
  df2: number;
  alpha: number;
  tails: 1 | 2;
}

export function lookupValid(q: Lookup): boolean {
  const ok = (d: number) => Number.isInteger(d) && d >= 1 && d <= 100_000;
  const alphaOk = q.alpha > 0 && q.alpha < (q.kind === 'chi' ? 1 : 0.5);
  return alphaOk && (q.kind === 'f' ? ok(q.df1) && ok(q.df2) : ok(q.df));
}

/** Nilai kritis untuk satu kombinasi derajat bebas dan α. */
export function critical(q: Lookup): number {
  switch (q.kind) {
    case 'r':
      return rCrit(q.alpha, q.df, q.tails);
    case 't':
      return tCrit(q.alpha, q.df, q.tails);
    case 'f':
      return fCrit(q.alpha, q.df1, q.df2);
    case 'chi':
      return chiCrit(q.alpha, q.df);
  }
}

/** Nilai p untuk nilai hitung (r dan t memakai nilai mutlak; satu sisi = setengah dua sisi). */
export function pValue(q: Lookup, stat: number): number {
  switch (q.kind) {
    case 'r':
      return rTwoTail(stat, q.df) / (q.tails === 1 ? 2 : 1);
    case 't':
      return tTwoTail(stat, q.df) / (q.tails === 1 ? 2 : 1);
    case 'f':
      return fUpper(stat, q.df1, q.df2);
    case 'chi':
      return chiUpper(stat, q.df);
  }
}

/** Nilai hitung signifikan bila (nilai mutlaknya) ≥ nilai tabel. */
export function significant(q: Lookup, stat: number): boolean {
  const s = q.kind === 'r' || q.kind === 't' ? Math.abs(stat) : stat;
  return s >= critical(q);
}

/** Format sel tabel sesuai jenis kolomnya. */
export function cellText(t: Table, col: number, v: number, num: (x: number, d: number) => string) {
  return col < t.intCols ? String(v) : num(v, digitsFor(t.kind, v));
}

/** Teks tab-separated untuk ditempel ke Excel atau Word. */
export function toTsv(t: Table, num: (x: number, d: number) => string): string {
  const head = t.head.map((row) =>
    row.flatMap((c) => [c.text, ...Array<string>(c.span - 1).fill('')]).join('\t'),
  );
  const body = t.rows.map((r) => r.map((v, i) => cellText(t, i, v, num)).join('\t'));
  return [t.title, ...head, ...body].join('\n');
}

// --- Excel ---------------------------------------------------------------------------------------

export function toXlsx(t: Table, sheetName: string): Blob {
  const wb = new Workbook({ title: t.title });
  const sh = wb.addSheet(sheetName.slice(0, 31), { gridlines: false, fitWidth: true });
  const cols = t.head[t.head.length - 1].reduce((n, c) => n + c.span, 0);
  const thin = { style: 'thin' as const, color: '8A8174' };
  sh.set('A1', t.title, { font: { bold: true, size: 13 } });
  sh.set('A2', t.note, { font: { italic: true, size: 9, color: '5C554B' } });
  let r = 4;
  t.head.forEach((row, k) => {
    let c = 1;
    const last = k === t.head.length - 1;
    for (const cell of row) {
      const style = {
        font: { bold: true, size: 10 },
        fill: 'EFE9DF',
        align: { h: 'center' as const, v: 'center' as const },
        border: { top: k === 0 ? thin : undefined, bottom: last ? thin : undefined },
      };
      if (cell.span > 1) {
        sh.merge(`${colRef(c)}${r}:${colRef(c + cell.span - 1)}${r}`, cell.text, style);
      } else sh.cell(c, r, cell.text, style);
      c += cell.span;
    }
    r++;
  });
  sh.freeze(`${colRef(t.intCols + 1)}${r}`);
  sh.printTitles(4, r - 1);
  for (const row of t.rows) {
    row.forEach((v, i) => {
      const d = i < t.intCols ? 0 : digitsFor(t.kind, v);
      sh.cell(i + 1, r, v, {
        numFmt: d ? `0.${'0'.repeat(d)}` : '0',
        align: { h: i < t.intCols ? 'center' : 'right' },
        font: i < t.intCols ? { bold: true } : undefined,
      });
    });
    r++;
  }
  for (let c = 1; c <= cols; c++) sh.width(colRef(c), c <= t.intCols ? 7 : 10);
  return wb.toBlob();
}

// --- PDF -----------------------------------------------------------------------------------------

/** Huruf yang tidak ada di font standar PDF (WinAnsi) diganti padanannya. */
export function pdfSafe(s: string): string {
  return s
    .replace(/α/g, 'alpha')
    .replace(/χ/g, 'Chi')
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[−–]/g, '-')
    .replace(/[^\x20-\x7e\u00a0-\u00ff]/g, '');
}

export async function toPdf(
  t: Table,
  num: (x: number, d: number) => string,
  pageLabel: (n: number, total: number) => string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(t.title));
  doc.setCreator('Toolland');
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const W = 595.28;
  const H = 841.89;
  const M = 42;
  const cols = t.head[t.head.length - 1].reduce((n, c) => n + c.span, 0);
  const intW = 34;
  const valW = (W - 2 * M - intW * t.intCols) / (cols - t.intCols);
  const colX = (c: number) => M + Math.min(c, t.intCols) * intW + Math.max(0, c - t.intCols) * valW;
  const colW = (c: number) => (c < t.intCols ? intW : valW);
  const size = cols > 12 ? 7.5 : 8.5;
  const rowH = size + 4;
  const ink = rgb(0.1, 0.09, 0.08);
  const rule = rgb(0.45, 0.42, 0.38);
  const zebra = rgb(0.95, 0.93, 0.9);

  const center = (
    p: PDFPage,
    s: string,
    x: number,
    w: number,
    y: number,
    f: PDFFont,
    sz: number,
  ) => {
    const txt = pdfSafe(s);
    let fs = sz;
    while (fs > 5 && f.widthOfTextAtSize(txt, fs) > w - 2) fs -= 0.5;
    p.drawText(txt, {
      x: x + (w - f.widthOfTextAtSize(txt, fs)) / 2,
      y,
      size: fs,
      font: f,
      color: ink,
    });
  };
  const line = (p: PDFPage, y: number, thickness = 0.6) =>
    p.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness, color: rule });

  const pages: PDFPage[] = [];
  let i = 0;
  while (i < t.rows.length || pages.length === 0) {
    const p = doc.addPage([W, H]);
    pages.push(p);
    let y = H - M;
    if (pages.length === 1) {
      p.drawText(pdfSafe(t.title), { x: M, y: y - 13, size: 13, font: bold, color: ink });
      y -= 22;
      const words = pdfSafe(t.note).split(' ');
      let ln = '';
      for (const w of words) {
        const next = ln ? `${ln} ${w}` : w;
        if (font.widthOfTextAtSize(next, 8.5) > W - 2 * M) {
          p.drawText(ln, { x: M, y: y - 9, size: 8.5, font, color: rule });
          y -= 11;
          ln = w;
        } else ln = next;
      }
      if (ln) p.drawText(ln, { x: M, y: y - 9, size: 8.5, font, color: rule });
      y -= 18;
    }
    line(p, y, 0.9);
    for (const row of t.head) {
      let c = 0;
      for (const cell of row) {
        const x = colX(c);
        const w = colX(c + cell.span) - x;
        if (cell.text) center(p, cell.text, x, w, y - rowH + 3.5, bold, size);
        c += cell.span;
      }
      y -= rowH;
    }
    line(p, y);
    const bottom = M + 18;
    let k = 0;
    while (i < t.rows.length && y - rowH >= bottom) {
      const row = t.rows[i];
      if (k % 2 === 1)
        p.drawRectangle({ x: M, y: y - rowH, width: W - 2 * M, height: rowH, color: zebra });
      row.forEach((v, c) => {
        const txt = cellText(t, c, v, num);
        center(p, txt, colX(c), colW(c), y - rowH + 3.5, c < t.intCols ? bold : font, size);
      });
      y -= rowH;
      i++;
      k++;
    }
    line(p, y, 0.9);
  }
  pages.forEach((p, n) => {
    const s = pdfSafe(pageLabel(n + 1, pages.length));
    p.drawText(s, {
      x: W - M - font.widthOfTextAtSize(s, 8),
      y: M - 4,
      size: 8,
      font,
      color: rule,
    });
  });
  return doc.save();
}
