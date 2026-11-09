/**
 * Template Kas RT / Organisasi: daftar warga atau anggota, grid iuran 12 bulan (lunas, sebagian,
 * menunggak), buku kas untuk pemasukan lain dan pengeluaran, laporan bulanan siap dibagikan, dan
 * dashboard. Iuran dicatat di kolom bulan yang dibayar (bukan tanggal bayar).
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
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  GOOD,
  GOOD_BG,
  INK,
  MONTHS,
  WARN,
  WARN_BG,
  cleanList,
  defaultMonth,
  kpiCard,
  makeStyles,
  menuSheet,
  monthsList,
  q,
  sampleMoney,
  seeded,
  sheetHeader,
} from './kit';

export interface CommunityOptions {
  locale: Locale;
  org: string;
  year: number;
  currency: Currency;
  dues: number;
  opening: number;
  /** "Nama | blok/alamat" per baris. */
  members: string[];
  incomes: string[];
  expenses: string[];
  sample: boolean;
}

const FIRST = 6;
const MEMBER_ROWS = 200;
const CASH_ROWS = 1500;
const CAT_ROWS = 15;
const REPORT_TX = 30;
const MCOLS = 'EFGHIJKLMNOP'; // Januari-Desember di sheet Iuran

const L = {
  id: {
    brand: 'TOOLLAND · KAS RT & ORGANISASI',
    name: 'Kas RT / Organisasi',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      dues: 'Iuran',
      cash: 'Kas',
      report: 'Laporan Bulanan',
      members: 'Anggota',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Saldo kas, iuran terkumpul, tunggakan, pengeluaran, kepatuhan iuran, dan penunggak terbesar.',
      dues: 'Grid iuran 12 bulan per warga: hijau lunas, kuning sebagian, merah belum bayar.',
      cash: 'Pemasukan lain (donasi, sumbangan) dan semua pengeluaran kas.',
      report: 'Laporan kas satu bulan siap dibagikan ke grup warga, lengkap dengan tanda tangan.',
      members: 'Daftar warga atau anggota, nilai iuran, status, dan total tunggakan.',
      set: 'Nama RT/organisasi, pengurus, tahun, iuran wajib, saldo awal, dan kategori kas.',
    },
    subtitle: {
      menu: 'Catat iuran warga dan kas RT atau organisasi dengan transparan. Mulai dari Pengaturan.',
      dues: 'Isi jumlah yang dibayar di kolom bulan iuran tersebut. Warna berubah otomatis.',
      cash: 'Satu baris per transaksi selain iuran. Iuran dicatat di sheet Iuran.',
      report: 'Pilih bulan, lalu cetak atau simpan sebagai PDF dan bagikan ke grup.',
      members: 'Satu baris per KK atau anggota. Iuran kosong = iuran wajib di Pengaturan.',
      set: 'Atur sekali di awal.',
      dash: 'Pilih bulan di bawah. Angka bulanan ikut berubah.',
    },
    steps: [
      'Isi Pengaturan (nama, pengurus, iuran wajib, saldo awal) dan daftar warga di sheet Anggota.',
      'Setiap ada yang membayar iuran, isi jumlahnya di sheet Iuran. Catat pemasukan lain dan pengeluaran di sheet Kas.',
      'Akhir bulan, buka Laporan Bulanan, pilih bulan, lalu bagikan PDF-nya ke grup warga.',
    ],
    set: [
      ['Nama RT / organisasi', 'OrgName', 'text'],
      ['Alamat / wilayah', 'OrgAddress', 'text'],
      ['Ketua', 'OrgChair', 'text'],
      ['Bendahara', 'OrgTreasurer', 'text'],
      ['Tahun', 'CashYear', 'int'],
      ['Mata uang', 'CurrencyLabel', 'calc'],
      ['Iuran wajib per bulan', 'DuesDefault', 'money'],
      ['Saldo awal kas (1 Januari)', 'OpeningBalance', 'money'],
    ] as [string, string, string][],
    incomeH: 'Kategori pemasukan lain',
    expenseH: 'Kategori pengeluaran',
    statuses: ['Aktif', 'Pindah', 'Tidak wajib iuran'],
    members: [
      'No',
      'Nama KK / anggota',
      'Blok / no. rumah',
      'Telepon',
      'Status',
      'Iuran / bulan',
      'Mulai bulan',
      'Keterangan',
      'Iuran dipakai',
      'Sudah dibayar',
      'Seharusnya',
      'Tunggakan',
    ],
    startMsg: 'Bulan mulai wajib iuran (1-12). Kosong = Januari. Untuk warga baru pindah.',
    dues: ['Nama', 'Blok', 'Iuran'],
    duesTail: ['Total', 'Tunggakan', 'Status'],
    paid: 'Lunas',
    behind: 'Kurang ',
    exempt: '-',
    collected: 'Terkumpul',
    paidCount: 'Warga lunas',
    cash: [
      'Tanggal',
      'Keterangan',
      'Kategori',
      'Jumlah',
      'Jenis',
      'Masuk',
      'Keluar',
      'No. bukti',
      'Penanggung jawab',
    ],
    kindIn: 'Masuk',
    kindOut: 'Keluar',
    rep: {
      title: 'LAPORAN KAS',
      month: 'Bulan',
      opening: 'Saldo awal bulan',
      income: 'Pemasukan',
      dues: 'Iuran warga',
      expense: 'Pengeluaran',
      totalIn: 'Total pemasukan',
      totalOut: 'Total pengeluaran',
      closing: 'SALDO AKHIR BULAN',
      paidInfo: ' dari ',
      paidInfo2: ' warga sudah lunas',
      details: 'Rincian transaksi',
      head: ['Tanggal', 'Keterangan', 'Masuk', 'Keluar'],
      more: 'Transaksi lebih dari 30: lihat sheet Kas.',
      chair: 'Ketua',
      treasurer: 'Bendahara',
      yearH: 'Ringkasan setahun',
      yearHead: ['Bulan', 'Iuran', 'Pemasukan lain', 'Pengeluaran', 'Saldo akhir', 'Warga lunas'],
    },
    kBalance: 'Saldo kas',
    kDuesMonth: 'Iuran bulan ini',
    kArrears: 'Total tunggakan',
    kSpent: 'Pengeluaran bulan ini',
    kOther: 'Pemasukan lain bulan ini',
    kCompliance: 'Kepatuhan iuran',
    kMembers: 'Warga aktif',
    kSpentYtd: 'Pengeluaran s.d. bulan ini',
    ofMembers: ' warga lunas',
    inArrears: ' warga menunggak',
    complianceNote: 'Iuran masuk dibanding seharusnya',
    perMonth: 'Iuran wajib: ',
    chartFlow: 'Pemasukan vs pengeluaran per bulan',
    chartPaid: 'Persentase warga lunas per bulan',
    chartExp: 'Pengeluaran setahun per kategori',
    topH: 'Tunggakan terbesar',
    topHead: ['Nama', 'Blok', 'Tunggakan'],
    noArrears: 'Tidak ada tunggakan. Mantap!',
    inLabel: 'Pemasukan',
    outLabel: 'Pengeluaran',
    sample: {
      org: 'RT 05 / RW 02 Perumahan Griya Asri',
      address: 'Kel. Sukamaju, Kec. Cibinong',
      chair: 'Bapak Hendra',
      treasurer: 'Ibu Ratna',
      first: [
        'Budi',
        'Agus',
        'Hendra',
        'Joko',
        'Dedi',
        'Rudi',
        'Andi',
        'Bambang',
        'Eko',
        'Fajar',
        'Iwan',
        'Yusuf',
        'Rina',
        'Sari',
        'Dewi',
        'Lina',
        'Wati',
        'Tuti',
        'Maya',
        'Nur',
      ],
      last: [
        'Santoso',
        'Pratama',
        'Wijaya',
        'Saputra',
        'Hidayat',
        'Kurniawan',
        'Setiawan',
        'Lestari',
        'Rahayu',
        'Gunawan',
      ],
      tx: {
        security: 'Honor petugas keamanan',
        trash: 'Iuran angkut sampah',
        power: 'Listrik pos ronda',
        donation: 'Donasi warga',
        aug: 'Lomba 17 Agustus',
        augDonation: 'Sumbangan 17 Agustus',
        grief: 'Santunan duka warga',
        repair: 'Perbaikan lampu jalan',
        atk: 'Fotokopi & ATK',
        rent: 'Sewa balai warga',
      },
    },
  },
  en: {
    brand: 'TOOLLAND · COMMUNITY CASH',
    name: 'Community Cash & Dues',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      dues: 'Dues',
      cash: 'Cash Book',
      report: 'Monthly Report',
      members: 'Members',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Cash balance, dues collected, arrears, spending, dues compliance, and largest arrears.',
      dues: '12-month dues grid per member: green paid, yellow partial, red unpaid.',
      cash: 'Other income (donations, contributions) and all cash spending.',
      report: 'One-month cash report ready to share with members, with signatures.',
      members: 'Members or households, dues amount, status, and total arrears.',
      set: 'Organisation name, officers, year, standard dues, opening balance, and categories.',
    },
    subtitle: {
      menu: 'Track member dues and your association or club cash transparently. Start with Settings.',
      dues: 'Enter the amount paid in the column of the month it covers. Colours change automatically.',
      cash: 'One row per transaction other than dues. Dues go in the Dues sheet.',
      report: 'Choose a month, then print or save as PDF and share it.',
      members: 'One row per household or member. Empty dues = standard dues in Settings.',
      set: 'Set this up once.',
      dash: 'Choose a month below. Monthly numbers follow.',
    },
    steps: [
      'Fill in Settings (name, officers, standard dues, opening balance) and your members in Members.',
      'When someone pays, enter the amount in the Dues sheet. Record other income and spending in the Cash Book.',
      'At month end, open Monthly Report, pick the month, and share the PDF with members.',
    ],
    set: [
      ['Organisation name', 'OrgName', 'text'],
      ['Address / area', 'OrgAddress', 'text'],
      ['Chair', 'OrgChair', 'text'],
      ['Treasurer', 'OrgTreasurer', 'text'],
      ['Year', 'CashYear', 'int'],
      ['Currency', 'CurrencyLabel', 'calc'],
      ['Standard dues per month', 'DuesDefault', 'money'],
      ['Opening cash balance (1 January)', 'OpeningBalance', 'money'],
    ] as [string, string, string][],
    incomeH: 'Other income categories',
    expenseH: 'Expense categories',
    statuses: ['Active', 'Moved out', 'Exempt'],
    members: [
      'No',
      'Member / household',
      'Unit / address',
      'Phone',
      'Status',
      'Dues / month',
      'Start month',
      'Notes',
      'Dues used',
      'Paid',
      'Expected',
      'Arrears',
    ],
    startMsg: 'Month dues start (1-12). Empty = January. For members who joined mid-year.',
    dues: ['Name', 'Unit', 'Dues'],
    duesTail: ['Total', 'Arrears', 'Status'],
    paid: 'Paid up',
    behind: 'Owes ',
    exempt: '-',
    collected: 'Collected',
    paidCount: 'Members paid',
    cash: [
      'Date',
      'Description',
      'Category',
      'Amount',
      'Type',
      'In',
      'Out',
      'Receipt no.',
      'Handled by',
    ],
    kindIn: 'In',
    kindOut: 'Out',
    rep: {
      title: 'CASH REPORT',
      month: 'Month',
      opening: 'Opening balance',
      income: 'Income',
      dues: 'Member dues',
      expense: 'Spending',
      totalIn: 'Total income',
      totalOut: 'Total spending',
      closing: 'CLOSING BALANCE',
      paidInfo: ' of ',
      paidInfo2: ' members paid',
      details: 'Transactions',
      head: ['Date', 'Description', 'In', 'Out'],
      more: 'More than 30 transactions: see the Cash Book.',
      chair: 'Chair',
      treasurer: 'Treasurer',
      yearH: 'Year at a glance',
      yearHead: ['Month', 'Dues', 'Other income', 'Spending', 'Closing balance', 'Members paid'],
    },
    kBalance: 'Cash balance',
    kDuesMonth: 'Dues this month',
    kArrears: 'Total arrears',
    kSpent: 'Spending this month',
    kOther: 'Other income this month',
    kCompliance: 'Dues compliance',
    kMembers: 'Active members',
    kSpentYtd: 'Spending year to date',
    ofMembers: ' members paid',
    inArrears: ' members in arrears',
    complianceNote: 'Dues received vs expected',
    perMonth: 'Standard dues: ',
    chartFlow: 'Income vs spending by month',
    chartPaid: 'Share of members paid by month',
    chartExp: 'Spending this year by category',
    topH: 'Largest arrears',
    topHead: ['Name', 'Unit', 'Arrears'],
    noArrears: 'No arrears. Great job!',
    inLabel: 'Income',
    outLabel: 'Spending',
    sample: {
      org: 'Griya Asri Residents Association',
      address: 'Block A–D, Griya Asri',
      chair: 'Mr. Hendra',
      treasurer: 'Mrs. Ratna',
      first: [
        'Budi',
        'Agus',
        'Hendra',
        'Joko',
        'Dedi',
        'Rudi',
        'Andi',
        'Bambang',
        'Eko',
        'Fajar',
        'Iwan',
        'Yusuf',
        'Rina',
        'Sari',
        'Dewi',
        'Lina',
        'Wati',
        'Tuti',
        'Maya',
        'Nur',
      ],
      last: [
        'Santoso',
        'Pratama',
        'Wijaya',
        'Saputra',
        'Hidayat',
        'Kurniawan',
        'Setiawan',
        'Lestari',
        'Rahayu',
        'Gunawan',
      ],
      tx: {
        security: 'Security guard fee',
        trash: 'Rubbish collection',
        power: 'Guard post electricity',
        donation: 'Member donation',
        aug: 'Independence Day games',
        augDonation: 'Independence Day contributions',
        grief: 'Condolence gift',
        repair: 'Street light repair',
        atk: 'Printing & stationery',
        rent: 'Hall rental',
      },
    },
  },
};

