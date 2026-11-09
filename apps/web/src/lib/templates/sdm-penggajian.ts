/**
 * Template SDM & Penggajian (aturan Indonesia): data karyawan, penggajian bulanan dengan absensi,
 * lembur, BPJS, dan PPh 21 TER, slip gaji siap cetak, rekap bulanan dan per karyawan, dashboard.
 *
 * PPh 21: Januari-November = TER bulanan x bruto. Desember = PPh setahun (Pasal 17 atas PKP)
 * dikurangi PPh yang sudah dipotong Januari-November. Bruto pajak = semua pendapatan + premi JKK,
 * JKM, dan BPJS Kesehatan yang dibayar perusahaan. Pengurang setahun: biaya jabatan dan iuran
 * JHT + JP bagian karyawan. Semua tarif ada di sheet "Tarif & BPJS" dan bisa diubah.
 */
import type { Locale } from '../format';
import { type Style, Workbook, excelDate } from '../xlsx';
import { BIAYA_JABATAN, BPJS, PASAL17, PTKP, TER } from './payroll-rules';
import {
  ACCENTS,
  BAD,
  BAD_BG,
  CHART_COLORS,
  FMT,
  GOOD,
  GOOD_BG,
  INK,
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

export interface PayrollOptions {
  locale: Locale;
  company: string;
  year: number;
  departments: string[];
  /** Tarif JKK (%) sesuai tingkat risiko, misalnya 0.24. */
  jkk: number;
  sample: boolean;
}

export const PAYROLL_LIMITS = { departments: 20 };
export const DEFAULT_DEPARTMENTS: Record<Locale, string[]> = {
  id: ['Operasional', 'Penjualan', 'Keuangan', 'Gudang', 'Administrasi'],
  en: ['Operations', 'Sales', 'Finance', 'Warehouse', 'Administration'],
};

const SPARE = 3;
const FIRST = 6;
const EMP_ROWS = 150;
const PAY_ROWS = EMP_ROWS * 12;

const L = {
  id: {
    brand: 'TOOLLAND · SDM & PENGGAJIAN',
    templateName: 'SDM & Penggajian',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      emp: 'Karyawan',
      pay: 'Penggajian',
      slip: 'Slip Gaji',
      month: 'Rekap Bulanan',
      empSum: 'Rekap Karyawan',
      rates: 'Tarif & BPJS',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Jumlah karyawan, total gaji, take home pay, biaya perusahaan, PPh 21, BPJS, kehadiran, dan grafik.',
      emp: 'Data karyawan: jabatan, status kerja, PTKP, gaji, tunjangan, BPJS, rekening, cuti, dan kontrak.',
      pay: 'Satu baris per karyawan per bulan: absensi, lembur, bonus. BPJS, PPh 21, dan take home pay otomatis.',
      slip: 'Pilih bulan dan karyawan, slip gaji siap cetak langsung terisi.',
      month: 'Total gaji, BPJS, PPh 21, take home pay, dan biaya perusahaan per bulan.',
      empSum: 'Ringkasan setahun per karyawan: kehadiran, lembur, penghasilan, dan PPh 21.',
      rates:
        'Tarif BPJS, PTKP, Pasal 17, biaya jabatan, dan tabel TER PPh 21. Bisa diubah bila aturan berubah.',
      set: 'Nama perusahaan, tahun, alamat, dan daftar departemen.',
    },
    subtitle: {
      menu: 'Template penggajian lengkap dengan BPJS dan PPh 21 TER. Isi data karyawan, lalu catat gaji tiap bulan.',
      emp: 'Satu baris per karyawan. ID harus unik. Kolom abu-abu terhitung otomatis.',
      pay: 'Satu baris per karyawan per bulan. Isi absensi, lembur, bonus, dan potongan; sisanya otomatis.',
      slip: 'Pilih bulan dan ID karyawan, lalu cetak (Ctrl+P). Data diambil dari sheet Penggajian.',
      month: 'Dihitung dari sheet Penggajian. Tidak perlu diisi.',
      empSum: 'Dihitung dari sheet Penggajian untuk tahun ini. Bahan untuk bukti potong 1721-A1.',
      rates:
        'Nilai di sini dipakai semua rumus. Periksa setiap awal tahun, terutama batas upah Jaminan Pensiun.',
      set: 'Atur sekali di awal. Departemen dipakai di dropdown sheet Karyawan.',
      dash: 'Pilih bulan di bawah. Angka bulanan dan grafik ikut berubah.',
    },
    steps: [
      'Buka Pengaturan dan Tarif & BPJS: isi nama perusahaan, departemen, dan tarif JKK sesuai risiko usaha.',
      'Isi sheet Karyawan: gaji pokok, tunjangan, status PTKP, dan kepesertaan BPJS.',
      'Setiap bulan, tambah satu baris per karyawan di Penggajian. Slip gaji, rekap, dan dashboard terisi otomatis.',
    ],
    startHere: 'Mulai dalam 3 langkah',
    contents: 'Isi workbook',
    legend: 'Arti warna sel',
    legendInput: 'Isi di sini',
    legendCalc: 'Otomatis (jangan diubah)',
    footer: 'Template gratis dari Toolland · julian-marcell.com/template',
    made: 'Dibuat',
    fiscal: 'Tahun ',
    disclaimer:
      'Perhitungan PPh 21 dan BPJS mengikuti aturan umum (PP 58/2023, PMK 168/2023). Kasus khusus seperti karyawan keluar di tengah tahun, pegawai tidak tetap, atau PPh ditanggung perusahaan perlu dihitung manual atau dicek konsultan pajak.',
    // Pengaturan
    profile: 'Profil perusahaan',
    company: 'Nama perusahaan',
    year: 'Tahun penggajian',
    address: 'Alamat',
    hr: 'Penanggung jawab HR',
    deptH: 'Departemen',
    deptName: 'Nama departemen',
    deptCount: 'Karyawan aktif',
    setNote:
      'Isi daftar dari atas tanpa baris kosong di tengah. Mengganti nama departemen tidak mengubah data lama di sheet Karyawan.',
    // Tarif
    bpjsH: 'Iuran BPJS',
    bpjsHead: ['Program', 'Perusahaan', 'Karyawan', 'Batas upah'],
    kes: 'BPJS Kesehatan',
    jht: 'JHT (Jaminan Hari Tua)',
    jp: 'JP (Jaminan Pensiun)',
    jkk: 'JKK (Kecelakaan Kerja)',
    jkm: 'JKM (Kematian)',
    noCap: 'tanpa batas',
    jkkNote:
      'JKK: 0,24% risiko sangat rendah · 0,54% rendah · 0,89% sedang · 1,27% tinggi · 1,74% sangat tinggi.',
    ptkpH: 'PTKP dan kategori TER',
    ptkpHead: ['Status', 'PTKP setahun', 'Kategori TER'],
    p17H: 'Tarif Pasal 17 (PPh setahun)',
    p17Head: ['PKP sampai', 'Tarif'],
    above: 'di atasnya',
    bjH: 'Biaya jabatan',
    bjRate: 'Tarif',
    bjMax: 'Maksimal / bulan',
    terH: 'Tarif efektif rata-rata (TER) PPh 21 bulanan',
    terHead: ['Bruto dari', 'sampai', 'Tarif'],
    terNote:
      'Sumber: Lampiran PP 58/2023. Kategori A: TK/0, TK/1, K/0. Kategori B: TK/2, TK/3, K/1, K/2. Kategori C: K/3.',
    // Karyawan
    emp: [
      'ID',
      'Nama lengkap',
      'Departemen',
      'Jabatan',
      'Status kerja',
      'Tanggal masuk',
      'Akhir kontrak',
      'Status PTKP',
      'L/P',
      'Tanggal lahir',
      'NIK / NPWP',
      'Gaji pokok',
      'Tunjangan tetap',
      'Uang makan & transport / hari',
      'BPJS Kes',
      'BPJS TK',
      'Jatah cuti / tahun',
      'Bank',
      'No. rekening',
      'Status',
      'Tanggal keluar',
      'Masa kerja',
      'Kategori TER',
      'PTKP setahun',
      'Cuti terpakai',
      'Sisa cuti',
      'Sisa kontrak (hari)',
    ],
    workStatus: ['Tetap', 'Kontrak', 'Percobaan', 'Magang'],
    yes: 'Ya',
    no: 'Tidak',
    gender: ['L', 'P'],
    active: 'Aktif',
    left: 'Keluar',
    yearsShort: ' th ',
    monthsShort: ' bl',
    idDup: 'ID sudah dipakai',
    idDupMsg: 'Setiap karyawan harus punya ID yang berbeda.',
    idPrompt: 'Kode unik karyawan, misalnya K-001. Dipakai di sheet Penggajian.',
    ptkpPrompt: 'TK = tidak kawin, K = kawin, angka = jumlah tanggungan (maks. 3).',
    basePrompt:
      'Gaji pokok sebulan. Gaji pokok + tunjangan tetap menjadi dasar iuran BPJS dan lembur.',
    numErr: 'Isi angka 0 atau lebih.',
    dateMsg: 'Tulis tanggal, misalnya 15/03/2026.',
    // Penggajian
    pay: [
      'Bulan',
      'ID',
      'Nama',
      'Hari kerja',
      'Hadir',
      'Sakit',
      'Izin',
      'Cuti',
      'Alpa',
      'Lembur jam ke-1',
      'Lembur jam berikutnya',
      'Bonus / insentif',
      'Potongan lain',
      'Gaji pokok',
      'Tunjangan tetap',
      'Uang makan & transport',
      'Upah lembur',
      'Total pendapatan',
      'BPJS Kes (1%)',
      'JHT (2%)',
      'JP (1%)',
      'PPh 21',
      'Take home pay',
      'BPJS perusahaan',
      'Biaya perusahaan',
    ],
    pickMonth: 'Bulan gaji',
    pickEmp: 'ID karyawan',
    pickEmpMsg: 'Pilih ID dari sheet Karyawan. Nama dan gaji terisi otomatis.',
    otMsg:
      'Jumlah jam lembur pertama di setiap hari lembur (dibayar 1,5x upah sejam). Upah sejam = (gaji pokok + tunjangan tetap) / 173.',
    ot2Msg: 'Jam lembur kedua dan seterusnya (dibayar 2x upah sejam).',
    otherMsg: 'Kasbon, denda, atau potongan lain yang mengurangi take home pay.',
    dupPay: 'Karyawan ini sudah punya baris gaji di bulan yang sama.',
    // Slip
    slipTitle: 'SLIP GAJI',
    period: 'Periode',
    slipEmp: 'Data karyawan',
    name: 'Nama',
    position: 'Jabatan',
    dept: 'Departemen',
    ptkp: 'Status PTKP',
    account: 'Rekening',
    earnings: 'PENDAPATAN',
    deductions: 'POTONGAN',
    basic: 'Gaji pokok',
    allowance: 'Tunjangan tetap',
    daily: 'Uang makan & transport',
    overtime: 'Upah lembur',
    bonus: 'Bonus / insentif',
    totalEarn: 'Total pendapatan',
    kesEe: 'BPJS Kesehatan (1%)',
    jhtEe: 'BPJS JHT (2%)',
    jpEe: 'BPJS JP (1%)',
    pph: 'PPh 21',
    pphRefund: 'PPh 21 (lebih potong, dikembalikan)',
    decNote: 'Desember: hitung ulang setahun',
    other: 'Potongan lain',
    totalDed: 'Total potongan',
    thp: 'TAKE HOME PAY',
    attendance: 'Kehadiran',
    attHead: ['Hari kerja', 'Hadir', 'Sakit', 'Izin', 'Cuti', 'Alpa'],
    employerInfo: 'Dibayar perusahaan (tidak memotong gaji): iuran BPJS ',
    grossInfo: 'Penghasilan bruto untuk PPh 21: ',
    notFound: 'Belum ada data gaji untuk bulan dan ID ini.',
    received: 'Diterima oleh,',
    approved: 'Disetujui oleh,',
    days: ' hari',
    hours: ' jam',
    // Rekap bulanan
    monthHead: [
      'Bulan',
      'Karyawan dibayar',
      'Gaji & tunjangan',
      'Upah lembur',
      'Bonus',
      'Total pendapatan',
      'BPJS karyawan',
      'PPh 21',
      'Potongan lain',
      'Take home pay',
      'BPJS perusahaan',
      'Biaya perusahaan',
      'Kehadiran',
      'Jam lembur',
    ],
    total: 'Total',
    // Rekap karyawan
    sumHead: [
      'ID',
      'Nama',
      'Departemen',
      'Bulan dibayar',
      'Hadir',
      'Sakit',
      'Izin',
      'Cuti',
      'Alpa',
      'Jam lembur',
      'Total pendapatan',
      'Bruto pajak',
      'BPJS karyawan',
      'PPh 21 setahun',
      'Take home pay',
      'Biaya perusahaan',
    ],
    // Dashboard
    pickMonthDash: 'Bulan dipilih',
    monthNo: '"(bulan ke-"0")"',
    kEmp: 'Karyawan aktif',
    kIncome: 'Total pendapatan',
    kThp: 'Take home pay',
    kCost: 'Biaya perusahaan',
    kTax: 'PPh 21 bulan ini',
    kBpjs: 'Iuran BPJS bulan ini',
    kAtt: 'Tingkat kehadiran',
    kOt: 'Lembur bulan ini',
    permanent: ' tetap · ',
    contract: ' kontrak',
    paidNote: ' karyawan dibayar',
    vsPrev: 'vs bulan lalu: ',
    perEmp: 'Rata-rata per orang: ',
    eeEr: 'Karyawan + perusahaan',
    absentNote: ' hari alpa',
    otUnit: '#,##0" jam"',
    chartCost: 'Biaya gaji per bulan',
    chartDept: 'Karyawan aktif per departemen',
    chartAtt: 'Tingkat kehadiran per bulan',
    contractH: 'Kontrak berakhir ≤ 60 hari',
    contractHead: ['Nama', 'Departemen', 'Akhir kontrak', 'Sisa hari'],
    noContract: 'Tidak ada kontrak yang segera berakhir.',
    sample: {
      jobs: [
        'Manajer Operasional',
        'Staf Gudang',
        'Staf Gudang',
        'Sales',
        'Sales',
        'Kepala Keuangan',
        'Staf Akuntansi',
        'Admin',
        'Supervisor Penjualan',
        'Kurir',
        'Staf IT',
        'Customer Service',
      ],
      banks: ['BCA', 'Mandiri', 'BRI', 'BNI'],
    },
  },
  en: {
    brand: 'TOOLLAND · HR & PAYROLL',
    templateName: 'HR & Payroll',
    menu: 'Menu',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      emp: 'Employees',
      pay: 'Payroll',
      slip: 'Payslip',
      month: 'Monthly Summary',
      empSum: 'Employee Summary',
      rates: 'Tax & BPJS Rates',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Headcount, total pay, take-home pay, company cost, income tax, BPJS, attendance, and charts.',
      emp: 'Employee records: position, employment type, tax status, salary, allowances, BPJS, bank account, leave, and contract.',
      pay: 'One row per employee per month: attendance, overtime, bonus. BPJS, PPh 21, and take-home pay are automatic.',
      slip: 'Choose a month and an employee to get a printable payslip.',
      month: 'Total pay, BPJS, PPh 21, take-home pay, and company cost by month.',
      empSum: 'Yearly summary per employee: attendance, overtime, income, and PPh 21.',
      rates:
        'BPJS rates, PTKP, Article 17 brackets, job expense, and PPh 21 TER tables. Edit them when the rules change.',
      set: 'Company name, year, address, and departments.',
    },
    subtitle: {
      menu: 'A complete Indonesian payroll template with BPJS and PPh 21 (TER). Add your employees, then record pay each month.',
      emp: 'One row per employee. IDs must be unique. Grey columns are calculated.',
      pay: 'One row per employee per month. Fill in attendance, overtime, bonus, and deductions; the rest is automatic.',
      slip: 'Choose a month and employee ID, then print (Ctrl+P). Data comes from the Payroll sheet.',
      month: 'Calculated from the Payroll sheet. Nothing to fill in.',
      empSum: 'Calculated from the Payroll sheet for this year. Useful for the 1721-A1 tax slip.',
      rates:
        'Every formula uses these values. Check them at the start of each year, especially the pension wage cap.',
      set: 'Set this up once. Departments feed the dropdown in Employees.',
      dash: 'Choose a month below. Monthly numbers and charts follow.',
    },
    steps: [
      'Open Settings and Tax & BPJS Rates: enter the company name, departments, and the JKK rate for your risk level.',
      'Fill in Employees: base salary, allowances, PTKP status, and BPJS enrolment.',
      'Each month, add one row per employee in Payroll. Payslips, summaries, and the dashboard fill in automatically.',
    ],
    startHere: 'Start in 3 steps',
    contents: 'What’s inside',
    legend: 'Cell colours',
    legendInput: 'Type here',
    legendCalc: 'Automatic (don’t edit)',
    footer: 'Free template from Toolland · julian-marcell.com/en/templates',
    made: 'Created',
    fiscal: 'Year ',
    disclaimer:
      'PPh 21 and BPJS follow the general Indonesian rules (PP 58/2023, PMK 168/2023). Special cases such as employees leaving mid-year, non-permanent workers, or tax borne by the company need a manual check or a tax adviser.',
    profile: 'Company profile',
    company: 'Company name',
    year: 'Payroll year',
    address: 'Address',
    hr: 'HR contact',
    deptH: 'Departments',
    deptName: 'Department name',
    deptCount: 'Active staff',
    setNote:
      'Fill lists from the top without blank rows in between. Renaming a department does not update existing employees.',
    bpjsH: 'BPJS contributions',
    bpjsHead: ['Programme', 'Employer', 'Employee', 'Wage cap'],
    kes: 'BPJS Health',
    jht: 'JHT (old-age savings)',
    jp: 'JP (pension)',
    jkk: 'JKK (work accident)',
    jkm: 'JKM (death)',
    noCap: 'no cap',
    jkkNote: 'JKK: 0.24% very low risk · 0.54% low · 0.89% medium · 1.27% high · 1.74% very high.',
    ptkpH: 'PTKP (tax-free allowance) and TER category',
    ptkpHead: ['Status', 'Yearly PTKP', 'TER category'],
    p17H: 'Article 17 rates (yearly tax)',
    p17Head: ['Taxable income up to', 'Rate'],
    above: 'above',
    bjH: 'Job expense deduction',
    bjRate: 'Rate',
    bjMax: 'Max per month',
    terH: 'PPh 21 monthly average effective rates (TER)',
    terHead: ['Gross from', 'to', 'Rate'],
    terNote:
      'Source: Appendix to PP 58/2023. Category A: TK/0, TK/1, K/0. Category B: TK/2, TK/3, K/1, K/2. Category C: K/3.',
    emp: [
      'ID',
      'Full name',
      'Department',
      'Position',
      'Employment',
      'Start date',
      'Contract end',
      'PTKP status',
      'M/F',
      'Date of birth',
      'NIK / tax ID',
      'Base salary',
      'Fixed allowance',
      'Meal & transport / day',
      'BPJS Health',
      'BPJS Employment',
      'Leave days / year',
      'Bank',
      'Account no.',
      'Status',
      'Exit date',
      'Length of service',
      'TER category',
      'Yearly PTKP',
      'Leave used',
      'Leave left',
      'Contract days left',
    ],
    workStatus: ['Permanent', 'Contract', 'Probation', 'Intern'],
    yes: 'Yes',
    no: 'No',
    gender: ['M', 'F'],
    active: 'Active',
    left: 'Left',
    yearsShort: ' y ',
    monthsShort: ' m',
    idDup: 'ID already used',
    idDupMsg: 'Every employee needs a different ID.',
    idPrompt: 'Unique employee code, for example E-001. Used in the Payroll sheet.',
    ptkpPrompt: 'TK = single, K = married, number = dependants (max 3).',
    basePrompt: 'Monthly base salary. Base + fixed allowance is the basis for BPJS and overtime.',
    numErr: 'Enter a number of 0 or more.',
    dateMsg: 'Type a date, for example 15 Mar 2026.',
    pay: [
      'Month',
      'ID',
      'Name',
      'Work days',
      'Present',
      'Sick',
      'Permission',
      'Leave',
      'Absent',
      'Overtime 1st hour',
      'Overtime later hours',
      'Bonus / incentive',
      'Other deductions',
      'Base salary',
      'Fixed allowance',
      'Meal & transport',
      'Overtime pay',
      'Total earnings',
      'BPJS Health (1%)',
      'JHT (2%)',
      'JP (1%)',
      'PPh 21',
      'Take-home pay',
      'Employer BPJS',
      'Company cost',
    ],
    pickMonth: 'Pay month',
    pickEmp: 'Employee ID',
    pickEmpMsg: 'Pick an ID from Employees. Name and salary fill in automatically.',
    otMsg:
      'Number of first overtime hours across overtime days (paid 1.5x the hourly wage). Hourly wage = (base + fixed allowance) / 173.',
    ot2Msg: 'Second and later overtime hours (paid 2x the hourly wage).',
    otherMsg: 'Cash advances, fines, or other deductions from take-home pay.',
    dupPay: 'This employee already has a payroll row for the same month.',
    slipTitle: 'PAYSLIP',
    period: 'Period',
    slipEmp: 'Employee details',
    name: 'Name',
    position: 'Position',
    dept: 'Department',
    ptkp: 'PTKP status',
    account: 'Bank account',
    earnings: 'EARNINGS',
    deductions: 'DEDUCTIONS',
    basic: 'Base salary',
    allowance: 'Fixed allowance',
    daily: 'Meal & transport',
    overtime: 'Overtime pay',
    bonus: 'Bonus / incentive',
    totalEarn: 'Total earnings',
    kesEe: 'BPJS Health (1%)',
    jhtEe: 'BPJS JHT (2%)',
    jpEe: 'BPJS JP (1%)',
    pph: 'PPh 21',
    pphRefund: 'PPh 21 (over-withheld, refunded)',
    decNote: 'December: yearly recalculation',
    other: 'Other deductions',
    totalDed: 'Total deductions',
    thp: 'TAKE-HOME PAY',
    attendance: 'Attendance',
    attHead: ['Work days', 'Present', 'Sick', 'Permission', 'Leave', 'Absent'],
    employerInfo: 'Paid by the company (not deducted): BPJS contributions ',
    grossInfo: 'Gross income for PPh 21: ',
    notFound: 'No payroll row yet for this month and ID.',
    received: 'Received by,',
    approved: 'Approved by,',
    days: ' days',
    hours: ' hours',
    monthHead: [
      'Month',
      'Employees paid',
      'Salary & allowances',
      'Overtime pay',
      'Bonus',
      'Total earnings',
      'Employee BPJS',
      'PPh 21',
      'Other deductions',
      'Take-home pay',
      'Employer BPJS',
      'Company cost',
      'Attendance',
      'Overtime hours',
    ],
    total: 'Total',
    sumHead: [
      'ID',
      'Name',
      'Department',
      'Months paid',
      'Present',
      'Sick',
      'Permission',
      'Leave',
      'Absent',
      'Overtime hours',
      'Total earnings',
      'Taxable gross',
      'Employee BPJS',
      'PPh 21 for the year',
      'Take-home pay',
      'Company cost',
    ],
    pickMonthDash: 'Selected month',
    monthNo: '"(month "0")"',
    kEmp: 'Active employees',
    kIncome: 'Total earnings',
    kThp: 'Take-home pay',
    kCost: 'Company cost',
    kTax: 'PPh 21 this month',
    kBpjs: 'BPJS this month',
    kAtt: 'Attendance rate',
    kOt: 'Overtime this month',
    permanent: ' permanent · ',
    contract: ' contract',
    paidNote: ' employees paid',
    vsPrev: 'vs last month: ',
    perEmp: 'Average per person: ',
    eeEr: 'Employee + employer',
    absentNote: ' days absent',
    otUnit: '#,##0" h"',
    chartCost: 'Payroll cost by month',
    chartDept: 'Active employees by department',
    chartAtt: 'Attendance rate by month',
    contractH: 'Contracts ending within 60 days',
    contractHead: ['Name', 'Department', 'Contract end', 'Days left'],
    noContract: 'No contracts ending soon.',
    sample: {
      jobs: [
        'Operations Manager',
        'Warehouse Staff',
        'Warehouse Staff',
        'Sales',
        'Sales',
        'Head of Finance',
        'Accountant',
        'Admin',
        'Sales Supervisor',
        'Courier',
        'IT Staff',
        'Customer Service',
      ],
      banks: ['BCA', 'Mandiri', 'BRI', 'BNI'],
    },
  },
};

