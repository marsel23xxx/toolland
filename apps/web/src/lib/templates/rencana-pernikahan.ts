/**
 * Template Rencana Pernikahan: anggaran per vendor (estimasi vs deal), jadwal pembayaran DP dan
 * pelunasan, daftar tamu dengan RSVP, checklist persiapan dengan tenggat otomatis dari tanggal
 * acara, dan dashboard hitung mundur.
 */
import type { Locale } from '../format';
import { type Style, Workbook, excelDate } from '../xlsx';
import { CURRENCIES, type Currency } from './currencies';
import {
  type FormValues,
  type TemplateForm,
  formChoice,
  formDate,
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
  MONTHS,
  WARN,
  WARN_BG,
  cleanList,
  kpiCard,
  makeStyles,
  menuSheet,
  q,
  sampleMoney,
  seeded,
  sheetHeader,
} from './kit';

export interface WeddingOptions {
  locale: Locale;
  partner1: string;
  partner2: string;
  date: [number, number, number];
  budget: number;
  currency: Currency;
  categories: string[];
  /** "Nama | kelompok | jumlah orang" per baris. */
  guests: string[];
  sample: boolean;
}

const FIRST = 6;
const ITEM_ROWS = 100;
const PAY_ROWS = 200;
const GUEST_ROWS = 600;
const TASK_ROWS = 120;
const CAT_ROWS = 20;
const GROUP_ROWS = 12;