export const COMMUNITY_PRESETS: Record<
  Locale,
  Record<string, { incomes: string; expenses: string }>
> = {
  id: {
    rt: {
      incomes: 'Donasi\nSumbangan acara\nSewa fasilitas\nLain-lain',
      expenses:
        'Keamanan\nKebersihan & sampah\nListrik & air fasilitas\nKegiatan warga\nSosial & duka\nPerbaikan fasilitas\nATK & administrasi\nLain-lain',
    },
    organisasi: {
      incomes: 'Donasi\nSponsor\nPenjualan merchandise\nLain-lain',
      expenses:
        'Konsumsi rapat\nKegiatan & acara\nTransportasi\nPerlengkapan\nSosial\nATK & administrasi\nLain-lain',
    },
    kelas: {
      incomes: 'Donasi orang tua\nUsaha dana\nLain-lain',
      expenses:
        'Kebersihan kelas\nPerlengkapan kelas\nKegiatan & study tour\nSosial (sakit/duka)\nHadiah & perpisahan\nLain-lain',
    },
  },
  en: {
    rt: {
      incomes: 'Donations\nEvent contributions\nFacility rental\nOther',
      expenses:
        'Security\nCleaning & rubbish\nFacility utilities\nCommunity events\nWelfare & condolences\nFacility repairs\nAdmin & stationery\nOther',
    },
    organisasi: {
      incomes: 'Donations\nSponsorship\nMerchandise sales\nOther',
      expenses:
        'Meeting refreshments\nEvents\nTransport\nEquipment\nWelfare\nAdmin & stationery\nOther',
    },
    kelas: {
      incomes: 'Parent donations\nFundraising\nOther',
      expenses:
        'Classroom cleaning\nClassroom supplies\nTrips & activities\nWelfare\nGifts & farewells\nOther',
    },
  },
};

