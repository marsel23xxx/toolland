/**
 * Periksa model docx terhadap aturan pedoman. Setiap paragraf diberi jenis (judul BAB, judul
 * halaman depan, subjudul, isi, daftar, keterangan tabel/gambar, daftar pustaka, sel tabel),
 * lalu dicek sesuai jenisnya. Masalah yang sama (kode + nilai seharusnya + nilai sekarang)
 * digabung menjadi satu baris dengan daftar lokasinya, supaya tidak muncul ratusan baris.
 */
import type { DocxModel, Para, Section } from './docx-read';
import { PAPER_TWIPS, twToCm, type Paper, type ThesisRules } from './rules';

export type Kind =
  | 'chapter'
  | 'chapterTitle'
  | 'frontTitle'
  | 'sub'
  | 'caption'
  | 'body'
  | 'list'
  | 'ref'
  | 'cell'
  /** Teks bagian awal (sampul, kata pengantar, abstrak): hanya jenis font yang dicek. */
  | 'front'
  | 'other';

export interface Block {
  p: Para;
  kind: Kind;
  /** 0 = bagian awal, n = BAB n, -1 = daftar pustaka/lampiran. */
  chapter: number;
}

export type Group = 'page' | 'pagenum' | 'heading' | 'body' | 'caption';

export type IssueCode =
  | 'paper'
  | 'margin'
  | 'pagenumMissing'
  | 'pagenumSplit'
  | 'pagenumFront'
  | 'pagenumMain'
  | 'pagenumPos'
  | 'font'
  | 'size'
  | 'line'
  | 'before'
  | 'after'
  | 'indent'
  | 'align'
  | 'headSize'
  | 'headBold'
  | 'headCaps'
  | 'headCenter'
  | 'chapterPage'
  | 'subSize'
  | 'subBold'
  | 'captionAlign'
  | 'captionPos'
  | 'captionNum'
  | 'captionSeq';

export interface Issue {
  code: IssueCode;
  group: Group;
  /** Bisa dibetulkan otomatis oleh tombol Rapikan. */
  fix: boolean;
  /** Isian pesan: {want}, {have}, dan lain-lain. */
  vals: Record<string, string | number>;
  /** Indeks paragraf (Para.i) tempat masalah ditemukan. */
  paras: number[];
  sections: number[];
}

export interface CheckResult {
  blocks: Block[];
  issues: Issue[];
  /** Label BAB yang terdeteksi, misalnya ["BAB I", "BAB II"]. */
  chapters: string[];
  hasRefs: boolean;
  bodyCount: number;
  /** Jumlah section dokumen. */
  sections: number;
}

const GROUP: Record<IssueCode, Group> = {
  paper: 'page',
  margin: 'page',
  pagenumMissing: 'pagenum',
  pagenumSplit: 'pagenum',
  pagenumFront: 'pagenum',
  pagenumMain: 'pagenum',
  pagenumPos: 'pagenum',
  font: 'body',
  size: 'body',
  line: 'body',
  before: 'body',
  after: 'body',
  indent: 'body',
  align: 'body',
  headSize: 'heading',
  headBold: 'heading',
  headCaps: 'heading',
  headCenter: 'heading',
  chapterPage: 'heading',
  subSize: 'heading',
  subBold: 'heading',
  captionAlign: 'caption',
  captionPos: 'caption',
  captionNum: 'caption',
  captionSeq: 'caption',
};
const MANUAL = new Set<IssueCode>(['captionPos', 'captionNum', 'captionSeq']);

export const CHAPTER_RE = /^(?:BAB|CHAPTER)\s+([IVXLC]+|\d+)\b/i;
/** Baris daftar isi yang diketik manual: "BAB I PENDAHULUAN ........ 1". */
const TOC_LINE = /(\.{3,}|…+|\t)\s*([ivxlcdm]+|\d+)\s*$/i;
const SUB_NUM = /^\d+(\.\d+)+\.?\s+\S/;
const SUB_LET = /^[A-H]\.\s+\S/;
const CAPTION_RE = /^(Tabel|Gambar|Grafik|Diagram|Bagan|Table|Figure)\s+(\d+)(?:\.(\d+))?\b/i;
const REFS = ['DAFTAR PUSTAKA', 'DAFTAR REFERENSI', 'REFERENSI', 'BIBLIOGRAFI', 'REFERENCES'];
const FRONT = new Set([
  'HALAMAN JUDUL',
  'HALAMAN SAMPUL',
  'LEMBAR PENGESAHAN',
  'HALAMAN PENGESAHAN',
  'LEMBAR PERSETUJUAN',
  'HALAMAN PERSETUJUAN',
  'PERSETUJUAN PEMBIMBING',
  'PERNYATAAN',
  'SURAT PERNYATAAN',
  'PERNYATAAN KEASLIAN',
  'PERNYATAAN ORISINALITAS',
  'HALAMAN PERNYATAAN',
  'PERSEMBAHAN',
  'HALAMAN PERSEMBAHAN',
  'MOTTO',
  'MOTO',
  'MOTTO DAN PERSEMBAHAN',
  'KATA PENGANTAR',
  'PRAKATA',
  'UCAPAN TERIMA KASIH',
  'ABSTRAK',
  'ABSTRACT',
  'INTISARI',
  'RINGKASAN',
  'DAFTAR ISI',
  'DAFTAR TABEL',
  'DAFTAR GAMBAR',
  'DAFTAR GRAFIK',
  'DAFTAR LAMPIRAN',
  'DAFTAR SINGKATAN',
  'DAFTAR ISTILAH',
  'DAFTAR SIMBOL',
  'DAFTAR LAMBANG DAN SINGKATAN',
  ...REFS,
]);

