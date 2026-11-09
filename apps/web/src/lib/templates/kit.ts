/**
 * Perlengkapan bersama semua template Excel Toolland: palet, gaya sel, format angka, kepala
 * sheet, dan kartu angka (KPI). Semua template memakai gaya yang sama supaya terasa satu aplikasi.
 */
import type { Locale } from '../format';
import { type Sheet, type Style, type Workbook, colIndex, colName } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';

export const INK = '1B1814';
export const INK2 = '4A433A';
export const INK3 = '6F675C';
export const RULE = 'DDD4C4';
export const GRID = 'E8E2D7';
export const PAPER = 'F3EEE4';
export const PAPER2 = 'FAF7F1';
export const WHITE = 'FFFFFF';
export const INPUT = 'FFFDF6';
export const GOOD = '3C6A33';
export const GOOD_BG = 'E3EFDD';
export const BAD = '9A2E3F';
export const BAD_BG = 'F6DEE1';
export const WARN = '8F5E0A';
export const WARN_BG = 'FBEFD5';

/** Warna aksen per template (sama dengan aksen kategori di situs). */
export const ACCENTS = {
  daun: { main: '3C6A33', dark: '2E5227', light: 'E3EFDD' },
  nila: { main: '2C4A86', dark: '213A6B', light: 'E1E8F5' },
  secang: { main: '9A2E3F', dark: '7A2432', light: 'F6DEE1' },
  kunyit: { main: '8F5E0A', dark: '6F4908', light: 'FBEFD5' },
  terakota: { main: 'A8461F', dark: '87381A', light: 'F7E3D9' },
} as const;
export type Accent = (typeof ACCENTS)[keyof typeof ACCENTS];

/** Warna seri grafik: aksen-aksen situs, bergantian. */
export const CHART_COLORS = [
  '3C6A33',
  'A8461F',
  '2C4A86',
  '8F5E0A',
  '9A2E3F',
  '6F675C',
  '93C584',
  'E8916A',
  '94AEE6',
  'EAB54D',
];

/** Format uang: negatif merah, nol tampil "-". */
export function moneyFmt(cur: Currency): string {
  const { symbol, decimals } = CURRENCIES[cur];
  const n = decimals ? `#,##0.${'0'.repeat(decimals)}` : '#,##0';
  const s = `"${symbol} "`;
  return `${s}${n};[Red]-${s}${n};"-"`;
}

export const FMT = {
  date: { id: 'dd/mm/yyyy', en: 'dd mmm yyyy' } satisfies Record<Locale, string>,
  int: '#,##0;[Red]-#,##0;"-"',
  qty: '#,##0.##;[Red]-#,##0.##;"-"',
  pct: '0%;[Red]-0%;"-"',
  pct1: '0.0%;[Red]-0.0%;"-"',
};

const thin = (color = GRID) => ({ style: 'thin' as const, color });
const box = (color = GRID) => ({
  top: thin(color),
  bottom: thin(color),
  left: thin(color),
  right: thin(color),
});

