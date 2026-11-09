/**
 * Template Keuangan Pribadi: transaksi harian per dompet, anggaran dengan aturan 50/30/20,
 * laporan tahunan, target tabungan, utang & cicilan, kekayaan bersih, dan dashboard.
 * Setoran tabungan dan pembayaran cicilan ditautkan lewat kolom "Untuk tujuan / utang".
 */
import type { Locale } from '../format';
import { type Style, Workbook, excelDate } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';
import {
  type BudgetGroup,
  type ExpenseCat,
  PERSONAL_LIMITS,
  PERSONAL_PRESETS,
  PERSONAL_WALLETS,
  type PersonalPresetId,
  SAMPLE_INCOME,
} from './personal-presets';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
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

export interface PersonalOptions {
  locale: Locale;
  name: string;
  year: number;
  currency: Currency;
  wallets: string[];
  incomeCats: string[];
  /** Kategori pengeluaran beserta kelompok 50/30/20 dan anggaran (dalam rupiah, dikonversi). */
  expenseCats: ExpenseCat[];
  preset: PersonalPresetId;
  sample: boolean;
}

const SPARE = 3;
const FIRST = 6;
const TX_ROWS = 2000;
const GOAL_ROWS = 15;
const DEBT_ROWS = 15;
const ASSET_ROWS = 15;
const GROUPS: BudgetGroup[] = ['N', 'W', 'S'];