const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toUpperCase().replace(/[:.]$/, '');

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
export function chapterNumber(label: string): number {
  if (/^\d+$/.test(label)) return Number(label);
  let n = 0;
  const s = label.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]] ?? 0;
    n += v < (ROMAN[s[i + 1]] ?? 0) ? -v : v;
  }
  return n;
}

/** Run yang berisi teks (bukan hanya spasi), dengan bobot jumlah karakter. */
const textRuns = (p: Para) => p.runs.filter((r) => r.text.trim());
function share(p: Para, test: (r: Para['runs'][number]) => boolean): number {
  const runs = textRuns(p);
  const total = runs.reduce((a, r) => a + r.text.length, 0);
  return total ? runs.filter(test).reduce((a, r) => a + r.text.length, 0) / total : 1;
}
const sameFont = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const r2 = (n: number) => Math.round(n * 100) / 100;

export function classify(model: DocxModel): Block[] {
  const blocks: Block[] = [];
  let region: 'front' | 'main' | 'end' = 'front';
  let chapter = 0;
  let expectTitle = false;
  for (const p of model.paras) {
    const t = p.text.trim();
    const n = norm(t);
    let kind: Kind = 'other';
    if (p.inToc || !t) {
      blocks.push({ p, kind: 'other', chapter: region === 'end' ? -1 : chapter });
      continue;
    }
    // Daftar isi yang diketik manual: bukan judul BAB, cukup dicek fontnya.
    if (!p.inTable && TOC_LINE.test(t)) {
      blocks.push({ p, kind: 'front', chapter: region === 'end' ? -1 : chapter });
      continue;
    }
    const ch = !p.inTable ? CHAPTER_RE.exec(t) : null;
    if (ch && t.length < 120) {
      region = 'main';
      chapter = chapterNumber(ch[1]);
      kind = 'chapter';
      // "BAB I" saja: judulnya di paragraf berikutnya.
      expectTitle = t.replace(CHAPTER_RE, '').trim().length === 0;
    } else if (expectTitle && !p.inTable) {
      expectTitle = false;
      kind = t.length < 120 ? 'chapterTitle' : 'body';
    } else if (
      region !== 'front' &&
      !p.inTable &&
      (REFS.includes(n) || (/^LAMPIRAN\b/.test(n) && t.length < 60))
    ) {
      region = 'end';
      kind = 'frontTitle';
    } else if (region === 'front' && !p.inTable && FRONT.has(n)) {
      kind = 'frontTitle';
    } else if (p.inTable) {
      kind = CAPTION_RE.test(t) ? 'caption' : 'cell';
    } else if (CAPTION_RE.test(t) && t.length < 250) {
      kind = 'caption';
    } else if (region === 'main') {
      const bold = share(p, (r) => r.bold) >= 0.6;
      const headingLike = t.length < 150 && !/[.;,:]$/.test(t);
      const isSub =
        (p.style.startsWith('heading') && p.style !== 'heading 1') ||
        (p.outline !== null && p.outline >= 1 && p.outline < 9) ||
        (headingLike &&
          (SUB_NUM.test(t) || ((SUB_LET.test(t) || p.numbered) && bold && t.length < 100)));
      kind = isSub ? 'sub' : p.hasDrawing && t.length < 5 ? 'other' : p.numbered ? 'list' : 'body';
    } else if (region === 'end') {
      kind = 'ref';
    } else if (region === 'front') {
      kind = 'front';
    }
    blocks.push({ p, kind, chapter: region === 'end' ? -1 : chapter });
  }
  return blocks;
}

function paperName(w: number, h: number): string | null {
  const [a, b] = [Math.min(w, h), Math.max(w, h)];
  for (const [name, s] of Object.entries(PAPER_TWIPS))
    if (Math.abs(s.w - a) < 40 && Math.abs(s.h - b) < 40) return name;
  return null;
}

