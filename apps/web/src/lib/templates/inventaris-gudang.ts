/**
 * Template Inventaris & Gudang: master barang, mutasi stok, kartu stok, stok per gudang, stok
 * opname, laporan bulanan, dan dashboard. Semua angka dihitung rumus dari sheet Mutasi.
 *
 * Nilai persediaan memakai metode rata-rata tertimbang: HPP satu barang = nilai semua stok awal dan
 * barang masuk dibagi jumlahnya. Setiap baris mutasi punya "efek nilai stok" (+ saat masuk,
 * − saat keluar dengan HPP rata-rata), sehingga nilai stok pada tanggal mana pun = jumlah efeknya.
 */
import type { Locale } from '../format';
import { type Style, Workbook, excelDate } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';
import {
  INVENTORY_LIMITS,
  INVENTORY_PRESETS,
  type InventoryPresetId,
  SAMPLE_SUPPLIERS,
} from './inventory-presets';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  FMT,
  GOOD,
  GOOD_BG,
  MONTHS,
  WARN,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  q,
  seeded,
  sheetHeader,
} from './kit';

export interface InventoryOptions {
  locale: Locale;
  business: string;
  year: number;
  currency: Currency;
  warehouses: string[];
  categories: string[];
  units: string[];
  /** Preset untuk contoh barang (dipakai hanya bila sample = true). */
  preset: InventoryPresetId;
  sample: boolean;
}

const SPARE = 3;
const FIRST = 6;
const ITEM_ROWS = 500;
const MV_ROWS = 3000;
const CARD_ROWS = 300;
const SUPPLIER_ROWS = 20;
const WH_SLOTS = INVENTORY_LIMITS.warehouses;

