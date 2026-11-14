/**
 * Aturan tata letak skripsi dari buku pedoman kampus: kertas, margin, font, spasi, judul BAB,
 * subjudul, keterangan tabel/gambar, dan nomor halaman. Pengguna memilih preset lalu
 * menyesuaikan; aturan bisa dibagikan lewat link (#p=...) ke teman satu kampus.
 */

export type Paper = 'A4' | 'F4' | 'Letter';
export type PagePos = 'bottom-center' | 'bottom-right' | 'top-right';

export interface ThesisRules {
  paper: Paper;
  /** Margin dalam cm. */
  margin: { top: number; bottom: number; left: number; right: number };
  font: string;
  /** Ukuran huruf isi (pt). */
  size: number;
  /** Spasi baris isi (kelipatan: 1, 1.15, 1.5, 2). */
  line: number;
  /** Indentasi baris pertama paragraf isi (cm). */
  indent: number;
  /** Jarak setelah paragraf isi (pt). */
  after: number;
  justify: boolean;
  chapter: { size: number; bold: boolean; caps: boolean; center: boolean; newPage: boolean };
  sub: { size: number; bold: boolean };
  caption: { center: boolean };
  pageNum: { front: 'lowerRoman' | 'upperRoman'; pos: PagePos };
}

/** Ukuran kertas dalam twip (1/1440 inci), potret. */
export const PAPER_TWIPS: Record<Paper, { w: number; h: number }> = {
  A4: { w: 11906, h: 16838 },
  F4: { w: 12189, h: 18709 },
  Letter: { w: 12240, h: 15840 },
};

export const FONTS = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Book Antiqua'];

const BASE: ThesisRules = {
  paper: 'A4',
  margin: { top: 4, bottom: 3, left: 4, right: 3 },
  font: 'Times New Roman',
  size: 12,
  line: 2,
  indent: 1.25,
  after: 0,
  justify: true,
  chapter: { size: 14, bold: true, caps: true, center: true, newPage: true },
  sub: { size: 12, bold: true },
  caption: { center: true },
  pageNum: { front: 'lowerRoman', pos: 'bottom-center' },
};

export const PRESETS = {
  /** Paling umum di pedoman skripsi Indonesia. */
  umum: BASE,
  spasi15: { ...BASE, line: 1.5 },
  margin3: {
    ...BASE,
    margin: { top: 3, bottom: 3, left: 4, right: 3 },
    line: 1.5,
    chapter: { ...BASE.chapter, size: 12 },
    pageNum: { ...BASE.pageNum, pos: 'top-right' },
  },
} satisfies Record<string, ThesisRules>;
export type PresetId = keyof typeof PRESETS;

export function cloneRules(r: ThesisRules): ThesisRules {
  return JSON.parse(JSON.stringify(r)) as ThesisRules;
}

const num = (v: unknown, min: number, max: number, def: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const pick = <T extends string>(v: unknown, ok: readonly T[], def: T): T =>
  ok.includes(v as T) ? (v as T) : def;

/** Bersihkan aturan dari luar (link, localStorage) agar selalu lengkap dan masuk akal. */
export function normalizeRules(raw: unknown): ThesisRules {
  const r = (raw ?? {}) as Partial<ThesisRules> & Record<string, never>;
  const m = (r.margin ?? {}) as Partial<ThesisRules['margin']>;
  const c = (r.chapter ?? {}) as Partial<ThesisRules['chapter']>;
  const s = (r.sub ?? {}) as Partial<ThesisRules['sub']>;
  const p = (r.pageNum ?? {}) as Partial<ThesisRules['pageNum']>;
  const font = typeof r.font === 'string' && r.font.trim() ? r.font.trim().slice(0, 60) : BASE.font;
  return {
    paper: pick(r.paper, ['A4', 'F4', 'Letter'] as const, BASE.paper),
    margin: {
      top: num(m.top, 0.5, 8, BASE.margin.top),
      bottom: num(m.bottom, 0.5, 8, BASE.margin.bottom),
      left: num(m.left, 0.5, 8, BASE.margin.left),
      right: num(m.right, 0.5, 8, BASE.margin.right),
    },
    font,
    size: num(r.size, 8, 20, BASE.size),
    line: num(r.line, 1, 3, BASE.line),
    indent: num(r.indent, 0, 5, BASE.indent),
    after: num(r.after, 0, 30, BASE.after),
    justify: bool(r.justify, BASE.justify),
    chapter: {
      size: num(c.size, 8, 24, BASE.chapter.size),
      bold: bool(c.bold, true),
      caps: bool(c.caps, true),
      center: bool(c.center, true),
      newPage: bool(c.newPage, true),
    },
    sub: { size: num(s.size, 8, 20, BASE.sub.size), bold: bool(s.bold, true) },
    caption: { center: bool((r.caption as { center?: unknown } | undefined)?.center, true) },
    pageNum: {
      front: pick(p.front, ['lowerRoman', 'upperRoman'] as const, 'lowerRoman'),
      pos: pick(p.pos, ['bottom-center', 'bottom-right', 'top-right'] as const, 'bottom-center'),
    },
  };
}

/** Aturan ke potongan URL (base64url dari JSON), dan sebaliknya. */
export function encodeRules(r: ThesisRules): string {
  const bytes = new TextEncoder().encode(JSON.stringify(r));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeRules(s: string): ThesisRules | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return normalizeRules(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

/** Satuan Word: twip = 1/20 pt, 1 cm = 567 twip. */
export const cmToTw = (cm: number) => Math.round(cm * 566.929);
export const twToCm = (tw: number) => tw / 566.929;