const L = {
  id: {
    brand: 'TOOLLAND · KEUANGAN PRIBADI',
    templateName: 'Keuangan Pribadi',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tx: 'Transaksi',
      budget: 'Anggaran',
      report: 'Laporan Tahunan',
      goals: 'Target Tabungan',
      debts: 'Utang & Cicilan',
      worth: 'Kekayaan Bersih',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Pemasukan, pengeluaran, tabungan, saldo dompet, sisa anggaran, target, utang, dan kekayaan bersih.',
      tx: 'Catat setiap uang masuk, keluar, dan pindah dana antar dompet. Sumber semua angka.',
      budget: 'Anggaran vs realisasi per kategori, plus analisis aturan 50/30/20.',
      report:
        'Pemasukan dan pengeluaran per kategori, Januari sampai Desember, dengan tingkat menabung.',
      goals:
        'Tujuan tabungan: target, tenggat, terkumpul, dan berapa yang perlu ditabung per bulan.',
      debts: 'Utang dan cicilan: sisa utang, sisa bulan, dan perkiraan tanggal lunas.',
      worth: 'Saldo dompet, aset lain, dan utang: berapa kekayaan bersihmu sekarang.',
      set: 'Nama, tahun, dompet beserta saldo awal, kategori, kelompok 50/30/20, dan anggaran.',
    },
    subtitle: {
      menu: 'Template keuangan pribadi dan rumah tangga. Mulai dari Pengaturan, lalu catat pengeluaran setiap hari.',
      tx: 'Isi sel krem. Untuk menabung ke tujuan atau membayar cicilan, pilih namanya di kolom Untuk tujuan / utang.',
      budget:
        'Anggaran per bulan diatur di sheet Pengaturan. Pilih bulan untuk melihat realisasinya.',
      report: 'Semua angka diambil dari sheet Transaksi. Tidak perlu diisi.',
      goals:
        'Tulis tujuanmu. Setoran dihitung dari transaksi yang kolom Untuk tujuan-nya berisi nama tujuan ini.',
      debts:
        'Tulis utang dan cicilanmu. Pembayaran dihitung dari transaksi yang kolom Untuk utang-nya berisi nama ini.',
      worth:
        'Saldo dompet dan sisa utang terisi otomatis. Tambahkan aset lain seperti emas, reksa dana, atau kendaraan.',
      set: 'Atur sekali di awal. Daftar ini dipakai di dropdown sheet Transaksi.',
      dash: 'Pilih bulan di bawah. Angka bulanan dan grafik ikut berubah.',
    },
    steps: [
      'Buka Pengaturan: isi nama, saldo awal tiap dompet, dan sesuaikan kategori serta anggaran bulanan.',
      'Catat setiap pemasukan dan pengeluaran di Transaksi. Tulis juga target tabungan dan utangmu.',
      'Pantau Dashboard dan Anggaran setiap minggu. Semua angka dan grafik terhitung otomatis.',
    ],
    startHere: 'Mulai dalam 3 langkah',
    contents: 'Isi workbook',
    legend: 'Arti warna sel',
    legendInput: 'Isi di sini',
    legendCalc: 'Otomatis (jangan diubah)',
    footer: 'Template gratis dari Toolland · julian-marcell.com/template',
    made: 'Dibuat',
    fiscal: 'Tahun ',
    profile: 'Profil',
    name: 'Nama',
    year: 'Tahun',
    currency: 'Mata uang',
    savingTarget: 'Target menabung (% pemasukan)',
    walletsH: 'Dompet & rekening',
    walletName: 'Nama dompet',
    opening: 'Saldo awal',
    balanceNow: 'Saldo sekarang',
    incomeH: 'Kategori pemasukan',
    expenseH: 'Kategori pengeluaran',
    category: 'Kategori',
    group: 'Kelompok',
    budgetMo: 'Anggaran / bulan',
    groups: { N: 'Kebutuhan', W: 'Keinginan', S: 'Tabungan' } as Record<BudgetGroup, string>,
    groupNote:
      'Kelompok 50/30/20: Kebutuhan = wajib (makan, sewa, tagihan, cicilan). Keinginan = bisa ditunda (hiburan, belanja). Tabungan = menabung dan investasi.',
    setNote:
      'Isi daftar dari atas tanpa baris kosong di tengah. Mengganti nama kategori tidak mengubah transaksi lama.',
    tx: [
      'Tanggal',
      'Keterangan',
      'Kategori',
      'Dompet',
      'Ke dompet (pindah)',
      'Jumlah',
      'Untuk tujuan / utang',
      'Jenis',
      'Masuk',
      'Keluar',
      'Saldo total',
    ],
    transfer: 'Pindah dana antar dompet',
    kindIn: 'Masuk',
    kindOut: 'Keluar',
    kindTransfer: 'Pindah',
    pickCat: 'Pilih kategori',
    pickCatMsg: 'Ubah daftar kategori di sheet Pengaturan.',
    pickWallet: 'Dompet asal uang. Untuk pindah dana, isi juga Ke dompet.',
    linkMsg:
      'Opsional. Pilih nama tujuan tabungan atau utang bila transaksi ini setoran tabungan atau bayar cicilan.',
    dateMsg: 'Tulis tanggal, misalnya 15/03/2026.',
    amountMsg: 'Isi angka tanpa titik/koma ribuan, tanpa tanda minus.',
    amountErr: 'Jumlah harus angka 0 atau lebih.',
    month: 'Bulan',
    monthNo: '"(bulan ke-"0")"',
    budget: [
      'Kategori',
      'Kelompok',
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
    rule: 'Aturan 50/30/20 bulan ini',
    ruleHead: ['Kelompok', 'Ideal', 'Realisasi', '% pemasukan', 'Status'],
    ruleIncome: 'Pemasukan bulan ini',
    ruleLeft: 'Sisa pemasukan (belum dipakai)',
    ok: 'Sesuai',
    over: 'Melebihi',
    under: 'Kurang',
    ruleNote:
      'Aturan 50/30/20: maksimal 50% pemasukan untuk kebutuhan, 30% untuk keinginan, dan minimal 20% ditabung. Sisa pemasukan yang tidak terpakai ikut dihitung sebagai tabungan. Angka ideal bisa diubah.',
    plHead: 'Keterangan',
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    totalIncome: 'Total pemasukan',
    totalExpense: 'Total pengeluaran',
    net: 'DITABUNG (SISA)',
    rate: 'Tingkat menabung',
    cumulative: 'Tabungan kumulatif',
    pctIncome: '% pemasukan',
    goals: [
      'Nama tujuan',
      'Target',
      'Tenggat',
      'Sudah ada sebelumnya',
      'Terkumpul',
      'Kurang',
      'Progres',
      'Sisa bulan',
      'Perlu / bulan',
      'Status',
    ],
    reached: 'Tercapai',
    late: 'Lewat tenggat',
    onGoing: 'Berjalan',
    debts: [
      'Nama utang',
      'Pemberi pinjaman',
      'Total utang',
      'Cicilan / bulan',
      'Mulai',
      'Bunga / tahun',
      'Sudah dibayar sebelumnya',
      'Total dibayar',
      'Sisa utang',
      'Lunas',
      'Sisa cicilan (bulan)',
      'Perkiraan lunas',
      'Status',
    ],
    paidOff: 'Lunas',
    running: 'Berjalan',
    worthSum: 'Ringkasan',
    totalAssets: 'Total aset',
    totalDebts: 'Total utang',
    netWorth: 'KEKAYAAN BERSIH',
    walletBal: 'Saldo dompet (otomatis)',
    walletHead: ['Dompet', 'Saldo'],
    assetsH: 'Aset lain',
    assetHead: ['Nama aset', 'Jenis', 'Nilai sekarang', 'Catatan'],
    assetTypes: ['Tabungan / deposito', 'Investasi', 'Emas', 'Properti', 'Kendaraan', 'Lainnya'],
    debtsH: 'Utang (otomatis)',
    debtHead: ['Nama utang', 'Pemberi pinjaman', 'Sisa utang'],
    pickMonth: 'Bulan dipilih',
    kIncome: 'Pemasukan bulan ini',
    kExpense: 'Pengeluaran bulan ini',
    kNet: 'Ditabung bulan ini',
    kWallets: 'Saldo semua dompet',
    kBudgetLeft: 'Sisa anggaran bulan ini',
    kGoals: 'Terkumpul untuk tujuan',
    kDebt: 'Sisa utang',
    kWorth: 'Kekayaan bersih',
    vsPrev: 'vs bulan lalu: ',
    rateNote: 'Tingkat menabung: ',
    walletCount: ' dompet',
    usedNote: ' anggaran terpakai',
    ofTarget: ' dari target',
    installNote: 'Cicilan per bulan: ',
    worthNote: 'Aset dikurangi utang',
    chartFlow: 'Pemasukan vs pengeluaran per bulan',
    chartCum: 'Tabungan kumulatif',
    chartExp: 'Pengeluaran setahun per kategori',
    walletTable: 'Saldo per dompet',
    goalTable: 'Progres tujuan tabungan',
    goalHead: ['Tujuan', 'Progres', 'Kurang'],
    noGoals: 'Tulis tujuan di sheet Target Tabungan.',
    sample: {
      salary: 'Gaji bulan ',
      bonus: 'Bonus',
      side: 'Penghasilan sampingan',
      atm: 'Tarik tunai',
      house: 'Rumah',
      topup: 'Isi saldo e-wallet',
      save: 'Setor tabungan: ',
      pay: 'Bayar cicilan ',
      goals: ['Dana darurat', 'Liburan ke Bali', 'Laptop baru'],
      debts: { small: ['Cicilan motor', 'Leasing motor'], home: ['KPR rumah', 'Bank BTN'] },
      assets: [
        ['Emas 10 gram', 2, 13_000_000],
        ['Reksa dana pasar uang', 1, 5_000_000],
        ['Motor', 4, 15_000_000],
      ] as [string, number, number][],
      desc: ['Belanja', 'Bayar', 'Beli'],
    },
  },
  en: {
    brand: 'TOOLLAND · PERSONAL FINANCE',
    templateName: 'Personal Finance',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      tx: 'Transactions',
      budget: 'Budget',
      report: 'Yearly Report',
      goals: 'Savings Goals',
      debts: 'Debts & Loans',
      worth: 'Net Worth',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Income, spending, savings, wallet balances, budget left, goals, debts, and net worth.',
      tx: 'Record every money in, money out, and transfer between wallets. Every number comes from here.',
      budget: 'Budget vs actual by category, plus a 50/30/20 rule check.',
      report: 'Income and spending by category, January to December, with your savings rate.',
      goals: 'Savings goals: target, deadline, amount saved, and how much to save each month.',
      debts: 'Debts and loans: balance left, months left, and estimated payoff date.',
      worth: 'Wallets, other assets, and debts: what you are worth right now.',
      set: 'Name, year, wallets with opening balances, categories, 50/30/20 groups, and budgets.',
    },
    subtitle: {
      menu: 'A personal and household finance template. Start with Settings, then record your spending every day.',
      tx: 'Fill the cream cells. To save towards a goal or pay a loan, pick its name in the For goal / debt column.',
      budget: 'Monthly budgets are set in Settings. Choose a month to see actual spending.',
      report: 'All numbers come from the Transactions sheet. Nothing to fill in.',
      goals:
        'Write down your goals. Deposits count from transactions whose For goal column has this goal’s name.',
      debts:
        'Write down your debts. Payments count from transactions whose For debt column has this name.',
      worth:
        'Wallet balances and debts fill in automatically. Add other assets such as gold, funds, or a vehicle.',
      set: 'Set this up once. These lists feed the dropdowns in Transactions.',
      dash: 'Choose a month below. Monthly numbers and charts follow.',
    },
    steps: [
      'Open Settings: enter your name, the opening balance of each wallet, and adjust categories and monthly budgets.',
      'Record every income and expense in Transactions. Add your savings goals and debts too.',
      'Check the Dashboard and Budget every week. Every number and chart is calculated for you.',
    ],
    startHere: 'Start in 3 steps',
    contents: 'What’s inside',
    legend: 'Cell colours',
    legendInput: 'Type here',
    legendCalc: 'Automatic (don’t edit)',
    footer: 'Free template from Toolland · julian-marcell.com/en/templates',
    made: 'Created',
    fiscal: 'Year ',
    profile: 'Profile',
    name: 'Name',
    year: 'Year',
    currency: 'Currency',
    savingTarget: 'Savings target (% of income)',
    walletsH: 'Wallets & accounts',
    walletName: 'Wallet name',
    opening: 'Opening balance',
    balanceNow: 'Current balance',
    incomeH: 'Income categories',
    expenseH: 'Expense categories',
    category: 'Category',
    group: 'Group',
    budgetMo: 'Budget / month',
    groups: { N: 'Needs', W: 'Wants', S: 'Savings' } as Record<BudgetGroup, string>,
    groupNote:
      '50/30/20 groups: Needs = must-pay (food, rent, bills, loan repayments). Wants = can wait (fun, shopping). Savings = saving and investing.',
    setNote:
      'Fill lists from the top without blank rows in between. Renaming a category does not update old transactions.',
    tx: [
      'Date',
      'Description',
      'Category',
      'Wallet',
      'To wallet (transfer)',
      'Amount',
      'For goal / debt',
      'Type',
      'In',
      'Out',
      'Total balance',
    ],
    transfer: 'Transfer between wallets',
    kindIn: 'In',
    kindOut: 'Out',
    kindTransfer: 'Transfer',
    pickCat: 'Choose a category',
    pickCatMsg: 'Edit categories in the Settings sheet.',
    pickWallet: 'Where the money comes from. For transfers, also fill To wallet.',
    linkMsg:
      'Optional. Pick a savings goal or debt when this is a savings deposit or a loan payment.',
    dateMsg: 'Type a date, for example 15 Mar 2026.',
    amountMsg: 'Enter a number without thousands separators or minus sign.',
    amountErr: 'Amount must be 0 or more.',
    month: 'Month',
    monthNo: '"(month "0")"',
    budget: [
      'Category',
      'Group',
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
    rule: '50/30/20 rule this month',
    ruleHead: ['Group', 'Ideal', 'Actual', '% of income', 'Status'],
    ruleIncome: 'Income this month',
    ruleLeft: 'Income left (not spent)',
    ok: 'On track',
    over: 'Over',
    under: 'Below',
    ruleNote:
      'The 50/30/20 rule: at most 50% of income on needs, 30% on wants, and at least 20% saved. Unspent income counts as savings. You can change the ideal numbers.',
    plHead: 'Line item',
    income: 'Income',
    expense: 'Spending',
    totalIncome: 'Total income',
    totalExpense: 'Total spending',
    net: 'SAVED (LEFT OVER)',
    rate: 'Savings rate',
    cumulative: 'Cumulative savings',
    pctIncome: '% of income',
    goals: [
      'Goal',
      'Target',
      'Deadline',
      'Already saved before',
      'Saved',
      'Still needed',
      'Progress',
      'Months left',
      'Needed / month',
      'Status',
    ],
    reached: 'Reached',
    late: 'Past deadline',
    onGoing: 'In progress',
    debts: [
      'Debt',
      'Lender',
      'Total owed',
      'Payment / month',
      'Start',
      'Interest / year',
      'Paid before',
      'Total paid',
      'Balance left',
      'Paid off',
      'Payments left',
      'Est. payoff',
      'Status',
    ],
    paidOff: 'Paid off',
    running: 'Active',
    worthSum: 'Summary',
    totalAssets: 'Total assets',
    totalDebts: 'Total debts',
    netWorth: 'NET WORTH',
    walletBal: 'Wallet balances (automatic)',
    walletHead: ['Wallet', 'Balance'],
    assetsH: 'Other assets',
    assetHead: ['Asset', 'Type', 'Current value', 'Notes'],
    assetTypes: ['Savings / deposit', 'Investment', 'Gold', 'Property', 'Vehicle', 'Other'],
    debtsH: 'Debts (automatic)',
    debtHead: ['Debt', 'Lender', 'Balance left'],
    pickMonth: 'Selected month',
    kIncome: 'Income this month',
    kExpense: 'Spending this month',
    kNet: 'Saved this month',
    kWallets: 'All wallets',
    kBudgetLeft: 'Budget left this month',
    kGoals: 'Saved for goals',
    kDebt: 'Debt left',
    kWorth: 'Net worth',
    vsPrev: 'vs last month: ',
    rateNote: 'Savings rate: ',
    walletCount: ' wallets',
    usedNote: ' of budget used',
    ofTarget: ' of target',
    installNote: 'Monthly payments: ',
    worthNote: 'Assets minus debts',
    chartFlow: 'Income vs spending by month',
    chartCum: 'Cumulative savings',
    chartExp: 'Spending this year by category',
    walletTable: 'Balance by wallet',
    goalTable: 'Savings goal progress',
    goalHead: ['Goal', 'Progress', 'Still needed'],
    noGoals: 'Add goals in the Savings Goals sheet.',
    sample: {
      salary: 'Salary for ',
      bonus: 'Bonus',
      side: 'Side income',
      atm: 'Cash withdrawal',
      house: 'House',
      topup: 'E-wallet top-up',
      save: 'Savings deposit: ',
      pay: 'Payment ',
      goals: ['Emergency fund', 'Holiday in Bali', 'New laptop'],
      debts: {
        small: ['Motorbike loan', 'Motor finance'],
        home: ['Home mortgage', 'National Bank'],
      },
      assets: [
        ['Gold 10 g', 2, 13_000_000],
        ['Money market fund', 1, 5_000_000],
        ['Motorbike', 4, 15_000_000],
      ] as [string, number, number][],
      desc: ['Shopping', 'Paid', 'Bought'],
    },
  },
};

