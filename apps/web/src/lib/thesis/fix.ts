/**
 * Rapikan .docx sesuai pedoman: kertas dan margin semua section, nomor halaman (romawi di bagian
 * awal, angka mulai 1 di BAB I, posisi sesuai aturan), font/ukuran/spasi/indentasi/perataan isi,
 * judul BAB, subjudul, dan keterangan tabel/gambar. Hanya format yang diubah; teks, gambar,
 * tabel, catatan kaki, dan cetak miring/tebal di isi tidak disentuh. Urutan elemen anak
 * mengikuti skema OOXML supaya Word tidak menganggap file rusak.
 */
import { strFromU8, strToU8, zipSync } from 'fflate';
import { classify, type Block } from './check';
import { kid, kids, R, readDocx, W, wattr, type DocxModel } from './docx-read';
import { cmToTw, PAPER_TWIPS, type ThesisRules } from './rules';

export const PPR_ORDER = [
  'pStyle', 'keepNext', 'keepLines', 'pageBreakBefore', 'framePr', 'widowControl', 'numPr',
  'suppressLineNumbers', 'pBdr', 'shd', 'tabs', 'suppressAutoHyphens', 'kinsoku', 'wordWrap',
  'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd',
  'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc',
  'textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr',
  'sectPr', 'pPrChange',
]; // prettier-ignore
export const RPR_ORDER = [
  'rStyle', 'rFonts', 'b', 'bCs', 'i', 'iCs', 'caps', 'smallCaps', 'strike', 'dstrike', 'outline',
  'shadow', 'emboss', 'imprint', 'noProof', 'snapToGrid', 'vanish', 'webHidden', 'color',
  'spacing', 'w', 'kern', 'position', 'sz', 'szCs', 'highlight', 'u', 'effect', 'bdr', 'shd',
  'fitText', 'vertAlign', 'rtl', 'cs', 'em', 'lang', 'eastAsianLayout', 'specVanish', 'oMath',
  'rPrChange',
]; // prettier-ignore
export const SECT_ORDER = [
  'headerReference', 'footerReference', 'footnotePr', 'endnotePr', 'type', 'pgSz', 'pgMar',
  'paperSrc', 'pgBorders', 'lnNumType', 'pgNumType', 'cols', 'formProt', 'vAlign', 'noEndnote',
  'titlePg', 'textDirection', 'bidi', 'rtlGutter', 'docGrid', 'printerSettings', 'sectPrChange',
]; // prettier-ignore

function make(doc: Document, name: string): Element {
  return doc.createElementNS(W, `w:${name}`);
}
function setW(el: Element, name: string, value: string | number) {
  el.setAttributeNS(W, `w:${name}`, String(value));
}

/** Ambil (atau buat) anak `name` di posisi yang benar menurut urutan skema. */
function child(parent: Element, name: string, order: string[]): Element {
  const found = kid(parent, name);
  if (found) return found;
  const el = make(parent.ownerDocument, name);
  const idx = order.indexOf(name);
  const before = kids(parent).find((c) => order.indexOf(c.localName) > idx);
  parent.insertBefore(el, before ?? null);
  return el;
}
/** pPr/rPr selalu anak pertama dari p/r. */
function first(parent: Element, name: string): Element {
  const found = kid(parent, name);
  if (found) return found;
  const el = make(parent.ownerDocument, name);
  parent.insertBefore(el, parent.firstElementChild);
  return el;
}
function remove(parent: Element | null, name: string) {
  for (const c of kids(parent, name)) c.remove();
}
const pPrOf = (p: Element) => first(p, 'pPr');

function setOnOff(rPr: Element, name: string, on: boolean) {
  const el = child(rPr, name, RPR_ORDER);
  if (on) el.removeAttributeNS(W, 'val');
  else setW(el, 'val', '0');
}

/** Font dan ukuran untuk semua run teks paragraf, plus tanda paragrafnya. */
function setRuns(p: Element, font: string, size: number | null, extra?: (rPr: Element) => void) {
  const targets = [...p.getElementsByTagNameNS(W, 'r')].filter(
    (r) => r.parentElement?.localName !== 'rPr',
  );
  const apply = (rPr: Element) => {
    const f = child(rPr, 'rFonts', RPR_ORDER);
    for (const a of ['asciiTheme', 'hAnsiTheme', 'cstheme', 'eastAsiaTheme'])
      f.removeAttributeNS(W, a);
    for (const a of ['ascii', 'hAnsi', 'cs', 'eastAsia']) setW(f, a, font);
    if (size !== null) {
      setW(child(rPr, 'sz', RPR_ORDER), 'val', Math.round(size * 2));
      setW(child(rPr, 'szCs', RPR_ORDER), 'val', Math.round(size * 2));
    }
    extra?.(rPr);
  };
  for (const r of targets) {
    // Run catatan kaki/tanda referensi (superscript) tetap kecil.
    const rPr = first(r, 'rPr');
    const sup = wattr(kid(rPr, 'vertAlign'), 'val');
    if (sup === 'superscript' || sup === 'subscript') {
      const f = child(rPr, 'rFonts', RPR_ORDER);
      for (const a of ['ascii', 'hAnsi', 'cs', 'eastAsia']) setW(f, a, font);
      continue;
    }
    apply(rPr);
  }
  apply(child(pPrOf(p), 'rPr', PPR_ORDER));
}

