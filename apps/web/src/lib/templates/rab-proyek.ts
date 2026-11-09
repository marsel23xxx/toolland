/**
 * Template RAB Proyek / Renovasi: harga dasar bahan-upah-alat, analisa harga satuan (koefisien),
 * RAB per bab, rekapitulasi dengan PPN dan pembulatan, realisasi biaya, kurva S mingguan, dan
 * dashboard. Harga satuan pekerjaan = jumlah (koefisien x harga dasar) x (1 + overhead & profit).
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

export interface RabOptions {
  locale: Locale;
  project: string;
  currency: Currency;
  start: [number, number, number];
  weeks: number;
  overhead: number;
  vat: number;
  sections: string[];
  sample: boolean;
}

const FIRST = 6;
const BASE_ROWS = 200;
const AN_ROWS = 80;
const COMP_ROWS = 600;
const RAB_ROWS = 300;
const ACT_ROWS = 1000;
const MAX_WEEKS = 52;
const MAX_SECTIONS = 20;
const ITEM_FIRST = 13; // baris item pertama di sheet Kurva S

const L = {
  id: {
    brand: 'TOOLLAND · RAB PROYEK',
    name: 'RAB Proyek / Renovasi',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      recap: 'Rekapitulasi',
      rab: 'RAB',
      an: 'Analisa Harga',
      base: 'Harga Dasar',
      act: 'Realisasi',
      curve: 'Kurva S',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Nilai RAB, realisasi biaya, sisa anggaran, progres fisik, deviasi jadwal, dan kurva S.',
      recap: 'Ringkasan RAB per bab dengan PPN dan pembulatan, siap dilampirkan.',
      rab: 'Daftar pekerjaan per bab: volume, harga satuan dari analisa, jumlah, bobot, realisasi, dan progres.',
      an: 'Analisa harga satuan pekerjaan: komponen bahan, upah, dan alat beserta koefisiennya.',
      base: 'Harga dasar bahan, upah tenaga kerja, dan sewa alat.',
      act: 'Catatan biaya yang benar-benar keluar per pekerjaan.',
      curve: 'Jadwal mingguan otomatis dari minggu mulai dan durasi, kurva S rencana vs realisasi.',
      set: 'Nama proyek, lokasi, tanggal mulai, durasi, overhead & profit, PPN, dan daftar bab.',
    },
    subtitle: {
      menu: 'Hitung Rencana Anggaran Biaya dari harga bahan dan upah, lalu pantau biaya dan progres proyek.',
      recap: 'Dihitung otomatis dari sheet RAB. Tidak perlu diisi.',
      rab: 'Satu baris per pekerjaan. Pilih bab dan kode analisa; harga satuan terisi otomatis atau isi harga manual.',
      an: 'Kiri: daftar analisa. Kanan: komponen tiap analisa (kode harga dasar x koefisien). Overhead & profit diatur di Pengaturan.',
      base: 'Isi harga sesuai harga di daerahmu. Semua analisa dan RAB ikut berubah.',
      act: 'Satu baris per pengeluaran. Pilih ID pekerjaan dari sheet RAB.',
      curve:
        'Isi minggu mulai dan durasi tiap pekerjaan. Isi progres realisasi kumulatif tiap minggu di baris Realisasi.',
      set: 'Atur sekali di awal.',
      dash: 'Ringkasan proyek hari ini.',
    },
    steps: [
      'Isi Pengaturan dan sesuaikan Harga Dasar dengan harga bahan dan upah di daerahmu.',
      'Susun Analisa Harga (atau pakai contoh), lalu tulis pekerjaan dan volumenya di sheet RAB.',
      'Atur jadwal di Kurva S, catat biaya di Realisasi, dan perbarui progres fisik setiap minggu.',
    ],
    types: ['Bahan', 'Upah', 'Alat'],
    set: [
      ['Nama proyek', 'ProjectName', 'text'],
      ['Lokasi', 'ProjectSite', 'text'],
      ['Pemilik', 'ProjectOwner', 'text'],
      ['Pelaksana', 'ProjectBuilder', 'text'],
      ['Tanggal mulai', 'ProjectStart', 'date'],
      ['Durasi (minggu)', 'ProjectWeeks', 'int'],
      ['Overhead & profit (%)', 'Overhead', 'pct'],
      ['PPN (%)', 'VatRate', 'pct'],
      ['Mata uang', 'CurrencyLabel', 'calc'],
    ] as [string, string, string][],
    sectionsH: 'Daftar bab pekerjaan',
    sectionName: 'Nama bab',
    base: ['Kode', 'Jenis', 'Uraian', 'Satuan', 'Harga', 'Keterangan', 'Dipakai di analisa'],
    an: ['Kode', 'Uraian pekerjaan', 'Satuan', 'Bahan', 'Upah', 'Alat', 'Harga satuan'],
    comp: [
      'Kode analisa',
      'Kode harga',
      'Koefisien',
      'Uraian komponen',
      'Satuan',
      'Harga dasar',
      'Jumlah',
      'Jenis',
    ],
    rab: [
      'ID',
      'Bab',
      'Uraian pekerjaan',
      'Kode analisa',
      'Volume',
      'Satuan',
      'Harga manual',
      'Harga satuan',
      'Jumlah',
      'Bobot',
      'Realisasi',
      'Sisa',
      'Progres fisik',
    ],
    rabNote: 'Kode analisa kosong? Isi Harga manual untuk pekerjaan borongan atau lump sum.',
    recap: ['No', 'Bab pekerjaan', 'Jumlah', 'Bobot', 'Realisasi', 'Sisa'],
    total: 'Jumlah',
    vat: 'PPN',
    grand: 'TOTAL',
    rounded: 'Dibulatkan',
    act: ['Tanggal', 'ID pekerjaan', 'Uraian pekerjaan', 'Keterangan', 'Toko / vendor', 'Jumlah'],
    curveHead: ['ID', 'Uraian pekerjaan', 'Bobot', 'Minggu mulai', 'Durasi (minggu)'],
    planWeek: 'Rencana per minggu',
    planCum: 'Rencana kumulatif',
    actualCum: 'Realisasi kumulatif (isi)',
    deviation: 'Deviasi',
    weekLabel: 'M',
    kBudget: 'Nilai RAB',
    kSpent: 'Realisasi biaya',
    kLeft: 'Sisa anggaran',
    kProgress: 'Progres fisik',
    kPlan: 'Rencana s.d. minggu ini',
    kDev: 'Deviasi jadwal',
    kWeek: 'Minggu berjalan',
    kCostPerf: 'Biaya vs progres',
    inclVat: 'Termasuk PPN',
    usedNote: ' anggaran terpakai',
    ofWeeks: ' dari ',
    weeksWord: ' minggu',
    ahead: 'Lebih cepat dari rencana',
    behind: 'Terlambat dari rencana',
    onPlan: 'Sesuai rencana',
    costNote: 'Biaya terpakai dibanding progres fisik',
    chartCurve: 'Kurva S: rencana vs realisasi',
    chartSections: 'Anggaran vs realisasi per bab',
    chartMix: 'Komposisi biaya',
    plan: 'Rencana',
    actual: 'Realisasi',
    budget: 'Anggaran',
    mixLabels: ['Bahan', 'Upah', 'Alat', 'Harga manual'],
    sample: {
      project: 'Renovasi & Tambah Kamar Rumah Bu Sari',
      site: 'Jl. Melati No. 8, Sleman',
      owner: 'Ibu Sari',
      builder: 'CV Bangun Karya',
      note: 'Belanja material',
      shops: ['TB Sumber Rejeki', 'TB Maju Jaya', 'Upah mingguan'],
    },
  },
  en: {
    brand: 'TOOLLAND · CONSTRUCTION BUDGET',
    name: 'Construction Cost Estimate',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      recap: 'Summary',
      rab: 'Bill of Quantities',
      an: 'Unit Price Analysis',
      base: 'Base Prices',
      act: 'Actual Costs',
      curve: 'S-Curve',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Budget, actual cost, remaining budget, physical progress, schedule deviation, and S-curve.',
      recap: 'Budget summary by section with tax and rounding, ready to attach.',
      rab: 'Work items by section: quantity, unit price from analysis, amount, weight, actual cost, and progress.',
      an: 'Unit price analysis: material, labour, and equipment components with coefficients.',
      base: 'Base prices for materials, labour, and equipment hire.',
      act: 'Costs actually spent per work item.',
      curve: 'Automatic weekly schedule from start week and duration, planned vs actual S-curve.',
      set: 'Project name, site, start date, duration, overhead & profit, tax, and section list.',
    },
    subtitle: {
      menu: 'Build a cost estimate from material and labour prices, then track project cost and progress.',
      recap: 'Calculated from the Bill of Quantities. Nothing to fill in.',
      rab: 'One row per work item. Pick a section and analysis code; the unit price fills in, or enter a manual price.',
      an: 'Left: analysis list. Right: components of each analysis (base price code x coefficient). Overhead & profit is set in Settings.',
      base: 'Enter prices for your area. Every analysis and estimate updates.',
      act: 'One row per expense. Pick the work item ID from the Bill of Quantities.',
      curve:
        'Enter the start week and duration of each item. Enter cumulative actual progress each week in the Actual row.',
      set: 'Set this up once.',
      dash: 'Project summary as of today.',
    },
    steps: [
      'Fill in Settings and adjust Base Prices to material and labour prices in your area.',
      'Build the Unit Price Analysis (or use the examples), then list work items and quantities.',
      'Schedule items in the S-Curve, record costs in Actual Costs, and update progress every week.',
    ],
    types: ['Material', 'Labour', 'Equipment'],
    set: [
      ['Project name', 'ProjectName', 'text'],
      ['Site', 'ProjectSite', 'text'],
      ['Owner', 'ProjectOwner', 'text'],
      ['Contractor', 'ProjectBuilder', 'text'],
      ['Start date', 'ProjectStart', 'date'],
      ['Duration (weeks)', 'ProjectWeeks', 'int'],
      ['Overhead & profit (%)', 'Overhead', 'pct'],
      ['Tax (%)', 'VatRate', 'pct'],
      ['Currency', 'CurrencyLabel', 'calc'],
    ] as [string, string, string][],
    sectionsH: 'Work sections',
    sectionName: 'Section name',
    base: ['Code', 'Type', 'Description', 'Unit', 'Price', 'Notes', 'Used in analyses'],
    an: ['Code', 'Work item', 'Unit', 'Material', 'Labour', 'Equipment', 'Unit price'],
    comp: [
      'Analysis code',
      'Price code',
      'Coefficient',
      'Component',
      'Unit',
      'Base price',
      'Amount',
      'Type',
    ],
    rab: [
      'ID',
      'Section',
      'Work item',
      'Analysis code',
      'Quantity',
      'Unit',
      'Manual price',
      'Unit price',
      'Amount',
      'Weight',
      'Actual',
      'Remaining',
      'Progress',
    ],
    rabNote: 'No analysis code? Enter a Manual price for lump-sum or subcontracted items.',
    recap: ['No', 'Work section', 'Amount', 'Weight', 'Actual', 'Remaining'],
    total: 'Subtotal',
    vat: 'Tax',
    grand: 'TOTAL',
    rounded: 'Rounded',
    act: ['Date', 'Work item ID', 'Work item', 'Notes', 'Supplier', 'Amount'],
    curveHead: ['ID', 'Work item', 'Weight', 'Start week', 'Duration (weeks)'],
    planWeek: 'Planned per week',
    planCum: 'Planned cumulative',
    actualCum: 'Actual cumulative (enter)',
    deviation: 'Deviation',
    weekLabel: 'W',
    kBudget: 'Budget',
    kSpent: 'Actual cost',
    kLeft: 'Budget left',
    kProgress: 'Physical progress',
    kPlan: 'Planned to date',
    kDev: 'Schedule deviation',
    kWeek: 'Current week',
    kCostPerf: 'Cost vs progress',
    inclVat: 'Including tax',
    usedNote: ' of budget used',
    ofWeeks: ' of ',
    weeksWord: ' weeks',
    ahead: 'Ahead of plan',
    behind: 'Behind plan',
    onPlan: 'On plan',
    costNote: 'Cost spent compared with physical progress',
    chartCurve: 'S-curve: planned vs actual',
    chartSections: 'Budget vs actual by section',
    chartMix: 'Cost breakdown',
    plan: 'Planned',
    actual: 'Actual',
    budget: 'Budget',
    mixLabels: ['Material', 'Labour', 'Equipment', 'Manual price'],
    sample: {
      project: 'House Renovation & Room Extension',
      site: '8 Melati Street, Sleman',
      owner: 'Mrs. Sari',
      builder: 'Bangun Karya Builders',
      note: 'Materials',
      shops: ['Sumber Rejeki Hardware', 'Maju Jaya Hardware', 'Weekly wages'],
    },
  },
};

/** Contoh harga dasar: kode, jenis (0 bahan, 1 upah, 2 alat), uraian id/en, satuan id/en, harga Rp. */
const BASE: [string, number, string, string, string, string, number][] = [
  ['M01', 0, 'Semen PC 50 kg', 'Cement 50 kg', 'zak', 'bag', 72_000],
  ['M02', 0, 'Pasir pasang', 'Building sand', 'm3', 'm3', 320_000],
  ['M03', 0, 'Bata merah', 'Red brick', 'bh', 'pcs', 900],
  ['M04', 0, 'Kerikil / split', 'Gravel', 'm3', 'm3', 380_000],
  ['M05', 0, 'Besi beton polos 10 mm', 'Rebar 10 mm', 'kg', 'kg', 13_500],
  ['M06', 0, 'Kawat bendrat', 'Tie wire', 'kg', 'kg', 25_000],
  ['M07', 0, 'Kayu bekisting', 'Formwork timber', 'm3', 'm3', 2_500_000],
  ['M08', 0, 'Paku', 'Nails', 'kg', 'kg', 22_000],
  ['M09', 0, 'Keramik 40x40', 'Floor tile 40x40', 'm2', 'm2', 85_000],
  ['M10', 0, 'Plamir tembok', 'Wall putty', 'kg', 'kg', 15_000],
  ['M11', 0, 'Cat tembok', 'Wall paint', 'kg', 'kg', 25_000],
  ['M12', 0, 'Rangka atap baja ringan', 'Light steel roof truss', 'm2', 'm2', 185_000],
  ['M13', 0, 'Genteng metal', 'Metal roof tile', 'm2', 'm2', 75_000],
  ['M14', 0, 'Kabel NYM 2x1,5', 'Cable NYM 2x1.5', 'm', 'm', 9_000],
  ['M15', 0, 'Saklar / stop kontak', 'Switch / socket', 'bh', 'pcs', 35_000],
  ['M16', 0, 'Lampu LED', 'LED bulb', 'bh', 'pcs', 45_000],
  ['M17', 0, 'Pipa PVC 3/4"', 'PVC pipe 3/4"', 'btg', 'length', 45_000],
  ['U01', 1, 'Pekerja', 'Labourer', 'OH', 'day', 120_000],
  ['U02', 1, 'Tukang batu', 'Mason', 'OH', 'day', 150_000],
  ['U03', 1, 'Kepala tukang', 'Foreman', 'OH', 'day', 170_000],
  ['U04', 1, 'Mandor', 'Supervisor', 'OH', 'day', 180_000],
  ['U05', 1, 'Tukang cat', 'Painter', 'OH', 'day', 150_000],
  ['U06', 1, 'Tukang listrik', 'Electrician', 'OH', 'day', 175_000],
  ['U07', 1, 'Tukang besi', 'Steel fixer', 'OH', 'day', 150_000],
  ['U08', 1, 'Tukang kayu', 'Carpenter', 'OH', 'day', 150_000],
  ['A01', 2, 'Sewa molen', 'Concrete mixer hire', 'hari', 'day', 250_000],
];

