/**
 * Render DeckSpec ke PowerPoint .pptx (PresentationML) tanpa pustaka tambahan: XML ditulis
 * langsung lalu dikemas ZIP dengan fflate. Semua elemen menjadi bentuk, kotak teks, dan gambar
 * asli PowerPoint sehingga tetap bisa diedit di PowerPoint, Google Slides, WPS, dan Keynote.
 */
import { strToU8, zipSync } from 'fflate';
import { xmlEscape } from '../docs/docx';
import {
  SLIDE,
  containBox,
  coverCrop,
  type DeckSpec,
  type El,
  type Fill,
  type TextEl,
} from './model';
import { fitScales } from './pdf';
import { DEFAULT_LEAD, bulletIndent } from './text';

const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const CT = 'application/vnd.openxmlformats-officedocument.presentationml';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = `xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"`;

const emu = (pt: number) => Math.round(pt * 12700);
const FONT = { sans: 'Arial', serif: 'Times New Roman' } as const;

function color(hex: string, opacity?: number) {
  const a =
    opacity !== undefined && opacity < 1 ? `<a:alpha val="${Math.round(opacity * 100000)}"/>` : '';
  return `<a:srgbClr val="${hex.toUpperCase()}">${a}</a:srgbClr>`;
}

export function fillXml(f?: Fill): string {
  if (!f || (!f.color && !f.grad)) return '<a:noFill/>';
  if (f.grad)
    return (
      `<a:gradFill rotWithShape="1"><a:gsLst>` +
      f.grad.stops
        .map(([c, pos]) => `<a:gs pos="${Math.round(pos * 100000)}">${color(c, f.opacity)}</a:gs>`)
        .join('') +
      `</a:gsLst><a:lin ang="${Math.round((((f.grad.angle % 360) + 360) % 360) * 60000)}" scaled="0"/></a:gradFill>`
    );
  return `<a:solidFill>${color(f.color!, f.opacity)}</a:solidFill>`;
}

function xfrm(x: number, y: number, w: number, h: number, rot?: number) {
  // Lebar/tinggi negatif (garis miring ke kiri atau ke atas) menjadi flipH/flipV.
  const flipH = w < 0;
  const flipV = h < 0;
  if (flipH) x += w;
  if (flipV) y += h;
  const attrs =
    (rot ? ` rot="${Math.round(rot * 60000)}"` : '') +
    (flipH ? ' flipH="1"' : '') +
    (flipV ? ' flipV="1"' : '');
  return `<a:xfrm${attrs}><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${Math.max(1, emu(Math.abs(w)))}" cy="${Math.max(1, emu(Math.abs(h)))}"/></a:xfrm>`;
}

