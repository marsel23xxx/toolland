/**
 * Penulis file .xlsx (Office Open XML) kecil, khusus untuk template Toolland.
 * Mendukung: banyak sheet, gaya sel, rumus, gabung sel, bekukan panel, dropdown (data
 * validation), format bersyarat, filter, link antar-sheet, nama rentang, grafik, dan pengaturan
 * cetak. Hasilnya dibuka di Excel, Google Sheets, LibreOffice, dan WPS.
 *
 * Rumus ditulis tanpa hasil tersimpan; workbook ditandai "hitung ulang saat dibuka".
 */
import { strToU8, zipSync } from 'fflate';
import { type Chart, chartXml } from './chart';
import { cellRef, colIndex, colName, escXml, parseRange, parseRef, quoteSheet } from './ref';
import { type Dxf, type Style, StyleSheet } from './styles';
import { THEME_XML } from './theme';

export type Formula = { f: string };
export type Value = string | number | boolean | Formula | null | undefined;

interface Cell {
  v: Value;
  s: number;
}

export interface Validation {
  type: 'list' | 'decimal' | 'whole' | 'date' | 'custom';
  /** Untuk list: rujukan rentang/nama ("=Kategori") atau daftar ('"Ya,Tidak"'). */
  formula1: string;
  formula2?: string;
  operator?: 'between' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'greaterThan' | 'equal';
  allowBlank?: boolean;
  promptTitle?: string;
  prompt?: string;
  errorTitle?: string;
  error?: string;
  /** stop = tolak isian salah; warning = boleh dilanjutkan setelah peringatan. */
  errorStyle?: 'stop' | 'warning' | 'information';
}

export type CondRule =
  | { type: 'expression'; formula: string; style: Dxf; stop?: boolean }
  | {
      type: 'cellIs';
      operator:
        'lessThan' | 'greaterThan' | 'equal' | 'between' | 'lessThanOrEqual' | 'greaterThanOrEqual';
      formula: string;
      formula2?: string;
      style: Dxf;
    }
  | { type: 'dataBar'; color: string; min?: string; max?: string };

export interface SheetOptions {
  tabColor?: string;
  gridlines?: boolean;
  zoom?: number;
  hidden?: boolean;
  landscape?: boolean;
  /** Muat lebar halaman cetak dalam 1 halaman. */
  fitWidth?: boolean;
  /** Tinggi baris bawaan (poin). */
  rowHeight?: number;
}

export class Sheet {
  readonly rows = new Map<number, Map<number, Cell>>();
  readonly cols: { min: number; max: number; width: number; hidden?: boolean }[] = [];
  readonly rowProps = new Map<number, { height?: number; hidden?: boolean }>();
  readonly merges: string[] = [];
  readonly validations: { sqref: string; v: Validation }[] = [];
  readonly conds: { sqref: string; rule: CondRule }[] = [];
  readonly links: { ref: string; location: string; tooltip?: string }[] = [];
  readonly charts: Chart[] = [];
  filter?: string;
  freezeAt?: string;
  printTitleRows?: [number, number];
  printArea?: string;

  constructor(
    readonly name: string,
    readonly opts: SheetOptions,
    private styles: StyleSheet,
  ) {
    if (name.length > 31 || /[[\]:*?/\\]/.test(name))
      throw new Error(`Nama sheet tidak sah: ${name}`);
  }

  /** Isi satu sel. Teks yang diawali "=" dianggap rumus. */
  set(ref: string, v: Value, style?: Style): this {
    const { c, r } = parseRef(ref);
    return this.cell(c, r, v, style);
  }

  cell(c: number, r: number, v: Value, style?: Style): this {
    let row = this.rows.get(r);
    if (!row) this.rows.set(r, (row = new Map()));
    const val = typeof v === 'string' && v.startsWith('=') ? { f: v.slice(1) } : v;
    row.set(c, { v: val, s: this.styles.xf(style) });
    return this;
  }