/** Contoh analisa: kode, uraian id/en, satuan id/en, komponen [kode harga, koefisien]. */
const ANALYSES: [string, string, string, string, string, [string, number][]][] = [
  [
    'AN-01',
    'Pembersihan lahan',
    'Site clearing',
    'm2',
    'm2',
    [
      ['U01', 0.1],
      ['U04', 0.005],
    ],
  ],
  [
    'AN-02',
    'Galian tanah biasa sedalam 1 m',
    'Excavation to 1 m',
    'm3',
    'm3',
    [
      ['U01', 0.75],
      ['U04', 0.025],
    ],
  ],
  [
    'AN-03',
    'Pasangan bata merah 1:4',
    'Brick wall 1:4',
    'm2',
    'm2',
    [
      ['M03', 70],
      ['M01', 0.23],
      ['M02', 0.043],
      ['U01', 0.3],
      ['U02', 0.1],
      ['U03', 0.01],
      ['U04', 0.015],
    ],
  ],
  [
    'AN-04',
    'Plesteran 1:4 tebal 15 mm',
    'Plastering 1:4, 15 mm',
    'm2',
    'm2',
    [
      ['M01', 0.125],
      ['M02', 0.024],
      ['U01', 0.3],
      ['U02', 0.15],
      ['U03', 0.015],
      ['U04', 0.015],
    ],
  ],
  [
    'AN-05',
    'Acian',
    'Skim coat',
    'm2',
    'm2',
    [
      ['M01', 0.065],
      ['U01', 0.2],
      ['U02', 0.1],
      ['U03', 0.01],
      ['U04', 0.01],
    ],
  ],
  [
    'AN-06',
    'Beton K-225 (manual)',
    'Concrete K-225 (site mix)',
    'm3',
    'm3',
    [
      ['M01', 7.42],
      ['M02', 0.5],
      ['M04', 0.76],
      ['U01', 1.65],
      ['U02', 0.275],
      ['U03', 0.028],
      ['U04', 0.083],
      ['A01', 0.25],
    ],
  ],
  [
    'AN-07',
    'Pembesian besi polos',
    'Rebar fixing',
    'kg',
    'kg',
    [
      ['M05', 1.05],
      ['M06', 0.015],
      ['U01', 0.007],
      ['U07', 0.007],
      ['U03', 0.0007],
      ['U04', 0.0004],
    ],
  ],
  [
    'AN-08',
    'Bekisting',
    'Formwork',
    'm2',
    'm2',
    [
      ['M07', 0.04],
      ['M08', 0.4],
      ['U01', 0.52],
      ['U08', 0.26],
      ['U03', 0.026],
      ['U04', 0.026],
    ],
  ],
  [
    'AN-09',
    'Pasang keramik 40x40',
    'Floor tiling 40x40',
    'm2',
    'm2',
    [
      ['M09', 1.05],
      ['M01', 0.2],
      ['M02', 0.045],
      ['U01', 0.62],
      ['U02', 0.35],
      ['U03', 0.035],
      ['U04', 0.03],
    ],
  ],
  [
    'AN-10',
    'Pengecatan tembok baru',
    'Painting new walls',
    'm2',
    'm2',
    [
      ['M10', 0.1],
      ['M11', 0.26],
      ['U01', 0.02],
      ['U05', 0.063],
      ['U03', 0.0063],
      ['U04', 0.0025],
    ],
  ],
  [
    'AN-11',
    'Atap baja ringan + genteng metal',
    'Light steel roof + metal tiles',
    'm2',
    'm2',
    [
      ['M12', 1],
      ['M13', 1.05],
      ['U01', 0.1],
      ['U08', 0.1],
      ['U04', 0.01],
    ],
  ],
  [
    'AN-12',
    'Titik lampu / stop kontak',
    'Lighting / socket point',
    'titik',
    'point',
    [
      ['M14', 12],
      ['M15', 1],
      ['M16', 0.5],
      ['U06', 0.25],
      ['U01', 0.1],
    ],
  ],
  [
    'AN-13',
    'Pipa air bersih PVC 3/4"',
    'PVC water pipe 3/4"',
    "m'",
    'm',
    [
      ['M17', 0.37],
      ['U01', 0.036],
      ['U02', 0.06],
    ],
  ],
];