function geomXml(el: {
  geom?: string;
  w: number;
  h: number;
  pts?: [number, number][];
  r?: number;
}) {
  switch (el.geom) {
    case 'ellipse':
      return '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>';
    case 'round': {
      const adj = Math.min(
        50000,
        Math.round(((el.r ?? 8) / Math.min(Math.abs(el.w), Math.abs(el.h))) * 100000),
      );
      return `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${adj}"/></a:avLst></a:prstGeom>`;
    }
    case 'line':
      return '<a:prstGeom prst="line"><a:avLst/></a:prstGeom>';
    case 'poly': {
      const S = 100000;
      const pts = el.pts ?? [];
      const pt = ([x, y]: [number, number]) =>
        `<a:pt x="${Math.round(x * S)}" y="${Math.round(y * S)}"/>`;
      return (
        `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>` +
        `<a:pathLst><a:path w="${S}" h="${S}">` +
        (pts.length
          ? `<a:moveTo>${pt(pts[0])}</a:moveTo>` +
            pts
              .slice(1)
              .map((p) => `<a:lnTo>${pt(p)}</a:lnTo>`)
              .join('') +
            '<a:close/>'
          : '') +
        `</a:path></a:pathLst></a:custGeom>`
      );
    }
    default:
      return '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  }
}

class SlideWriter {
  id = 1;
  rels: { id: string; target: string }[] = [];
  constructor(
    readonly spec: DeckSpec,
    readonly scales: Map<TextEl, number>,
    readonly media: (data: Uint8Array, type: 'png' | 'jpeg') => string,
  ) {}

  /** Bagian non-visual elemen (id unik per slide). */
  nv(kind: string, name: string, attrs = '', inner = '') {
    this.id++;
    const c = inner
      ? `<p:cNv${kind}Pr${attrs}>${inner}</p:cNv${kind}Pr>`
      : `<p:cNv${kind}Pr${attrs}/>`;
    return `<p:nv${kind}Pr><p:cNvPr id="${this.id}" name="${name} ${this.id}"/>${c}<p:nvPr/></p:nv${kind}Pr>`;
  }

  el(el: El): string {
    if (el.t === 'shape') {
      const line = el.line
        ? `<a:ln w="${emu(el.line.w)}"><a:solidFill>${color(el.line.color, el.line.opacity)}</a:solidFill></a:ln>`
        : '<a:ln><a:noFill/></a:ln>';
      const fill = el.geom === 'line' ? '<a:noFill/>' : fillXml(el.fill);
      return `<p:sp>${this.nv('Sp', 'Shape')}<p:spPr>${xfrm(el.x, el.y, el.w, el.h, el.rot)}${geomXml(el)}${fill}${line}</p:spPr></p:sp>`;
    }
    if (el.t === 'text') return this.text(el);
    // Gambar: dipotong (cover) atau diperkecil utuh (contain).
    const rid = this.media(el.data, el.type);
    let box = { x: el.x, y: el.y, w: el.w, h: el.h };
    let src = '';
    if (el.mode === 'contain') box = containBox(el);
    else {
      const c = coverCrop(el);
      const v = (n: number) => Math.round(n * 100000);
      src = `<a:srcRect l="${v(c.l)}" t="${v(c.t)}" r="${v(c.r)}" b="${v(c.b)}"/>`;
    }
    const geom = geomXml({
      geom: el.shape === 'ellipse' ? 'ellipse' : el.shape === 'round' ? 'round' : 'rect',
      w: box.w,
      h: box.h,
      r: el.r,
    });
    return (
      `<p:pic>${this.nv('Pic', 'Picture', '', '<a:picLocks noChangeAspect="1"/>')}` +
      `<p:blipFill><a:blip r:embed="${rid}"/>${src}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
      `<p:spPr>${xfrm(box.x, box.y, box.w, box.h)}${geom}</p:spPr></p:pic>`
    );
  }

  text(el: TextEl): string {
    const s = this.scales.get(el) ?? 1;
    const font = FONT[this.spec.font];
    const lang = this.spec.lang === 'id' ? 'id-ID' : 'en-US';
    const pad = emu(el.pad ?? 0);
    const anchor = el.valign === 'm' ? 'ctr' : el.valign === 'b' ? 'b' : 't';
    const rpr = (size: number, c: string, b?: boolean, i?: boolean) =>
      `<a:rPr lang="${lang}" sz="${Math.max(100, Math.round(size * 100))}"${b ? ' b="1"' : ''}${i ? ' i="1"' : ''}` +
      `${el.track ? ` spc="${Math.round(el.track * 100)}"` : ''} dirty="0"><a:solidFill>${color(c)}</a:solidFill>` +
      `<a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:rPr>`;
    const paras = el.paras
      .map((p) => {
        const size = (p.size ?? el.size) * s;
        const c = p.color ?? el.color;
        const lead = p.lead ?? DEFAULT_LEAD;
        const algn = p.align === 'c' ? 'ctr' : p.align === 'r' ? 'r' : 'l';
        const ind = emu(bulletIndent(size, p.bullet));
        const bullet =
          p.bullet === 'dot'
            ? `<a:buClr>${color(c)}</a:buClr><a:buFont typeface="${font}"/><a:buChar char="•"/>`
            : p.bullet === 'num'
              ? `<a:buClr>${color(c)}</a:buClr><a:buFont typeface="${font}"/><a:buAutoNum type="arabicPeriod"/>`
              : '<a:buNone/>';
        const ppr =
          `<a:pPr algn="${algn}"${ind ? ` marL="${ind}" indent="${-ind}"` : ' marL="0" indent="0"'}>` +
          `<a:lnSpc><a:spcPts val="${Math.round(size * lead * 100)}"/></a:lnSpc>` +
          `<a:spcBef><a:spcPts val="0"/></a:spcBef><a:spcAft><a:spcPts val="${Math.round((p.after ?? 0) * s * 100)}"/></a:spcAft>` +
          `${bullet}</a:pPr>`;
        const runs = p.runs
          .flatMap((r) =>
            r.text
              .split('\n')
              .map(
                (t, i) =>
                  (i ? `<a:br>${rpr(size, r.color ?? c)}</a:br>` : '') +
                  (t
                    ? `<a:r>${rpr(size, r.color ?? c, r.b, r.i)}<a:t>${xmlEscape(t)}</a:t></a:r>`
                    : ''),
              ),
          )
          .join('');
        return `<a:p>${ppr}${runs}<a:endParaRPr lang="${lang}" sz="${Math.max(100, Math.round(size * 100))}" dirty="0"/></a:p>`;
      })
      .join('');
    return (
      `<p:sp>${this.nv('Sp', 'Text', ' txBox="1"')}<p:spPr>${xfrm(el.x, el.y, el.w, el.h)}` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
      `<p:txBody><a:bodyPr wrap="square" lIns="${pad}" tIns="${pad}" rIns="${pad}" bIns="${pad}" anchor="${anchor}" rtlCol="0"><a:noAutofit/></a:bodyPr>` +
      `<a:lstStyle/>${paras || '<a:p/>'}</p:txBody></p:sp>`
    );
  }
}

function themeXml(colors: string[]) {
  const acc = [...colors, '1F3A5F', '3D6B9E', 'F2A541', '2F5D3A', '8C3B22', '5B3A8E'].slice(0, 6);
  const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return (
    `${XML}<a:theme xmlns:a="${NS_A}" name="Toolland"><a:themeElements>` +
    `<a:clrScheme name="Toolland"><a:dk1><a:srgbClr val="1A1A1A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>` +
    `<a:dk2><a:srgbClr val="2B2B2B"/></a:dk2><a:lt2><a:srgbClr val="F4F4F4"/></a:lt2>` +
    acc
      .map((c, i) => `<a:accent${i + 1}><a:srgbClr val="${c.toUpperCase()}"/></a:accent${i + 1}>`)
      .join('') +
    `<a:hlink><a:srgbClr val="1F5FAF"/></a:hlink><a:folHlink><a:srgbClr val="6B3FA0"/></a:folHlink></a:clrScheme>` +
    `<a:fontScheme name="Toolland"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
    `<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Toolland"><a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst>` +
    `<a:lnStyleLst>${[1, 2, 3].map(() => `<a:ln w="6350">${solid}</a:ln>`).join('')}</a:lnStyleLst>` +
    `<a:effectStyleLst>${[1, 2, 3].map(() => '<a:effectStyle><a:effectLst/></a:effectStyle>').join('')}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst></a:fmtScheme>` +
    `</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`
  );
}

const EMPTY_TREE =
  '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

const rels = (items: { id: string; type: string; target: string }[]) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  items
    .map((r) => `<Relationship Id="${r.id}" Type="${REL}/${r.type}" Target="${r.target}"/>`)
    .join('') +
  `</Relationships>`;

/** Buat file .pptx dari DeckSpec. */
export async function renderPptx(spec: DeckSpec): Promise<Uint8Array> {
  const scales = await fitScales(spec);
  const files: Record<string, Uint8Array> = {};
  const mediaNames = new Map<Uint8Array, string>();
  const n = spec.slides.length;

  spec.slides.forEach((slide, i) => {
    const slideRels: { id: string; type: string; target: string }[] = [
      { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
    ];
    const w = new SlideWriter(spec, scales, (data, type) => {
      let name = mediaNames.get(data);
      if (!name) {
        name = `image${mediaNames.size + 1}.${type === 'png' ? 'png' : 'jpeg'}`;
        mediaNames.set(data, name);
        files[`ppt/media/${name}`] = data;
      }
      const existing = slideRels.find((r) => r.target === `../media/${name}`);
      if (existing) return existing.id;
      const id = `rId${slideRels.length + 1}`;
      slideRels.push({ id, type: 'image', target: `../media/${name}` });
      return id;
    });
    const body = slide.els.map((el) => w.el(el)).join('');
    const bg = slide.bg.color || slide.bg.grad ? slide.bg : { color: 'ffffff' };
    files[`ppt/slides/slide${i + 1}.xml`] = strToU8(
      `${XML}<p:sld ${NS}><p:cSld><p:bg><p:bgPr>${fillXml(bg)}<a:effectLst/></p:bgPr></p:bg>` +
        `${EMPTY_TREE}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`,
    );
    files[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = strToU8(rels(slideRels));
  });

  const slideIds = spec.slides
    .map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`)
    .join('');
  files['ppt/presentation.xml'] = strToU8(
    `${XML}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="${emu(SLIDE.w)}" cy="${emu(SLIDE.h)}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
  );
  files['ppt/_rels/presentation.xml.rels'] = strToU8(
    rels([
      { id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
      { id: 'rId2', type: 'theme', target: 'theme/theme1.xml' },
      { id: 'rId3', type: 'presProps', target: 'presProps.xml' },
      { id: 'rId4', type: 'viewProps', target: 'viewProps.xml' },
      { id: 'rId5', type: 'tableStyles', target: 'tableStyles.xml' },
      ...spec.slides.map((_, i) => ({
        id: `rId${10 + i}`,
        type: 'slide',
        target: `slides/slide${i + 1}.xml`,
      })),
    ]),
  );
  const lvl = '<a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr>';
  files['ppt/slideMasters/slideMaster1.xml'] = strToU8(
    `${XML}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${EMPTY_TREE}</p:spTree></p:cSld>` +
      `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
      `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
      `<p:txStyles><p:titleStyle>${lvl}</p:titleStyle><p:bodyStyle>${lvl}</p:bodyStyle><p:otherStyle>${lvl}</p:otherStyle></p:txStyles></p:sldMaster>`,
  );
  files['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = strToU8(
    rels([
      { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
      { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' },
    ]),
  );
  files['ppt/slideLayouts/slideLayout1.xml'] = strToU8(
    `${XML}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank">${EMPTY_TREE}</p:spTree></p:cSld>` +
      `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
  );
  files['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = strToU8(
    rels([{ id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' }]),
  );
  files['ppt/theme/theme1.xml'] = strToU8(themeXml(spec.colors ?? []));
  files['ppt/presProps.xml'] = strToU8(`${XML}<p:presentationPr ${NS}/>`);
  files['ppt/viewProps.xml'] = strToU8(
    `${XML}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`,
  );
  files['ppt/tableStyles.xml'] = strToU8(
    `${XML}<a:tblStyleLst xmlns:a="${NS_A}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
  );

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  files['docProps/core.xml'] = strToU8(
    `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
      `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      `<dc:title>${xmlEscape(spec.title)}</dc:title><dc:creator>${xmlEscape(spec.author)}</dc:creator>` +
      `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
      `</cp:coreProperties>`,
  );
  files['docProps/app.xml'] = strToU8(
    `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Toolland</Application><Slides>${n}</Slides></Properties>`,
  );
  files['_rels/.rels'] = strToU8(
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  files['[Content_Types].xml'] = strToU8(
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>` +
      `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
      `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentation.main+xml"/>` +
      `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.slideMaster+xml"/>` +
      `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.slideLayout+xml"/>` +
      `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
      `<Override PartName="/ppt/presProps.xml" ContentType="${CT}.presProps+xml"/>` +
      `<Override PartName="/ppt/viewProps.xml" ContentType="${CT}.viewProps+xml"/>` +
      `<Override PartName="/ppt/tableStyles.xml" ContentType="${CT}.tableStyles+xml"/>` +
      spec.slides
        .map(
          (_, i) =>
            `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${CT}.slide+xml"/>`,
        )
        .join('') +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
      `</Types>`,
  );
  return zipSync(files, { level: 6 });
}

export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