function setSpacing(p: Element, v: { line?: number; before?: number; after?: number }) {
  const sp = child(pPrOf(p), 'spacing', PPR_ORDER);
  if (v.line !== undefined) {
    setW(sp, 'line', Math.round(v.line * 240));
    setW(sp, 'lineRule', 'auto');
  }
  if (v.before !== undefined) {
    setW(sp, 'before', Math.round(v.before * 20));
    sp.removeAttributeNS(W, 'beforeLines');
    sp.removeAttributeNS(W, 'beforeAutospacing');
  }
  if (v.after !== undefined) {
    setW(sp, 'after', Math.round(v.after * 20));
    sp.removeAttributeNS(W, 'afterLines');
    sp.removeAttributeNS(W, 'afterAutospacing');
  }
}
function setJc(p: Element, jc: 'both' | 'center' | 'left') {
  setW(child(pPrOf(p), 'jc', PPR_ORDER), 'val', jc);
}
function setFirstLine(p: Element, cm: number) {
  const ind = child(pPrOf(p), 'ind', PPR_ORDER);
  for (const a of ['hanging', 'hangingChars', 'firstLineChars']) ind.removeAttributeNS(W, a);
  setW(ind, 'firstLine', cmToTw(cm));
}

// --- Section dan nomor halaman ---------------------------------------------------------------

function setPage(sect: Element, rules: ThesisRules) {
  const size = PAPER_TWIPS[rules.paper];
  const pgSz = child(sect, 'pgSz', SECT_ORDER);
  const land =
    wattr(pgSz, 'orient') === 'landscape' || Number(wattr(pgSz, 'w')) > Number(wattr(pgSz, 'h'));
  setW(pgSz, 'w', land ? size.h : size.w);
  setW(pgSz, 'h', land ? size.w : size.h);
  if (land) return;
  const pgMar = child(sect, 'pgMar', SECT_ORDER);
  const m = rules.margin;
  setW(pgMar, 'top', cmToTw(m.top));
  setW(pgMar, 'bottom', cmToTw(m.bottom));
  setW(pgMar, 'left', cmToTw(m.left));
  setW(pgMar, 'right', cmToTw(m.right));
  for (const [k, v] of [
    ['header', 709],
    ['footer', 709],
    ['gutter', 0],
  ] as const)
    if (wattr(pgMar, k) === null) setW(pgMar, k, v);
}

function setNumType(sect: Element, fmt: string, start: number | null) {
  const pg = child(sect, 'pgNumType', SECT_ORDER);
  setW(pg, 'fmt', fmt);
  if (start === null) pg.removeAttributeNS(W, 'start');
  else setW(pg, 'start', start);
}

const isPageInstr = (s: string) => /^\s*PAGE\b/i.test(s);

/** Hapus field PAGE (sederhana maupun kompleks) dari sebuah part header/footer. */
function stripPageFields(part: Document): boolean {
  let changed = false;
  for (const f of [...part.getElementsByTagNameNS(W, 'fldSimple')])
    if (isPageInstr(wattr(f, 'instr') ?? '')) {
      f.remove();
      changed = true;
    }
  for (const p of [...part.getElementsByTagNameNS(W, 'p')]) {
    const runs = kids(p, 'r');
    let start = -1;
    let isPage = false;
    const drop: Element[] = [];
    runs.forEach((r, i) => {
      const fc = wattr(kid(r, 'fldChar'), 'fldCharType');
      if (fc === 'begin') {
        start = i;
        isPage = false;
      }
      const instr = kid(r, 'instrText');
      if (start >= 0 && instr && isPageInstr(instr.textContent ?? '')) isPage = true;
      if (fc === 'end' && start >= 0) {
        if (isPage) drop.push(...runs.slice(start, i + 1));
        start = -1;
      }
    });
    for (const r of drop) r.remove();
    if (drop.length) changed = true;
  }
  return changed;
}