/** Kumpulan gaya sel untuk satu template (aksen dan mata uang tertentu). */
export function makeStyles(accent: Accent, cur: Currency, locale: Locale) {
  const money = moneyFmt(cur);
  const date = FMT.date[locale];
  const base = { font: { color: INK, size: 10 } };
  const input: Style = { ...base, fill: INPUT, border: box(), locked: false };
  const calc: Style = { font: { color: INK2, size: 10 }, fill: PAPER2, border: box() };
  return {
    money,
    date,
    band: { fill: accent.main } satisfies Style,
    brand: {
      font: { size: 9, bold: true, color: WHITE },
      fill: accent.main,
      align: { v: 'center' },
    } satisfies Style,
    title: {
      font: { name: 'Georgia', size: 20, bold: true, color: INK },
      align: { v: 'center' },
    } satisfies Style,
    subtitle: { font: { size: 10, color: INK3 }, align: { v: 'top', wrap: true } } satisfies Style,
    navLink: {
      font: { size: 10, bold: true, color: accent.main, underline: true },
      align: { h: 'right', v: 'center' },
    } satisfies Style,
    h2: {
      font: { name: 'Georgia', size: 13, bold: true, color: INK },
      border: { bottom: { style: 'medium', color: accent.main } },
      align: { v: 'bottom' },
    } satisfies Style,
    h2Rule: { border: { bottom: { style: 'medium', color: accent.main } } } satisfies Style,
    note: {
      font: { size: 9, italic: true, color: INK3 },
      align: { wrap: true, v: 'top' },
    } satisfies Style,
    label: { font: { size: 10, bold: true, color: INK2 }, align: { v: 'center' } } satisfies Style,
    th: {
      font: { size: 10, bold: true, color: WHITE },
      fill: accent.main,
      border: box(accent.main),
      align: { h: 'center', v: 'center', wrap: true },
    } satisfies Style,
    thLeft: {
      font: { size: 10, bold: true, color: WHITE },
      fill: accent.main,
      border: box(accent.main),
      align: { h: 'left', v: 'center', wrap: true, indent: 1 },
    } satisfies Style,
    input,
    inputText: { ...input, align: { indent: 1 } } satisfies Style,
    inputDate: { ...input, numFmt: date, align: { h: 'center' } } satisfies Style,
    inputMoney: { ...input, numFmt: money } satisfies Style,
    inputQty: { ...input, numFmt: FMT.qty } satisfies Style,
    inputInt: { ...input, numFmt: '0', align: { h: 'center' } } satisfies Style,
    calc,
    calcText: { ...calc, align: { indent: 1 } } satisfies Style,
    calcCenter: { ...calc, align: { h: 'center' } } satisfies Style,
    calcDate: { ...calc, numFmt: date, align: { h: 'center' } } satisfies Style,
    calcMoney: { ...calc, numFmt: money } satisfies Style,
    calcQty: { ...calc, numFmt: FMT.qty } satisfies Style,
    calcInt: { ...calc, numFmt: FMT.int, align: { h: 'center' } } satisfies Style,
    calcPct: { ...calc, numFmt: FMT.pct, align: { h: 'center' } } satisfies Style,
    rowLabel: {
      font: { size: 10, color: INK },
      border: box(),
      align: { indent: 1 },
    } satisfies Style,
    rowMoney: { font: { size: 10, color: INK }, border: box(), numFmt: money } satisfies Style,
    rowPct: {
      font: { size: 10, color: INK2 },
      border: box(),
      numFmt: FMT.pct1,
      align: { h: 'center' },
    } satisfies Style,
    section: {
      font: { size: 10, bold: true, color: accent.dark },
      fill: accent.light,
      border: box(),
      align: { indent: 1 },
    } satisfies Style,
    totalLabel: {
      font: { size: 10, bold: true, color: INK },
      fill: PAPER,
      border: {
        top: { style: 'thin', color: INK2 },
        bottom: { style: 'thin', color: INK2 },
        left: thin(),
        right: thin(),
      },
      align: { indent: 1 },
    } satisfies Style,
    totalMoney: {
      font: { size: 10, bold: true, color: INK },
      fill: PAPER,
      border: {
        top: { style: 'thin', color: INK2 },
        bottom: { style: 'thin', color: INK2 },
        left: thin(),
        right: thin(),
      },
      numFmt: money,
    } satisfies Style,
    grandLabel: {
      font: { size: 11, bold: true, color: WHITE },
      fill: INK,
      border: box(INK),
      align: { indent: 1, v: 'center' },
    } satisfies Style,
    grandMoney: {
      font: { size: 11, bold: true, color: WHITE },
      fill: INK,
      border: box(INK),
      numFmt: money,
      align: { v: 'center' },
    } satisfies Style,
    grandPct: {
      font: { size: 10, bold: true, color: INK },
      fill: PAPER,
      border: box(),
      numFmt: FMT.pct1,
      align: { h: 'center' },
    } satisfies Style,
    kpiLabel: {
      font: { size: 9, bold: true, color: INK3 },
      fill: WHITE,
      border: { left: { style: 'thick', color: accent.main }, top: thin(RULE), right: thin(RULE) },
      align: { h: 'left', indent: 1, v: 'bottom' },
    } satisfies Style,
    kpiValue: {
      font: { name: 'Georgia', size: 18, bold: true, color: INK },
      fill: WHITE,
      border: { left: { style: 'thick', color: accent.main }, right: thin(RULE) },
      numFmt: money,
      align: { h: 'left', indent: 1, v: 'center' },
    } satisfies Style,
    kpiNote: {
      font: { size: 9, color: INK3 },
      fill: WHITE,
      border: {
        left: { style: 'thick', color: accent.main },
        bottom: thin(RULE),
        right: thin(RULE),
      },
      align: { h: 'left', indent: 1, v: 'top' },
    } satisfies Style,
    menuItem: {
      font: { size: 12, bold: true, color: accent.main, underline: true },
      border: { bottom: thin(RULE) },
      align: { v: 'center', indent: 1 },
    } satisfies Style,
    menuDesc: {
      font: { size: 10, color: INK2 },
      border: { bottom: thin(RULE) },
      align: { v: 'center', wrap: true },
    } satisfies Style,
    step: {
      font: { name: 'Georgia', size: 16, bold: true, color: accent.main },
      align: { h: 'center', v: 'top' },
    } satisfies Style,
    stepText: { font: { size: 10, color: INK2 }, align: { wrap: true, v: 'top' } } satisfies Style,
    footer: { font: { size: 9, color: INK3 } } satisfies Style,
  };
}
export type Styles = ReturnType<typeof makeStyles>;

