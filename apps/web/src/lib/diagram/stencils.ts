/**
 * Stencil (XML bentuk) untuk shape yang tidak tersedia bawaan maxGraph. Nama shape sengaja sama
 * dengan nama yang dipakai file .drawio (misalnya "document", "process", "manualInput"), supaya
 * file yang dibuka/disimpan tetap tampil benar di aplikasi diagram lain yang memakai format itu.
 *
 * Koordinat path memakai ruang w × h stencil dan diskalakan ke ukuran shape (aspect="variable").
 */
import { StencilShape, StencilShapeRegistry } from '@maxgraph/core';

/** Titik sambung standar: 4 sisi tengah + 4 sudut (sama seperti shape persegi di editor lain). */
const BOX_POINTS = `<connections>
  <constraint x="0.5" y="0" perimeter="1"/><constraint x="0.5" y="1" perimeter="1"/>
  <constraint x="0" y="0.5" perimeter="1"/><constraint x="1" y="0.5" perimeter="1"/>
  <constraint x="0.25" y="0" perimeter="1"/><constraint x="0.75" y="0" perimeter="1"/>
  <constraint x="0.25" y="1" perimeter="1"/><constraint x="0.75" y="1" perimeter="1"/>
</connections>`;

/** Bentuk sederhana: satu path tertutup lalu isi dan garis. */
function closed(name: string, w: number, h: number, path: string, extra = ''): string {
  return `<shape name="${name}" w="${w}" h="${h}" aspect="variable" strokewidth="inherit">
${BOX_POINTS}
<background><path>${path}<close/></path></background>
<foreground><fillstroke/>${extra}</foreground>
</shape>`;
}

const M = (x: number, y: number) => `<move x="${x}" y="${y}"/>`;
const L = (x: number, y: number) => `<line x="${x}" y="${y}"/>`;
const C = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
  `<curve x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" x3="${x3}" y3="${y3}"/>`;
const A = (rx: number, ry: number, x: number, y: number, large = 0, sweep = 1) =>
  `<arc rx="${rx}" ry="${ry}" x-axis-rotation="0" large-arc-flag="${large}" sweep-flag="${sweep}" x="${x}" y="${y}"/>`;
const line = (x1: number, y1: number, x2: number, y2: number) =>
  `<path>${M(x1, y1)}${L(x2, y2)}</path><stroke/>`;