const L = {
  id: {
    brand: 'TOOLLAND · RENCANA PERNIKAHAN',
    name: 'Rencana Pernikahan',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      budget: 'Anggaran',
      pay: 'Pembayaran',
      guests: 'Tamu',
      tasks: 'Checklist',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Hitung mundur hari H, anggaran, pembayaran, tamu yang konfirmasi, progres checklist, dan agenda terdekat.',
      budget:
        'Semua kebutuhan per kategori dan vendor: estimasi, harga deal, sudah dibayar, sisa, dan status.',
      pay: 'Jadwal DP dan pelunasan setiap vendor, dengan pengingat jatuh tempo.',
      guests: 'Daftar tamu: pihak, kelompok, jumlah orang, undangan, dan konfirmasi kehadiran.',
      tasks: 'Checklist persiapan dengan tenggat otomatis dihitung mundur dari tanggal acara.',
      set: 'Nama pasangan, tanggal dan lokasi acara, total anggaran, kategori, dan kelompok tamu.',
    },
    subtitle: {
      menu: 'Rencanakan pernikahan dengan tenang: anggaran, vendor, tamu, dan persiapan dalam satu file.',
      budget:
        'Satu baris per kebutuhan. Isi estimasi dulu, lalu harga deal setelah sepakat dengan vendor.',
      pay: 'Satu baris per termin (DP, pelunasan). Isi tanggal bayar saat sudah dibayar.',
      guests: 'Satu baris per undangan. Jumlah orang = yang diundang dalam satu undangan.',
      tasks: 'Isi berapa bulan sebelum acara tugas harus selesai; tenggatnya dihitung otomatis.',
      set: 'Atur sekali di awal. Tanggal acara dipakai untuk hitung mundur dan tenggat checklist.',
      dash: 'Kondisi persiapan hari ini.',
    },
    steps: [
      'Isi Pengaturan: nama berdua, tanggal acara, dan total anggaran.',
      'Tulis kebutuhan dan vendor di Anggaran, jadwal DP dan pelunasan di Pembayaran, dan daftar tamu di Tamu.',
      'Centang Checklist satu per satu, dan pantau semuanya di Dashboard.',
    ],
    set: [
      ['Mempelai pria', 'Partner1', 'text'],
      ['Mempelai wanita', 'Partner2', 'text'],
      ['Tanggal acara', 'WeddingDate', 'date'],
      ['Lokasi', 'Venue', 'text'],
      ['Total anggaran', 'TotalBudget', 'money'],
      ['Mata uang', 'CurrencyLabel', 'calc'],
    ] as [string, string, string][],
    catsH: 'Kategori anggaran',
    groupsH: 'Kelompok tamu',
    sides: ['Pria', 'Wanita', 'Bersama'],
    invites: ['Fisik', 'Digital'],
    rsvp: ['Hadir', 'Tidak hadir', 'Belum'],
    yes: 'Ya',
    no: 'Tidak',
    budget: [
      'ID',
      'Kategori',
      'Kebutuhan',
      'Vendor',
      'Kontak',
      'Estimasi',
      'Harga deal',
      'Dibayar',
      'Sisa',
      'Status',
      'Catatan',
    ],
    bStatus: { none: 'Belum deal', dp: 'DP', paid: 'Lunas' },
    pay: [
      'ID anggaran',
      'Kebutuhan',
      'Termin',
      'Jatuh tempo',
      'Jumlah',
      'Tanggal bayar',
      'Metode',
      'Status',
    ],
    pStatus: { paid: 'Lunas', late: 'Terlambat', soon: 'Segera', plan: 'Terjadwal' },
    terms: ['DP', 'Termin 2', 'Pelunasan'],
    guests: [
      'Nama',
      'Pihak',
      'Kelompok',
      'Jumlah orang',
      'Undangan',
      'Terkirim',
      'RSVP',
      'Telepon / alamat',
      'Meja / sesi',
      'Catatan',
    ],
    tasks: [
      'Tugas',
      'Kategori',
      'Bulan sebelum acara',
      'Tenggat',
      'PIC',
      'Selesai',
      'Status',
      'Catatan',
    ],
    tStatus: { done: 'Selesai', late: 'Terlambat', soon: 'Segera', later: 'Nanti' },
    monthsMsg: 'Contoh: 6 = paling lambat 6 bulan sebelum acara. 0 = minggu-minggu terakhir.',
    kCountdown: 'Menuju hari H',
    kBudget: 'Total anggaran',
    kPaid: 'Sudah dibayar',
    kLeft: 'Sisa yang harus dibayar',
    kInvited: 'Tamu diundang',
    kConfirmed: 'Konfirmasi hadir',
    kTasks: 'Checklist selesai',
    kDue: 'Bayar 30 hari ke depan',
    days: ' hari',
    dealNote: 'Total harga deal: ',
    overNote: 'Melebihi anggaran: ',
    inviteNote: ' undangan',
    pending: ' belum konfirmasi',
    taskNote: ' terlambat',
    chartBudget: 'Estimasi vs deal per kategori',
    chartGuests: 'Tamu per kelompok',
    chartTasks: 'Pembayaran per bulan',
    estimate: 'Estimasi',
    deal: 'Deal',
    attending: 'Hadir',
    notYet: 'Belum',
    declined: 'Tidak hadir',
    payLabel: 'Pembayaran',
    nextTasksH: 'Tugas terdekat',
    nextTasksHead: ['Tugas', 'PIC', 'Tenggat'],
    noTasks: 'Semua tugas selesai.',
    nextPayH: 'Pembayaran terdekat',
    nextPayHead: ['Kebutuhan', 'Termin', 'Jatuh tempo', 'Jumlah'],
    noPay: 'Tidak ada pembayaran tertunda.',
    sample: {
      p1: 'Julian Marcell',
      p2: 'Ayudiyah Pratiwi',
      venue: 'Gedung Serbaguna Melati, Yogyakarta',
      groups: [
        'Keluarga pria',
        'Keluarga wanita',
        'Teman pria',
        'Teman wanita',
        'Rekan kerja',
        'Tetangga',
      ],
      first: [
        'Budi',
        'Siti',
        'Agus',
        'Dewi',
        'Rizky',
        'Putri',
        'Hendra',
        'Maya',
        'Fajar',
        'Lina',
        'Yoga',
        'Rina',
        'Andi',
        'Sari',
        'Eko',
        'Nur',
      ],
      last: [
        'Santoso',
        'Lestari',
        'Wijaya',
        'Hidayat',
        'Saputra',
        'Kurniawan',
        'Rahayu',
        'Gunawan',
      ],
    },
  },
  en: {
    brand: 'TOOLLAND · WEDDING PLANNER',
    name: 'Wedding Planner',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      budget: 'Budget',
      pay: 'Payments',
      guests: 'Guests',
      tasks: 'Checklist',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Countdown to the big day, budget, payments, confirmed guests, checklist progress, and what’s next.',
      budget:
        'Everything you need by category and vendor: estimate, agreed price, paid, balance, and status.',
      pay: 'Deposit and final payment schedule for each vendor, with due-date reminders.',
      guests: 'Guest list: side, group, number of people, invitation, and RSVP.',
      tasks: 'Planning checklist with deadlines counted back from the wedding date.',
      set: 'Couple’s names, date and venue, total budget, categories, and guest groups.',
    },
    subtitle: {
      menu: 'Plan your wedding calmly: budget, vendors, guests, and to-dos in one file.',
      budget:
        'One row per item. Enter an estimate first, then the agreed price once you sign with a vendor.',
      pay: 'One row per instalment (deposit, final). Enter the paid date once paid.',
      guests: 'One row per invitation. Number of people = everyone on that invitation.',
      tasks:
        'Enter how many months before the wedding a task should be done; the deadline is calculated.',
      set: 'Set this up once. The wedding date drives the countdown and checklist deadlines.',
      dash: 'Where your planning stands today.',
    },
    steps: [
      'Fill in Settings: your names, the wedding date, and total budget.',
      'List items and vendors in Budget, deposits and payments in Payments, and guests in Guests.',
      'Tick off the Checklist and keep an eye on everything in the Dashboard.',
    ],
    set: [
      ['Partner 1', 'Partner1', 'text'],
      ['Partner 2', 'Partner2', 'text'],
      ['Wedding date', 'WeddingDate', 'date'],
      ['Venue', 'Venue', 'text'],
      ['Total budget', 'TotalBudget', 'money'],
      ['Currency', 'CurrencyLabel', 'calc'],
    ] as [string, string, string][],
    catsH: 'Budget categories',
    groupsH: 'Guest groups',
    sides: ['Partner 1', 'Partner 2', 'Both'],
    invites: ['Printed', 'Digital'],
    rsvp: ['Attending', 'Declined', 'Pending'],
    yes: 'Yes',
    no: 'No',
    budget: [
      'ID',
      'Category',
      'Item',
      'Vendor',
      'Contact',
      'Estimate',
      'Agreed price',
      'Paid',
      'Balance',
      'Status',
      'Notes',
    ],
    bStatus: { none: 'Not booked', dp: 'Deposit', paid: 'Paid' },
    pay: ['Budget ID', 'Item', 'Instalment', 'Due date', 'Amount', 'Paid on', 'Method', 'Status'],
    pStatus: { paid: 'Paid', late: 'Overdue', soon: 'Due soon', plan: 'Scheduled' },
    terms: ['Deposit', 'Instalment 2', 'Final payment'],
    guests: [
      'Name',
      'Side',
      'Group',
      'People',
      'Invitation',
      'Sent',
      'RSVP',
      'Phone / address',
      'Table',
      'Notes',
    ],
    tasks: ['Task', 'Category', 'Months before', 'Deadline', 'Owner', 'Done', 'Status', 'Notes'],
    tStatus: { done: 'Done', late: 'Overdue', soon: 'Due soon', later: 'Later' },
    monthsMsg: 'Example: 6 = at least 6 months before the wedding. 0 = the last few weeks.',
    kCountdown: 'Days to go',
    kBudget: 'Total budget',
    kPaid: 'Paid so far',
    kLeft: 'Still to pay',
    kInvited: 'Guests invited',
    kConfirmed: 'Confirmed attending',
    kTasks: 'Checklist done',
    kDue: 'Due in 30 days',
    days: ' days',
    dealNote: 'Total agreed: ',
    overNote: 'Over budget by ',
    inviteNote: ' invitations',
    pending: ' pending',
    taskNote: ' overdue',
    chartBudget: 'Estimate vs agreed by category',
    chartGuests: 'Guests by group',
    chartTasks: 'Payments by month',
    estimate: 'Estimate',
    deal: 'Agreed',
    attending: 'Attending',
    notYet: 'Pending',
    declined: 'Declined',
    payLabel: 'Payments',
    nextTasksH: 'Next tasks',
    nextTasksHead: ['Task', 'Owner', 'Deadline'],
    noTasks: 'Every task is done.',
    nextPayH: 'Next payments',
    nextPayHead: ['Item', 'Instalment', 'Due', 'Amount'],
    noPay: 'No pending payments.',
    sample: {
      p1: 'Julian Marcell',
      p2: 'Ayudiyah Pratiwi',
      venue: 'Melati Hall, Yogyakarta',
      groups: [
        'Partner 1 family',
        'Partner 2 family',
        'Partner 1 friends',
        'Partner 2 friends',
        'Colleagues',
        'Neighbours',
      ],
      first: [
        'Budi',
        'Siti',
        'Agus',
        'Dewi',
        'Rizky',
        'Putri',
        'Hendra',
        'Maya',
        'Fajar',
        'Lina',
        'Yoga',
        'Rina',
        'Andi',
        'Sari',
        'Eko',
        'Nur',
      ],
      last: [
        'Santoso',
        'Lestari',
        'Wijaya',
        'Hidayat',
        'Saputra',
        'Kurniawan',
        'Rahayu',
        'Gunawan',
      ],
    },
  },
};

