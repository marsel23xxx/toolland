/**
 * Grafik Excel (DrawingML chart): kolom, batang, garis, dan donat.
 * Data grafik selalu berupa rujukan ke sel, jadi grafik ikut berubah saat data diisi.
 */
import { escXml } from './ref';

export interface ChartSeries {
  /** Nama seri: teks biasa atau rujukan sel ('Laba Rugi'!$B$5). */
  name: string;
  /** Rujukan label kategori, misalnya 'Laba Rugi'!$C$4:$N$4. */
  categories: string;
  /** Rujukan nilai. */
  values: string;
  /** Warna seri (RGB heksa). */
  color?: string;
}

export interface Chart {
  type: 'column' | 'bar' | 'line' | 'doughnut';
  title: string;
  series: ChartSeries[];
  /** Posisi: sel kiri atas dan sel kanan bawah (eksklusif), misalnya 'B12' sampai 'H28'. */
  from: string;
  to: string;
  /** Format angka sumbu nilai. */
  numFmt?: string;
  /** Warna tiap potongan donat. */
  sliceColors?: string[];
  stacked?: boolean;
  legend?: 'b' | 'r' | 't' | 'none';
}

const NS =
  'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const isRef = (s: string) => /!\$?[A-Z]+\$?\d+/.test(s);
const fill = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const INK = '4A433A';
const GRID = 'E6E0D6';

function text(t: string, size: number, bold = false): string {
  return (
    `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr>` +
    `<a:r><a:rPr lang="id-ID" sz="${size}" b="${bold ? 1 : 0}">${fill('1E1A15')}</a:rPr><a:t>${escXml(t)}</a:t></a:r></a:p></c:rich></c:tx>`
  );
}

function seriesName(name: string): string {
  return isRef(name)
    ? `<c:tx><c:strRef><c:f>${escXml(name)}</c:f></c:strRef></c:tx>`
    : `<c:tx><c:v>${escXml(name)}</c:v></c:tx>`;
}

function catVal(s: ChartSeries): string {
  return (
    `<c:cat><c:strRef><c:f>${escXml(s.categories)}</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escXml(s.values)}</c:f></c:numRef></c:val>`
  );
}

function axes(numFmt: string, horizontal: boolean): string {
  const catPos = horizontal ? 'l' : 'b';
  const valPos = horizontal ? 'b' : 'l';
  const txPr = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${fill(INK)}</a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>`;
  return (
    '<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="' +
    (horizontal ? 'maxMin' : 'minMax') +
    `"/></c:scaling><c:delete val="0"/><c:axPos val="${catPos}"/>` +
    '<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>' +
    `<c:tickLblPos val="low"/><c:spPr><a:ln w="9525">${fill('C9BFAE')}</a:ln></c:spPr>${txPr}` +
    '<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
    `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${valPos}"/>` +
    `<c:majorGridlines><c:spPr><a:ln w="6350">${fill(GRID)}</a:ln></c:spPr></c:majorGridlines>` +
    `<c:numFmt formatCode="${escXml(numFmt)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${txPr}` +
    '<c:crossAx val="5001"/><c:crosses val="' +
    (horizontal ? 'max' : 'autoZero') +
    '"/><c:crossBetween val="between"/></c:valAx>'
  );
}

export function chartXml(ch: Chart): string {
  const numFmt = ch.numFmt ?? '#,##0';
  let plot: string;
  if (ch.type === 'doughnut') {
    const s = ch.series[0];
    const colors = ch.sliceColors ?? [];
    const dPts = colors
      .map(
        (c, i) =>
          `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}<a:ln w="12700">${fill('FFFFFF')}</a:ln></c:spPr></c:dPt>`,
      )
      .join('');
    plot =
      '<c:doughnutChart><c:varyColors val="1"/>' +
      `<c:ser><c:idx val="0"/><c:order val="0"/>${seriesName(s.name)}${dPts}` +
      '<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>' +
      `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1">${fill('FFFFFF')}</a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>` +
      '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>' +
      `${catVal(s)}</c:ser>` +
      '<c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>';
  } else if (ch.type === 'line') {
    const sers = ch.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${seriesName(s.name)}` +
          `<c:spPr><a:ln w="28575" cap="rnd">${fill(s.color ?? INK)}<a:round/></a:ln></c:spPr>` +
          `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill(s.color ?? INK)}<a:ln>${fill(s.color ?? INK)}</a:ln></c:spPr></c:marker>` +
          `${catVal(s)}<c:smooth val="0"/></c:ser>`,
      )
      .join('');
    plot =
      `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}` +
      '<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>' +
      axes(numFmt, false);
  } else {
    const horizontal = ch.type === 'bar';
    const sers = ch.series
      .map(
        (s, i) =>
          `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${seriesName(s.name)}` +
          `<c:spPr>${fill(s.color ?? INK)}</c:spPr><c:invertIfNegative val="0"/>${catVal(s)}</c:ser>`,
      )
      .join('');
    plot =
      `<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/>` +
      `<c:grouping val="${ch.stacked ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${sers}` +
      `<c:gapWidth val="${ch.stacked ? 60 : 80}"/>` +
      (ch.stacked ? '<c:overlap val="100"/>' : '<c:overlap val="-8"/>') +
      '<c:axId val="5001"/><c:axId val="5002"/></c:barChart>' +
      axes(numFmt, horizontal);
  }
  const legend =
    ch.legend === 'none'
      ? ''
      : `<c:legend><c:legendPos val="${ch.legend ?? 'b'}"/><c:overlay val="0"/></c:legend>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<c:chartSpace ${NS}><c:roundedCorners val="0"/><c:chart>` +
    `<c:title>${text(ch.title, 1200, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` +
    `<c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>` +
    `${legend}<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr>${fill('FFFFFF')}<a:ln w="9525">${fill(GRID)}</a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${fill(INK)}</a:defRPr></a:pPr><a:endParaRPr lang="id-ID"/></a:p></c:txPr>` +
    '</c:chartSpace>'
  );
}