/** Contoh RAB: bab (indeks), uraian id/en, kode analisa atau harga manual, volume, satuan id/en, minggu mulai, durasi, progres. */
const ITEMS: [
  number,
  string,
  string,
  string | number,
  number,
  string,
  string,
  number,
  number,
  number,
][] = [
  [0, 'Pembersihan lahan', 'Site clearing', 'AN-01', 40, 'm2', 'm2', 1, 1, 1],
  [0, 'Mobilisasi & sewa alat', 'Mobilisation & equipment', 1_500_000, 1, 'ls', 'ls', 1, 1, 1],
  [0, 'Pengukuran & bowplank', 'Setting out', 750_000, 1, 'ls', 'ls', 1, 1, 1],
  [1, 'Galian tanah pondasi', 'Foundation excavation', 'AN-02', 12, 'm3', 'm3', 1, 2, 1],
  [1, 'Beton sloof K-225', 'Ground beam concrete', 'AN-06', 1.8, 'm3', 'm3', 2, 2, 1],
  [1, 'Pembesian sloof', 'Ground beam rebar', 'AN-07', 210, 'kg', 'kg', 2, 2, 1],
  [1, 'Bekisting sloof', 'Ground beam formwork', 'AN-08', 18, 'm2', 'm2', 2, 2, 1],
  [2, 'Pasangan bata merah 1:4', 'Brick walls 1:4', 'AN-03', 85, 'm2', 'm2', 3, 3, 0.9],
  [2, 'Plesteran dinding', 'Wall plastering', 'AN-04', 170, 'm2', 'm2', 4, 3, 0.7],
  [2, 'Acian dinding', 'Wall skim coat', 'AN-05', 170, 'm2', 'm2', 5, 3, 0.4],
  [3, 'Beton kolom praktis', 'Column concrete', 'AN-06', 1.4, 'm3', 'm3', 3, 3, 0.8],
  [3, 'Beton ring balok', 'Ring beam concrete', 'AN-06', 1.2, 'm3', 'm3', 5, 2, 0.5],
  [
    3,
    'Pembesian kolom & ring balok',
    'Column & ring beam rebar',
    'AN-07',
    250,
    'kg',
    'kg',
    3,
    4,
    0.7,
  ],
  [
    3,
    'Bekisting kolom & ring balok',
    'Column & ring beam formwork',
    'AN-08',
    30,
    'm2',
    'm2',
    3,
    4,
    0.7,
  ],
  [
    4,
    'Atap baja ringan + genteng metal',
    'Light steel roof + metal tiles',
    'AN-11',
    48,
    'm2',
    'm2',
    7,
    2,
    0,
  ],
  [4, 'Lisplang GRC', 'Fascia board', 85_000, 18, "m'", 'm', 8, 1, 0],
  [5, 'Pasang keramik 40x40', 'Floor tiling 40x40', 'AN-09', 36, 'm2', 'm2', 8, 2, 0],
  [6, 'Pengecatan dinding', 'Wall painting', 'AN-10', 170, 'm2', 'm2', 9, 3, 0],
  [
    7,
    'Titik lampu & stop kontak',
    'Lighting & socket points',
    'AN-12',
    12,
    'titik',
    'point',
    6,
    4,
    0.4,
  ],
  [7, 'Pipa air bersih', 'Water pipes', 'AN-13', 25, "m'", 'm', 6, 3, 0.5],
];

const SAMPLE_SECTIONS: Record<Locale, string[]> = {
  id: [
    'Pekerjaan Persiapan',
    'Pekerjaan Tanah & Pondasi',
    'Pekerjaan Dinding',
    'Pekerjaan Struktur Beton',
    'Pekerjaan Atap',
    'Pekerjaan Lantai',
    'Pekerjaan Pengecatan',
    'Pekerjaan Listrik & Air',
  ],
  en: [
    'Preliminaries',
    'Earthworks & Foundation',
    'Walls',
    'Concrete Structure',
    'Roofing',
    'Flooring',
    'Painting',
    'Electrical & Plumbing',
  ],
};