/**
 * Kepala setiap sheet: pita warna, nama template, judul, keterangan, dan link kembali ke Menu.
 * Mengisi baris 1-3; konten sheet sebaiknya mulai dari baris 5.
 */
export function sheetHeader(
  sh: Sheet,
  st: Styles,
  o: {
    brand: string;
    title: string;
    subtitle: string;
    lastCol: string;
    menu?: { label: string; sheet: string };
  },
): void {
  const last = colIndex(o.lastCol);
  sh.width('A', 2.5);
  sh.height(1, 18).style(`A1:${o.lastCol}1`, st.band);
  sh.set('B1', o.brand, st.brand);
  sh.height(2, 34).merge(`B2:${colName(last - 1)}2`, o.title, st.title);
  sh.height(3, 30).merge(`B3:${colName(last - 1)}3`, o.subtitle, st.subtitle);
  if (o.menu) {
    sh.set(`${o.lastCol}2`, `← ${o.menu.label}`, st.navLink);
    sh.link(`${o.lastCol}2`, `'${o.menu.sheet}'!A1`, o.menu.label);
  }
}

/** Kartu angka 3 baris x lebar kolom: label, nilai (rumus), catatan (rumus/teks). */
export function kpiCard(
  sh: Sheet,
  st: Styles,
  o: {
    col: string;
    toCol: string;
    row: number;
    label: string;
    value: string;
    note?: string;
    numFmt?: string;
  },
): void {
  const { col, toCol, row } = o;
  sh.merge(`${col}${row}:${toCol}${row}`, o.label.toUpperCase(), st.kpiLabel);
  sh.merge(
    `${col}${row + 1}:${toCol}${row + 1}`,
    o.value,
    o.numFmt ? { ...st.kpiValue, numFmt: o.numFmt } : st.kpiValue,
  );
  sh.merge(`${col}${row + 2}:${toCol}${row + 2}`, o.note ?? '', st.kpiNote);
  sh.height(row, 20)
    .height(row + 1, 30)
    .height(row + 2, 18);
}