const form = (locale: Locale): TemplateForm => {
  const id = locale === 'id';
  return {
    template: 'community',
    fileBase: id ? 'Kas-RT' : 'Community-Cash',
    fileKey: 'org',
    heading: id ? 'Atur sesuai RT atau organisasimu' : 'Set it up for your group',
    fields: [
      {
        key: 'org',
        kind: 'text',
        label: id ? 'Nama RT / organisasi' : 'Organisation name',
        placeholder: id ? 'misalnya RT 05 / RW 02 Griya Asri' : 'for example Griya Asri Residents',
        span: 2,
      },
      { key: 'year', kind: 'year', label: id ? 'Tahun' : 'Year' },
      { key: 'currency', kind: 'currency', label: id ? 'Mata uang' : 'Currency' },
      {
        key: 'dues',
        kind: 'number',
        label: id ? 'Iuran wajib per bulan' : 'Standard dues per month',
        value: id ? 50000 : 10,
        min: 0,
      },
      {
        key: 'opening',
        kind: 'number',
        label: id ? 'Saldo awal kas' : 'Opening balance',
        value: 0,
        min: 0,
      },
      {
        key: 'members',
        kind: 'list',
        label: id ? 'Warga / anggota (nama | blok)' : 'Members (name | unit)',
        value: '',
        max: MEMBER_ROWS,
        hint: id
          ? 'Satu per baris, misalnya "Budi Santoso | A-1". Boleh diisi di file.'
          : 'One per line, for example "Budi Santoso | A-1". You can fill this in the file.',
      },
      {
        key: 'incomes',
        kind: 'list',
        label: id ? 'Pemasukan lain' : 'Other income',
        value: COMMUNITY_PRESETS[locale].rt.incomes,
        max: CAT_ROWS,
      },
      {
        key: 'expenses',
        kind: 'list',
        label: id ? 'Kategori pengeluaran' : 'Expense categories',
        value: COMMUNITY_PRESETS[locale].rt.expenses,
        max: CAT_ROWS,
      },
    ],
    presets: {
      key: 'preset',
      label: id ? 'Jenis kelompok' : 'Group type',
      hint: id
        ? 'Mengisi ulang kategori pemasukan dan pengeluaran.'
        : 'Refills the income and expense categories.',
      options: id
        ? [
            { value: 'rt', label: 'RT / RW / perumahan' },
            { value: 'organisasi', label: 'Organisasi / komunitas' },
            { value: 'kelas', label: 'Kas kelas / paguyuban' },
          ]
        : [
            { value: 'rt', label: 'Residents association' },
            { value: 'organisasi', label: 'Club / community' },
            { value: 'kelas', label: 'Class / parents group' },
          ],
      fill: COMMUNITY_PRESETS[locale],
    },
    sample: id
      ? {
          label: 'Isi contoh data',
          hint: '40 KK dengan iuran berjalan (sebagian menunggak), pengeluaran rutin, dan acara 17 Agustus, jadi laporan dan dashboard langsung terisi.',
        }
      : {
          label: 'Include sample data',
          hint: '40 households with dues to date (some in arrears), routine spending, and an Independence Day event, so the report and dashboard are filled in.',
        },
  };
};

export const COMMUNITY_FORM: Record<Locale, TemplateForm> = { id: form('id'), en: form('en') };

export function buildFromForm(v: FormValues): Workbook {
  return buildCommunityWorkbook({
    locale: formChoice(v, 'locale', ['id', 'en'] as const, 'id'),
    org: formText(v, 'org'),
    year: formNumber(v, 'year', new Date().getFullYear(), 2000, 2100),
    currency: formChoice(v, 'currency', Object.keys(CURRENCIES) as Currency[], 'IDR'),
    dues: formNumber(v, 'dues', 0, 0),
    opening: formNumber(v, 'opening', 0, 0),
    members: formList(v, 'members'),
    incomes: formList(v, 'incomes'),
    expenses: formList(v, 'expenses'),
    sample: v.sample === true,
  });
}

