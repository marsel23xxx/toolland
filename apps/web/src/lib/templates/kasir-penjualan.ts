/**
 * Template Kasir & Penjualan Harian: catatan penjualan per item nota (jam, metode bayar, kasir,
 * diskon), harga dan modal dari daftar produk, rekap harian per bulan, rekap produk, laporan
 * bulanan, dan dashboard (omzet harian, jam tersibuk, metode bayar, produk terlaris).
 * Satu pilihan "bulan laporan" di Dashboard dipakai juga oleh Rekap Harian dan Rekap Produk.
 */
import type { Locale } from '../format';
import { type Style, Workbook, excelDate } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';
import {
  type FormValues,
  type TemplateForm,
  formChoice,
  formList,
  formNumber,
  formText,
} from './form';
import { parsePrice } from './invoice-penawaran';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  FMT,
  GOOD,
  GOOD_BG,
  MONTHS,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  menuSheet,
  monthPicker,
  monthsList,
  q,
  sampleMoney,
  seeded,
  sheetHeader,
} from './kit';

export interface SalesOptions {
  locale: Locale;
  shop: string;
  year: number;
  currency: Currency;
  target: number;
  cashiers: string[];
  categories: string[];
  /** "Nama | harga jual | modal" per baris. */
  products: string[];
  sample: boolean;
}

const FIRST = 6;
const SALE_ROWS = 5000;
const PROD_ROWS = 300;
const LIST_ROWS = 10;
const CAT_ROWS = 20;
const METHODS = 5; // kolom metode bayar di rekap