export function buildPersonalWorkbook(opts: PersonalOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.kunyit;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];
  const preset = PERSONAL_PRESETS[locale][opts.preset] ?? PERSONAL_PRESETS[locale].lajang;
  const KIN = q(t.kindIn);
  const KOUT = q(t.kindOut);
  const KTR = q(t.kindTransfer);

  const wallets = cleanList(opts.wallets, PERSONAL_LIMITS.wallets);
  const incomeCats = cleanList(opts.incomeCats, PERSONAL_LIMITS.income);
  const expNames = cleanList(
    opts.expenseCats.map((e) => e[0]),
    PERSONAL_LIMITS.expense,
  );
  // Nama yang sudah dirapikan, dengan kelompok dan anggaran dari isian aslinya.
  let expenses: ExpenseCat[] = expNames.map((n) => {
    const e = opts.expenseCats.find((x) => x[0].replace(/\s+/g, ' ').trim().slice(0, 60) === n);
    return [n, e?.[1] ?? 'N', e?.[2] ?? 0];
  });
  if (!wallets.length) wallets.push(...PERSONAL_WALLETS[locale]);
  if (!incomeCats.length) incomeCats.push(...preset.income);
  if (!expenses.length) expenses = preset.expense;
  const nW = wallets.length + SPARE;
  const nIn = incomeCats.length + SPARE;
  const nOut = expenses.length + SPARE;
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const owner = opts.name.trim().slice(0, 80) || (locale === 'id' ? 'Nama Kamu' : 'Your Name');

  const scale = { IDR: 1, USD: 1 / 16000, SGD: 1 / 12000, MYR: 1 / 3500, EUR: 1 / 17500 }[currency];
  const dec = CURRENCIES[currency].decimals;
  const money = (idr: number) =>
    currency === 'IDR'
      ? Math.round(idr / 1000) * 1000
      : Math.round(idr * scale * 10 ** dec) / 10 ** dec;

  const wb = new Workbook({
    title: `${t.templateName} – ${owner}`,
    subject: t.templateName,
    company: owner,
  });
  const menu = { label: t.menu, sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };

  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shTx = wb.addSheet(S.tx, { tabColor: '3C6A33', ...landscape });
  const shBud = wb.addSheet(S.budget, { tabColor: '9A2E3F', ...landscape });
  const shRep = wb.addSheet(S.report, { tabColor: '9A2E3F', ...landscape });
  const shGoal = wb.addSheet(S.goals, { tabColor: '2C4A86', ...landscape });
  const shDebt = wb.addSheet(S.debts, { tabColor: '2C4A86', ...landscape });
  const shWorth = wb.addSheet(S.worth, { tabColor: 'A8461F', gridlines: false, fitWidth: true });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const txLast = FIRST + TX_ROWS - 1;
  const txCol = (c: string) => ref(S.tx, `$${c}$${FIRST}:$${c}$${txLast}`);
  const thisYear = new Date().getFullYear();
  const nowMonth = year === thisYear ? new Date().getMonth() : year < thisYear ? 11 : 0;
  const pick: Style = { ...st.inputText, font: { size: 11, bold: true } };

  const sample = opts.sample ? makeSample() : undefined;

  // ---------- Daftar tersembunyi ----------
  months.long.forEach((m, i) => shList.set(`B${i + 2}`, m));
  wb.defineName('Months', ref(S.list, '$B$2:$B$13'));
  GROUPS.forEach((g, i) => shList.set(`D${i + 2}`, t.groups[g]));
  wb.defineName('Groups', ref(S.list, '$D$2:$D$4'));
  t.assetTypes.forEach((x, i) => shList.set(`F${i + 2}`, x));
  wb.defineName('AssetTypes', ref(S.list, `$F$2:$F$${1 + t.assetTypes.length}`));

  // ---------- Pengaturan ----------
  const setFirst = 13;
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'K',
    menu,
  });
  shSet.widths({ B: 22, C: 15, D: 15, E: 2.5, F: 26, G: 2.5, H: 28, I: 13, J: 15, K: 6 });
  shSet.width('M', 6, true).width('N', 6, true);
  shSet.merge('B5:D5', t.profile, st.h2);
  const profile: [string, string | number, Style][] = [
    [t.name, owner, st.inputText],
    [t.year, year, st.inputInt],
    [t.currency, `${currency} (${CURRENCIES[currency].symbol})`, st.calcText],
    [t.savingTarget, 20, { ...st.input, numFmt: '0"%"', align: { h: 'center' } }],
  ];
  profile.forEach(([label, v, style], i) => {
    shSet
      .set(`B${6 + i}`, label, st.label)
      .merge(`C${6 + i}:D${6 + i}`, v, style)
      .height(6 + i, 20);
  });
  shSet.validate('C7', {
    type: 'whole',
    operator: 'between',
    formula1: '2000',
    formula2: '2100',
    error: '2000–2100',
  });
  wb.defineName('OwnerName', ref(S.set, '$C$6'));
  wb.defineName('PlanYear', ref(S.set, '$C$7'));
  wb.defineName('SavingTarget', ref(S.set, '$C$9'));
  shSet
    .merge('B11:D11', t.walletsH, st.h2)
    .set('F11', t.incomeH, st.h2)
    .merge('H11:J11', t.expenseH, st.h2);
  shSet
    .set('B12', t.walletName, st.thLeft)
    .set('C12', t.opening, st.th)
    .set('D12', t.balanceNow, st.th)
    .set('F12', t.category, st.thLeft)
    .set('H12', t.category, st.thLeft)
    .set('I12', t.group, st.th)
    .set('J12', t.budgetMo, st.th)
    .height(12, 30);
  const openings = [500_000, 8_000_000, 300_000];
  for (let k = 0; k < nW; k++) {
    const r = setFirst + k;
    shSet
      .set(`B${r}`, wallets[k] ?? null, st.inputText)
      .set(`C${r}`, sample && k < wallets.length ? money(openings[k] ?? 0) : null, st.inputMoney)
      .set(
        `D${r}`,
        `=IF(B${r}="","",N(C${r})+SUMIFS(TxIn,TxWallet,B${r})-SUMIFS(TxOut,TxWallet,B${r})+SUMIFS(TxAmount,TxType,${KTR},TxTo,B${r})-SUMIFS(TxAmount,TxType,${KTR},TxWallet,B${r}))`,
        { ...st.calcMoney, font: { size: 10, bold: true } },
      );
  }
  for (let k = 0; k < nIn; k++) shSet.set(`F${setFirst + k}`, incomeCats[k] ?? null, st.inputText);
  for (let k = 0; k < nOut; k++) {
    const e = expenses[k];
    const r = setFirst + k;
    shSet
      .set(`H${r}`, e?.[0] ?? null, st.inputText)
      .set(`I${r}`, e ? t.groups[e[1]] : null, { ...st.inputText, align: { h: 'center' } })
      .set(`J${r}`, e && e[2] ? money(e[2]) : null, st.inputMoney);
  }
  const rng = (c: string, n: number) => ref(S.set, `$${c}$${setFirst}:$${c}$${setFirst + n - 1}`);
  wb.defineName('Wallets', rng('B', nW));
  wb.defineName('WalletOpening', rng('C', nW));
  wb.defineName('WalletBalance', rng('D', nW));
  wb.defineName('IncomeCats', rng('F', nIn));
  wb.defineName('ExpenseCats', rng('H', nOut));
  wb.defineName('ExpenseGroup', rng('I', nOut));
  wb.defineName('ExpenseBudget', rng('J', nOut));
  shSet.validate(`I${setFirst}:I${setFirst + nOut - 1}`, { type: 'list', formula1: '=Groups' });
  shSet.validate(`J${setFirst}:J${setFirst + nOut - 1}`, {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    error: t.amountErr,
  });
  // Daftar dropdown gabungan (kolom tersembunyi): kategori + "pindah dana", dan tujuan + utang.
  const nComb = nIn + nOut + 1;
  for (let k = 1; k <= nComb; k++)
    shSet.set(
      `M${setFirst + k - 1}`,
      `=IF(${k}<=COUNTA(IncomeCats),INDEX(IncomeCats,${k}),IF(${k}-COUNTA(IncomeCats)<=COUNTA(ExpenseCats),INDEX(ExpenseCats,${k}-COUNTA(IncomeCats)),IF(${k}-COUNTA(IncomeCats)-COUNTA(ExpenseCats)=1,${q(t.transfer)},"")))`,
    );
  wb.defineName('Categories', rng('M', nComb));
  const nLink = GOAL_ROWS + DEBT_ROWS;
  for (let k = 1; k <= nLink; k++)
    shSet.set(
      `N${setFirst + k - 1}`,
      `=IF(${k}<=COUNTA(Goals),INDEX(Goals,${k}),IF(${k}-COUNTA(Goals)<=COUNTA(Debts),INDEX(Debts,${k}-COUNTA(Goals)),""))`,
    );
  wb.defineName('Links', rng('N', nLink));
  const noteRow = setFirst + Math.max(nW, nIn, nOut) + 1;
  shSet.merge(`B${noteRow}:J${noteRow + 1}`, t.groupNote, st.note);
  shSet.merge(`B${noteRow + 2}:J${noteRow + 3}`, t.setNote, st.note);
  shSet.freeze('A13');

  // ---------- Transaksi ----------
  sheetHeader(shTx, st, {
    brand: t.brand,
    title: S.tx,
    subtitle: t.subtitle.tx,
    lastCol: 'L',
    menu,
  });
  shTx.widths({ B: 12, C: 30, D: 24, E: 16, F: 16, G: 14, H: 20, I: 9, J: 14, K: 14, L: 15 });
  shTx.width('M', 6, true).width('N', 6, true);
  t.tx.forEach((h, i) => shTx.set(`${'BCDEFGHIJKL'[i]}${head}`, h, i === 1 ? st.thLeft : st.th));
  shTx.set(`M${head}`, '#').set(`N${head}`, '#').height(head, 30);
  for (let r = FIRST; r <= txLast; r++) {
    const s = sample?.tx[r - FIRST];
    shTx
      .set(`B${r}`, s?.date ?? null, st.inputDate)
      .set(`C${r}`, s?.desc ?? null, st.inputText)
      .set(`D${r}`, s?.cat ?? null, st.inputText)
      .set(`E${r}`, s?.wallet ?? null, st.inputText)
      .set(`F${r}`, s?.to ?? null, st.inputText)
      .set(`G${r}`, s?.amount ?? null, st.inputMoney)
      .set(`H${r}`, s?.link ?? null, st.inputText)
      .set(
        `I${r}`,
        `=IF(D${r}="","",IF(D${r}=${q(t.transfer)},${KTR},IF(COUNTIF(IncomeCats,D${r})>0,${KIN},IF(COUNTIF(ExpenseCats,D${r})>0,${KOUT},"?"))))`,
        st.calcCenter,
      )
      .set(`J${r}`, `=IF(I${r}=${KIN},N(G${r}),"")`, st.calcMoney)
      .set(`K${r}`, `=IF(I${r}=${KOUT},N(G${r}),"")`, st.calcMoney)
      .set(
        `L${r}`,
        `=IF(G${r}="","",SUM(WalletOpening)+SUM(J$${FIRST}:J${r})-SUM(K$${FIRST}:K${r}))`,
        st.calcMoney,
      )
      .set(`M${r}`, `=IF(B${r}="","",IF(YEAR(B${r})=PlanYear,MONTH(B${r}),""))`)
      .set(
        `N${r}`,
        `=IF(I${r}=${KOUT},IFERROR(INDEX(ExpenseGroup,MATCH(D${r},ExpenseCats,0)),""),"")`,
      );
  }
  const txRows = (c: string) => `${c}${FIRST}:${c}${txLast}`;
  shTx.validate(txRows('B'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
    prompt: t.dateMsg,
    error: t.dateMsg,
  });
  shTx.validate(txRows('D'), {
    type: 'list',
    formula1: '=Categories',
    promptTitle: t.pickCat,
    prompt: t.pickCatMsg,
  });
  shTx.validate(txRows('E'), { type: 'list', formula1: '=Wallets', prompt: t.pickWallet });
  shTx.validate(txRows('F'), { type: 'list', formula1: '=Wallets' });
  shTx.validate(txRows('G'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.amountMsg,
    error: t.amountErr,
  });
  shTx.validate(txRows('H'), {
    type: 'list',
    formula1: '=Links',
    prompt: t.linkMsg,
    errorStyle: 'warning',
  });
  shTx.cond(txRows('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",YEAR($B${FIRST})<>PlanYear)`,
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
    formula: KIN,
    style: { font: { bold: true, color: GOOD } },
  });
  shTx.cond(txRows('I'), {
    type: 'cellIs',
    operator: 'equal',
    formula: KOUT,
    style: { font: { color: BAD } },
  });
  shTx.cond(txRows('F'), {
    type: 'expression',
    formula: `AND($I${FIRST}=${KTR},OR($F${FIRST}="",$F${FIRST}=$E${FIRST}))`,
    style: { fill: BAD_BG },
  });
  shTx.freeze(`A${FIRST}`).autoFilter(`B${head}:L${txLast}`).printTitles(head, head);
  const txNames: [string, string][] = [
    ['TxDate', 'B'],
    ['TxCat', 'D'],
    ['TxWallet', 'E'],
    ['TxTo', 'F'],
    ['TxAmount', 'G'],
    ['TxLink', 'H'],
    ['TxType', 'I'],
    ['TxIn', 'J'],
    ['TxOut', 'K'],
    ['TxMonth', 'M'],
    ['TxGroup', 'N'],
  ];
  for (const [n, c] of txNames) wb.defineName(n, txCol(c));

  // ---------- Target Tabungan ----------
  sheetHeader(shGoal, st, {
    brand: t.brand,
    title: S.goals,
    subtitle: t.subtitle.goals,
    lastCol: 'K',
    menu,
  });
  shGoal.widths({ B: 26, C: 15, D: 12, E: 15, F: 15, G: 15, H: 11, I: 10, J: 15, K: 14 });
  t.goals.forEach((h, i) =>
    shGoal.set(`${'BCDEFGHIJK'[i]}${head}`, h, i === 0 ? st.thLeft : st.th),
  );
  shGoal.height(head, 30);
  const goalLast = FIRST + GOAL_ROWS - 1;
  for (let r = FIRST; r <= goalLast; r++) {
    const g = sample?.goals[r - FIRST];
    shGoal
      .set(`B${r}`, g?.name ?? null, st.inputText)
      .set(`C${r}`, g?.target ?? null, st.inputMoney)
      .set(`D${r}`, g?.deadline ?? null, st.inputDate)
      .set(`E${r}`, g?.before ?? null, st.inputMoney)
      .set(`F${r}`, `=IF(B${r}="","",N(E${r})+SUMIFS(TxAmount,TxLink,B${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`G${r}`, `=IF(B${r}="","",MAX(0,N(C${r})-F${r}))`, st.calcMoney)
      .set(`H${r}`, `=IF(OR(B${r}="",N(C${r})=0),"",MIN(1,F${r}/C${r}))`, st.calcPct)
      .set(
        `I${r}`,
        `=IF(OR(B${r}="",D${r}=""),"",IF(D${r}<=TODAY(),0,DATEDIF(TODAY(),D${r},"m")))`,
        st.calcInt,
      )
      .set(`J${r}`, `=IF(B${r}="","",IF(G${r}=0,0,IF(N(I${r})>0,G${r}/I${r},G${r})))`, st.calcMoney)
      .set(
        `K${r}`,
        `=IF(B${r}="","",IF(F${r}>=N(C${r}),${q(t.reached)},IF(AND(D${r}<>"",D${r}<TODAY()),${q(t.late)},${q(t.onGoing)})))`,
        st.calcCenter,
      );
  }
  const gr = (c: string) => `${c}${FIRST}:${c}${goalLast}`;
  shGoal.validate(gr('D'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
    prompt: t.dateMsg,
  });
  for (const c of ['C', 'E'])
    shGoal.validate(gr(c), {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
      error: t.amountErr,
    });
  shGoal.cond(gr('H'), { type: 'dataBar', color: accent.main, min: '0', max: '1' });
  shGoal.cond(gr('K'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.reached),
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shGoal.cond(gr('K'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.late),
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shGoal.freeze(`A${FIRST}`);
  const goalCol = (c: string) => ref(S.goals, `$${c}$${FIRST}:$${c}$${goalLast}`);
  wb.defineName('Goals', goalCol('B'));
  wb.defineName('GoalTarget', goalCol('C'));
  wb.defineName('GoalSaved', goalCol('F'));
  wb.defineName('GoalLeft', goalCol('G'));
  wb.defineName('GoalPct', goalCol('H'));

  // ---------- Utang & Cicilan ----------
  sheetHeader(shDebt, st, {
    brand: t.brand,
    title: S.debts,
    subtitle: t.subtitle.debts,
    lastCol: 'N',
    menu,
  });
  shDebt.widths({
    B: 22,
    C: 18,
    D: 15,
    E: 14,
    F: 12,
    G: 10,
    H: 15,
    I: 15,
    J: 15,
    K: 9,
    L: 11,
    M: 13,
    N: 11,
  });
  t.debts.forEach((h, i) =>
    shDebt.set(`${'BCDEFGHIJKLMN'[i]}${head}`, h, i < 2 ? st.thLeft : st.th),
  );
  shDebt.height(head, 32);
  const debtLast = FIRST + DEBT_ROWS - 1;
  for (let r = FIRST; r <= debtLast; r++) {
    const d = sample?.debts[r - FIRST];
    shDebt
      .set(`B${r}`, d?.name ?? null, st.inputText)
      .set(`C${r}`, d?.lender ?? null, st.inputText)
      .set(`D${r}`, d?.total ?? null, st.inputMoney)
      .set(`E${r}`, d?.install ?? null, st.inputMoney)
      .set(`F${r}`, d?.start ?? null, st.inputDate)
      .set(`G${r}`, d?.rate ?? null, { ...st.input, numFmt: '0.0"%"', align: { h: 'center' } })
      .set(`H${r}`, d?.before ?? null, st.inputMoney)
      .set(
        `I${r}`,
        `=IF(B${r}="","",N(H${r})+SUMIFS(TxAmount,TxLink,B${r},TxType,${KOUT}))`,
        st.calcMoney,
      )
      .set(`J${r}`, `=IF(B${r}="","",MAX(0,N(D${r})-I${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`K${r}`, `=IF(OR(B${r}="",N(D${r})=0),"",MIN(1,I${r}/D${r}))`, st.calcPct)
      .set(`L${r}`, `=IF(OR(B${r}="",N(J${r})=0,N(E${r})=0),"",ROUNDUP(J${r}/E${r},0))`, st.calcInt)
      .set(`M${r}`, `=IF(L${r}="","",EDATE(TODAY(),L${r}))`, { ...st.calcDate, numFmt: 'mmm yyyy' })
      .set(`N${r}`, `=IF(B${r}="","",IF(J${r}<=0,${q(t.paidOff)},${q(t.running)}))`, st.calcCenter);
  }
  const dr = (c: string) => `${c}${FIRST}:${c}${debtLast}`;
  for (const c of ['D', 'E', 'H'])
    shDebt.validate(dr(c), {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
      error: t.amountErr,
    });
  shDebt.cond(dr('K'), { type: 'dataBar', color: '3C6A33', min: '0', max: '1' });
  shDebt.cond(dr('N'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.paidOff),
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shDebt.freeze(`A${FIRST}`);
  const debtCol = (c: string) => ref(S.debts, `$${c}$${FIRST}:$${c}$${debtLast}`);
  wb.defineName('Debts', debtCol('B'));
  wb.defineName('DebtLender', debtCol('C'));
  wb.defineName('DebtInstall', debtCol('E'));
  wb.defineName('DebtLeft', debtCol('J'));
  wb.defineName('DebtStatus', debtCol('N'));

  // ---------- Kekayaan Bersih ----------
  sheetHeader(shWorth, st, {
    brand: t.brand,
    title: S.worth,
    subtitle: t.subtitle.worth,
    lastCol: 'I',
    menu,
  });
  shWorth.widths({ B: 28, C: 20, D: 17, E: 26, F: 3, G: 22, H: 18, I: 6 });
  shWorth.merge('B5:D5', t.walletBal, st.h2);
  shWorth.merge('B6:C6', t.walletHead[0], st.thLeft).set('D6', t.walletHead[1], st.th);
  for (let k = 0; k < nW; k++) {
    const r = 7 + k;
    const s = `'${S.set}'!`;
    shWorth
      .merge(`B${r}:C${r}`, `=IF(${s}B${setFirst + k}="","",${s}B${setFirst + k})`, st.rowLabel)
      .set(`D${r}`, `=IF(B${r}="","",${s}D${setFirst + k})`, st.rowMoney);
  }
  const wTot = 7 + nW;
  shWorth
    .merge(`B${wTot}:C${wTot}`, t.total, st.totalLabel)
    .set(`D${wTot}`, `=SUM(D7:D${wTot - 1})`, st.totalMoney);
  const aH = wTot + 2;
  shWorth.merge(`B${aH}:E${aH}`, t.assetsH, st.h2);
  t.assetHead.forEach((h, i) =>
    shWorth.set(`${'BCDE'[i]}${aH + 1}`, h, i === 2 ? st.th : st.thLeft),
  );
  const aFirst = aH + 2;
  for (let k = 0; k < ASSET_ROWS; k++) {
    const r = aFirst + k;
    const a = sample?.assets[k];
    shWorth
      .set(`B${r}`, a?.[0] ?? null, st.inputText)
      .set(`C${r}`, a ? t.assetTypes[a[1]] : null, st.inputText)
      .set(`D${r}`, a?.[2] ?? null, st.inputMoney)
      .set(`E${r}`, null, st.inputText);
  }
  const aTot = aFirst + ASSET_ROWS;
  shWorth.validate(`C${aFirst}:C${aTot - 1}`, {
    type: 'list',
    formula1: '=AssetTypes',
    errorStyle: 'warning',
  });
  shWorth
    .merge(`B${aTot}:C${aTot}`, t.total, st.totalLabel)
    .set(`D${aTot}`, `=SUM(D${aFirst}:D${aTot - 1})`, st.totalMoney);
  const dH = aTot + 2;
  shWorth.merge(`B${dH}:D${dH}`, t.debtsH, st.h2);
  t.debtHead.forEach((h, i) => shWorth.set(`${'BCD'[i]}${dH + 1}`, h, i === 2 ? st.th : st.thLeft));
  const dFirst = dH + 2;
  for (let k = 0; k < DEBT_ROWS; k++) {
    const r = dFirst + k;
    const d = `'${S.debts}'!`;
    shWorth
      .set(`B${r}`, `=IF(${d}B${FIRST + k}="","",${d}B${FIRST + k})`, st.rowLabel)
      .set(`C${r}`, `=IF(B${r}="","",${d}C${FIRST + k}&"")`, st.rowLabel)
      .set(`D${r}`, `=IF(B${r}="","",${d}J${FIRST + k})`, st.rowMoney);
  }
  const dTot = dFirst + DEBT_ROWS;
  shWorth
    .merge(`B${dTot}:C${dTot}`, t.total, st.totalLabel)
    .set(`D${dTot}`, `=SUM(D${dFirst}:D${dTot - 1})`, st.totalMoney);
  shWorth.merge('G5:H5', t.worthSum, st.h2);
  shWorth.set('G6', t.totalAssets, st.rowLabel).set('H6', `=D${wTot}+D${aTot}`, st.rowMoney);
  shWorth.set('G7', t.totalDebts, st.rowLabel).set('H7', `=D${dTot}`, st.rowMoney);
  shWorth.set('G8', t.netWorth, st.grandLabel).set('H8', '=H6-H7', st.grandMoney).height(8, 26);
  shWorth.cond('H8', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  wb.defineName('NetWorth', ref(S.worth, '$H$8'));

  // ---------- Laporan Tahunan ----------
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
  shRep.widths({ O: 15, P: 11 });
  shRep.set('B5', t.plHead, st.thLeft);
  months.short.forEach((m, i) => shRep.set(`${MCOLS[i]}5`, m, st.th));
  shRep.set('O5', t.total, st.th).set('P5', t.pctIncome, st.th).height(5, 24);
  const plRow = (r: number, labelF: string, kind: string) => {
    shRep.set(`B${r}`, labelF, st.rowLabel);
    for (let m = 1; m <= 12; m++)
      shRep.set(
        `${MCOLS[m - 1]}${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCat,$B${r},TxType,${kind},TxMonth,${m}))`,
        st.rowMoney,
      );
    shRep.set(`O${r}`, `=IF($B${r}="","",SUM(C${r}:N${r}))`, {
      ...st.rowMoney,
      font: { size: 10, bold: true },
    });
  };
  shRep.merge('B6:P6', t.income, st.section);
  const inFirst = 7;
  for (let k = 0; k < nIn; k++)
    plRow(inFirst + k, `=IF('${S.set}'!F${setFirst + k}="","",'${S.set}'!F${setFirst + k})`, KIN);
  const tIn = inFirst + nIn;
  shRep.merge(`B${tIn + 2}:P${tIn + 2}`, t.expense, st.section);
  const outFirst = tIn + 3;
  for (let k = 0; k < nOut; k++)
    plRow(outFirst + k, `=IF('${S.set}'!H${setFirst + k}="","",'${S.set}'!H${setFirst + k})`, KOUT);
  const tOut = outFirst + nOut;
  const netRow = tOut + 2;
  const rateRow = netRow + 1;
  const cumRow = netRow + 2;
  shRep.set(`B${tIn}`, t.totalIncome, st.totalLabel).set(`B${tOut}`, t.totalExpense, st.totalLabel);
  shRep
    .set(`B${netRow}`, t.net, st.grandLabel)
    .set(`B${rateRow}`, t.rate, st.rowLabel)
    .set(`B${cumRow}`, t.cumulative, st.rowLabel);
  shRep.height(netRow, 24);
  for (const c of [...MCOLS, 'O']) {
    shRep.set(`${c}${tIn}`, `=SUM(${c}${inFirst}:${c}${tIn - 1})`, st.totalMoney);
    shRep.set(`${c}${tOut}`, `=SUM(${c}${outFirst}:${c}${tOut - 1})`, st.totalMoney);
    shRep.set(`${c}${netRow}`, `=${c}${tIn}-${c}${tOut}`, st.grandMoney);
    shRep.set(`${c}${rateRow}`, `=IF(N(${c}${tIn})=0,"",${c}${netRow}/${c}${tIn})`, st.rowPct);
  }
  [...MCOLS].forEach((c, i) =>
    shRep.set(
      `${c}${cumRow}`,
      i === 0 ? `=C${netRow}` : `=${MCOLS[i - 1]}${cumRow}+${c}${netRow}`,
      st.rowMoney,
    ),
  );
  shRep.set(`O${cumRow}`, `=N${cumRow}`, st.rowMoney);
  for (let r = inFirst; r <= tOut; r++) {
    if (r === tIn + 1 || r === tIn + 2) continue;
    shRep.set(
      `P${r}`,
      r === tIn
        ? `=IF(N($O$${tIn})=0,"",1)`
        : `=IF(OR($B${r}="",N($O$${tIn})=0),"",O${r}/$O$${tIn})`,
      r === tOut || r === tIn ? st.grandPct : st.rowPct,
    );
  }
  shRep.set(`P${netRow}`, `=IF(N($O$${tIn})=0,"",O${netRow}/$O$${tIn})`, st.grandPct);
  shRep.cond(`C${netRow}:O${netRow}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD, font: { color: 'FFFFFF', bold: true } },
  });
  shRep.cond(`C${rateRow}:O${rateRow}`, {
    type: 'expression',
    formula: `AND(ISNUMBER(C${rateRow}),C${rateRow}>=SavingTarget/100)`,
    style: { font: { color: GOOD, bold: true } },
  });
  shRep.freeze('C6').printTitles(5, 5);
  const repMonths = ref(S.report, '$C$5:$N$5');
  const repLine = (r: number) => ref(S.report, `$C$${r}:$N$${r}`);

  // ---------- Anggaran ----------
  sheetHeader(shBud, st, {
    brand: t.brand,
    title: S.budget,
    subtitle: t.subtitle.budget,
    lastCol: 'L',
    menu,
  });
  shBud.widths({ B: 28, C: 12, D: 15, E: 15, F: 15, G: 11, H: 2.5, I: 15, J: 15, K: 15, L: 11 });
  shBud.set('B5', t.month, st.label).set('C5', months.long[nowMonth], pick);
  shBud
    .set('D5', '=MATCH(C5,Months,0)', { ...st.note, numFmt: t.monthNo, align: { v: 'center' } })
    .height(5, 22);
  shBud.validate('C5', { type: 'list', formula1: '=Months' });
  const budHead = 7;
  t.budget.forEach((h, i) => {
    if (h) shBud.set(`${'BCDEFGHIJKL'[i]}${budHead}`, h, i === 0 ? st.thLeft : st.th);
  });
  shBud.height(budHead, 30);
  const budFirst = budHead + 1;
  for (let k = 0; k < nOut; k++) {
    const r = budFirst + k;
    const s = setFirst + k;
    const set = `'${S.set}'!`;
    shBud
      .set(`B${r}`, `=IF(${set}H${s}="","",${set}H${s})`, st.rowLabel)
      .set(`C${r}`, `=IF($B${r}="","",${set}I${s}&"")`, { ...st.rowLabel, align: { h: 'center' } })
      .set(`D${r}`, `=IF($B${r}="","",N(${set}J${s}))`, st.rowMoney)
      .set(
        `E${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCat,$B${r},TxType,${KOUT},TxMonth,$D$5))`,
        st.rowMoney,
      )
      .set(`F${r}`, `=IF($B${r}="","",D${r}-E${r})`, st.rowMoney)
      .set(`G${r}`, `=IF(OR($B${r}="",N(D${r})=0),"",E${r}/D${r})`, st.rowPct)
      .set(`I${r}`, `=IF($B${r}="","",D${r}*12)`, st.rowMoney)
      .set(
        `J${r}`,
        `=IF($B${r}="","",SUMIFS(TxAmount,TxCat,$B${r},TxType,${KOUT},TxMonth,">0"))`,
        st.rowMoney,
      )
      .set(`K${r}`, `=IF($B${r}="","",I${r}-J${r})`, st.rowMoney)
      .set(`L${r}`, `=IF(OR($B${r}="",N(I${r})=0),"",J${r}/I${r})`, st.rowPct);
  }
  const budTotal = budFirst + nOut;
  shBud.set(`B${budTotal}`, t.total, st.totalLabel).set(`C${budTotal}`, '', st.totalLabel);
  for (const c of ['D', 'E', 'F', 'I', 'J', 'K'])
    shBud.set(`${c}${budTotal}`, `=SUM(${c}${budFirst}:${c}${budTotal - 1})`, st.totalMoney);
  shBud.set(`G${budTotal}`, `=IF(N(D${budTotal})=0,"",E${budTotal}/D${budTotal})`, st.grandPct);
  shBud.set(`L${budTotal}`, `=IF(N(I${budTotal})=0,"",J${budTotal}/I${budTotal})`, st.grandPct);
  for (const c of ['G', 'L']) {
    const range = `${c}${budFirst}:${c}${budTotal - 1}`;
    shBud.cond(range, {
      type: 'cellIs',
      operator: 'greaterThan',
      formula: '1',
      style: { fill: BAD_BG, font: { color: BAD, bold: true } },
    });
    shBud.cond(range, { type: 'dataBar', color: accent.main, min: '0', max: '1' });
  }
  shBud.cond(`F${budFirst}:F${budTotal - 1}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  // 50/30/20
  const rH = budTotal + 2;
  shBud.merge(`B${rH}:G${rH}`, t.rule, st.h2);
  shBud
    .set(`B${rH + 1}`, t.ruleIncome, st.label)
    .set(`D${rH + 1}`, `=SUMIFS(TxAmount,TxType,${KIN},TxMonth,$D$5)`, {
      ...st.calcMoney,
      font: { size: 10, bold: true },
    });
  t.ruleHead.forEach((h, i) => shBud.set(`${'BCDEF'[i]}${rH + 2}`, h, i === 0 ? st.thLeft : st.th));
  shBud.height(rH + 2, 24);
  const ideal = [50, 30, 20];
  const inc = `$D$${rH + 1}`;
  GROUPS.forEach((g, i) => {
    const r = rH + 3 + i;
    shBud
      .set(`B${r}`, t.groups[g], st.rowLabel)
      .set(`C${r}`, ideal[i], { ...st.input, numFmt: '0"%"', align: { h: 'center' } })
      .set(
        `D${r}`,
        g === 'S'
          ? `=SUMIFS(TxAmount,TxGroup,B${r},TxMonth,$D$5)+MAX(0,D${rH + 6})`
          : `=SUMIFS(TxAmount,TxGroup,B${r},TxMonth,$D$5)`,
        st.rowMoney,
      )
      .set(`E${r}`, `=IF(N(${inc})=0,"",D${r}/${inc})`, st.rowPct)
      .set(
        `F${r}`,
        `=IF(E${r}="","",IF(${g === 'S' ? `E${r}>=C${r}/100` : `E${r}<=C${r}/100`},${q(t.ok)},${q(g === 'S' ? t.under : t.over)}))`,
        st.rowLabel,
      );
  });
  const leftRow = rH + 6;
  shBud
    .set(`B${leftRow}`, t.ruleLeft, {
      ...st.rowLabel,
      font: { size: 10, italic: true, color: '6F675C' },
    })
    .set(`D${leftRow}`, `=${inc}-SUMIFS(TxAmount,TxType,${KOUT},TxMonth,$D$5)`, st.rowMoney);
  shBud.cond(`F${rH + 3}:F${rH + 5}`, {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.ok),
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shBud.cond(`F${rH + 3}:F${rH + 5}`, {
    type: 'cellIs',
    operator: 'notEqual',
    formula: q(t.ok),
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shBud.merge(`B${leftRow + 1}:G${leftRow + 3}`, t.ruleNote, st.note);
  shBud.freeze(`A${budFirst}`);

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  shDash.set('B2', `=${q(S.dash + ' · ')}&OwnerName`, st.title);
  shDash
    .set('B5', t.pickMonth, st.label)
    .merge('D5:E5', months.long[nowMonth], pick)
    .set('F5', '=MATCH(D5,Months,0)', { ...st.note, numFmt: t.monthNo, align: { v: 'center' } })
    .merge('H5:J5', `=${q(t.fiscal)}&PlanYear`, { ...st.label, align: { v: 'center' } });
  shDash.validate('D5', { type: 'list', formula1: '=Months' });
  shDash.height(5, 22).height(6, 8).height(10, 10);
  const at = (r: number) => `INDEX(${repLine(r)},1,$F$5)`;
  const prev = (r: number) =>
    `=IF($F$5=1,"",IF(N(INDEX(${repLine(r)},1,$F$5-1))=0,"",${q(t.vsPrev)}&TEXT(${at(r)}/INDEX(${repLine(r)},1,$F$5-1)-1,"+0%;-0%")))`;
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kIncome,
    value: `=${at(tIn)}`,
    note: prev(tIn),
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kExpense,
    value: `=${at(tOut)}`,
    note: prev(tOut),
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kNet,
    value: `=${at(netRow)}`,
    note: `=IF(N(${at(tIn)})=0,"",${q(t.rateNote)}&TEXT(${at(netRow)}/${at(tIn)},"0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kWallets,
    value: '=SUM(WalletBalance)',
    note: `=COUNTA(Wallets)&${q(t.walletCount)}`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kBudgetLeft,
    value: `=SUM(ExpenseBudget)-${at(tOut)}`,
    note: `=IF(SUM(ExpenseBudget)=0,"",TEXT(${at(tOut)}/SUM(ExpenseBudget),"0%")&${q(t.usedNote)})`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kGoals,
    value: '=SUM(GoalSaved)',
    note: `=IF(SUM(GoalTarget)=0,"",TEXT(SUM(GoalSaved)/SUM(GoalTarget),"0%")&${q(t.ofTarget)})`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kDebt,
    value: '=SUM(DebtLeft)',
    note: `=IF(SUMIFS(DebtInstall,DebtStatus,${q(t.running)})=0,"",${q(t.installNote)}&TEXT(SUMIFS(DebtInstall,DebtStatus,${q(t.running)}),"#,##0"))`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kWorth,
    value: '=NetWorth',
    note: t.worthNote,
  });
  for (const cell of ['H8:J8', 'B12:D12', 'K12:M12'])
    shDash.cond(cell, {
      type: 'cellIs',
      operator: 'lessThan',
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
      { name: t.income, categories: repMonths, values: repLine(tIn), color: '3C6A33' },
      { name: t.expense, categories: repMonths, values: repLine(tOut), color: accent.main },
    ],
  });
  shDash.chart({
    type: 'line',
    title: t.chartCum,
    from: 'H15',
    to: 'N33',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      { name: t.cumulative, categories: repMonths, values: repLine(cumRow), color: '2C4A86' },
    ],
  });
  shDash.chart({
    type: 'doughnut',
    title: t.chartExp,
    from: 'B35',
    to: 'H55',
    legend: 'r',
    sliceColors: expenses.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    series: [
      {
        name: t.expense,
        categories: ref(S.report, `$B$${outFirst}:$B$${outFirst + expenses.length - 1}`),
        values: ref(S.report, `$O$${outFirst}:$O$${outFirst + expenses.length - 1}`),
      },
    ],
  });
  // Saldo per dompet
  shDash.merge('I35:M35', t.walletTable, st.h2);
  shDash.merge('I36:K36', t.walletHead[0], st.thLeft).merge('L36:M36', t.walletHead[1], st.th);
  for (let k = 0; k < nW; k++) {
    const r = 37 + k;
    shDash
      .merge(
        `I${r}:K${r}`,
        `=IF(INDEX(Wallets,${k + 1})="","",INDEX(Wallets,${k + 1}))`,
        st.rowLabel,
      )
      .merge(`L${r}:M${r}`, `=IF(I${r}="","",INDEX(WalletBalance,${k + 1}))`, st.rowMoney);
  }
  const wDash = 37 + nW;
  shDash
    .merge(`I${wDash}:K${wDash}`, t.total, st.totalLabel)
    .merge(`L${wDash}:M${wDash}`, `=SUM(L37:L${wDash - 1})`, st.totalMoney);
  // Progres tujuan
  const gH = wDash + 2;
  shDash.merge(`I${gH}:M${gH}`, t.goalTable, st.h2);
  shDash
    .merge(`I${gH + 1}:J${gH + 1}`, t.goalHead[0], st.thLeft)
    .set(`K${gH + 1}`, t.goalHead[1], st.th)
    .merge(`L${gH + 1}:M${gH + 1}`, t.goalHead[2], st.th);
  for (let k = 0; k < 6; k++) {
    const r = gH + 2 + k;
    shDash
      .merge(
        `I${r}:J${r}`,
        k === 0
          ? `=IF(INDEX(Goals,1)="",${q(t.noGoals)},INDEX(Goals,1))`
          : `=IF(INDEX(Goals,${k + 1})="","",INDEX(Goals,${k + 1}))`,
        st.rowLabel,
      )
      .set(`K${r}`, `=IF(INDEX(Goals,${k + 1})="","",INDEX(GoalPct,${k + 1}))`, st.rowPct)
      .merge(
        `L${r}:M${r}`,
        `=IF(INDEX(Goals,${k + 1})="","",INDEX(GoalLeft,${k + 1}))`,
        st.rowMoney,
      );
  }
  shDash.cond(`K${gH + 2}:K${gH + 7}`, { type: 'dataBar', color: accent.main, min: '0', max: '1' });

  // ---------- Menu ----------
  sheetHeader(shMenu, st, {
    brand: t.brand,
    title: t.templateName,
    subtitle: t.subtitle.menu,
    lastCol: 'H',
  });
  shMenu.widths({ B: 5, C: 24, D: 62, E: 3, F: 16, G: 16, H: 4 });
  shMenu.set('B3', `=OwnerName&${q(' · ' + t.fiscal)}&PlanYear`, {
    ...st.subtitle,
    font: { size: 11, bold: true, color: '4A433A' },
  });
  shMenu.merge('B5:D5', t.startHere, st.h2);
  t.steps.forEach((s, i) => {
    shMenu
      .set(`B${6 + i}`, String(i + 1), st.step)
      .merge(`C${6 + i}:D${6 + i}`, s, st.stepText)
      .height(6 + i, 34);
  });
  shMenu.merge('B10:D10', t.contents, st.h2);
  const items: [string, string][] = [
    [S.dash, t.desc.dash],
    [S.tx, t.desc.tx],
    [S.budget, t.desc.budget],
    [S.report, t.desc.report],
    [S.goals, t.desc.goals],
    [S.debts, t.desc.debts],
    [S.worth, t.desc.worth],
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
    const rnd = seeded(year * 7 + expenses.length * 3 + wallets.length);
    const now = new Date();
    const todayX = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const cash = wallets[0];
    const bank = wallets[1] ?? wallets[0];
    const ewallet = wallets[2] ?? wallets[0];
    const inc = SAMPLE_INCOME[opts.preset] ?? SAMPLE_INCOME.lajang;
    const debtCat = expenses.find(([n, , b]) => /cicil|kpr|loan|mortgage/i.test(n) && b > 0);
    const isHome = debtCat ? /kpr|mortgage/i.test(debtCat[0]) : false;
    const saveCats = expenses.filter(([, g, b]) => g === 'S' && b > 0);
    const goalNames = t.sample.goals;
    const goals = [
      {
        name: goalNames[0],
        target: money(20_000_000),
        deadline: todayX + 420,
        before: money(2_000_000),
      },
      { name: goalNames[1], target: money(8_000_000), deadline: todayX + 240, before: null },
      { name: goalNames[2], target: money(12_000_000), deadline: todayX + 120, before: null },
    ];
    const install = debtCat ? money(debtCat[2]) : 0;
    const [debtName, lender] = isHome ? t.sample.debts.home : t.sample.debts.small;
    const debts = debtCat
      ? [
          {
            name: debtName,
            lender,
            total: install * (isHome ? 180 : 24),
            install,
            start: excelDate(year, 1, 5),
            rate: isHome ? 7.5 : 12,
            before: isHome ? install * 36 : null,
          },
        ]
      : [];
    const assets = t.sample.assets.map(
      ([n, ti, v]) => [n, ti, money(v)] as [string, number, number],
    );
    // Profil dengan KPR: rumahnya juga dicatat sebagai aset.
    if (isHome) assets.unshift([t.sample.house, 3, install * 220]);
    type Tx = {
      date: number;
      desc: string;
      cat: string;
      wallet: string;
      to?: string;
      amount: number;
      link?: string;
    };
    const tx: Tx[] = [];
    const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const day = (m: number, d: number) =>
      excelDate(year, m, Math.min(d, new Date(year, m, 0).getDate()));
    for (let m = 1; m <= lastMonth; m++) {
      const mName = months.long[m - 1];
      tx.push({
        date: day(m, 25),
        desc: `${t.sample.salary}${mName}`,
        cat: incomeCats[0],
        wallet: bank,
        amount: money(inc[0]),
      });
      if (incomeCats[1] && (m === 3 || m === 12 || opts.preset === 'keluarga'))
        tx.push({
          date: day(m, opts.preset === 'keluarga' ? 26 : 20),
          desc: opts.preset === 'keluarga' ? incomeCats[1] : t.sample.bonus,
          cat: incomeCats[1],
          wallet: bank,
          amount: money(opts.preset === 'keluarga' ? inc[1] : inc[1] * 0.5),
        });
      if (incomeCats[2] && rnd() < 0.45)
        tx.push({
          date: day(m, 10 + Math.floor(rnd() * 10)),
          desc: t.sample.side,
          cat: incomeCats[2],
          wallet: ewallet,
          amount: money(inc[2] * (0.6 + rnd() * 0.8)),
        });
      // Pengeluaran per kategori (selain tabungan dan cicilan).
      const spent = new Map<string, number>();
      for (const [name, group, budget] of expenses) {
        if (!budget || group === 'S' || name === debtCat?.[0]) continue;
        const daily = /makan|food|belanja|grocer|dapur/i.test(name);
        const n = daily ? 8 : budget >= 1_000_000 ? 1 : 1 + Math.floor(rnd() * 2);
        const total = budget * (0.75 + rnd() * 0.45) * (m === 12 && group === 'W' ? 1.4 : 1);
        for (let j = 0; j < n; j++) {
          const big = n === 1 && budget >= 1_000_000;
          const wallet = daily ? (j % 2 ? cash : ewallet) : group === 'W' ? ewallet : bank;
          const amount = money(total / n);
          spent.set(wallet, (spent.get(wallet) ?? 0) + amount);
          tx.push({
            date: day(m, big ? 2 : 1 + Math.floor(((j + rnd()) * 27) / n)),
            desc: `${t.sample.desc[j % 3]} ${name.toLowerCase()}`,
            cat: name,
            wallet,
            amount,
          });
        }
      }
      // Tarik tunai dan isi e-wallet sebesar pengeluaran dompet itu bulan ini (dibulatkan ke atas),
      // supaya saldo contoh tidak pernah minus.
      for (const [w, desc] of [
        [cash, t.sample.atm],
        [ewallet, t.sample.topup],
      ] as const) {
        const need = spent.get(w) ?? 0;
        if (w === bank || !need) continue;
        const unit = money(100_000) || 1;
        tx.push({
          date: day(m, 1),
          desc,
          cat: t.transfer,
          wallet: bank,
          to: w,
          amount: Math.ceil(need / unit) * unit,
        });
      }
      if (debtCat && debts[0])
        tx.push({
          date: day(m, 5),
          desc: `${t.sample.pay}${debts[0].name}`,
          cat: debtCat[0],
          wallet: bank,
          amount: install,
          link: debts[0].name,
        });
      saveCats.forEach(([name, , budget], i) => {
        const goal = goals[(i + m) % goals.length];
        tx.push({
          date: day(m, 26),
          desc: `${t.sample.save}${goal.name}`,
          cat: name,
          wallet: bank,
          amount: money(budget),
          link: goal.name,
        });
      });
    }
    tx.sort((a, b) => a.date - b.date);
    return { tx: tx.slice(0, TX_ROWS), goals, debts, assets };
  }
}