const L = {
  id: {
    brand: 'TOOLLAND · INVENTARIS & GUDANG',
    templateName: 'Inventaris & Gudang',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      items: 'Barang',
      mv: 'Mutasi',
      card: 'Kartu Stok',
      wh: 'Stok per Gudang',
      count: 'Stok Opname',
      report: 'Laporan',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Nilai persediaan, barang yang perlu dipesan, pembelian, penjualan, dan grafik per bulan.',
      items:
        'Daftar barang beserta harga, stok minimum, stok akhir, HPP rata-rata, dan status otomatis.',
      mv: 'Catat stok awal, barang masuk, keluar, koreksi, dan pindah gudang. Sumber semua angka.',
      card: 'Pilih satu barang untuk melihat semua mutasinya dengan saldo berjalan.',
      wh: 'Stok setiap barang di tiap gudang atau lokasi.',
      count: 'Lembar hitung fisik: bandingkan stok sistem dengan hasil hitung di gudang.',
      report:
        'Pembelian, penjualan, HPP, laba kotor, dan nilai stok per bulan, serta per kategori.',
      set: 'Nama usaha, tahun, gudang, kategori, satuan, dan daftar pemasok.',
    },
    subtitle: {
      menu: 'Template stok barang lengkap. Isi daftar barang, lalu catat setiap barang masuk dan keluar.',
      items:
        'Satu baris per barang. Kode SKU harus unik. Kolom abu-abu terisi otomatis dari sheet Mutasi.',
      mv: 'Isi sel krem. Stok awal juga dicatat di sini (Jenis: Stok awal). Harga kosong = pakai harga di sheet Barang.',
      card: 'Pilih kode barang dan gudang. Daftar mutasi dan saldonya muncul otomatis.',
      wh: 'Dihitung otomatis dari sheet Mutasi. Nama gudang diatur di sheet Pengaturan.',
      count:
        'Cetak lembar ini, hitung barang di gudang, lalu isi Stok fisik. Catat selisihnya di sheet Mutasi sebagai Koreksi.',
      report: 'Semua angka diambil dari sheet Mutasi menurut jenis dan tanggal. Tidak perlu diisi.',
      set: 'Atur sekali di awal. Daftar ini dipakai di dropdown sheet Barang dan Mutasi.',
      dash: 'Pilih bulan di bawah. Angka bulanan dan grafik ikut berubah.',
    },
    steps: [
      'Buka Pengaturan: isi nama usaha, tahun, gudang, kategori, satuan, dan pemasok.',
      'Isi sheet Barang, lalu catat stok awal tiap barang di sheet Mutasi (Jenis: Stok awal).',
      'Catat setiap barang masuk, keluar, dan pindah gudang di Mutasi. Stok dan laporan terhitung otomatis.',
    ],
    startHere: 'Mulai dalam 3 langkah',
    contents: 'Isi workbook',
    legend: 'Arti warna sel',
    legendInput: 'Isi di sini',
    legendCalc: 'Otomatis (jangan diubah)',
    footer: 'Template gratis dari Toolland · julian-marcell.com/template',
    made: 'Dibuat',
    fiscal: 'Tahun ',
    // Pengaturan
    profile: 'Profil usaha',
    business: 'Nama usaha',
    year: 'Tahun laporan',
    currency: 'Mata uang',
    owner: 'Penanggung jawab',
    whH: 'Gudang / lokasi',
    whName: 'Nama gudang',
    whNote: 'Alamat / keterangan',
    catH: 'Kategori barang',
    unitH: 'Satuan',
    supH: 'Pemasok',
    supName: 'Nama pemasok',
    supPhone: 'Telepon',
    supLead: 'Lama kirim (hari)',
    setNote:
      'Isi daftar dari atas tanpa baris kosong di tengah. Maksimal 6 gudang. Mengganti nama gudang atau kategori tidak mengubah data lama, jadi ubah juga di sheet Barang dan Mutasi.',
    // Jenis mutasi: urutan dipakai rumus (0 stok awal, 1 masuk, 2 keluar, 3 koreksi +, 4 koreksi −, 5 pindah).
    types: ['Stok awal', 'Masuk', 'Keluar', 'Koreksi tambah', 'Koreksi kurang', 'Pindah gudang'],
    status: { out: 'Habis', low: 'Menipis', ok: 'Aman' },
    allWh: 'Semua gudang',
    // Barang
    items: [
      'Kode SKU',
      'Nama barang',
      'Kategori',
      'Satuan',
      'Pemasok utama',
      'Harga beli',
      'Harga jual',
      'Stok minimum',
      'Jumlah pesan',
      'Lokasi rak',
      'Total masuk',
      'Total keluar',
      'Stok akhir',
      'HPP rata-rata',
      'Nilai stok',
      'Status',
      'Saran pesan',
      'Margin',
    ],
    skuDup: 'Kode SKU sudah dipakai',
    skuDupMsg: 'Setiap barang harus punya kode SKU yang berbeda.',
    skuPrompt: 'Kode unik barang, misalnya BRG-001. Dipakai di sheet Mutasi.',
    minPrompt: 'Status jadi Menipis bila stok akhir sama dengan atau di bawah angka ini.',
    orderPrompt: 'Jumlah yang biasa dipesan sekali beli. Dipakai untuk saran pesan.',
    numErr: 'Isi angka 0 atau lebih.',
    // Mutasi
    mv: [
      'Tanggal',
      'No. dokumen',
      'Jenis',
      'Kode SKU',
      'Nama barang',
      'Gudang',
      'Ke gudang (pindah)',
      'Qty',
      'Harga satuan',
      'Pemasok / pelanggan',
      'Keterangan',
      'Satuan',
      'Qty masuk',
      'Qty keluar',
      'Nilai transaksi',
      'Efek nilai stok',
    ],
    pickType: 'Jenis mutasi',
    pickTypeMsg: 'Stok awal, Masuk, Keluar, Koreksi tambah/kurang, atau Pindah gudang.',
    pickSku: 'Kode barang',
    pickSkuMsg: 'Pilih kode SKU dari sheet Barang. Nama barang muncul otomatis.',
    badSku: 'Kode tidak dikenal',
    badSkuMsg: 'Tambahkan barangnya dulu di sheet Barang.',
    pickWh: 'Gudang',
    pickWhMsg: 'Gudang tempat barang masuk atau keluar. Untuk pindah gudang: gudang asal.',
    qtyMsg: 'Jumlah barang, selalu angka positif.',
    qtyErr: 'Qty harus lebih dari 0.',
    priceMsg:
      'Boleh dikosongkan: Masuk dan Stok awal memakai harga beli, Keluar memakai harga jual dari sheet Barang.',
    dateTitle: 'Tanggal',
    dateMsg: 'Tulis tanggal, misalnya 15/03/2026.',
    // Kartu stok
    pickItem: 'Kode barang',
    warehouse: 'Gudang',
    itemName: 'Nama barang',
    category: 'Kategori',
    unitRack: 'Satuan · rak',
    minStock: 'Stok minimum',
    totalIn: 'Total masuk',
    totalOut: 'Total keluar',
    balance: 'Saldo',
    avgCost: 'HPP rata-rata',
    card: [
      'Tanggal',
      'No. dokumen',
      'Jenis',
      'Gudang',
      'Masuk',
      'Keluar',
      'Saldo',
      'Pemasok / pelanggan',
      'Keterangan',
    ],
    cardMore: 'Hanya 300 mutasi pertama yang ditampilkan. Saldo di atas tetap menghitung semuanya.',
    // Stok per gudang
    whHead: ['Kode SKU', 'Nama barang', 'Satuan'],
    whTotal: 'Total',
    whNone: 'Tanpa gudang',
    whNoneNote:
      'Kolom Tanpa gudang terisi bila ada mutasi yang kolom Gudang-nya kosong atau namanya tidak ada di Pengaturan.',
    // Stok opname
    countDate: 'Tanggal opname',
    countBy: 'Petugas',
    count: [
      'Kode SKU',
      'Nama barang',
      'Satuan',
      'Stok sistem',
      'Stok fisik',
      'Selisih',
      'Nilai selisih',
      'Keterangan',
    ],
    counted: 'Barang dihitung',
    diffItems: 'Barang selisih',
    diffValue: 'Total nilai selisih',
    // Laporan
    lineItem: 'Keterangan',
    total: 'Total',
    qtySec: 'Jumlah barang',
    valueSec: 'Nilai',
    rQtyIn: 'Qty masuk (pembelian)',
    rQtyOut: 'Qty keluar',
    rBuy: 'Pembelian',
    rSales: 'Penjualan',
    rCogs: 'HPP barang keluar',
    rGross: 'LABA KOTOR',
    rMargin: 'Margin kotor',
    rAdj: 'Selisih koreksi stok',
    rStock: 'Nilai stok akhir bulan',
    catSecH: 'Persediaan per kategori (saat ini)',
    catHead: ['Kategori', 'Jumlah SKU', 'Qty stok', 'Nilai stok', '% nilai'],
    // Dashboard
    pickMonth: 'Bulan dipilih',
    monthNo: '"(bulan ke-"0")"',
    kValue: 'Nilai persediaan',
    kReorder: 'Perlu dipesan ulang',
    kBuy: 'Pembelian bulan ini',
    kSales: 'Penjualan bulan ini',
    kCogs: 'HPP bulan ini',
    kGrossYtd: 'Laba kotor s.d. bulan ini',
    kTurn: 'Perputaran persediaan',
    kAdj: 'Selisih opname tahun ini',
    sku: ' SKU',
    outCount: ' habis',
    vsPrev: 'vs bulan lalu: ',
    marginNote: 'Margin kotor: ',
    daysNote: ' hari stok',
    adjNote: 'Koreksi tambah − kurang',
    turnFmt: '0.0"x"',
    chartFlow: 'Pembelian vs penjualan per bulan',
    chartStock: 'Nilai stok akhir bulan',
    chartCat: 'Nilai stok per kategori',
    chartTop: '10 barang paling banyak keluar',
    reorderH: 'Perlu dipesan ulang',
    reorderHead: ['Nama barang', 'Stok', 'Minimum', 'Saran pesan'],
    allOk: 'Semua stok di atas minimum.',
    topH: 'Paling banyak keluar',
    topHead: ['Nama barang', 'Qty keluar'],
    // Contoh data
    sample: {
      skuPrefix: 'BRG-',
      docPrefix: ['SA', 'BM', 'BK', 'KR', 'KR', 'PG'],
      opening: 'Saldo awal tahun',
      buy: 'Pembelian',
      sale: 'Penjualan',
      use: 'Pemakaian',
      move: 'Isi ulang stok',
      countPlus: 'Hasil opname: lebih',
      countMinus: 'Hasil opname: rusak/hilang',
      customer: 'Pelanggan umum',
      counter: 'Tim gudang',
    },
  },
  en: {
    brand: 'TOOLLAND · INVENTORY & WAREHOUSE',
    templateName: 'Inventory & Warehouse',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      items: 'Items',
      mv: 'Movements',
      card: 'Stock Card',
      wh: 'Stock by Warehouse',
      count: 'Stock Count',
      report: 'Report',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Inventory value, items to reorder, purchases, sales, and monthly charts.',
      items:
        'Your item list with prices, minimum stock, stock on hand, average cost, and automatic status.',
      mv: 'Record opening stock, goods in, goods out, adjustments, and transfers. Every number comes from here.',
      card: 'Pick one item to see all its movements with a running balance.',
      wh: 'Stock of every item in each warehouse or location.',
      count: 'Physical count sheet: compare system stock with what you count on the shelf.',
      report:
        'Purchases, sales, cost of goods, gross profit, and stock value by month and category.',
      set: 'Business name, year, warehouses, categories, units, and suppliers.',
    },
    subtitle: {
      menu: 'A complete stock template. Fill in your items, then record every movement in and out.',
      items:
        'One row per item. SKU codes must be unique. Grey columns fill automatically from Movements.',
      mv: 'Fill the cream cells. Opening stock is recorded here too (Type: Opening stock). Empty price = use the price from Items.',
      card: 'Choose an item code and warehouse. Its movements and balance appear automatically.',
      wh: 'Calculated from Movements. Warehouse names are set in Settings.',
      count:
        'Print this sheet, count the items, and fill in Counted. Record differences in Movements as adjustments.',
      report: 'All numbers come from Movements by type and date. Nothing to fill in.',
      set: 'Set this up once. These lists feed the dropdowns in Items and Movements.',
      dash: 'Choose a month below. Monthly numbers and charts follow.',
    },
    steps: [
      'Open Settings: enter your business name, year, warehouses, categories, units, and suppliers.',
      'Fill in Items, then record each item’s opening stock in Movements (Type: Opening stock).',
      'Record every goods in, goods out, and transfer in Movements. Stock and reports update automatically.',
    ],
    startHere: 'Start in 3 steps',
    contents: 'What’s inside',
    legend: 'Cell colours',
    legendInput: 'Type here',
    legendCalc: 'Automatic (don’t edit)',
    footer: 'Free template from Toolland · julian-marcell.com/en/templates',
    made: 'Created',
    fiscal: 'Year ',
    profile: 'Business profile',
    business: 'Business name',
    year: 'Report year',
    currency: 'Currency',
    owner: 'Person in charge',
    whH: 'Warehouses / locations',
    whName: 'Warehouse name',
    whNote: 'Address / notes',
    catH: 'Item categories',
    unitH: 'Units',
    supH: 'Suppliers',
    supName: 'Supplier name',
    supPhone: 'Phone',
    supLead: 'Lead time (days)',
    setNote:
      'Fill lists from the top without blank rows in between. Up to 6 warehouses. Renaming a warehouse or category does not update old data, so change it in Items and Movements too.',
    types: [
      'Opening stock',
      'Stock in',
      'Stock out',
      'Adjustment (+)',
      'Adjustment (-)',
      'Transfer',
    ],
    status: { out: 'Out of stock', low: 'Low', ok: 'OK' },
    allWh: 'All warehouses',
    items: [
      'SKU',
      'Item name',
      'Category',
      'Unit',
      'Main supplier',
      'Cost price',
      'Selling price',
      'Minimum stock',
      'Order qty',
      'Bin location',
      'Total in',
      'Total out',
      'On hand',
      'Average cost',
      'Stock value',
      'Status',
      'Suggested order',
      'Margin',
    ],
    skuDup: 'SKU already used',
    skuDupMsg: 'Every item needs a different SKU code.',
    skuPrompt: 'Unique item code, for example SKU-001. Used in Movements.',
    minPrompt: 'Status turns Low when stock on hand is at or below this number.',
    orderPrompt: 'How many you usually order at once. Used for the suggested order.',
    numErr: 'Enter a number of 0 or more.',
    mv: [
      'Date',
      'Document no.',
      'Type',
      'SKU',
      'Item name',
      'Warehouse',
      'To warehouse (transfer)',
      'Qty',
      'Unit price',
      'Supplier / customer',
      'Notes',
      'Unit',
      'Qty in',
      'Qty out',
      'Transaction value',
      'Stock value effect',
    ],
    pickType: 'Movement type',
    pickTypeMsg: 'Opening stock, Stock in, Stock out, Adjustment (+/-), or Transfer.',
    pickSku: 'Item code',
    pickSkuMsg: 'Pick a SKU from Items. The item name fills in automatically.',
    badSku: 'Unknown code',
    badSkuMsg: 'Add the item to the Items sheet first.',
    pickWh: 'Warehouse',
    pickWhMsg: 'Where the goods come in or go out. For transfers: the source warehouse.',
    qtyMsg: 'Number of units, always positive.',
    qtyErr: 'Qty must be more than 0.',
    priceMsg:
      'Optional: Stock in and Opening stock use the cost price, Stock out uses the selling price from Items.',
    dateTitle: 'Date',
    dateMsg: 'Type a date, for example 15 Mar 2026.',
    pickItem: 'Item code',
    warehouse: 'Warehouse',
    itemName: 'Item name',
    category: 'Category',
    unitRack: 'Unit · bin',
    minStock: 'Minimum stock',
    totalIn: 'Total in',
    totalOut: 'Total out',
    balance: 'Balance',
    avgCost: 'Average cost',
    card: [
      'Date',
      'Document no.',
      'Type',
      'Warehouse',
      'In',
      'Out',
      'Balance',
      'Supplier / customer',
      'Notes',
    ],
    cardMore: 'Only the first 300 movements are listed. The totals above still count all of them.',
    whHead: ['SKU', 'Item name', 'Unit'],
    whTotal: 'Total',
    whNone: 'No warehouse',
    whNoneNote:
      'The No warehouse column fills when a movement has an empty Warehouse or a name that is not in Settings.',
    countDate: 'Count date',
    countBy: 'Counted by',
    count: [
      'SKU',
      'Item name',
      'Unit',
      'System stock',
      'Counted',
      'Difference',
      'Difference value',
      'Notes',
    ],
    counted: 'Items counted',
    diffItems: 'Items with difference',
    diffValue: 'Total difference value',
    lineItem: 'Line item',
    total: 'Total',
    qtySec: 'Quantities',
    valueSec: 'Values',
    rQtyIn: 'Qty in (purchases)',
    rQtyOut: 'Qty out',
    rBuy: 'Purchases',
    rSales: 'Sales',
    rCogs: 'Cost of goods out',
    rGross: 'GROSS PROFIT',
    rMargin: 'Gross margin',
    rAdj: 'Stock adjustments',
    rStock: 'Stock value at month end',
    catSecH: 'Inventory by category (now)',
    catHead: ['Category', 'SKUs', 'Qty on hand', 'Stock value', '% of value'],
    pickMonth: 'Selected month',
    monthNo: '"(month "0")"',
    kValue: 'Inventory value',
    kReorder: 'Items to reorder',
    kBuy: 'Purchases this month',
    kSales: 'Sales this month',
    kCogs: 'Cost of goods this month',
    kGrossYtd: 'Gross profit year to date',
    kTurn: 'Inventory turnover',
    kAdj: 'Count adjustments this year',
    sku: ' SKUs',
    outCount: ' out of stock',
    vsPrev: 'vs last month: ',
    marginNote: 'Gross margin: ',
    daysNote: ' days of stock',
    adjNote: 'Adjustments (+) minus (-)',
    turnFmt: '0.0"x"',
    chartFlow: 'Purchases vs sales by month',
    chartStock: 'Stock value at month end',
    chartCat: 'Stock value by category',
    chartTop: 'Top 10 items by quantity out',
    reorderH: 'Items to reorder',
    reorderHead: ['Item name', 'On hand', 'Minimum', 'Suggested'],
    allOk: 'All items are above minimum stock.',
    topH: 'Top items out',
    topHead: ['Item name', 'Qty out'],
    sample: {
      skuPrefix: 'SKU-',
      docPrefix: ['OB', 'GR', 'GI', 'ADJ', 'ADJ', 'TR'],
      opening: 'Opening balance',
      buy: 'Purchase',
      sale: 'Sale',
      use: 'Used in kitchen',
      move: 'Restock',
      countPlus: 'Count: surplus',
      countMinus: 'Count: damaged/missing',
      customer: 'Walk-in customer',
      counter: 'Warehouse team',
    },
  },
};