export const WEDDING_CATEGORIES: Record<Locale, string[]> = {
  id: [
    'Venue / gedung',
    'Katering',
    'Dekorasi',
    'Busana & rias',
    'Dokumentasi',
    'Undangan & souvenir',
    'Hiburan & MC',
    'Cincin & mahar',
    'Seserahan',
    'Administrasi nikah',
    'Wedding organizer',
    'Lain-lain',
  ],
  en: [
    'Venue',
    'Catering',
    'Decoration',
    'Attire & make-up',
    'Photo & video',
    'Invitations & favours',
    'Entertainment & MC',
    'Rings',
    'Gifts',
    'Marriage registration',
    'Wedding planner',
    'Other',
  ],
};

/** Contoh anggaran: kategori, kebutuhan id/en, vendor, estimasi, deal (0 = belum), bagian dibayar (0..1). */
const ITEMS: [number, string, string, string, number, number, number][] = [
  [0, 'Sewa gedung', 'Hall rental', 'Gedung Melati', 35_000_000, 33_000_000, 0.5],
  [1, 'Katering 400 porsi', 'Catering for 400', 'Dapur Bu Rini', 34_000_000, 32_000_000, 0.3],
  [
    2,
    'Dekorasi pelaminan & gedung',
    'Stage & hall decoration',
    'Kembang Setaman Deco',
    15_000_000,
    16_500_000,
    0.3,
  ],
  [
    3,
    'Rias & busana pengantin',
    'Bridal make-up & attire',
    'Sanggar Ayu',
    12_000_000,
    11_000_000,
    0.5,
  ],
  [4, 'Foto & video', 'Photo & video', 'Lensa Cerita Studio', 10_000_000, 9_500_000, 0.5],
  [
    5,
    'Undangan cetak 300 lembar',
    'Printed invitations (300)',
    'Percetakan Jaya',
    3_000_000,
    2_700_000,
    1,
  ],
  [5, 'Souvenir 400 pcs', 'Wedding favours (400)', 'Souvenirku', 4_000_000, 0, 0],
  [6, 'Band akustik', 'Acoustic band', 'Senja Akustik', 6_000_000, 6_000_000, 0.3],
  [6, 'MC', 'MC', 'Mas Bayu MC', 2_500_000, 2_500_000, 0],
  [7, 'Cincin kawin', 'Wedding rings', 'Toko Emas Murni', 8_000_000, 7_600_000, 1],
  [8, 'Seserahan', 'Gifts', '-', 5_000_000, 0, 0],
  [9, 'Biaya nikah di luar KUA', 'Marriage registration', 'KUA', 600_000, 600_000, 0],
  [10, 'Wedding organizer', 'Wedding planner', 'Bahagia WO', 10_000_000, 9_000_000, 0.3],
];

/** Contoh checklist: tugas id/en, kategori, bulan sebelum acara. */
const TASKS: [string, string, number, number][] = [
  ['Tentukan total anggaran berdua', 'Agree on the total budget', 11, 12],
  ['Tentukan tanggal & tema', 'Pick the date & theme', 11, 12],
  ['Pertemuan dua keluarga', 'Families meet', 11, 11],
  ['Booking gedung / venue', 'Book the venue', 0, 10],
  ['Pilih & booking wedding organizer', 'Book a wedding planner', 10, 10],
  ['Tes rasa & booking katering', 'Taste & book catering', 1, 9],
  ['Booking fotografer & videografer', 'Book photo & video', 4, 9],
  ['Pilih perias & busana', 'Choose make-up & attire', 3, 8],
  ['Booking dekorasi', 'Book decoration', 2, 8],
  ['Susun daftar tamu awal', 'Draft the guest list', 11, 7],
  ['Booking hiburan & MC', 'Book entertainment & MC', 6, 6],
  ['Foto prewedding', 'Pre-wedding photoshoot', 4, 5],
  ['Beli cincin kawin', 'Buy wedding rings', 7, 5],
  ['Desain & cetak undangan', 'Design & print invitations', 5, 4],
  ['Pesan souvenir', 'Order wedding favours', 5, 4],
  ['Urus berkas nikah (KUA / catatan sipil)', 'Prepare marriage paperwork', 9, 3],
  ['Fitting busana pertama', 'First dress fitting', 3, 3],
  ['Sebar undangan', 'Send invitations', 5, 2],
  ['Siapkan seserahan', 'Prepare gifts', 8, 2],
  ['Technical meeting dengan semua vendor', 'Technical meeting with vendors', 10, 1],
  ['Fitting busana terakhir', 'Final dress fitting', 3, 1],
  ['Konfirmasi jumlah tamu ke katering', 'Confirm final headcount', 1, 1],
  ['Pelunasan semua vendor', 'Pay all vendors in full', 11, 0],
  ['Siapkan amplop & buku tamu', 'Prepare guest book', 11, 0],
  ['Gladi bersih', 'Rehearsal', 10, 0],
];

const form = (locale: Locale): TemplateForm => {
  const id = locale === 'id';
  return {
    template: 'wedding',
    fileBase: id ? 'Rencana-Pernikahan' : 'Wedding-Planner',
    fileKey: 'partner1',
    heading: id ? 'Atur sesuai rencana kalian' : 'Set it up for your wedding',
    fields: [
      {
        key: 'partner1',
        kind: 'text',
        label: id ? 'Mempelai pria' : 'Partner 1',
        placeholder: 'Julian',
      },
      {
        key: 'partner2',
        kind: 'text',
        label: id ? 'Mempelai wanita' : 'Partner 2',
        placeholder: 'Ayudiyah',
      },
      {
        key: 'date',
        kind: 'date',
        label: id ? 'Tanggal acara' : 'Wedding date',
        value: 'today+180',
      },
      { key: 'currency', kind: 'currency', label: id ? 'Mata uang' : 'Currency' },
      {
        key: 'budget',
        kind: 'number',
        label: id ? 'Total anggaran' : 'Total budget',
        value: id ? 150000000 : 20000,
        min: 0,
        span: 2,
      },
      {
        key: 'categories',
        kind: 'list',
        label: id ? 'Kategori anggaran' : 'Budget categories',
        value: WEDDING_CATEGORIES[locale].join('\n'),
        max: CAT_ROWS,
      },
      {
        key: 'guests',
        kind: 'list',
        label: id ? 'Tamu (nama | kelompok | jumlah orang)' : 'Guests (name | group | people)',
        value: '',
        max: GUEST_ROWS,
        hint: id
          ? 'Opsional, misalnya "Keluarga Pak Budi | Keluarga pria | 4".'
          : 'Optional, for example "The Smiths | Partner 1 family | 4".',
      },
    ],
    note: id
      ? 'File sudah berisi checklist 25 langkah persiapan dari 12 bulan sebelum acara sampai gladi bersih. Tenggatnya otomatis menyesuaikan tanggal acara.'
      : 'The file comes with a 25-step checklist from 12 months before to the rehearsal. Deadlines follow your wedding date automatically.',
    sample: id
      ? {
          label: 'Isi contoh data',
          hint: '13 vendor dengan DP dan pelunasan, 120 undangan dengan RSVP, dan checklist berjalan, jadi dashboard langsung terisi.',
        }
      : {
          label: 'Include sample data',
          hint: '13 vendors with deposits and payments, 120 invitations with RSVPs, and a checklist in progress, so the dashboard is filled in.',
        },
  };
};