export function buildCommunityWorkbook(opts: CommunityOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.daun;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];
  const money = sampleMoney(currency);
  const sample = opts.sample;
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const org =
    opts.org.trim().slice(0, 80) ||
    (sample ? t.sample.org : locale === 'id' ? 'Nama RT / Organisasi' : 'Organisation Name');
  // Contoh data memakai kategori RT agar keterangan transaksinya cocok.
  const rtCats = COMMUNITY_PRESETS[locale].rt;
  const pickCats = (list: string[], fallback: string) =>
    !sample && cleanList(list, CAT_ROWS).length
      ? cleanList(list, CAT_ROWS)
      : cleanList(fallback.split('\n'), CAT_ROWS);
  const incomes = pickCats(opts.incomes, rtCats.incomes);
  const expenses = pickCats(opts.expenses, rtCats.expenses);
  const dues = sample ? money(50_000) : Math.max(0, opts.dues);
  const KIN = q(t.kindIn);
  const KOUT = q(t.kindOut);
  const ACTIVE = q(t.statuses[0]);
  const smp = sample ? makeSample() : undefined;
  const members =
    smp?.members ??
    opts.members
      .map((l) => l.split('|').map((x) => x.replace(/\s+/g, ' ').trim()))
      .filter((m) => m[0])
      .slice(0, MEMBER_ROWS)
      .map(([name, unit]) => ({
        name: name.slice(0, 60),
        unit: (unit ?? '').slice(0, 30),
        custom: undefined as number | undefined,
        start: undefined as number | undefined,
        paid: [] as number[],
      }));

  const wb = new Workbook({ title: `${t.name} – ${org}`, subject: t.name, company: org });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shDues = wb.addSheet(S.dues, { tabColor: '3C6A33', ...landscape });
  const shCash = wb.addSheet(S.cash, { tabColor: '8F5E0A', ...landscape });
  const shRep = wb.addSheet(S.report, { tabColor: '2C4A86', gridlines: false, fitWidth: true });
  const shMem = wb.addSheet(S.members, { tabColor: 'A8461F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const memLast = FIRST + MEMBER_ROWS - 1;
  const cashLast = FIRST + CASH_ROWS - 1;
  const col = (sheet: string, c: string, first: number, last: number) =>
    ref(sheet, `$${c}$${first}:$${c}$${last}`);

  // ---------- Daftar ----------
  monthsList(wb, shList, S.list, locale);
  t.statuses.forEach((s, i) => shList.set(`D${i + 2}`, s));
  wb.defineName('MemberStatuses', ref(S.list, '$D$2:$D$4'));
  // Jumlah bulan iuran yang sudah jatuh tempo tahun ini.
  shList.set('F2', '=IF(CashYear<YEAR(TODAY()),12,IF(CashYear>YEAR(TODAY()),0,MONTH(TODAY())))');
  wb.defineName('ElapsedMonths', ref(S.list, '$F$2'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'H',
    menu,
  });
  shSet.widths({ B: 28, C: 34, D: 3, E: 26, F: 3, G: 26, H: 4 });
  const setVals: Record<string, string | number> = {
    OrgName: org,
    OrgAddress: sample ? t.sample.address : '',
    OrgChair: sample ? t.sample.chair : '',
    OrgTreasurer: sample ? t.sample.treasurer : '',
    CashYear: year,
    CurrencyLabel: `${currency} (${CURRENCIES[currency].symbol})`,
    DuesDefault: dues,
    OpeningBalance: sample ? money(3_250_000) : Math.max(0, opts.opening),
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
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, setVals[name], style).height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.validate('C9', { type: 'whole', operator: 'between', formula1: '2000', formula2: '2100' });
  for (const [c, h, items, name] of [
    ['E', t.incomeH, incomes, 'IncomeCats'],
    ['G', t.expenseH, expenses, 'ExpenseCats'],
  ] as const) {
    shSet.set(`${c}14`, h, st.h2).set(`${c}15`, h, st.thLeft);
    for (let k = 0; k < CAT_ROWS; k++) shSet.set(`${c}${16 + k}`, items[k] ?? null, st.inputText);
    wb.defineName(name, ref(S.set, `$${c}$16:$${c}$${15 + CAT_ROWS}`));
  }
  // Daftar kategori gabungan (kolom tersembunyi I) untuk dropdown sheet Kas.
  shSet.width('I', 6, true);
  for (let k = 1; k <= CAT_ROWS * 2; k++)
    shSet.set(
      `I${15 + k}`,
      `=IF(${k}<=COUNTA(IncomeCats),INDEX(IncomeCats,${k}),IF(${k}-COUNTA(IncomeCats)<=COUNTA(ExpenseCats),INDEX(ExpenseCats,${k}-COUNTA(IncomeCats)),""))`,
    );
  wb.defineName('CashCats', ref(S.set, `$I$16:$I$${15 + CAT_ROWS * 2}`));

  // ---------- Anggota ----------
  sheetHeader(shMem, st, {
    brand: t.brand,
    title: S.members,
    subtitle: t.subtitle.members,
    lastCol: 'M',
    menu,
  });
  const AC = 'BCDEFGHIJKLM';
  [6, 26, 14, 16, 14, 12, 9, 22, 12, 13, 13, 13].forEach((w, i) => shMem.width(AC[i], w));
  t.members.forEach((h, i) =>
    shMem.set(`${AC[i]}${head}`, h, [1, 2, 7].includes(i) ? st.thLeft : st.th),
  );
  shMem.height(head, 30);
  for (let r = FIRST; r <= memLast; r++) {
    const m = members[r - FIRST];
    const dr = r; // baris yang sama di sheet Iuran
    shMem
      .set(`B${r}`, `=IF($C${r}="","",ROW()-${head})`, st.calcCenter)
      .set(`C${r}`, m?.name ?? null, st.inputText)
      .set(`D${r}`, m?.unit || null, st.inputText)
      .set(`E${r}`, null, st.inputText)
      .set(`F${r}`, m ? t.statuses[0] : null, { ...st.inputText, align: { h: 'center' } })
      .set(`G${r}`, m?.custom ?? null, st.inputMoney)
      .set(`H${r}`, m?.start ?? null, st.inputInt)
      .set(`I${r}`, null, st.inputText)
      .set(
        `J${r}`,
        `=IF($C${r}="","",IF($F${r}<>${ACTIVE},0,IF($G${r}<>"",N($G${r}),N(DuesDefault))))`,
        st.calcMoney,
      )
      .set(`K${r}`, `=IF($C${r}="","",SUM('${S.dues}'!$E${dr}:$P${dr}))`, st.calcMoney)
      .set(
        `L${r}`,
        `=IF($C${r}="","",$J${r}*MAX(0,ElapsedMonths-MAX(1,N($H${r}))+1))`,
        st.calcMoney,
      )
      .set(`M${r}`, `=IF($C${r}="","",MAX(0,$L${r}-$K${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      });
  }
  const mr = (c: string) => `${c}${FIRST}:${c}${memLast}`;
  shMem.validate(mr('F'), { type: 'list', formula1: '=MemberStatuses' });
  shMem.validate(mr('G'), { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  shMem.validate(mr('H'), {
    type: 'whole',
    operator: 'between',
    formula1: '1',
    formula2: '12',
    prompt: t.startMsg,
  });
  shMem.cond(mr('M'), {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shMem.cond(`B${FIRST}:M${memLast}`, {
    type: 'expression',
    formula: `AND($C${FIRST}<>"",$F${FIRST}<>${ACTIVE})`,
    style: { font: { color: '9A9083', italic: true } },
  });
  shMem.freeze(`D${FIRST}`).autoFilter(`B${head}:M${memLast}`);
  wb.defineName('MemName', col(S.members, 'C', FIRST, memLast));
  wb.defineName('MemUnit', col(S.members, 'D', FIRST, memLast));
  wb.defineName('MemStatus', col(S.members, 'F', FIRST, memLast));
  wb.defineName('MemDues', col(S.members, 'J', FIRST, memLast));
  wb.defineName('MemStart', col(S.members, 'H', FIRST, memLast));
  wb.defineName('MemPaid', col(S.members, 'K', FIRST, memLast));
  wb.defineName('MemExpected', col(S.members, 'L', FIRST, memLast));
  wb.defineName('MemArrears', col(S.members, 'M', FIRST, memLast));

  // ---------- Iuran ----------
  sheetHeader(shDues, st, {
    brand: t.brand,
    title: S.dues,
    subtitle: t.subtitle.dues,
    lastCol: 'S',
    menu,
  });
  shDues.widths({ B: 24, C: 10, D: 11 });
  for (const c of MCOLS) shDues.width(c, 9.5);
  shDues.widths({ Q: 12, R: 12, S: 14 });
  shDues.width('T', 6, true);
  t.dues.forEach((h, i) => shDues.set(`${'BCD'[i]}${head}`, h, i === 0 ? st.thLeft : st.th));
  months.short.forEach((m, i) => shDues.set(`${MCOLS[i]}${head}`, m, st.th));
  t.duesTail.forEach((h, i) => shDues.set(`${'QRS'[i]}${head}`, h, st.th));
  shDues.set(`T${head}`, '#').height(head, 24);
  for (let r = FIRST; r <= memLast; r++) {
    const m = members[r - FIRST];
    const a = `'${S.members}'!`;
    shDues
      .set(`B${r}`, `=IF(${a}$C${r}="","",${a}$C${r})`, st.calcText)
      .set(`C${r}`, `=IF($B${r}="","",${a}$D${r}&"")`, st.calcCenter)
      .set(`D${r}`, `=IF($B${r}="","",${a}$J${r})`, st.calcMoney);
    for (let k = 0; k < 12; k++)
      shDues.set(`${MCOLS[k]}${r}`, m?.paid[k] || null, { ...st.inputMoney, numFmt: '#,##0;;""' });
    shDues
      .set(`Q${r}`, `=IF($B${r}="","",SUM(E${r}:P${r}))`, st.calcMoney)
      .set(`R${r}`, `=IF($B${r}="","",${a}$M${r})`, st.calcMoney)
      .set(
        `S${r}`,
        `=IF($B${r}="","",IF(N($D${r})=0,${q(t.exempt)},IF(N(R${r})<=0,${q(t.paid)},${q(t.behind)}&ROUND(R${r}/$D${r},0)&${q(locale === 'id' ? ' bln' : ' mo')})))`,
        st.calcCenter,
      )
      // Bantu: kunci urutan tunggakan untuk dashboard.
      .set(`T${r}`, `=IF(OR($B${r}="",N(R${r})<=0),"",R${r}+(100000-ROW())/10000000000)`);
  }
  const grid = `E${FIRST}:P${memLast}`;
  // Hijau = lunas bulan itu, kuning = sebagian, merah = belum bayar padahal sudah jatuh tempo.
  shDues.cond(grid, {
    type: 'expression',
    formula: `AND($D${FIRST}>0,N(E${FIRST})>=$D${FIRST})`,
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shDues.cond(grid, {
    type: 'expression',
    formula: `AND($D${FIRST}>0,N(E${FIRST})>0)`,
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shDues.cond(grid, {
    type: 'expression',
    formula: `AND($D${FIRST}>0,E${FIRST}="",COLUMN(E${FIRST})-4<=ElapsedMonths,COLUMN(E${FIRST})-4>=MAX(1,N(INDEX(MemStart,ROW()-${head}))))`,
    style: { fill: 'F9E6E8' },
  });
  shDues.cond(`S${FIRST}:S${memLast}`, {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.paid),
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shDues.cond(`S${FIRST}:S${memLast}`, {
    type: 'expression',
    formula: `LEFT(S${FIRST},${t.behind.length})=${q(t.behind)}`,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shDues.validate(grid, { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  const dTot = memLast + 1;
  shDues
    .set(`B${dTot}`, t.collected, st.grandLabel)
    .set(`B${dTot + 1}`, t.paidCount, st.totalLabel);
  for (let k = 0; k < 12; k++) {
    const c = MCOLS[k];
    shDues
      .set(`${c}${dTot}`, `=SUM(${c}${FIRST}:${c}${memLast})`, {
        ...st.grandMoney,
        numFmt: '#,##0',
      })
      .set(
        `${c}${dTot + 1}`,
        `=SUMPRODUCT(($D$${FIRST}:$D$${memLast}>0)*(${c}${FIRST}:${c}${memLast}>=$D$${FIRST}:$D$${memLast})*(${c}${FIRST}:${c}${memLast}<>""))`,
        { ...st.totalMoney, numFmt: '0' },
      );
  }
  shDues
    .set(`Q${dTot}`, `=SUM(Q${FIRST}:Q${memLast})`, st.grandMoney)
    .set(`R${dTot}`, `=SUM(R${FIRST}:R${memLast})`, st.grandMoney);
  shDues.freeze(`E${FIRST}`).printTitles(head, head);
  wb.defineName('DuesCollected', ref(S.dues, `$E$${dTot}:$P$${dTot}`));
  wb.defineName('DuesPaidCount', ref(S.dues, `$E$${dTot + 1}:$P$${dTot + 1}`));
  wb.defineName('ArrearsKey', col(S.dues, 'T', FIRST, memLast));

  // ---------- Kas ----------
  sheetHeader(shCash, st, {
    brand: t.brand,
    title: S.cash,
    subtitle: t.subtitle.cash,
    lastCol: 'J',
    menu,
  });
  shCash.widths({ B: 12, C: 34, D: 24, E: 14, F: 9, G: 14, H: 14, I: 12, J: 18 });
  shCash.width('K', 6, true);
  t.cash.forEach((h, i) =>
    shCash.set(`${'BCDEFGHIJ'[i]}${head}`, h, [1, 2, 8].includes(i) ? st.thLeft : st.th),
  );
  shCash.set(`K${head}`, '#').height(head, 26);
  for (let r = FIRST; r <= cashLast; r++) {
    const x = smp?.cash[r - FIRST];
    shCash
      .set(`B${r}`, x?.date ?? null, st.inputDate)
      .set(`C${r}`, x?.desc ?? null, st.inputText)
      .set(`D${r}`, x?.cat ?? null, st.inputText)
      .set(`E${r}`, x?.amount ?? null, st.inputMoney)
      .set(
        `F${r}`,
        `=IF($D${r}="","",IF(COUNTIF(IncomeCats,$D${r})>0,${KIN},IF(COUNTIF(ExpenseCats,$D${r})>0,${KOUT},"?")))`,
        st.calcCenter,
      )
      .set(`G${r}`, `=IF($F${r}=${KIN},N($E${r}),"")`, st.calcMoney)
      .set(`H${r}`, `=IF($F${r}=${KOUT},N($E${r}),"")`, st.calcMoney)
      .set(`I${r}`, x ? `BKT-${String(r - head).padStart(3, '0')}` : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`J${r}`, x?.by ?? null, st.inputText)
      .set(`K${r}`, `=IF(OR($B${r}="",$D${r}=""),"",IF(YEAR($B${r})=CashYear,MONTH($B${r}),""))`);
  }
  const cr = (c: string) => `${c}${FIRST}:${c}${cashLast}`;
  shCash.validate(cr('B'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
  });
  shCash.validate(cr('D'), { type: 'list', formula1: '=CashCats' });
  shCash.validate(cr('E'), { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  shCash.cond(cr('F'), {
    type: 'cellIs',
    operator: 'equal',
    formula: KIN,
    style: { font: { color: GOOD, bold: true } },
  });
  shCash.cond(cr('F'), {
    type: 'cellIs',
    operator: 'equal',
    formula: KOUT,
    style: { font: { color: BAD } },
  });
  shCash.cond(cr('F'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shCash.freeze(`A${FIRST}`).autoFilter(`B${head}:J${cashLast}`).printTitles(head, head);
  wb.defineName('CashDate', col(S.cash, 'B', FIRST, cashLast));
  wb.defineName('CashDesc', col(S.cash, 'C', FIRST, cashLast));
  wb.defineName('CashCat', col(S.cash, 'D', FIRST, cashLast));
  wb.defineName('CashAmount', col(S.cash, 'E', FIRST, cashLast));
  wb.defineName('CashType', col(S.cash, 'F', FIRST, cashLast));
  wb.defineName('CashIn', col(S.cash, 'G', FIRST, cashLast));
  wb.defineName('CashOut', col(S.cash, 'H', FIRST, cashLast));
  wb.defineName('CashMonth', col(S.cash, 'K', FIRST, cashLast));

  // ---------- Laporan Bulanan ----------
  const R = t.rep;
  sheetHeader(shRep, st, {
    brand: t.brand,
    title: S.report,
    subtitle: t.subtitle.report,
    lastCol: 'G',
    menu,
  });
  shRep.widths({ B: 12, C: 30, D: 24, E: 16, F: 3, G: 9 });
  shRep.width('P', 6, true);
  const pick = { ...st.inputText, font: { size: 11, bold: true } };
  shRep
    .set('B5', R.month, st.label)
    .merge('C5:D5', months.long[defaultMonth(year)], pick)
    .height(5, 22);
  shRep.validate('C5', { type: 'list', formula1: '=Months' });
  shRep.set('P5', '=MATCH(C5,Months,0)');
  wb.defineName('RepMonth', ref(S.report, '$P$5'));
  shRep.style('B7:E7', { fill: INK });
  shRep.merge('B7:C7', R.title, {
    font: { name: 'Georgia', size: 15, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { v: 'center', indent: 1 },
  });
  shRep.merge('D7:E7', '=INDEX(Months,RepMonth)&" "&CashYear', {
    font: { size: 11, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { h: 'right', v: 'center', indent: 1 },
  });
  shRep.height(7, 28);
  shRep
    .merge('B8:E8', '=OrgName', {
      font: { size: 12, bold: true, color: INK },
      align: { indent: 1, v: 'center' },
    })
    .height(8, 22);
  shRep.merge('B9:E9', '=IF(OrgAddress="","",OrgAddress)', { ...st.footer, align: { indent: 1 } });
  // Saldo awal bulan = saldo awal tahun + iuran dan kas sebelum bulan ini.
  const before =
    'OpeningBalance+SUMPRODUCT(DuesCollected*(COLUMN(DuesCollected)-COLUMN(INDEX(DuesCollected,1,1))+1<RepMonth))+SUMIFS(CashIn,CashMonth,"<"&RepMonth)-SUMIFS(CashOut,CashMonth,"<"&RepMonth)';
  shRep.merge('B11:D11', R.opening, st.totalLabel).set('E11', `=${before}`, st.totalMoney);
  shRep.merge('B13:E13', R.income, st.section);
  shRep
    .merge('B14:C14', R.dues, st.rowLabel)
    .set(
      'D14',
      `=INDEX(DuesPaidCount,1,RepMonth)&${q(R.paidInfo)}&COUNTIF(MemDues,">0")&${q(R.paidInfo2)}`,
      { ...st.rowLabel, font: { size: 9, italic: true, color: '6F675C' } },
    )
    .set('E14', '=INDEX(DuesCollected,1,RepMonth)', st.rowMoney);
  let r = 15;
  for (let k = 0; k < incomes.length + 2; k++, r++)
    shRep
      .merge(
        `B${r}:D${r}`,
        `=IF(INDEX(IncomeCats,${k + 1})="","",INDEX(IncomeCats,${k + 1}))`,
        st.rowLabel,
      )
      .set(
        `E${r}`,
        `=IF(B${r}="","",SUMIFS(CashIn,CashCat,B${r},CashMonth,RepMonth))`,
        st.rowMoney,
      );
  const inEnd = r - 1;
  shRep
    .merge(`B${r}:D${r}`, R.totalIn, st.totalLabel)
    .set(`E${r}`, `=SUM(E14:E${inEnd})`, st.totalMoney);
  const totalInRow = r;
  r += 2;
  shRep.merge(`B${r}:E${r}`, R.expense, st.section);
  r++;
  const exStart = r;
  for (let k = 0; k < expenses.length + 2; k++, r++)
    shRep
      .merge(
        `B${r}:D${r}`,
        `=IF(INDEX(ExpenseCats,${k + 1})="","",INDEX(ExpenseCats,${k + 1}))`,
        st.rowLabel,
      )
      .set(
        `E${r}`,
        `=IF(B${r}="","",SUMIFS(CashOut,CashCat,B${r},CashMonth,RepMonth))`,
        st.rowMoney,
      );
  shRep
    .merge(`B${r}:D${r}`, R.totalOut, st.totalLabel)
    .set(`E${r}`, `=SUM(E${exStart}:E${r - 1})`, st.totalMoney);
  const totalOutRow = r;
  r += 2;
  shRep
    .merge(`B${r}:D${r}`, R.closing, st.grandLabel)
    .set(`E${r}`, `=E11+E${totalInRow}-E${totalOutRow}`, st.grandMoney)
    .height(r, 26);
  r += 2;
  // Rincian transaksi bulan ini
  shRep.merge(`B${r}:E${r}`, R.details, st.h2);
  r++;
  R.head.forEach((h, i) => shRep.set(`${'BCDE'[i]}${r}`, h, i === 1 ? st.thLeft : st.th));
  const txFirst = r + 1;
  // Kolom bantu tersembunyi P: urutan transaksi bulan laporan.
  for (let k = 1; k <= REPORT_TX; k++) {
    const rr = txFirst + k - 1;
    const ix = (n: string) => `IF($P${rr}="","",INDEX(${n},$P${rr}))`;
    shRep
      .set(`P${rr}`, `=IFERROR(MATCH(${k},CashSeq,0),"")`)
      .set(`B${rr}`, `=${ix('CashDate')}`, {
        ...st.rowLabel,
        numFmt: st.date,
        align: { h: 'center' },
      })
      .set(`C${rr}`, `=IF($P${rr}="","",INDEX(CashDesc,$P${rr})&"")`, st.rowLabel)
      .set(`D${rr}`, `=${ix('CashIn')}`, st.rowMoney)
      .set(`E${rr}`, `=${ix('CashOut')}`, st.rowMoney);
  }
  r = txFirst + REPORT_TX;
  shRep.merge(`B${r}:E${r}`, `=IF(MAX(CashSeq)>${REPORT_TX},${q(R.more)},"")`, {
    ...st.note,
    font: { size: 9, italic: true, color: WARN },
  });
  r += 2;
  shRep
    .merge(`B${r}:C${r}`, R.chair, { ...st.footer, align: { h: 'center' } })
    .merge(`D${r}:E${r}`, R.treasurer, { ...st.footer, align: { h: 'center' } });
  const sign = {
    font: { size: 10, bold: true, color: INK },
    border: { top: { style: 'thin' as const, color: INK } },
    align: { h: 'center' as const },
  };
  shRep
    .merge(`B${r + 4}:C${r + 4}`, '=OrgChair&""', sign)
    .merge(`D${r + 4}:E${r + 4}`, '=OrgTreasurer&""', sign);
  // Urutan transaksi bulan laporan di sheet Kas (kolom bantu L).
  shCash.width('L', 6, true).set(`L${head}`, '#');
  for (let rr = FIRST; rr <= cashLast; rr++)
    shCash.set(`L${rr}`, `=IF(AND($K${rr}<>"",$K${rr}=RepMonth),N(L${rr - 1})+1,N(L${rr - 1}))`);
  wb.defineName('CashSeq', col(S.cash, 'L', FIRST, cashLast));
  // Ringkasan setahun: tabel di bawah Dashboard (baris 58+), juga sumber grafik.
  const yH = 58;
  shDash.merge(`B${yH}:G${yH}`, R.yearH, st.h2);
  R.yearHead.forEach((h, i) =>
    shDash.set(`${'BCDEFG'[i]}${yH + 1}`, h, i === 0 ? st.thLeft : st.th),
  );
  shDash.height(yH + 1, 30);
  for (let m = 1; m <= 12; m++) {
    const rr = yH + 1 + m;
    shDash
      .set(`B${rr}`, months.short[m - 1], st.rowLabel)
      .set(`C${rr}`, `=INDEX(DuesCollected,1,${m})`, st.rowMoney)
      .set(`D${rr}`, `=SUMIFS(CashIn,CashMonth,${m})`, st.rowMoney)
      .set(`E${rr}`, `=SUMIFS(CashOut,CashMonth,${m})`, st.rowMoney)
      .set(
        `F${rr}`,
        m === 1 ? `=OpeningBalance+C${rr}+D${rr}-E${rr}` : `=F${rr - 1}+C${rr}+D${rr}-E${rr}`,
        { ...st.rowMoney, font: { size: 10, bold: true } },
      )
      .set(
        `G${rr}`,
        `=IF(COUNTIF(MemDues,">0")=0,"",IF(${m}>ElapsedMonths,"",INDEX(DuesPaidCount,1,${m})/COUNTIF(MemDues,">0")))`,
        st.rowPct,
      );
  }
  const yCol: Record<string, string> = { I: 'B', J: 'C', K: 'D', L: 'E', N: 'G' };
  const yLine = (c: string) => ref(S.dash, `$${yCol[c]}$${yH + 2}:$${yCol[c]}$${yH + 13}`);
  // Kolom bantu P: persentase lunas atau #N/A (bulan yang belum tiba) agar garis grafik berhenti.
  for (let m = 1; m <= 12; m++)
    shDash.set(`P${yH + 1 + m}`, `=IF(G${yH + 1 + m}="",NA(),G${yH + 1 + m})`);

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of 'OPQ') shDash.width(c, 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&OrgName`, st.title);
  const L5 = {
    id: { label: 'Bulan dipilih', no: '"(bulan ke-"0")"' },
    en: { label: 'Selected month', no: '"(month "0")"' },
  }[locale];
  shDash.set('B5', L5.label, st.label).merge('D5:E5', months.long[defaultMonth(year)], pick);
  shDash.set('F5', '=MATCH(D5,Months,0)', { ...st.note, numFmt: L5.no, align: { v: 'center' } });
  shDash.merge('H5:J5', `=${q(locale === 'id' ? 'Tahun ' : 'Year ')}&CashYear`, {
    ...st.label,
    align: { v: 'center' },
  });
  shDash.validate('D5', { type: 'list', formula1: '=Months' });
  shDash.height(5, 22).height(6, 8).height(10, 10);
  const active = 'COUNTIF(MemDues,">0")';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kBalance,
    value: '=OpeningBalance+SUM(DuesCollected)+SUM(CashIn)-SUM(CashOut)',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kDuesMonth,
    value: '=INDEX(DuesCollected,1,$F$5)',
    note: `=INDEX(DuesPaidCount,1,$F$5)&"/"&${active}&${q(t.ofMembers)}`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kArrears,
    value: '=SUM(MemArrears)',
    note: `=COUNTIF(MemArrears,">0")&${q(t.inArrears)}`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kSpent,
    value: '=SUMIFS(CashOut,CashMonth,$F$5)',
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kOther,
    value: '=SUMIFS(CashIn,CashMonth,$F$5)',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kCompliance,
    value: '=IF(SUM(MemExpected)=0,0,MIN(1,SUM(MemPaid)/SUM(MemExpected)))',
    note: t.complianceNote,
    numFmt: '0%',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kMembers,
    value: `=COUNTIF(MemStatus,${ACTIVE})`,
    note: `=${q(t.perMonth)}&TEXT(DuesDefault,"#,##0")`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kSpentYtd,
    value: '=SUMIFS(CashOut,CashMonth,"<="&$F$5)',
  });
  shDash.cond('H8:J8', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shDash.cond('B8:D8', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  // Pemasukan (iuran + lain) vs pengeluaran per bulan: kolom bantu O:Q
  for (let m = 1; m <= 12; m++) {
    const rr = 15 + m;
    shDash
      .set(`O${rr}`, months.short[m - 1])
      .set(`P${rr}`, `=INDEX(${yLine('J')},${m})+INDEX(${yLine('K')},${m})`)
      .set(`Q${rr}`, `=INDEX(${yLine('L')},${m})`);
  }
  shDash.chart({
    type: 'column',
    title: t.chartFlow,
    from: 'B15',
    to: 'H33',
    numFmt: '#,##0',
    series: [
      {
        name: t.inLabel,
        categories: ref(S.dash, '$O$16:$O$27'),
        values: ref(S.dash, '$P$16:$P$27'),
        color: accent.main,
      },
      {
        name: t.outLabel,
        categories: ref(S.dash, '$O$16:$O$27'),
        values: ref(S.dash, '$Q$16:$Q$27'),
        color: 'A8461F',
      },
    ],
  });
  shDash.chart({
    type: 'line',
    title: t.chartPaid,
    from: 'H15',
    to: 'N33',
    numFmt: '0%',
    legend: 'none',
    series: [
      {
        name: t.chartPaid,
        categories: yLine('I'),
        values: ref(S.dash, `$P$${yH + 2}:$P$${yH + 13}`),
        color: '2C4A86',
      },
    ],
  });
  const nEx = Math.max(1, expenses.length);
  for (let k = 0; k < nEx; k++) {
    const rr = 30 + k;
    shDash
      .set(`O${rr + 10}`, `=IF(INDEX(ExpenseCats,${k + 1})="","",INDEX(ExpenseCats,${k + 1}))`)
      .set(`P${rr + 10}`, `=IF(O${rr + 10}="",0,SUMIFS(CashOut,CashCat,O${rr + 10}))`);
  }
  shDash.chart({
    type: 'doughnut',
    title: t.chartExp,
    from: 'B35',
    to: 'H55',
    legend: 'r',
    sliceColors: expenses.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    series: [
      {
        name: t.chartExp,
        categories: ref(S.dash, `$O$40:$O$${39 + nEx}`),
        values: ref(S.dash, `$P$40:$P$${39 + nEx}`),
      },
    ],
  });
  shDash.merge('I35:M35', t.topH, st.h2);
  shDash
    .merge('I36:J36', t.topHead[0], st.thLeft)
    .set('K36', t.topHead[1], st.th)
    .merge('L36:M36', t.topHead[2], st.th)
    .height(36, 26);
  for (let k = 1; k <= 12; k++) {
    const rr = 36 + k;
    const ix = (n: string) => `IF($Q${rr}="","",INDEX(${n},$Q${rr}))`;
    shDash
      .set(`Q${rr}`, `=IFERROR(MATCH(LARGE(ArrearsKey,${k}),ArrearsKey,0),"")`)
      .merge(
        `I${rr}:J${rr}`,
        k === 1 ? `=IF($Q${rr}="",${q(t.noArrears)},INDEX(MemName,$Q${rr}))` : `=${ix('MemName')}`,
        st.rowLabel,
      )
      .set(`K${rr}`, `=IF($Q${rr}="","",INDEX(MemUnit,$Q${rr})&"")`, {
        ...st.rowLabel,
        align: { h: 'center' },
      })
      .merge(`L${rr}:M${rr}`, `=${ix('MemArrears')}`, {
        ...st.rowMoney,
        font: { size: 10, bold: true, color: BAD },
      });
  }

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: `=OrgName&${q(' · ')}&CashYear`,
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.dues, t.desc.dues],
      [S.cash, t.desc.cash],
      [S.report, t.desc.report],
      [S.members, t.desc.members],
      [S.set, t.desc.set],
    ],
  });
  return wb;

  function makeSample() {
    const rnd = seeded(year + 41);
    const due = money(50_000);
    const now = new Date();
    const elapsed =
      year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth() + 1;
    const blocks = ['A', 'B', 'C', 'D'];
    const members = Array.from({ length: 40 }, (_, i) => {
      const name = `${t.sample.first[i % 20]} ${t.sample.last[(i * 7) % 10]}`;
      const start = i === 37 ? Math.min(6, Math.max(1, elapsed)) : undefined;
      const custom = i === 12 ? money(25_000) : undefined;
      const amount = custom ?? due;
      // Pola bayar: kebanyakan rutin, 6 KK menunggak, 3 KK membayar di muka.
      const paid: number[] = [];
      for (let k = 0; k < 12; k++) {
        if (start && k + 1 < start) continue;
        const late = i % 7 === 3;
        const ahead = i % 13 === 5;
        if (k < elapsed) {
          if (late && k >= elapsed - 1 - (i % 3)) continue;
          if (rnd() < 0.012) {
            paid[k] = Math.round(amount / 2);
            continue;
          }
          paid[k] = amount;
        } else if (ahead && k < elapsed + 2) paid[k] = amount;
      }
      return { name, unit: `${blocks[Math.floor(i / 10)]}-${(i % 10) + 1}`, custom, start, paid };
    });
    const cash: { date: number; desc: string; cat: string; amount: number; by: string }[] = [];
    const tx = t.sample.tx;
    const exp = (i: number) => expenses[Math.min(i, expenses.length - 1)];
    const inc = (i: number) => incomes[Math.min(i, incomes.length - 1)];
    const lastMonth = Math.max(1, elapsed);
    for (let m = 1; m <= lastMonth; m++) {
      const d = (day: number) => excelDate(year, m, Math.min(day, new Date(year, m, 0).getDate()));
      cash.push({
        date: d(3),
        desc: tx.security,
        cat: exp(0),
        amount: money(1_000_000),
        by: t.sample.treasurer,
      });
      cash.push({
        date: d(5),
        desc: tx.trash,
        cat: exp(1),
        amount: money(400_000),
        by: t.sample.treasurer,
      });
      cash.push({
        date: d(10),
        desc: tx.power,
        cat: exp(2),
        amount: money(85_000 + Math.round(rnd() * 30_000)),
        by: t.sample.treasurer,
      });
      if (rnd() < 0.5)
        cash.push({
          date: d(12 + Math.floor(rnd() * 10)),
          desc: tx.donation,
          cat: inc(0),
          amount: money(100_000 + Math.round(rnd() * 400_000)),
          by: t.sample.treasurer,
        });
      if (m % 4 === 2)
        cash.push({
          date: d(18),
          desc: tx.grief,
          cat: exp(4),
          amount: money(300_000),
          by: t.sample.chair,
        });
      if (m % 5 === 3)
        cash.push({
          date: d(20),
          desc: tx.repair,
          cat: exp(5),
          amount: money(350_000),
          by: t.sample.chair,
        });
      if (m % 3 === 1)
        cash.push({
          date: d(25),
          desc: tx.atk,
          cat: exp(6),
          amount: money(60_000),
          by: t.sample.treasurer,
        });
      if (m % 6 === 4)
        cash.push({
          date: d(15),
          desc: tx.rent,
          cat: inc(2),
          amount: money(250_000),
          by: t.sample.treasurer,
        });
      if (m === 8) {
        cash.push({
          date: d(5),
          desc: tx.augDonation,
          cat: inc(1),
          amount: money(1_750_000),
          by: t.sample.chair,
        });
        cash.push({
          date: d(17),
          desc: tx.aug,
          cat: exp(3),
          amount: money(2_400_000),
          by: t.sample.chair,
        });
      }
    }
    cash.sort((a, b) => a.date - b.date);
    return { members, cash };
  }
}