function pagePart(kind: 'hdr' | 'ftr', jc: 'center' | 'right', font: string, size: number): string {
  const rPr = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/></w:rPr>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:${kind} xmlns:w="${W}" xmlns:r="${R}"><w:p><w:pPr><w:jc w:val="${jc}"/>${rPr}</w:pPr>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r>${rPr}<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r>${rPr}<w:t>1</w:t></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="end"/></w:r></w:p></w:${kind}>`
  );
}

const ser = (d: Document) => {
  const xml = new XMLSerializer().serializeToString(d);
  return xml.startsWith('<?xml')
    ? xml
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
};

/**
 * Pasang nomor halaman sesuai aturan: kalau sudah ada field PAGE di tempat yang benar cukup
 * ratakan; kalau belum ada atau di tempat lain, buat header/footer baru berisi nomor halaman
 * dan pasang sebagai header/footer default di semua section.
 */
function fixPageNumbers(model: DocxModel, rules: ThesisRules, out: Record<string, Uint8Array>) {
  const pos = rules.pageNum.pos;
  const where = pos.startsWith('top') ? 'header' : 'footer';
  const jc = pos.endsWith('center') ? 'center' : 'right';
  const ok = model.sections.every((s) => s.page?.where === where);
  if (ok) {
    // Field sudah di header/footer yang benar: cukup atur perataannya.
    for (const [path, part] of model.parts) {
      let touched = false;
      for (const p of part.getElementsByTagNameNS(W, 'p')) {
        const txt = [
          ...[...p.getElementsByTagNameNS(W, 'instrText')].map((x) => x.textContent ?? ''),
          ...[...p.getElementsByTagNameNS(W, 'fldSimple')].map((x) => wattr(x, 'instr') ?? ''),
        ].join(' ');
        if (/\bPAGE\b/.test(txt) && path.includes(where === 'header' ? 'header' : 'footer')) {
          setW(child(pPrOf(p), 'jc', PPR_ORDER), 'val', jc);
          // Tab yang mendorong nomor ke kanan tidak diperlukan lagi.
          for (const t of [...p.getElementsByTagNameNS(W, 'r')].flatMap((r) => kids(r, 'tab')))
            t.remove();
          touched = true;
        }
      }
      if (touched) out[path] = strToU8(ser(part));
    }
    return;
  }
  // Hapus nomor halaman lama di mana pun, lalu buat part baru.
  for (const [path, part] of model.parts) if (stripPageFields(part)) out[path] = strToU8(ser(part));
  const kind = where === 'header' ? 'hdr' : 'ftr';
  let n = 1;
  while (out[`word/${where}${n}.xml`] || model.files[`word/${where}${n}.xml`]) n++;
  const name = `${where}${n}.xml`;
  out[`word/${name}`] = strToU8(pagePart(kind, jc, rules.font, rules.size));
  const rid = `rIdToolland${where}${n}`;
  const relsPath = 'word/_rels/document.xml.rels';
  const rels = new DOMParser().parseFromString(
    strFromU8(out[relsPath] ?? model.files[relsPath]),
    'application/xml',
  );
  const rel = rels.createElementNS(rels.documentElement.namespaceURI, 'Relationship');
  rel.setAttribute('Id', rid);
  rel.setAttribute(
    'Type',
    `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${where}`,
  );
  rel.setAttribute('Target', name);
  rels.documentElement.appendChild(rel);
  out[relsPath] = strToU8(ser(rels));
  const ctPath = '[Content_Types].xml';
  const ct = new DOMParser().parseFromString(
    strFromU8(out[ctPath] ?? model.files[ctPath]),
    'application/xml',
  );
  const ov = ct.createElementNS(ct.documentElement.namespaceURI, 'Override');
  ov.setAttribute('PartName', `/word/${name}`);
  ov.setAttribute(
    'ContentType',
    `application/vnd.openxmlformats-officedocument.wordprocessingml.${where}+xml`,
  );
  ct.documentElement.appendChild(ov);
  out[ctPath] = strToU8(ser(ct));
  for (const s of model.sections) {
    const refName = `${where}Reference`;
    for (const r of kids(s.el, refName))
      if ((wattr(r, 'type') ?? 'default') === 'default') r.remove();
    const ref = make(model.doc, refName);
    setW(ref, 'type', 'default');
    ref.setAttributeNS(R, 'r:id', rid);
    // Referensi header/footer selalu di awal sectPr.
    s.el.insertBefore(ref, s.el.firstElementChild);
    // Halaman pertama berbeda (titlePg) akan menyembunyikan nomor: matikan.
    remove(s.el, 'titlePg');
  }
}

/** Pisahkan bagian awal dan BAB I menjadi dua section (romawi lalu angka mulai 1). */
function splitBeforeChapter(model: DocxModel, firstChapter: Block, rules: ThesisRules) {
  const p = firstChapter.p.el;
  const sect = model.sections[firstChapter.p.section].el;
  const copy = sect.cloneNode(true) as Element;
  // Section bagian awal: berhenti di sini, lanjut ke halaman baru.
  setW(child(copy, 'type', SECT_ORDER), 'val', 'nextPage');
  setNumType(copy, rules.pageNum.front, null);
  const holder = make(model.doc, 'p');
  const pPr = make(model.doc, 'pPr');
  pPr.appendChild(copy);
  holder.appendChild(pPr);
  // Page break manual tepat sebelum BAB I tidak diperlukan lagi (section sudah halaman baru).
  const prev = p.previousElementSibling;
  if (prev?.localName === 'p' && !(prev.textContent ?? '').trim()) {
    const brs = [...prev.getElementsByTagNameNS(W, 'br')].filter(
      (b) => wattr(b, 'type') === 'page',
    );
    if (brs.length && !prev.getElementsByTagNameNS(W, 'drawing').length) prev.remove();
  }
  p.parentElement!.insertBefore(holder, p);
  remove(kid(p, 'pPr'), 'pageBreakBefore');
  setNumType(sect, 'decimal', 1);
}

export function fixDocx(input: ArrayBuffer | Uint8Array, rules: ThesisRules): Uint8Array {
  const model = readDocx(input);
  const blocks = classify(model);
  const out: Record<string, Uint8Array> = {};

  // Kertas dan margin.
  for (const s of model.sections) setPage(s.el, rules);

  // Paragraf.
  const { font, size } = rules;
  for (const b of blocks) {
    const p = b.p.el;
    switch (b.kind) {
      case 'body':
        setRuns(p, font, size);
        setSpacing(p, { line: rules.line, before: 0, after: rules.after });
        if (b.p.text.trim().length >= 40) {
          if (rules.justify) setJc(p, 'both');
          if (!b.p.numbered) setFirstLine(p, rules.indent);
        }
        break;
      case 'list':
        setRuns(p, font, size);
        setSpacing(p, { line: rules.line });
        break;
      case 'ref':
        setRuns(p, font, size);
        break;
      case 'cell':
      case 'front':
        setRuns(p, font, null);
        break;
      case 'chapter':
      case 'chapterTitle':
      case 'frontTitle': {
        const c = rules.chapter;
        setRuns(p, font, c.size, (rPr) => {
          if (c.bold) setOnOff(rPr, 'b', true);
          if (c.caps) setOnOff(rPr, 'caps', true);
        });
        if (c.center) {
          setJc(p, 'center');
          const ind = kid(pPrOf(p), 'ind');
          if (ind) ind.remove();
        }
        if (b.kind === 'chapter' && c.newPage && !b.p.afterBreak && b.p.i > 0)
          child(pPrOf(p), 'pageBreakBefore', PPR_ORDER);
        break;
      }
      case 'sub':
        setRuns(p, font, rules.sub.size, (rPr) => {
          if (rules.sub.bold) setOnOff(rPr, 'b', true);
        });
        break;
      case 'caption':
        setRuns(p, font, null);
        if (rules.caption.center) {
          setJc(p, 'center');
          const ind = kid(pPrOf(p), 'ind');
          if (ind) ind.remove();
        }
        break;
    }
  }

  // Nomor halaman: pasang field dulu (supaya ikut tersalin saat section dipecah), lalu bagian
  // awal romawi dan BAB I mulai 1.
  fixPageNumbers(model, rules, out);
  const firstChapter = blocks.find((b) => b.kind === 'chapter');
  if (firstChapter) {
    const sec = firstChapter.p.section;
    const frontSame = blocks.some(
      (b) => b.p.i < firstChapter.p.i && b.p.section === sec && b.p.text.trim(),
    );
    for (let i = 0; i < sec; i++) setNumType(model.sections[i].el, rules.pageNum.front, null);
    if (frontSame && blocks.some((b) => b.p.i < firstChapter.p.i && b.p.text.trim()))
      splitBeforeChapter(model, firstChapter, rules);
    else setNumType(model.sections[sec].el, 'decimal', 1);
  }

  // Gaya bawaan: teks baru yang diketik mahasiswa ikut font dan ukuran pedoman.
  if (model.styles) {
    const dd = kid(model.styles.documentElement, 'docDefaults');
    if (dd) {
      const rPrDef = child(dd, 'rPrDefault', ['rPrDefault', 'pPrDefault']);
      const rPr = child(rPrDef, 'rPr', ['rPr']);
      const f = child(rPr, 'rFonts', RPR_ORDER);
      for (const a of ['asciiTheme', 'hAnsiTheme', 'cstheme', 'eastAsiaTheme'])
        f.removeAttributeNS(W, a);
      for (const a of ['ascii', 'hAnsi', 'cs']) setW(f, a, font);
      setW(child(rPr, 'sz', RPR_ORDER), 'val', size * 2);
      setW(child(rPr, 'szCs', RPR_ORDER), 'val', size * 2);
      out['word/styles.xml'] = strToU8(ser(model.styles));
    }
  }

  out['word/document.xml'] = strToU8(ser(model.doc));
  return zipSync({ ...model.files, ...out }, { level: 6 });
}