const posOf = (s: Section) => (s.page ? `${s.page.where}-${s.page.jc}` : '');
const WANT_POS: Record<ThesisRules['pageNum']['pos'], string> = {
  'bottom-center': 'footer-center',
  'bottom-right': 'footer-right',
  'top-right': 'header-right',
};

/** Elemen saudara terdekat yang bukan paragraf kosong. */
function neighbour(el: Element, dir: 'prev' | 'next'): Element | null {
  let cur = dir === 'prev' ? el.previousElementSibling : el.nextElementSibling;
  while (cur) {
    const empty =
      cur.localName === 'p' &&
      !(cur.textContent ?? '').trim() &&
      !cur.getElementsByTagNameNS(cur.namespaceURI, 'drawing').length &&
      !cur.getElementsByTagNameNS(cur.namespaceURI, 'pict').length;
    if (!empty && cur.localName !== 'bookmarkStart' && cur.localName !== 'bookmarkEnd') return cur;
    cur = dir === 'prev' ? cur.previousElementSibling : cur.nextElementSibling;
  }
  return null;
}
const hasPicture = (el: Element | null) =>
  !!el &&
  (el.getElementsByTagNameNS(el.namespaceURI, 'drawing').length > 0 ||
    el.getElementsByTagNameNS(el.namespaceURI, 'pict').length > 0);

