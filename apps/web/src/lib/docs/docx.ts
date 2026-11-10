/**
 * Render DocSpec ke Word .docx (Office Open XML) tanpa pustaka tambahan: XML ditulis langsung
 * lalu dikemas ZIP dengan fflate. Font: Arial (sans) atau Times New Roman (serif), yang ada di
 * Word, Google Docs, WPS, dan LibreOffice. Kolom samping CV ditulis sebagai tabel dua kolom.
 */
import { strToU8, zipSync } from 'fflate';
import { A4, DEFAULT_LEAD, type Block, type DocSpec, type Run } from './model';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FONT_NAME = { sans: 'Arial', serif: 'Times New Roman' } as const;

/** pt ke twip (1/20 pt) dan EMU (1/12700 pt). */
const tw = (pt: number) => Math.round(pt * 20);
const emu = (pt: number) => Math.round(pt * 12700);
const half = (pt: number) => Math.round(pt * 2);

export function xmlEscape(s: string): string {
  // Karakter kontrol tidak boleh ada di XML.
  // eslint-disable-next-line no-control-regex
  const ctrl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
  return s
    .replace(ctrl, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class Writer {
  rels: { id: string; type: string; target: string; external?: boolean }[] = [];
  media: { name: string; data: Uint8Array }[] = [];
  /** Daftar bernomor: tiap daftar butuh num sendiri agar penomoran mulai dari 1 lagi. */
  numbered: number[] = [];
  imgId = 0;

  constructor(readonly spec: DocSpec) {}

  rel(type: string, target: string, external = false) {
    const id = `rId${this.rels.length + 10}`;
    this.rels.push({ id, type, target, external });
    return id;
  }

  runXml(r: Run, size: number, color: string, extra = ''): string {
    const props = [
      r.b ? '<w:b/><w:bCs/>' : '',
      r.i ? '<w:i/><w:iCs/>' : '',
      `<w:color w:val="${(r.color ?? color).toUpperCase()}"/>`,
      `<w:sz w:val="${half(size)}"/><w:szCs w:val="${half(size)}"/>`,
      extra,
    ].join('');
    // Baris baru di dalam teks menjadi <w:br/>.
    const body = r.text
      .split('\n')
      .map((t) => `<w:t xml:space="preserve">${xmlEscape(t)}</w:t>`)
      .join('<w:br/>');
    const xml = `<w:r><w:rPr>${props}</w:rPr>${body}</w:r>`;
    if (!r.href) return xml;
    const id = this.rel(`${REL}/hyperlink`, r.href, true);
    return `<w:hyperlink r:id="${id}" w:history="1">${xml}</w:hyperlink>`;
  }

  runs(runs: Run[], size: number, color: string) {
    return runs.map((r) => this.runXml(r, size, color)).join('');
  }

  para(
    content: string,
    opts: {
      before?: number;
      after?: number;
      lead?: number;
      align?: string;
      ind?: string;
      tabs?: string;
      border?: string;
      keepNext?: boolean;
      num?: number;
    } = {},
  ): string {
    const line = Math.round(240 * (opts.lead ?? DEFAULT_LEAD) * 0.86);
    const jc = { center: 'center', right: 'right', justify: 'both' }[opts.align ?? ''] ?? '';
    const ppr = [
      opts.keepNext ? '<w:keepNext/>' : '',
      opts.num !== undefined
        ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.num}"/></w:numPr>`
        : '',
      opts.border ?? '',
      opts.tabs ? `<w:tabs>${opts.tabs}</w:tabs>` : '',
      `<w:spacing w:before="${tw(opts.before ?? 0)}" w:after="${tw(opts.after ?? 0)}" w:line="${line}" w:lineRule="auto"/>`,
      opts.ind ?? '',
      jc ? `<w:jc w:val="${jc}"/>` : '',
    ].join('');
    return `<w:p><w:pPr>${ppr}</w:pPr>${content}</w:p>`;
  }

  /** Blok-blok di satu kolom selebar `width` pt. */
  blocks(blocks: Block[], width: number, color: string): string {
    const base = this.spec.size;
    const out: string[] = [];
    // Jarak "after" blok sebelumnya digabung ke "before" blok berikutnya (mirip PDF).
    let pending = 0;
    for (const b of blocks) {
      if (b.t === 'gap') {
        pending += b.h;
        continue;
      }
      const before = pending + ('before' in b ? (b.before ?? 0) : 0);
      pending = 0;
      const after = 'after' in b ? (b.after ?? 0) : 0;
      switch (b.t) {
        case 'p': {
          if (!b.runs.some((r) => r.text.trim())) {
            pending = before;
            continue;
          }
          const size = b.size ?? base;
          out.push(
            this.para(this.runs(b.runs, size, b.color ?? color), {
              before,
              after,
              lead: b.lead,
              align: b.align,
            }),
          );
          break;
        }
        case 'h': {
          if (!b.text.trim()) {
            pending = before;
            continue;
          }
          const size = b.size ?? base * 1.15;
          const border = b.rule
            ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="2" w:color="${b.rule.toUpperCase()}"/></w:pBdr>`
            : '';
          const extra =
            (b.caps ? '<w:caps/>' : '') + (b.track ? `<w:spacing w:val="${tw(b.track)}"/>` : '');
          out.push(
            this.para(this.runXml({ text: b.text, b: true }, size, b.color ?? color, extra), {
              before,
              after: after + (b.rule ? 4 : 0),
              lead: 1.25,
              border,
              keepNext: true,
            }),
          );
          break;
        }
        case 'list': {
          const items = b.items.filter((it) => it.some((r) => r.text.trim()));
          if (!items.length) {
            pending = before;
            continue;
          }
          const size = b.size ?? base;
          let num = 1;
          if (b.numbered) {
            num = 2 + this.numbered.length;
            this.numbered.push(num);
          }
          items.forEach((it, n) =>
            out.push(
              this.para(this.runs(it, size, b.color ?? color), {
                before: n === 0 ? before : size * 0.15,
                after: n === items.length - 1 ? after : 0,
                num,
              }),
            ),
          );
          break;
        }
        case 'row': {
          const size = b.size ?? base;
          const c = b.color ?? color;
          const content =
            this.runs(b.left, size, c) +
            (b.right.length ? '<w:r><w:tab/></w:r>' + this.runs(b.right, size, c) : '');
          out.push(
            this.para(content, {
              before,
              after,
              tabs: `<w:tab w:val="right" w:pos="${tw(width)}"/>`,
            }),
          );
          break;
        }
        case 'kv': {
          const rows = b.rows.filter(([, v]) => v.trim());
          if (!rows.length) {
            pending = before;
            continue;
          }
          const size = b.size ?? base;
          const colon = size * 0.6;
          rows.forEach(([label, value], n) =>
            out.push(
              this.para(
                this.runXml({ text: label }, size, color) +
                  '<w:r><w:tab/></w:r>' +
                  this.runXml({ text: ':' }, size, color) +
                  '<w:r><w:tab/></w:r>' +
                  this.runXml({ text: value }, size, color),
                {
                  before: n === 0 ? before : 0,
                  after: n === rows.length - 1 ? after : 0,
                  tabs: `<w:tab w:val="left" w:pos="${tw(b.label)}"/><w:tab w:val="left" w:pos="${tw(b.label + colon)}"/>`,
                  ind: `<w:ind w:left="${tw(b.label + colon)}" w:hanging="${tw(b.label + colon)}"/>`,
                },
              ),
            ),
          );
          break;
        }
        case 'rule': {
          // Paragraf kosong setinggi 1 pt yang hanya membawa garis bawah.
          const sz = Math.max(2, Math.round((b.weight ?? 0.75) * 8));
          out.push(
            `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${sz}" w:space="0" w:color="${(b.color ?? 'cccccc').toUpperCase()}"/></w:pBdr>` +
              `<w:spacing w:before="${tw(before)}" w:after="${tw(after)}" w:line="20" w:lineRule="exact"/>` +
              `<w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`,
          );
          break;
        }
        case 'img': {
          this.imgId++;
          const name = `image${this.imgId}.${b.type === 'png' ? 'png' : 'jpeg'}`;
          this.media.push({ name, data: b.data });
          const rid = this.rel(`${REL}/image`, `media/${name}`);
          const cx = emu(b.w);
          const cy = emu(b.h);
          const n = this.imgId;
          const drawing =
            `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
            `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Foto ${n}"/>` +
            `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
            `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
            `<pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>` +
            `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
            `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
            `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
            `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
          // Jarak baris minimal 1 agar gambar tidak terpotong.
          out.push(this.para(drawing, { before, after, lead: 1 / 0.86, align: b.align }));
          break;
        }
      }
    }
    return out.join('');
  }

  body(): string {
    const s = this.spec;
    const m = s.margin;
    const pageW = tw(A4.w);
    const pageH = tw(A4.h);
    if (!s.side) {
      const content = this.blocks(s.main, A4.w - m * 2, s.color) || '<w:p/>';
      return (
        content +
        `<w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"/>` +
        `<w:pgMar w:top="${tw(m)}" w:right="${tw(m)}" w:bottom="${tw(m)}" w:left="${tw(m)}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
      );
    }
    // Kolom samping: tabel selebar halaman tanpa margin kiri/kanan, tinggi baris minimal satu
    // halaman agar warna latar memenuhi halaman pertama.
    const pad = Math.min(m, 28);
    const sideW = s.side.width;
    const mainW = A4.w - sideW;
    const none = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((k) => `<w:${k} w:val="nil"/>`)
      .join('');
    const cell = (w: number, inner: string, mar: [number, number, number, number], fill?: string) =>
      `<w:tc><w:tcPr><w:tcW w:w="${tw(w)}" w:type="dxa"/>` +
      (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill.toUpperCase()}"/>` : '') +
      `<w:tcMar><w:top w:w="${tw(mar[0])}" w:type="dxa"/><w:left w:w="${tw(mar[1])}" w:type="dxa"/>` +
      `<w:bottom w:w="${tw(mar[2])}" w:type="dxa"/><w:right w:w="${tw(mar[3])}" w:type="dxa"/></w:tcMar></w:tcPr>` +
      (inner || '<w:p/>') +
      `</w:tc>`;
    const sideInner = this.blocks(s.side.blocks, sideW - pad * 2, s.side.color);
    const mainInner = this.blocks(s.main, mainW - pad - m, s.color);
    const table =
      `<w:tbl><w:tblPr><w:tblW w:w="${pageW}" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
      `<w:tblBorders>${none}</w:tblBorders>` +
      `<w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="${tw(sideW)}"/><w:gridCol w:w="${pageW - tw(sideW)}"/></w:tblGrid>` +
      `<w:tr><w:trPr><w:trHeight w:val="${pageH - 60}" w:hRule="atLeast"/></w:trPr>` +
      cell(sideW, sideInner, [m, pad, m, pad], s.side.bg) +
      cell(mainW, mainInner, [m, pad, m, m]) +
      `</w:tr></w:tbl>`;
    // Word mewajibkan paragraf setelah tabel; dibuat sekecil mungkin agar tidak membuat halaman baru.
    const tail = `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>`;
    return (
      table +
      tail +
      `<w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}"/>` +
      `<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`
    );
  }

  numberingXml(): string {
    const lvl = (fmt: string, text: string, font = '') =>
      `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/>` +
      `<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${tw(fmt === 'bullet' ? 13 : 18)}" w:hanging="${tw(fmt === 'bullet' ? 11 : 16)}"/></w:pPr>` +
      (font ? `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr>` : '') +
      `</w:lvl>`;
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:numbering xmlns:w="${W_NS}">` +
      `<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/>${lvl('bullet', '•', FONT_NAME[this.spec.font])}</w:abstractNum>` +
      `<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/>${lvl('decimal', '%1.')}</w:abstractNum>` +
      `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>` +
      this.numbered
        .map(
          (id) =>
            `<w:num w:numId="${id}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`,
        )
        .join('') +
      `</w:numbering>`
    );
  }

  stylesXml(): string {
    const f = FONT_NAME[this.spec.font];
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr>` +
      `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>` +
      `<w:sz w:val="${half(this.spec.size)}"/><w:szCs w:val="${half(this.spec.size)}"/>` +
      `<w:lang w:val="${this.spec.lang === 'id' ? 'id-ID' : 'en-US'}"/>` +
      `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
      `<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:u w:val="none"/></w:rPr></w:style>` +
      `</w:styles>`
    );
  }
}

/** Buat file .docx dari DocSpec. */
export function renderDocx(spec: DocSpec): Uint8Array {
  const w = new Writer(spec);
  const body = w.body();
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<w:body>${body}</w:body></w:document>`;
  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
    w.rels
      .map(
        (r) =>
          `<Relationship Id="${r.id}" Type="${r.type}" Target="${xmlEscape(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`,
      )
      .join('') +
    `</Relationships>`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlEscape(spec.title)}</dc:title><dc:creator>${xmlEscape(spec.author)}</dc:creator>` +
    `<dc:language>${spec.lang === 'id' ? 'id-ID' : 'en-US'}</dc:language>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`;
  const types =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(types),
    '_rels/.rels': strToU8(rootRels),
    'docProps/core.xml': strToU8(core),
    'word/document.xml': strToU8(document),
    'word/_rels/document.xml.rels': strToU8(docRels),
    'word/styles.xml': strToU8(w.stylesXml()),
    'word/numbering.xml': strToU8(w.numberingXml()),
  };
  for (const m of w.media) files[`word/media/${m.name}`] = m.data;
  return zipSync(files, { level: 6 });
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
