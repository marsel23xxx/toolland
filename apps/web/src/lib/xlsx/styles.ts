/**
 * Gaya sel (font, isi, garis, format angka, perataan) dan gaya bersyarat (dxf).
 * Gaya yang sama hanya ditulis sekali ke styles.xml.
 */
import { escXml } from './ref';

export type BorderStyle = 'thin' | 'medium' | 'thick' | 'hair' | 'dashed' | 'dotted' | 'double';
export interface BorderSide {
  style: BorderStyle;
  color?: string;
}

export interface Font {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number;
  /** Warna RGB heksa tanpa #, misalnya "983C09". */
  color?: string;
  name?: string;
}

export interface Style {
  font?: Font;
  /** Warna isi sel (RGB heksa). */
  fill?: string;
  border?: { top?: BorderSide; bottom?: BorderSide; left?: BorderSide; right?: BorderSide };
  /** Kode format angka Excel, misalnya '"Rp"#,##0' atau 'dd/mm/yyyy'. */
  numFmt?: string;
  align?: {
    h?: 'left' | 'center' | 'right';
    v?: 'top' | 'center' | 'bottom';
    wrap?: boolean;
    indent?: number;
  };
  /** false = sel boleh diubah walau sheet dikunci. */
  locked?: boolean;
}

/** Gaya untuk format bersyarat: hanya font, isi, dan garis. */
export interface Dxf {
  font?: Pick<Font, 'bold' | 'italic' | 'color'> & { strike?: boolean };
  fill?: string;
  border?: Style['border'];
  numFmt?: string;
}

export const DEFAULT_FONT = { name: 'Calibri', size: 11 };

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;

function fontXml(f: Font = {}): string {
  return (
    '<font>' +
    (f.bold ? '<b/>' : '') +
    (f.italic ? '<i/>' : '') +
    (f.underline ? '<u/>' : '') +
    `<sz val="${f.size ?? DEFAULT_FONT.size}"/>` +
    (f.color ? `<color rgb="${argb(f.color)}"/>` : '<color theme="1"/>') +
    `<name val="${escXml(f.name ?? DEFAULT_FONT.name)}"/><family val="2"/>` +
    '</font>'
  );
}

function borderXml(b: Style['border'] = {}): string {
  const side = (tag: string, s?: BorderSide) =>
    s
      ? `<${tag} style="${s.style}"><color rgb="${argb(s.color ?? '000000')}"/></${tag}>`
      : `<${tag}/>`;
  return (
    '<border>' +
    side('left', b.left) +
    side('right', b.right) +
    side('top', b.top) +
    side('bottom', b.bottom) +
    '<diagonal/></border>'
  );
}

export class StyleSheet {
  private fonts = [fontXml()];
  private fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  private borders = [borderXml()];
  private numFmts = new Map<string, number>();
  private xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private xfIndex = new Map<string, number>([[this.xfs[0], 0]]);
  private dxfs: string[] = [];
  private dxfIndex = new Map<string, number>();

  private intern(list: string[], xml: string): number {
    const i = list.indexOf(xml);
    if (i >= 0) return i;
    list.push(xml);
    return list.length - 1;
  }

  private numFmtId(code: string): number {
    if (code === 'General') return 0;
    let id = this.numFmts.get(code);
    if (id === undefined) {
      id = 164 + this.numFmts.size;
      this.numFmts.set(code, id);
    }
    return id;
  }

  /** Nomor gaya sel (atribut s="..."). */
  xf(style?: Style): number {
    if (!style) return 0;
    const fontId = style.font ? this.intern(this.fonts, fontXml(style.font)) : 0;
    const fillId = style.fill
      ? this.intern(
          this.fills,
          `<fill><patternFill patternType="solid"><fgColor rgb="${argb(style.fill)}"/><bgColor indexed="64"/></patternFill></fill>`,
        )
      : 0;
    const borderId = style.border ? this.intern(this.borders, borderXml(style.border)) : 0;
    const numFmtId = style.numFmt ? this.numFmtId(style.numFmt) : 0;
    const a = style.align;
    const align = a
      ? '<alignment' +
        (a.h ? ` horizontal="${a.h}"` : '') +
        (a.v ? ` vertical="${a.v}"` : '') +
        (a.wrap ? ' wrapText="1"' : '') +
        (a.indent ? ` indent="${a.indent}"` : '') +
        '/>'
      : '';
    const prot = style.locked === false ? '<protection locked="0"/>' : '';
    const xml =
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      (numFmtId ? ' applyNumberFormat="1"' : '') +
      (fontId ? ' applyFont="1"' : '') +
      (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') +
      (align ? ' applyAlignment="1"' : '') +
      (prot ? ' applyProtection="1"' : '') +
      (align || prot ? `>${align}${prot}</xf>` : '/>');
    let i = this.xfIndex.get(xml);
    if (i === undefined) {
      i = this.xfs.length;
      this.xfs.push(xml);
      this.xfIndex.set(xml, i);
    }
    return i;
  }

  /** Nomor gaya bersyarat (atribut dxfId="..."). */
  dxf(d: Dxf): number {
    const f = d.font;
    const xml =
      '<dxf>' +
      (f
        ? '<font>' +
          (f.bold ? '<b/>' : '') +
          (f.italic ? '<i/>' : '') +
          (f.strike ? '<strike/>' : '') +
          (f.color ? `<color rgb="${argb(f.color)}"/>` : '') +
          '</font>'
        : '') +
      (d.numFmt
        ? `<numFmt numFmtId="${this.numFmtId(d.numFmt)}" formatCode="${escXml(d.numFmt)}"/>`
        : '') +
      (d.fill
        ? `<fill><patternFill patternType="solid"><fgColor rgb="${argb(d.fill)}"/><bgColor rgb="${argb(d.fill)}"/></patternFill></fill>`
        : '') +
      (d.border ? borderXml(d.border) : '') +
      '</dxf>';
    let i = this.dxfIndex.get(xml);
    if (i === undefined) {
      i = this.dxfs.length;
      this.dxfs.push(xml);
      this.dxfIndex.set(xml, i);
    }
    return i;
  }

  toXml(): string {
    const numFmts = [...this.numFmts]
      .map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escXml(code)}"/>`)
      .join('');
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.size ? `<numFmts count="${this.numFmts.size}">${numFmts}</numFmts>` : '') +
      `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      `<dxfs count="${this.dxfs.length}">${this.dxfs.join('')}</dxfs>` +
      '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
      '</styleSheet>'
    );
  }
}