export const RAB_PRESETS: Record<Locale, Record<string, string[]>> = {
  id: {
    renovasi: SAMPLE_SECTIONS.id,
    bangun: [
      'Pekerjaan Persiapan',
      'Pekerjaan Tanah & Pondasi',
      'Pekerjaan Struktur Beton',
      'Pekerjaan Dinding',
      'Pekerjaan Kusen, Pintu & Jendela',
      'Pekerjaan Atap',
      'Pekerjaan Plafon',
      'Pekerjaan Lantai',
      'Pekerjaan Sanitasi',
      'Pekerjaan Listrik',
      'Pekerjaan Pengecatan',
      'Pekerjaan Lain-lain',
    ],
    interior: [
      'Pekerjaan Persiapan & Bongkaran',
      'Pekerjaan Plafon & Partisi',
      'Pekerjaan Lantai',
      'Pekerjaan Furnitur Custom',
      'Pekerjaan Listrik & Pencahayaan',
      'Pekerjaan Finishing & Cat',
      'Dekorasi & Aksesori',
    ],
  },
  en: {
    renovasi: SAMPLE_SECTIONS.en,
    bangun: [
      'Preliminaries',
      'Earthworks & Foundation',
      'Concrete Structure',
      'Walls',
      'Doors & Windows',
      'Roofing',
      'Ceilings',
      'Flooring',
      'Sanitary',
      'Electrical',
      'Painting',
      'Miscellaneous',
    ],
    interior: [
      'Preparation & Demolition',
      'Ceilings & Partitions',
      'Flooring',
      'Custom Furniture',
      'Electrical & Lighting',
      'Finishing & Paint',
      'Decor & Accessories',
    ],
  },
};

export const RAB_FORM: Record<Locale, TemplateForm> = {
  id: {
    template: 'rab',
    fileBase: 'RAB',
    fileKey: 'project',
    heading: 'Atur sesuai proyekmu',
    fields: [
      {
        key: 'project',
        kind: 'text',
        label: 'Nama proyek',
        placeholder: 'misalnya Renovasi Rumah Bu Sari',
        span: 2,
      },
      { key: 'currency', kind: 'currency', label: 'Mata uang' },
      { key: 'start', kind: 'date', label: 'Tanggal mulai', value: 'today+0' },
      { key: 'weeks', kind: 'number', label: 'Durasi (minggu)', value: 12, min: 1, max: 52 },
      {
        key: 'overhead',
        kind: 'number',
        label: 'Overhead & profit (%)',
        value: 10,
        min: 0,
        max: 50,
        hint: 'Ditambahkan ke harga satuan.',
      },
      {
        key: 'vat',
        kind: 'number',
        label: 'PPN (%)',
        value: 0,
        min: 0,
        max: 30,
        step: 0.5,
        hint: '0 bila tukang/pemborong perorangan.',
      },
      {
        key: 'sections',
        kind: 'list',
        label: 'Bab pekerjaan',
        value: RAB_PRESETS.id.renovasi.join('\n'),
        max: MAX_SECTIONS,
      },
    ],
    presets: {
      key: 'preset',
      label: 'Jenis proyek',
      hint: 'Mengisi ulang daftar bab pekerjaan di bawah.',
      options: [
        { value: 'renovasi', label: 'Renovasi rumah' },
        { value: 'bangun', label: 'Bangun rumah baru' },
        { value: 'interior', label: 'Interior & furnitur' },
      ],
      fill: Object.fromEntries(
        Object.entries(RAB_PRESETS.id).map(([k, v]) => [k, { sections: v.join('\n') }]),
      ),
    },
    note: 'File sudah berisi 26 harga dasar bahan dan upah serta 13 analisa harga satuan (pola koefisien SNI) sebagai titik awal. Sesuaikan harganya dengan harga di daerahmu.',
    sample: {
      label: 'Isi contoh proyek',
      hint: 'RAB renovasi rumah dengan 20 pekerjaan, jadwal, realisasi biaya, dan progres 5 minggu, jadi dashboard dan kurva S langsung terisi. Contoh memakai bab pekerjaan renovasi.',
    },
  },
  en: {
    template: 'rab',
    fileBase: 'Construction-Estimate',
    fileKey: 'project',
    heading: 'Set it up for your project',
    fields: [
      {
        key: 'project',
        kind: 'text',
        label: 'Project name',
        placeholder: 'for example House Renovation',
        span: 2,
      },
      { key: 'currency', kind: 'currency', label: 'Currency' },
      { key: 'start', kind: 'date', label: 'Start date', value: 'today+0' },
      { key: 'weeks', kind: 'number', label: 'Duration (weeks)', value: 12, min: 1, max: 52 },
      {
        key: 'overhead',
        kind: 'number',
        label: 'Overhead & profit (%)',
        value: 10,
        min: 0,
        max: 50,
        hint: 'Added to unit prices.',
      },
      { key: 'vat', kind: 'number', label: 'Tax (%)', value: 0, min: 0, max: 30, step: 0.5 },
      {
        key: 'sections',
        kind: 'list',
        label: 'Work sections',
        value: RAB_PRESETS.en.renovasi.join('\n'),
        max: MAX_SECTIONS,
      },
    ],
    presets: {
      key: 'preset',
      label: 'Project type',
      hint: 'Refills the list of work sections below.',
      options: [
        { value: 'renovasi', label: 'Renovation' },
        { value: 'bangun', label: 'New house' },
        { value: 'interior', label: 'Interior & furniture' },
      ],
      fill: Object.fromEntries(
        Object.entries(RAB_PRESETS.en).map(([k, v]) => [k, { sections: v.join('\n') }]),
      ),
    },
    note: 'The file comes with 26 base prices for materials and labour and 13 unit price analyses (Indonesian SNI-style coefficients) as a starting point. Adjust the prices for your area.',
    sample: {
      label: 'Include a sample project',
      hint: 'A house renovation estimate with 20 work items, schedule, actual costs, and 5 weeks of progress, so the dashboard and S-curve are filled in. The sample uses the renovation sections.',
    },
  },
};

export function buildFromForm(v: FormValues): Workbook {
  const now = new Date();
  return buildRabWorkbook({
    locale: formChoice(v, 'locale', ['id', 'en'] as const, 'id'),
    project: formText(v, 'project'),
    currency: formChoice(v, 'currency', Object.keys(CURRENCIES) as Currency[], 'IDR'),
    start: formDate(v, 'start') ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()],
    weeks: formNumber(v, 'weeks', 12, 1, MAX_WEEKS),
    overhead: formNumber(v, 'overhead', 10, 0, 100),
    vat: formNumber(v, 'vat', 0, 0, 100),
    sections: formList(v, 'sections'),
    sample: v.sample === true,
  });
}