  /** Beri gaya ke seluruh rentang. Isi sel yang sudah ada tetap. */
  style(range: string, style: Style): this {
    const s = this.styles.xf(style);
    const { c1, r1, c2, r2 } = parseRange(range);
    for (let r = r1; r <= r2; r++) {
      let row = this.rows.get(r);
      if (!row) this.rows.set(r, (row = new Map()));
      for (let c = c1; c <= c2; c++) {
        const old = row.get(c);
        row.set(c, { v: old?.v ?? null, s });
      }
    }
    return this;
  }

  /** Isi rumus yang sama ke banyak baris; "{r}" diganti nomor baris. */
  fillDown(col: string, r1: number, r2: number, formula: string, style?: Style): this {
    const c = colIndex(col);
    for (let r = r1; r <= r2; r++) this.cell(c, r, formula.replaceAll('{r}', String(r)), style);
    return this;
  }

  merge(range: string, v?: Value, style?: Style): this {
    const { c1, r1 } = parseRange(range);
    this.merges.push(range);
    if (style) this.style(range, style);
    if (v !== undefined) this.cell(c1, r1, v, style);
    return this;
  }

  width(col: string, width: number, hidden = false): this {
    const c = colIndex(col);
    this.cols.push({ min: c, max: c, width, hidden });
    return this;
  }

  widths(map: Record<string, number>): this {
    for (const [col, w] of Object.entries(map)) this.width(col, w);
    return this;
  }

  height(row: number, height: number): this {
    this.rowProps.set(row, { ...this.rowProps.get(row), height });
    return this;
  }

  hideRow(row: number): this {
    this.rowProps.set(row, { ...this.rowProps.get(row), hidden: true });
    return this;
  }

  /** Bekukan baris di atas dan kolom di kiri sel ini. */
  freeze(ref: string): this {
    this.freezeAt = ref;
    return this;
  }

  validate(sqref: string, v: Validation): this {
    this.validations.push({ sqref, v });
    return this;
  }

  cond(sqref: string, rule: CondRule): this {
    this.conds.push({ sqref, rule });
    return this;
  }

  /** Link ke lokasi lain di workbook, misalnya "'Transaksi'!A1". */
  link(ref: string, location: string, tooltip?: string): this {
    this.links.push({ ref, location, tooltip });
    return this;
  }

  chart(ch: Chart): this {
    this.charts.push(ch);
    return this;
  }

  autoFilter(range: string): this {
    this.filter = range;
    return this;
  }

  printTitles(first: number, last: number): this {
    this.printTitleRows = [first, last];
    return this;
  }

