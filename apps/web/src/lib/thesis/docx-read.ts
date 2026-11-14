/**
 * Baca .docx untuk Cek Format Skripsi: setiap paragraf dengan format yang sudah "jadi" (format
 * langsung → style karakter → style paragraf berantai basedOn → docDefaults → font tema), setiap
 * section (kertas, margin, format nomor halaman), dan letak field PAGE di header/footer.
 * Elemen DOM ikut disimpan supaya fix.ts bisa mengubah dokumen yang sama.
 */
import { strFromU8, unzipSync } from 'fflate';

export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

export type Jc = 'left' | 'center' | 'right' | 'both';

export interface Run {
  text: string;
  font: string;
  size: number;
  bold: boolean;
  caps: boolean;
}

export interface Para {
  i: number;
  el: Element;
  text: string;
  inTable: boolean;
  inToc: boolean;
  /** Paragraf langsung di badan dokumen (bukan di tabel/kotak teks). */
  top: boolean;
  section: number;
  /** Nama style huruf kecil, misalnya "normal", "heading 1", "toc 2", "caption". */
  style: string;
  outline: number | null;
  jc: Jc;
  /** Spasi baris: auto = kelipatan (1, 1.5, 2), exact/atLeast = pt. */
  line: { rule: 'auto' | 'exact' | 'atLeast'; val: number };
  before: number;
  after: number;
  /** cm; negatif = hanging. */
  firstLine: number;
  numbered: boolean;
  pageBreakBefore: boolean;
  /** Paragraf diawali halaman baru karena paragraf sebelumnya diakhiri page break. */
  afterBreak: boolean;
  hasDrawing: boolean;
  runs: Run[];
}

export interface PageField {
  where: 'header' | 'footer';
  jc: Jc;
}

export interface Section {
  el: Element;
  w: number;
  h: number;
  landscape: boolean;
  margin: { top: number; bottom: number; left: number; right: number };
  fmt: string;
  start: number | null;
  /** Field nomor halaman yang berlaku (ikut section sebelumnya bila tidak diatur). */
  page: PageField | null;
}

export interface DocxModel {
  files: Record<string, Uint8Array>;
  doc: Document;
  styles: Document | null;
  paras: Para[];
  sections: Section[];
  /** Part header/footer yang sudah di-parse: path -> dokumen. */
  parts: Map<string, Document>;
  rels: Map<string, string>;
}

// --- util XML ----------------------------------------------------------------------------------

export const kids = (el: Element | null | undefined, name?: string): Element[] =>
  el ? [...el.children].filter((c) => c.namespaceURI === W && (!name || c.localName === name)) : [];
export const kid = (el: Element | null | undefined, name: string): Element | null =>
  kids(el, name)[0] ?? null;