export function checkDocx(model: DocxModel, rules: ThesisRules): CheckResult {
  const blocks = classify(model);
  const found = new Map<string, Issue>();
  const add = (code: IssueCode, vals: Issue['vals'], at: { para?: number; section?: number }) => {
    const key = `${code}|${JSON.stringify(vals)}`;
    let issue = found.get(key);
    if (!issue) {
      issue = { code, group: GROUP[code], fix: !MANUAL.has(code), vals, paras: [], sections: [] };
      found.set(key, issue);
    }
    if (at.para !== undefined) issue.paras.push(at.para);
    if (at.section !== undefined) issue.sections.push(at.section);
  };

  // --- Kertas dan margin per section ---------------------------------------------------------
  const paper = PAPER_TWIPS[rules.paper as Paper];
  model.sections.forEach((s, i) => {
    const [a, b] = [Math.min(s.w, s.h), Math.max(s.w, s.h)];
    if (Math.abs(a - paper.w) > 40 || Math.abs(b - paper.h) > 40)
      add(
        'paper',
        {
          want: rules.paper,
          have: paperName(s.w, s.h) ?? `${r2(twToCm(a))} × ${r2(twToCm(b))} cm`,
        },
        { section: i },
      );
    if (s.landscape) return;
    const m = s.margin;
    const want = rules.margin;
    const sides = (['top', 'bottom', 'left', 'right'] as const).filter(
      (k) => Math.abs(twToCm(m[k]) - want[k]) > 0.05,
    );
    if (sides.length)
      add(
        'margin',
        {
          top: r2(twToCm(m.top)),
          bottom: r2(twToCm(m.bottom)),
          left: r2(twToCm(m.left)),
          right: r2(twToCm(m.right)),
        },
        { section: i },
      );
  });

  // --- Nomor halaman -------------------------------------------------------------------------
  const first = blocks.find((b) => b.kind === 'chapter');
  if (!model.sections.some((s) => s.page)) {
    add('pagenumMissing', {}, { section: 0 });
  } else {
    model.sections.forEach((s, i) => {
      if (s.page && posOf(s) !== WANT_POS[rules.pageNum.pos])
        add('pagenumPos', { have: posOf(s) }, { section: i });
    });
    if (first) {
      const sec = first.p.section;
      const frontSameSection = blocks.some(
        (b) => b.p.i < first.p.i && b.p.section === sec && b.p.text.trim(),
      );
      const hasFront = blocks.some((b) => b.p.i < first.p.i && b.p.text.trim());
      if (frontSameSection) add('pagenumSplit', {}, { para: first.p.i });
      else {
        const main = model.sections[sec];
        if (main.fmt !== 'decimal' || main.start !== 1)
          add('pagenumMain', { have: main.fmt }, { section: sec });
      }
      if (hasFront && !frontSameSection)
        for (let i = 0; i < sec; i++) {
          const hasText = blocks.some((b) => b.p.section === i && b.p.text.trim());
          if (hasText && model.sections[i].fmt !== rules.pageNum.front)
            add('pagenumFront', { have: model.sections[i].fmt }, { section: i });
        }
    }
  }

  // --- Paragraf ------------------------------------------------------------------------------
  const captionSeq = new Map<string, number>();
  for (const b of blocks) {
    const { p, kind } = b;
    if (kind === 'other') continue;
    const runs = textRuns(p);
    const at = { para: p.i };
    const wrongFonts = uniq(runs.filter((r) => !sameFont(r.font, rules.font)).map((r) => r.font));
    if (wrongFonts.length)
      add('font', { want: rules.font, have: wrongFonts.slice(0, 3).join(', ') }, at);
    if (kind === 'cell' || kind === 'front') continue;

    const checkSize = (want: number, code: 'size' | 'headSize' | 'subSize') => {
      const wrong = uniq(runs.filter((r) => Math.abs(r.size - want) > 0.25).map((r) => r.size));
      if (wrong.length) add(code, { want, have: wrong.sort((x, y) => x - y).join(', ') }, at);
    };

    if (kind === 'body' || kind === 'list' || kind === 'ref') {
      checkSize(rules.size, 'size');
      if (kind === 'ref') continue;
      if (p.line.rule !== 'auto') add('line', { want: rules.line, have: `${p.line.val} pt` }, at);
      else if (Math.abs(p.line.val - rules.line) > 0.06)
        add('line', { want: rules.line, have: p.line.val }, at);
      if (kind === 'list') continue;
      if (Math.abs(p.after - rules.after) > 1)
        add('after', { want: rules.after, have: p.after }, at);
      if (p.before > 1) add('before', { want: 0, have: p.before }, at);
      const long = p.text.trim().length >= 40;
      if (long && Math.abs(p.firstLine - rules.indent) > 0.1)
        add('indent', { want: rules.indent, have: r2(p.firstLine) }, at);
      if (long && rules.justify && p.jc !== 'both') add('align', { have: p.jc }, at);
      continue;
    }

    if (kind === 'chapter' || kind === 'chapterTitle' || kind === 'frontTitle') {
      const c = rules.chapter;
      checkSize(c.size, 'headSize');
      if (c.bold && share(p, (r) => r.bold) < 0.5) add('headBold', {}, at);
      if (c.caps && /[a-z]/.test(p.text) && share(p, (r) => r.caps) < 0.99) add('headCaps', {}, at);
      if (c.center && p.jc !== 'center') add('headCenter', { have: p.jc }, at);
      if (kind === 'chapter' && c.newPage && !p.pageBreakBefore && !p.afterBreak && p.i > 0)
        add('chapterPage', {}, at);
      continue;
    }

    if (kind === 'sub') {
      checkSize(rules.sub.size, 'subSize');
      if (rules.sub.bold && share(p, (r) => r.bold) < 0.5) add('subBold', {}, at);
      continue;
    }

    if (kind === 'caption') {
      const m = CAPTION_RE.exec(p.text.trim())!;
      const type = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      if (rules.caption.center && p.jc !== 'center') add('captionAlign', { have: p.jc }, at);
      // Penomoran: Tabel 2.3 harus di BAB II dan berurutan di dalam BAB.
      if (m[3] !== undefined && b.chapter > 0) {
        const major = Number(m[2]);
        const minor = Number(m[3]);
        if (major !== b.chapter)
          add('captionNum', { label: `${type} ${major}.${minor}`, want: b.chapter }, at);
        else {
          const key = `${type.toLowerCase()}|${major}`;
          const prev = captionSeq.get(key) ?? 0;
          if (minor !== prev + 1)
            add(
              'captionSeq',
              { label: `${type} ${major}.${minor}`, want: `${type} ${major}.${prev + 1}` },
              at,
            );
          captionSeq.set(key, minor);
        }
      }
      if (p.top) {
        const prev = neighbour(p.el, 'prev');
        const next = neighbour(p.el, 'next');
        const isTable = /^(tabel|table)$/i.test(type);
        const isFigure = /^(gambar|grafik|diagram|bagan|figure)$/i.test(type);
        if (isTable && prev?.localName === 'tbl' && next?.localName !== 'tbl')
          add('captionPos', { kind: 'table' }, at);
        if (isFigure && hasPicture(next) && !hasPicture(prev))
          add('captionPos', { kind: 'figure' }, at);
      }
    }
  }

  const ORDER = Object.keys(GROUP) as IssueCode[];
  const issues = [...found.values()].sort(
    (a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code) || b.paras.length - a.paras.length,
  );
  return {
    blocks,
    issues,
    chapters: blocks
      .filter((b) => b.kind === 'chapter')
      .map((b) => CHAPTER_RE.exec(b.p.text.trim())![0].toUpperCase().replace(/\s+/, ' ')),
    hasRefs: blocks.some((b) => b.kind === 'ref' || (b.kind === 'frontTitle' && b.chapter === -1)),
    bodyCount: blocks.filter((b) => b.kind === 'body').length,
    sections: model.sections.length,
  };
}
