/**
 * Template Keuangan UMKM: jurnal kas, piutang, utang, anggaran, laba rugi bulanan, dan dashboard.
 * Semua angka dihitung rumus Excel dari sheet Transaksi, Piutang, dan Utang; sheet lain otomatis.
 */
import type { Locale } from '../format';
import { Workbook, excelDate } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';
import { FINANCE_DEFAULT_ACCOUNTS, FINANCE_LIMITS, FINANCE_PRESETS } from './finance-presets';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  GOOD,
  GOOD_BG,
  MONTHS,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  q,
  seeded,
  sheetHeader,
} from './kit';

export interface FinanceOptions {
  locale: Locale;
  business: string;
  year: number;
  currency: Currency;
  accounts: string[];
  incomeCats: string[];
  expenseCats: string[];
  /** Isi contoh transaksi supaya dashboard langsung terlihat hidup. */
  sample: boolean;
}

const SPARE = 3;
const TX_FIRST = 6;
const TX_ROWS = 1500;
const AR_ROWS = 300;

const L = {
  id: {
    brand: 'TOOLLAND · KEUANGAN UMKM',
    templateName: 'Keuangan UMKM',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tx: 'Transaksi',
      ar: 'Piutang',
      ap: 'Utang',
      budget: 'Anggaran',
      pl: 'Laba Rugi',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Ringkasan bulan yang dipilih dan sepanjang tahun: pendapatan, beban, laba, saldo, piutang, dan utang.',
      tx: 'Catat setiap uang masuk, keluar, dan pindah dana antar akun. Ini sumber semua angka.',
      ar: 'Faktur yang belum dibayar pelanggan, lengkap dengan status jatuh tempo.',
      ap: 'Tagihan pemasok yang harus dibayar, dengan pengingat jatuh tempo.',
      budget: 'Bandingkan anggaran dengan pengeluaran nyata per kategori, per bulan dan setahun.',
      pl: 'Laporan laba rugi bulanan Januari sampai Desember, dihitung otomatis.',
      set: 'Nama usaha, tahun buku, akun kas/bank beserta saldo awal, dan daftar kategori.',
    },
    subtitle: {
      menu: 'Template keuangan lengkap untuk usaha kecil. Mulai dari Pengaturan, lalu catat transaksi.',
      tx: 'Isi sel berwarna krem. Kolom abu-abu (Jenis, Masuk, Keluar, Saldo) terisi otomatis. Urutkan menurut tanggal agar saldo berjalan benar.',
      ar: 'Satu baris per faktur. Status dan hari terlambat dihitung dari tanggal hari ini.',
      ap: 'Satu baris per tagihan pemasok. Isi kolom Dibayar saat melunasi.',
      budget:
        'Anggaran per bulan diatur di sheet Pengaturan. Pilih bulan untuk melihat realisasinya.',
      pl: 'Semua angka diambil dari sheet Transaksi menurut kategori dan tanggal. Tidak perlu diisi.',
      set: 'Atur sekali di awal. Daftar kategori dan akun dipakai di dropdown sheet Transaksi.',
      dash: 'Pilih bulan di bawah. Semua angka dan grafik ikut berubah.',
    },
    steps: [
      'Buka Pengaturan: isi nama usaha, tahun buku, saldo awal tiap akun, dan sesuaikan daftar kategori.',
      'Catat setiap transaksi di sheet Transaksi. Piutang dan utang dicatat di sheetnya masing-masing.',
      'Lihat hasilnya di Dashboard, Laba Rugi, dan Anggaran. Semua terhitung otomatis.',
    ],
    startHere: 'Mulai dalam 3 langkah',
    contents: 'Isi workbook',
    legend: 'Arti warna sel',
    legendInput: 'Isi di sini',
    legendCalc: 'Otomatis (jangan diubah)',
    footer: 'Template gratis dari Toolland · julian-marcell.com/template',
    made: 'Dibuat',
    // Pengaturan
    profile: 'Profil usaha',
    business: 'Nama usaha',
    year: 'Tahun buku',
    currency: 'Mata uang',
    owner: 'Penanggung jawab',
    accountsH: 'Akun kas & bank',
    accName: 'Nama akun',
    opening: 'Saldo awal',
    accNote: 'Keterangan',
    incomeH: 'Kategori pemasukan',
    expenseH: 'Kategori pengeluaran',
    category: 'Kategori',
    target: 'Target / bulan',
    budgetMo: 'Anggaran / bulan',
    combined: 'Daftar dropdown (otomatis)',
    setNote:
      'Isi daftar dari atas tanpa baris kosong di tengah. Mengganti nama kategori tidak mengubah transaksi lama, jadi ubah juga kategorinya di sheet Transaksi.',
    // Transaksi
    tx: [
      'Tanggal',
      'No. bukti',
      'Keterangan',
      'Kategori',
      'Akun',
      'Ke akun (pindah dana)',
      'Jumlah',
      'Jenis',
      'Masuk',
      'Keluar',
      'Saldo',
    ],
    transfer: 'Pindah dana antar akun',
    kindIn: 'Masuk',
    kindOut: 'Keluar',
    kindTransfer: 'Pindah',
    pickCat: 'Pilih kategori',
    pickCatMsg: 'Pilih dari daftar. Ubah daftar kategori di sheet Pengaturan.',
    pickAcc: 'Pilih akun',
    pickAccMsg: 'Akun asal uang. Untuk pindah dana, isi juga kolom Ke akun.',
    badCat: 'Kategori tidak dikenal',
    badCatMsg: 'Pilih kategori dari daftar dropdown.',
    dateTitle: 'Tanggal',
    dateMsg: 'Tulis tanggal, misalnya 15/03/2026.',
    amountMsg: 'Isi angka tanpa titik/koma ribuan, tanpa tanda minus.',
    amountErr: 'Jumlah harus angka 0 atau lebih.',
    // Piutang & utang
    ar: [
      'No. faktur',
      'Pelanggan',
      'Tgl faktur',
      'Jatuh tempo',
      'Nilai',
      'Dibayar',
      'Sisa',
      'Status',
      'Terlambat (hari)',
      'Catatan',
    ],
    ap: [
      'No. tagihan',
      'Pemasok',
      'Tgl tagihan',
      'Jatuh tempo',
      'Nilai',
      'Dibayar',
      'Sisa',
      'Status',
      'Terlambat (hari)',
      'Catatan',
    ],
    paid: 'Lunas',
    open: 'Belum lunas',
    late: 'Terlambat',
    notDue: 'Belum jatuh tempo',
    overpaid: 'Dibayar melebihi nilai faktur.',
    // Anggaran
    month: 'Bulan',
    monthNo: '"(bulan ke-"0")"',
    budget: [
      'Kategori',
      'Anggaran / bulan',
      'Realisasi bulan ini',
      'Sisa bulan ini',
      '% terpakai',
      '',
      'Anggaran setahun',
      'Realisasi setahun',
      'Sisa setahun',
      '% terpakai',
    ],
    total: 'Total',
    // Laba rugi
    plHead: 'Keterangan',
    income: 'Pendapatan',
    expense: 'Beban',
    totalIncome: 'Total pendapatan',
    totalExpense: 'Total beban',
    profit: 'LABA BERSIH',
    margin: 'Margin laba',
    cumulative: 'Laba kumulatif',
    pctIncome: '% pendapatan',
    // Dashboard
    pickMonth: 'Bulan dipilih',
    fiscal: 'Tahun buku ',
    kIncome: 'Pendapatan bulan ini',
    kExpense: 'Beban bulan ini',
    kProfit: 'Laba bersih bulan ini',
    kCash: 'Saldo kas & bank',
    kIncomeYtd: 'Pendapatan s.d. bulan ini',
    kProfitYtd: 'Laba s.d. bulan ini',
    kAr: 'Piutang belum diterima',
    kAp: 'Utang belum dibayar',
    vsPrev: 'vs bulan lalu: ',
    accounts: ' akun',
    lateInvoices: ' faktur terlambat',
    dueSoon: ' jatuh tempo ≤ 7 hari',
    marginNote: 'Margin: ',
    chartIncExp: 'Pendapatan vs beban per bulan',
    chartProfit: 'Laba bersih per bulan',
    chartExp: 'Komposisi beban setahun',
    balanceH: 'Saldo per akun',
    agingH: 'Umur piutang',
    aging: [
      'Belum jatuh tempo',
      'Terlambat 1–30 hari',
      'Terlambat 31–60 hari',
      'Terlambat 61–90 hari',
      'Terlambat > 90 hari',
    ],
    value: 'Nilai',
    account: 'Akun',
    balance: 'Saldo akhir',
    // Contoh data
    sample: {
      sales: 'Penjualan harian',
      order: 'Pesanan',
      buy: 'Belanja',
      rent: 'Sewa bulan ',
      salary: 'Gaji bulan ',
      bill: 'Tagihan ',
      transfer: 'Setor tunai ke bank',
      customers: [
        'CV Maju Jaya',
        'Toko Sinar Abadi',
        'Ibu Ratna',
        'PT Berkah Niaga',
        'Warung Pak Darto',
        'Kafe Senja',
      ],
      suppliers: [
        'UD Sumber Rezeki',
        'PT Grosir Nusantara',
        'CV Kemasan Prima',
        'Toko Bangunan Sentosa',
      ],
    },
  },
  en: {
    brand: 'TOOLLAND · SMALL BUSINESS FINANCE',
    templateName: 'Small Business Finance',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tx: 'Transactions',
      ar: 'Receivables',
      ap: 'Payables',
      budget: 'Budget',
      pl: 'Profit and Loss',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Summary for the selected month and year to date: income, expenses, profit, balances, receivables, and payables.',
      tx: 'Record every money in, money out, and transfer between accounts. Every number comes from here.',
      ar: 'Invoices your customers have not paid yet, with due-date status.',
      ap: 'Supplier bills you need to pay, with due-date reminders.',
      budget: 'Compare budget with actual spending per category, monthly and yearly.',
      pl: 'Monthly profit and loss statement, January to December, calculated automatically.',
      set: 'Business name, fiscal year, cash/bank accounts with opening balances, and category lists.',
    },
    subtitle: {
      menu: 'A complete finance template for small businesses. Start with Settings, then record transactions.',
      tx: 'Fill the cream cells. Grey columns (Type, In, Out, Balance) fill automatically. Keep rows sorted by date for a correct running balance.',
      ar: 'One row per invoice. Status and days late are calculated from today’s date.',
      ap: 'One row per supplier bill. Fill the Paid column when you settle it.',
      budget: 'Monthly budgets are set in Settings. Choose a month to see actual spending.',
      pl: 'All numbers come from the Transactions sheet by category and date. Nothing to fill in.',
      set: 'Set this up once. Categories and accounts feed the dropdowns in Transactions.',
      dash: 'Choose a month below. All numbers and charts follow.',
    },
    steps: [
      'Open Settings: enter your business name, fiscal year, opening balance per account, and adjust the categories.',
      'Record every transaction in Transactions. Receivables and payables go in their own sheets.',
      'See the results in Dashboard, Profit and Loss, and Budget. Everything is calculated for you.',
    ],
    startHere: 'Start in 3 steps',
    contents: 'What’s inside',
    legend: 'Cell colours',
    legendInput: 'Type here',
    legendCalc: 'Automatic (don’t edit)',
    footer: 'Free template from Toolland · julian-marcell.com/en/templates',
    made: 'Created',
    profile: 'Business profile',
    business: 'Business name',
    year: 'Fiscal year',
    currency: 'Currency',
    owner: 'Person in charge',
    accountsH: 'Cash & bank accounts',
    accName: 'Account name',
    opening: 'Opening balance',
    accNote: 'Notes',
    incomeH: 'Income categories',
    expenseH: 'Expense categories',
    category: 'Category',
    target: 'Target / month',
    budgetMo: 'Budget / month',
    combined: 'Dropdown list (automatic)',
    setNote:
      'Fill lists from the top without blank rows in between. Renaming a category does not update old transactions, so change them in Transactions too.',
    tx: [
      'Date',
      'Ref no.',
      'Description',
      'Category',
      'Account',
      'To account (transfer)',
      'Amount',
      'Type',
      'In',
      'Out',
      'Balance',
    ],
    transfer: 'Transfer between accounts',
    kindIn: 'In',
    kindOut: 'Out',
    kindTransfer: 'Transfer',
    pickCat: 'Choose a category',
    pickCatMsg: 'Pick from the list. Edit categories in the Settings sheet.',
    pickAcc: 'Choose an account',
    pickAccMsg: 'Where the money comes from. For transfers, also fill To account.',
    badCat: 'Unknown category',
    badCatMsg: 'Choose a category from the dropdown list.',
    dateTitle: 'Date',
    dateMsg: 'Type a date, for example 15 Mar 2026.',
    amountMsg: 'Enter a number without thousands separators or minus sign.',
    amountErr: 'Amount must be 0 or more.',
    ar: [
      'Invoice no.',
      'Customer',
      'Invoice date',
      'Due date',
      'Amount',
      'Paid',
      'Balance',
      'Status',
      'Days late',
      'Notes',
    ],
    ap: [
      'Bill no.',
      'Supplier',
      'Bill date',
      'Due date',
      'Amount',
      'Paid',
      'Balance',
      'Status',
      'Days late',
      'Notes',
    ],
    paid: 'Paid',
    open: 'Open',
    late: 'Overdue',
    notDue: 'Not due yet',
    overpaid: 'Paid more than the invoice amount.',
    month: 'Month',
    monthNo: '"(month "0")"',
    budget: [
      'Category',
      'Budget / month',
      'Actual this month',
      'Left this month',
      '% used',
      '',
      'Yearly budget',
      'Actual this year',
      'Left this year',
      '% used',
    ],
    total: 'Total',
    plHead: 'Line item',
    income: 'Income',
    expense: 'Expenses',
    totalIncome: 'Total income',
    totalExpense: 'Total expenses',
    profit: 'NET PROFIT',
    margin: 'Profit margin',
    cumulative: 'Cumulative profit',
    pctIncome: '% of income',
    pickMonth: 'Selected month',
    fiscal: 'Fiscal year ',
    kIncome: 'Income this month',
    kExpense: 'Expenses this month',
    kProfit: 'Net profit this month',
    kCash: 'Cash & bank balance',
    kIncomeYtd: 'Income year to date',
    kProfitYtd: 'Profit year to date',
    kAr: 'Receivables outstanding',
    kAp: 'Payables outstanding',
    vsPrev: 'vs last month: ',
    accounts: ' accounts',
    lateInvoices: ' overdue invoices',
    dueSoon: ' due within 7 days',
    marginNote: 'Margin: ',
    chartIncExp: 'Income vs expenses by month',
    chartProfit: 'Net profit by month',
    chartExp: 'Expense breakdown this year',
    balanceH: 'Balance by account',
    agingH: 'Receivables aging',
    aging: [
      'Not due yet',
      '1–30 days late',
      '31–60 days late',
      '61–90 days late',
      'Over 90 days late',
    ],
    value: 'Amount',
    account: 'Account',
    balance: 'Ending balance',
    sample: {
      sales: 'Daily sales',
      order: 'Order',
      buy: 'Purchase',
      rent: 'Rent for ',
      salary: 'Salaries for ',
      bill: 'Bill ',
      transfer: 'Cash deposit to bank',
      customers: [
        'Bright Co.',
        'Sunrise Store',
        'Mrs. Rita',
        'Prime Trading Ltd',
        'Corner Shop',
        'Dusk Café',
      ],
      suppliers: ['Fresh Source Ltd', 'Wholesale Hub', 'Pack Pro Co.', 'Builder Supply'],
    },
  },
};