/** Nama bulan untuk label dan dropdown (tidak memakai TEXT() karena hasilnya ikut bahasa Excel). */
export const MONTHS: Record<Locale, { long: string[]; short: string[] }> = {
  id: {
    long: [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  },
  en: {
    long: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

/** Bersihkan daftar dari form: buang baris kosong dan duplikat, batasi panjang teks. */
export function cleanList(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Teks aman di dalam rumus: tanda kutip digandakan. */
export const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Generator angka acak yang bisa diulang (contoh data selalu sama untuk pilihan yang sama). */
export function seeded(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Teks umum sheet Menu (sama untuk semua template, per bahasa). */
export const MENU_TEXT: Record<
  Locale,
  {
    startHere: string;
    contents: string;
    legend: string;
    legendInput: string;
    legendCalc: string;
    footer: string;
    made: string;
    menu: string;
  }
> = {
  id: {
    startHere: 'Mulai dalam 3 langkah',
    contents: 'Isi workbook',
    legend: 'Arti warna sel',
    legendInput: 'Isi di sini',
    legendCalc: 'Otomatis (jangan diubah)',
    footer: 'Template gratis dari Toolland · julian-marcell.com/template',
    made: 'Dibuat',
    menu: 'Menu',
  },
  en: {
    startHere: 'Start in 3 steps',
    contents: 'What’s inside',
    legend: 'Cell colours',
    legendInput: 'Type here',
    legendCalc: 'Automatic (don’t edit)',
    footer: 'Free template from Toolland · julian-marcell.com/en/templates',
    made: 'Created',
    menu: 'Menu',
  },
};

/**
 * Sheet Menu: kepala, 3 langkah mulai, daftar sheet dengan link, arti warna sel, catatan
 * (opsional), dan kaki halaman. Dipakai semua template agar terasa satu aplikasi.
 */
export function menuSheet(
  sh: Sheet,
  st: Styles,
  accent: Accent,
  locale: Locale,
  o: {
    brand: string;
    title: string;
    subtitle: string;
    /** Rumus baris kedua di bawah judul, misalnya nama usaha dan tahun. */
    line?: string;
    steps: string[];
    items: [string, string][];
    note?: string;
  },
): void {
  const m = MENU_TEXT[locale];
  sheetHeader(sh, st, { brand: o.brand, title: o.title, subtitle: o.subtitle, lastCol: 'H' });
  sh.widths({ B: 5, C: 24, D: 62, E: 3, F: 16, G: 16, H: 4 });
  if (o.line) sh.set('B3', o.line, { ...st.subtitle, font: { size: 11, bold: true, color: INK2 } });
  sh.merge('B5:D5', m.startHere, st.h2);
  o.steps.forEach((s, i) => {
    const r = 6 + i;
    sh.set(`B${r}`, String(i + 1), st.step)
      .merge(`C${r}:D${r}`, s, st.stepText)
      .height(r, 34);
  });
  sh.merge('B10:D10', m.contents, st.h2);
  o.items.forEach(([name, desc], i) => {
    const r = 11 + i;
    sh.set(`B${r}`, '→', {
      ...st.menuItem,
      font: { size: 12, bold: true, color: accent.main },
      align: { h: 'center', v: 'center' },
    });
    sh.set(`C${r}`, name, st.menuItem).set(`D${r}`, desc, st.menuDesc).height(r, 32);
    sh.link(`C${r}`, `'${name}'!A1`, name);
  });
  sh.merge('F5:G5', m.legend, st.h2);
  sh.merge('F6:G6', m.legendInput, { ...st.input, align: { h: 'center', v: 'center' } }).height(
    6,
    34,
  );
  sh.merge('F7:G7', m.legendCalc, { ...st.calc, align: { h: 'center', v: 'center', wrap: true } });
  let r = 12 + o.items.length;
  if (o.note) {
    sh.merge(`C${r}:D${r + 2}`, o.note, st.note);
    r += 4;
  }
  const today = new Date();
  sh.set(`C${r}`, m.footer, st.footer);
  sh.set(
    `C${r + 1}`,
    `${m.made} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
    st.footer,
  );
}

/** Bulan awal pilihan: bulan ini untuk tahun berjalan, Desember untuk tahun lalu, Januari bila nanti. */
export function defaultMonth(year: number): number {
  const now = new Date();
  return year === now.getFullYear() ? now.getMonth() : year < now.getFullYear() ? 11 : 0;
}

/**
 * Pemilih bulan di baris 5 dashboard: label di B5, dropdown di D5:E5, nomor bulan di F5 (dipakai
 * rumus lain sebagai $F$5), dan teks tahun di H5:J5.
 */
export function monthPicker(
  sh: Sheet,
  st: Styles,
  locale: Locale,
  o: { year: number; yearFormula: string },
): void {
  const L = {
    id: { label: 'Bulan dipilih', no: '"(bulan ke-"0")"', year: 'Tahun ' },
    en: { label: 'Selected month', no: '"(month "0")"', year: 'Year ' },
  }[locale];
  sh.set('B5', L.label, st.label)
    .merge('D5:E5', MONTHS[locale].long[defaultMonth(o.year)], {
      ...st.inputText,
      font: { size: 11, bold: true },
    })
    .set('F5', '=MATCH(D5,Months,0)', { ...st.note, numFmt: L.no, align: { v: 'center' } })
    .merge('H5:J5', `=${q(L.year)}&${o.yearFormula}`, { ...st.label, align: { v: 'center' } });
  sh.validate('D5', { type: 'list', formula1: '=Months' });
  sh.height(5, 22).height(6, 8).height(10, 10);
}

/** Uang contoh: harga dalam rupiah, dikonversi kasar ke mata uang lain lalu dibulatkan. */
export function sampleMoney(cur: Currency): (idr: number) => number {
  const rate = { IDR: 1, USD: 1 / 16000, SGD: 1 / 12000, MYR: 1 / 3500, EUR: 1 / 17500 }[cur];
  const dec = CURRENCIES[cur].decimals;
  return (idr) =>
    cur === 'IDR' ? Math.round(idr / 100) * 100 : Math.round(idr * rate * 10 ** dec) / 10 ** dec;
}

/** Nama bulan disimpan di sheet daftar tersembunyi kolom B dan didefinisikan sebagai "Months". */
export function monthsList(wb: Workbook, list: Sheet, listName: string, locale: Locale): void {
  MONTHS[locale].long.forEach((m, i) => list.set(`B${i + 2}`, m));
  wb.defineName('Months', `'${listName}'!$B$2:$B$13`);
}