const L = {
  id: {
    brand: 'TOOLLAND · KASIR & PENJUALAN',
    name: 'Kasir & Penjualan Harian',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      sales: 'Penjualan',
      daily: 'Rekap Harian',
      prodSum: 'Rekap Produk',
      monthly: 'Laporan Bulanan',
      prod: 'Produk',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Omzet, laba kotor, jumlah nota, jam tersibuk, metode bayar, dan produk terlaris bulan dipilih.',
      sales:
        'Catatan setiap item terjual: tanggal, jam, nota, produk, qty, diskon, metode bayar, kasir.',
      daily:
        'Omzet, laba, nota, dan setoran per metode bayar untuk setiap tanggal di bulan laporan.',
      prodSum: 'Qty, omzet, dan laba setiap produk di bulan laporan, beserta peringkatnya.',
      monthly:
        'Ringkasan Januari sampai Desember: nota, omzet, diskon, HPP, laba kotor, dan metode bayar.',
      prod: 'Daftar produk dengan harga jual, modal, margin, serta penjualan setahun.',
      set: 'Nama toko, tahun, target omzet harian, kasir, metode bayar, dan kategori produk.',
    },
    subtitle: {
      menu: 'Catat penjualan harian, lalu lihat omzet, laba, produk terlaris, dan jam paling ramai. Mulai dari Pengaturan.',
      sales:
        'Satu baris per item. Item dalam satu nota ditulis berurutan dengan nomor nota yang sama. Harga kosong = harga dari sheet Produk.',
      daily: 'Mengikuti bulan laporan yang dipilih di Dashboard.',
      prodSum: 'Mengikuti bulan laporan yang dipilih di Dashboard.',
      monthly: 'Dihitung dari sheet Penjualan. Tidak perlu diisi.',
      prod: 'Satu baris per produk. Kode dipakai di dropdown sheet Penjualan.',
      set: 'Atur sekali di awal.',
      dash: 'Pilih bulan laporan di bawah. Rekap Harian dan Rekap Produk ikut berubah.',
    },
    steps: [
      'Isi Pengaturan (nama toko, kasir, metode bayar) dan daftar Produk beserta harga jual dan modal.',
      'Catat setiap penjualan di sheet Penjualan: pilih produk, isi qty, metode bayar, dan kasir.',
      'Pilih bulan di Dashboard untuk melihat omzet, laba, jam tersibuk, dan produk terlaris.',
    ],
    set: [
      ['Nama toko', 'ShopName', 'text'],
      ['Alamat', 'ShopAddress', 'text'],
      ['Tahun', 'SalesYear', 'int'],
      ['Mata uang', 'CurrencyLabel', 'calc'],
      ['Target omzet per hari', 'DailyTarget', 'money'],
    ] as [string, string, string][],
    cashiersH: 'Kasir',
    methodsH: 'Metode bayar',
    catsH: 'Kategori produk',
    methodsDefault: ['Tunai', 'QRIS', 'Transfer bank', 'Kartu debit', 'E-wallet'],
    sales: [
      'Tanggal',
      'Jam',
      'No. nota',
      'Kode produk',
      'Nama produk',
      'Qty',
      'Harga manual',
      'Diskon (Rp)',
      'Harga',
      'Total',
      'Metode bayar',
      'Kasir',
      'Catatan',
    ],
    prod: [
      'Kode',
      'Nama produk',
      'Kategori',
      'Harga jual',
      'Modal',
      'Margin',
      'Qty setahun',
      'Omzet setahun',
      'Laba setahun',
    ],
    daily: [
      'Tanggal',
      'Hari',
      'Nota',
      'Item',
      'Omzet',
      'Laba kotor',
      'Rata-rata / nota',
      '% target',
    ],
    days: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    prodSum: [
      'Kode',
      'Nama produk',
      'Kategori',
      'Qty',
      'Omzet',
      'Laba kotor',
      '% omzet',
      'Peringkat',
    ],
    monthly: [
      'Bulan',
      'Nota',
      'Item',
      'Omzet',
      'Diskon',
      'HPP',
      'Laba kotor',
      'Margin',
      'Rata-rata / nota',
    ],
    total: 'Total',
    reportMonth: 'Bulan laporan: ',
    kSales: 'Omzet bulan ini',
    kProfit: 'Laba kotor',
    kNotes: 'Jumlah nota',
    kAvg: 'Rata-rata per nota',
    kToday: 'Omzet hari ini',
    kItems: 'Item terjual',
    kBest: 'Produk terlaris',
    kPeak: 'Jam tersibuk',
    vsPrev: 'vs bulan lalu: ',
    margin: 'Margin: ',
    perDay: ' nota / hari buka',
    target: 'Target: ',
    sold: ' terjual',
    peakNote: 'Omzet terbesar di jam ini',
    chartDaily: 'Omzet harian',
    chartHour: 'Omzet per jam',
    chartMethod: 'Metode bayar',
    chartTop: '10 produk terlaris (omzet)',
    sales1: 'Omzet',
    sample: {
      shop: 'Kopi Senja',
      address: 'Jl. Kaliurang Km 5, Yogyakarta',
      cashiers: ['Dimas', 'Ayu', 'Rizal'],
      categories: ['Kopi', 'Non-kopi', 'Makanan', 'Camilan', 'Minuman lain'],
      note: 'Pesanan online',
    },
  },
  en: {
    brand: 'TOOLLAND · POINT OF SALE',
    name: 'Daily Sales & Cash Register',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      sales: 'Sales',
      daily: 'Daily Summary',
      prodSum: 'Product Summary',
      monthly: 'Monthly Report',
      prod: 'Products',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Revenue, gross profit, receipts, busiest hour, payment methods, and best sellers for the selected month.',
      sales:
        'Every item sold: date, time, receipt, product, qty, discount, payment method, cashier.',
      daily:
        'Revenue, profit, receipts, and takings per payment method for each day of the report month.',
      prodSum: 'Quantity, revenue, and profit of every product in the report month, with ranking.',
      monthly:
        'January to December summary: receipts, revenue, discounts, cost of goods, gross profit, and payment methods.',
      prod: 'Products with selling price, cost, margin, and sales for the year.',
      set: 'Shop name, year, daily revenue target, cashiers, payment methods, and product categories.',
    },
    subtitle: {
      menu: 'Record daily sales, then see revenue, profit, best sellers, and your busiest hours. Start with Settings.',
      sales:
        'One row per item. Items on the same receipt go on consecutive rows with the same receipt number. Empty price = price from Products.',
      daily: 'Follows the report month chosen on the Dashboard.',
      prodSum: 'Follows the report month chosen on the Dashboard.',
      monthly: 'Calculated from the Sales sheet. Nothing to fill in.',
      prod: 'One row per product. Codes feed the dropdown in Sales.',
      set: 'Set this up once.',
      dash: 'Choose the report month below. The Daily and Product summaries follow.',
    },
    steps: [
      'Fill in Settings (shop name, cashiers, payment methods) and your Products with price and cost.',
      'Record every sale in Sales: pick the product, enter qty, payment method, and cashier.',
      'Pick a month on the Dashboard to see revenue, profit, busiest hours, and best sellers.',
    ],
    set: [
      ['Shop name', 'ShopName', 'text'],
      ['Address', 'ShopAddress', 'text'],
      ['Year', 'SalesYear', 'int'],
      ['Currency', 'CurrencyLabel', 'calc'],
      ['Daily revenue target', 'DailyTarget', 'money'],
    ] as [string, string, string][],
    cashiersH: 'Cashiers',
    methodsH: 'Payment methods',
    catsH: 'Product categories',
    methodsDefault: ['Cash', 'QR payment', 'Bank transfer', 'Debit card', 'E-wallet'],
    sales: [
      'Date',
      'Time',
      'Receipt no.',
      'Product code',
      'Product',
      'Qty',
      'Manual price',
      'Discount',
      'Price',
      'Total',
      'Payment',
      'Cashier',
      'Notes',
    ],
    prod: [
      'Code',
      'Product',
      'Category',
      'Price',
      'Cost',
      'Margin',
      'Qty this year',
      'Revenue this year',
      'Profit this year',
    ],
    daily: [
      'Date',
      'Day',
      'Receipts',
      'Items',
      'Revenue',
      'Gross profit',
      'Average / receipt',
      '% of target',
    ],
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    prodSum: [
      'Code',
      'Product',
      'Category',
      'Qty',
      'Revenue',
      'Gross profit',
      '% of revenue',
      'Rank',
    ],
    monthly: [
      'Month',
      'Receipts',
      'Items',
      'Revenue',
      'Discounts',
      'Cost of goods',
      'Gross profit',
      'Margin',
      'Average / receipt',
    ],
    total: 'Total',
    reportMonth: 'Report month: ',
    kSales: 'Revenue this month',
    kProfit: 'Gross profit',
    kNotes: 'Receipts',
    kAvg: 'Average per receipt',
    kToday: 'Revenue today',
    kItems: 'Items sold',
    kBest: 'Best seller',
    kPeak: 'Busiest hour',
    vsPrev: 'vs last month: ',
    margin: 'Margin: ',
    perDay: ' receipts / open day',
    target: 'Target: ',
    sold: ' sold',
    peakNote: 'Highest revenue in this hour',
    chartDaily: 'Daily revenue',
    chartHour: 'Revenue by hour',
    chartMethod: 'Payment methods',
    chartTop: 'Top 10 products (revenue)',
    sales1: 'Revenue',
    sample: {
      shop: 'Dusk Coffee',
      address: '5 Kaliurang Road, Yogyakarta',
      cashiers: ['Dimas', 'Ayu', 'Rizal'],
      categories: ['Coffee', 'Non-coffee', 'Food', 'Snacks', 'Other drinks'],
      note: 'Online order',
    },
  },
};

/** Contoh produk kafe: nama id/en, kategori, harga, modal (Rp), popularitas. */
const CAFE: [string, string, number, number, number, number][] = [
  ['Espresso', 'Espresso', 0, 18_000, 6_000, 3],
  ['Americano', 'Americano', 0, 22_000, 7_000, 6],
  ['Kopi susu gula aren', 'Palm sugar iced latte', 0, 25_000, 9_000, 14],
  ['Cappuccino', 'Cappuccino', 0, 28_000, 10_000, 7],
  ['Caffe latte', 'Caffe latte', 0, 28_000, 10_000, 8],
  ['Matcha latte', 'Matcha latte', 1, 30_000, 12_000, 6],
  ['Teh tarik', 'Pulled milk tea', 1, 20_000, 6_000, 5],
  ['Cokelat panas', 'Hot chocolate', 1, 25_000, 9_000, 4],
  ['Air mineral', 'Mineral water', 4, 8_000, 3_000, 4],
  ['Roti bakar', 'Toast', 3, 20_000, 8_000, 4],
  ['Croissant', 'Croissant', 3, 25_000, 12_000, 4],
  ['Pisang goreng', 'Fried banana', 3, 15_000, 5_000, 5],
  ['Nasi goreng', 'Fried rice', 2, 30_000, 12_000, 6],
  ['Mie goreng', 'Fried noodles', 2, 28_000, 11_000, 4],
  ['Kentang goreng', 'French fries', 3, 22_000, 8_000, 5],
];

