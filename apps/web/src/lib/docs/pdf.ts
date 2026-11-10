/**
 * Render DocSpec ke PDF dengan pdf-lib dan font standar PDF (Helvetica atau Times). Teks tetap
 * berupa teks sungguhan (bisa dipilih, dicari, dan dibaca sistem ATS), tanpa file font tambahan.
 */
import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { A4, DEFAULT_LEAD, type Block, type DocSpec, type Run } from './model';

const FONT_FILES = {
  sans: [
    StandardFonts.Helvetica,
    StandardFonts.HelveticaBold,
    StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBoldOblique,
  ],
  serif: [
    StandardFonts.TimesRoman,
    StandardFonts.TimesRomanBold,
    StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBoldItalic,
  ],
} as const;

interface Fonts {
  pick(b?: boolean, i?: boolean): PDFFont;
  clean(text: string): string;
}

export function hexColor(hex: string) {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const SUBSTITUTE: Record<string, string> = {
  '‐': '-',
  '‑': '-',
  '−': '-',
  '→': '->',
  '←': '<-',
  '≤': '<=',
  '≥': '>=',
  '★': '*',
  '·': '·',
};

/** Ganti karakter yang tidak ada di encoding font standar (WinAnsi) dengan padanan terdekat. */
function makeCleaner(charset: Set<number>) {
  return (text: string) => {
    let out = '';
    for (const ch of text.normalize('NFC').replace(/\t/g, ' ')) {
      const code = ch.codePointAt(0)!;
      if (ch === '\n' || charset.has(code)) {
        out += ch;
        continue;
      }
      if (SUBSTITUTE[ch]) {
        out += SUBSTITUTE[ch];
        continue;
      }
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += base && [...base].every((c) => charset.has(c.codePointAt(0)!)) ? base : '?';
    }
    return out;
  };
}

// --- Pemecahan baris -------------------------------------------------------------------------

const widthCache = new WeakMap<PDFFont, Map<string, number>>();
/**
 * Lebar teks tanpa kerning. widthOfTextAtSize() pdf-lib ikut menghitung kerning, padahal drawText
 * tidak menerapkannya, sehingga kata berikutnya akan mulai terlalu dekat.
 */
export function measure(font: PDFFont, text: string, size: number): number {
  let cache = widthCache.get(font);
  if (!cache) widthCache.set(font, (cache = new Map()));
  let w = 0;
  for (const ch of text) {
    let cw = cache.get(ch);
    if (cw === undefined) cache.set(ch, (cw = font.widthOfTextAtSize(ch, 1000)));
    w += cw;
  }
  return (w * size) / 1000;
}

interface Seg {
  text: string;
  font: PDFFont;
  size: number;
  color: string;
  href?: string;
  w: number;
}
/** Satu kata: potongan berurutan tanpa spasi di antaranya (bisa beda gaya, misalnya "kata,"). */
interface Word {
  segs: Seg[];
  w: number;
  /** Lebar spasi setelah kata ini. */
  space: number;
  br?: boolean;
}
interface Line {
  words: Word[];
  w: number;
  /** Baris terakhir paragraf atau sebelum baris baru paksa: tidak diratakan kanan-kiri. */
  last: boolean;
}

function toWords(runs: Run[], fonts: Fonts, size: number, color: string): Word[] {
  const words: Word[] = [];
  let cur: Word | null = null;
  for (const r of runs) {
    const font = fonts.pick(r.b, r.i);
    const text = fonts.clean(r.text);
    for (const part of text.split(/(\n|[ \u00a0]+)/)) {
      if (!part) continue;
      if (part === '\n') {
        if (cur) words.push(cur);
        words.push({ segs: [], w: 0, space: 0, br: true });
        cur = null;
      } else if (/^[ \u00a0]+$/.test(part)) {
        if (cur) {
          cur.space = measure(font, ' ', size);
          words.push(cur);
          cur = null;
        }
      } else {
        const seg: Seg = {
          text: part,
          font,
          size,
          color: r.color ?? color,
          href: r.href,
          w: measure(font, part, size),
        };
        cur ??= { segs: [], w: 0, space: 0 };
        cur.segs.push(seg);
        cur.w += seg.w;
      }
    }
  }
  if (cur) words.push(cur);
  return words;
}

/** Potong kata yang lebih lebar dari baris (misalnya URL panjang) per karakter. */
function splitLong(word: Word, max: number): Word[] {
  const out: Word[] = [];
  let cur: Word = { segs: [], w: 0, space: 0 };
  for (const seg of word.segs)
    for (const ch of seg.text) {
      const w = measure(seg.font, ch, seg.size);
      if (cur.w + w > max && cur.w > 0) {
        out.push(cur);
        cur = { segs: [], w: 0, space: 0 };
      }
      const last = cur.segs.at(-1);
      if (last && last.font === seg.font && last.color === seg.color && last.href === seg.href) {
        last.text += ch;
        last.w += w;
      } else cur.segs.push({ ...seg, text: ch, w });
      cur.w += w;
    }
  cur.space = word.space;
  out.push(cur);
  return out;
}

export function wrapWords(words: Word[], max: number): Line[] {
  const lines: Line[] = [];
  let line: Line = { words: [], w: 0, last: false };
  const flush = (last: boolean) => {
    line.last = last;
    lines.push(line);
    line = { words: [], w: 0, last: false };
  };
  for (const word of words) {
    if (word.br) {
      flush(true);
      continue;
    }
    for (const piece of word.w > max ? splitLong(word, max) : [word]) {
      const prev = line.words.at(-1);
      const add = (prev ? prev.space : 0) + piece.w;
      if (line.words.length && line.w + add > max + 0.01) flush(false);
      line.w += line.words.length ? line.words.at(-1)!.space + piece.w : piece.w;
      line.words.push(piece);
    }
  }
  if (line.words.length || !lines.length) flush(true);
  else if (lines.length) lines.at(-1)!.last = true;
  return lines;
}

// --- Tata letak ------------------------------------------------------------------------------

type Op = (page: PDFPage, ctx: { doc: PDFDocument }) => void;

interface Column {
  x: number;
  w: number;
  top: number;
  bottom: number;
  color: string;
}

class Flow {
  page = 0;
  y: number;
  readonly ops: { page: number; op: Op }[] = [];
  constructor(
    readonly col: Column,
    readonly fonts: Fonts,
    readonly images: Map<Uint8Array, PDFImage>,
    readonly base: number,
  ) {
    this.y = col.top;
  }

  /** Pindah halaman bila sisa tempat kurang dari h (kecuali sudah di awal halaman). */
  need(h: number) {
    if (this.y - h < this.col.bottom && this.y < this.col.top) {
      this.page++;
      this.y = this.col.top;
    }
  }

  draw(op: Op) {
    this.ops.push({ page: this.page, op });
  }

  space(pt = 0) {
    if (this.y < this.col.top) this.y -= pt;
  }

  /** Gambar baris-baris teks mulai x, lebar w. */
  lines(lines: Line[], x: number, w: number, size: number, lead: number, align: string) {
    const lh = size * lead;
    for (const line of lines) {
      this.need(lh);
      const baseline = this.y - (lh - size) / 2 - size * 0.8;
      const gaps = line.words.length - 1;
      const justify = align === 'justify' && !line.last && gaps > 0;
      const extra = justify ? (w - line.w) / gaps : 0;
      let cx = align === 'center' ? x + (w - line.w) / 2 : align === 'right' ? x + w - line.w : x;
      for (const word of line.words) {
        for (const seg of word.segs) {
          const sx = cx;
          this.draw((page) => {
            page.drawText(seg.text, {
              x: sx,
              y: baseline,
              size: seg.size,
              font: seg.font,
              color: hexColor(seg.color),
            });
          });
          if (seg.href) {
            const href = seg.href;
            const rect = [sx, baseline - size * 0.25, sx + seg.w, baseline + size * 0.85];
            this.draw((page, { doc }) => addLink(doc, page, rect, href));
          }
          cx += seg.w;
        }
        cx += word.space + extra;
      }
      this.y -= lh;
    }
  }

  block(b: Block) {
    const { x, w, color } = this.col;
    const f = this.fonts;
    switch (b.t) {
      case 'gap':
        this.space(b.h);
        return;
      case 'p': {
        const size = b.size ?? this.base;
        const words = toWords(b.runs, f, size, b.color ?? color);
        if (!words.length) return;
        this.space(b.before);
        this.lines(wrapWords(words, w), x, w, size, b.lead ?? DEFAULT_LEAD, b.align ?? 'left');
        this.space(b.after);
        return;
      }
      case 'h': {
        const size = b.size ?? this.base * 1.15;
        const text = f.clean(b.caps ? b.text.toUpperCase() : b.text);
        if (!text.trim()) return;
        const font = f.pick(true);
        const track = b.track ?? 0;
        const lh = size * 1.25;
        this.space(b.before);
        // Judul tidak boleh sendirian di bawah halaman: sisakan tempat untuk dua baris isi.
        this.need(lh + (b.rule ? 6 : 0) + this.base * DEFAULT_LEAD * 2);
        const baseline = this.y - (lh - size) / 2 - size * 0.8;
        const hc = b.color ?? color;
        this.draw((page) => {
          if (track) page.pushOperators(setCharacterSpacing(track));
          page.drawText(text, { x, y: baseline, size, font, color: hexColor(hc) });
          if (track) page.pushOperators(setCharacterSpacing(0));
        });
        this.y -= lh;
        if (b.rule) {
          const ry = this.y - 2;
          const rc = b.rule;
          this.draw((page) =>
            page.drawLine({
              start: { x, y: ry },
              end: { x: x + w, y: ry },
              thickness: 0.75,
              color: hexColor(rc),
            }),
          );
          this.y -= 5;
        }
        this.space(b.after);
        return;
      }
      case 'list': {
        const size = b.size ?? this.base;
        const items = b.items.filter((it) => it.some((r) => r.text.trim()));
        if (!items.length) return;
        this.space(b.before);
        const indent = size * (b.numbered ? 1.5 : 1.1);
        items.forEach((it, n) => {
          const lines = wrapWords(toWords(it, f, size, b.color ?? color), w - indent);
          const lh = size * DEFAULT_LEAD;
          this.need(lh);
          const mark = b.numbered ? `${n + 1}.` : '•';
          const baseline = this.y - (lh - size) / 2 - size * 0.8;
          const mc = b.color ?? color;
          this.draw((page) =>
            page.drawText(mark, {
              x,
              y: baseline,
              size,
              font: f.pick(),
              color: hexColor(mc),
            }),
          );
          this.lines(lines, x + indent, w - indent, size, DEFAULT_LEAD, 'left');
          if (n < items.length - 1) this.y -= size * 0.15;
        });
        this.space(b.after);
        return;
      }
      case 'row': {
        const size = b.size ?? this.base;
        const c = b.color ?? color;
        const right = toWords(b.right, f, size, c);
        const rw = right.reduce((s, x, i) => s + x.w + (i < right.length - 1 ? x.space : 0), 0);
        const left = toWords(b.left, f, size, c);
        if (!left.length && !right.length) return;
        this.space(b.before);
        const lh = size * DEFAULT_LEAD;
        this.need(lh);
        const top = this.y;
        const startPage = this.page;
        if (right.length)
          this.lines(wrapWords(right, rw + 1), x + w - rw, rw, size, DEFAULT_LEAD, 'left');
        const afterRight = this.y;
        if (left.length) {
          this.y = top;
          this.page = startPage;
          const lw = w - rw - (rw ? 10 : 0);
          this.lines(wrapWords(left, lw), x, lw, size, DEFAULT_LEAD, 'left');
          if (this.page === startPage) this.y = Math.min(this.y, afterRight);
        }
        this.space(b.after);
        return;
      }
      case 'kv': {
        const size = b.size ?? this.base;
        const rows = b.rows.filter(([, v]) => v.trim());
        if (!rows.length) return;
        this.space(b.before);
        const colon = measure(f.pick(), ': ', size);
        for (const [label, value] of rows) {
          const lh = size * DEFAULT_LEAD;
          this.need(lh);
          const top = this.y;
          const page = this.page;
          this.lines(
            wrapWords(toWords([{ text: label }], f, size, color), b.label - 4),
            x,
            b.label - 4,
            size,
            DEFAULT_LEAD,
            'left',
          );
          const after = this.y;
          this.y = top;
          this.page = page;
          this.lines(
            wrapWords(toWords([{ text: ':' }], f, size, color), colon),
            x + b.label,
            colon,
            size,
            DEFAULT_LEAD,
            'left',
          );
          this.y = top;
          this.lines(
            wrapWords(toWords([{ text: value }], f, size, color), w - b.label - colon),
            x + b.label + colon,
            w - b.label - colon,
            size,
            DEFAULT_LEAD,
            'left',
          );
          if (this.page === page) this.y = Math.min(this.y, after);
        }
        this.space(b.after);
        return;
      }
      case 'rule': {
        this.space(b.before);
        this.need(4);
        const ry = this.y;
        const rc = b.color ?? 'cccccc';
        const weight = b.weight ?? 0.75;
        this.draw((page) =>
          page.drawLine({
            start: { x, y: ry },
            end: { x: x + w, y: ry },
            thickness: weight,
            color: hexColor(rc),
          }),
        );
        this.y -= weight;
        this.space(b.after);
        return;
      }
      case 'img': {
        const img = this.images.get(b.data);
        if (!img) return;
        this.space(b.before);
        this.need(b.h);
        const ix = b.align === 'center' ? x + (w - b.w) / 2 : b.align === 'right' ? x + w - b.w : x;
        const iy = this.y - b.h;
        this.draw((page) => page.drawImage(img, { x: ix, y: iy, width: b.w, height: b.h }));
        this.y -= b.h;
        this.space(b.after);
        return;
      }
    }
  }
}

function addLink(doc: PDFDocument, page: PDFPage, rect: number[], href: string) {
  const annot = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rect,
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(href) },
  });
  const ref = doc.context.register(annot);
  const annots = page.node.lookup(PDFName.of('Annots'));
  if (annots && 'push' in annots) (annots as { push(x: unknown): void }).push(ref);
  else page.node.set(PDFName.of('Annots'), doc.context.obj([ref]));
}

