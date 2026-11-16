/**
 * Baca dan tulis file .drawio (XML mxGraphModel). maxGraph bisa mengimpor format ini, tetapi
 * ekspornya memakai format sendiri, jadi penulis .drawio dibuat di sini: style objek maxGraph
 * diubah kembali menjadi string "nama;kunci=nilai;".
 *
 * Varian yang dibaca: <mxGraphModel> langsung, <mxfile><diagram><mxGraphModel>, dan
 * <mxfile><diagram>BASE64</diagram> (deflate mentah dari teks yang di-encodeURIComponent).
 */
import type { Cell, CellStyle, GraphDataModel } from '@maxgraph/core';
import { inflateSync, strFromU8 } from 'fflate';

export interface DrawioPage {
  name: string;
  /** XML <mxGraphModel> siap diimpor. */
  model: string;
}

const KEY_TO_DRAWIO: Record<string, string> = { autoSize: 'autosize' };

/** Style objek maxGraph → string .drawio ("rounded=1;whiteSpace=wrap;"). */
export function styleToString(style: CellStyle | null | undefined): string {
  if (!style) return '';
  const parts: string[] = [];
  for (const name of style.baseStyleNames ?? []) parts.push(name);
  for (const [k, raw] of Object.entries(style)) {
    if (k === 'baseStyleNames' || k === 'ignoreDefaultStyle' || raw === undefined || raw === null)
      continue;
    let value = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
    // ";" memisah style: gambar data: disimpan seperti .drawio, "data:image/png,BASE64".
    if (k === 'image') value = value.replace(/^(data:image\/[\w.+-]+);base64,/, '$1,');
    parts.push(`${KEY_TO_DRAWIO[k] ?? k}=${value}`);
  }
  const body = parts.map((p) => `${p};`).join('');
  return style.ignoreDefaultStyle ? `;${body}` : body;
}

/** Escape nilai atribut XML. */
export const attr = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#xa;');

const num = (n: number) => String(Math.round(n * 100) / 100);

function geometryXml(cell: Cell): string {
  const g = cell.getGeometry();
  if (!g) return '';
  const a: string[] = [];
  if (g.x) a.push(`x="${num(g.x)}"`);
  if (g.y) a.push(`y="${num(g.y)}"`);
  if (g.width) a.push(`width="${num(g.width)}"`);
  if (g.height) a.push(`height="${num(g.height)}"`);
  if (g.relative) a.push('relative="1"');
  const kids: string[] = [];
  if (g.sourcePoint)
    kids.push(
      `<mxPoint x="${num(g.sourcePoint.x)}" y="${num(g.sourcePoint.y)}" as="sourcePoint"/>`,
    );
  if (g.targetPoint)
    kids.push(
      `<mxPoint x="${num(g.targetPoint.x)}" y="${num(g.targetPoint.y)}" as="targetPoint"/>`,
    );
  if (g.points?.length)
    kids.push(
      `<Array as="points">${g.points.map((p) => `<mxPoint x="${num(p.x)}" y="${num(p.y)}"/>`).join('')}</Array>`,
    );
  if (g.offset && (g.offset.x || g.offset.y))
    kids.push(`<mxPoint x="${num(g.offset.x)}" y="${num(g.offset.y)}" as="offset"/>`);
  const open = `<mxGeometry ${[...a, 'as="geometry"'].join(' ')}`;
  return kids.length ? `${open}>${kids.join('')}</mxGeometry>` : `${open}/>`;
}

function cellXml(cell: Cell, ids: Map<Cell, string>): string {
  const idOf = (c: Cell) => ids.get(c) ?? c.getId() ?? '';
  const id = idOf(cell);
  const a = [`id="${attr(id)}"`];
  const value = cell.getValue();
  if (value !== null && value !== undefined && value !== '')
    a.push(`value="${attr(String(value))}"`);
  let style = styleToString(cell.getStyle());
  // Label diedit sebagai HTML; tandai supaya aplikasi lain tidak menampilkan tag mentah.
  if ((cell.isVertex() || cell.isEdge()) && !/(^|;)html=/.test(style)) style += 'html=1;';
  if (style) a.push(`style="${attr(style)}"`);
  if (cell.isVertex()) a.push('vertex="1"');
  if (cell.isEdge()) a.push('edge="1"');
  if (!cell.isVisible()) a.push('visible="0"');
  if (cell.isCollapsed()) a.push('collapsed="1"');
  const parent = cell.getParent();
  if (parent) a.push(`parent="${attr(idOf(parent))}"`);
  const src = cell.getTerminal(true);
  const tgt = cell.getTerminal(false);
  if (src) a.push(`source="${attr(idOf(src))}"`);
  if (tgt) a.push(`target="${attr(idOf(tgt))}"`);
  const geo = geometryXml(cell);
  return geo ? `<mxCell ${a.join(' ')}>${geo}</mxCell>` : `<mxCell ${a.join(' ')}/>`;
}