export const WEDDING_FORM: Record<Locale, TemplateForm> = { id: form('id'), en: form('en') };

export function buildFromForm(v: FormValues): Workbook {
  const now = new Date();
  const later = new Date(now.getTime() + 180 * 864e5);
  return buildWeddingWorkbook({
    locale: formChoice(v, 'locale', ['id', 'en'] as const, 'id'),
    partner1: formText(v, 'partner1', 60),
    partner2: formText(v, 'partner2', 60),
    date: formDate(v, 'date') ?? [later.getFullYear(), later.getMonth() + 1, later.getDate()],
    budget: formNumber(v, 'budget', 0, 0),
    currency: formChoice(v, 'currency', Object.keys(CURRENCIES) as Currency[], 'IDR'),
    categories: formList(v, 'categories'),
    guests: formList(v, 'guests'),
    sample: v.sample === true,
  });
}

export function buildWeddingWorkbook(opts: WeddingOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.secang;
  const st = makeStyles(accent, currency, locale);
  const money = sampleMoney(currency);
  const sample = opts.sample;
  const now = new Date();
  const todayX = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const date = sample ? todayX + 150 : excelDate(...opts.date);
  const p1 =
    opts.partner1.trim() || (sample ? t.sample.p1 : locale === 'id' ? 'Nama Pria' : 'Partner 1');
  const p2 =
    opts.partner2.trim() || (sample ? t.sample.p2 : locale === 'id' ? 'Nama Wanita' : 'Partner 2');
  const categories =
    sample || !cleanList(opts.categories, CAT_ROWS).length
      ? WEDDING_CATEGORIES[locale]
      : cleanList(opts.categories, CAT_ROWS);
  const groups = t.sample.groups;
  const YES = q(t.yes);

  const wb = new Workbook({
    title: `${t.name} – ${p1} & ${p2}`,
    subject: t.name,
    company: `${p1} & ${p2}`,
  });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shBud = wb.addSheet(S.budget, { tabColor: '3C6A33', ...landscape });
  const shPay = wb.addSheet(S.pay, { tabColor: '8F5E0A', ...landscape });
  const shGuest = wb.addSheet(S.guests, { tabColor: '2C4A86', ...landscape });
  const shTask = wb.addSheet(S.tasks, { tabColor: 'A8461F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const col = (sheet: string, c: string, last: number) =>
    ref(sheet, `$${c}$${FIRST}:$${c}$${last}`);
  const itemLast = FIRST + ITEM_ROWS - 1;
  const payLast = FIRST + PAY_ROWS - 1;
  const guestLast = FIRST + GUEST_ROWS - 1;
  const taskLast = FIRST + TASK_ROWS - 1;
  const smp = sample ? makeSample() : undefined;

  // ---------- Daftar ----------
  const lists: [string, string[], string][] = [
    ['B', t.sides, 'Sides'],
    ['C', t.invites, 'Invites'],
    ['D', t.rsvp, 'RsvpList'],
    ['E', [t.yes, t.no], 'YesNo'],
    ['F', t.terms, 'Terms'],
    ['G', MONTHS[locale].long, 'MonthNames'],
    ['H', MONTHS[locale].short, 'MonthShort'],
  ];
  for (const [c, items, name] of lists) {
    items.forEach((x, i) => shList.set(`${c}${i + 2}`, x));
    wb.defineName(name, ref(S.list, `$${c}$2:$${c}$${1 + items.length}`));
  }

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'H',
    menu,
  });
  shSet.widths({ B: 22, C: 34, D: 3, E: 28, F: 3, G: 26, H: 4 });
  const setVals: Record<string, string | number> = {
    Partner1: p1,
    Partner2: p2,
    WeddingDate: date,
    Venue: sample ? t.sample.venue : '',
    TotalBudget: sample ? money(150_000_000) : Math.max(0, opts.budget),
    CurrencyLabel: `${currency} (${CURRENCIES[currency].symbol})`,
  };
  t.set.forEach(([label, name, kind], i) => {
    const r = 5 + i;
    const style: Style =
      kind === 'date'
        ? st.inputDate
        : kind === 'money'
          ? st.inputMoney
          : kind === 'calc'
            ? st.calcText
            : st.inputText;
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, setVals[name], style).height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.set('E12', t.catsH, st.h2).set('E13', t.catsH, st.thLeft);
  for (let k = 0; k < CAT_ROWS; k++) shSet.set(`E${14 + k}`, categories[k] ?? null, st.inputText);
  wb.defineName('Categories', ref(S.set, `$E$14:$E$${13 + CAT_ROWS}`));
  shSet.set('G12', t.groupsH, st.h2).set('G13', t.groupsH, st.thLeft);
  for (let k = 0; k < GROUP_ROWS; k++) shSet.set(`G${14 + k}`, groups[k] ?? null, st.inputText);
  wb.defineName('Groups', ref(S.set, `$G$14:$G$${13 + GROUP_ROWS}`));

  // ---------- Anggaran ----------
  sheetHeader(shBud, st, {
    brand: t.brand,
    title: S.budget,
    subtitle: t.subtitle.budget,
    lastCol: 'L',
    menu,
  });
  const BC = 'BCDEFGHIJKL';
  [7, 22, 30, 22, 16, 14, 14, 14, 14, 12, 22].forEach((w, i) => shBud.width(BC[i], w));
  t.budget.forEach((h, i) =>
    shBud.set(`${BC[i]}${head}`, h, [1, 2, 3, 4, 10].includes(i) ? st.thLeft : st.th),
  );
  shBud.height(head, 28);
  const BS = { none: q(t.bStatus.none), dp: q(t.bStatus.dp), paid: q(t.bStatus.paid) };
  for (let r = FIRST; r <= itemLast; r++) {
    const it = smp?.items[r - FIRST];
    shBud
      .set(`B${r}`, `=IF($D${r}="","","A"&TEXT(ROW()-${head},"000"))`, st.calcCenter)
      .set(`C${r}`, it?.cat ?? null, st.inputText)
      .set(`D${r}`, it?.name ?? null, st.inputText)
      .set(`E${r}`, it?.vendor ?? null, st.inputText)
      .set(`F${r}`, null, st.inputText)
      .set(`G${r}`, it?.estimate ?? null, st.inputMoney)
      .set(`H${r}`, it?.deal || null, st.inputMoney)
      .set(`I${r}`, `=IF($B${r}="","",SUMIFS(PayAmount,PayItem,$B${r},PayDate,">0"))`, st.calcMoney)
      .set(`J${r}`, `=IF($B${r}="","",IF($H${r}="",N($G${r}),$H${r})-$I${r})`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(
        `K${r}`,
        `=IF($B${r}="","",IF($H${r}="",${BS.none},IF($J${r}<=0,${BS.paid},IF($I${r}>0,${BS.dp},${BS.none}))))`,
        st.calcCenter,
      )
      .set(`L${r}`, null, st.inputText);
  }
  const br = (c: string) => `${c}${FIRST}:${c}${itemLast}`;
  shBud.validate(br('C'), { type: 'list', formula1: '=Categories' });
  for (const c of ['G', 'H'])
    shBud.validate(br(c), { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  shBud.cond(br('H'), {
    type: 'expression',
    formula: `AND(ISNUMBER($H${FIRST}),ISNUMBER($G${FIRST}),$H${FIRST}>$G${FIRST})`,
    style: { font: { color: BAD, bold: true } },
  });
  shBud.cond(br('K'), {
    type: 'cellIs',
    operator: 'equal',
    formula: BS.paid,
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shBud.cond(br('K'), {
    type: 'cellIs',
    operator: 'equal',
    formula: BS.dp,
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shBud.freeze(`D${FIRST}`).autoFilter(`B${head}:L${itemLast}`);
  const budNames: [string, string][] = [
    ['ItemId', 'B'],
    ['ItemCat', 'C'],
    ['ItemName', 'D'],
    ['ItemEstimate', 'G'],
    ['ItemDeal', 'H'],
    ['ItemPaid', 'I'],
    ['ItemLeft', 'J'],
  ];
  for (const [n, c] of budNames) wb.defineName(n, col(S.budget, c, itemLast));

  // ---------- Pembayaran ----------
  sheetHeader(shPay, st, {
    brand: t.brand,
    title: S.pay,
    subtitle: t.subtitle.pay,
    lastCol: 'I',
    menu,
  });
  const PC = 'BCDEFGHI';
  [11, 30, 14, 13, 15, 13, 14, 12].forEach((w, i) => shPay.width(PC[i], w));
  shPay.width('J', 6, true).width('K', 6, true);
  t.pay.forEach((h, i) => shPay.set(`${PC[i]}${head}`, h, i === 1 ? st.thLeft : st.th));
  shPay.set(`J${head}`, '#').set(`K${head}`, '#').height(head, 28);
  const PS = {
    paid: q(t.pStatus.paid),
    late: q(t.pStatus.late),
    soon: q(t.pStatus.soon),
    plan: q(t.pStatus.plan),
  };
  for (let r = FIRST; r <= payLast; r++) {
    const p = smp?.pays[r - FIRST];
    shPay
      .set(`B${r}`, p?.item ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(
        `C${r}`,
        `=IF($B${r}="","",IFERROR(INDEX(ItemName,MATCH($B${r},ItemId,0)),"?"))`,
        st.calcText,
      )
      .set(`D${r}`, p?.term ?? null, st.inputText)
      .set(`E${r}`, p?.due ?? null, st.inputDate)
      .set(`F${r}`, p?.amount ?? null, st.inputMoney)
      .set(`G${r}`, p?.paidOn ?? null, st.inputDate)
      .set(`H${r}`, p?.paidOn ? 'Transfer' : null, st.inputText)
      .set(
        `I${r}`,
        `=IF($F${r}="","",IF($G${r}<>"",${PS.paid},IF($E${r}="",${PS.plan},IF($E${r}<TODAY(),${PS.late},IF($E${r}<=TODAY()+14,${PS.soon},${PS.plan})))))`,
        st.calcCenter,
      )
      // Bantu: bulan jatuh tempo (yyyymm) dan urutan pembayaran tertunda untuk dashboard.
      .set(`J${r}`, `=IF(OR($E${r}="",$F${r}=""),"",YEAR($E${r})*100+MONTH($E${r}))`)
      .set(`K${r}`, `=IF(AND($F${r}<>"",$G${r}=""),N(K${r - 1})+1,N(K${r - 1}))`);
  }
  const pr = (c: string) => `${c}${FIRST}:${c}${payLast}`;
  shPay.validate(pr('B'), { type: 'list', formula1: '=ItemId', errorStyle: 'warning' });
  shPay.validate(pr('D'), { type: 'list', formula1: '=Terms', errorStyle: 'warning' });
  for (const c of ['E', 'G'])
    shPay.validate(pr(c), {
      type: 'date',
      operator: 'between',
      formula1: 'DATE(2000,1,1)',
      formula2: 'DATE(2100,12,31)',
      errorStyle: 'warning',
    });
  shPay.validate(pr('F'), { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  for (const [s, fill, color] of [
    [PS.paid, GOOD_BG, GOOD],
    [PS.late, BAD_BG, BAD],
    [PS.soon, WARN_BG, WARN],
  ] as const)
    shPay.cond(pr('I'), {
      type: 'cellIs',
      operator: 'equal',
      formula: s,
      style: { fill, font: { color, bold: true } },
    });
  shPay.freeze(`D${FIRST}`).autoFilter(`B${head}:I${payLast}`);
  const payNames: [string, string][] = [
    ['PayItem', 'B'],
    ['PayItemName', 'C'],
    ['PayTerm', 'D'],
    ['PayDue', 'E'],
    ['PayAmount', 'F'],
    ['PayDate', 'G'],
    ['PayStatus', 'I'],
    ['PayMonth', 'J'],
    ['PaySeq', 'K'],
  ];
  for (const [n, c] of payNames) wb.defineName(n, col(S.pay, c, payLast));

  // ---------- Tamu ----------
  sheetHeader(shGuest, st, {
    brand: t.brand,
    title: S.guests,
    subtitle: t.subtitle.guests,
    lastCol: 'K',
    menu,
  });
  const GC = 'BCDEFGHIJK';
  [28, 11, 18, 9, 10, 9, 12, 24, 10, 20].forEach((w, i) => shGuest.width(GC[i], w));
  t.guests.forEach((h, i) =>
    shGuest.set(`${GC[i]}${head}`, h, [0, 2, 7, 9].includes(i) ? st.thLeft : st.th),
  );
  shGuest.height(head, 26);
  const guests =
    smp?.guests ??
    opts.guests
      .map((l) => l.split('|').map((x) => x.replace(/\s+/g, ' ').trim()))
      .filter((g) => g[0])
      .slice(0, GUEST_ROWS)
      .map(([name, group, pax]) => ({
        name: name.slice(0, 60),
        side: '',
        group: group ?? '',
        pax: Number(pax) || 1,
        invite: '',
        sent: '',
        rsvp: '',
      }));
  for (let r = FIRST; r <= guestLast; r++) {
    const g = guests[r - FIRST];
    const center = { ...st.inputText, align: { h: 'center' as const } };
    shGuest
      .set(`B${r}`, g?.name ?? null, st.inputText)
      .set(`C${r}`, g?.side || null, center)
      .set(`D${r}`, g?.group || null, st.inputText)
      .set(`E${r}`, g ? g.pax : null, st.inputInt)
      .set(`F${r}`, g?.invite || null, center)
      .set(`G${r}`, g?.sent || null, center)
      .set(`H${r}`, g?.rsvp || null, center)
      .set(`I${r}`, null, st.inputText)
      .set(`J${r}`, null, center)
      .set(`K${r}`, null, st.inputText);
  }
  const gr = (c: string) => `${c}${FIRST}:${c}${guestLast}`;
  shGuest.validate(gr('C'), { type: 'list', formula1: '=Sides' });
  shGuest.validate(gr('D'), { type: 'list', formula1: '=Groups', errorStyle: 'warning' });
  shGuest.validate(gr('E'), { type: 'whole', operator: 'between', formula1: '1', formula2: '50' });
  shGuest.validate(gr('F'), { type: 'list', formula1: '=Invites' });
  shGuest.validate(gr('G'), { type: 'list', formula1: '=YesNo' });
  shGuest.validate(gr('H'), { type: 'list', formula1: '=RsvpList' });
  shGuest.cond(gr('H'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.rsvp[0]),
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shGuest.cond(gr('H'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.rsvp[1]),
    style: { font: { color: '9A9083', italic: true } },
  });
  shGuest.cond(gr('G'), {
    type: 'cellIs',
    operator: 'equal',
    formula: q(t.no),
    style: { fill: WARN_BG },
  });
  shGuest.freeze(`C${FIRST}`).autoFilter(`B${head}:K${guestLast}`);
  wb.defineName('GuestName', col(S.guests, 'B', guestLast));
  wb.defineName('GuestGroup', col(S.guests, 'D', guestLast));
  wb.defineName('GuestPax', col(S.guests, 'E', guestLast));
  wb.defineName('GuestRsvp', col(S.guests, 'H', guestLast));

  // ---------- Checklist ----------
  sheetHeader(shTask, st, {
    brand: t.brand,
    title: S.tasks,
    subtitle: t.subtitle.tasks,
    lastCol: 'I',
    menu,
  });
  const TC = 'BCDEFGHI';
  [38, 20, 10, 13, 16, 9, 12, 22].forEach((w, i) => shTask.width(TC[i], w));
  shTask.width('J', 6, true);
  t.tasks.forEach((h, i) =>
    shTask.set(`${TC[i]}${head}`, h, [0, 1, 4, 7].includes(i) ? st.thLeft : st.th),
  );
  shTask.set(`J${head}`, '#').height(head, 28);
  const TS = {
    done: q(t.tStatus.done),
    late: q(t.tStatus.late),
    soon: q(t.tStatus.soon),
    later: q(t.tStatus.later),
  };
  for (let r = FIRST; r <= taskLast; r++) {
    const tk = TASKS[r - FIRST];
    const done = smp?.done.has(r - FIRST);
    shTask
      .set(`B${r}`, tk ? (locale === 'id' ? tk[0] : tk[1]) : null, st.inputText)
      .set(`C${r}`, tk ? categories[Math.min(tk[2], categories.length - 1)] : null, st.inputText)
      .set(`D${r}`, tk ? tk[3] : null, st.inputInt)
      .set(
        `E${r}`,
        `=IF(OR($B${r}="",$D${r}=""),"",IF(N($D${r})=0,WeddingDate-7,EDATE(WeddingDate,-$D${r})))`,
        st.calcDate,
      )
      .set(
        `F${r}`,
        tk && sample
          ? r % 3 === 0
            ? p2
            : r % 3 === 1
              ? p1
              : locale === 'id'
                ? 'Berdua'
                : 'Both'
          : null,
        st.inputText,
      )
      .set(`G${r}`, tk ? (done ? t.yes : t.no) : null, { ...st.inputText, align: { h: 'center' } })
      .set(
        `H${r}`,
        `=IF($B${r}="","",IF($G${r}=${YES},${TS.done},IF($E${r}="",${TS.later},IF($E${r}<TODAY(),${TS.late},IF($E${r}<=TODAY()+14,${TS.soon},${TS.later})))))`,
        st.calcCenter,
      )
      .set(`I${r}`, null, st.inputText)
      .set(`J${r}`, `=IF(OR($B${r}="",$G${r}=${YES}),"",N($E${r})+(ROW()/100000))`);
  }
  const tr = (c: string) => `${c}${FIRST}:${c}${taskLast}`;
  shTask.validate(tr('C'), { type: 'list', formula1: '=Categories', errorStyle: 'warning' });
  shTask.validate(tr('D'), {
    type: 'whole',
    operator: 'between',
    formula1: '0',
    formula2: '24',
    prompt: t.monthsMsg,
  });
  shTask.validate(tr('G'), { type: 'list', formula1: '=YesNo' });
  for (const [s, fill, color] of [
    [TS.done, GOOD_BG, GOOD],
    [TS.late, BAD_BG, BAD],
    [TS.soon, WARN_BG, WARN],
  ] as const)
    shTask.cond(tr('H'), {
      type: 'cellIs',
      operator: 'equal',
      formula: s,
      style: { fill, font: { color, bold: true } },
    });
  shTask.cond(`B${FIRST}:B${taskLast}`, {
    type: 'expression',
    formula: `$G${FIRST}=${YES}`,
    style: { font: { color: '9A9083', italic: true } },
  });
  shTask.freeze(`C${FIRST}`).autoFilter(`B${head}:I${taskLast}`);
  wb.defineName('TaskName', col(S.tasks, 'B', taskLast));
  wb.defineName('TaskOwner', col(S.tasks, 'F', taskLast));
  wb.defineName('TaskDue', col(S.tasks, 'E', taskLast));
  wb.defineName('TaskDone', col(S.tasks, 'G', taskLast));
  wb.defineName('TaskStatus', col(S.tasks, 'H', taskLast));
  wb.defineName('TaskKey', col(S.tasks, 'J', taskLast));

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of 'OPQRS') shDash.width(c, 6, true);
  shDash.set('B2', `=Partner1&" & "&Partner2`, st.title);
  shDash
    .merge(
      'B5:J5',
      `=DAY(WeddingDate)&" "&INDEX(MonthNames,MONTH(WeddingDate))&" "&YEAR(WeddingDate)&IF(Venue="",""," · "&Venue)`,
      { ...st.label, align: { v: 'center' } },
    )
    .height(5, 22)
    .height(6, 8)
    .height(10, 10);
  // Total yang sudah terikat: harga deal, atau estimasi untuk kebutuhan yang belum deal.
  const committed = 'SUMIFS(ItemDeal,ItemId,"?*")+SUMIFS(ItemEstimate,ItemId,"?*",ItemDeal,"")';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kCountdown,
    value: '=MAX(0,WeddingDate-TODAY())',
    note: `=IF(WeddingDate-TODAY()<0,"",ROUND((WeddingDate-TODAY())/7,0)&${q(locale === 'id' ? ' minggu lagi' : ' weeks to go')})`,
    numFmt: `#,##0${q(t.days)}`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kBudget,
    value: '=TotalBudget',
    note: `=IF(${committed}>TotalBudget,${q(t.overNote)}&TEXT(${committed}-TotalBudget,"#,##0"),${q(t.dealNote)}&TEXT(SUM(ItemDeal),"#,##0"))`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kPaid,
    value: '=SUM(ItemPaid)',
    note: '=IF(N(TotalBudget)=0,"",TEXT(SUM(ItemPaid)/TotalBudget,"0%"))',
  });
  kpiCard(shDash, st, { col: 'K', toCol: 'M', row: 7, label: t.kLeft, value: '=SUM(ItemLeft)' });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kInvited,
    value: '=SUM(GuestPax)',
    note: `=COUNTA(GuestName)&${q(t.inviteNote)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kConfirmed,
    value: `=SUMIFS(GuestPax,GuestRsvp,${q(t.rsvp[0])})`,
    note: `=SUMIFS(GuestPax,GuestName,"?*",GuestRsvp,"<>"&${q(t.rsvp[0])})-SUMIFS(GuestPax,GuestRsvp,${q(t.rsvp[1])})&${q(t.pending)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kTasks,
    value: `=IF(COUNTA(TaskName)=0,0,COUNTIF(TaskDone,${YES})/COUNTA(TaskName))`,
    note: `=COUNTIF(TaskStatus,${TS.late})&${q(t.taskNote)}`,
    numFmt: '0%',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kDue,
    value: '=SUMIFS(PayAmount,PayDate,"",PayDue,"<="&(TODAY()+30))',
  });
  shDash.cond('E9:G9', {
    type: 'expression',
    formula: `${committed}>TotalBudget`,
    style: { font: { color: BAD, bold: true } },
  });
  shDash.cond('H12:J12', {
    type: 'expression',
    formula: `COUNTIF(TaskStatus,${TS.late})>0`,
    style: { font: { color: BAD, bold: true } },
  });
  const nCat = Math.max(1, categories.length);
  for (let k = 0; k < nCat; k++) {
    const r = 16 + k;
    const cat = `INDEX(Categories,${k + 1})`;
    shDash
      .set(`O${r}`, `=IF(${cat}="","",${cat})`)
      .set(`P${r}`, `=IF(O${r}="",0,SUMIFS(ItemEstimate,ItemCat,O${r}))`)
      .set(`Q${r}`, `=IF(O${r}="",0,SUMIFS(ItemDeal,ItemCat,O${r}))`);
  }
  shDash.chart({
    type: 'bar',
    title: t.chartBudget,
    from: 'B15',
    to: 'H36',
    numFmt: '#,##0',
    series: [
      {
        name: t.estimate,
        categories: ref(S.dash, `$O$16:$O$${15 + nCat}`),
        values: ref(S.dash, `$P$16:$P$${15 + nCat}`),
        color: 'C9BFAE',
      },
      {
        name: t.deal,
        categories: ref(S.dash, `$O$16:$O$${15 + nCat}`),
        values: ref(S.dash, `$Q$16:$Q$${15 + nCat}`),
        color: accent.main,
      },
    ],
  });
  for (let k = 0; k < groups.length; k++) {
    const r = 40 + k;
    const gname = `INDEX(Groups,${k + 1})`;
    shDash
      .set(`O${r}`, `=IF(${gname}="","",${gname})`)
      .set(`P${r}`, `=IF(O${r}="",0,SUMIFS(GuestPax,GuestGroup,O${r},GuestRsvp,${q(t.rsvp[0])}))`)
      .set(`Q${r}`, `=IF(O${r}="",0,SUMIFS(GuestPax,GuestGroup,O${r})-P${r}-R${r})`)
      .set(`R${r}`, `=IF(O${r}="",0,SUMIFS(GuestPax,GuestGroup,O${r},GuestRsvp,${q(t.rsvp[1])}))`);
  }
  const gEnd = 39 + groups.length;
  shDash.chart({
    type: 'column',
    title: t.chartGuests,
    from: 'H15',
    to: 'N36',
    numFmt: '0',
    stacked: true,
    series: [
      {
        name: t.attending,
        categories: ref(S.dash, `$O$40:$O$${gEnd}`),
        values: ref(S.dash, `$P$40:$P$${gEnd}`),
        color: '3C6A33',
      },
      {
        name: t.notYet,
        categories: ref(S.dash, `$O$40:$O$${gEnd}`),
        values: ref(S.dash, `$Q$40:$Q$${gEnd}`),
        color: 'C9BFAE',
      },
      {
        name: t.declined,
        categories: ref(S.dash, `$O$40:$O$${gEnd}`),
        values: ref(S.dash, `$R$40:$R$${gEnd}`),
        color: CHART_COLORS[4],
      },
    ],
  });
  // Pembayaran per bulan: 8 bulan mulai bulan ini (kolom bantu S:T... memakai O:P baris 55+)
  for (let k = 0; k < 8; k++) {
    const r = 55 + k;
    const ym = `(YEAR(EDATE(TODAY(),${k}))*100+MONTH(EDATE(TODAY(),${k})))`;
    shDash
      .set(
        `O${r}`,
        `=INDEX(MonthShort,MONTH(EDATE(TODAY(),${k})))&" "&RIGHT(YEAR(EDATE(TODAY(),${k})),2)`,
      )
      .set(`P${r}`, `=SUMIFS(PayAmount,PayMonth,${ym})`);
  }
  shDash.chart({
    type: 'column',
    title: t.chartTasks,
    from: 'B38',
    to: 'H56',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.payLabel,
        categories: ref(S.dash, '$O$55:$O$62'),
        values: ref(S.dash, '$P$55:$P$62'),
        color: accent.main,
      },
    ],
  });
  // Tugas terdekat (belum selesai, tenggat paling awal) dan pembayaran tertunda terdekat.
  shDash.merge('I38:M38', t.nextTasksH, st.h2);
  shDash
    .merge('I39:K39', t.nextTasksHead[0], st.thLeft)
    .set('L39', t.nextTasksHead[1], st.thLeft)
    .set('M39', t.nextTasksHead[2], st.th)
    .height(39, 24);
  for (let k = 1; k <= 8; k++) {
    const r = 39 + k;
    const ix = (n: string) => `IF($S${r}="","",INDEX(${n},$S${r}))`;
    shDash
      .set(`S${r}`, `=IFERROR(MATCH(SMALL(TaskKey,${k}),TaskKey,0),"")`)
      .merge(
        `I${r}:K${r}`,
        k === 1 ? `=IF($S${r}="",${q(t.noTasks)},INDEX(TaskName,$S${r}))` : `=${ix('TaskName')}`,
        st.rowLabel,
      )
      .set(`L${r}`, `=IF($S${r}="","",INDEX(TaskOwner,$S${r})&"")`, st.rowLabel)
      .set(`M${r}`, `=${ix('TaskDue')}`, {
        ...st.rowMoney,
        numFmt: 'dd/mm/yy',
        align: { h: 'center' },
      });
  }
  shDash.cond('M40:M47', {
    type: 'expression',
    formula: 'AND(ISNUMBER(M40),M40<TODAY())',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shDash.merge('I49:M49', t.nextPayH, st.h2);
  shDash
    .merge('I50:J50', t.nextPayHead[0], st.thLeft)
    .set('K50', t.nextPayHead[1], st.thLeft)
    .set('L50', t.nextPayHead[2], st.th)
    .set('M50', t.nextPayHead[3], st.th)
    .height(50, 24);
  for (let k = 1; k <= 6; k++) {
    const r = 50 + k;
    const ix = (n: string) => `IF($S${r}="","",INDEX(${n},$S${r}))`;
    shDash
      .set(`S${r}`, `=IFERROR(MATCH(${k},PaySeq,0),"")`)
      .merge(
        `I${r}:J${r}`,
        k === 1
          ? `=IF($S${r}="",${q(t.noPay)},INDEX(PayItemName,$S${r}))`
          : `=${ix('PayItemName')}`,
        st.rowLabel,
      )
      .set(`K${r}`, `=IF($S${r}="","",INDEX(PayTerm,$S${r})&"")`, st.rowLabel)
      .set(`L${r}`, `=${ix('PayDue')}`, {
        ...st.rowMoney,
        numFmt: 'dd/mm/yy',
        align: { h: 'center' },
      })
      .set(`M${r}`, `=${ix('PayAmount')}`, st.rowMoney);
  }
  shDash.cond('L51:L56', {
    type: 'expression',
    formula: 'AND(ISNUMBER(L51),L51<TODAY())',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: `=Partner1&" & "&Partner2&" · "&DAY(WeddingDate)&" "&INDEX(MonthNames,MONTH(WeddingDate))&" "&YEAR(WeddingDate)`,
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.budget, t.desc.budget],
      [S.pay, t.desc.pay],
      [S.guests, t.desc.guests],
      [S.tasks, t.desc.tasks],
      [S.set, t.desc.set],
    ],
  });
  return wb;

  function makeSample() {
    const rnd = seeded(77);
    const items = ITEMS.map(([ci, id, en, vendor, est, deal]) => ({
      cat: categories[ci],
      name: locale === 'id' ? id : en,
      vendor,
      estimate: money(est),
      deal: deal ? money(deal) : 0,
    }));
    const pays: { item: string; term: string; due: number; amount: number; paidOn?: number }[] = [];
    ITEMS.forEach(([, , , , , deal, part], i) => {
      if (!deal) return;
      const id = `A${String(i + 1).padStart(3, '0')}`;
      const total = money(deal);
      const dp = part >= 1 ? total : Math.round((total * (part || 0.3)) / 1000) * 1000 || total;
      // DP yang sudah dibayar jatuh tempo di masa lalu; DP yang belum dibayar 1-3 minggu lagi.
      const dpDue = part > 0 ? todayX - 60 + i * 5 : todayX + 7 + i;
      pays.push({
        item: id,
        term: t.terms[0],
        due: dpDue,
        amount: dp,
        paidOn: part > 0 ? dpDue - 2 : undefined,
      });
      if (dp < total)
        pays.push({ item: id, term: t.terms[2], due: date - 14 - (i % 3) * 7, amount: total - dp });
    });
    // Satu DP sengaja lewat jatuh tempo agar peringatannya terlihat.
    const late = pays.find((p) => !p.paidOn && p.term === t.terms[0]);
    if (late) late.due = todayX - 3;
    pays.sort((a, b) => a.due - b.due);
    const guests: {
      name: string;
      side: string;
      group: string;
      pax: number;
      invite: string;
      sent: string;
      rsvp: string;
    }[] = [];
    for (let i = 0; i < 120; i++) {
      const gi = i % groups.length;
      const r = rnd();
      guests.push({
        name: `${gi < 2 ? (locale === 'id' ? 'Keluarga ' : 'The ') : ''}${t.sample.first[i % 16]} ${t.sample.last[(i * 3) % 8]}`,
        side: t.sides[gi % 2 === 0 ? 0 : 1],
        group: groups[gi],
        pax: gi < 2 ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2),
        invite: t.invites[rnd() < 0.6 ? 1 : 0],
        sent: rnd() < 0.75 ? t.yes : t.no,
        rsvp: r < 0.45 ? t.rsvp[0] : r < 0.52 ? t.rsvp[1] : t.rsvp[2],
      });
    }
    // Checklist: tugas dengan tenggat yang sudah lewat kebanyakan selesai (satu masih tertunda).
    const done = new Set<number>();
    TASKS.forEach(([, , , months], i) => {
      const deadline = months === 0 ? date - 7 : date - months * 30.4;
      if (deadline < todayX && i !== 7) done.add(i);
    });
    return { items, pays, guests, done };
  }
}