export const SALES_PRESETS: Record<
  Locale,
  Record<string, { categories: string; products: string }>
> = {
  id: {
    kafe: {
      categories: 'Kopi\nNon-kopi\nMakanan\nCamilan\nMinuman lain',
      products:
        'Kopi susu gula aren | 25000 | 9000\nAmericano | 22000 | 7000\nRoti bakar | 20000 | 8000',
    },
    toko: {
      categories: 'Sembako\nMinuman\nCamilan\nRumah tangga\nPerawatan diri',
      products:
        'Beras 5 kg | 76000 | 68000\nMinyak goreng 2 L | 38500 | 34000\nAir mineral 600 ml | 4000 | 2500',
    },
    fashion: {
      categories: 'Atasan\nBawahan\nAksesoris\nSepatu',
      products:
        'Kaos polos | 59000 | 32000\nKemeja flanel | 139000 | 78000\nTote bag | 45000 | 20000',
    },
  },
  en: {
    kafe: {
      categories: 'Coffee\nNon-coffee\nFood\nSnacks\nOther drinks',
      products:
        'Palm sugar iced latte | 25000 | 9000\nAmericano | 22000 | 7000\nToast | 20000 | 8000',
    },
    toko: {
      categories: 'Groceries\nDrinks\nSnacks\nHousehold\nPersonal care',
      products:
        'Rice 5 kg | 76000 | 68000\nCooking oil 2 L | 38500 | 34000\nMineral water 600 ml | 4000 | 2500',
    },
    fashion: {
      categories: 'Tops\nBottoms\nAccessories\nShoes',
      products:
        'Plain tee | 59000 | 32000\nFlannel shirt | 139000 | 78000\nTote bag | 45000 | 20000',
    },
  },
};

const form = (locale: Locale): TemplateForm => {
  const id = locale === 'id';
  return {
    template: 'sales',
    fileBase: id ? 'Kasir-Penjualan' : 'Daily-Sales',
    fileKey: 'shop',
    heading: id ? 'Atur sesuai tokomu' : 'Set it up for your shop',
    fields: [
      {
        key: 'shop',
        kind: 'text',
        label: id ? 'Nama toko' : 'Shop name',
        placeholder: id ? 'misalnya Kopi Senja' : 'for example Dusk Coffee',
        span: 2,
      },
      { key: 'year', kind: 'year', label: id ? 'Tahun' : 'Year' },
      { key: 'currency', kind: 'currency', label: id ? 'Mata uang' : 'Currency' },
      {
        key: 'target',
        kind: 'number',
        label: id ? 'Target omzet per hari' : 'Daily revenue target',
        value: 0,
        min: 0,
        hint: id ? 'Opsional, untuk persentase target.' : 'Optional, for % of target.',
      },
      {
        key: 'cashiers',
        kind: 'list',
        label: id ? 'Kasir' : 'Cashiers',
        value: '',
        max: LIST_ROWS,
        hint: id ? 'Satu nama per baris (opsional).' : 'One name per line (optional).',
      },
      {
        key: 'categories',
        kind: 'list',
        label: id ? 'Kategori produk' : 'Product categories',
        value: SALES_PRESETS[locale].kafe.categories,
        max: CAT_ROWS,
      },
      {
        key: 'products',
        kind: 'list',
        label: id ? 'Produk (nama | harga jual | modal)' : 'Products (name | price | cost)',
        value: SALES_PRESETS[locale].kafe.products,
        max: PROD_ROWS,
        hint: id
          ? 'Modal boleh dikosongkan. Bisa ditambah di file.'
          : 'Cost is optional. You can add more in the file.',
      },
    ],
    presets: {
      key: 'preset',
      label: id ? 'Jenis usaha' : 'Business type',
      hint: id
        ? 'Mengisi ulang kategori dan contoh produk di bawah.'
        : 'Refills the categories and example products below.',
      options: id
        ? [
            { value: 'kafe', label: 'Kafe / warung makan' },
            { value: 'toko', label: 'Toko kelontong' },
            { value: 'fashion', label: 'Toko fashion' },
          ]
        : [
            { value: 'kafe', label: 'Café / eatery' },
            { value: 'toko', label: 'Convenience store' },
            { value: 'fashion', label: 'Fashion store' },
          ],
      fill: SALES_PRESETS[locale],
    },
    sample: id
      ? {
          label: 'Isi contoh data',
          hint: 'Penjualan kafe sekitar 2,5 bulan (15 produk, 3 kasir, jam ramai pagi, siang, dan sore), jadi semua rekap dan dashboard langsung terisi. Contoh memakai produk kafe.',
        }
      : {
          label: 'Include sample data',
          hint: 'About 2.5 months of café sales (15 products, 3 cashiers, morning, lunch, and evening rushes), so every summary and the dashboard are filled in. The sample uses café products.',
        },
  };
};

export const SALES_FORM: Record<Locale, TemplateForm> = { id: form('id'), en: form('en') };

export function buildFromForm(v: FormValues): Workbook {
  return buildSalesWorkbook({
    locale: formChoice(v, 'locale', ['id', 'en'] as const, 'id'),
    shop: formText(v, 'shop'),
    year: formNumber(v, 'year', new Date().getFullYear(), 2000, 2100),
    currency: formChoice(v, 'currency', Object.keys(CURRENCIES) as Currency[], 'IDR'),
    target: formNumber(v, 'target', 0, 0),
    cashiers: formList(v, 'cashiers'),
    categories: formList(v, 'categories'),
    products: formList(v, 'products'),
    sample: v.sample === true,
  });
}