/** Semua sel model (root, layer, lalu isinya) dalam urutan pohon. */
function walk(cell: Cell, out: Cell[]) {
  out.push(cell);
  for (const c of cell.children ?? []) walk(c, out);
}

export interface ModelOptions {
  background?: string;
  grid?: boolean;
  gridSize?: number;
}

export function modelToXml(model: GraphDataModel, opts: ModelOptions = {}): string {
  const root = model.getRoot();
  const cells: Cell[] = [];
  if (root) walk(root, cells);
  const a = [
    `grid="${opts.grid === false ? 0 : 1}"`,
    `gridSize="${opts.gridSize ?? 10}"`,
    'guides="1"',
    'connect="1"',
    'arrows="1"',
    'page="0"',
  ];
  if (opts.background && opts.background !== 'none')
    a.push(`background="${attr(opts.background)}"`);
  // Id kosong atau ganda membuat file rusak saat dibuka lagi: beri id baru yang unik.
  const ids = new Map<Cell, string>();
  const used = new Set<string>();
  let n = 0;
  for (const c of cells) {
    let id = c.getId() ?? '';
    if (!id || used.has(id)) {
      do id = `c${++n}`;
      while (used.has(id) || cells.some((x) => x.getId() === id));
    }
    used.add(id);
    ids.set(c, id);
  }
  return `<mxGraphModel ${a.join(' ')}><root>${cells.map((c) => cellXml(c, ids)).join('')}</root></mxGraphModel>`;
}

/** Bungkus beberapa halaman menjadi file .drawio (tanpa kompresi, mudah dibaca dan di-diff). */
export function toDrawioFile(pages: DrawioPage[]): string {
  const diagrams = pages
    .map((p, i) => `<diagram id="page-${i + 1}" name="${attr(p.name)}">${p.model}</diagram>`)
    .join('');
  return `<mxfile host="Toolland" agent="Toolland Editor Diagram" type="device">${diagrams}</mxfile>`;
}

function decompress(text: string): string {
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const raw = strFromU8(inflateSync(bytes), true);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export class DrawioError extends Error {}

/** Baca isi file .drawio/.xml menjadi daftar halaman. */
export function readDrawio(text: string): DrawioPage[] {
  const doc = new DOMParser().parseFromString(text.trim(), 'text/xml');
  const root = doc.documentElement;
  if (!root || doc.getElementsByTagName('parsererror').length) throw new DrawioError('xml');
  const ser = new XMLSerializer();
  if (root.nodeName === 'mxGraphModel')
    return [{ name: 'Page-1', model: ser.serializeToString(root) }];
  if (root.nodeName !== 'mxfile') throw new DrawioError('format');
  const pages: DrawioPage[] = [];
  for (const d of Array.from(root.getElementsByTagName('diagram'))) {
    const name = d.getAttribute('name') || `Page-${pages.length + 1}`;
    const inner = Array.from(d.children).find((c) => c.nodeName === 'mxGraphModel');
    if (inner) pages.push({ name, model: ser.serializeToString(inner) });
    else if (d.textContent?.trim()) {
      let xml: string;
      try {
        xml = decompress(d.textContent);
      } catch {
        throw new DrawioError('compressed');
      }
      if (!xml.includes('<mxGraphModel')) throw new DrawioError('compressed');
      pages.push({ name, model: xml });
    }
  }
  if (!pages.length) throw new DrawioError('empty');
  return pages;
}

/** Atribut halaman (warna latar, grid) dari XML mxGraphModel. */
export function modelOptions(xml: string): ModelOptions {
  const m = /<mxGraphModel\b([^>]*)>/.exec(xml);
  if (!m) return {};
  const get = (k: string) => new RegExp(`\\b${k}="([^"]*)"`).exec(m[1])?.[1];
  const bg = get('background');
  const size = Number(get('gridSize'));
  return {
    background: bg && bg !== 'none' ? bg : undefined,
    grid: get('grid') !== '0',
    gridSize: Number.isFinite(size) && size > 0 ? size : 10,
  };
}