function allBlocks(spec: DocSpec): Block[] {
  return [...spec.main, ...(spec.side?.blocks ?? [])];
}

/** Buat PDF dari DocSpec. Mengembalikan byte PDF dan jumlah halaman. */
export async function renderPdf(spec: DocSpec): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  const files = FONT_FILES[spec.font];
  const [r, b, i, bi] = await Promise.all(files.map((x) => doc.embedFont(x)));
  const charset = new Set(r.getCharacterSet());
  const fonts: Fonts = {
    pick: (bold, italic) => (bold ? (italic ? bi : b) : italic ? i : r),
    clean: makeCleaner(charset),
  };
  const images = new Map<Uint8Array, PDFImage>();
  for (const blk of allBlocks(spec))
    if (blk.t === 'img' && !images.has(blk.data))
      images.set(
        blk.data,
        blk.type === 'png' ? await doc.embedPng(blk.data) : await doc.embedJpg(blk.data),
      );

  const m = spec.margin;
  const top = A4.h - m;
  const bottom = m;
  const flows: Flow[] = [];
  if (spec.side) {
    const pad = Math.min(m, 28);
    flows.push(
      new Flow(
        { x: pad, w: spec.side.width - pad * 2, top, bottom, color: spec.side.color },
        fonts,
        images,
        spec.size,
      ),
    );
    flows.push(
      new Flow(
        {
          x: spec.side.width + pad,
          w: A4.w - spec.side.width - pad - m,
          top,
          bottom,
          color: spec.color,
        },
        fonts,
        images,
        spec.size,
      ),
    );
    for (const blk of spec.side.blocks) flows[0].block(blk);
    for (const blk of spec.main) flows[1].block(blk);
  } else {
    flows.push(
      new Flow({ x: m, w: A4.w - m * 2, top, bottom, color: spec.color }, fonts, images, spec.size),
    );
    for (const blk of spec.main) flows[0].block(blk);
  }

  const count = Math.max(...flows.map((f) => f.page)) + 1;
  const pages = Array.from({ length: count }, () => doc.addPage([A4.w, A4.h]));
  if (spec.side) {
    const bg = hexColor(spec.side.bg);
    for (const p of pages)
      p.drawRectangle({ x: 0, y: 0, width: spec.side.width, height: A4.h, color: bg });
  }
  for (const f of flows) for (const { page, op } of f.ops) op(pages[page], { doc });

  doc.setTitle(spec.title);
  doc.setAuthor(spec.author);
  doc.setLanguage(spec.lang === 'id' ? 'id-ID' : 'en-US');
  doc.setCreator('Toolland');
  doc.setProducer('Toolland (pdf-lib)');
  return { bytes: await doc.save(), pages: count };
}