  toXml(active: boolean, drawingRid?: string): string {
    const o = this.opts;
    const rowNums = [...this.rows.keys(), ...this.rowProps.keys()];
    let maxC = 1;
    for (const row of this.rows.values()) for (const c of row.keys()) maxC = Math.max(maxC, c);
    const maxR = Math.max(1, ...rowNums);

    const sheetPr =
      o.tabColor || o.fitWidth
        ? '<sheetPr>' +
          (o.tabColor ? `<tabColor rgb="FF${o.tabColor}"/>` : '') +
          (o.fitWidth ? '<pageSetUpPr fitToPage="1"/>' : '') +
          '</sheetPr>'
        : '';

    let pane = '';
    if (this.freezeAt) {
      const { c, r } = parseRef(this.freezeAt);
      const x = c - 1;
      const y = r - 1;
      const which = x && y ? 'bottomRight' : y ? 'bottomLeft' : 'topRight';
      pane =
        `<pane${x ? ` xSplit="${x}"` : ''}${y ? ` ySplit="${y}"` : ''} topLeftCell="${this.freezeAt}" activePane="${which}" state="frozen"/>` +
        `<selection pane="${which}" activeCell="${this.freezeAt}" sqref="${this.freezeAt}"/>`;
    }
    const view =
      `<sheetViews><sheetView workbookViewId="0"` +
      (o.gridlines === false ? ' showGridLines="0"' : '') +
      (active ? ' tabSelected="1"' : '') +
      (o.zoom ? ` zoomScale="${o.zoom}" zoomScaleNormal="${o.zoom}"` : '') +
      `>${pane}</sheetView></sheetViews>`;

    const cols = this.cols.length
      ? '<cols>' +
        [...this.cols]
          .sort((a, b) => a.min - b.min)
          .map(
            (c) =>
              `<col min="${c.min}" max="${c.max}" width="${c.width}" customWidth="1"${c.hidden ? ' hidden="1"' : ''}/>`,
          )
          .join('') +
        '</cols>'
      : '';

    const rows = [...new Set(rowNums)]
      .sort((a, b) => a - b)
      .map((r) => {
        const p = this.rowProps.get(r);
        const cells = [...(this.rows.get(r) ?? new Map<number, Cell>())]
          .sort((a, b) => a[0] - b[0])
          .map(([c, cell]) => cellXml(cellRef(c, r), cell, this.sst))
          .join('');
        return (
          `<row r="${r}"` +
          (p?.height ? ` ht="${p.height}" customHeight="1"` : '') +
          (p?.hidden ? ' hidden="1"' : '') +
          `>${cells}</row>`
        );
      })
      .join('');

    const merges = this.merges.length
      ? `<mergeCells count="${this.merges.length}">${this.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    let prio = 1;
    const conds = this.conds
      .map(({ sqref, rule }) => {
        let inner: string;
        if (rule.type === 'dataBar') {
          inner =
            `<cfRule type="dataBar" priority="${prio++}"><dataBar>` +
            `<cfvo type="${rule.min ? 'num' : 'min'}"${rule.min ? ` val="${rule.min}"` : ''}/>` +
            `<cfvo type="${rule.max ? 'num' : 'max'}"${rule.max ? ` val="${rule.max}"` : ''}/>` +
            `<color rgb="FF${rule.color}"/></dataBar></cfRule>`;
        } else if (rule.type === 'expression') {
          inner =
            `<cfRule type="expression" dxfId="${this.styles.dxf(rule.style)}" priority="${prio++}"${rule.stop ? ' stopIfTrue="1"' : ''}>` +
            `<formula>${escXml(rule.formula)}</formula></cfRule>`;
        } else {
          inner =
            `<cfRule type="cellIs" dxfId="${this.styles.dxf(rule.style)}" priority="${prio++}" operator="${rule.operator}">` +
            `<formula>${escXml(rule.formula)}</formula>` +
            (rule.formula2 ? `<formula>${escXml(rule.formula2)}</formula>` : '') +
            '</cfRule>';
        }
        return `<conditionalFormatting sqref="${sqref}">${inner}</conditionalFormatting>`;
      })
      .join('');

    const dv = this.validations.length
      ? `<dataValidations count="${this.validations.length}">` +
        this.validations
          .map(({ sqref, v }) => {
            const f1 = v.formula1.replace(/^=/, '');
            return (
              `<dataValidation type="${v.type}"` +
              (v.errorStyle && v.errorStyle !== 'stop' ? ` errorStyle="${v.errorStyle}"` : '') +
              (v.operator ? ` operator="${v.operator}"` : '') +
              ` allowBlank="${v.allowBlank === false ? 0 : 1}" showInputMessage="1" showErrorMessage="1"` +
              (v.errorTitle ? ` errorTitle="${escXml(v.errorTitle)}"` : '') +
              (v.error ? ` error="${escXml(v.error)}"` : '') +
              (v.promptTitle ? ` promptTitle="${escXml(v.promptTitle)}"` : '') +
              (v.prompt ? ` prompt="${escXml(v.prompt)}"` : '') +
              ` sqref="${sqref}"><formula1>${escXml(f1)}</formula1>` +
              (v.formula2 ? `<formula2>${escXml(v.formula2.replace(/^=/, ''))}</formula2>` : '') +
              '</dataValidation>'
            );
          })
          .join('') +
        '</dataValidations>'
      : '';

    const links = this.links.length
      ? '<hyperlinks>' +
        this.links
          .map(
            (l) =>
              `<hyperlink ref="${l.ref}" location="${escXml(l.location)}" display="${escXml(l.tooltip ?? l.location)}"` +
              (l.tooltip ? ` tooltip="${escXml(l.tooltip)}"` : '') +
              '/>',
          )
          .join('') +
        '</hyperlinks>'
      : '';

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      sheetPr +
      `<dimension ref="A1:${cellRef(maxC, maxR)}"/>` +
      view +
      `<sheetFormatPr defaultRowHeight="${o.rowHeight ?? 15}"${o.rowHeight ? ' customHeight="1"' : ''}/>` +
      cols +
      `<sheetData>${rows}</sheetData>` +
      (this.filter ? `<autoFilter ref="${this.filter}"/>` : '') +
      merges +
      conds +
      dv +
      links +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      `<pageSetup paperSize="9" orientation="${o.landscape ? 'landscape' : 'portrait'}"` +
      (o.fitWidth ? ' fitToWidth="1" fitToHeight="0"' : '') +
      '/>' +
      `<headerFooter><oddFooter>&amp;L${escXml(this.name)}&amp;R&amp;P / &amp;N</oddFooter></headerFooter>` +
      (drawingRid ? `<drawing r:id="${drawingRid}"/>` : '') +
      '</worksheet>'
    );
  }

  /** Diisi oleh Workbook sebelum toXml dipanggil. */
  sst!: SharedStrings;
}

class SharedStrings {
  private map = new Map<string, number>();
  readonly list: string[] = [];
  count = 0;
  index(s: string): number {
    this.count++;
    let i = this.map.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.list.push(s);
      this.map.set(s, i);
    }
    return i;
  }
  toXml(): string {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.count}" uniqueCount="${this.list.length}">` +
      this.list.map((s) => `<si><t xml:space="preserve">${escXml(s)}</t></si>`).join('') +
      '</sst>'
    );
  }
}