export function buildInventoryWorkbook(opts: InventoryOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const T = t.types.map(q);
  const ST = { out: q(t.status.out), low: q(t.status.low), ok: q(t.status.ok) };
  const ALL = q(t.allWh);
  const accent = ACCENTS.nila;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];
  const preset = INVENTORY_PRESETS[locale][opts.preset] ?? INVENTORY_PRESETS[locale].umum;

  const warehouses = cleanList(opts.warehouses, WH_SLOTS);
  const categories = cleanList(opts.categories, INVENTORY_LIMITS.categories);
  const units = cleanList(opts.units, INVENTORY_LIMITS.units);
  if (!warehouses.length) warehouses.push(...preset.warehouses);
  if (!categories.length) categories.push(...preset.categories);
  if (!units.length) units.push(...preset.units);
  const nCat = categories.length + SPARE;
  const nUnit = units.length + SPARE;
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const business =
    opts.business.trim().slice(0, 80) ||
    (locale === 'id' ? 'Nama Usaha Anda' : 'Your Business Name');

  const wb = new Workbook({
    title: `${t.templateName} – ${business}`,
    subject: t.templateName,
    company: business,
  });
  const menu = { label: t.menu, sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };

  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shItems = wb.addSheet(S.items, { tabColor: '3C6A33', ...landscape });
  const shMv = wb.addSheet(S.mv, { tabColor: '8F5E0A', ...landscape });
  const shCard = wb.addSheet(S.card, { tabColor: 'A8461F', ...landscape });
  const shWh = wb.addSheet(S.wh, { tabColor: 'A8461F', ...landscape });
  const shCount = wb.addSheet(S.count, { tabColor: 'A8461F', ...landscape });
  const shRep = wb.addSheet(S.report, { tabColor: '9A2E3F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const itemLast = FIRST + ITEM_ROWS - 1;
  const mvLast = FIRST + MV_ROWS - 1;
  const itemCol = (c: string) => ref(S.items, `$${c}$${FIRST}:$${c}$${itemLast}`);
  const mvCol = (c: string) => ref(S.mv, `$${c}$${FIRST}:$${c}$${mvLast}`);

  // Uang contoh: harga preset dalam rupiah, dikonversi kasar untuk mata uang lain.
  const scale = { IDR: 1, USD: 1 / 16000, SGD: 1 / 12000, MYR: 1 / 3500, EUR: 1 / 17500 }[currency];
  const dec = CURRENCIES[currency].decimals;
  const round = (x: number) =>
    currency === 'IDR' ? Math.round(x / 100) * 100 : Math.round(x * 10 ** dec) / 10 ** dec;
  const money = (idr: number) => round(idr * scale);

  // Contoh data dibuat lebih dulu: angka stoknya dipakai juga di sheet Stok Opname.
  const sample = opts.sample ? makeSample() : undefined;

  // ---------- Daftar tersembunyi ----------
  shList.set('B1', locale === 'id' ? 'Bulan' : 'Month');
  months.long.forEach((m, i) => shList.set(`B${i + 2}`, m));
  wb.defineName('Months', ref(S.list, '$B$2:$B$13'));
  t.types.forEach((x, i) => shList.set(`D${i + 2}`, x));
  wb.defineName('MvTypes', ref(S.list, '$D$2:$D$7'));
  shList.set('F2', t.allWh);
  for (let k = 0; k < WH_SLOTS; k++)
    shList.set(`F${k + 3}`, `=IF('${S.set}'!B${13 + k}="","",'${S.set}'!B${13 + k})`);
  wb.defineName('WarehousePick', ref(S.list, `$F$2:$F$${2 + WH_SLOTS}`));

  // ---------- Pengaturan ----------
  const setFirst = 13;
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'L',
    menu,
  });
  shSet.widths({ B: 24, C: 24, D: 2.5, E: 26, F: 2.5, G: 14, H: 2.5, I: 28, J: 18, K: 14, L: 9 });
  shSet.merge('B5:C5', t.profile, st.h2);
  const profile: [string, string | number, typeof st.input][] = [
    [t.business, business, st.inputText],
    [t.year, year, st.inputInt],
    [t.currency, `${currency} (${CURRENCIES[currency].symbol})`, st.calcText],
    [t.owner, '', st.inputText],
  ];
  profile.forEach(([label, v, style], i) => {
    const r = 6 + i;
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, v, style).height(r, 20);
  });
  shSet.validate('C7', {
    type: 'whole',
    operator: 'between',
    formula1: '2000',
    formula2: '2100',
    promptTitle: t.year,
    prompt: '2000–2100',
    error: '2000–2100',
  });
  wb.defineName('BusinessName', ref(S.set, '$C$6'));
  wb.defineName('FiscalYear', ref(S.set, '$C$7'));

  shSet
    .merge('B11:C11', t.whH, st.h2)
    .set('E11', t.catH, st.h2)
    .set('G11', t.unitH, st.h2)
    .merge('I11:K11', t.supH, st.h2);
  shSet.set('B12', t.whName, st.thLeft).set('C12', t.whNote, st.thLeft);
  shSet.set('E12', t.catH, st.thLeft).set('G12', t.unitH, st.thLeft);
  shSet
    .set('I12', t.supName, st.thLeft)
    .set('J12', t.supPhone, st.thLeft)
    .set('K12', t.supLead, st.th)
    .height(12, 30);
  for (let k = 0; k < WH_SLOTS; k++)
    shSet
      .set(`B${setFirst + k}`, warehouses[k] ?? '', st.inputText)
      .set(`C${setFirst + k}`, '', st.inputText);
  for (let k = 0; k < nCat; k++) shSet.set(`E${setFirst + k}`, categories[k] ?? '', st.inputText);
  for (let k = 0; k < nUnit; k++) shSet.set(`G${setFirst + k}`, units[k] ?? '', st.inputText);
  const suppliers = opts.sample ? SAMPLE_SUPPLIERS[locale] : [];
  for (let k = 0; k < SUPPLIER_ROWS; k++) {
    const s = suppliers[k];
    shSet
      .set(`I${setFirst + k}`, s?.[0] ?? '', st.inputText)
      .set(`J${setFirst + k}`, s?.[1] ?? '', st.inputText)
      .set(`K${setFirst + k}`, s?.[2] ?? null, st.inputInt);
  }
  wb.defineName('Warehouses', ref(S.set, `$B$${setFirst}:$B$${setFirst + WH_SLOTS - 1}`));
  wb.defineName('Categories', ref(S.set, `$E$${setFirst}:$E$${setFirst + nCat - 1}`));
  wb.defineName('Units', ref(S.set, `$G$${setFirst}:$G$${setFirst + nUnit - 1}`));
  wb.defineName('Suppliers', ref(S.set, `$I$${setFirst}:$I$${setFirst + SUPPLIER_ROWS - 1}`));
  const setNoteRow = setFirst + Math.max(nCat, nUnit, SUPPLIER_ROWS) + 1;
  shSet.merge(`B${setNoteRow}:K${setNoteRow + 1}`, t.setNote, st.note);
  shSet.freeze('A13');

  // ---------- Barang ----------
  sheetHeader(shItems, st, {
    brand: t.brand,
    title: S.items,
    subtitle: t.subtitle.items,
    lastCol: 'S',
    menu,
  });
  shItems.widths({
    B: 12,
    C: 28,
    D: 18,
    E: 9,
    F: 20,
    G: 13,
    H: 13,
    I: 10,
    J: 10,
    K: 9,
    L: 10,
    M: 10,
    N: 11,
    O: 13,
    P: 15,
    Q: 12,
    R: 11,
    S: 9,
  });
  shItems.width('T', 6, true).width('U', 6, true);
  const IC = 'BCDEFGHIJKLMNOPQRS';
  t.items.forEach((h, i) =>
    shItems.set(`${IC[i]}${head}`, h, i === 1 || i === 4 ? st.thLeft : st.th),
  );
  shItems.set(`T${head}`, '#').set(`U${head}`, '#');
  shItems.height(head, 30);
  const statusF = (r: number) =>
    `=IF($B${r}="","",IF(N($N${r})<=0,${ST.out},IF(N($N${r})<=N($I${r}),${ST.low},${ST.ok})))`;
  for (let r = FIRST; r <= itemLast; r++) {
    const it = sample?.items[r - FIRST];
    shItems
      .set(`B${r}`, it?.sku ?? null, st.inputText)
      .set(`C${r}`, it?.name ?? null, st.inputText)
      .set(`D${r}`, it?.cat ?? null, st.inputText)
      .set(`E${r}`, it?.unit ?? null, st.inputText)
      .set(`F${r}`, it?.supplier ?? null, st.inputText)
      .set(`G${r}`, it?.buy ?? null, st.inputMoney)
      .set(`H${r}`, it ? it.sell || null : null, st.inputMoney)
      .set(`I${r}`, it?.min ?? null, st.inputQty)
      .set(`J${r}`, it?.order ?? null, st.inputQty)
      .set(`K${r}`, it?.rack ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`L${r}`, `=IF($B${r}="","",SUMIFS(MvIn,MvSku,$B${r}))`, st.calcQty)
      .set(`M${r}`, `=IF($B${r}="","",SUMIFS(MvOut,MvSku,$B${r}))`, st.calcQty)
      .set(`N${r}`, `=IF($B${r}="","",L${r}-M${r})`, {
        ...st.calcQty,
        font: { size: 10, bold: true },
      })
      .set(
        `O${r}`,
        `=IF($B${r}="","",IF(SUMIFS(MvBasisQty,MvSku,$B${r})=0,N($G${r}),SUMIFS(MvBasisValue,MvSku,$B${r})/SUMIFS(MvBasisQty,MvSku,$B${r})))`,
        st.calcMoney,
      )
      .set(`P${r}`, `=IF($B${r}="","",N($N${r})*N($O${r}))`, st.calcMoney)
      .set(`Q${r}`, statusF(r), st.calcCenter)
      .set(
        `R${r}`,
        `=IF(OR($B${r}="",$Q${r}=${ST.ok}),"",MAX(N($J${r}),N($I${r})-N($N${r})))`,
        st.calcQty,
      )
      .set(`S${r}`, `=IF(OR($B${r}="",N($H${r})=0),"",(N($H${r})-N($O${r}))/N($H${r}))`, st.calcPct)
      .set(
        `T${r}`,
        `=IF(AND($B${r}<>"",OR($Q${r}=${ST.out},$Q${r}=${ST.low})),N(T${r - 1})+1,N(T${r - 1}))`,
      )
      .set(`U${r}`, `=IF(OR($B${r}="",N($M${r})=0),"",$M${r}+(100000-ROW())/10000000000)`);
  }
  const itemRows = (c: string) => `${c}${FIRST}:${c}${itemLast}`;
  shItems.validate(itemRows('B'), {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${itemLast},B${FIRST})=1`,
    promptTitle: t.items[0],
    prompt: t.skuPrompt,
    errorTitle: t.skuDup,
    error: t.skuDupMsg,
  });
  shItems.validate(itemRows('D'), { type: 'list', formula1: '=Categories' });
  shItems.validate(itemRows('E'), { type: 'list', formula1: '=Units' });
  shItems.validate(itemRows('F'), { type: 'list', formula1: '=Suppliers', errorStyle: 'warning' });
  for (const c of ['G', 'H'])
    shItems.validate(itemRows(c), {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
      error: t.numErr,
    });
  shItems.validate(itemRows('I'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    promptTitle: t.items[7],
    prompt: t.minPrompt,
    error: t.numErr,
  });
  shItems.validate(itemRows('J'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    promptTitle: t.items[8],
    prompt: t.orderPrompt,
    error: t.numErr,
  });
  shItems.cond(itemRows('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",COUNTIF($B$${FIRST}:$B$${itemLast},$B${FIRST})>1)`,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shItems.cond(itemRows('Q'), {
    type: 'cellIs',
    operator: 'equal',
    formula: ST.out,
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  shItems.cond(itemRows('Q'), {
    type: 'cellIs',
    operator: 'equal',
    formula: ST.low,
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shItems.cond(itemRows('Q'), {
    type: 'cellIs',
    operator: 'equal',
    formula: ST.ok,
    style: { fill: GOOD_BG, font: { color: GOOD } },
  });
  shItems.cond(itemRows('N'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shItems.cond(itemRows('S'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shItems.freeze(`D${FIRST}`).autoFilter(`B${head}:S${itemLast}`).printTitles(head, head);
  wb.defineName('Skus', itemCol('B'));
  wb.defineName('ItemName', itemCol('C'));
  wb.defineName('ItemCat', itemCol('D'));
  wb.defineName('ItemUnit', itemCol('E'));
  wb.defineName('ItemBuy', itemCol('G'));
  wb.defineName('ItemSell', itemCol('H'));
  wb.defineName('ItemMin', itemCol('I'));
  wb.defineName('ItemRack', itemCol('K'));
  wb.defineName('ItemOut', itemCol('M'));
  wb.defineName('ItemStock', itemCol('N'));
  wb.defineName('ItemAvg', itemCol('O'));
  wb.defineName('ItemValue', itemCol('P'));
  wb.defineName('ItemStatus', itemCol('Q'));
  wb.defineName('ItemSuggest', itemCol('R'));
  wb.defineName('ItemReorderSeq', itemCol('T'));
  wb.defineName('ItemOutKey', itemCol('U'));

  // ---------- Mutasi ----------
  sheetHeader(shMv, st, {
    brand: t.brand,
    title: S.mv,
    subtitle: t.subtitle.mv,
    lastCol: 'Q',
    menu,
  });
  shMv.widths({
    B: 12,
    C: 12,
    D: 15,
    E: 12,
    F: 26,
    G: 17,
    H: 17,
    I: 9,
    J: 13,
    K: 22,
    L: 24,
    M: 8,
    N: 10,
    O: 10,
    P: 15,
    Q: 15,
  });
  for (const c of 'RSTUVW') shMv.width(c, 6, true);
  const MC = 'BCDEFGHIJKLMNOPQ';
  t.mv.forEach((h, i) =>
    shMv.set(`${MC[i]}${head}`, h, [4, 9, 10].includes(i) ? st.thLeft : st.th),
  );
  for (const c of 'RSTUVW') shMv.set(`${c}${head}`, '#');
  shMv.height(head, 30);
  const avgAt = (r: number) => `N(INDEX(ItemAvg,$S${r}))`;
  for (let r = FIRST; r <= mvLast; r++) {
    const s = sample?.moves[r - FIRST];
    shMv
      .set(`B${r}`, s?.date ?? null, st.inputDate)
      .set(`C${r}`, s?.doc ?? null, st.inputText)
      .set(`D${r}`, s ? t.types[s.type] : null, st.inputText)
      .set(`E${r}`, s?.sku ?? null, st.inputText)
      .set(`F${r}`, `=IF($E${r}="","",IF($S${r}="","?",INDEX(ItemName,$S${r})))`, st.calcText)
      .set(`G${r}`, s?.wh ?? null, st.inputText)
      .set(`H${r}`, s?.to ?? null, st.inputText)
      .set(`I${r}`, s?.qty ?? null, st.inputQty)
      .set(`J${r}`, s?.price ?? null, st.inputMoney)
      .set(`K${r}`, s?.party ?? null, st.inputText)
      .set(`L${r}`, s?.note ?? null, st.inputText)
      .set(`M${r}`, `=IF($S${r}="","",INDEX(ItemUnit,$S${r})&"")`, st.calcCenter)
      .set(
        `N${r}`,
        `=IF(OR($D${r}=${T[0]},$D${r}=${T[1]},$D${r}=${T[3]}),N($I${r}),"")`,
        st.calcQty,
      )
      .set(`O${r}`, `=IF(OR($D${r}=${T[2]},$D${r}=${T[4]}),N($I${r}),"")`, st.calcQty)
      .set(
        `P${r}`,
        `=IF($S${r}="","",IF(OR($D${r}=${T[0]},$D${r}=${T[1]}),N($I${r})*IF($J${r}="",N(INDEX(ItemBuy,$S${r})),$J${r}),IF($D${r}=${T[2]},N($I${r})*IF($J${r}="",N(INDEX(ItemSell,$S${r})),$J${r}),"")))`,
        st.calcMoney,
      )
      .set(
        `Q${r}`,
        `=IF($S${r}="","",IF(OR($D${r}=${T[0]},$D${r}=${T[1]}),N($P${r}),IF(OR($D${r}=${T[2]},$D${r}=${T[4]}),-N($I${r})*${avgAt(r)},IF($D${r}=${T[3]},N($I${r})*${avgAt(r)},""))))`,
        st.calcMoney,
      )
      // Kolom bantu tersembunyi: urutan untuk Kartu Stok, baris barang, qty pindah, stok bersih
      // di gudang asal, serta dasar HPP rata-rata (qty dan nilai stok awal + masuk).
      .set(
        `R${r}`,
        `=IF(AND($E${r}<>"",$E${r}=CardSku,OR(CardWh=${ALL},$G${r}=CardWh,AND($D${r}=${T[5]},$H${r}=CardWh))),N(R${r - 1})+1,N(R${r - 1}))`,
      )
      .set(`S${r}`, `=IF($E${r}="","",IFERROR(MATCH($E${r},Skus,0),""))`)
      .set(`T${r}`, `=IF($D${r}=${T[5]},N($I${r}),"")`)
      .set(`U${r}`, `=IF($D${r}="","",N($N${r})-N($O${r})-N($T${r}))`)
      .set(`V${r}`, `=IF(OR($D${r}=${T[0]},$D${r}=${T[1]}),N($I${r}),"")`)
      .set(`W${r}`, `=IF(OR($D${r}=${T[0]},$D${r}=${T[1]}),$P${r},"")`);
  }
  const mvRows = (c: string) => `${c}${FIRST}:${c}${mvLast}`;
  shMv.validate(mvRows('B'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
    promptTitle: t.dateTitle,
    prompt: t.dateMsg,
    error: t.dateMsg,
  });
  shMv.validate(mvRows('D'), {
    type: 'list',
    formula1: '=MvTypes',
    promptTitle: t.pickType,
    prompt: t.pickTypeMsg,
  });
  shMv.validate(mvRows('E'), {
    type: 'list',
    formula1: '=Skus',
    promptTitle: t.pickSku,
    prompt: t.pickSkuMsg,
    errorTitle: t.badSku,
    error: t.badSkuMsg,
  });
  shMv.validate(mvRows('G'), {
    type: 'list',
    formula1: '=Warehouses',
    promptTitle: t.pickWh,
    prompt: t.pickWhMsg,
  });
  shMv.validate(mvRows('H'), { type: 'list', formula1: '=Warehouses' });
  shMv.validate(mvRows('I'), {
    type: 'decimal',
    operator: 'greaterThan',
    formula1: '0',
    prompt: t.qtyMsg,
    error: t.qtyErr,
  });
  shMv.validate(mvRows('J'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.priceMsg,
    error: t.numErr,
  });
  shMv.cond(mvRows('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",YEAR($B${FIRST})<>FiscalYear)`,
    style: { fill: WARN_BG },
  });
  shMv.cond(mvRows('F'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { bold: true, color: BAD } },
  });
  shMv.cond(mvRows('G'), {
    type: 'expression',
    formula: `AND($D${FIRST}<>"",$G${FIRST}="")`,
    style: { fill: BAD_BG },
  });
  shMv.cond(mvRows('H'), {
    type: 'expression',
    formula: `AND($D${FIRST}=${T[5]},OR($H${FIRST}="",$H${FIRST}=$G${FIRST}))`,
    style: { fill: BAD_BG },
  });
  for (const [i, color] of [
    [1, GOOD],
    [0, GOOD],
    [2, BAD],
  ] as const)
    shMv.cond(mvRows('D'), {
      type: 'cellIs',
      operator: 'equal',
      formula: T[i],
      style: { font: { bold: true, color } },
    });
  shMv.freeze(`A${FIRST}`).autoFilter(`B${head}:Q${mvLast}`).printTitles(head, head);
  wb.defineName('MvDate', mvCol('B'));
  wb.defineName('MvDoc', mvCol('C'));
  wb.defineName('MvType', mvCol('D'));
  wb.defineName('MvSku', mvCol('E'));
  wb.defineName('MvWh', mvCol('G'));
  wb.defineName('MvTo', mvCol('H'));
  wb.defineName('MvQty', mvCol('I'));
  wb.defineName('MvParty', mvCol('K'));
  wb.defineName('MvNote', mvCol('L'));
  wb.defineName('MvIn', mvCol('N'));
  wb.defineName('MvOut', mvCol('O'));
  wb.defineName('MvValue', mvCol('P'));
  wb.defineName('MvInv', mvCol('Q'));
  wb.defineName('MvCardSeq', mvCol('R'));
  wb.defineName('MvTransfer', mvCol('T'));
  wb.defineName('MvNet', mvCol('U'));
  wb.defineName('MvBasisQty', mvCol('V'));
  wb.defineName('MvBasisValue', mvCol('W'));

  // ---------- Kartu Stok ----------
  sheetHeader(shCard, st, {
    brand: t.brand,
    title: S.card,
    subtitle: t.subtitle.card,
    lastCol: 'J',
    menu,
  });
  shCard.widths({ B: 12, C: 13, D: 15, E: 26, F: 10, G: 10, H: 12, I: 22, J: 26 });
  shCard.width('L', 6, true);
  const pick = { ...st.inputText, font: { size: 11, bold: true } };
  shCard
    .set('B5', t.pickItem, st.label)
    .merge('C5:D5', sample?.items[0]?.sku ?? '', pick)
    .set('F5', t.warehouse, st.label)
    .merge('G5:H5', t.allWh, pick)
    .height(5, 22);
  shCard.validate('C5', {
    type: 'list',
    formula1: '=Skus',
    promptTitle: t.pickSku,
    prompt: t.pickSkuMsg,
  });
  shCard.validate('G5', { type: 'list', formula1: '=WarehousePick' });
  wb.defineName('CardSku', ref(S.card, '$C$5'));
  wb.defineName('CardWh', ref(S.card, '$G$5'));
  shCard.set('L5', '=IF($C$5="","",IFERROR(MATCH($C$5,Skus,0),""))');
  const info = (r: number, label: string, f: string, style: Style = st.calcText) =>
    shCard.set(`B${r}`, label, st.label).merge(`C${r}:E${r}`, f, style);
  const idx = (name: string) => `IF($L$5="","",INDEX(${name},$L$5)&"")`;
  info(7, t.itemName, `=IF($C$5="","",IF($L$5="","?",INDEX(ItemName,$L$5)))`, {
    ...st.calcText,
    font: { size: 11, bold: true },
  });
  info(8, t.category, `=${idx('ItemCat')}`);
  info(9, t.unitRack, `=IF($L$5="","",INDEX(ItemUnit,$L$5)&" · "&INDEX(ItemRack,$L$5))`);
  info(10, t.minStock, '=IF($L$5="","",N(INDEX(ItemMin,$L$5)))', {
    ...st.calcQty,
    align: { h: 'left', indent: 1 },
  });
  const cardFirst = 13;
  const cardLast = cardFirst + CARD_ROWS - 1;
  const total = (r: number, label: string, f: string, style = st.calcQty) =>
    shCard.merge(`F${r}:G${r}`, label, st.label).set(`H${r}`, f, style);
  total(7, t.totalIn, `=SUM(F${cardFirst}:F${cardLast})`);
  total(8, t.totalOut, `=SUM(G${cardFirst}:G${cardLast})`);
  total(9, t.balance, '=H7-H8', { ...st.calcQty, font: { size: 11, bold: true } });
  total(10, t.avgCost, '=IF($L$5="","",N(INDEX(ItemAvg,$L$5)))', st.calcMoney);
  for (let r = 7; r <= 10; r++) shCard.height(r, 20);
  shCard.merge('B11:J11', `=IF(MAX(MvCardSeq)>${CARD_ROWS},${q(t.cardMore)},"")`, {
    ...st.note,
    font: { size: 9, italic: true, color: WARN },
  });
  t.card.forEach((h, i) =>
    shCard.set(`${'BCDEFGHIJ'[i]}${cardFirst - 1}`, h, i >= 7 ? st.thLeft : st.th),
  );
  shCard.set(`L${cardFirst - 1}`, '#').height(cardFirst - 1, 26);
  for (let r = cardFirst; r <= cardLast; r++) {
    const k = r - cardFirst + 1;
    const at = (name: string) => `INDEX(${name},$L${r})`;
    shCard
      .set(`L${r}`, `=IF($C$5="","",IFERROR(MATCH(${k},MvCardSeq,0),""))`)
      .set(`B${r}`, `=IF($L${r}="","",${at('MvDate')})`, st.calcDate)
      .set(`C${r}`, `=IF($L${r}="","",${at('MvDoc')}&"")`, st.calcText)
      .set(`D${r}`, `=IF($L${r}="","",${at('MvType')}&"")`, st.calcText)
      .set(
        `E${r}`,
        `=IF($L${r}="","",IF(${at('MvType')}=${T[5]},${at('MvWh')}&" → "&${at('MvTo')},${at('MvWh')}&""))`,
        st.calcText,
      )
      .set(
        `F${r}`,
        `=IF($L${r}="","",IF(${at('MvType')}=${T[5]},IF(AND($G$5<>${ALL},${at('MvTo')}=$G$5),${at('MvQty')},""),${at('MvIn')}))`,
        st.calcQty,
      )
      .set(
        `G${r}`,
        `=IF($L${r}="","",IF(${at('MvType')}=${T[5]},IF(AND($G$5<>${ALL},${at('MvWh')}=$G$5),${at('MvQty')},""),${at('MvOut')}))`,
        st.calcQty,
      )
      .set(`H${r}`, `=IF($L${r}="","",N(H${r - 1})+N(F${r})-N(G${r}))`, {
        ...st.calcQty,
        font: { size: 10, bold: true },
      })
      .set(`I${r}`, `=IF($L${r}="","",${at('MvParty')}&"")`, st.calcText)
      .set(`J${r}`, `=IF($L${r}="","",${at('MvNote')}&"")`, st.calcText);
  }
  shCard.cond(`F${cardFirst}:F${cardLast}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: GOOD, bold: true } },
  });
  shCard.cond(`G${cardFirst}:G${cardLast}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shCard.cond(`H${cardFirst}:H${cardLast}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shCard.freeze(`A${cardFirst}`).printTitles(cardFirst - 1, cardFirst - 1);

  // ---------- Stok per Gudang ----------
  sheetHeader(shWh, st, {
    brand: t.brand,
    title: S.wh,
    subtitle: t.subtitle.wh,
    lastCol: 'L',
    menu,
  });
  shWh.widths({ B: 12, C: 28, D: 8, E: 13, F: 13, G: 13, H: 13, I: 13, J: 13, K: 12, L: 12 });
  const WC = 'EFGHIJ';
  t.whHead.forEach((h, i) => shWh.set(`${'BCD'[i]}${head}`, h, i === 1 ? st.thLeft : st.th));
  for (let k = 0; k < WH_SLOTS; k++)
    shWh.set(
      `${WC[k]}${head}`,
      `=IF('${S.set}'!B${setFirst + k}="","",'${S.set}'!B${setFirst + k})`,
      st.th,
    );
  shWh.set(`K${head}`, t.whTotal, st.th).set(`L${head}`, t.whNone, st.th).height(head, 30);
  for (let r = FIRST; r <= itemLast; r++) {
    const it = `'${S.items}'!`;
    shWh
      .set(`B${r}`, `=IF(${it}$B${r}="","",${it}$B${r})`, st.calcText)
      .set(`C${r}`, `=IF($B${r}="","",${it}$C${r}&"")`, st.calcText)
      .set(`D${r}`, `=IF($B${r}="","",${it}$E${r}&"")`, st.calcCenter);
    for (const c of WC)
      shWh.set(
        `${c}${r}`,
        `=IF(OR($B${r}="",${c}$${head}=""),"",SUMIFS(MvNet,MvSku,$B${r},MvWh,${c}$${head})+SUMIFS(MvTransfer,MvSku,$B${r},MvTo,${c}$${head}))`,
        st.calcQty,
      );
    shWh
      .set(`K${r}`, `=IF($B${r}="","",SUM(E${r}:J${r}))`, {
        ...st.calcQty,
        font: { size: 10, bold: true },
      })
      .set(`L${r}`, `=IF($B${r}="","",N(${it}$N${r})-K${r})`, st.calcQty);
  }
  shWh.cond(`E${FIRST}:K${itemLast}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shWh.cond(`L${FIRST}:L${itemLast}`, {
    type: 'cellIs',
    operator: 'notEqual',
    formula: '0',
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shWh.merge(`B${itemLast + 2}:K${itemLast + 3}`, t.whNoneNote, st.note);
  shWh.freeze(`D${FIRST}`).autoFilter(`B${head}:L${itemLast}`).printTitles(head, head);
  wb.defineName('StockMatrix', ref(S.wh, `$E$${FIRST}:$J$${itemLast}`));

  // ---------- Stok Opname ----------
  sheetHeader(shCount, st, {
    brand: t.brand,
    title: S.count,
    subtitle: t.subtitle.count,
    lastCol: 'I',
    menu,
  });
  shCount.widths({ B: 12, C: 28, D: 8, E: 12, F: 12, G: 11, H: 15, I: 26 });
  shCount
    .set('B5', t.countDate, st.label)
    .set('C5', sample?.countDate ?? null, st.inputDate)
    .set('D5', t.warehouse, st.label)
    .merge('E5:F5', t.allWh, pick)
    .set('G5', t.countBy, st.label)
    .merge('H5:I5', sample ? t.sample.counter : '', st.inputText)
    .height(5, 22);
  shCount.validate('C5', {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
    prompt: t.dateMsg,
  });
  shCount.validate('E5', { type: 'list', formula1: '=WarehousePick' });
  const cHead = 9;
  const cFirst = cHead + 1;
  const cLast = cFirst + ITEM_ROWS - 1;
  const off = cFirst - FIRST;
  shCount
    .merge('B7:C7', t.counted, st.label)
    .set('D7', `=COUNT(F${cFirst}:F${cLast})`, st.calcInt)
    .merge('E7:F7', t.diffItems, st.label)
    .set('G7', `=SUMPRODUCT((G${cFirst}:G${cLast}<>"")*(G${cFirst}:G${cLast}<>0))`, st.calcInt)
    .set('H7', t.diffValue, st.label)
    .set('I7', `=SUM(H${cFirst}:H${cLast})`, { ...st.calcMoney, font: { size: 10, bold: true } })
    .height(7, 22);
  t.count.forEach((h, i) =>
    shCount.set(`${'BCDEFGHI'[i]}${cHead}`, h, i === 1 || i === 7 ? st.thLeft : st.th),
  );
  shCount.height(cHead, 28);
  for (let r = cFirst; r <= cLast; r++) {
    const ir = r - off;
    const it = `'${S.items}'!`;
    shCount
      .set(`B${r}`, `=IF(${it}$B${ir}="","",${it}$B${ir})`, st.calcText)
      .set(`C${r}`, `=IF($B${r}="","",${it}$C${ir}&"")`, st.calcText)
      .set(`D${r}`, `=IF($B${r}="","",${it}$E${ir}&"")`, st.calcCenter)
      .set(
        `E${r}`,
        `=IF($B${r}="","",IF($E$5=${ALL},N(${it}$N${ir}),IFERROR(N(INDEX(StockMatrix,${ir - FIRST + 1},MATCH($E$5,Warehouses,0))),0)))`,
        st.calcQty,
      )
      .set(`F${r}`, sample?.counted[ir - FIRST] ?? null, st.inputQty)
      .set(`G${r}`, `=IF(OR($B${r}="",$F${r}=""),"",$F${r}-$E${r})`, {
        ...st.calcQty,
        font: { size: 10, bold: true },
      })
      .set(`H${r}`, `=IF($G${r}="","",$G${r}*N(${it}$O${ir}))`, st.calcMoney)
      .set(`I${r}`, null, st.inputText);
  }
  shCount.validate(`F${cFirst}:F${cLast}`, {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    error: t.numErr,
  });
  shCount.cond(`G${cFirst}:G${cLast}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shCount.cond(`G${cFirst}:G${cLast}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shCount.freeze(`A${cFirst}`).printTitles(cHead, cHead);

  // ---------- Laporan ----------
  sheetHeader(shRep, st, {
    brand: t.brand,
    title: S.report,
    subtitle: t.subtitle.report,
    lastCol: 'P',
    menu,
  });
  const MCOLS = 'CDEFGHIJKLMN';
  shRep.width('B', 28);
  for (const c of MCOLS) shRep.width(c, 12.5);
  shRep.widths({ O: 15, P: 9 });
  shRep.set('B5', t.lineItem, st.thLeft);
  months.short.forEach((m, i) => shRep.set(`${MCOLS[i]}5`, m, st.th));
  shRep.set('O5', t.total, st.th).height(5, 24);
  const range = (m: number) =>
    `MvDate,">="&DATE(FiscalYear,${m},1),MvDate,"<"&DATE(FiscalYear,${m + 1},1)`;
  const R = {
    qIn: 7,
    qOut: 8,
    buy: 11,
    sales: 12,
    cogs: 13,
    gross: 14,
    margin: 15,
    adj: 16,
    stock: 17,
  };
  shRep.merge('B6:O6', t.qtySec, st.section).merge('B10:O10', t.valueSec, st.section);
  const rows: [number, string, (m: number) => string, typeof st.rowMoney][] = [
    [
      R.qIn,
      t.rQtyIn,
      (m) => `SUMIFS(MvQty,MvType,${T[1]},${range(m)})`,
      { ...st.rowMoney, numFmt: FMT.qty },
    ],
    [
      R.qOut,
      t.rQtyOut,
      (m) => `SUMIFS(MvQty,MvType,${T[2]},${range(m)})`,
      { ...st.rowMoney, numFmt: FMT.qty },
    ],
    [R.buy, t.rBuy, (m) => `SUMIFS(MvValue,MvType,${T[1]},${range(m)})`, st.rowMoney],
    [R.sales, t.rSales, (m) => `SUMIFS(MvValue,MvType,${T[2]},${range(m)})`, st.rowMoney],
    [R.cogs, t.rCogs, (m) => `-SUMIFS(MvInv,MvType,${T[2]},${range(m)})`, st.rowMoney],
    [
      R.adj,
      t.rAdj,
      (m) => `SUMIFS(MvInv,MvType,${T[3]},${range(m)})+SUMIFS(MvInv,MvType,${T[4]},${range(m)})`,
      st.rowMoney,
    ],
  ];
  for (const [r, label, f, style] of rows) {
    shRep.set(`B${r}`, label, st.rowLabel);
    for (let m = 1; m <= 12; m++) shRep.set(`${MCOLS[m - 1]}${r}`, `=${f(m)}`, style);
    shRep.set(`O${r}`, `=SUM(C${r}:N${r})`, { ...style, font: { size: 10, bold: true } });
  }
  shRep.set(`B${R.gross}`, t.rGross, st.grandLabel).height(R.gross, 22);
  shRep.set(`B${R.margin}`, t.rMargin, st.rowLabel);
  shRep.set(`B${R.stock}`, t.rStock, st.totalLabel);
  [...MCOLS, 'O'].forEach((c, i) => {
    shRep.set(`${c}${R.gross}`, `=${c}${R.sales}-${c}${R.cogs}`, st.grandMoney);
    shRep.set(
      `${c}${R.margin}`,
      `=IF(N(${c}${R.sales})=0,"",${c}${R.gross}/${c}${R.sales})`,
      st.rowPct,
    );
    shRep.set(
      `${c}${R.stock}`,
      c === 'O' ? `=N${R.stock}` : `=SUMIFS(MvInv,MvDate,"<"&DATE(FiscalYear,${i + 2},1))`,
      st.totalMoney,
    );
  });
  shRep.cond(`C${R.gross}:O${R.gross}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  // Persediaan per kategori
  const catH = R.stock + 3;
  shRep.merge(`B${catH}:F${catH}`, t.catSecH, st.h2);
  t.catHead.forEach((h, i) =>
    shRep.set(`${'BCDEF'[i]}${catH + 1}`, h, i === 0 ? st.thLeft : st.th),
  );
  shRep.height(catH + 1, 26);
  const catFirst = catH + 2;
  for (let k = 0; k < nCat; k++) {
    const r = catFirst + k;
    shRep
      .set(
        `B${r}`,
        `=IF('${S.set}'!E${setFirst + k}="","",'${S.set}'!E${setFirst + k})`,
        st.rowLabel,
      )
      .set(`C${r}`, `=IF($B${r}="","",COUNTIF(ItemCat,$B${r}))`, {
        ...st.rowMoney,
        numFmt: FMT.int,
      })
      .set(`D${r}`, `=IF($B${r}="","",SUMIFS(ItemStock,ItemCat,$B${r}))`, {
        ...st.rowMoney,
        numFmt: FMT.qty,
      })
      .set(`E${r}`, `=IF($B${r}="","",SUMIFS(ItemValue,ItemCat,$B${r}))`, st.rowMoney)
      .set(
        `F${r}`,
        `=IF(OR($B${r}="",N($E$${catFirst + nCat})=0),"",E${r}/$E$${catFirst + nCat})`,
        st.rowPct,
      );
  }
  const catTotal = catFirst + nCat;
  shRep
    .set(`B${catTotal}`, t.total, st.totalLabel)
    .set(`C${catTotal}`, `=SUM(C${catFirst}:C${catTotal - 1})`, {
      ...st.totalMoney,
      numFmt: FMT.int,
    })
    .set(`D${catTotal}`, `=SUM(D${catFirst}:D${catTotal - 1})`, {
      ...st.totalMoney,
      numFmt: FMT.qty,
    })
    .set(`E${catTotal}`, `=SUM(E${catFirst}:E${catTotal - 1})`, st.totalMoney)
    .set(`F${catTotal}`, `=IF(N(E${catTotal})=0,"",1)`, st.grandPct);
  shRep.cond(`F${catFirst}:F${catTotal - 1}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '1',
  });
  shRep.freeze('C6').printTitles(5, 5);
  const repMonths = ref(S.report, '$C$5:$N$5');
  const repLine = (r: number) => ref(S.report, `$C$${r}:$N$${r}`);

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of 'OPQR') shDash.width(c, 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&BusinessName`, st.title);
  const thisYear = new Date().getFullYear();
  const nowMonth = year === thisYear ? new Date().getMonth() : year < thisYear ? 11 : 0;
  shDash
    .set('B5', t.pickMonth, st.label)
    .merge('D5:E5', months.long[nowMonth], pick)
    .set('F5', '=MATCH(D5,Months,0)', { ...st.note, numFmt: t.monthNo, align: { v: 'center' } })
    .merge('H5:J5', `=${q(t.fiscal)}&FiscalYear`, { ...st.label, align: { v: 'center' } });
  shDash.validate('D5', { type: 'list', formula1: '=Months' });
  shDash.height(5, 22).height(6, 8).height(10, 10);
  const at = (r: number) => `INDEX(${repLine(r)},1,$F$5)`;
  const prevNote = (r: number) =>
    `=IF($F$5=1,"",IF(N(INDEX(${repLine(r)},1,$F$5-1))=0,"",${q(t.vsPrev)}&TEXT(${at(r)}/INDEX(${repLine(r)},1,$F$5-1)-1,"+0%;-0%")))`;
  const ytd = (r: number) =>
    `SUMPRODUCT(${repLine(r)}*(COLUMN(${repLine(r)})-COLUMN(${ref(S.report, `$C$${r}`)})+1<=$F$5))`;
  // Perputaran = HPP s.d. bulan ini dibagi rata-rata nilai stok akhir bulan s.d. bulan ini.
  const turn = `IFERROR(${ytd(R.cogs)}/(${ytd(R.stock)}/$F$5),0)`;
  const intFmt = '#,##0';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kValue,
    value: '=SUM(ItemValue)',
    note: `=COUNTA(Skus)&${q(t.sku)}`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kReorder,
    value: `=COUNTIF(ItemStatus,${ST.low})+COUNTIF(ItemStatus,${ST.out})`,
    note: `=COUNTIF(ItemStatus,${ST.out})&${q(t.outCount)}`,
    numFmt: intFmt,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kBuy,
    value: `=${at(R.buy)}`,
    note: prevNote(R.buy),
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kSales,
    value: `=${at(R.sales)}`,
    note: `=IF(N(${at(R.sales)})=0,"",${q(t.marginNote)}&TEXT(${at(R.gross)}/${at(R.sales)},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kCogs,
    value: `=${at(R.cogs)}`,
    note: prevNote(R.cogs),
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kGrossYtd,
    value: `=${ytd(R.gross)}`,
    note: `=IF(N(${ytd(R.sales)})=0,"",${q(t.marginNote)}&TEXT(${ytd(R.gross)}/${ytd(R.sales)},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kTurn,
    value: `=${turn}`,
    note: `=IF(${turn}=0,"",ROUND($F$5*30.4/${turn},0)&${q(t.daysNote)})`,
    numFmt: t.turnFmt,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kAdj,
    value: `=${ytd(R.adj)}`,
    note: t.adjNote,
  });
  shDash.cond('E8:G8', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shDash.chart({
    type: 'column',
    title: t.chartFlow,
    from: 'B15',
    to: 'H33',
    numFmt: '#,##0',
    series: [
      { name: t.rBuy, categories: repMonths, values: repLine(R.buy), color: accent.main },
      { name: t.rSales, categories: repMonths, values: repLine(R.sales), color: '3C6A33' },
    ],
  });
  shDash.chart({
    type: 'line',
    title: t.chartStock,
    from: 'H15',
    to: 'N33',
    numFmt: '#,##0',
    legend: 'none',
    series: [{ name: t.rStock, categories: repMonths, values: repLine(R.stock), color: 'A8461F' }],
  });
  const nCatChart = Math.max(1, categories.length);
  shDash.chart({
    type: 'doughnut',
    title: t.chartCat,
    from: 'B35',
    to: 'H55',
    legend: 'r',
    sliceColors: categories.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    series: [
      {
        name: t.chartCat,
        categories: ref(S.report, `$B$${catFirst}:$B$${catFirst + nCatChart - 1}`),
        values: ref(S.report, `$E$${catFirst}:$E$${catFirst + nCatChart - 1}`),
      },
    ],
  });
  // Perlu dipesan ulang: 10 barang pertama berstatus Menipis/Habis.
  shDash.merge('I35:M35', t.reorderH, st.h2);
  shDash
    .merge('I36:J36', t.reorderHead[0], st.thLeft)
    .set('K36', t.reorderHead[1], st.th)
    .set('L36', t.reorderHead[2], st.th)
    .set('M36', t.reorderHead[3], st.th)
    .height(36, 26);
  for (let k = 1; k <= 10; k++) {
    const r = 36 + k;
    const ix = (name: string) => `IF($O${r}="","",INDEX(${name},$O${r}))`;
    shDash
      .set(`O${r}`, `=IFERROR(MATCH(${k},ItemReorderSeq,0),"")`)
      .merge(
        `I${r}:J${r}`,
        k === 1
          ? `=IF($O${r}="",IF(COUNTA(Skus)=0,"",${q(t.allOk)}),INDEX(ItemName,$O${r}))`
          : `=${ix('ItemName')}`,
        st.rowLabel,
      )
      .set(`K${r}`, `=${ix('ItemStock')}`, { ...st.rowMoney, numFmt: FMT.qty })
      .set(`L${r}`, `=${ix('ItemMin')}`, { ...st.rowMoney, numFmt: FMT.qty })
      .set(`M${r}`, `=${ix('ItemSuggest')}`, {
        ...st.rowMoney,
        numFmt: FMT.qty,
        font: { size: 10, bold: true, color: accent.main },
      });
  }
  shDash.cond('K37:K46', {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  // 10 barang paling banyak keluar: tabel + grafik batang (kolom bantu P:Q dibalik agar
  // barang teratas tampil paling atas di grafik).
  shDash.chart({
    type: 'bar',
    title: t.chartTop,
    from: 'B57',
    to: 'H77',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.topHead[1],
        categories: ref(S.dash, '$P$59:$P$68'),
        values: ref(S.dash, '$Q$59:$Q$68'),
        color: accent.main,
      },
    ],
  });
  shDash.merge('I57:M57', t.topH, st.h2);
  shDash
    .merge('I58:K58', t.topHead[0], st.thLeft)
    .merge('L58:M58', t.topHead[1], st.th)
    .height(58, 26);
  for (let k = 1; k <= 10; k++) {
    const r = 58 + k;
    const rev = 69 - k;
    shDash
      .set(`R${r}`, `=IFERROR(MATCH(LARGE(ItemOutKey,${k}),ItemOutKey,0),"")`)
      .merge(`I${r}:K${r}`, `=IF($R${r}="","",${k}&". "&INDEX(ItemName,$R${r}))`, st.rowLabel)
      .merge(`L${r}:M${r}`, `=IF($R${r}="","",INDEX(ItemOut,$R${r}))`, {
        ...st.rowMoney,
        numFmt: FMT.qty,
      })
      .set(`P${rev}`, `=IF($R${r}="","",INDEX(ItemName,$R${r}))`)
      .set(`Q${rev}`, `=IF($R${r}="",0,INDEX(ItemOut,$R${r}))`);
  }

  // ---------- Menu ----------
  sheetHeader(shMenu, st, {
    brand: t.brand,
    title: t.templateName,
    subtitle: t.subtitle.menu,
    lastCol: 'H',
  });
  shMenu.widths({ B: 5, C: 24, D: 62, E: 3, F: 16, G: 16, H: 4 });
  shMenu.set('B3', `=BusinessName&${q(' · ' + t.fiscal)}&FiscalYear`, {
    ...st.subtitle,
    font: { size: 11, bold: true, color: '4A433A' },
  });
  shMenu.merge('B5:D5', t.startHere, st.h2);
  t.steps.forEach((s, i) => {
    const r = 6 + i;
    shMenu
      .set(`B${r}`, String(i + 1), st.step)
      .merge(`C${r}:D${r}`, s, st.stepText)
      .height(r, 34);
  });
  shMenu.merge('B10:D10', t.contents, st.h2);
  const items: [string, string][] = [
    [S.dash, t.desc.dash],
    [S.items, t.desc.items],
    [S.mv, t.desc.mv],
    [S.card, t.desc.card],
    [S.wh, t.desc.wh],
    [S.count, t.desc.count],
    [S.report, t.desc.report],
    [S.set, t.desc.set],
  ];
  items.forEach(([name, desc], i) => {
    const r = 11 + i;
    shMenu.set(`B${r}`, '→', {
      ...st.menuItem,
      font: { size: 12, bold: true, color: accent.main },
      align: { h: 'center', v: 'center' },
    });
    shMenu.set(`C${r}`, name, st.menuItem).set(`D${r}`, desc, st.menuDesc).height(r, 32);
    shMenu.link(`C${r}`, `'${name}'!A1`, name);
  });
  shMenu.merge('F5:G5', t.legend, st.h2);
  shMenu
    .merge('F6:G6', t.legendInput, { ...st.input, align: { h: 'center', v: 'center' } })
    .height(6, 34);
  shMenu.merge('F7:G7', t.legendCalc, {
    ...st.calc,
    align: { h: 'center', v: 'center', wrap: true },
  });
  const today = new Date();
  shMenu.set('C21', t.footer, st.footer);
  shMenu.set(
    'C22',
    `${t.made} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
    st.footer,
  );

  return wb;

  // ---------- Contoh data ----------
  function makeSample() {
    const rnd = seeded(year * 17 + warehouses.length * 7 + categories.length);
    const sup = SAMPLE_SUPPLIERS[locale].map((s) => s[0]);
    const items = preset.items.map(([name, ci, ui, buy, sell, min, order], i) => ({
      sku: `${t.sample.skuPrefix}${String(i + 1).padStart(3, '0')}`,
      name,
      cat: categories[Math.min(ci, categories.length - 1)],
      unit: units[Math.min(ui, units.length - 1)],
      supplier: sup[i % sup.length],
      buy: money(buy),
      sell: money(sell),
      min,
      order,
      rack: `${'ABC'[Math.floor(i / 4)]}-${String((i % 4) + 1).padStart(2, '0')}`,
    }));
    type Move = {
      date: number;
      type: number;
      sku: string;
      wh: string;
      to?: string;
      qty: number;
      price?: number;
      party?: string;
      note?: string;
      doc?: string;
    };
    const moves: Move[] = [];
    const w0 = warehouses[0];
    const w1 = warehouses[1];
    // Stok disimulasikan per barang per gudang agar contoh tidak pernah minus.
    const stock = items.map(() => [0, 0]);
    const lastMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    const day = (m: number, d: number) =>
      excelDate(year, m, Math.min(d, new Date(year, m, 0).getDate()));
    items.forEach((it, i) => {
      const total = Math.round(it.order * 1.3);
      const front = w1 && i % 2 === 0 ? Math.round(total * 0.3) : 0;
      stock[i] = [total - front, front];
      moves.push({
        date: day(1, 1),
        type: 0,
        sku: it.sku,
        wh: w0,
        qty: total - front,
        note: t.sample.opening,
      });
      if (front)
        moves.push({
          date: day(1, 1),
          type: 0,
          sku: it.sku,
          wh: w1,
          qty: front,
          note: t.sample.opening,
        });
    });
    for (let m = 1; m <= lastMonth; m++) {
      items.forEach((it, i) => {
        // Permintaan sebulan sekitar 60-90% dari jumlah pesan, dibagi 2-4 kali keluar.
        const n = 2 + Math.floor(rnd() * 3);
        const demand = it.order * (0.6 + rnd() * 0.3) * (1 + (m % 12 === 0 ? 0.25 : 0));
        for (let j = 0; j < n; j++) {
          const qty = Math.max(1, Math.round(demand / n));
          const d = 2 + Math.floor(((j + rnd()) * 26) / n);
          // Keluar dari gudang depan bila cukup, lalu gudang utama.
          const src = w1 && stock[i][1] >= qty ? 1 : stock[i][0] >= qty ? 0 : -1;
          if (src < 0) continue;
          stock[i][src] -= qty;
          moves.push({
            date: day(m, d),
            type: 2,
            sku: it.sku,
            wh: src ? w1 : w0,
            qty,
            party: it.sell ? t.sample.customer : undefined,
            note: it.sell ? t.sample.sale : t.sample.use,
          });
          const onHand = stock[i][0] + stock[i][1];
          // Pesan ulang saat stok menyentuh minimum, kecuali tiga barang di dua bulan terakhir
          // (agar dashboard menampilkan contoh barang yang perlu dipesan).
          const hold = m >= lastMonth - 1 && [2, 7, 11].includes(i);
          if (onHand <= it.min && !hold) {
            // Harga beli sedikit naik-turun supaya HPP rata-rata terlihat bekerja.
            moves.push({
              date: day(m, d + 2),
              type: 1,
              sku: it.sku,
              wh: w0,
              qty: it.order,
              price: round(it.buy * (0.95 + rnd() * 0.12)) || it.buy,
              party: it.supplier,
              note: t.sample.buy,
            });
            stock[i][0] += it.order;
          }
        }
        // Isi ulang gudang depan dari gudang utama.
        if (w1 && i % 2 === 0 && stock[i][1] < it.min && stock[i][0] > it.min) {
          const qty = Math.round(Math.min(stock[i][0] - it.min, it.order * 0.4));
          if (qty > 0) {
            stock[i][0] -= qty;
            stock[i][1] += qty;
            moves.push({
              date: day(m, 27),
              type: 5,
              sku: it.sku,
              wh: w0,
              to: w1,
              qty,
              note: t.sample.move,
            });
          }
        }
      });
      // Koreksi hasil opname tiap triwulan.
      if (m % 3 === 0) {
        const i = (m / 3) % items.length;
        if (stock[i][0] > 2) {
          stock[i][0] -= 1;
          moves.push({
            date: day(m, 28),
            type: 4,
            sku: items[i].sku,
            wh: w0,
            qty: 1,
            note: t.sample.countMinus,
          });
        }
        const k = (i + 5) % items.length;
        stock[k][0] += 1;
        moves.push({
          date: day(m, 28),
          type: 3,
          sku: items[k].sku,
          wh: w0,
          qty: 1,
          note: t.sample.countPlus,
        });
      }
    }
    // Urut tanggal (stok awal dulu di hari yang sama), lalu nomor dokumen per jenis.
    moves.sort((a, b) => a.date - b.date || a.type - b.type);
    const seq: Record<string, number> = {};
    for (const mv of moves) {
      const p = t.sample.docPrefix[mv.type];
      seq[p] = (seq[p] ?? 0) + 1;
      mv.doc = `${p}-${String(seq[p]).padStart(4, '0')}`;
    }
    const kept = moves.slice(0, MV_ROWS);
    // Stok opname contoh: 6 barang pertama dihitung, satu di antaranya kurang 1.
    const onHand = items.map((_, i) => stock[i][0] + stock[i][1]);
    const counted = onHand.slice(0, 6).map((n, i) => (i === 3 ? Math.max(0, n - 1) : n));
    return { items, moves: kept, counted, countDate: kept.at(-1)?.date };
  }
}