export const STENCILS: Record<string, string> = {
  // Flowchart: data / input-output.
  parallelogram: closed('parallelogram', 100, 60, M(20, 0) + L(100, 0) + L(80, 60) + L(0, 60)),
  trapezoid: closed('trapezoid', 100, 60, M(20, 0) + L(80, 0) + L(100, 60) + L(0, 60)),
  // Proses terdefinisi (subrutin).
  process: closed(
    'process',
    100,
    60,
    M(0, 0) + L(100, 0) + L(100, 60) + L(0, 60),
    line(12, 0, 12, 60) + line(88, 0, 88, 60),
  ),
  document: closed(
    'document',
    100,
    70,
    M(0, 0) + L(100, 0) + L(100, 60) + C(75, 45, 50, 75, 25, 68) + C(12, 64, 5, 60, 0, 60),
  ),
  manualInput: closed('manualInput', 100, 60, M(0, 18) + L(100, 0) + L(100, 60) + L(0, 60)),
  manualOperation: closed('manualOperation', 100, 60, M(0, 0) + L(100, 0) + L(80, 60) + L(20, 60)),
  delay: closed('delay', 100, 60, M(0, 0) + L(70, 0) + A(30, 30, 70, 60) + L(0, 60)),
  offPageConnector: closed(
    'offPageConnector',
    60,
    60,
    M(0, 0) + L(60, 0) + L(60, 40) + L(30, 60) + L(0, 40),
  ),
  card: closed('card', 100, 60, M(18, 0) + L(100, 0) + L(100, 60) + L(0, 60) + L(0, 18)),
  tape: closed(
    'tape',
    100,
    60,
    M(0, 6) + C(25, 18, 75, -6, 100, 6) + L(100, 54) + C(75, 42, 25, 66, 0, 54),
  ),
  dataStorage: closed(
    'dataStorage',
    100,
    60,
    M(15, 0) + L(100, 0) + C(88, 15, 88, 45, 100, 60) + L(15, 60) + C(-5, 45, -5, 15, 15, 0),
  ),
  internalStorage: closed(
    'internalStorage',
    100,
    60,
    M(0, 0) + L(100, 0) + L(100, 60) + L(0, 60),
    line(15, 0, 15, 60) + line(0, 15, 100, 15),
  ),
  display: closed(
    'display',
    100,
    60,
    M(0, 30) + L(20, 0) + L(75, 0) + C(105, 0, 105, 60, 75, 60) + L(20, 60),
  ),
  loopLimit: closed(
    'loopLimit',
    100,
    60,
    M(15, 0) + L(85, 0) + L(100, 15) + L(100, 60) + L(0, 60) + L(0, 15),
  ),
  step: closed('step', 100, 60, M(0, 0) + L(80, 0) + L(100, 30) + L(80, 60) + L(0, 60) + L(20, 30)),
  sortShape: closed(
    'sortShape',
    60,
    60,
    M(30, 0) + L(60, 30) + L(30, 60) + L(0, 30),
    line(0, 30, 60, 30),
  ),
  collate: closed('collate', 60, 60, M(0, 0) + L(60, 0) + L(0, 60) + L(60, 60)),
  merge: closed('merge', 60, 50, M(0, 0) + L(60, 0) + L(30, 50)),
  extract: closed('extract', 60, 50, M(30, 0) + L(60, 50) + L(0, 50)),
  callout: closed(
    'callout',
    100,
    70,
    M(0, 0) + L(100, 0) + L(100, 50) + L(45, 50) + L(25, 70) + L(28, 50) + L(0, 50),
  ),
  note: closed(
    'note',
    80,
    100,
    M(0, 0) + L(62, 0) + L(80, 18) + L(80, 100) + L(0, 100),
    `<path>${M(62, 0)}${L(62, 18)}${L(80, 18)}</path><stroke/>`,
  ),
  singleArrow: closed(
    'singleArrow',
    100,
    60,
    M(0, 18) + L(65, 18) + L(65, 0) + L(100, 30) + L(65, 60) + L(65, 42) + L(0, 42),
  ),
  doubleArrow: closed(
    'doubleArrow',
    100,
    60,
    M(0, 30) +
      L(30, 0) +
      L(30, 18) +
      L(70, 18) +
      L(70, 0) +
      L(100, 30) +
      L(70, 60) +
      L(70, 42) +
      L(30, 42) +
      L(30, 60),
  ),
  cross: closed(
    'cross',
    60,
    60,
    M(20, 0) +
      L(40, 0) +
      L(40, 20) +
      L(60, 20) +
      L(60, 40) +
      L(40, 40) +
      L(40, 60) +
      L(20, 60) +
      L(20, 40) +
      L(0, 40) +
      L(0, 20) +
      L(20, 20),
  ),
  // Lingkaran dengan tanda silang (summing junction) dan tanda plus (or).
  sumEllipse: `<shape name="sumEllipse" w="60" h="60" aspect="variable" strokewidth="inherit">
${BOX_POINTS}
<background><ellipse x="0" y="0" w="60" h="60"/></background>
<foreground><fillstroke/>${line(9, 9, 51, 51)}${line(51, 9, 9, 51)}</foreground>
</shape>`,
  or: `<shape name="or" w="60" h="60" aspect="variable" strokewidth="inherit">
${BOX_POINTS}
<background><ellipse x="0" y="0" w="60" h="60"/></background>
<foreground><fillstroke/>${line(30, 0, 30, 60)}${line(0, 30, 60, 30)}</foreground>
</shape>`,
};

let registered = false;

/** Daftarkan semua stencil sekali per halaman. */
export function registerStencils(extra: Record<string, string> = {}): void {
  const all = registered ? extra : { ...STENCILS, ...extra };
  registered = true;
  const parser = new DOMParser();
  for (const [name, xml] of Object.entries(all)) {
    const doc = parser.parseFromString(xml, 'text/xml');
    const root = doc.documentElement;
    if (root.nodeName !== 'shape') throw new Error(`Stencil rusak: ${name}`);
    StencilShapeRegistry.add(name, new StencilShape(root));
  }
}