function cellXml(ref: string, cell: Cell, sst: SharedStrings): string {
  const s = cell.s ? ` s="${cell.s}"` : '';
  const v = cell.v;
  if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return `<c r="${ref}"${s}/>`;
    return `<c r="${ref}"${s}><v>${v}</v></c>`;
  }
  if (typeof v === 'boolean') return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  if (typeof v === 'object') return `<c r="${ref}"${s}><f>${escXml(v.f)}</f></c>`;
  return `<c r="${ref}"${s} t="s"><v>${sst.index(v)}</v></c>`;
}

export interface WorkbookInfo {
  title?: string;
  subject?: string;
  creator?: string;
  company?: string;
}

export class Workbook {
  readonly styles = new StyleSheet();
  readonly sheets: Sheet[] = [];
  private names: { name: string; ref: string; sheet?: number; hidden?: boolean }[] = [];
  activeSheet = 0;

  constructor(readonly info: WorkbookInfo = {}) {}

  addSheet(name: string, opts: SheetOptions = {}): Sheet {
    if (this.sheets.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      throw new Error(`Nama sheet ganda: ${name}`);
    const sheet = new Sheet(name, opts, this.styles);
    this.sheets.push(sheet);
    return sheet;
  }

  /** Nama rentang, misalnya defineName('Kategori', "'Pengaturan'!$B$5:$B$40"). */
  defineName(name: string, ref: string, hidden = false): this {
    this.names.push({ name, ref, hidden });
    return this;
  }

  toBytes(): Uint8Array<ArrayBuffer> {
    const sst = new SharedStrings();
    const files: Record<string, Uint8Array> = {};
    const put = (path: string, xml: string) => (files[path] = strToU8(xml));

    const ctOverrides: string[] = [];
    let chartNo = 0;
    this.sheets.forEach((sheet, i) => {
      sheet.sst = sst;
      const n = i + 1;
      let drawingRid: string | undefined;
      if (sheet.charts.length) {
        drawingRid = 'rId1';
        const anchors: string[] = [];
        const drawingRels: string[] = [];
        sheet.charts.forEach((ch, k) => {
          chartNo++;
          put(`xl/charts/chart${chartNo}.xml`, chartXml(ch));
          ctOverrides.push(
            `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
          );
          drawingRels.push(
            `<Relationship Id="rId${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNo}.xml"/>`,
          );
          anchors.push(anchorXml(ch, k + 1));
        });
        put(
          `xl/drawings/drawing${n}.xml`,
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
            anchors.join('') +
            '</xdr:wsDr>',
        );
        put(`xl/drawings/_rels/drawing${n}.xml.rels`, rels(drawingRels));
        put(
          `xl/worksheets/_rels/sheet${n}.xml.rels`,
          rels([
            `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/>`,
          ]),
        );
        ctOverrides.push(
          `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
        );
      }
      put(`xl/worksheets/sheet${n}.xml`, sheet.toXml(i === this.activeSheet, drawingRid));
      ctOverrides.push(
        `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      );
    });

    // Nama khusus per sheet: filter, judul cetak.
    const names = [...this.names];
    this.sheets.forEach((s, i) => {
      if (s.filter) {
        const { c1, r1, c2, r2 } = parseRange(s.filter);
        names.push({
          name: '_xlnm._FilterDatabase',
          ref: `${quoteSheet(s.name)}!$${colName(c1)}$${r1}:$${colName(c2)}$${r2}`,
          sheet: i,
          hidden: true,
        });
      }
      if (s.printTitleRows) {
        const [a, b] = s.printTitleRows;
        names.push({
          name: '_xlnm.Print_Titles',
          ref: `${quoteSheet(s.name)}!$${a}:$${b}`,
          sheet: i,
        });
      }
    });

    const sheetsXml = this.sheets
      .map(
        (s, i) =>
          `<sheet name="${escXml(s.name)}" sheetId="${i + 1}"${s.opts.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`,
      )
      .join('');
    const namesXml = names.length
      ? '<definedNames>' +
        names
          .map(
            (d) =>
              `<definedName name="${d.name}"${d.sheet !== undefined ? ` localSheetId="${d.sheet}"` : ''}${d.hidden ? ' hidden="1"' : ''}>${escXml(d.ref)}</definedName>`,
          )
          .join('') +
        '</definedNames>'
      : '';
    put(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<workbookPr defaultThemeVersion="164011"/>' +
        `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000" activeTab="${this.activeSheet}"/></bookViews>` +
        `<sheets>${sheetsXml}</sheets>${namesXml}` +
        '<calcPr calcId="191029" fullCalcOnLoad="1"/>' +
        '</workbook>',
    );

    const n = this.sheets.length;
    put(
      'xl/_rels/workbook.xml.rels',
      rels([
        ...this.sheets.map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        ),
        `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
        `<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`,
        `<Relationship Id="rId${n + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`,
      ]),
    );
    // styles dan sharedStrings ditulis terakhir: baru lengkap setelah semua sheet dirender.
    put('xl/styles.xml', this.styles.toXml());
    put('xl/sharedStrings.xml', sst.toXml());
    put('xl/theme/theme1.xml', THEME_XML);

    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const i = this.info;
    put(
      'docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        (i.title ? `<dc:title>${escXml(i.title)}</dc:title>` : '') +
        (i.subject ? `<dc:subject>${escXml(i.subject)}</dc:subject>` : '') +
        `<dc:creator>${escXml(i.creator ?? 'Toolland')}</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
        '</cp:coreProperties>',
    );
    put(
      'docProps/app.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">' +
        '<Application>Toolland</Application>' +
        (i.company ? `<Company>${escXml(i.company)}</Company>` : '') +
        '</Properties>',
    );
    put(
      '_rels/.rels',
      rels([
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
      ]),
    );
    put(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        ctOverrides.join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
        '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>',
    );

    // [Content_Types].xml harus menjadi entri pertama di arsip.
    const ordered: Record<string, Uint8Array> = {
      '[Content_Types].xml': files['[Content_Types].xml'],
    };
    for (const [k, v] of Object.entries(files)) if (k !== '[Content_Types].xml') ordered[k] = v;
    return zipSync(ordered, { level: 6 }) as Uint8Array<ArrayBuffer>;
  }

  /** File .xlsx siap diunduh. */
  toBlob(): Blob {
    return new Blob([this.toBytes()], { type: XLSX_MIME });
  }
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function rels(items: string[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`
  );
}

function anchorXml(ch: Chart, id: number): string {
  const a = parseRef(ch.from);
  const b = parseRef(ch.to);
  const pos = (p: { c: number; r: number }) =>
    `<xdr:col>${p.c - 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p.r - 1}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  return (
    `<xdr:twoCellAnchor editAs="oneCell"><xdr:from>${pos(a)}</xdr:from><xdr:to>${pos(b)}</xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${id + 1}" name="${escXml(ch.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
    `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${id}"/>` +
    '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>'
  );
}