export function buildSalesWorkbook(opts: SalesOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.kunyit;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];
  const money = sampleMoney(currency);
  const sample = opts.sample;
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const shop =
    opts.shop.trim().slice(0, 80) ||
    (sample ? t.sample.shop : locale === 'id' ? 'Nama Toko' : 'Shop Name');
  const cashiers = sample ? t.sample.cashiers : cleanList(opts.cashiers, LIST_ROWS);
  const categories = sample ? t.sample.categories : cleanList(opts.categories, CAT_ROWS);
  const products = sample
    ? CAFE.map(([id, en, ci, price, cost], i) => ({
        code: `P${String(i + 1).padStart(3, '0')}`,
        name: locale === 'id' ? id : en,
        cat: categories[ci],
        price: money(price),
        cost: money(cost),
      }))
    : opts.products
        .map((line) => line.split('|').map((x) => x.replace(/\s+/g, ' ').trim()))
        .filter((p) => p[0])
        .slice(0, PROD_ROWS)
        .map(([name, price, cost], i) => ({
          code: `P${String(i + 1).padStart(3, '0')}`,
          name: name.slice(0, 80),
          cat: '',
          price: parsePrice(price ?? ''),
          cost: parsePrice(cost ?? ''),
        }));

  const wb = new Workbook({ title: `${t.name} – ${shop}`, subject: t.name, company: shop });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shSales = wb.addSheet(S.sales, { tabColor: '3C6A33', ...landscape });
  const shDaily = wb.addSheet(S.daily, { tabColor: 'A8461F', ...landscape });
  const shPSum = wb.addSheet(S.prodSum, { tabColor: 'A8461F', ...landscape });
  const shMonthly = wb.addSheet(S.monthly, { tabColor: '9A2E3F', ...landscape });
  const shProd = wb.addSheet(S.prod, { tabColor: '2C4A86', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const saleLast = FIRST + SALE_ROWS - 1;
  const prodLast = FIRST + PROD_ROWS - 1;
  const col = (sheet: string, c: string, first: number, last: number) =>
    ref(sheet, `$${c}$${first}:$${c}$${last}`);

  // ---------- Daftar ----------
  monthsList(wb, shList, S.list, locale);
  t.days.forEach((d, i) => shList.set(`D${i + 2}`, d));
  wb.defineName('DayNames', ref(S.list, '$D$2:$D$8'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'J',
    menu,
  });
  shSet.widths({ B: 24, C: 30, D: 3, E: 18, F: 3, G: 18, H: 3, I: 22, J: 4 });
  const setVals: Record<string, string | number> = {
    ShopName: shop,
    ShopAddress: sample ? t.sample.address : '',
    SalesYear: year,
    CurrencyLabel: `${currency} (${CURRENCIES[currency].symbol})`,
    DailyTarget: sample ? money(2_500_000) : Math.max(0, opts.target),
  };
  t.set.forEach(([label, name, kind], i) => {
    const r = 5 + i;
    const style: Style =
      kind === 'int'
        ? st.inputInt
        : kind === 'money'
          ? st.inputMoney
          : kind === 'calc'
            ? st.calcText
            : st.inputText;
    shSet
      .set(`B${r}`, label, st.label)
      .set(`C${r}`, setVals[name] || (kind === 'money' ? null : setVals[name]), style)
      .height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.validate('C7', { type: 'whole', operator: 'between', formula1: '2000', formula2: '2100' });
  const lists: [string, string, string[], number, string][] = [
    ['E', t.cashiersH, cashiers, LIST_ROWS, 'Cashiers'],
    ['G', t.methodsH, t.methodsDefault, LIST_ROWS, 'Methods'],
    ['I', t.catsH, categories, CAT_ROWS, 'Categories'],
  ];
  for (const [c, h, items, n, name] of lists) {
    shSet.set(`${c}11`, h, st.h2).set(`${c}12`, h, st.thLeft);
    for (let k = 0; k < n; k++) shSet.set(`${c}${13 + k}`, items[k] ?? null, st.inputText);
    wb.defineName(name, ref(S.set, `$${c}$13:$${c}$${12 + n}`));
  }

  // ---------- Produk ----------
  sheetHeader(shProd, st, {
    brand: t.brand,
    title: S.prod,
    subtitle: t.subtitle.prod,
    lastCol: 'J',
    menu,
  });
  shProd.widths({ B: 9, C: 30, D: 16, E: 14, F: 14, G: 9, H: 11, I: 15, J: 15 });
  t.prod.forEach((h, i) =>
    shProd.set(`${'BCDEFGHIJ'[i]}${head}`, h, [1, 2].includes(i) ? st.thLeft : st.th),
  );
  shProd.height(head, 28);
  for (let r = FIRST; r <= prodLast; r++) {
    const p = products[r - FIRST];
    shProd
      .set(`B${r}`, p?.code ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`C${r}`, p?.name ?? null, st.inputText)
      .set(`D${r}`, p?.cat || null, st.inputText)
      .set(`E${r}`, p?.price ?? null, st.inputMoney)
      .set(`F${r}`, p?.cost ?? null, st.inputMoney)
      .set(`G${r}`, `=IF(OR($B${r}="",N($E${r})=0),"",(N($E${r})-N($F${r}))/N($E${r}))`, st.calcPct)
      .set(`H${r}`, `=IF($B${r}="","",SUMIFS(SaleQty,SaleCode,$B${r}))`, st.calcQty)
      .set(`I${r}`, `=IF($B${r}="","",SUMIFS(SaleTotal,SaleCode,$B${r}))`, st.calcMoney)
      .set(`J${r}`, `=IF($B${r}="","",SUMIFS(SaleProfit,SaleCode,$B${r}))`, st.calcMoney);
  }
  shProd.validate(`B${FIRST}:B${prodLast}`, {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${prodLast},B${FIRST})=1`,
    error: 'Duplicate',
  });
  shProd.validate(`D${FIRST}:D${prodLast}`, {
    type: 'list',
    formula1: '=Categories',
    errorStyle: 'warning',
  });
  for (const c of ['E', 'F'])
    shProd.validate(`${c}${FIRST}:${c}${prodLast}`, {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
    });
  shProd.cond(`G${FIRST}:G${prodLast}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0.2',
    style: { font: { color: BAD, bold: true } },
  });
  shProd.freeze(`D${FIRST}`).autoFilter(`B${head}:J${prodLast}`);
  wb.defineName('ProdCode', col(S.prod, 'B', FIRST, prodLast));
  wb.defineName('ProdName', col(S.prod, 'C', FIRST, prodLast));
  wb.defineName('ProdCat', col(S.prod, 'D', FIRST, prodLast));
  wb.defineName('ProdPrice', col(S.prod, 'E', FIRST, prodLast));
  wb.defineName('ProdCost', col(S.prod, 'F', FIRST, prodLast));

  // ---------- Penjualan ----------
  sheetHeader(shSales, st, {
    brand: t.brand,
    title: S.sales,
    subtitle: t.subtitle.sales,
    lastCol: 'N',
    menu,
  });
  const SC = 'BCDEFGHIJKLMN';
  [12, 8, 13, 11, 26, 7, 12, 11, 12, 13, 14, 12, 20].forEach((w, i) => shSales.width(SC[i], w));
  for (const c of 'OPQRSTU') shSales.width(c, 6, true);
  t.sales.forEach((h, i) =>
    shSales.set(`${SC[i]}${head}`, h, [4, 12].includes(i) ? st.thLeft : st.th),
  );
  for (const c of 'OPQRSTU') shSales.set(`${c}${head}`, '#');
  shSales.height(head, 28);
  const rows = sample ? makeSales() : [];
  for (let r = FIRST; r <= saleLast; r++) {
    const s = rows[r - FIRST];
    const pi = `MATCH($E${r},ProdCode,0)`;
    shSales
      .set(`B${r}`, s?.date ?? null, st.inputDate)
      .set(`C${r}`, s?.time ?? null, { ...st.input, numFmt: 'hh:mm', align: { h: 'center' } })
      .set(`D${r}`, s?.note ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`E${r}`, s?.code ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`F${r}`, `=IF($E${r}="","",IFERROR(INDEX(ProdName,${pi}),"?"))`, st.calcText)
      .set(`G${r}`, s?.qty ?? null, st.inputQty)
      .set(`H${r}`, null, st.inputMoney)
      .set(`I${r}`, s?.disc || null, st.inputMoney)
      .set(
        `J${r}`,
        `=IF($E${r}="","",IF($H${r}<>"",$H${r},IFERROR(N(INDEX(ProdPrice,${pi})),0)))`,
        st.calcMoney,
      )
      .set(`K${r}`, `=IF(OR($E${r}="",$G${r}=""),"",N($G${r})*$J${r}-N($I${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`L${r}`, s?.method ?? null, st.inputText)
      .set(`M${r}`, s?.cashier ?? null, st.inputText)
      .set(`N${r}`, s?.memo ?? null, st.inputText)
      // Bantu: HPP, laba, bulan, jam, nota baru (baris pertama sebuah nota), tanggal, kategori.
      .set(`O${r}`, `=IF($K${r}="","",N($G${r})*IFERROR(N(INDEX(ProdCost,${pi})),0))`)
      .set(`P${r}`, `=IF($K${r}="","",$K${r}-$O${r})`)
      .set(`Q${r}`, `=IF(OR($B${r}="",$K${r}=""),"",IF(YEAR($B${r})=SalesYear,MONTH($B${r}),""))`)
      .set(`R${r}`, `=IF(OR($C${r}="",$K${r}=""),"",HOUR($C${r}))`)
      .set(`S${r}`, `=IF($K${r}="","",IF(OR($D${r}="",$D${r}<>$D${r - 1},$B${r}<>$B${r - 1}),1,0))`)
      .set(`T${r}`, `=IF($K${r}="","",INT($B${r}))`)
      .set(`U${r}`, `=IF($E${r}="","",IFERROR(INDEX(ProdCat,${pi})&"",""))`);
  }
  const sr = (c: string) => `${c}${FIRST}:${c}${saleLast}`;
  shSales.validate(sr('B'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
  });
  shSales.validate(sr('E'), { type: 'list', formula1: '=ProdCode', errorStyle: 'warning' });
  shSales.validate(sr('G'), { type: 'decimal', operator: 'greaterThan', formula1: '0' });
  shSales.validate(sr('L'), { type: 'list', formula1: '=Methods' });
  shSales.validate(sr('M'), { type: 'list', formula1: '=Cashiers', errorStyle: 'warning' });
  shSales.cond(sr('F'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shSales.cond(sr('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",YEAR($B${FIRST})<>SalesYear)`,
    style: { fill: WARN_BG },
  });
  shSales.cond(sr('D'), {
    type: 'expression',
    formula: `$S${FIRST}=1`,
    style: { font: { bold: true } },
  });
  shSales.freeze(`A${FIRST}`).autoFilter(`B${head}:N${saleLast}`).printTitles(head, head);
  const saleNames: [string, string][] = [
    ['SaleDate', 'T'],
    ['SaleCode', 'E'],
    ['SaleQty', 'G'],
    ['SaleDisc', 'I'],
    ['SaleTotal', 'K'],
    ['SaleMethod', 'L'],
    ['SaleCashier', 'M'],
    ['SaleCost', 'O'],
    ['SaleProfit', 'P'],
    ['SaleMonth', 'Q'],
    ['SaleHour', 'R'],
    ['SaleNewNote', 'S'],
  ];
  for (const [n, c] of saleNames) wb.defineName(n, col(S.sales, c, FIRST, saleLast));

  // ---------- Dashboard: pemilih bulan (dipakai juga oleh rekap) ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of 'OPQRSTU') shDash.width(c, 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&ShopName`, st.title);
  monthPicker(shDash, st, locale, { year, yearFormula: 'SalesYear' });
  wb.defineName('ReportMonth', ref(S.dash, '$F$5'));
  const mStart = 'DATE(SalesYear,ReportMonth,1)';

  // ---------- Rekap Harian ----------
  sheetHeader(shDaily, st, {
    brand: t.brand,
    title: S.daily,
    subtitle: t.subtitle.daily,
    lastCol: 'O',
    menu,
  });
  const DC = 'BCDEFGHIJKLMNO';
  [12, 10, 8, 8, 15, 14, 14, 10, 13, 13, 13, 13, 13].forEach((w, i) => shDaily.width(DC[i], w));
  shDaily.merge('B5:F5', `=${q(t.reportMonth)}&INDEX(Months,ReportMonth)&" "&SalesYear`, {
    ...st.h2,
    font: { name: 'Georgia', size: 13, bold: true },
  });
  const dHead = 7;
  t.daily.forEach((h, i) => shDaily.set(`${DC[i]}${dHead}`, h, i === 1 ? st.thLeft : st.th));
  for (let k = 0; k < METHODS; k++)
    shDaily.set(
      `${DC[8 + k]}${dHead}`,
      `=IF(INDEX(Methods,${k + 1})="","",INDEX(Methods,${k + 1}))`,
      st.th,
    );
  shDaily.height(dHead, 30);
  for (let d = 1; d <= 31; d++) {
    const r = dHead + d;
    const date = `$B${r}`;
    const on = `IF(${date}="",""`;
    shDaily
      .set(`B${r}`, `=IF(MONTH(${mStart}+${d - 1})=ReportMonth,${mStart}+${d - 1},"")`, {
        ...st.rowLabel,
        numFmt: st.date,
        align: { h: 'center' },
      })
      .set(`C${r}`, `=${on},INDEX(DayNames,WEEKDAY(${date},2)))`, st.rowLabel)
      .set(`D${r}`, `=${on},SUMIFS(SaleNewNote,SaleDate,${date}))`, {
        ...st.rowMoney,
        numFmt: FMT.int,
      })
      .set(`E${r}`, `=${on},SUMIFS(SaleQty,SaleDate,${date}))`, { ...st.rowMoney, numFmt: FMT.qty })
      .set(`F${r}`, `=${on},SUMIFS(SaleTotal,SaleDate,${date}))`, {
        ...st.rowMoney,
        font: { size: 10, bold: true },
      })
      .set(`G${r}`, `=${on},SUMIFS(SaleProfit,SaleDate,${date}))`, st.rowMoney)
      .set(`H${r}`, `=IF(N(D${r})=0,"",F${r}/D${r})`, st.rowMoney)
      .set(`I${r}`, `=IF(OR(${date}="",N(DailyTarget)=0),"",F${r}/DailyTarget)`, st.rowPct);
    for (let k = 0; k < METHODS; k++) {
      const c = DC[8 + k];
      shDaily.set(
        `${c}${r}`,
        `=IF(OR(${date}="",${c}$${dHead}=""),"",SUMIFS(SaleTotal,SaleDate,${date},SaleMethod,${c}$${dHead}))`,
        st.rowMoney,
      );
    }
  }
  const dTot = dHead + 32;
  shDaily.set(`B${dTot}`, t.total, st.grandLabel).set(`C${dTot}`, '', st.grandLabel);
  for (const c of ['D', 'E', 'F', 'G', ...DC.slice(8).split('')])
    shDaily.set(`${c}${dTot}`, `=SUM(${c}${dHead + 1}:${c}${dTot - 1})`, {
      ...st.grandMoney,
      numFmt: c === 'D' || c === 'E' ? FMT.int : st.money,
    });
  shDaily.set(`H${dTot}`, `=IF(N(D${dTot})=0,"",F${dTot}/D${dTot})`, st.grandMoney);
  shDaily.cond(`I${dHead + 1}:I${dTot - 1}`, {
    type: 'cellIs',
    operator: 'greaterThanOrEqual',
    formula: '1',
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shDaily.cond(`I${dHead + 1}:I${dTot - 1}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '1',
  });
  shDaily.cond(`B${dHead + 1}:C${dTot - 1}`, {
    type: 'expression',
    formula: `AND($B${dHead + 1}<>"",WEEKDAY($B${dHead + 1},2)>5)`,
    style: { font: { bold: true, color: 'A8461F' } },
  });
  shDaily.freeze(`D${dHead + 1}`);
  const dailyCol = (c: string) => ref(S.daily, `$${c}$${dHead + 1}:$${c}$${dHead + 31}`);

  // ---------- Rekap Produk ----------
  sheetHeader(shPSum, st, {
    brand: t.brand,
    title: S.prodSum,
    subtitle: t.subtitle.prodSum,
    lastCol: 'I',
    menu,
  });
  shPSum.widths({ B: 9, C: 30, D: 16, E: 9, F: 15, G: 15, H: 10, I: 10 });
  shPSum.width('J', 6, true);
  shPSum.merge('B5:F5', `=${q(t.reportMonth)}&INDEX(Months,ReportMonth)&" "&SalesYear`, {
    ...st.h2,
    font: { name: 'Georgia', size: 13, bold: true },
  });
  const pHead = 7;
  t.prodSum.forEach((h, i) =>
    shPSum.set(`${'BCDEFGHI'[i]}${pHead}`, h, [1, 2].includes(i) ? st.thLeft : st.th),
  );
  shPSum.set(`J${pHead}`, '#').height(pHead, 26);
  const pFirst = pHead + 1;
  const pLast = pFirst + PROD_ROWS - 1;
  for (let r = pFirst; r <= pLast; r++) {
    const pr = r - pFirst + FIRST;
    const p = `'${S.prod}'!`;
    shPSum
      .set(`B${r}`, `=IF(${p}$B${pr}="","",${p}$B${pr})`, st.calcCenter)
      .set(`C${r}`, `=IF($B${r}="","",${p}$C${pr}&"")`, st.calcText)
      .set(`D${r}`, `=IF($B${r}="","",${p}$D${pr}&"")`, st.calcText)
      .set(
        `E${r}`,
        `=IF($B${r}="","",SUMIFS(SaleQty,SaleCode,$B${r},SaleMonth,ReportMonth))`,
        st.calcQty,
      )
      .set(`F${r}`, `=IF($B${r}="","",SUMIFS(SaleTotal,SaleCode,$B${r},SaleMonth,ReportMonth))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(
        `G${r}`,
        `=IF($B${r}="","",SUMIFS(SaleProfit,SaleCode,$B${r},SaleMonth,ReportMonth))`,
        st.calcMoney,
      )
      .set(
        `H${r}`,
        `=IF(OR($B${r}="",SUM($F$${pFirst}:$F$${pLast})=0),"",F${r}/SUM($F$${pFirst}:$F$${pLast}))`,
        st.calcPct,
      )
      .set(
        `I${r}`,
        `=IF(OR($B${r}="",N(F${r})=0),"",RANK(F${r},$F$${pFirst}:$F$${pLast}))`,
        st.calcInt,
      )
      .set(`J${r}`, `=IF(OR($B${r}="",N(F${r})=0),"",F${r}+(100000-ROW())/10000000000)`);
  }
  shPSum.cond(`H${pFirst}:H${pLast}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '0.3',
  });
  shPSum.cond(`I${pFirst}:I${pLast}`, {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '3',
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shPSum.freeze(`D${pFirst}`).autoFilter(`B${pHead}:I${pLast}`);
  wb.defineName('MonthProdKey', col(S.prodSum, 'J', pFirst, pLast));
  wb.defineName('MonthProdName', col(S.prodSum, 'C', pFirst, pLast));
  wb.defineName('MonthProdQty', col(S.prodSum, 'E', pFirst, pLast));
  wb.defineName('MonthProdSales', col(S.prodSum, 'F', pFirst, pLast));

  // ---------- Laporan Bulanan ----------
  sheetHeader(shMonthly, st, {
    brand: t.brand,
    title: S.monthly,
    subtitle: t.subtitle.monthly,
    lastCol: 'O',
    menu,
  });
  const MC = 'BCDEFGHIJKLMNO';
  [12, 9, 9, 15, 13, 14, 15, 9, 13, 13, 13, 13, 13, 13].forEach((w, i) =>
    shMonthly.width(MC[i], w),
  );
  shMonthly.width('P', 6, true);
  t.monthly.forEach((h, i) => shMonthly.set(`${MC[i]}${head}`, h, i === 0 ? st.thLeft : st.th));
  for (let k = 0; k < METHODS; k++)
    shMonthly.set(
      `${MC[9 + k]}${head}`,
      `=IF(INDEX(Methods,${k + 1})="","",INDEX(Methods,${k + 1}))`,
      st.th,
    );
  shMonthly.height(head, 30);
  for (let m = 1; m <= 12; m++) {
    const r = FIRST + m - 1;
    const sm = (n: string) => `SUMIFS(${n},SaleMonth,${m})`;
    shMonthly
      .set(`B${r}`, months.long[m - 1], st.rowLabel)
      .set(`C${r}`, `=${sm('SaleNewNote')}`, { ...st.rowMoney, numFmt: FMT.int })
      .set(`D${r}`, `=${sm('SaleQty')}`, { ...st.rowMoney, numFmt: FMT.qty })
      .set(`E${r}`, `=${sm('SaleTotal')}`, { ...st.rowMoney, font: { size: 10, bold: true } })
      .set(`F${r}`, `=${sm('SaleDisc')}`, st.rowMoney)
      .set(`G${r}`, `=${sm('SaleCost')}`, st.rowMoney)
      .set(`H${r}`, `=${sm('SaleProfit')}`, { ...st.rowMoney, font: { size: 10, bold: true } })
      .set(`I${r}`, `=IF(N(E${r})=0,"",H${r}/E${r})`, st.rowPct)
      .set(`J${r}`, `=IF(N(C${r})=0,"",E${r}/C${r})`, st.rowMoney)
      .set(`P${r}`, months.short[m - 1]);
    for (let k = 0; k < METHODS; k++) {
      const c = MC[9 + k];
      shMonthly.set(
        `${c}${r}`,
        `=IF(${c}$${head}="","",SUMIFS(SaleTotal,SaleMonth,${m},SaleMethod,${c}$${head}))`,
        st.rowMoney,
      );
    }
  }
  const mTot = FIRST + 12;
  shMonthly.set(`B${mTot}`, t.total, st.grandLabel);
  for (const c of ['C', 'D', 'E', 'F', 'G', 'H', ...MC.slice(9).split('')])
    shMonthly.set(`${c}${mTot}`, `=SUM(${c}${FIRST}:${c}${mTot - 1})`, {
      ...st.grandMoney,
      numFmt: c === 'C' || c === 'D' ? FMT.int : st.money,
    });
  shMonthly.set(`I${mTot}`, `=IF(N(E${mTot})=0,"",H${mTot}/E${mTot})`, {
    ...st.grandMoney,
    numFmt: FMT.pct1,
  });
  shMonthly.set(`J${mTot}`, `=IF(N(C${mTot})=0,"",E${mTot}/C${mTot})`, st.grandMoney);
  shMonthly.freeze(`C${FIRST}`);
  const mLine = (c: string) => ref(S.monthly, `$${c}$${FIRST}:$${c}$${mTot - 1}`);

  // ---------- Dashboard (lanjutan) ----------
  const at = (c: string, m = '$F$5') => `INDEX(${mLine(c)},${m})`;
  const openDays = `SUMPRODUCT((${dailyCol('D')}>0)*1)`;
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kSales,
    value: `=${at('E')}`,
    note: `=IF(OR($F$5=1,N(${at('E', '$F$5-1')})=0),"",${q(t.vsPrev)}&TEXT(${at('E')}/${at('E', '$F$5-1')}-1,"+0%;-0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kProfit,
    value: `=${at('H')}`,
    note: `=IF(N(${at('E')})=0,"",${q(t.margin)}&TEXT(${at('H')}/${at('E')},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kNotes,
    value: `=${at('C')}`,
    note: `=IF(${openDays}=0,"",ROUND(${at('C')}/${openDays},0)&${q(t.perDay)})`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kAvg,
    value: `=IF(N(${at('C')})=0,0,${at('E')}/${at('C')})`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kToday,
    value: '=SUMIFS(SaleTotal,SaleDate,TODAY())',
    note: `=IF(N(DailyTarget)=0,"",${q(t.target)}&TEXT(SUMIFS(SaleTotal,SaleDate,TODAY())/DailyTarget,"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kItems,
    value: `=${at('D')}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kBest,
    value: '=IFERROR(INDEX(MonthProdName,MATCH(LARGE(MonthProdKey,1),MonthProdKey,0)),"-")',
    note: `=IFERROR(INDEX(MonthProdQty,MATCH(LARGE(MonthProdKey,1),MonthProdKey,0))&${q(t.sold)},"")`,
  });
  // Jam tersibuk: data omzet per jam di kolom bantu O:P (jam 6-23).
  for (let h = 6; h <= 23; h++) {
    const r = 15 + h - 6;
    shDash
      .set(`O${r}`, `${String(h).padStart(2, '0')}:00`)
      .set(`P${r}`, `=SUMIFS(SaleTotal,SaleHour,${h},SaleMonth,$F$5)`);
  }
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kPeak,
    value: '=IF(MAX($P$15:$P$32)=0,"-",INDEX($O$15:$O$32,MATCH(MAX($P$15:$P$32),$P$15:$P$32,0)))',
    note: t.peakNote,
  });
  shDash.cond('B8:G8', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  // Omzet harian bulan dipilih (kolom bantu Q:R)
  for (let d = 1; d <= 31; d++)
    shDash.set(`Q${14 + d}`, d).set(`R${14 + d}`, `=N(INDEX(${dailyCol('F')},${d}))`);
  shDash.chart({
    type: 'column',
    title: t.chartDaily,
    from: 'B15',
    to: 'N31',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.sales1,
        categories: ref(S.dash, '$Q$15:$Q$45'),
        values: ref(S.dash, '$R$15:$R$45'),
        color: accent.main,
      },
    ],
  });
  shDash.chart({
    type: 'column',
    title: t.chartHour,
    from: 'B33',
    to: 'H51',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.sales1,
        categories: ref(S.dash, '$O$15:$O$32'),
        values: ref(S.dash, '$P$15:$P$32'),
        color: '2C4A86',
      },
    ],
  });
  for (let k = 0; k < METHODS; k++) {
    const r = 50 + k;
    shDash
      .set(`S${r}`, `=IF(INDEX(Methods,${k + 1})="","",INDEX(Methods,${k + 1}))`)
      .set(`T${r}`, `=IF(S${r}="",0,SUMIFS(SaleTotal,SaleMethod,S${r},SaleMonth,$F$5))`);
  }
  shDash.chart({
    type: 'doughnut',
    title: t.chartMethod,
    from: 'H33',
    to: 'N51',
    legend: 'r',
    sliceColors: CHART_COLORS.slice(0, METHODS),
    series: [
      {
        name: t.chartMethod,
        categories: ref(S.dash, `$S$50:$S$${49 + METHODS}`),
        values: ref(S.dash, `$T$50:$T$${49 + METHODS}`),
      },
    ],
  });
  for (let k = 1; k <= 10; k++) {
    const r = 60 + k;
    shDash
      .set(`U${r}`, `=IFERROR(MATCH(LARGE(MonthProdKey,${k}),MonthProdKey,0),"")`)
      .set(`S${r}`, `=IF(U${r}="","",INDEX(MonthProdName,U${r}))`)
      .set(`T${r}`, `=IF(U${r}="",0,INDEX(MonthProdSales,U${r}))`);
  }
  shDash.chart({
    type: 'bar',
    title: t.chartTop,
    from: 'B53',
    to: 'N73',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.sales1,
        categories: ref(S.dash, '$S$61:$S$70'),
        values: ref(S.dash, '$T$61:$T$70'),
        color: CHART_COLORS[1],
      },
    ],
  });

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: `=ShopName&${q(' · ')}&SalesYear`,
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.sales, t.desc.sales],
      [S.daily, t.desc.daily],
      [S.prodSum, t.desc.prodSum],
      [S.monthly, t.desc.monthly],
      [S.prod, t.desc.prod],
      [S.set, t.desc.set],
    ],
  });
  return wb;

  /** Contoh penjualan kafe: ±75 hari terakhir dalam tahun yang dipilih. */
  function makeSales() {
    const rnd = seeded(year * 3 + 5);
    const now = new Date();
    const end =
      year === now.getFullYear()
        ? excelDate(year, now.getMonth() + 1, now.getDate())
        : excelDate(year, 12, 31);
    const begin = Math.max(excelDate(year, 1, 1), end - 75);
    const weights = CAFE.map((p) => p[5]);
    const wSum = weights.reduce((a, b) => a + b, 0);
    const pickProduct = () => {
      let x = rnd() * wSum;
      for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) <= 0) return i;
      return weights.length - 1;
    };
    // Jam ramai: pagi (7-9), siang (12-13), sore (16-19).
    const hours = [
      7, 7, 8, 8, 9, 10, 11, 12, 12, 12, 13, 13, 14, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20, 21,
    ];
    const methods = t.methodsDefault;
    const out: {
      date: number;
      time: number;
      note: string;
      code: string;
      qty: number;
      disc: number;
      method: string;
      cashier: string;
      memo?: string;
    }[] = [];
    let nota = 0;
    for (let d = begin; d <= end; d++) {
      const dow = (d - 2) % 7; // 0 = Senin
      const n = Math.round((dow >= 5 ? 26 : 18) * (0.8 + rnd() * 0.4));
      const times = Array.from(
        { length: n },
        () => hours[Math.floor(rnd() * hours.length)] + Math.floor(rnd() * 60) / 60,
      ).sort((a, b) => a - b);
      for (const tm of times) {
        nota++;
        const items = 1 + Math.floor(rnd() * 2.6);
        // Porsi metode bayar: tunai 35%, QRIS 40%, transfer 10%, kartu 8%, e-wallet 7%.
        const pay = rnd();
        const method =
          methods[pay < 0.35 ? 0 : pay < 0.75 ? 1 : pay < 0.85 ? 2 : pay < 0.93 ? 3 : 4];
        const cashier = cashiers[tm < 15 ? (dow % 2 ? 0 : 1) : 2];
        const used = new Set<number>();
        for (let j = 0; j < items; j++) {
          let pi = pickProduct();
          while (used.has(pi)) pi = (pi + 1) % CAFE.length;
          used.add(pi);
          out.push({
            date: d,
            time: Math.round((tm / 24) * 1440) / 1440,
            note: `N${String(nota).padStart(5, '0')}`,
            code: `P${String(pi + 1).padStart(3, '0')}`,
            qty: rnd() < 0.85 ? 1 : 2,
            disc: rnd() < 0.04 ? money(5_000) : 0,
            method,
            cashier,
            memo: rnd() < 0.03 ? t.sample.note : undefined,
          });
        }
      }
    }
    return out.slice(-SALE_ROWS);
  }
}
