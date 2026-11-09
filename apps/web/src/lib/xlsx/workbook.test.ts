import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { Workbook, colIndex, colName, excelDate, parseRef } from './index';
import { absRange, parseRange } from './ref';

/** Buka hasil .xlsx dan pastikan setiap file XML di dalamnya sah. */
function open(wb: Workbook): Record<string, string> {
  const files = unzipSync(wb.toBytes());
  const out: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    const xml = strFromU8(bytes);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0);
    out[name] = xml;
  }
  return out;
}

describe('xlsx', () => {
  it('alamat sel dan tanggal', () => {
    expect(colName(1)).toBe('A');
    expect(colName(26)).toBe('Z');
    expect(colName(27)).toBe('AA');
    expect(colName(703)).toBe('AAA');
    expect(colIndex('AB')).toBe(28);
    expect(parseRef('$C$12')).toEqual({ c: 3, r: 12 });
    expect(parseRange('D9:B5')).toEqual({ c1: 2, r1: 5, c2: 4, r2: 9 });
    expect(absRange("Laba'Rugi", 'B5:C9')).toBe("'Laba''Rugi'!$B$5:$C$9");
    expect(excelDate(1900, 3, 1)).toBe(61);
    expect(excelDate(2026, 1, 1)).toBe(46023);
  });

  it('isi workbook lengkap dan sah', () => {
    const wb = new Workbook({ title: 'Uji <A&B>' });
    const s = wb.addSheet('Data', { tabColor: '983C09', gridlines: false, fitWidth: true });
    s.set('A1', 'Halo & <dunia>', { font: { bold: true } });
    s.set('A2', 'Halo & <dunia>');
    s.set('B1', 1234.5, { numFmt: '"Rp"#,##0' });
    s.set('B2', '=SUM(B1,1)');
    s.set('C1', true);
    s.merge('D1:E1', 'gabung');
    s.validate('F1:F9', { type: 'list', formula1: '"Ya,Tidak"' });
    s.cond('B1:B9', { type: 'dataBar', color: '983C09' });
    s.cond('B1:B9', { type: 'expression', formula: 'B1<0', style: { fill: 'FF0000' } });
    s.link('A1', "'Kedua'!A1", 'ke kedua');
    s.freeze('B2').autoFilter('A1:C9').printTitles(1, 1);
    s.chart({
      type: 'column',
      title: 'Grafik',
      from: 'H1',
      to: 'N15',
      series: [{ name: 'Nilai', categories: "'Data'!$A$1:$A$2", values: "'Data'!$B$1:$B$2" }],
    });
    wb.addSheet('Kedua', { hidden: true }).set('A1', "='Data'!B1*2");
    wb.defineName('Nilai', "'Data'!$B$1:$B$2");

    const f = open(wb);
    expect(Object.keys(unzipSync(wb.toBytes()))[0]).toBe('[Content_Types].xml');
    for (const part of [
      'xl/workbook.xml',
      'xl/styles.xml',
      'xl/sharedStrings.xml',
      'xl/theme/theme1.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/charts/chart1.xml',
      'xl/drawings/drawing1.xml',
      'xl/worksheets/_rels/sheet1.xml.rels',
    ])
      expect(f[part], part).toBeTruthy();
    const sheet = f['xl/worksheets/sheet1.xml'];
    // Teks yang sama hanya disimpan sekali.
    expect(f['xl/sharedStrings.xml']).toContain('count="3" uniqueCount="2"');
    expect(f['xl/sharedStrings.xml']).toContain('Halo &amp; &lt;dunia&gt;');
    expect(sheet).toContain('<f>SUM(B1,1)</f>');
    expect(sheet).toContain('<pane xSplit="1" ySplit="1" topLeftCell="B2"');
    expect(sheet).toContain('<mergeCell ref="D1:E1"/>');
    expect(sheet).toContain('<formula1>&quot;Ya,Tidak&quot;</formula1>');
    expect(sheet).toContain('<drawing r:id="rId1"/>');
    // Urutan elemen worksheet wajib mengikuti skema Excel.
    const order = [
      '<sheetPr>',
      '<sheetViews>',
      '<sheetData>',
      '<autoFilter',
      '<mergeCells',
      '<conditionalFormatting',
      '<dataValidations',
      '<hyperlinks>',
      '<pageSetup',
      '<drawing',
    ];
    const pos = order.map((tag) => sheet.indexOf(tag));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    expect(f['xl/workbook.xml']).toContain('state="hidden"');
    expect(f['xl/workbook.xml']).toContain('fullCalcOnLoad="1"');
    expect(f['xl/workbook.xml']).toContain('<definedName name="Nilai">');
    expect(f['xl/workbook.xml']).toContain('_xlnm._FilterDatabase');
    expect(f['[Content_Types].xml']).toContain('/xl/charts/chart1.xml');
  });

  it('gaya yang sama dipakai ulang', () => {
    const wb = new Workbook();
    const a = wb.styles.xf({ font: { bold: true }, fill: 'FFFFFF' });
    const b = wb.styles.xf({ font: { bold: true }, fill: 'FFFFFF' });
    expect(a).toBe(b);
    expect(wb.styles.xf()).toBe(0);
    expect(wb.styles.xf({ numFmt: '0.0%' })).not.toBe(a);
  });

  it('nama sheet tidak sah ditolak', () => {
    const wb = new Workbook();
    expect(() => wb.addSheet('a/b')).toThrow();
    expect(() => wb.addSheet('x'.repeat(32))).toThrow();
    wb.addSheet('Data');
    expect(() => wb.addSheet('data')).toThrow();
  });
});