export function buildFinanceWorkbook(opts: FinanceOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.daun;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];

  const accounts = cleanList(opts.accounts, FINANCE_LIMITS.accounts);
  const incomeCats = cleanList(opts.incomeCats, FINANCE_LIMITS.income);
  const expenseCats = cleanList(opts.expenseCats, FINANCE_LIMITS.expense);
  if (!accounts.length) accounts.push(...FINANCE_DEFAULT_ACCOUNTS[locale]);
  if (!incomeCats.length) incomeCats.push(...FINANCE_PRESETS[locale].umum.income);
  if (!expenseCats.length) expenseCats.push(...FINANCE_PRESETS[locale].umum.expense);
  const nAcc = accounts.length + SPARE;
  const nIn = incomeCats.length + SPARE;
  const nOut = expenseCats.length + SPARE;
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

  // Urutan tab: Menu dulu, data di tengah, pengaturan di akhir.
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, {
    tabColor: accent.main,
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shTx = wb.addSheet(S.tx, {
    tabColor: '8F5E0A',
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shAr = wb.addSheet(S.ar, {
    tabColor: '2C4A86',
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shAp = wb.addSheet(S.ap, {
    tabColor: '2C4A86',
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shBud = wb.addSheet(S.budget, {
    tabColor: '9A2E3F',
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shPl = wb.addSheet(S.pl, {
    tabColor: '9A2E3F',
    gridlines: false,
    landscape: true,
    fitWidth: true,
  });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const txLast = TX_FIRST + TX_ROWS - 1;
  const arLast = TX_FIRST + AR_ROWS - 1;
  const txCol = (c: string) => ref(S.tx, `$${c}$${TX_FIRST}:$${c}$${txLast}`);
  const arCol = (sh: string, c: string) => ref(sh, `$${c}$${TX_FIRST}:$${c}$${arLast}`);

  // ---------- Daftar tersembunyi ----------
  shList.set('B1', t.month);
  months.long.forEach((m, i) => shList.set(`B${i + 2}`, m).set(`C${i + 2}`, months.short[i]));
  wb.defineName('Months', ref(S.list, '$B$2:$B$13'));

  // ---------- Pengaturan ----------
  const setFirst = 13;
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'L',
    menu,
  });
  shSet.widths({ B: 24, C: 18, D: 24, E: 2.5, F: 28, G: 16, H: 2.5, I: 28, J: 16, K: 2.5 });
  shSet.width('L', 28, true);
  shSet.merge('B5:D5', t.profile, st.h2);
  const profile: [string, string | number, typeof st.input][] = [
    [t.business, business, st.inputText],
    [t.year, year, st.inputInt],
    [t.currency, `${currency} (${CURRENCIES[currency].symbol})`, st.calcText],
    [t.owner, '', st.inputText],
  ];
  profile.forEach(([label, v, style], i) => {
    const r = 6 + i;
    shSet.set(`B${r}`, label, st.label).merge(`C${r}:D${r}`, v, style).height(r, 20);
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
    .merge('B11:D11', t.accountsH, st.h2)
    .merge('F11:G11', t.incomeH, st.h2)
    .merge('I11:J11', t.expenseH, st.h2);
  shSet
    .set('B12', t.accName, st.thLeft)
    .set('C12', t.opening, st.th)
    .set('D12', t.accNote, st.thLeft);
  shSet.set('F12', t.category, st.thLeft).set('G12', t.target, st.th);
  shSet.set('I12', t.category, st.thLeft).set('J12', t.budgetMo, st.th);
  shSet.set('L12', t.combined, st.thLeft);
  shSet.height(12, 30);
  const rnd = seeded(year * 31 + accounts.length);
  const scale = { IDR: 1, USD: 1 / 16000, SGD: 1 / 12000, MYR: 1 / 3500, EUR: 1 / 17500 }[currency];
  const money = (idr: number) =>
    currency === 'IDR' ? Math.round(idr / 1000) * 1000 : Math.round(idr * scale);
  for (let k = 0; k < nAcc; k++) {
    const r = setFirst + k;
    const opening = opts.sample ? [5_000_000, 25_000_000, 1_500_000][k] : undefined;
    shSet
      .set(`B${r}`, accounts[k] ?? '', st.inputText)
      .set(`C${r}`, opening === undefined ? null : money(opening), st.inputMoney)
      .set(`D${r}`, '', st.inputText);
  }
  for (let k = 0; k < nIn; k++) {
    const r = setFirst + k;
    shSet.set(`F${r}`, incomeCats[k] ?? '', st.inputText).set(`G${r}`, null, st.inputMoney);
  }
  const budgets = [
    12_000_000, 6_000_000, 3_500_000, 900_000, 450_000, 800_000, 1_200_000, 600_000, 150_000,
    500_000, 400_000,
  ];
  for (let k = 0; k < nOut; k++) {
    const r = setFirst + k;
    const b = opts.sample && k < expenseCats.length ? money(budgets[k] ?? 300_000) : null;
    shSet.set(`I${r}`, expenseCats[k] ?? '', st.inputText).set(`J${r}`, b, st.inputMoney);
  }
  const accRange = `$B$${setFirst}:$B$${setFirst + nAcc - 1}`;
  wb.defineName('Accounts', ref(S.set, accRange));
  wb.defineName('OpeningBalance', ref(S.set, `$C$${setFirst}:$C$${setFirst + nAcc - 1}`));
  wb.defineName('IncomeCats', ref(S.set, `$F$${setFirst}:$F$${setFirst + nIn - 1}`));
  wb.defineName('ExpenseCats', ref(S.set, `$I$${setFirst}:$I$${setFirst + nOut - 1}`));
  // Daftar gabungan untuk dropdown: pemasukan, pengeluaran, lalu "pindah dana".
  const nComb = nIn + nOut + 1;
  for (let k = 1; k <= nComb; k++) {
    shSet.set(
      `L${setFirst + k - 1}`,
      `=IF(${k}<=COUNTA(IncomeCats),INDEX(IncomeCats,${k}),IF(${k}-COUNTA(IncomeCats)<=COUNTA(ExpenseCats),INDEX(ExpenseCats,${k}-COUNTA(IncomeCats)),IF(${k}-COUNTA(IncomeCats)-COUNTA(ExpenseCats)=1,${q(t.transfer)},"")))`,
      st.calcText,
    );
  }
  wb.defineName('Categories', ref(S.set, `$L$${setFirst}:$L$${setFirst + nComb - 1}`));
  const setNoteRow = setFirst + Math.max(nAcc, nIn, nOut) + 1;
  shSet.merge(`B${setNoteRow}:J${setNoteRow + 1}`, t.setNote, st.note);
  shSet.freeze('A13');

  // ---------- Transaksi ----------
  sheetHeader(shTx, st, {
    brand: t.brand,
    title: S.tx,
    subtitle: t.subtitle.tx,
    lastCol: 'L',
    menu,
  });
  shTx.widths({ B: 12, C: 11, D: 34, E: 26, F: 18, G: 20, H: 15, I: 10, J: 15, K: 15, L: 16 });
  const txHead = TX_FIRST - 1;
  t.tx.forEach((h, i) => shTx.set(`${'BCDEFGHIJKL'[i]}${txHead}`, h, i === 2 ? st.thLeft : st.th));
  shTx.height(txHead, 30);
  wb.defineName('TxDate', txCol('B'));
  wb.defineName('TxCategory', txCol('E'));
  wb.defineName('TxAccount', txCol('F'));
  wb.defineName('TxTo', txCol('G'));
  wb.defineName('TxAmount', txCol('H'));
  wb.defineName('TxType', txCol('I'));
  wb.defineName('TxIn', txCol('J'));
  wb.defineName('TxOut', txCol('K'));

  const sampleTx = opts.sample ? sampleTransactions() : [];
  for (let r = TX_FIRST; r <= txLast; r++) {
    const s = sampleTx[r - TX_FIRST];
    shTx
      .set(`B${r}`, s ? s.date : null, st.inputDate)
      .set(`C${r}`, s ? s.no : null, st.inputText)
      .set(`D${r}`, s ? s.desc : null, st.inputText)
      .set(`E${r}`, s ? s.cat : null, st.inputText)
      .set(`F${r}`, s ? s.acc : null, st.inputText)
      .set(`G${r}`, s?.to ?? null, st.inputText)
      .set(`H${r}`, s ? s.amount : null, st.inputMoney)
      .set(
        `I${r}`,
        `=IF(E${r}="","",IF(E${r}=${q(t.transfer)},${q(t.kindTransfer)},IF(COUNTIF(IncomeCats,E${r})>0,${q(t.kindIn)},IF(COUNTIF(ExpenseCats,E${r})>0,${q(t.kindOut)},"?"))))`,
        st.calcCenter,
      )
      .set(`J${r}`, `=IF(I${r}=${q(t.kindIn)},N(H${r}),"")`, st.calcMoney)
      .set(`K${r}`, `=IF(I${r}=${q(t.kindOut)},N(H${r}),"")`, st.calcMoney)
      .set(
        `L${r}`,
        `=IF(H${r}="","",SUM(OpeningBalance)+SUM(J$${TX_FIRST}:J${r})-SUM(K$${TX_FIRST}:K${r}))`,
        st.calcMoney,
      );
  }
  const txRows = (c: string) => `${c}${TX_FIRST}:${c}${txLast}`;
  shTx.validate(txRows('B'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
    promptTitle: t.dateTitle,
    prompt: t.dateMsg,
    error: t.dateMsg,
  });
  shTx.validate(txRows('E'), {
    type: 'list',
    formula1: '=Categories',
    promptTitle: t.pickCat,
    prompt: t.pickCatMsg,
    errorTitle: t.badCat,
    error: t.badCatMsg,
  });
  shTx.validate(txRows('F'), {
    type: 'list',
    formula1: '=Accounts',
    promptTitle: t.pickAcc,
    prompt: t.pickAccMsg,
  });
  shTx.validate(txRows('G'), { type: 'list', formula1: '=Accounts' });
  shTx.validate(txRows('H'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.amountMsg,
    error: t.amountErr,
  });
  shTx.cond(txRows('B'), {
    type: 'expression',
    formula: `AND($B${TX_FIRST}<>"",YEAR($B${TX_FIRST})<>FiscalYear)`,
    style: { fill: WARN_BG },
  });
  shTx.cond(txRows('I'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { bold: true, color: BAD } },
  });
  shTx.cond(txRows('I'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.kindIn),
    style: { font: { bold: true, color: GOOD } },
  });
  shTx.cond(txRows('I'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.kindOut),
    style: { font: { color: BAD } },
  });
  shTx.cond(txRows('G'), {
    type: 'expression',
    formula: `AND($I${TX_FIRST}=${q(t.kindTransfer)},OR($G${TX_FIRST}="",$G${TX_FIRST}=$F${TX_FIRST}))`,
    style: { fill: BAD_BG },
  });
  shTx.freeze(`A${TX_FIRST}`).autoFilter(`B${txHead}:L${txLast}`).printTitles(txHead, txHead);

  // ---------- Piutang & Utang ----------
  const arSheet = (
    sh: typeof shAr,
    name: string,
    heads: string[],
    subtitle: string,
    prefix: 'Ar' | 'Ap',
    samples: SampleDoc[],
  ) => {
    sheetHeader(sh, st, { brand: t.brand, title: name, subtitle, lastCol: 'K', menu });
    sh.widths({ B: 13, C: 26, D: 12, E: 12, F: 15, G: 15, H: 15, I: 17, J: 11, K: 28 });
    heads.forEach((h, i) =>
      sh.set(`${'BCDEFGHIJK'[i]}${txHead}`, h, i === 1 || i === 9 ? st.thLeft : st.th),
    );
    sh.height(txHead, 30);
    for (let r = TX_FIRST; r <= arLast; r++) {
      const s = samples[r - TX_FIRST];
      sh.set(`B${r}`, s?.no ?? null, st.inputText)
        .set(`C${r}`, s?.party ?? null, st.inputText)
        .set(`D${r}`, s?.date ?? null, st.inputDate)
        .set(`E${r}`, s?.due ?? null, st.inputDate)
        .set(`F${r}`, s?.amount ?? null, st.inputMoney)
        .set(`G${r}`, s?.paid ?? null, st.inputMoney)
        .set(`H${r}`, `=IF(F${r}="","",F${r}-N(G${r}))`, st.calcMoney)
        .set(
          `I${r}`,
          `=IF(F${r}="","",IF(H${r}<=0,${q(t.paid)},IF(E${r}="",${q(t.open)},IF(TODAY()>E${r},${q(t.late)},${q(t.notDue)}))))`,
          st.calcCenter,
        )
        .set(`J${r}`, `=IF(I${r}=${q(t.late)},TODAY()-E${r},"")`, st.calcInt)
        .set(`K${r}`, null, st.inputText);
    }
    const rows = (c: string) => `${c}${TX_FIRST}:${c}${arLast}`;
    for (const c of ['D', 'E'])
      sh.validate(rows(c), {
        type: 'date',
        operator: 'between',
        formula1: 'DATE(2000,1,1)',
        formula2: 'DATE(2100,12,31)',
        errorStyle: 'warning',
        prompt: t.dateMsg,
        error: t.dateMsg,
      });
    sh.validate(rows('F'), {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
      error: t.amountErr,
    });
    sh.validate(rows('G'), {
      type: 'custom',
      formula1: `N(G${TX_FIRST})<=N(F${TX_FIRST})`,
      errorStyle: 'warning',
      error: t.overpaid,
    });
    sh.cond(rows('I'), {
      type: 'cellIs',
      operator: 'equal',
      formula: q(t.paid),
      style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
    });
    sh.cond(rows('I'), {
      type: 'cellIs',
      operator: 'equal',
      formula: q(t.late),
      style: { fill: BAD_BG, font: { color: BAD, bold: true } },
    });
    sh.cond(rows('J'), {
      type: 'cellIs',
      operator: 'greaterThan',
      formula: '60',
      style: { font: { color: BAD, bold: true } },
    });
    sh.freeze(`A${TX_FIRST}`).autoFilter(`B${txHead}:K${arLast}`).printTitles(txHead, txHead);
    wb.defineName(`${prefix}Balance`, arCol(name, 'H'));
    wb.defineName(`${prefix}Status`, arCol(name, 'I'));
    wb.defineName(`${prefix}Late`, arCol(name, 'J'));
    wb.defineName(`${prefix}Due`, arCol(name, 'E'));
  };
  const docs = opts.sample ? sampleDocs() : { ar: [], ap: [] };
  arSheet(shAr, S.ar, t.ar, t.subtitle.ar, 'Ar', docs.ar);
  arSheet(shAp, S.ap, t.ap, t.subtitle.ap, 'Ap', docs.ap);

  // ---------- Laba Rugi ----------
  sheetHeader(shPl, st, {
    brand: t.brand,
    title: S.pl,
    subtitle: t.subtitle.pl,
    lastCol: 'P',
    menu,
  });
  const MCOLS = 'CDEFGHIJKLMN';
  shPl.width('B', 30);
  for (const c of MCOLS) shPl.width(c, 12.5);
  shPl.widths({ O: 15, P: 11 });
  shPl.set('B5', t.plHead, st.thLeft);
  months.short.forEach((m, i) => shPl.set(`${MCOLS[i]}5`, m, st.th));
  shPl.set('O5', t.total, st.th).set('P5', t.pctIncome, st.th).height(5, 24);
  const plRow = (r: number, labelF: string, filter: string) => {
    shPl.set(`B${r}`, labelF, st.rowLabel);
    for (let m = 1; m <= 12; m++) {
      shPl.set(
        `${MCOLS[m - 1]}${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCategory,$B${r},TxType,${filter},TxDate,">="&DATE(FiscalYear,${m},1),TxDate,"<"&DATE(FiscalYear,${m + 1},1)))`,
        st.rowMoney,
      );
    }
    shPl.set(`O${r}`, `=IF($B${r}="","",SUM(C${r}:N${r}))`, {
      ...st.rowMoney,
      font: { size: 10, bold: true },
    });
  };
  shPl.merge('B6:P6', t.income, st.section);
  const inFirst = 7;
  for (let k = 0; k < nIn; k++)
    plRow(
      inFirst + k,
      `=IF('${S.set}'!F${setFirst + k}="","",'${S.set}'!F${setFirst + k})`,
      q(t.kindIn),
    );
  const tIn = inFirst + nIn;
  shPl.merge(`B${tIn + 2}:P${tIn + 2}`, t.expense, st.section);
  const outFirst = tIn + 3;
  for (let k = 0; k < nOut; k++)
    plRow(
      outFirst + k,
      `=IF('${S.set}'!I${setFirst + k}="","",'${S.set}'!I${setFirst + k})`,
      q(t.kindOut),
    );
  const tOut = outFirst + nOut;
  const profitRow = tOut + 2;
  const marginRow = profitRow + 1;
  const cumRow = profitRow + 2;
  shPl.set(`B${tIn}`, t.totalIncome, st.totalLabel).set(`B${tOut}`, t.totalExpense, st.totalLabel);
  shPl
    .set(`B${profitRow}`, t.profit, st.grandLabel)
    .set(`B${marginRow}`, t.margin, st.rowLabel)
    .set(`B${cumRow}`, t.cumulative, st.rowLabel);
  shPl.height(profitRow, 24);
  for (const c of [...MCOLS, 'O']) {
    shPl.set(`${c}${tIn}`, `=SUM(${c}${inFirst}:${c}${tIn - 1})`, st.totalMoney);
    shPl.set(`${c}${tOut}`, `=SUM(${c}${outFirst}:${c}${tOut - 1})`, st.totalMoney);
    shPl.set(`${c}${profitRow}`, `=${c}${tIn}-${c}${tOut}`, st.grandMoney);
    shPl.set(`${c}${marginRow}`, `=IF(N(${c}${tIn})=0,"",${c}${profitRow}/${c}${tIn})`, st.rowPct);
  }
  [...MCOLS].forEach((c, i) =>
    shPl.set(
      `${c}${cumRow}`,
      i === 0 ? `=C${profitRow}` : `=${MCOLS[i - 1]}${cumRow}+${c}${profitRow}`,
      st.rowMoney,
    ),
  );
  shPl.set(`O${cumRow}`, `=N${cumRow}`, st.rowMoney);
  const chartRow = cumRow + 1;
  // Baris bantu grafik laba (disembunyikan): bulan tanpa data = #N/A agar garis tidak jatuh ke 0.
  shPl.hideRow(chartRow);
  for (const c of MCOLS)
    shPl.set(
      `${c}${chartRow}`,
      `=IF(AND(N(${c}${tIn})=0,N(${c}${tOut})=0),NA(),${c}${profitRow})`,
      st.rowMoney,
    );
  for (let r = inFirst; r <= tOut; r++) {
    if (r === tIn || r === tIn + 1 || r === tIn + 2) continue;
    shPl.set(
      `P${r}`,
      `=IF(OR($B${r}="",N($O$${tIn})=0),"",O${r}/$O$${tIn})`,
      r === tOut ? st.grandPct : st.rowPct,
    );
  }
  shPl.set(`P${tIn}`, `=IF(N($O$${tIn})=0,"",1)`, st.grandPct);
  shPl.set(`P${profitRow}`, `=IF(N($O$${tIn})=0,"",O${profitRow}/$O$${tIn})`, st.grandPct);
  shPl.cond(`C${profitRow}:O${profitRow}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  shPl.freeze('C6').printTitles(5, 5);
  const plMonths = ref(S.pl, '$C$5:$N$5');
  const plLine = (r: number) => ref(S.pl, `$C$${r}:$N$${r}`);

  // ---------- Anggaran ----------
  sheetHeader(shBud, st, {
    brand: t.brand,
    title: S.budget,
    subtitle: t.subtitle.budget,
    lastCol: 'K',
    menu,
  });
  shBud.widths({ B: 28, C: 15, D: 15, E: 15, F: 11, G: 2.5, H: 15, I: 15, J: 15, K: 11 });
  // Bulan awal di dropdown: bulan ini untuk tahun berjalan, Desember untuk tahun yang sudah lewat.
  const thisYear = new Date().getFullYear();
  const nowMonth = year === thisYear ? new Date().getMonth() : year < thisYear ? 11 : 0;
  shBud
    .set('B5', t.month, st.label)
    .set('C5', months.long[nowMonth], { ...st.inputText, font: { size: 11, bold: true } });
  shBud
    .set('D5', '=MATCH(C5,Months,0)', { ...st.note, numFmt: t.monthNo, align: { v: 'center' } })
    .height(5, 22);
  shBud.validate('C5', { type: 'list', formula1: '=Months' });
  const budHead = 7;
  t.budget.forEach((h, i) => {
    if (h) shBud.set(`${'BCDEFGHIJK'[i]}${budHead}`, h, i === 0 ? st.thLeft : st.th);
  });
  shBud.height(budHead, 30);
  const budFirst = budHead + 1;
  const mStart = 'DATE(FiscalYear,$D$5,1)';
  const mEnd = 'DATE(FiscalYear,$D$5+1,1)';
  for (let k = 0; k < nOut; k++) {
    const r = budFirst + k;
    const s = setFirst + k;
    shBud
      .set(`B${r}`, `=IF('${S.set}'!I${s}="","",'${S.set}'!I${s})`, st.rowLabel)
      .set(`C${r}`, `=IF($B${r}="","",N('${S.set}'!J${s}))`, st.rowMoney)
      .set(
        `D${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCategory,$B${r},TxType,${q(t.kindOut)},TxDate,">="&${mStart},TxDate,"<"&${mEnd}))`,
        st.rowMoney,
      )
      .set(`E${r}`, `=IF($B${r}="","",C${r}-D${r})`, st.rowMoney)
      .set(`F${r}`, `=IF(OR($B${r}="",N(C${r})=0),"",D${r}/C${r})`, st.rowPct)
      .set(`H${r}`, `=IF($B${r}="","",C${r}*12)`, st.rowMoney)
      .set(
        `I${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCategory,$B${r},TxType,${q(t.kindOut)},TxDate,">="&DATE(FiscalYear,1,1),TxDate,"<"&DATE(FiscalYear+1,1,1)))`,
        st.rowMoney,
      )
      .set(`J${r}`, `=IF($B${r}="","",H${r}-I${r})`, st.rowMoney)
      .set(`K${r}`, `=IF(OR($B${r}="",N(H${r})=0),"",I${r}/H${r})`, st.rowPct);
  }
  const budTotal = budFirst + nOut;
  const budLast = budTotal - 1;
  shBud.set(`B${budTotal}`, t.total, st.totalLabel);
  for (const c of ['C', 'D', 'E', 'H', 'I', 'J'])
    shBud.set(`${c}${budTotal}`, `=SUM(${c}${budFirst}:${c}${budLast})`, st.totalMoney);
  shBud.set(`F${budTotal}`, `=IF(N(C${budTotal})=0,"",D${budTotal}/C${budTotal})`, st.grandPct);
  shBud.set(`K${budTotal}`, `=IF(N(H${budTotal})=0,"",I${budTotal}/H${budTotal})`, st.grandPct);
  for (const c of ['F', 'K']) {
    shBud.cond(`${c}${budFirst}:${c}${budLast}`, {
      type: 'cellIs',
      operator: 'greaterThan',
      formula: '1',
      style: { fill: BAD_BG, font: { color: BAD, bold: true } },
    });
    shBud.cond(`${c}${budFirst}:${c}${budLast}`, {
      type: 'dataBar',
      color: accent.main,
      min: '0',
      max: '1',
    });
  }
  shBud.freeze(`A${budFirst}`).printTitles(budHead, budHead);

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  shDash.set('B2', `=${q(S.dash + ' · ')}&BusinessName`, st.title);
  shDash
    .set('B5', t.pickMonth, st.label)
    .merge('D5:E5', months.long[nowMonth], { ...st.inputText, font: { size: 11, bold: true } });
  shDash.set('F5', '=MATCH(D5,Months,0)', {
    ...st.note,
    numFmt: t.monthNo,
    align: { v: 'center' },
  });
  shDash.merge('H5:J5', `=${q(t.fiscal)}&FiscalYear`, { ...st.label, align: { v: 'center' } });
  shDash.validate('D5', { type: 'list', formula1: '=Months' });
  shDash.height(5, 22).height(6, 8).height(10, 10);
  const at = (r: number) => `INDEX(${plLine(r)},1,$F$5)`;
  const prevNote = (r: number) =>
    `=IF($F$5=1,"",IF(N(INDEX(${plLine(r)},1,$F$5-1))=0,"",${q(t.vsPrev)}&TEXT(${at(r)}/INDEX(${plLine(r)},1,$F$5-1)-1,"+0%;-0%")))`;
  const ytd = (r: number) =>
    `SUMPRODUCT(${plLine(r)}*(COLUMN(${plLine(r)})-COLUMN(${ref(S.pl, `$C$${r}`)})+1<=$F$5))`;
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kIncome,
    value: `=${at(tIn)}`,
    note: prevNote(tIn),
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kExpense,
    value: `=${at(tOut)}`,
    note: prevNote(tOut),
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kProfit,
    value: `=${at(profitRow)}`,
    note: `=IF(N(${at(tIn)})=0,"",${q(t.marginNote)}&TEXT(${at(profitRow)}/${at(tIn)},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kCash,
    value: '=SUM(OpeningBalance)+SUM(TxIn)-SUM(TxOut)',
    note: `=COUNTA(Accounts)&${q(t.accounts)}`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kIncomeYtd,
    value: `=${ytd(tIn)}`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kProfitYtd,
    value: `=${ytd(profitRow)}`,
    note: `=IF(N(${ytd(tIn)})=0,"",${q(t.marginNote)}&TEXT(${ytd(profitRow)}/${ytd(tIn)},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kAr,
    value: '=SUM(ArBalance)',
    note: `=COUNTIF(ArStatus,${q(t.late)})&${q(t.lateInvoices)}`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kAp,
    value: '=SUM(ApBalance)',
    note: `=COUNTIFS(ApStatus,${q(t.notDue)},ApDue,"<="&(TODAY()+7))+COUNTIF(ApStatus,${q(t.late)})&${q(t.dueSoon)}`,
  });
  shDash.chart({
    type: 'column',
    title: t.chartIncExp,
    from: 'B15',
    to: 'H33',
    numFmt: '#,##0',
    series: [
      { name: t.income, categories: plMonths, values: plLine(tIn), color: accent.main },
      { name: t.expense, categories: plMonths, values: plLine(tOut), color: 'A8461F' },
    ],
  });
  shDash.chart({
    type: 'line',
    title: t.chartProfit,
    from: 'H15',
    to: 'N33',
    numFmt: '#,##0',
    legend: 'none',
    series: [{ name: t.profit, categories: plMonths, values: plLine(chartRow), color: '2C4A86' }],
  });
  shDash.chart({
    type: 'doughnut',
    title: t.chartExp,
    from: 'B35',
    to: 'H55',
    legend: 'r',
    // Hanya kategori yang terisi saat dibuat, agar legenda tidak berisi slot kosong.
    sliceColors: expenseCats.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    series: [
      {
        name: t.expense,
        categories: ref(S.pl, `$B$${outFirst}:$B$${outFirst + expenseCats.length - 1}`),
        values: ref(S.pl, `$O$${outFirst}:$O$${outFirst + expenseCats.length - 1}`),
      },
    ],
  });
  // Saldo per akun
  shDash.merge('I35:M35', t.balanceH, st.h2);
  shDash.merge('I36:J36', t.account, st.thLeft).merge('K36:M36', t.balance, st.th);
  for (let k = 0; k < nAcc; k++) {
    const r = 37 + k;
    shDash.merge(
      `I${r}:J${r}`,
      `=IF(INDEX(Accounts,${k + 1})="","",INDEX(Accounts,${k + 1}))`,
      st.rowLabel,
    );
    shDash.merge(
      `K${r}:M${r}`,
      `=IF(I${r}="","",N(INDEX(OpeningBalance,${k + 1}))+SUMIFS(TxIn,TxAccount,I${r})-SUMIFS(TxOut,TxAccount,I${r})+SUMIFS(TxAmount,TxType,${q(t.kindTransfer)},TxTo,I${r})-SUMIFS(TxAmount,TxType,${q(t.kindTransfer)},TxAccount,I${r}))`,
      st.rowMoney,
    );
  }
  const balTotal = 37 + nAcc;
  shDash
    .merge(`I${balTotal}:J${balTotal}`, t.total, st.totalLabel)
    .merge(`K${balTotal}:M${balTotal}`, `=SUM(K37:K${balTotal - 1})`, st.totalMoney);
  // Umur piutang
  const agH = balTotal + 2;
  shDash.merge(`I${agH}:M${agH}`, t.agingH, st.h2);
  shDash
    .merge(`I${agH + 1}:K${agH + 1}`, t.agingH, st.thLeft)
    .merge(`L${agH + 1}:M${agH + 1}`, t.value, st.th);
  const agingF = [
    `=SUMIFS(ArBalance,ArStatus,${q(t.notDue)})+SUMIFS(ArBalance,ArStatus,${q(t.open)})`,
    '=SUMIFS(ArBalance,ArLate,">=1",ArLate,"<=30")',
    '=SUMIFS(ArBalance,ArLate,">=31",ArLate,"<=60")',
    '=SUMIFS(ArBalance,ArLate,">=61",ArLate,"<=90")',
    '=SUMIFS(ArBalance,ArLate,">90")',
  ];
  t.aging.forEach((label, i) => {
    const r = agH + 2 + i;
    shDash.merge(`I${r}:K${r}`, label, st.rowLabel).merge(`L${r}:M${r}`, agingF[i], st.rowMoney);
  });
  const agT = agH + 2 + t.aging.length;
  shDash
    .merge(`I${agT}:K${agT}`, t.total, st.totalLabel)
    .merge(`L${agT}:M${agT}`, `=SUM(L${agH + 2}:L${agT - 1})`, st.totalMoney);
  shDash.cond('H8:J8', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });

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
    [S.tx, t.desc.tx],
    [S.ar, t.desc.ar],
    [S.ap, t.desc.ap],
    [S.budget, t.desc.budget],
    [S.pl, t.desc.pl],
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
  shMenu.set('C20', t.footer, st.footer);
  shMenu.set(
    'C21',
    `${t.made} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
    st.footer,
  );

  return wb;

  // ---------- Contoh data ----------
  function sampleTransactions() {
    const rows: {
      date: number;
      no: string;
      desc: string;
      cat: string;
      acc: string;
      to?: string;
      amount: number;
    }[] = [];
    const lastMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
    const exp = (i: number) => expenseCats[Math.min(i, expenseCats.length - 1)];
    const acc0 = accounts[0];
    const acc1 = accounts[1] ?? accounts[0];
    for (let m = 1; m <= lastMonth; m++) {
      const days = new Date(year, m, 0).getDate();
      const grow = 1 + m * 0.04;
      for (let i = 0; i < 9; i++) {
        const d = Math.min(days, 1 + Math.floor(rnd() * days));
        const cat = rnd() < 0.75 ? incomeCats[0] : pick(incomeCats);
        rows.push({
          date: excelDate(year, m, d),
          no: '',
          desc: rnd() < 0.6 ? t.sample.sales : `${t.sample.order} #${100 + rows.length}`,
          cat,
          acc: rnd() < 0.5 ? acc0 : acc1,
          amount: money((1_200_000 + rnd() * 3_800_000) * grow),
        });
      }
      rows.push({
        date: excelDate(year, m, 2),
        no: '',
        desc: `${t.sample.rent}${months.long[m - 1]}`,
        cat: exp(2),
        acc: acc1,
        amount: money(3_500_000),
      });
      rows.push({
        date: excelDate(year, m, 25),
        no: '',
        desc: `${t.sample.salary}${months.long[m - 1]}`,
        cat: exp(1),
        acc: acc1,
        amount: money(6_000_000),
      });
      for (let i = 0; i < 4; i++) {
        const d = Math.min(days, 3 + Math.floor(rnd() * (days - 3)));
        rows.push({
          date: excelDate(year, m, d),
          no: '',
          desc: t.sample.buy,
          cat: exp(0),
          acc: rnd() < 0.5 ? acc0 : acc1,
          amount: money(1_500_000 + rnd() * 2_500_000),
        });
      }
      for (const [i, base] of [
        [3, 850_000],
        [4, 400_000],
        [5, 600_000],
        [6, 900_000],
      ] as const) {
        if (i < expenseCats.length)
          rows.push({
            date: excelDate(year, m, Math.min(days, 5 + i * 3)),
            no: '',
            desc: `${t.sample.bill}${exp(i)}`,
            cat: exp(i),
            acc: acc1,
            amount: money(base * (0.8 + rnd() * 0.5)),
          });
      }
      if (accounts.length > 1)
        rows.push({
          date: excelDate(year, m, Math.min(days, 15)),
          no: '',
          desc: t.sample.transfer,
          cat: t.transfer,
          acc: acc0,
          to: acc1,
          amount: money(5_000_000),
        });
    }
    rows.sort((a, b) => a.date - b.date);
    rows.forEach((r, i) => (r.no = `TRX-${String(i + 1).padStart(4, '0')}`));
    return rows.slice(0, TX_ROWS);
  }

  function sampleDocs(): { ar: SampleDoc[]; ap: SampleDoc[] } {
    const now = new Date();
    const base =
      year === now.getFullYear()
        ? excelDate(year, now.getMonth() + 1, now.getDate())
        : excelDate(year, 12, 31);
    const mk = (
      prefix: string,
      i: number,
      party: string,
      ago: number,
      term: number,
      amount: number,
      paidPart: number,
    ): SampleDoc => ({
      no: `${prefix}-${String(i + 1).padStart(3, '0')}`,
      party,
      date: base - ago,
      due: base - ago + term,
      amount: money(amount),
      paid: paidPart ? money(amount * paidPart) : null,
    });
    const c = t.sample.customers;
    const s = t.sample.suppliers;
    return {
      ar: [
        mk('INV', 0, c[0], 95, 30, 8_500_000, 0),
        mk('INV', 1, c[1], 50, 30, 4_250_000, 0.5),
        mk('INV', 2, c[2], 40, 14, 1_800_000, 1),
        mk('INV', 3, c[3], 20, 30, 12_000_000, 0),
        mk('INV', 4, c[4], 10, 14, 2_150_000, 0),
        mk('INV', 5, c[5], 3, 30, 3_600_000, 0),
      ],
      ap: [
        mk('BILL', 0, s[0], 35, 30, 6_400_000, 0),
        mk('BILL', 1, s[1], 25, 30, 9_800_000, 0.4),
        mk('BILL', 2, s[2], 15, 14, 1_250_000, 1),
        mk('BILL', 3, s[3], 5, 7, 2_700_000, 0),
      ],
    };
  }
}

interface SampleDoc {
  no: string;
  party: string;
  date: number;
  due: number;
  amount: number;
  paid: number | null;
}