/** Contoh karyawan: nama, indeks departemen, indeks jabatan, status kerja, PTKP, gaji, tunjangan, uang harian. */
const SAMPLE_EMP: [string, number, number, number, string, number, number, number][] = [
  ['Budi Santoso', 0, 0, 0, 'K/2', 14_500_000, 2_500_000, 50_000],
  ['Agus Pratama', 3, 1, 0, 'K/1', 5_200_000, 300_000, 40_000],
  ['Rina Wulandari', 3, 2, 1, 'TK/0', 4_900_000, 200_000, 40_000],
  ['Dewi Lestari', 1, 3, 0, 'TK/1', 5_800_000, 500_000, 45_000],
  ['Fajar Nugroho', 1, 4, 1, 'TK/0', 5_100_000, 400_000, 45_000],
  ['Siti Rahmawati', 2, 5, 0, 'K/3', 18_000_000, 3_000_000, 50_000],
  ['Andi Saputra', 2, 6, 0, 'K/0', 7_500_000, 750_000, 45_000],
  ['Maya Puspita', 4, 7, 2, 'TK/0', 4_800_000, 0, 40_000],
  ['Hendra Wijaya', 1, 8, 0, 'K/1', 9_800_000, 1_500_000, 50_000],
  ['Joko Susilo', 0, 9, 1, 'K/2', 4_700_000, 200_000, 40_000],
  ['Putri Anggraini', 4, 10, 0, 'TK/2', 8_500_000, 1_000_000, 45_000],
  ['Rizky Ramadhan', 4, 11, 3, 'TK/0', 3_000_000, 0, 35_000],
];