export function buildRabWorkbook(opts: RabOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.terakota;
  const st = makeStyles(accent, currency, locale);
  const money = sampleMoney(currency);
  const sample = opts.sample;
  const sections = sample
    ? SAMPLE_SECTIONS[locale]
    : cleanList(opts.sections, MAX_SECTIONS).length
      ? cleanList(opts.sections, MAX_SECTIONS)
      : RAB_PRESETS[locale].renovasi;
  const project =
    opts.project.trim().slice(0, 80) ||
    (sample ? t.sample.project : locale === 'id' ? 'Nama Proyek' : 'Project Name');
  const weeks = Math.min(MAX_WEEKS, Math.max(1, Math.round(opts.weeks)));
  // Contoh: proyek dimulai 5 minggu lalu (minggu ke-6 berjalan) agar progres dan realisasi terlihat.
  const now = new Date();
  const todayX = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const start = sample ? todayX - 35 : excelDate(...opts.start);
  const T = t.types.map(q);

  const wb = new Workbook({ title: `${t.name} – ${project}`, subject: t.name, company: project });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shRecap = wb.addSheet(S.recap, { tabColor: '3C6A33', gridlines: false, fitWidth: true });
  const shRab = wb.addSheet(S.rab, { tabColor: '8F5E0A', ...landscape });
  const shAn = wb.addSheet(S.an, { tabColor: '2C4A86', ...landscape });
  const shBase = wb.addSheet(S.base, { tabColor: '2C4A86', ...landscape });
  const shAct = wb.addSheet(S.act, { tabColor: '9A2E3F', ...landscape });
  const shCurve = wb.addSheet(S.curve, { tabColor: '9A2E3F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const col = (sheet: string, c: string, first: number, last: number) =>
    ref(sheet, `$${c}$${first}:$${c}$${last}`);
  const baseLast = FIRST + BASE_ROWS - 1;
  const anLast = FIRST + AN_ROWS - 1;
  const compLast = FIRST + COMP_ROWS - 1;
  const rabLast = FIRST + RAB_ROWS - 1;
  const actLast = FIRST + ACT_ROWS - 1;
  const pct0: Style = { ...st.input, numFmt: '0.0"%"', align: { h: 'center' } };

  // ---------- Daftar ----------
  t.types.forEach((x, i) => shList.set(`B${i + 2}`, x));
  wb.defineName('CostTypes', ref(S.list, '$B$2:$B$4'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'F',
    menu,
  });
  shSet.widths({ B: 26, C: 40, D: 3, E: 34, F: 6 });
  const setVals: Record<string, string | number> = {
    ProjectName: project,
    ProjectSite: sample ? t.sample.site : '',
    ProjectOwner: sample ? t.sample.owner : '',
    ProjectBuilder: sample ? t.sample.builder : '',
    ProjectStart: start,
    ProjectWeeks: weeks,
    Overhead: Math.max(0, opts.overhead),
    VatRate: Math.max(0, opts.vat),
    CurrencyLabel: `${currency} (${CURRENCIES[currency].symbol})`,
  };
  t.set.forEach(([label, name, kind], i) => {
    const r = 5 + i;
    const style: Style =
      kind === 'date'
        ? st.inputDate
        : kind === 'int'
          ? st.inputInt
          : kind === 'pct'
            ? pct0
            : kind === 'calc'
              ? st.calcText
              : st.inputText;
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, setVals[name], style).height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.validate('C10', {
    type: 'whole',
    operator: 'between',
    formula1: '1',
    formula2: String(MAX_WEEKS),
    error: `1–${MAX_WEEKS}`,
  });
  shSet.set('E5', t.sectionsH, st.h2).set('E6', t.sectionName, st.thLeft);
  for (let k = 0; k < MAX_SECTIONS; k++) shSet.set(`E${7 + k}`, sections[k] ?? null, st.inputText);
  wb.defineName('Sections', ref(S.set, `$E$7:$E$${6 + MAX_SECTIONS}`));

  // ---------- Harga Dasar ----------
  sheetHeader(shBase, st, {
    brand: t.brand,
    title: S.base,
    subtitle: t.subtitle.base,
    lastCol: 'H',
    menu,
  });
  shBase.widths({ B: 9, C: 11, D: 32, E: 9, F: 15, G: 26, H: 12 });
  t.base.forEach((h, i) =>
    shBase.set(`${'BCDEFGH'[i]}${head}`, h, [2, 5].includes(i) ? st.thLeft : st.th),
  );
  shBase.height(head, 28);
  for (let r = FIRST; r <= baseLast; r++) {
    const b = BASE[r - FIRST];
    shBase
      .set(`B${r}`, b?.[0] ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`C${r}`, b ? t.types[b[1]] : null, { ...st.inputText, align: { h: 'center' } })
      .set(`D${r}`, b ? (locale === 'id' ? b[2] : b[3]) : null, st.inputText)
      .set(`E${r}`, b ? (locale === 'id' ? b[4] : b[5]) : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`F${r}`, b ? money(b[6]) : null, st.inputMoney)
      .set(`G${r}`, null, st.inputText)
      .set(`H${r}`, `=IF($B${r}="","",COUNTIF(CompCode,$B${r}))`, st.calcInt);
  }
  shBase.validate(`B${FIRST}:B${baseLast}`, {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${baseLast},B${FIRST})=1`,
    error: 'Duplicate',
  });
  shBase.validate(`C${FIRST}:C${baseLast}`, { type: 'list', formula1: '=CostTypes' });
  shBase.validate(`F${FIRST}:F${baseLast}`, {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
  });
  shBase.freeze(`D${FIRST}`).autoFilter(`B${head}:H${baseLast}`);
  wb.defineName('BaseCode', col(S.base, 'B', FIRST, baseLast));
  wb.defineName('BaseType', col(S.base, 'C', FIRST, baseLast));
  wb.defineName('BaseName', col(S.base, 'D', FIRST, baseLast));
  wb.defineName('BaseUnit', col(S.base, 'E', FIRST, baseLast));
  wb.defineName('BasePrice', col(S.base, 'F', FIRST, baseLast));

  // ---------- Analisa Harga ----------
  sheetHeader(shAn, st, {
    brand: t.brand,
    title: S.an,
    subtitle: t.subtitle.an,
    lastCol: 'S',
    menu,
  });
  shAn.widths({
    B: 9,
    C: 30,
    D: 8,
    E: 13,
    F: 13,
    G: 12,
    H: 14,
    I: 3,
    J: 10,
    K: 10,
    L: 10,
    M: 28,
    N: 8,
    O: 13,
    P: 13,
    Q: 11,
  });
  t.an.forEach((h, i) => shAn.set(`${'BCDEFGH'[i]}${head}`, h, i === 1 ? st.thLeft : st.th));
  t.comp.forEach((h, i) => shAn.set(`${'JKLMNOPQ'[i]}${head}`, h, i === 3 ? st.thLeft : st.th));
  shAn.height(head, 28);
  const oh = '(1+N(Overhead)/100)';
  for (let r = FIRST; r <= anLast; r++) {
    const a = ANALYSES[r - FIRST];
    const sumType = (i: number) => `SUMIFS(CompAmount,CompAnalysis,$B${r},CompType,${T[i]})`;
    shAn
      .set(`B${r}`, a?.[0] ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`C${r}`, a ? (locale === 'id' ? a[1] : a[2]) : null, st.inputText)
      .set(`D${r}`, a ? (locale === 'id' ? a[3] : a[4]) : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`E${r}`, `=IF($B${r}="","",${sumType(0)})`, st.calcMoney)
      .set(`F${r}`, `=IF($B${r}="","",${sumType(1)})`, st.calcMoney)
      .set(`G${r}`, `=IF($B${r}="","",${sumType(2)})`, st.calcMoney)
      .set(`H${r}`, `=IF($B${r}="","",ROUND((E${r}+F${r}+G${r})*${oh},0))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      });
  }
  const comps = ANALYSES.flatMap(([code, , , , , parts]) =>
    parts.map(([c, k]) => [code, c, k] as const),
  );
  for (let r = FIRST; r <= compLast; r++) {
    const c = comps[r - FIRST];
    const bi = `MATCH($K${r},BaseCode,0)`;
    shAn
      .set(`J${r}`, c?.[0] ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`K${r}`, c?.[1] ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`L${r}`, c?.[2] ?? null, { ...st.input, numFmt: '0.0000', align: { h: 'center' } })
      .set(`M${r}`, `=IF($K${r}="","",IFERROR(INDEX(BaseName,${bi}),"?"))`, st.calcText)
      .set(`N${r}`, `=IF($K${r}="","",IFERROR(INDEX(BaseUnit,${bi})&"",""))`, st.calcCenter)
      .set(`O${r}`, `=IF($K${r}="","",IFERROR(N(INDEX(BasePrice,${bi})),0))`, st.calcMoney)
      .set(`P${r}`, `=IF($K${r}="","",ROUND(N($L${r})*$O${r},2))`, st.calcMoney)
      .set(`Q${r}`, `=IF($K${r}="","",IFERROR(INDEX(BaseType,${bi})&"",""))`, st.calcCenter);
  }
  shAn.validate(`B${FIRST}:B${anLast}`, {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${anLast},B${FIRST})=1`,
    error: 'Duplicate',
  });
  shAn.validate(`J${FIRST}:J${compLast}`, {
    type: 'list',
    formula1: '=AnCode',
    errorStyle: 'warning',
  });
  shAn.validate(`K${FIRST}:K${compLast}`, {
    type: 'list',
    formula1: '=BaseCode',
    errorStyle: 'warning',
  });
  shAn.cond(`M${FIRST}:M${compLast}`, {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shAn.freeze(`A${FIRST}`);
  wb.defineName('AnCode', col(S.an, 'B', FIRST, anLast));
  wb.defineName('AnName', col(S.an, 'C', FIRST, anLast));
  wb.defineName('AnUnit', col(S.an, 'D', FIRST, anLast));
  wb.defineName('AnMaterial', col(S.an, 'E', FIRST, anLast));
  wb.defineName('AnLabour', col(S.an, 'F', FIRST, anLast));
  wb.defineName('AnEquipment', col(S.an, 'G', FIRST, anLast));
  wb.defineName('AnPrice', col(S.an, 'H', FIRST, anLast));
  wb.defineName('CompAnalysis', col(S.an, 'J', FIRST, compLast));
  wb.defineName('CompCode', col(S.an, 'K', FIRST, compLast));
  wb.defineName('CompAmount', col(S.an, 'P', FIRST, compLast));
  wb.defineName('CompType', col(S.an, 'Q', FIRST, compLast));

  // ---------- RAB ----------
  sheetHeader(shRab, st, {
    brand: t.brand,
    title: S.rab,
    subtitle: t.subtitle.rab,
    lastCol: 'N',
    menu,
  });
  const RC = 'BCDEFGHIJKLMN';
  [7, 24, 34, 10, 9, 7, 13, 14, 15, 8, 14, 14, 9].forEach((w, i) => shRab.width(RC[i], w));
  for (const c of 'OPQR') shRab.width(c, 6, true);
  t.rab.forEach((h, i) => shRab.set(`${RC[i]}${head}`, h, [1, 2].includes(i) ? st.thLeft : st.th));
  for (const c of 'OPQR') shRab.set(`${c}${head}`, '#');
  shRab.height(head, 30);
  for (let r = FIRST; r <= rabLast; r++) {
    const it = sample ? ITEMS[r - FIRST] : undefined;
    const ai = `MATCH($E${r},AnCode,0)`;
    const isCode = it && typeof it[3] === 'string';
    const filled = `OR($D${r}<>"",$E${r}<>"",$F${r}<>"")`;
    shRab
      .set(`B${r}`, `=IF(${filled},"P"&TEXT(ROW()-${head},"000"),"")`, st.calcCenter)
      .set(`C${r}`, it ? sections[it[0]] : null, st.inputText)
      .set(`D${r}`, it ? (locale === 'id' ? it[1] : it[2]) : null, st.inputText)
      .set(`E${r}`, isCode ? (it[3] as string) : null, { ...st.inputText, align: { h: 'center' } })
      .set(`F${r}`, it?.[4] ?? null, st.inputQty)
      .set(`G${r}`, it ? (locale === 'id' ? it[5] : it[6]) : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(`H${r}`, it && !isCode ? money(it[3] as number) : null, st.inputMoney)
      .set(
        `I${r}`,
        `=IF($H${r}<>"",$H${r},IF($E${r}="","",IFERROR(INDEX(AnPrice,${ai}),0)))`,
        st.calcMoney,
      )
      .set(`J${r}`, `=IF(OR($F${r}="",$I${r}=""),"",ROUND(N($F${r})*$I${r},0))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`K${r}`, `=IF(OR(N($J${r})=0,SUM(RabAmount)=0),"",$J${r}/SUM(RabAmount))`, {
        ...st.calcPct,
        numFmt: '0.00%',
      })
      .set(`L${r}`, `=IF($B${r}="","",SUMIFS(ActAmount,ActItem,$B${r}))`, st.calcMoney)
      .set(`M${r}`, `=IF($J${r}="","",$J${r}-$L${r})`, st.calcMoney)
      .set(`N${r}`, it ? it[9] : null, { ...st.input, numFmt: '0%', align: { h: 'center' } })
      // Bantu: biaya bahan, upah, alat (sudah termasuk overhead) dan harga manual per baris.
      .set(
        `O${r}`,
        `=IF(OR($E${r}="",$H${r}<>"",$F${r}=""),0,N($F${r})*IFERROR(INDEX(AnMaterial,${ai}),0)*${oh})`,
      )
      .set(
        `P${r}`,
        `=IF(OR($E${r}="",$H${r}<>"",$F${r}=""),0,N($F${r})*IFERROR(INDEX(AnLabour,${ai}),0)*${oh})`,
      )
      .set(
        `Q${r}`,
        `=IF(OR($E${r}="",$H${r}<>"",$F${r}=""),0,N($F${r})*IFERROR(INDEX(AnEquipment,${ai}),0)*${oh})`,
      )
      .set(`R${r}`, `=IF($H${r}="",0,N($J${r}))`);
  }
  const rr = (c: string) => `${c}${FIRST}:${c}${rabLast}`;
  shRab.validate(rr('C'), { type: 'list', formula1: '=Sections' });
  shRab.validate(rr('E'), {
    type: 'list',
    formula1: '=AnCode',
    prompt: t.rabNote,
    errorStyle: 'warning',
  });
  shRab.validate(rr('F'), { type: 'decimal', operator: 'greaterThanOrEqual', formula1: '0' });
  shRab.validate(rr('H'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.rabNote,
  });
  shRab.validate(rr('N'), {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '1',
    error: '0%–100%',
  });
  shRab.cond(rr('M'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shRab.cond(rr('N'), { type: 'dataBar', color: '3C6A33', min: '0', max: '1' });
  shRab.cond(rr('C'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",$C${FIRST}="")`,
    style: { fill: WARN_BG },
  });
  shRab.freeze(`E${FIRST}`).autoFilter(`B${head}:N${rabLast}`).printTitles(head, head);
  const rabNames: [string, string][] = [
    ['RabId', 'B'],
    ['RabSection', 'C'],
    ['RabName', 'D'],
    ['RabAmount', 'J'],
    ['RabWeight', 'K'],
    ['RabActual', 'L'],
    ['RabProgress', 'N'],
    ['RabMaterial', 'O'],
    ['RabLabour', 'P'],
    ['RabEquipment', 'Q'],
    ['RabManual', 'R'],
  ];
  for (const [n, c] of rabNames) wb.defineName(n, col(S.rab, c, FIRST, rabLast));

  // ---------- Realisasi ----------
  sheetHeader(shAct, st, {
    brand: t.brand,
    title: S.act,
    subtitle: t.subtitle.act,
    lastCol: 'G',
    menu,
  });
  shAct.widths({ B: 12, C: 12, D: 34, E: 28, F: 22, G: 15 });
  t.act.forEach((h, i) =>
    shAct.set(`${'BCDEFG'[i]}${head}`, h, [2, 3, 4].includes(i) ? st.thLeft : st.th),
  );
  shAct.height(head, 26);
  const actSample = sample ? makeActuals() : [];
  for (let r = FIRST; r <= actLast; r++) {
    const a = actSample[r - FIRST];
    shAct
      .set(`B${r}`, a?.date ?? null, st.inputDate)
      .set(`C${r}`, a?.item ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(
        `D${r}`,
        `=IF($C${r}="","",IFERROR(INDEX(RabName,MATCH($C${r},RabId,0)),"?"))`,
        st.calcText,
      )
      .set(`E${r}`, a?.note ?? null, st.inputText)
      .set(`F${r}`, a?.shop ?? null, st.inputText)
      .set(`G${r}`, a?.amount ?? null, st.inputMoney);
  }
  shAct.validate(`B${FIRST}:B${actLast}`, {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
  });
  shAct.validate(`C${FIRST}:C${actLast}`, {
    type: 'list',
    formula1: '=RabId',
    errorStyle: 'warning',
  });
  shAct.validate(`G${FIRST}:G${actLast}`, {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
  });
  shAct.cond(`D${FIRST}:D${actLast}`, {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shAct.freeze(`A${FIRST}`).autoFilter(`B${head}:G${actLast}`);
  wb.defineName('ActItem', col(S.act, 'C', FIRST, actLast));
  wb.defineName('ActAmount', col(S.act, 'G', FIRST, actLast));

  // ---------- Kurva S ----------
  sheetHeader(shCurve, st, {
    brand: t.brand,
    title: S.curve,
    subtitle: t.subtitle.curve,
    lastCol: 'G',
    menu,
  });
  shCurve.widths({ B: 7, C: 30, D: 9, E: 9, F: 9 });
  const WCOL = (w: number) => {
    // Minggu ke-w di kolom G dst.
    let n = 6 + w;
    let s = '';
    while (n > 0) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };
  for (let w = 1; w <= MAX_WEEKS; w++) shCurve.width(WCOL(w), 6.5);
  const itemLast = ITEM_FIRST + RAB_ROWS - 1;
  const hdr = ITEM_FIRST - 1;
  // Ringkasan di atas (baris 6-10), item di bawah.
  const sumRows: [number, string, Style][] = [
    [7, t.planWeek, st.rowLabel],
    [8, t.planCum, { ...st.rowLabel, font: { size: 10, bold: true } }],
    [9, t.actualCum, { ...st.rowLabel, font: { size: 10, bold: true, color: '3C6A33' } }],
    [10, t.deviation, st.rowLabel],
  ];
  shCurve.merge('B6:F6', '', st.th);
  for (const [r, label, style] of sumRows) shCurve.merge(`B${r}:F${r}`, label, style);
  const actualCum = sample ? [0.05, 0.13, 0.24, 0.34, 0.44, 0.52] : [];
  for (let w = 1; w <= MAX_WEEKS; w++) {
    const c = WCOL(w);
    const on = `${w}<=ProjectWeeks`;
    shCurve
      .set(`${c}6`, `=IF(${on},${q(t.weekLabel)}&${w},"")`, st.th)
      .set(`${c}${hdr}`, `=IF(${on},ProjectStart+${(w - 1) * 7},"")`, {
        ...st.th,
        numFmt: 'dd/mm',
        font: { size: 8, bold: true, color: 'FFFFFF' },
      })
      .set(`${c}7`, `=IF(${on},SUM(${c}${ITEM_FIRST}:${c}${itemLast}),"")`, {
        ...st.rowPct,
        numFmt: '0.0%',
      })
      .set(`${c}8`, `=IF(${on},SUM($G$7:${c}7),"")`, {
        ...st.rowPct,
        numFmt: '0.0%',
        font: { size: 9, bold: true },
      })
      .set(`${c}9`, actualCum[w - 1] ?? null, {
        ...st.input,
        numFmt: '0.0%',
        align: { h: 'center' },
        font: { size: 9, color: '3C6A33', bold: true },
      })
      .set(`${c}10`, `=IF(OR(${c}9="",NOT(${on})),"",${c}9-${c}8)`, {
        ...st.rowPct,
        numFmt: '+0.0%;-0.0%;0.0%',
      });
    // Hidden helper row 11: realisasi atau NA (agar garis realisasi berhenti di minggu terakhir yang diisi).
    shCurve.set(`${c}11`, `=IF(${c}9="",NA(),${c}9)`);
  }
  shCurve.hideRow(11);
  t.curveHead.forEach((h, i) => shCurve.set(`${'BCDEF'[i]}${hdr}`, h, i === 1 ? st.thLeft : st.th));
  shCurve.height(hdr, 30).height(6, 20);
  for (let r = ITEM_FIRST; r <= itemLast; r++) {
    const rabRow = r - ITEM_FIRST + FIRST;
    const it = sample ? ITEMS[r - ITEM_FIRST] : undefined;
    const rab = `'${S.rab}'!`;
    shCurve
      .set(`B${r}`, `=IF(${rab}$B${rabRow}="","",${rab}$B${rabRow})`, st.calcCenter)
      .set(`C${r}`, `=IF($B${r}="","",${rab}$D${rabRow}&"")`, st.calcText)
      .set(`D${r}`, `=IF($B${r}="","",N(${rab}$K${rabRow}))`, { ...st.calcPct, numFmt: '0.0%' })
      .set(`E${r}`, it?.[7] ?? null, st.inputInt)
      .set(`F${r}`, it?.[8] ?? null, st.inputInt);
    for (let w = 1; w <= MAX_WEEKS; w++)
      shCurve.set(
        `${WCOL(w)}${r}`,
        `=IF(OR($B${r}="",N($E${r})=0,N($F${r})=0),"",IF(AND(${w}>=$E${r},${w}<$E${r}+$F${r}),$D${r}/$F${r},""))`,
        { numFmt: '0.0%;;', font: { size: 8, color: 'FFFFFF' } },
      );
  }
  const grid = `G${ITEM_FIRST}:${WCOL(MAX_WEEKS)}${itemLast}`;
  shCurve.cond(grid, {
    type: 'expression',
    formula: `ISNUMBER(G${ITEM_FIRST})`,
    style: { fill: accent.main, font: { color: 'FFFFFF' } },
  });
  shCurve.cond(`G6:${WCOL(MAX_WEEKS)}6`, {
    type: 'expression',
    formula: `AND(G6<>"",TODAY()>=ProjectStart+(COLUMN(G6)-7)*7,TODAY()<ProjectStart+(COLUMN(G6)-6)*7)`,
    style: { fill: '8F5E0A' },
  });
  shCurve.cond(`G10:${WCOL(MAX_WEEKS)}10`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shCurve.cond(`G10:${WCOL(MAX_WEEKS)}10`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: GOOD, bold: true } },
  });
  shCurve.validate(`E${ITEM_FIRST}:F${itemLast}`, {
    type: 'whole',
    operator: 'between',
    formula1: '0',
    formula2: String(MAX_WEEKS),
  });
  shCurve.validate(`G9:${WCOL(MAX_WEEKS)}9`, {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '1',
  });
  shCurve.freeze(`G${ITEM_FIRST}`);
  const wkRange = (r: number) => ref(S.curve, `$G$${r}:$${WCOL(weeks)}$${r}`);
  wb.defineName('PlanCumulative', ref(S.curve, `$G$8:$${WCOL(MAX_WEEKS)}$8`));
  wb.defineName('ActualCumulative', ref(S.curve, `$G$9:$${WCOL(MAX_WEEKS)}$9`));

  // ---------- Rekapitulasi ----------
  sheetHeader(shRecap, st, {
    brand: t.brand,
    title: S.recap,
    subtitle: t.subtitle.recap,
    lastCol: 'H',
    menu,
  });
  shRecap.widths({ B: 6, C: 36, D: 17, E: 10, F: 17, G: 17, H: 4 });
  const info: [string, string][] = [
    [t.set[0][0], '=ProjectName'],
    [t.set[1][0], '=ProjectSite&""'],
    [t.set[2][0], '=ProjectOwner&""'],
    [t.set[3][0], '=ProjectBuilder&""'],
  ];
  info.forEach(([l, f], i) =>
    shRecap.merge(`B${5 + i}:C${5 + i}`, l, st.label).merge(`D${5 + i}:G${5 + i}`, f, st.calcText),
  );
  const rcH = 10;
  t.recap.forEach((h, i) => shRecap.set(`${'BCDEFG'[i]}${rcH}`, h, i === 1 ? st.thLeft : st.th));
  shRecap.height(rcH, 24);
  for (let k = 0; k < MAX_SECTIONS; k++) {
    const r = rcH + 1 + k;
    const sec = `INDEX(Sections,${k + 1})`;
    shRecap
      .set(`B${r}`, `=IF(${sec}="","",CHAR(${65 + k}))`, { ...st.rowLabel, align: { h: 'center' } })
      .set(`C${r}`, `=IF(${sec}="","",${sec})`, st.rowLabel)
      .set(`D${r}`, `=IF(C${r}="","",SUMIFS(RabAmount,RabSection,C${r}))`, st.rowMoney)
      .set(`E${r}`, `=IF(OR(C${r}="",SUM(RabAmount)=0),"",D${r}/SUM(RabAmount))`, st.rowPct)
      .set(`F${r}`, `=IF(C${r}="","",SUMIFS(RabActual,RabSection,C${r}))`, st.rowMoney)
      .set(`G${r}`, `=IF(C${r}="","",D${r}-F${r})`, st.rowMoney);
  }
  const rcT = rcH + 1 + MAX_SECTIONS;
  shRecap
    .merge(`B${rcT}:C${rcT}`, t.total, st.totalLabel)
    .set(`D${rcT}`, `=SUM(D${rcH + 1}:D${rcT - 1})`, st.totalMoney);
  shRecap
    .set(`E${rcT}`, `=IF(N(D${rcT})=0,"",1)`, st.grandPct)
    .set(`F${rcT}`, `=SUM(F${rcH + 1}:F${rcT - 1})`, st.totalMoney)
    .set(`G${rcT}`, `=D${rcT}-F${rcT}`, st.totalMoney);
  shRecap
    .merge(`B${rcT + 1}:C${rcT + 1}`, `=${q(t.vat + ' ')}&N(VatRate)&"%"`, st.rowLabel)
    .set(`D${rcT + 1}`, `=ROUND(D${rcT}*N(VatRate)/100,0)`, st.rowMoney);
  shRecap
    .merge(`B${rcT + 2}:C${rcT + 2}`, t.grand, st.grandLabel)
    .set(`D${rcT + 2}`, `=D${rcT}+D${rcT + 1}`, st.grandMoney)
    .height(rcT + 2, 24);
  shRecap
    .merge(`B${rcT + 3}:C${rcT + 3}`, t.rounded, st.totalLabel)
    .set(`D${rcT + 3}`, `=ROUND(D${rcT + 2},-3)`, st.totalMoney);
  shRecap.cond(`G${rcH + 1}:G${rcT}`, {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shRecap.cond(`E${rcH + 1}:E${rcT - 1}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '1',
  });
  wb.defineName('BudgetTotal', ref(S.recap, `$D$${rcT + 2}`));

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
  shDash.set('B2', `=${q(S.dash + ' · ')}&ProjectName`, st.title);
  shDash.height(6, 8).height(10, 10);
  const curWeek = 'MAX(0,MIN(ProjectWeeks,INT((TODAY()-ProjectStart)/7)+1))';
  const planNow = `IF(${curWeek}=0,0,INDEX(PlanCumulative,1,${curWeek}))`;
  const progress = 'SUMPRODUCT(RabWeight,RabProgress)';
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kBudget,
    value: '=BudgetTotal',
    note: t.inclVat,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kSpent,
    value: '=SUM(ActAmount)',
    note: `=IF(N(BudgetTotal)=0,"",TEXT(SUM(ActAmount)/BudgetTotal,"0%")&${q(t.usedNote)})`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kLeft,
    value: '=BudgetTotal-SUM(ActAmount)',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kWeek,
    value: `=${curWeek}`,
    note: `=${q(t.ofWeeks.trim() + ' ')}&ProjectWeeks&${q(t.weeksWord)}`,
    numFmt: `${q(t.weekLabel)}0`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kProgress,
    value: `=${progress}`,
    numFmt: '0.0%',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kPlan,
    value: `=${planNow}`,
    numFmt: '0.0%',
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kDev,
    value: `=${progress}-${planNow}`,
    note: `=IF(ABS(${progress}-${planNow})<0.005,${q(t.onPlan)},IF(${progress}>${planNow},${q(t.ahead)},${q(t.behind)}))`,
    numFmt: '+0.0%;-0.0%;0.0%',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kCostPerf,
    value: `=IF(N(BudgetTotal)=0,0,SUM(ActAmount)/BudgetTotal)-${progress}`,
    note: t.costNote,
    numFmt: '+0.0%;-0.0%;0.0%',
  });
  shDash.cond('H12:J12', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  shDash.cond('H12:J12', {
    type: 'cellIs',
    operator: 'greaterThanOrEqual',
    formula: '0',
    style: { font: { color: GOOD } },
  });
  shDash.cond('K12:M12', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0.05',
    style: { font: { color: BAD } },
  });
  shDash.cond('H8:J8', {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  const weekCats = ref(S.curve, `$G$6:$${WCOL(weeks)}$6`);
  shDash.chart({
    type: 'line',
    title: t.chartCurve,
    from: 'B15',
    to: 'H33',
    numFmt: '0%',
    series: [
      { name: t.plan, categories: weekCats, values: wkRange(8), color: accent.main },
      { name: t.actual, categories: weekCats, values: wkRange(11), color: '3C6A33' },
    ],
  });
  const nSec = Math.max(1, sections.length);
  shDash.chart({
    type: 'bar',
    title: t.chartSections,
    from: 'H15',
    to: 'N33',
    numFmt: '#,##0',
    series: [
      {
        name: t.budget,
        categories: ref(S.recap, `$C$${rcH + 1}:$C$${rcH + nSec}`),
        values: ref(S.recap, `$D$${rcH + 1}:$D$${rcH + nSec}`),
        color: accent.main,
      },
      {
        name: t.actual,
        categories: ref(S.recap, `$C$${rcH + 1}:$C$${rcH + nSec}`),
        values: ref(S.recap, `$F$${rcH + 1}:$F$${rcH + nSec}`),
        color: '3C6A33',
      },
    ],
  });
  t.mixLabels.forEach((l, i) => shDash.set(`O${16 + i}`, l));
  shDash
    .set('P16', '=SUM(RabMaterial)')
    .set('P17', '=SUM(RabLabour)')
    .set('P18', '=SUM(RabEquipment)')
    .set('P19', '=SUM(RabManual)');
  shDash.chart({
    type: 'doughnut',
    title: t.chartMix,
    from: 'B35',
    to: 'H53',
    legend: 'r',
    sliceColors: CHART_COLORS.slice(0, 4),
    series: [
      {
        name: t.chartMix,
        categories: ref(S.dash, '$O$16:$O$19'),
        values: ref(S.dash, '$P$16:$P$19'),
      },
    ],
  });
  // Ringkasan per bab di samping donat
  shDash.merge('I35:M35', S.recap, st.h2);
  shDash
    .merge('I36:J36', t.recap[1], st.thLeft)
    .set('K36', t.recap[2], st.th)
    .set('L36', t.recap[4], st.th)
    .set('M36', t.rab[12], st.th)
    .height(36, 26);
  for (let k = 0; k < Math.min(12, MAX_SECTIONS); k++) {
    const r = 37 + k;
    const sec = `INDEX(Sections,${k + 1})`;
    shDash
      .merge(`I${r}:J${r}`, `=IF(${sec}="","",${sec})`, st.rowLabel)
      .set(`K${r}`, `=IF(I${r}="","",SUMIFS(RabAmount,RabSection,I${r}))`, st.rowMoney)
      .set(`L${r}`, `=IF(I${r}="","",SUMIFS(RabActual,RabSection,I${r}))`, st.rowMoney)
      .set(
        `M${r}`,
        `=IF(OR(I${r}="",N(K${r})=0),"",SUMPRODUCT(--(RabSection=I${r}),RabWeight,RabProgress)/SUMIFS(RabWeight,RabSection,I${r}))`,
        st.rowPct,
      );
  }
  shDash.cond('M37:M48', { type: 'dataBar', color: '3C6A33', min: '0', max: '1' });

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: '=ProjectName',
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.recap, t.desc.recap],
      [S.rab, t.desc.rab],
      [S.an, t.desc.an],
      [S.base, t.desc.base],
      [S.act, t.desc.act],
      [S.curve, t.desc.curve],
      [S.set, t.desc.set],
    ],
  });
  return wb;

  /** Contoh realisasi: biaya per pekerjaan sebanding progresnya, dicatat mingguan. */
  function makeActuals() {
    const rnd = seeded(97);
    const out: { date: number; item: string; note: string; shop: string; amount: number }[] = [];
    // Perkiraan nilai tiap item (sama dengan rumus: volume x harga satuan dari analisa).
    const priceOf = (code: string) => {
      const a = ANALYSES.find((x) => x[0] === code);
      if (!a) return 0;
      const sum = a[5].reduce((s, [c, k]) => s + k * money(BASE.find((b) => b[0] === c)![6]), 0);
      return sum * (1 + Math.max(0, opts.overhead) / 100);
    };
    ITEMS.forEach((it, i) => {
      const value = (typeof it[3] === 'string' ? priceOf(it[3]) : money(it[3])) * it[4];
      const spend = value * it[9] * (0.92 + rnd() * 0.2);
      if (spend <= 0) return;
      const parts = it[9] >= 1 ? 2 : 1 + Math.floor(rnd() * 2);
      for (let j = 0; j < parts; j++)
        out.push({
          date: start + (it[7] - 1) * 7 + j * 3 + Math.floor(rnd() * 3),
          item: `P${String(i + 1).padStart(3, '0')}`,
          note: j === parts - 1 && parts > 1 ? t.sample.shops[2] : t.sample.note,
          shop: t.sample.shops[j === parts - 1 && parts > 1 ? 2 : i % 2],
          amount: Math.round(spend / parts / 1000) * 1000 || money(spend / parts),
        });
    });
    return out.sort((a, b) => a.date - b.date).filter((a) => a.date <= todayX);
  }
}