export const wattr = (el: Element | null | undefined, name: string): string | null =>
  el ? (el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`)) : null;

function onOff(el: Element | null): boolean | null {
  if (!el) return null;
  const v = wattr(el, 'val');
  return v === null || !['0', 'false', 'off', 'none'].includes(v);
}

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

// --- style --------------------------------------------------------------------------------------

interface Style {
  name: string;
  basedOn: string | null;
  pPr: Element | null;
  rPr: Element | null;
}

interface StyleSheet {
  byId: Map<string, Style>;
  defPara: string | null;
  pDef: Element | null;
  rDef: Element | null;
  theme: { minor: string; major: string };
}

function readStyles(styles: Document | null, theme: Document | null): StyleSheet {
  const byId = new Map<string, Style>();
  let defPara: string | null = null;
  const root = styles?.documentElement;
  for (const s of kids(root, 'style')) {
    const id = wattr(s, 'styleId');
    if (!id) continue;
    byId.set(id, {
      name: (wattr(kid(s, 'name'), 'val') ?? id).toLowerCase(),
      basedOn: wattr(kid(s, 'basedOn'), 'val'),
      pPr: kid(s, 'pPr'),
      rPr: kid(s, 'rPr'),
    });
    if (wattr(s, 'type') === 'paragraph' && ['1', 'true', 'on'].includes(wattr(s, 'default') ?? ''))
      defPara = id;
  }
  const dd = kid(root, 'docDefaults');
  const font = (kind: 'minorFont' | 'majorFont') => {
    const el = theme?.getElementsByTagNameNS(A, kind)[0];
    const latin = el ? [...el.children].find((c) => c.localName === 'latin') : undefined;
    return latin?.getAttribute('typeface') ?? '';
  };
  return {
    byId,
    defPara,
    pDef: kid(kid(dd, 'pPrDefault'), 'pPr'),
    rDef: kid(kid(dd, 'rPrDefault'), 'rPr'),
    theme: { minor: font('minorFont') || 'Calibri', major: font('majorFont') || 'Calibri Light' },
  };
}

/** Rantai style dari yang paling khusus ke paling umum. */
function chain(ss: StyleSheet, id: string | null): Style[] {
  const out: Style[] = [];
  const seen = new Set<string>();
  let cur = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const s = ss.byId.get(cur);
    if (!s) break;
    out.push(s);
    cur = s.basedOn;
  }
  return out;
}

/** Atribut pertama yang ditemukan di sepanjang rantai elemen (mis. spacing/@line). */
function firstAttr(els: (Element | null)[], child: string, attr: string): string | null {
  for (const el of els) {
    const v = wattr(kid(el, child), attr);
    if (v !== null) return v;
  }
  return null;
}
function firstOnOff(els: (Element | null)[], child: string): boolean {
  for (const el of els) {
    const v = onOff(kid(el, child));
    if (v !== null) return v;
  }
  return false;
}

function fontOf(els: (Element | null)[], ss: StyleSheet): string {
  for (const el of els) {
    const f = kid(el, 'rFonts');
    if (!f) continue;
    const theme = wattr(f, 'asciiTheme') ?? wattr(f, 'hAnsiTheme');
    if (theme) return theme.startsWith('major') ? ss.theme.major : ss.theme.minor;
    const name = wattr(f, 'ascii') ?? wattr(f, 'hAnsi');
    if (name) return name;
  }
  return ss.theme.minor;
}

// --- dokumen -----------------------------------------------------------------------------------

function runText(r: Element): string {
  let s = '';
  for (const c of kids(r)) {
    if (c.localName === 't') s += c.textContent ?? '';
    else if (c.localName === 'tab') s += '\t';
    else if (c.localName === 'br' && wattr(c, 'type') !== 'page') s += '\n';
    else if (c.localName === 'noBreakHyphen') s += '-';
    else if (c.localName === 'sym') s += '·';
  }
  return s;
}

/** Run teks di paragraf (termasuk di dalam hyperlink, smartTag, sdt, ins), tanpa yang dihapus. */
function paraRuns(p: Element): Element[] {
  const out: Element[] = [];
  const walk = (el: Element) => {
    for (const c of kids(el)) {
      if (c.localName === 'r') out.push(c);
      else if (['hyperlink', 'smartTag', 'ins', 'fldSimple', 'customXml'].includes(c.localName))
        walk(c);
      else if (c.localName === 'sdt') walk(kid(c, 'sdtContent') ?? c);
    }
  };
  walk(p);
  return out;
}

const endsWithPageBreak = (p: Element) => {
  const runs = paraRuns(p);
  for (let k = runs.length - 1; k >= 0; k--) {
    const r = runs[k];
    const items = kids(r).filter((c) => c.localName !== 'rPr');
    for (let j = items.length - 1; j >= 0; j--) {
      const c = items[j];
      if (c.localName === 'br' && wattr(c, 'type') === 'page') return true;
      if (c.localName === 't' && (c.textContent ?? '').trim()) return false;
      if (['drawing', 'pict', 'object'].includes(c.localName)) return false;
    }
  }
  return false;
};
const startsWithPageBreak = (p: Element) => {
  for (const r of paraRuns(p))
    for (const c of kids(r)) {
      if (c.localName === 'br' && wattr(c, 'type') === 'page') return true;
      if (c.localName === 't' && (c.textContent ?? '').trim()) return false;
      if (['drawing', 'pict'].includes(c.localName)) return false;
    }
  return false;
};

const JC: Record<string, Jc> = {
  both: 'both',
  distribute: 'both',
  center: 'center',
  right: 'right',
  end: 'right',
  left: 'left',
  start: 'left',
};

function readParagraph(
  p: Element,
  ss: StyleSheet,
): Omit<Para, 'i' | 'inTable' | 'inToc' | 'top' | 'section' | 'afterBreak'> {
  const pPr = kid(p, 'pPr');
  const styleId = wattr(kid(pPr, 'pStyle'), 'val') ?? ss.defPara;
  const styles = chain(ss, styleId);
  const pEls = [pPr, ...styles.map((s) => s.pPr), ss.pDef];
  const rule = firstAttr(pEls, 'spacing', 'lineRule') ?? 'auto';
  const lineRaw = Number(firstAttr(pEls, 'spacing', 'line') ?? 240);
  const fl = firstAttr(pEls, 'ind', 'firstLine');
  const hang = firstAttr(pEls, 'ind', 'hanging');
  const outline = firstAttr(pEls, 'outlineLvl', 'val');
  const runs: Run[] = [];
  let hasDrawing = false;
  for (const r of paraRuns(p)) {
    if (r.getElementsByTagNameNS(W, 'drawing').length || r.getElementsByTagNameNS(W, 'pict').length)
      hasDrawing = true;
    const text = runText(r);
    if (!text) continue;
    const rPr = kid(r, 'rPr');
    const rStyles = chain(ss, wattr(kid(rPr, 'rStyle'), 'val')).map((s) => s.rPr);
    const els = [rPr, ...rStyles, ...styles.map((s) => s.rPr), ss.rDef];
    runs.push({
      text,
      font: fontOf(els, ss),
      size: Number(firstAttr(els, 'sz', 'val') ?? 20) / 2,
      bold: firstOnOff(els, 'b'),
      caps: firstOnOff(els, 'caps'),
    });
  }
  return {
    el: p,
    text: runs.map((r) => r.text).join(''),
    style: styles[0]?.name ?? 'normal',
    outline: outline === null ? null : Number(outline),
    jc: JC[firstAttr(pEls, 'jc', 'val') ?? 'left'] ?? 'left',
    line:
      rule === 'auto'
        ? { rule: 'auto', val: Math.round((lineRaw / 240) * 100) / 100 }
        : { rule: rule === 'exact' ? 'exact' : 'atLeast', val: lineRaw / 20 },
    before: Number(firstAttr(pEls, 'spacing', 'before') ?? 0) / 20,
    after: Number(firstAttr(pEls, 'spacing', 'after') ?? 0) / 20,
    firstLine: hang !== null ? -Number(hang) / 566.929 : Number(fl ?? 0) / 566.929,
    numbered: pEls
      .slice(0, -1)
      .some((e) => kid(e, 'numPr') && wattr(kid(kid(e, 'numPr'), 'numId'), 'val') !== '0'),
    pageBreakBefore: firstOnOff(pEls, 'pageBreakBefore'),
    hasDrawing,
    runs,
  };
}

function relsOf(files: Record<string, Uint8Array>): Map<string, string> {
  const map = new Map<string, string>();
  const raw = files['word/_rels/document.xml.rels'];
  if (!raw) return map;
  for (const rel of parse(strFromU8(raw)).getElementsByTagName('Relationship')) {
    const target = rel.getAttribute('Target') ?? '';
    map.set(
      rel.getAttribute('Id') ?? '',
      target.startsWith('/') ? target.slice(1) : `word/${target}`,
    );
  }
  return map;
}

/** Cari field PAGE di part header/footer dan perataan paragrafnya. */
function pageJc(part: Document | undefined): Jc | null {
  if (!part) return null;
  for (const p of part.getElementsByTagNameNS(W, 'p')) {
    const instr = [
      ...[...p.getElementsByTagNameNS(W, 'instrText')].map((x) => x.textContent ?? ''),
      ...[...p.getElementsByTagNameNS(W, 'fldSimple')].map((x) => wattr(x, 'instr') ?? ''),
    ].join(' ');
    if (/\bPAGE\b/.test(instr)) {
      const jc = wattr(kid(kid(p, 'pPr'), 'jc'), 'val');
      // Nomor di kanan lewat tab rata kanan juga dihitung kanan.
      const tabRight = [...p.getElementsByTagNameNS(W, 'tab')].some(
        (t) => wattr(t, 'val') === 'right',
      );
      return JC[jc ?? ''] ?? (tabRight ? 'right' : 'left');
    }
  }
  return null;
}

export function readDocx(buf: ArrayBuffer | Uint8Array): DocxModel {
  const files = unzipSync(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const main = files['word/document.xml'];
  if (!main) throw new Error('bukan-docx');
  const doc = parse(strFromU8(main));
  if (doc.getElementsByTagName('parsererror').length) throw new Error('bukan-docx');
  const styles = files['word/styles.xml'] ? parse(strFromU8(files['word/styles.xml'])) : null;
  const theme = files['word/theme/theme1.xml']
    ? parse(strFromU8(files['word/theme/theme1.xml']))
    : null;
  const ss = readStyles(styles, theme);
  const rels = relsOf(files);
  const parts = new Map<string, Document>();
  const part = (id: string | null) => {
    const path = id ? rels.get(id) : undefined;
    if (!path || !files[path]) return undefined;
    if (!parts.has(path)) parts.set(path, parse(strFromU8(files[path])));
    return parts.get(path);
  };

  const body = kid(doc.documentElement, 'body');
  const paras: Para[] = [];
  const sectEls: Element[] = [];
  let prevTop: Element | null = null;
  const walk = (el: Element, inTable: boolean, inToc: boolean, top: boolean) => {
    for (const c of kids(el)) {
      if (c.localName === 'p') {
        const info = readParagraph(c, ss);
        const afterBreak =
          top && !!prevTop && (endsWithPageBreak(prevTop) || !!kid(kid(prevTop, 'pPr'), 'sectPr'));
        paras.push({
          ...info,
          i: paras.length,
          inTable,
          inToc: inToc || info.style.startsWith('toc '),
          top,
          section: sectEls.length,
          afterBreak: afterBreak || startsWithPageBreak(c),
        });
        if (top) prevTop = c;
        const sp = kid(kid(c, 'pPr'), 'sectPr');
        if (sp) sectEls.push(sp);
      } else if (c.localName === 'tbl') {
        for (const tr of kids(c, 'tr'))
          for (const tc of kids(tr, 'tc')) walk(tc, true, inToc, false);
        if (top) prevTop = null;
      } else if (c.localName === 'sdt') {
        const gallery = c.getElementsByTagNameNS(W, 'docPartGallery')[0];
        const toc = inToc || /table of contents/i.test(wattr(gallery, 'val') ?? '');
        walk(kid(c, 'sdtContent') ?? c, inTable, toc, top);
      } else if (['customXml', 'ins'].includes(c.localName)) walk(c, inTable, inToc, top);
    }
  };
  walk(body!, false, false, true);
  const last = kid(body, 'sectPr');
  if (last) sectEls.push(last);

  let inherited: { header: string | null; footer: string | null } = { header: null, footer: null };
  const sections: Section[] = sectEls.map((el) => {
    const pgSz = kid(el, 'pgSz');
    const pgMar = kid(el, 'pgMar');
    const pg = kid(el, 'pgNumType');
    const ref = (kind: 'header' | 'footer') =>
      kids(el, `${kind}Reference`).find((x) => wattr(x, 'type') === 'default' || !wattr(x, 'type'));
    const h = ref('header');
    const f = ref('footer');
    const hid = h ? (h.getAttributeNS(R, 'id') ?? h.getAttribute('r:id')) : inherited.header;
    const fid = f ? (f.getAttributeNS(R, 'id') ?? f.getAttribute('r:id')) : inherited.footer;
    inherited = { header: hid, footer: fid };
    const fj = pageJc(part(fid));
    const hj = fj ? null : pageJc(part(hid));
    const w = Number(wattr(pgSz, 'w') ?? 11906);
    const hh = Number(wattr(pgSz, 'h') ?? 16838);
    const m = (k: string) => Number(wattr(pgMar, k) ?? 1440);
    return {
      el,
      w,
      h: hh,
      landscape: wattr(pgSz, 'orient') === 'landscape' || w > hh,
      margin: { top: m('top'), bottom: m('bottom'), left: m('left'), right: m('right') },
      fmt: wattr(pg, 'fmt') ?? 'decimal',
      start: wattr(pg, 'start') === null ? null : Number(wattr(pg, 'start')),
      page: fj ? { where: 'footer', jc: fj } : hj ? { where: 'header', jc: hj } : null,
    };
  });
  // Paragraf setelah sectPr terakhir di badan ikut section terakhir.
  for (const p of paras) p.section = Math.min(p.section, sections.length - 1);
  return { files, doc, styles, paras, sections, parts, rels };
}