export function buildPayrollWorkbook(opts: PayrollOptions): Workbook {
  const { locale } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.secang;
  const st = makeStyles(accent, 'IDR', locale);
  const months = MONTHS[locale];
  const YES = q(t.yes);

  const departments = cleanList(opts.departments, PAYROLL_LIMITS.departments);
  if (!departments.length) departments.push(...DEFAULT_DEPARTMENTS[locale]);
  const nDept = departments.length + SPARE;
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const jkk = [0.24, 0.54, 0.89, 1.27, 1.74].includes(opts.jkk) ? opts.jkk : 0.24;
  const company =
    opts.company.trim().slice(0, 80) ||
    (locale === 'id' ? 'Nama Perusahaan Anda' : 'Your Company Name');

  const wb = new Workbook({
    title: `${t.templateName} – ${company}`,
    subject: t.templateName,
    company,
  });
  const menu = { label: t.menu, sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };

  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shEmp = wb.addSheet(S.emp, { tabColor: '2C4A86', ...landscape });
  const shPay = wb.addSheet(S.pay, { tabColor: '8F5E0A', ...landscape });
  const shSlip = wb.addSheet(S.slip, { tabColor: '3C6A33', gridlines: false, fitWidth: true });
  const shMonth = wb.addSheet(S.month, { tabColor: 'A8461F', ...landscape });
  const shSum = wb.addSheet(S.empSum, { tabColor: 'A8461F', ...landscape });
  const shRates = wb.addSheet(S.rates, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const empLast = FIRST + EMP_ROWS - 1;
  const payLast = FIRST + PAY_ROWS - 1;
  const empCol = (c: string) => ref(S.emp, `$${c}$${FIRST}:$${c}$${empLast}`);
  const payCol = (c: string) => ref(S.pay, `$${c}$${FIRST}:$${c}$${payLast}`);

  const sample = opts.sample ? makeSample() : undefined;

  // ---------- Daftar tersembunyi ----------
  months.long.forEach((m, i) => shList.set(`B${i + 2}`, m));
  wb.defineName('Months', ref(S.list, '$B$2:$B$13'));
  t.workStatus.forEach((x, i) => shList.set(`D${i + 2}`, x));
  wb.defineName('WorkStatuses', ref(S.list, `$D$2:$D$${1 + t.workStatus.length}`));
  shList.set('F2', t.yes).set('F3', t.no);
  wb.defineName('YesNo', ref(S.list, '$F$2:$F$3'));
  t.gender.forEach((x, i) => shList.set(`H${i + 2}`, x));
  wb.defineName('Genders', ref(S.list, '$H$2:$H$3'));
  shList.set('J2', t.active).set('J3', t.left);
  wb.defineName('EmpStatuses', ref(S.list, '$J$2:$J$3'));

  // ---------- Tarif & BPJS ----------
  sheetHeader(shRates, st, {
    brand: t.brand,
    title: S.rates,
    subtitle: t.subtitle.rates,
    lastCol: 'P',
    menu,
  });
  shRates.widths({
    B: 24,
    C: 13,
    D: 13,
    E: 16,
    F: 3,
    G: 15,
    H: 15,
    I: 8,
    J: 3,
    K: 15,
    L: 15,
    M: 8,
    N: 3,
    O: 15,
    P: 15,
  });
  shRates.width('Q', 8);
  const pct2: Style = { ...st.input, numFmt: '0.00"%"', align: { h: 'center' } };
  const pctCalc: Style = { ...st.calc, numFmt: '0.00"%"', align: { h: 'center' } };
  shRates.merge('B5:E5', t.bpjsH, st.h2);
  t.bpjsHead.forEach((h, i) => shRates.set(`${'BCDE'[i]}6`, h, i ? st.th : st.thLeft));
  shRates.height(6, 24);
  const bpjsRows: [string, number | null, number | null, number | string, string[]][] = [
    [t.kes, BPJS.kesEr, BPJS.kesEe, BPJS.kesCap, ['KesEr', 'KesEe', 'KesCap']],
    [t.jht, BPJS.jhtEr, BPJS.jhtEe, t.noCap, ['JhtEr', 'JhtEe']],
    [t.jp, BPJS.jpEr, BPJS.jpEe, BPJS.jpCap, ['JpEr', 'JpEe', 'JpCap']],
    [t.jkk, jkk, null, t.noCap, ['JkkRate']],
    [t.jkm, BPJS.jkm, null, t.noCap, ['JkmRate']],
  ];
  bpjsRows.forEach(([label, er, ee, cap, names], i) => {
    const r = 7 + i;
    shRates.set(`B${r}`, label, st.rowLabel).set(`C${r}`, er, pct2);
    shRates.set(`D${r}`, ee, ee === null ? pctCalc : pct2);
    shRates.set(`E${r}`, cap, typeof cap === 'number' ? st.inputMoney : st.calcCenter);
    // Nama rentang menyimpan persen sebagai angka 0-100; rumus membaginya dengan 100.
    wb.defineName(names[0], ref(S.rates, `$C$${r}`));
    if (names[1]?.endsWith('Ee')) wb.defineName(names[1], ref(S.rates, `$D$${r}`));
    const capName = names.find((n) => n.endsWith('Cap'));
    if (capName) wb.defineName(capName, ref(S.rates, `$E$${r}`));
  });
  shRates.merge('B12:E13', t.jkkNote, st.note);

  // PTKP
  shRates.merge('B15:E15', t.ptkpH, st.h2);
  t.ptkpHead.forEach((h, i) => shRates.set(`${'BCD'[i]}16`, h, i ? st.th : st.thLeft));
  PTKP.forEach(([status, amount, cat], i) => {
    const r = 17 + i;
    shRates
      .set(`B${r}`, status, { ...st.rowLabel, font: { size: 10, bold: true } })
      .set(`C${r}`, amount, st.inputMoney)
      .set(`D${r}`, cat, { ...st.calcCenter, font: { size: 10, bold: true } });
  });
  wb.defineName('PtkpStatus', ref(S.rates, '$B$17:$B$24'));
  wb.defineName('PtkpAmount', ref(S.rates, '$C$17:$C$24'));
  wb.defineName('PtkpCat', ref(S.rates, '$D$17:$D$24'));

  // Pasal 17 + biaya jabatan
  shRates.merge('B26:D26', t.p17H, st.h2);
  shRates.merge('B27:C27', t.p17Head[0], st.thLeft).set('D27', t.p17Head[1], st.th);
  PASAL17.forEach(([cap, rate], i) => {
    const r = 28 + i;
    shRates
      .merge(
        `B${r}:C${r}`,
        Number.isFinite(cap) ? cap : t.above,
        Number.isFinite(cap) ? st.inputMoney : st.calcText,
      )
      .set(`D${r}`, rate, pct2);
  });
  for (let i = 0; i < 4; i++) wb.defineName(`PajakBatas${i + 1}`, ref(S.rates, `$B$${28 + i}`));
  for (let i = 0; i < 5; i++) wb.defineName(`PajakTarif${i + 1}`, ref(S.rates, `$D$${28 + i}`));
  shRates.merge('B34:D34', t.bjH, st.h2);
  shRates.set('B35', t.bjRate, st.rowLabel).merge('C35:D35', BIAYA_JABATAN.rate, pct2);
  shRates.set('B36', t.bjMax, st.rowLabel).merge('C36:D36', BIAYA_JABATAN.maxMonth, st.inputMoney);
  wb.defineName('JabatanRate', ref(S.rates, '$C$35'));
  wb.defineName('JabatanMax', ref(S.rates, '$C$36'));
  shRates.merge('B38:E42', t.disclaimer, st.note);

  // Tabel TER: tiga blok berdampingan (G:I, K:M, O:Q).
  shRates.merge('G5:Q5', t.terH, st.h2);
  shRates.merge('G6:Q7', t.terNote, st.note);
  (['A', 'B', 'C'] as const).forEach((cat, k) => {
    const [c1, c2, c3] = [
      ['G', 'H', 'I'],
      ['K', 'L', 'M'],
      ['O', 'P', 'Q'],
    ][k];
    shRates.merge(`${c1}8:${c3}8`, `${locale === 'id' ? 'Kategori' : 'Category'} ${cat}`, {
      ...st.section,
      align: { h: 'center' },
    });
    t.terHead.forEach((h, i) => shRates.set(`${[c1, c2, c3][i]}9`, h, st.th));
    let lower = 0;
    TER[cat].forEach(([cap, rate], i) => {
      const r = 10 + i;
      shRates
        .set(`${c1}${r}`, lower, st.inputMoney)
        .set(
          `${c2}${r}`,
          Number.isFinite(cap) ? cap : t.above,
          Number.isFinite(cap) ? st.calcMoney : st.calcCenter,
        )
        .set(`${c3}${r}`, rate, pct2);
      lower = cap + 1;
    });
    const last = 10 + TER[cat].length - 1;
    wb.defineName(`Ter${cat}Low`, ref(S.rates, `$${c1}$10:$${c1}$${last}`));
    wb.defineName(`Ter${cat}Rate`, ref(S.rates, `$${c3}$10:$${c3}$${last}`));
  });
  shRates.freeze('A10');

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'G',
    menu,
  });
  shSet.widths({ B: 24, C: 36, D: 3, E: 28, F: 14, G: 9 });
  shSet.merge('B5:C5', t.profile, st.h2);
  const profile: [string, string | number, Style][] = [
    [t.company, company, st.inputText],
    [t.year, year, st.inputInt],
    [t.address, '', st.inputText],
    [t.hr, '', st.inputText],
  ];
  profile.forEach(([label, v, style], i) => {
    shSet
      .set(`B${6 + i}`, label, st.label)
      .set(`C${6 + i}`, v, style)
      .height(6 + i, 20);
  });
  shSet.validate('C7', {
    type: 'whole',
    operator: 'between',
    formula1: '2000',
    formula2: '2100',
    error: '2000–2100',
  });
  wb.defineName('CompanyName', ref(S.set, '$C$6'));
  wb.defineName('PayYear', ref(S.set, '$C$7'));
  wb.defineName('CompanyAddress', ref(S.set, '$C$8'));
  shSet.merge('E5:F5', t.deptH, st.h2);
  shSet.set('E6', t.deptName, st.thLeft).set('F6', t.deptCount, st.th).height(6, 26);
  for (let k = 0; k < nDept; k++) {
    const r = 7 + k;
    shSet
      .set(`E${r}`, departments[k] ?? '', st.inputText)
      .set(
        `F${r}`,
        `=IF(E${r}="","",COUNTIFS(EmpDept,E${r},EmpActive,${q(t.active)}))`,
        st.calcInt,
      );
  }
  wb.defineName('Departments', ref(S.set, `$E$7:$E$${6 + nDept}`));
  shSet.merge(`B${8 + nDept}:F${9 + nDept}`, t.setNote, st.note);

  // ---------- Karyawan ----------
  sheetHeader(shEmp, st, {
    brand: t.brand,
    title: S.emp,
    subtitle: t.subtitle.emp,
    lastCol: 'AB',
    menu,
  });
  const EC = [
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
    'AA',
    'AB',
  ];
  const empW = [
    9, 24, 16, 20, 12, 12, 12, 10, 6, 12, 18, 14, 14, 13, 9, 9, 9, 10, 16, 9, 12, 11, 9, 14, 9, 9,
    10,
  ];
  EC.forEach((c, i) => shEmp.width(c, empW[i]));
  shEmp.width('AC', 6, true);
  t.emp.forEach((h, i) => shEmp.set(`${EC[i]}${head}`, h, [1, 3].includes(i) ? st.thLeft : st.th));
  shEmp.set(`AC${head}`, '#').height(head, 40);
  for (let r = FIRST; r <= empLast; r++) {
    const e = sample?.employees[r - FIRST];
    const end = `IF($V${r}<>"",$V${r},TODAY())`;
    shEmp
      .set(`B${r}`, e?.id ?? null, st.inputText)
      .set(`C${r}`, e?.name ?? null, st.inputText)
      .set(`D${r}`, e?.dept ?? null, st.inputText)
      .set(`E${r}`, e?.job ?? null, st.inputText)
      .set(`F${r}`, e?.status ?? null, st.inputText)
      .set(`G${r}`, e?.start ?? null, st.inputDate)
      .set(`H${r}`, e?.end ?? null, st.inputDate)
      .set(`I${r}`, e?.ptkp ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`J${r}`, e?.gender ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`K${r}`, e?.birth ?? null, st.inputDate)
      .set(`L${r}`, null, st.inputText)
      .set(`M${r}`, e?.base ?? null, st.inputMoney)
      .set(`N${r}`, e?.allow ?? null, st.inputMoney)
      .set(`O${r}`, e?.daily ?? null, st.inputMoney)
      .set(`P${r}`, e ? t.yes : null, { ...st.inputText, align: { h: 'center' } })
      .set(`Q${r}`, e ? t.yes : null, { ...st.inputText, align: { h: 'center' } })
      .set(`R${r}`, e ? 12 : null, st.inputInt)
      .set(`S${r}`, e?.bank ?? null, st.inputText)
      .set(`T${r}`, e?.account ?? null, st.inputText)
      .set(`U${r}`, e ? t.active : null, { ...st.inputText, align: { h: 'center' } })
      .set(`V${r}`, null, st.inputDate)
      .set(
        `W${r}`,
        `=IF(OR($B${r}="",$G${r}=""),"",DATEDIF($G${r},${end},"y")&${q(t.yearsShort)}&DATEDIF($G${r},${end},"ym")&${q(t.monthsShort)})`,
        st.calcCenter,
      )
      .set(`X${r}`, `=IF($B${r}="","",IFERROR(INDEX(PtkpCat,MATCH($I${r},PtkpStatus,0)),"?"))`, {
        ...st.calcCenter,
        font: { size: 10, bold: true },
      })
      .set(
        `Y${r}`,
        `=IF($B${r}="","",IFERROR(INDEX(PtkpAmount,MATCH($I${r},PtkpStatus,0)),""))`,
        st.calcMoney,
      )
      .set(`Z${r}`, `=IF($B${r}="","",SUMIFS(PayCuti,PayId,$B${r}))`, st.calcInt)
      .set(`AA${r}`, `=IF($B${r}="","",N($R${r})-N($Z${r}))`, st.calcInt)
      .set(
        `AB${r}`,
        `=IF(OR($B${r}="",$H${r}="",$U${r}=${q(t.left)}),"",$H${r}-TODAY())`,
        st.calcInt,
      )
      .set(
        `AC${r}`,
        `=IF(AND($B${r}<>"",ISNUMBER($AB${r}),N($AB${r})<=60),N(AC${r - 1})+1,N(AC${r - 1}))`,
      );
  }
  const er = (c: string) => `${c}${FIRST}:${c}${empLast}`;
  shEmp.validate(er('B'), {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${empLast},B${FIRST})=1`,
    prompt: t.idPrompt,
    errorTitle: t.idDup,
    error: t.idDupMsg,
  });
  shEmp.validate(er('D'), { type: 'list', formula1: '=Departments' });
  shEmp.validate(er('F'), { type: 'list', formula1: '=WorkStatuses' });
  shEmp.validate(er('I'), { type: 'list', formula1: '=PtkpStatus', prompt: t.ptkpPrompt });
  shEmp.validate(er('J'), { type: 'list', formula1: '=Genders' });
  for (const c of ['P', 'Q']) shEmp.validate(er(c), { type: 'list', formula1: '=YesNo' });
  shEmp.validate(er('U'), { type: 'list', formula1: '=EmpStatuses' });
  for (const c of ['G', 'H', 'K', 'V'])
    shEmp.validate(er(c), {
      type: 'date',
      operator: 'between',
      formula1: 'DATE(1940,1,1)',
      formula2: 'DATE(2100,12,31)',
      errorStyle: 'warning',
      prompt: t.dateMsg,
    });
  shEmp.validate(er('M'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.basePrompt,
    error: t.numErr,
  });
  for (const c of ['N', 'O', 'R'])
    shEmp.validate(er(c), {
      type: 'decimal',
      operator: 'greaterThanOrEqual',
      formula1: '0',
      error: t.numErr,
    });
  shEmp.cond(er('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",COUNTIF($B$${FIRST}:$B$${empLast},$B${FIRST})>1)`,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shEmp.cond(`B${FIRST}:AB${empLast}`, {
    type: 'expression',
    formula: `$U${FIRST}=${q(t.left)}`,
    style: { font: { color: '9A9083', italic: true } },
  });
  shEmp.cond(er('AB'), {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '30',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shEmp.cond(er('AB'), {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '60',
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shEmp.cond(er('AA'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shEmp.freeze(`D${FIRST}`).autoFilter(`B${head}:AB${empLast}`).printTitles(head, head);
  wb.defineName('EmpId', empCol('B'));
  wb.defineName('EmpName', empCol('C'));
  wb.defineName('EmpDept', empCol('D'));
  wb.defineName('EmpJob', empCol('E'));
  wb.defineName('EmpWork', empCol('F'));
  wb.defineName('EmpEnd', empCol('H'));
  wb.defineName('EmpPtkp', empCol('I'));
  wb.defineName('EmpBase', empCol('M'));
  wb.defineName('EmpAllow', empCol('N'));
  wb.defineName('EmpDaily', empCol('O'));
  wb.defineName('EmpKes', empCol('P'));
  wb.defineName('EmpTk', empCol('Q'));
  wb.defineName('EmpBank', empCol('S'));
  wb.defineName('EmpAccount', empCol('T'));
  wb.defineName('EmpActive', empCol('U'));
  wb.defineName('EmpCat', empCol('X'));
  wb.defineName('EmpPtkpAmount', empCol('Y'));
  wb.defineName('EmpDaysLeft', empCol('AB'));
  wb.defineName('EmpContractSeq', empCol('AC'));

  // ---------- Penggajian ----------
  sheetHeader(shPay, st, {
    brand: t.brand,
    title: S.pay,
    subtitle: t.subtitle.pay,
    lastCol: 'Z',
    menu,
  });
  const PC = [
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ];
  const payW = [
    11, 8, 22, 7, 7, 6, 6, 6, 6, 9, 9, 13, 12, 13, 13, 13, 12, 14, 11, 11, 11, 12, 14, 13, 14,
  ];
  PC.forEach((c, i) => shPay.width(c, payW[i]));
  const HID = ['AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK'];
  for (const c of HID) shPay.width(c, 6, true);
  t.pay.forEach((h, i) => shPay.set(`${PC[i]}${head}`, h, i === 2 ? st.thLeft : st.th));
  for (const c of HID) shPay.set(`${c}${head}`, '#');
  shPay.height(head, 40);
  const inputInt = { ...st.inputInt };
  for (let r = FIRST; r <= payLast; r++) {
    const p = sample?.pay[r - FIRST];
    const ix = (name: string) => `INDEX(${name},$AB${r})`;
    const kes = `${ix('EmpKes')}=${YES}`;
    const tk = `${ix('EmpTk')}=${YES}`;
    const kesBase = `MIN($AD${r},KesCap)`;
    const jpBase = `MIN($AD${r},JpCap)`;
    shPay
      .set(`B${r}`, p ? months.long[p.month - 1] : null, st.inputText)
      .set(`C${r}`, p?.id ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`D${r}`, `=IF($C${r}="","",IF($AB${r}="","?",${ix('EmpName')}))`, st.calcText)
      .set(`E${r}`, p?.workDays ?? null, inputInt)
      .set(`F${r}`, p?.present ?? null, inputInt)
      .set(`G${r}`, p?.sick || null, inputInt)
      .set(`H${r}`, p?.permit || null, inputInt)
      .set(`I${r}`, p?.leave || null, inputInt)
      .set(
        `J${r}`,
        `=IF(OR($AB${r}="",$E${r}=""),"",MAX(0,N($E${r})-N($F${r})-N($G${r})-N($H${r})-N($I${r})))`,
        st.calcInt,
      )
      .set(`K${r}`, p?.ot1 || null, st.inputQty)
      .set(`L${r}`, p?.ot2 || null, st.inputQty)
      .set(`M${r}`, p?.bonus || null, st.inputMoney)
      .set(`N${r}`, p?.other || null, st.inputMoney)
      .set(`O${r}`, `=IF($AB${r}="","",N(${ix('EmpBase')}))`, st.calcMoney)
      .set(`P${r}`, `=IF($AB${r}="","",N(${ix('EmpAllow')}))`, st.calcMoney)
      .set(`Q${r}`, `=IF($AB${r}="","",N($F${r})*N(${ix('EmpDaily')}))`, st.calcMoney)
      .set(
        `R${r}`,
        `=IF($AB${r}="","",ROUND((N($K${r})*1.5+N($L${r})*2)*$AD${r}/173,0))`,
        st.calcMoney,
      )
      .set(`S${r}`, `=IF($AB${r}="","",$O${r}+$P${r}+$Q${r}+$R${r}+N($M${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`T${r}`, `=IF($AB${r}="","",IF(${kes},ROUND(${kesBase}*KesEe/100,0),0))`, st.calcMoney)
      .set(`U${r}`, `=IF($AB${r}="","",IF(${tk},ROUND($AD${r}*JhtEe/100,0),0))`, st.calcMoney)
      .set(`V${r}`, `=IF($AB${r}="","",IF(${tk},ROUND(${jpBase}*JpEe/100,0),0))`, st.calcMoney)
      .set(
        `W${r}`,
        `=IF($AB${r}="","",IF($AA${r}<12,$AH${r},ROUND(MIN($AK${r},PajakBatas1)*PajakTarif1/100+MAX(0,MIN($AK${r},PajakBatas2)-PajakBatas1)*PajakTarif2/100+MAX(0,MIN($AK${r},PajakBatas3)-PajakBatas2)*PajakTarif3/100+MAX(0,MIN($AK${r},PajakBatas4)-PajakBatas3)*PajakTarif4/100+MAX(0,$AK${r}-PajakBatas4)*PajakTarif5/100,0)-SUMIFS(PayTer,PayId,$C${r})))`,
        st.calcMoney,
      )
      .set(`X${r}`, `=IF($AB${r}="","",$S${r}-$T${r}-$U${r}-$V${r}-$W${r}-N($N${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true, color: INK },
      })
      .set(
        `Y${r}`,
        `=IF($AB${r}="","",IF(${kes},ROUND(${kesBase}*KesEr/100,0),0)+IF(${tk},ROUND($AD${r}*JhtEr/100,0)+ROUND(${jpBase}*JpEr/100,0)+ROUND($AD${r}*(JkkRate+JkmRate)/100,0),0))`,
        st.calcMoney,
      )
      .set(`Z${r}`, `=IF($AB${r}="","",$S${r}+$Y${r})`, st.calcMoney)
      // Kolom bantu tersembunyi: nomor bulan, baris karyawan, kunci ID|bulan untuk slip, dasar
      // upah BPJS, premi kena pajak, bruto pajak, kategori TER, PPh TER, jam lembur, BPJS
      // karyawan, dan PKP setahun (hanya baris Desember).
      .set(`AA${r}`, `=IF($B${r}="","",IFERROR(MATCH($B${r},Months,0),""))`)
      .set(`AB${r}`, `=IF($C${r}="","",IFERROR(MATCH($C${r},EmpId,0),""))`)
      .set(`AC${r}`, `=IF(OR($AA${r}="",$C${r}=""),"",$C${r}&"|"&$AA${r})`)
      .set(`AD${r}`, `=IF($AB${r}="","",$O${r}+$P${r})`)
      .set(
        `AE${r}`,
        `=IF($AB${r}="","",IF(${kes},ROUND(${kesBase}*KesEr/100,0),0)+IF(${tk},ROUND($AD${r}*(JkkRate+JkmRate)/100,0),0))`,
      )
      .set(`AF${r}`, `=IF($AB${r}="","",$S${r}+$AE${r})`)
      .set(`AG${r}`, `=IF($AB${r}="","",${ix('EmpCat')}&"")`)
      .set(
        `AH${r}`,
        `=IF($AB${r}="","",IF($AA${r}=12,0,ROUND($AF${r}*IF($AG${r}="A",LOOKUP($AF${r},TerALow,TerARate),IF($AG${r}="B",LOOKUP($AF${r},TerBLow,TerBRate),LOOKUP($AF${r},TerCLow,TerCRate)))/100,0)))`,
      )
      .set(`AI${r}`, `=IF($AB${r}="","",N($K${r})+N($L${r}))`)
      .set(`AJ${r}`, `=IF($AB${r}="","",$T${r}+$U${r}+$V${r})`)
      .set(
        `AK${r}`,
        `=IF(OR($AB${r}="",$AA${r}<>12),"",FLOOR(MAX(0,SUMIFS(PayGross,PayId,$C${r})-MIN(SUMIFS(PayGross,PayId,$C${r})*JabatanRate/100,JabatanMax*COUNTIF(PayId,$C${r}))-SUMIFS(PayJht,PayId,$C${r})-SUMIFS(PayJp,PayId,$C${r})-N(${ix('EmpPtkpAmount')})),1000))`,
      );
  }
  const pr = (c: string) => `${c}${FIRST}:${c}${payLast}`;
  shPay.validate(pr('B'), { type: 'list', formula1: '=Months', prompt: t.pickMonth });
  shPay.validate(pr('C'), {
    type: 'list',
    formula1: '=EmpId',
    promptTitle: t.pickEmp,
    prompt: t.pickEmpMsg,
  });
  for (const c of ['E', 'F', 'G', 'H', 'I'])
    shPay.validate(pr(c), {
      type: 'whole',
      operator: 'between',
      formula1: '0',
      formula2: '31',
      error: '0–31',
    });
  shPay.validate(pr('K'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.otMsg,
    error: t.numErr,
  });
  shPay.validate(pr('L'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.ot2Msg,
    error: t.numErr,
  });
  shPay.validate(pr('M'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    error: t.numErr,
  });
  shPay.validate(pr('N'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.otherMsg,
    error: t.numErr,
  });
  shPay.cond(pr('C'), {
    type: 'expression',
    formula: `AND($AC${FIRST}<>"",COUNTIF($AC$${FIRST}:$AC$${payLast},$AC${FIRST})>1)`,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shPay.cond(pr('D'), {
    type: 'cellIs',
    operator: 'equal',
    formula: '"?"',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shPay.cond(pr('J'), {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { fill: WARN_BG, font: { color: WARN, bold: true } },
  });
  shPay.cond(pr('W'), {
    type: 'cellIs',
    operator: 'lessThan',
    formula: '0',
    style: { fill: GOOD_BG, font: { color: GOOD, bold: true } },
  });
  shPay.freeze(`E${FIRST}`).autoFilter(`B${head}:Z${payLast}`).printTitles(head, head);
  const payNames: [string, string][] = [
    ['PayMonth', 'AA'],
    ['PayId', 'C'],
    ['PayWorkDays', 'E'],
    ['PayPresent', 'F'],
    ['PaySick', 'G'],
    ['PayPermit', 'H'],
    ['PayCuti', 'I'],
    ['PayAbsent', 'J'],
    ['PayBonus', 'M'],
    ['PayOther', 'N'],
    ['PayBasic', 'O'],
    ['PayAllow', 'P'],
    ['PayDaily', 'Q'],
    ['PayOt', 'R'],
    ['PayIncome', 'S'],
    ['PayKes', 'T'],
    ['PayJht', 'U'],
    ['PayJp', 'V'],
    ['PayTax', 'W'],
    ['PayThp', 'X'],
    ['PayBpjsEr', 'Y'],
    ['PayCost', 'Z'],
    ['PayKey', 'AC'],
    ['PayGross', 'AF'],
    ['PayTer', 'AH'],
    ['PayOtHours', 'AI'],
    ['PayBpjsEe', 'AJ'],
  ];
  for (const [n, c] of payNames) wb.defineName(n, payCol(c));

  // ---------- Slip Gaji ----------
  sheetHeader(shSlip, st, {
    brand: t.brand,
    title: S.slip,
    subtitle: t.subtitle.slip,
    lastCol: 'G',
    menu,
  });
  shSlip.widths({ B: 24, C: 17, D: 3, E: 24, F: 17, G: 9 });
  shSlip.width('I', 6, true).width('J', 6, true);
  const pick = { ...st.inputText, font: { size: 11, bold: true } };
  // Slip contoh menampilkan bulan biasa (bukan Desember yang berisi hitung ulang setahun).
  const lastPay = sample?.pay.at(-1);
  shSlip
    .set('B5', t.pickMonth, st.label)
    .set('C5', months.long[lastPay ? Math.min(lastPay.month, 11) - 1 : 0], pick)
    .set('E5', t.pickEmp, st.label)
    .set('F5', sample?.employees[0]?.id ?? '', pick)
    .height(5, 22);
  shSlip.validate('C5', { type: 'list', formula1: '=Months' });
  shSlip.validate('F5', { type: 'list', formula1: '=EmpId' });
  shSlip.set('I5', '=IFERROR(MATCH($F$5&"|"&MATCH($C$5,Months,0),PayKey,0),"")');
  shSlip.set('J5', '=IFERROR(MATCH($F$5,EmpId,0),"")');
  const pv = (name: string) => `IF($I$5="","",INDEX(${name},$I$5))`;
  const ev = (name: string) => `IF($J$5="","",INDEX(${name},$J$5)&"")`;
  // Kepala slip
  shSlip.style('B7:F7', { fill: INK });
  shSlip.merge('B7:C7', t.slipTitle, {
    font: { name: 'Georgia', size: 16, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { v: 'center', indent: 1 },
  });
  shSlip.merge('E7:F7', `=${q(t.period + ': ')}&$C$5&" "&PayYear`, {
    font: { size: 11, bold: true, color: 'FFFFFF' },
    fill: INK,
    align: { h: 'right', v: 'center', indent: 1 },
  });
  shSlip.height(7, 30);
  shSlip.merge('B8:F8', '=CompanyName', {
    font: { size: 12, bold: true, color: INK },
    align: { indent: 1, v: 'center' },
  });
  shSlip.merge('B9:F9', '=IF(CompanyAddress="","",CompanyAddress)', {
    ...st.footer,
    align: { indent: 1 },
  });
  shSlip.height(8, 22);
  const info: [string, string, string, string][] = [
    [t.name, `=${ev('EmpName')}`, 'ID', '=$F$5&""'],
    [t.position, `=${ev('EmpJob')}`, t.dept, `=${ev('EmpDept')}`],
    [
      t.ptkp,
      `=${ev('EmpPtkp')}`,
      t.account,
      `=IF($J$5="","",INDEX(EmpBank,$J$5)&" "&INDEX(EmpAccount,$J$5))`,
    ],
  ];
  shSlip.merge('B11:F11', t.slipEmp, st.h2);
  info.forEach(([l1, v1, l2, v2], i) => {
    const r = 12 + i;
    shSlip
      .set(`B${r}`, l1, st.label)
      .set(`C${r}`, v1, st.calcText)
      .set(`E${r}`, l2, st.label)
      .set(`F${r}`, v2, st.calcText);
  });
  shSlip.merge('B16:C16', t.earnings, st.thLeft).merge('E16:F16', t.deductions, st.thLeft);
  const earn: [string, string][] = [
    [t.basic, pv('PayBasic')],
    [t.allowance, pv('PayAllow')],
    [t.daily, pv('PayDaily')],
    [t.overtime, pv('PayOt')],
    [t.bonus, `IF($I$5="","",N(INDEX(PayBonus,$I$5)))`],
  ];
  const ded: [string, string][] = [
    [t.kesEe, pv('PayKes')],
    [t.jhtEe, pv('PayJht')],
    [t.jpEe, pv('PayJp')],
    [t.pph, pv('PayTax')],
    [t.other, `IF($I$5="","",N(INDEX(PayOther,$I$5)))`],
  ];
  earn.forEach(([l, f], i) =>
    shSlip.set(`B${17 + i}`, l, st.rowLabel).set(`C${17 + i}`, `=${f}`, st.rowMoney),
  );
  ded.forEach(([l, f], i) =>
    shSlip.set(`E${17 + i}`, l, st.rowLabel).set(`F${17 + i}`, `=${f}`, st.rowMoney),
  );
  // PPh Desember bisa minus (lebih potong dikembalikan ke karyawan).
  shSlip.set('E20', `=IF(N(F20)<0,${q(t.pphRefund)},${q(t.pph)})`, st.rowLabel);
  shSlip
    .set('B22', t.totalEarn, st.totalLabel)
    .set('C22', '=SUM(C17:C21)', st.totalMoney)
    .set('E22', t.totalDed, st.totalLabel)
    .set('F22', '=SUM(F17:F21)', st.totalMoney);
  shSlip.merge('B24:E24', t.thp, {
    ...st.grandLabel,
    font: { size: 13, bold: true, color: 'FFFFFF' },
  });
  shSlip.set('F24', '=C22-F22', {
    ...st.grandMoney,
    font: { size: 13, bold: true, color: 'FFFFFF' },
  });
  shSlip.height(24, 28);
  shSlip.merge('B25:F25', `=IF(AND($F$5<>"",$I$5=""),${q(t.notFound)},"")`, {
    ...st.note,
    font: { size: 10, bold: true, color: BAD },
  });
  shSlip.merge('B27:F27', t.attendance, st.h2);
  const attCols = ['B', 'C', 'E', 'F'];
  const attNames = ['PayWorkDays', 'PayPresent', 'PaySick', 'PayPermit', 'PayCuti', 'PayAbsent'];
  // Kehadiran: 6 angka dalam 3 baris x 2 pasang kolom.
  attNames.forEach((n, i) => {
    const r = 28 + Math.floor(i / 2);
    const [lc, vc] = i % 2 === 0 ? [attCols[0], attCols[1]] : [attCols[2], attCols[3]];
    shSlip
      .set(`${lc}${r}`, t.attHead[i], st.rowLabel)
      .set(`${vc}${r}`, `=IF($I$5="","",N(INDEX(${n},$I$5)))`, { ...st.rowMoney, numFmt: '0' });
  });
  shSlip.merge(
    'B32:F32',
    `=IF($I$5="","",${q(t.employerInfo)}&TEXT(INDEX(PayBpjsEr,$I$5),"#,##0")&" · "&${q(t.grossInfo)}&TEXT(INDEX(PayGross,$I$5),"#,##0"))`,
    { ...st.note, font: { size: 9, italic: true, color: '6F675C' } },
  );
  shSlip.set('B35', t.approved, st.footer).set('E35', t.received, st.footer);
  shSlip
    .set('B39', '=IF(CompanyName="","","("&CompanyName&")")', {
      ...st.footer,
      border: { top: { style: 'thin', color: INK } },
    })
    .set('E39', `=IF($J$5="","","("&INDEX(EmpName,$J$5)&")")`, {
      ...st.footer,
      border: { top: { style: 'thin', color: INK } },
    });

  // ---------- Rekap Bulanan ----------
  sheetHeader(shMonth, st, {
    brand: t.brand,
    title: S.month,
    subtitle: t.subtitle.month,
    lastCol: 'O',
    menu,
  });
  const MC = 'BCDEFGHIJKLMNO';
  [12, 10, 15, 13, 12, 15, 13, 13, 12, 15, 14, 15, 10, 10].forEach((w, i) =>
    shMonth.width(MC[i], w),
  );
  t.monthHead.forEach((h, i) => shMonth.set(`${MC[i]}${head}`, h, i === 0 ? st.thLeft : st.th));
  shMonth.height(head, 32);
  const mf = (name: string, m: number) => `SUMIFS(${name},PayMonth,${m})`;
  for (let m = 1; m <= 12; m++) {
    const r = FIRST + m - 1;
    shMonth
      .set(`B${r}`, months.long[m - 1], st.rowLabel)
      .set(`C${r}`, `=COUNTIF(PayMonth,${m})`, { ...st.rowMoney, numFmt: FMT.int })
      .set(`D${r}`, `=${mf('PayBasic', m)}+${mf('PayAllow', m)}+${mf('PayDaily', m)}`, st.rowMoney)
      .set(`E${r}`, `=${mf('PayOt', m)}`, st.rowMoney)
      .set(`F${r}`, `=${mf('PayBonus', m)}`, st.rowMoney)
      .set(`G${r}`, `=${mf('PayIncome', m)}`, { ...st.rowMoney, font: { size: 10, bold: true } })
      .set(`H${r}`, `=${mf('PayBpjsEe', m)}`, st.rowMoney)
      .set(`I${r}`, `=${mf('PayTax', m)}`, st.rowMoney)
      .set(`J${r}`, `=${mf('PayOther', m)}`, st.rowMoney)
      .set(`K${r}`, `=${mf('PayThp', m)}`, { ...st.rowMoney, font: { size: 10, bold: true } })
      .set(`L${r}`, `=${mf('PayBpjsEr', m)}`, st.rowMoney)
      .set(`M${r}`, `=${mf('PayCost', m)}`, { ...st.rowMoney, font: { size: 10, bold: true } })
      .set(
        `N${r}`,
        `=IF(${mf('PayWorkDays', m)}=0,"",${mf('PayPresent', m)}/${mf('PayWorkDays', m)})`,
        st.rowPct,
      )
      .set(`O${r}`, `=${mf('PayOtHours', m)}`, { ...st.rowMoney, numFmt: FMT.qty });
  }
  const mTot = FIRST + 12;
  // Nama bulan pendek (kolom tersembunyi) untuk label grafik.
  shMonth.width('P', 6, true);
  months.short.forEach((m, i) => shMonth.set(`P${FIRST + i}`, m));
  shMonth.set(`B${mTot}`, t.total, st.grandLabel).height(mTot, 22);
  for (const c of 'CDEFGHIJKLMO')
    shMonth.set(`${c}${mTot}`, `=SUM(${c}${FIRST}:${c}${mTot - 1})`, {
      ...st.grandMoney,
      numFmt: c === 'C' || c === 'O' ? FMT.int : st.money,
    });
  shMonth.set(`C${mTot}`, `=MAX(C${FIRST}:C${mTot - 1})`, { ...st.grandMoney, numFmt: FMT.int });
  shMonth.set(`N${mTot}`, `=IF(SUM(PayWorkDays)=0,"",SUM(PayPresent)/SUM(PayWorkDays))`, {
    ...st.grandMoney,
    numFmt: FMT.pct1,
    align: { h: 'center' },
  });
  shMonth.cond(`N${FIRST}:N${mTot - 1}`, {
    type: 'dataBar',
    color: accent.main,
    min: '0',
    max: '1',
  });
  shMonth.freeze(`C${FIRST}`);
  const mCol = (c: string) => ref(S.month, `$${c}$${FIRST}:$${c}$${mTot - 1}`);

  // ---------- Rekap Karyawan ----------
  sheetHeader(shSum, st, {
    brand: t.brand,
    title: S.empSum,
    subtitle: t.subtitle.empSum,
    lastCol: 'Q',
    menu,
  });
  const SC = 'BCDEFGHIJKLMNOPQ';
  [9, 24, 16, 9, 7, 7, 7, 7, 7, 9, 15, 15, 14, 14, 15, 15].forEach((w, i) => shSum.width(SC[i], w));
  t.sumHead.forEach((h, i) =>
    shSum.set(`${SC[i]}${head}`, h, i === 1 || i === 2 ? st.thLeft : st.th),
  );
  shSum.height(head, 32);
  const sumSrc: [string, string, Style][] = [
    ['F', 'PayPresent', st.calcInt],
    ['G', 'PaySick', st.calcInt],
    ['H', 'PayPermit', st.calcInt],
    ['I', 'PayCuti', st.calcInt],
    ['J', 'PayAbsent', st.calcInt],
    ['K', 'PayOtHours', st.calcQty],
    ['L', 'PayIncome', st.calcMoney],
    ['M', 'PayGross', st.calcMoney],
    ['N', 'PayBpjsEe', st.calcMoney],
    ['O', 'PayTax', { ...st.calcMoney, font: { size: 10, bold: true } }],
    ['P', 'PayThp', st.calcMoney],
    ['Q', 'PayCost', st.calcMoney],
  ];
  for (let r = FIRST; r <= empLast; r++) {
    const e = `'${S.emp}'!`;
    shSum
      .set(`B${r}`, `=IF(${e}$B${r}="","",${e}$B${r})`, st.calcText)
      .set(`C${r}`, `=IF($B${r}="","",${e}$C${r}&"")`, st.calcText)
      .set(`D${r}`, `=IF($B${r}="","",${e}$D${r}&"")`, st.calcText)
      .set(`E${r}`, `=IF($B${r}="","",COUNTIF(PayId,$B${r}))`, st.calcInt);
    for (const [c, n, style] of sumSrc)
      shSum.set(`${c}${r}`, `=IF($B${r}="","",SUMIFS(${n},PayId,$B${r}))`, style);
  }
  const sTot = empLast + 1;
  shSum.set(`B${sTot}`, t.total, st.grandLabel);
  for (const c of 'EFGHIJKLMNOPQ')
    shSum.set(`${c}${sTot}`, `=SUM(${c}${FIRST}:${c}${empLast})`, {
      ...st.grandMoney,
      numFmt: 'EFGHIJK'.includes(c) ? FMT.int : st.money,
    });
  shSum.freeze(`D${FIRST}`).autoFilter(`B${head}:Q${empLast}`).printTitles(head, head);

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  shDash.width('O', 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&CompanyName`, st.title);
  const thisYear = new Date().getFullYear();
  const nowMonth = year === thisYear ? new Date().getMonth() : year < thisYear ? 11 : 0;
  shDash
    .set('B5', t.pickMonthDash, st.label)
    .merge('D5:E5', months.long[nowMonth], pick)
    .set('F5', '=MATCH(D5,Months,0)', { ...st.note, numFmt: t.monthNo, align: { v: 'center' } })
    .merge('H5:J5', `=${q(t.fiscal)}&PayYear`, { ...st.label, align: { v: 'center' } });
  shDash.validate('D5', { type: 'list', formula1: '=Months' });
  shDash.height(5, 22).height(6, 8).height(10, 10);
  const at = (c: string) => `INDEX(${mCol(c)},$F$5)`;
  const prev = (c: string) =>
    `=IF($F$5=1,"",IF(N(INDEX(${mCol(c)},$F$5-1))=0,"",${q(t.vsPrev)}&TEXT(${at(c)}/INDEX(${mCol(c)},$F$5-1)-1,"+0%;-0%")))`;
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kEmp,
    value: `=COUNTIF(EmpActive,${q(t.active)})`,
    note: `=COUNTIFS(EmpActive,${q(t.active)},EmpWork,${q(t.workStatus[0])})&${q(t.permanent)}&COUNTIFS(EmpActive,${q(t.active)},EmpWork,${q(t.workStatus[1])})&${q(t.contract)}`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kIncome,
    value: `=${at('G')}`,
    note: prev('G'),
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kThp,
    value: `=${at('K')}`,
    note: `=IF(N(${at('C')})=0,"",${q(t.perEmp)}&TEXT(${at('K')}/${at('C')},"#,##0"))`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kCost,
    value: `=${at('M')}`,
    note: `=${at('C')}&${q(t.paidNote)}`,
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kTax,
    value: `=${at('I')}`,
    note: `=IF($F$5=12,${q(t.decNote)},${prev('I').slice(1)})`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 11,
    label: t.kBpjs,
    value: `=${at('H')}+${at('L')}`,
    note: t.eeEr,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kAtt,
    value: `=IF(${at('N')}="",0,${at('N')})`,
    note: `=SUMIFS(PayAbsent,PayMonth,$F$5)&${q(t.absentNote)}`,
    numFmt: '0.0%',
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kOt,
    value: `=${at('O')}`,
    note: `=TEXT(${at('E')},"#,##0")`,
    numFmt: t.otUnit,
  });
  const monthCats = ref(S.month, `$P$${FIRST}:$P$${mTot - 1}`);
  shDash.chart({
    type: 'column',
    title: t.chartCost,
    from: 'B15',
    to: 'H33',
    numFmt: '#,##0',
    stacked: true,
    series: [
      { name: t.monthHead[2], categories: monthCats, values: mCol('D'), color: accent.main },
      { name: t.monthHead[3], categories: monthCats, values: mCol('E'), color: '8F5E0A' },
      { name: t.monthHead[4], categories: monthCats, values: mCol('F'), color: '3C6A33' },
      { name: t.monthHead[10], categories: monthCats, values: mCol('L'), color: '2C4A86' },
    ],
  });
  shDash.chart({
    type: 'line',
    title: t.chartAtt,
    from: 'H15',
    to: 'N33',
    numFmt: '0%',
    legend: 'none',
    series: [{ name: t.kAtt, categories: monthCats, values: mCol('N'), color: '3C6A33' }],
  });
  shDash.chart({
    type: 'doughnut',
    title: t.chartDept,
    from: 'B35',
    to: 'H55',
    legend: 'r',
    sliceColors: departments.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
    series: [
      {
        name: t.chartDept,
        categories: ref(S.set, `$E$7:$E$${6 + departments.length}`),
        values: ref(S.set, `$F$7:$F$${6 + departments.length}`),
      },
    ],
  });
  shDash.merge('I35:M35', t.contractH, st.h2);
  shDash
    .merge('I36:J36', t.contractHead[0], st.thLeft)
    .set('K36', t.contractHead[1], st.thLeft)
    .set('L36', t.contractHead[2], st.th)
    .set('M36', t.contractHead[3], st.th)
    .height(36, 26);
  for (let k = 1; k <= 10; k++) {
    const r = 36 + k;
    const ix = (n: string) => `IF($O${r}="","",INDEX(${n},$O${r}))`;
    shDash
      .set(`O${r}`, `=IFERROR(MATCH(${k},EmpContractSeq,0),"")`)
      .merge(
        `I${r}:J${r}`,
        k === 1
          ? `=IF($O${r}="",IF(COUNTA(EmpId)=0,"",${q(t.noContract)}),INDEX(EmpName,$O${r}))`
          : `=${ix('EmpName')}`,
        st.rowLabel,
      )
      .set(`K${r}`, `=${ix('EmpDept')}`, st.rowLabel)
      .set(`L${r}`, `=${ix('EmpEnd')}`, { ...st.rowMoney, numFmt: st.date, align: { h: 'center' } })
      .set(`M${r}`, `=${ix('EmpDaysLeft')}`, {
        ...st.rowMoney,
        numFmt: FMT.int,
        align: { h: 'center' },
      });
  }
  shDash.cond('M37:M46', {
    type: 'cellIs',
    operator: 'lessThanOrEqual',
    formula: '30',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });

  // ---------- Menu ----------
  sheetHeader(shMenu, st, {
    brand: t.brand,
    title: t.templateName,
    subtitle: t.subtitle.menu,
    lastCol: 'H',
  });
  shMenu.widths({ B: 5, C: 24, D: 62, E: 3, F: 16, G: 16, H: 4 });
  shMenu.set('B3', `=CompanyName&${q(' · ' + t.fiscal)}&PayYear`, {
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
    [S.emp, t.desc.emp],
    [S.pay, t.desc.pay],
    [S.slip, t.desc.slip],
    [S.month, t.desc.month],
    [S.empSum, t.desc.empSum],
    [S.rates, t.desc.rates],
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
  shMenu.merge('C20:D22', t.disclaimer, st.note);
  const today = new Date();
  shMenu.set('C24', t.footer, st.footer);
  shMenu.set(
    'C25',
    `${t.made} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
    st.footer,
  );

  return wb;

  // ---------- Contoh data ----------
  function makeSample() {
    const rnd = seeded(year * 13 + departments.length);
    const prefix = locale === 'id' ? 'K-' : 'E-';
    const dept = (i: number) => departments[Math.min(i, departments.length - 1)];
    const employees = SAMPLE_EMP.map(([name, di, ji, wi, ptkp, base, allow, daily], i) => {
      // Karyawan kontrak: kontrak berakhir sekitar akhir tahun; satu berakhir dalam 45 hari.
      const startYear = year - 1 - (i % 5);
      const isContract = wi === 1 || wi === 3;
      const now = new Date();
      // Dihitung dari hari ini agar daftar "kontrak segera berakhir" di dashboard terisi.
      const ref0 = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
      return {
        id: `${prefix}${String(i + 1).padStart(3, '0')}`,
        name,
        dept: dept(di),
        job: t.sample.jobs[ji],
        status: t.workStatus[wi],
        start:
          wi === 3
            ? excelDate(year, 4, 1)
            : excelDate(startYear, 1 + ((i * 5) % 12), 1 + ((i * 7) % 27)),
        end: isContract ? ref0 + [45, 120, 200, 25][i % 4] : undefined,
        ptkp,
        gender: t.gender[[0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 0][i]],
        birth: excelDate(1975 + ((i * 3) % 25), 1 + ((i * 4) % 12), 1 + ((i * 11) % 27)),
        base,
        allow,
        daily,
        bank: t.sample.banks[i % 4],
        account: String(1_000_000_000 + Math.floor(rnd() * 8_999_999_999)),
        joinMonth: wi === 3 ? 4 : 1,
      };
    });
    const lastMonth = year === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    const pay: {
      month: number;
      id: string;
      workDays: number;
      present: number;
      sick: number;
      permit: number;
      leave: number;
      ot1: number;
      ot2: number;
      bonus: number;
      other: number;
    }[] = [];
    for (let m = 1; m <= lastMonth; m++) {
      // Hari kerja = Senin-Jumat dalam bulan itu.
      let workDays = 0;
      for (let d = 1; d <= new Date(year, m, 0).getDate(); d++) {
        const wd = new Date(year, m - 1, d).getDay();
        if (wd !== 0 && wd !== 6) workDays++;
      }
      employees.forEach((e, i) => {
        if (m < e.joinMonth) return;
        const sick = rnd() < 0.25 ? 1 + Math.floor(rnd() * 2) : 0;
        const permit = rnd() < 0.15 ? 1 : 0;
        const leave = rnd() < 0.2 ? 1 + Math.floor(rnd() * 2) : 0;
        const absent = rnd() < 0.06 ? 1 : 0;
        const hasOt =
          ['Gudang', 'Warehouse', 'Operasional', 'Operations'].includes(e.dept) &&
          e.base < 10_000_000;
        const otDays = hasOt ? Math.floor(rnd() * 6) : rnd() < 0.2 ? 1 : 0;
        pay.push({
          month: m,
          id: e.id,
          workDays,
          present: workDays - sick - permit - leave - absent,
          sick,
          permit,
          leave,
          ot1: otDays,
          ot2: otDays * Math.floor(rnd() * 3),
          // Bonus penjualan untuk tim Sales, THR di bulan Maret (sekitar Lebaran) untuk semua.
          bonus:
            (m === 3 ? e.base + e.allow : 0) +
            (e.dept === dept(1) && rnd() < 0.5
              ? Math.round((500_000 + rnd() * 1_500_000) / 50_000) * 50_000
              : 0),
          other: i === 9 && m % 4 === 0 ? 300_000 : 0,
        });
      });
    }
    return { employees, pay: pay.slice(0, PAY_ROWS) };
  }
}
