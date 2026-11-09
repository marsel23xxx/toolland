/**
 * Template Invoice & Penawaran: satu daftar dokumen (invoice dan surat penawaran) dengan nomor
 * otomatis, rincian item dari daftar produk, PPN, status pembayaran, lembar cetak dengan terbilang,
 * data pelanggan dan produk, serta dashboard penjualan dan piutang.
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
  FMT,
  GOOD,
  GOOD_BG,
  INK,
  MONTHS,
  WARN,
  WARN_BG,
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
import { wordTable } from './terbilang';

export interface InvoiceOptions {
  locale: Locale;
  business: string;
  year: number;
  currency: Currency;
  vat: number;
  payTerms: number;
  bank: string;
  /** "Nama | harga | satuan" per baris. */
  products: string[];
  sample: boolean;
}

const FIRST = 6;
const DOC_ROWS = 600;
const LINE_ROWS = 3000;
const CUST_ROWS = 150;
const PROD_ROWS = 200;
const PRINT_LINES = 20;

const L = {
  id: {
    brand: 'TOOLLAND · INVOICE & PENAWARAN',
    name: 'Invoice & Penawaran',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      print: 'Cetak',
      docs: 'Dokumen',
      lines: 'Rincian',
      cust: 'Pelanggan',
      prod: 'Produk',
      set: 'Pengaturan',
      list: '_Daftar',
    },
    desc: {
      dash: 'Penjualan, pembayaran masuk, piutang, invoice terlambat, penawaran, dan grafik.',
      print:
        'Pilih nomor dokumen, invoice atau surat penawaran siap dicetak atau disimpan sebagai PDF.',
      docs: 'Daftar semua invoice dan penawaran: nomor otomatis, pelanggan, PPN, total, dan status bayar.',
      lines: 'Item setiap dokumen: produk, jumlah, harga, dan diskon.',
      cust: 'Data pelanggan beserta total belanja dan piutangnya.',
      prod: 'Daftar produk dan jasa dengan harga, plus jumlah terjual dan omzet.',
      set: 'Profil usaha, rekening, PPN, termin pembayaran, dan awalan nomor.',
    },
    subtitle: {
      menu: 'Buat invoice dan surat penawaran yang rapi, pantau siapa yang belum bayar. Mulai dari Pengaturan.',
      print: 'Pilih nomor dokumen di bawah, lalu cetak (Ctrl+P) atau simpan sebagai PDF.',
      docs: 'Satu baris per dokumen. Nomor terisi otomatis menurut jenis dan urutan. Isi Dibayar saat pelanggan membayar.',
      lines:
        'Satu baris per item. Pilih nomor dokumen dan kode produk; harga terisi dari sheet Produk bila dikosongkan.',
      cust: 'Satu baris per pelanggan. Nama dipakai di dropdown sheet Dokumen.',
      prod: 'Satu baris per produk atau jasa. Kode dipakai di dropdown sheet Rincian.',
      set: 'Atur sekali di awal. Data ini muncul di setiap invoice dan penawaran.',
      dash: 'Pilih bulan di bawah. Angka bulanan dan grafik ikut berubah.',
    },
    steps: [
      'Isi Pengaturan (nama usaha, rekening, PPN), lalu daftar Pelanggan dan Produk.',
      'Buat dokumen di sheet Dokumen (pilih Invoice atau Penawaran), lalu isi itemnya di sheet Rincian.',
      'Buka sheet Cetak, pilih nomornya, lalu cetak atau simpan PDF. Catat pembayaran di kolom Dibayar.',
    ],
    types: { inv: 'Invoice', quo: 'Penawaran' },
    yes: 'Ya',
    no: 'Tidak',
    set: [
      ['Nama usaha', 'BizName'],
      ['Alamat', 'BizAddress'],
      ['Telepon / WhatsApp', 'BizPhone'],
      ['Email', 'BizEmail'],
      ['NPWP', 'BizTaxId'],
      ['Tahun', 'DocYear'],
      ['Mata uang', 'CurrencyLabel'],
      ['Tarif PPN (%)', 'VatRate'],
      ['Rekening pembayaran', 'BankInfo'],
      ['Termin invoice (hari)', 'PayTerms'],
      ['Masa berlaku penawaran (hari)', 'QuoteValid'],
      ['Awalan nomor invoice', 'PrefixInv'],
      ['Awalan nomor penawaran', 'PrefixQuo'],
      ['Penandatangan', 'Signer'],
      ['Jabatan', 'SignerTitle'],
      ['Catatan kaki dokumen', 'FooterNote'],
    ] as [string, string][],
    vatNote:
      'PPN: sejak 2025 tarif 12% dengan DPP nilai lain 11/12 untuk sebagian besar barang/jasa, sehingga efektif 11%. Isi 0 bila usaha belum PKP. Kolom PPN di sheet Dokumen menentukan dokumen mana yang dikenai PPN.',
    footerDefault: 'Terima kasih atas kepercayaan Anda.',
    signerDefault: 'Pemilik',
    docs: [
      'Jenis',
      'No. dokumen',
      'Tanggal',
      'Pelanggan',
      'Termin (hari)',
      'Jatuh tempo / berlaku s.d.',
      'Diskon %',
      'PPN',
      'Ref. / PO',
      'Catatan',
      'Subtotal',
      'Diskon',
      'DPP',
      'PPN',
      'Total',
      'Dibayar',
      'Tgl bayar',
      'Sisa',
      'Status',
    ],
    status: {
      paid: 'Lunas',
      part: 'Sebagian',
      open: 'Belum jatuh tempo',
      late: 'Terlambat',
      valid: 'Berlaku',
      expired: 'Kedaluwarsa',
    },
    termsMsg: 'Kosongkan untuk memakai termin bawaan di Pengaturan.',
    custMsg: 'Pilih dari sheet Pelanggan.',
    paidMsg: 'Jumlah yang sudah dibayar pelanggan.',
    lines: [
      'No. dokumen',
      'Kode produk',
      'Keterangan tambahan',
      'Qty',
      'Harga (opsional)',
      'Diskon %',
      'Uraian',
      'Satuan',
      'Harga satuan',
      'Jumlah',
    ],
    lineDocMsg: 'Pilih nomor dari sheet Dokumen.',
    lineProdMsg: 'Pilih kode produk, atau kosongkan dan tulis uraian di kolom Keterangan.',
    priceMsg: 'Kosongkan untuk memakai harga di sheet Produk.',
    cust: [
      'Nama pelanggan',
      'Kontak',
      'Telepon',
      'Email',
      'Alamat',
      'Kota',
      'NPWP',
      'Jumlah invoice',
      'Total belanja',
      'Dibayar',
      'Piutang',
    ],
    prod: [
      'Kode',
      'Nama produk / jasa',
      'Satuan',
      'Harga',
      'Kategori',
      'Keterangan',
      'Qty terjual',
      'Omzet',
    ],
    print: {
      pick: 'No. dokumen',
      invTitle: 'INVOICE',
      quoTitle: 'PENAWARAN HARGA',
      no: 'Nomor',
      date: 'Tanggal',
      due: 'Jatuh tempo',
      valid: 'Berlaku s.d.',
      ref: 'Ref. / PO',
      to: 'Kepada',
      head: ['No', 'Uraian', 'Qty', 'Satuan', 'Harga', 'Jumlah'],
      subtotal: 'Subtotal',
      disc: 'Diskon',
      dpp: 'DPP',
      vat: 'PPN',
      total: 'TOTAL',
      paid: 'Dibayar',
      balance: 'Sisa tagihan',
      words: 'Terbilang',
      pay: 'Pembayaran',
      notes: 'Catatan',
      regards: 'Hormat kami,',
      more: 'Item lebih dari 20 baris: hanya 20 pertama yang tercetak.',
      notFound: 'Nomor dokumen tidak ditemukan.',
    },
    currencyWord: {
      IDR: 'rupiah',
      USD: 'dolar AS',
      SGD: 'dolar Singapura',
      MYR: 'ringgit',
      EUR: 'euro',
    } as Record<Currency, string>,
    and: ' dan ',
    // Dashboard
    kSales: 'Penjualan bulan ini',
    kReceived: 'Pembayaran masuk',
    kAr: 'Piutang belum dibayar',
    kLate: 'Invoice terlambat',
    kQuotes: 'Penawaran bulan ini',
    kYtd: 'Penjualan s.d. bulan ini',
    kAvg: 'Rata-rata per invoice',
    kCust: 'Pelanggan aktif',
    invCount: ' invoice',
    vsPrev: 'vs bulan lalu: ',
    lateValue: 'Nilai: ',
    quoteValue: 'Nilai: ',
    custNote: 'Membeli tahun ini',
    chartSales: 'Penjualan vs pembayaran per bulan',
    chartCust: '5 pelanggan teratas',
    chartProd: '5 produk / jasa terlaris',
    dueH: 'Perlu ditagih',
    dueHead: ['No. invoice', 'Pelanggan', 'Jatuh tempo', 'Sisa'],
    noDue: 'Tidak ada invoice yang terlambat atau jatuh tempo 7 hari ke depan.',
    monthH: 'Rekap per bulan',
    monthHead: ['Bulan', 'Penjualan', 'Pembayaran', 'Penawaran'],
    sales: 'Penjualan',
    received: 'Pembayaran',
    sample: {
      customers: [
        ['PT Sinar Abadi', 'Bu Ratna', '021-555-0101', 'Jakarta'],
        ['CV Maju Bersama', 'Pak Darto', '022-555-0102', 'Bandung'],
        ['Kopi Senja', 'Mas Dimas', '0812-555-0103', 'Yogyakarta'],
        ['Klinik Sehat Selalu', 'dr. Wulan', '031-555-0104', 'Surabaya'],
        ['Toko Berkah Jaya', 'Pak Hasan', '0813-555-0105', 'Semarang'],
        ['Yayasan Cerdas Bangsa', 'Bu Lina', '0274-555-0106', 'Yogyakarta'],
      ],
      products: [
        ['DSN-LOGO', 'Desain logo & identitas', 'paket', 3_500_000, 'Desain'],
        ['DSN-SOS', 'Desain konten media sosial', 'konten', 150_000, 'Desain'],
        ['WEB-CP', 'Website company profile', 'paket', 8_500_000, 'Website'],
        ['WEB-MNT', 'Pemeliharaan website', 'bulan', 750_000, 'Website'],
        ['FOTO-PRD', 'Foto produk', 'foto', 75_000, 'Foto'],
        ['CTK-BRO', 'Cetak brosur A5', 'rim', 650_000, 'Cetak'],
        ['CTK-KN', 'Cetak kartu nama', 'box', 85_000, 'Cetak'],
        ['CTK-BNR', 'Banner 3x1 m', 'lembar', 225_000, 'Cetak'],
        ['KONS', 'Konsultasi branding', 'jam', 400_000, 'Konsultasi'],
        ['IKL-ADS', 'Pengelolaan iklan digital', 'bulan', 2_000_000, 'Pemasaran'],
      ] as [string, string, string, number, string][],
      note: 'Pembayaran termin 1',
      address: 'Jl. Contoh No. ',
    },
  },
  en: {
    brand: 'TOOLLAND · INVOICES & QUOTES',
    name: 'Invoices & Quotes',
    sheets: {
      menu: 'Menu',
      dash: 'Dashboard',
      print: 'Print',
      docs: 'Documents',
      lines: 'Line Items',
      cust: 'Customers',
      prod: 'Products',
      set: 'Settings',
      list: '_Lists',
    },
    desc: {
      dash: 'Sales, payments received, receivables, overdue invoices, quotes, and charts.',
      print: 'Choose a document number to get a printable invoice or quotation, or save it as PDF.',
      docs: 'Every invoice and quote: automatic numbers, customer, tax, total, and payment status.',
      lines: 'Line items for each document: product, quantity, price, and discount.',
      cust: 'Customer details with total purchases and amount owed.',
      prod: 'Products and services with prices, quantity sold, and revenue.',
      set: 'Business profile, bank details, tax rate, payment terms, and number prefixes.',
    },
    subtitle: {
      menu: 'Create tidy invoices and quotations, and track who still owes you. Start with Settings.',
      print: 'Choose a document number below, then print (Ctrl+P) or save as PDF.',
      docs: 'One row per document. Numbers fill in by type and order. Fill in Paid when the customer pays.',
      lines:
        'One row per item. Choose the document number and product code; the price comes from Products when left empty.',
      cust: 'One row per customer. Names feed the dropdown in Documents.',
      prod: 'One row per product or service. Codes feed the dropdown in Line Items.',
      set: 'Set this up once. It appears on every invoice and quote.',
      dash: 'Choose a month below. Monthly numbers and charts follow.',
    },
    steps: [
      'Fill in Settings (business name, bank details, tax), then your Customers and Products.',
      'Add a document in Documents (Invoice or Quote), then its items in Line Items.',
      'Open Print, choose the number, then print or save as PDF. Record payments in the Paid column.',
    ],
    types: { inv: 'Invoice', quo: 'Quote' },
    yes: 'Yes',
    no: 'No',
    set: [
      ['Business name', 'BizName'],
      ['Address', 'BizAddress'],
      ['Phone', 'BizPhone'],
      ['Email', 'BizEmail'],
      ['Tax ID', 'BizTaxId'],
      ['Year', 'DocYear'],
      ['Currency', 'CurrencyLabel'],
      ['Tax rate (%)', 'VatRate'],
      ['Payment details', 'BankInfo'],
      ['Invoice terms (days)', 'PayTerms'],
      ['Quote valid for (days)', 'QuoteValid'],
      ['Invoice number prefix', 'PrefixInv'],
      ['Quote number prefix', 'PrefixQuo'],
      ['Signed by', 'Signer'],
      ['Title', 'SignerTitle'],
      ['Document footer', 'FooterNote'],
    ] as [string, string][],
    vatNote:
      'Tax: enter your VAT/GST/sales tax rate, or 0 if you do not charge tax. The Tax column in Documents decides which documents include it. (Indonesia: effectively 11% since 2025.)',
    footerDefault: 'Thank you for your business.',
    signerDefault: 'Owner',
    docs: [
      'Type',
      'Document no.',
      'Date',
      'Customer',
      'Terms (days)',
      'Due / valid until',
      'Discount %',
      'Tax',
      'Ref. / PO',
      'Notes',
      'Subtotal',
      'Discount',
      'Taxable',
      'Tax',
      'Total',
      'Paid',
      'Paid on',
      'Balance',
      'Status',
    ],
    status: {
      paid: 'Paid',
      part: 'Partly paid',
      open: 'Not due yet',
      late: 'Overdue',
      valid: 'Valid',
      expired: 'Expired',
    },
    termsMsg: 'Leave empty to use the default terms in Settings.',
    custMsg: 'Pick from the Customers sheet.',
    paidMsg: 'Amount the customer has paid.',
    lines: [
      'Document no.',
      'Product code',
      'Extra description',
      'Qty',
      'Price (optional)',
      'Discount %',
      'Description',
      'Unit',
      'Unit price',
      'Amount',
    ],
    lineDocMsg: 'Pick a number from Documents.',
    lineProdMsg: 'Pick a product code, or leave it empty and type a description.',
    priceMsg: 'Leave empty to use the price from Products.',
    cust: [
      'Customer name',
      'Contact',
      'Phone',
      'Email',
      'Address',
      'City',
      'Tax ID',
      'Invoices',
      'Total purchases',
      'Paid',
      'Owed',
    ],
    prod: [
      'Code',
      'Product / service',
      'Unit',
      'Price',
      'Category',
      'Notes',
      'Qty sold',
      'Revenue',
    ],
    print: {
      pick: 'Document no.',
      invTitle: 'INVOICE',
      quoTitle: 'QUOTATION',
      no: 'Number',
      date: 'Date',
      due: 'Due date',
      valid: 'Valid until',
      ref: 'Ref. / PO',
      to: 'Bill to',
      head: ['No', 'Description', 'Qty', 'Unit', 'Price', 'Amount'],
      subtotal: 'Subtotal',
      disc: 'Discount',
      dpp: 'Taxable amount',
      vat: 'Tax',
      total: 'TOTAL',
      paid: 'Paid',
      balance: 'Balance due',
      words: 'Amount in words',
      pay: 'Payment',
      notes: 'Notes',
      regards: 'Sincerely,',
      more: 'More than 20 items: only the first 20 are printed.',
      notFound: 'Document number not found.',
    },
    currencyWord: {
      IDR: 'rupiah',
      USD: 'US dollars',
      SGD: 'Singapore dollars',
      MYR: 'ringgit',
      EUR: 'euros',
    } as Record<Currency, string>,
    and: ' and ',
    kSales: 'Sales this month',
    kReceived: 'Payments received',
    kAr: 'Unpaid receivables',
    kLate: 'Overdue invoices',
    kQuotes: 'Quotes this month',
    kYtd: 'Sales year to date',
    kAvg: 'Average invoice',
    kCust: 'Active customers',
    invCount: ' invoices',
    vsPrev: 'vs last month: ',
    lateValue: 'Value: ',
    quoteValue: 'Value: ',
    custNote: 'Bought this year',
    chartSales: 'Sales vs payments by month',
    chartCust: 'Top 5 customers',
    chartProd: 'Top 5 products / services',
    dueH: 'To collect',
    dueHead: ['Invoice no.', 'Customer', 'Due date', 'Balance'],
    noDue: 'No invoices overdue or due in the next 7 days.',
    monthH: 'Monthly summary',
    monthHead: ['Month', 'Sales', 'Payments', 'Quotes'],
    sales: 'Sales',
    received: 'Payments',
    sample: {
      customers: [
        ['Brightline Ltd', 'Rachel Tan', '555-0101', 'Singapore'],
        ['Northwind Co.', 'Daniel Lee', '555-0102', 'Kuala Lumpur'],
        ['Dusk Coffee', 'Dimas', '555-0103', 'Jakarta'],
        ['Wellcare Clinic', 'Dr. Wulan', '555-0104', 'Surabaya'],
        ['Corner Mart', 'Hasan', '555-0105', 'Bandung'],
        ['Bright Minds Foundation', 'Lina', '555-0106', 'Yogyakarta'],
      ],
      products: [
        ['DSN-LOGO', 'Logo & brand identity', 'package', 3_500_000, 'Design'],
        ['DSN-SOC', 'Social media post design', 'post', 150_000, 'Design'],
        ['WEB-CP', 'Company profile website', 'package', 8_500_000, 'Website'],
        ['WEB-MNT', 'Website maintenance', 'month', 750_000, 'Website'],
        ['PHOTO', 'Product photography', 'photo', 75_000, 'Photo'],
        ['PRN-BRO', 'A5 flyer printing', 'ream', 650_000, 'Print'],
        ['PRN-BC', 'Business cards', 'box', 85_000, 'Print'],
        ['PRN-BNR', 'Banner 3x1 m', 'sheet', 225_000, 'Print'],
        ['CONS', 'Branding consultation', 'hour', 400_000, 'Consulting'],
        ['ADS', 'Digital ads management', 'month', 2_000_000, 'Marketing'],
      ] as [string, string, string, number, string][],
      note: 'First instalment',
      address: '1 Sample Street, No. ',
    },
  },
};

export const INVOICE_FORM: Record<Locale, TemplateForm> = {
  id: {
    template: 'invoice',
    fileBase: 'Invoice-Penawaran',
    fileKey: 'business',
    heading: 'Atur sesuai usahamu',
    fields: [
      {
        key: 'business',
        kind: 'text',
        label: 'Nama usaha',
        placeholder: 'misalnya Studio Kreatif Nusa',
        span: 2,
      },
      { key: 'year', kind: 'year', label: 'Tahun' },
      { key: 'currency', kind: 'currency', label: 'Mata uang' },
      {
        key: 'vat',
        kind: 'number',
        label: 'Tarif PPN (%)',
        value: 11,
        min: 0,
        max: 30,
        step: 0.5,
        hint: '11% efektif sejak 2025. Isi 0 bila belum PKP.',
      },
      {
        key: 'payTerms',
        kind: 'number',
        label: 'Termin invoice (hari)',
        value: 14,
        min: 0,
        max: 180,
      },
      {
        key: 'bank',
        kind: 'text',
        label: 'Rekening pembayaran',
        placeholder: 'BCA 1234567890 a.n. Studio Kreatif Nusa',
        span: 2,
      },
      {
        key: 'products',
        kind: 'list',
        label: 'Produk / jasa (nama | harga | satuan)',
        value: 'Jasa desain logo | 3500000 | paket\nCetak kartu nama | 85000 | box',
        max: 200,
        hint: 'Satu per baris. Harga dan satuan boleh dikosongkan. Bisa ditambah lagi di file.',
      },
    ],
    note: 'Invoice dan surat penawaran memakai daftar yang sama dengan nomor otomatis (misalnya INV/2026/001). Lembar cetak sudah termasuk terbilang dan cap LUNAS otomatis.',
    sample: {
      label: 'Isi contoh data',
      hint: '6 pelanggan, 10 produk, dan puluhan invoice serta penawaran setahun, jadi dashboard dan lembar cetak langsung terisi. Hapus baris contoh sebelum memakai data sendiri.',
    },
  },
  en: {
    template: 'invoice',
    fileBase: 'Invoices-Quotes',
    fileKey: 'business',
    heading: 'Set it up for your business',
    fields: [
      {
        key: 'business',
        kind: 'text',
        label: 'Business name',
        placeholder: 'for example Nusa Creative Studio',
        span: 2,
      },
      { key: 'year', kind: 'year', label: 'Year' },
      { key: 'currency', kind: 'currency', label: 'Currency' },
      {
        key: 'vat',
        kind: 'number',
        label: 'Tax rate (%)',
        value: 0,
        min: 0,
        max: 30,
        step: 0.5,
        hint: 'VAT/GST/sales tax. 0 if you do not charge tax.',
      },
      {
        key: 'payTerms',
        kind: 'number',
        label: 'Invoice terms (days)',
        value: 14,
        min: 0,
        max: 180,
      },
      {
        key: 'bank',
        kind: 'text',
        label: 'Payment details',
        placeholder: 'Bank 1234567890, Nusa Creative Studio',
        span: 2,
      },
      {
        key: 'products',
        kind: 'list',
        label: 'Products / services (name | price | unit)',
        value: 'Logo design | 3500000 | package\nBusiness cards | 85000 | box',
        max: 200,
        hint: 'One per line. Price and unit are optional. You can add more in the file.',
      },
    ],
    note: 'Invoices and quotations share one list with automatic numbers (for example INV/2026/001). The print sheet includes the amount in words and an automatic PAID stamp.',
    sample: {
      label: 'Include sample data',
      hint: '6 customers, 10 products, and dozens of invoices and quotes over a year, so the dashboard and print sheet are filled in. Delete the sample rows before using your own data.',
    },
  },
};

export function buildFromForm(v: FormValues): Workbook {
  const locale = formChoice(v, 'locale', ['id', 'en'] as const, 'id');
  return buildInvoiceWorkbook({
    locale,
    business: formText(v, 'business'),
    year: formNumber(v, 'year', new Date().getFullYear(), 2000, 2100),
    currency: formChoice(v, 'currency', Object.keys(CURRENCIES) as Currency[], 'IDR'),
    vat: formNumber(v, 'vat', 0, 0, 100),
    payTerms: formNumber(v, 'payTerms', 14, 0, 365),
    bank: formText(v, 'bank', 120),
    products: formList(v, 'products'),
    sample: v.sample === true,
  });
}

export function buildInvoiceWorkbook(opts: InvoiceOptions): Workbook {
  const { locale, currency } = opts;
  const t = L[locale];
  const S = t.sheets;
  const accent = ACCENTS.nila;
  const st = makeStyles(accent, currency, locale);
  const months = MONTHS[locale];
  const INV = q(t.types.inv);
  const QUO = q(t.types.quo);
  const YES = q(t.yes);
  const year = Math.min(2100, Math.max(2000, Math.trunc(opts.year) || new Date().getFullYear()));
  const business =
    opts.business.trim().slice(0, 80) ||
    (locale === 'id' ? 'Nama Usaha Anda' : 'Your Business Name');
  const money = sampleMoney(currency);

  const wb = new Workbook({ title: `${t.name} – ${business}`, subject: t.name, company: business });
  const menu = { label: 'Menu', sheet: S.menu };
  const landscape = { gridlines: false, landscape: true, fitWidth: true };
  const shMenu = wb.addSheet(S.menu, { tabColor: accent.dark, gridlines: false, fitWidth: true });
  const shDash = wb.addSheet(S.dash, { tabColor: accent.main, ...landscape });
  const shPrint = wb.addSheet(S.print, { tabColor: '3C6A33', gridlines: false, fitWidth: true });
  const shDocs = wb.addSheet(S.docs, { tabColor: '8F5E0A', ...landscape });
  const shLines = wb.addSheet(S.lines, { tabColor: '8F5E0A', ...landscape });
  const shCust = wb.addSheet(S.cust, { tabColor: 'A8461F', ...landscape });
  const shProd = wb.addSheet(S.prod, { tabColor: 'A8461F', ...landscape });
  const shSet = wb.addSheet(S.set, { tabColor: '6F675C', gridlines: false, fitWidth: true });
  const shList = wb.addSheet(S.list, { hidden: true });

  const ref = (sheet: string, range: string) => `'${sheet}'!${range}`;
  const head = FIRST - 1;
  const docLast = FIRST + DOC_ROWS - 1;
  const lineLast = FIRST + LINE_ROWS - 1;
  const custLast = FIRST + CUST_ROWS - 1;
  const prodLast = FIRST + PROD_ROWS - 1;
  const col = (sheet: string, c: string, last: number) =>
    ref(sheet, `$${c}$${FIRST}:$${c}$${last}`);

  const userProducts = opts.products
    .map((line) => line.split('|').map((x) => x.replace(/\s+/g, ' ').trim()))
    .filter((p) => p[0])
    .slice(0, PROD_ROWS)
    .map(([name, price, unit], i) => ({
      code: `P${String(i + 1).padStart(3, '0')}`,
      name: name.slice(0, 80),
      unit: (unit ?? '').slice(0, 20),
      price: parsePrice(price ?? ''),
      cat: '',
    }));
  const sample = opts.sample ? makeSample() : undefined;
  const products = sample?.products ?? userProducts;

  // ---------- Daftar tersembunyi ----------
  monthsList(wb, shList, S.list, locale);
  shList.set('D2', t.types.inv).set('D3', t.types.quo);
  wb.defineName('DocTypes', ref(S.list, '$D$2:$D$3'));
  shList.set('F2', t.yes).set('F3', t.no);
  wb.defineName('YesNo', ref(S.list, '$F$2:$F$3'));
  wordTable(locale).forEach((w, i) => shList.set(`H${i + 2}`, w));
  wb.defineName('Words', ref(S.list, '$H$2:$H$1001'));

  // ---------- Pengaturan ----------
  sheetHeader(shSet, st, {
    brand: t.brand,
    title: S.set,
    subtitle: t.subtitle.set,
    lastCol: 'E',
    menu,
  });
  shSet.widths({ B: 30, C: 46, D: 3, E: 9 });
  const setValues: Record<string, string | number> = {
    BizName: business,
    BizAddress: sample ? `${t.sample.address}12` : '',
    BizPhone: sample ? '0812-0000-0000' : '',
    BizEmail: sample ? 'halo@contoh.id' : '',
    BizTaxId: '',
    DocYear: year,
    CurrencyLabel: `${currency} (${CURRENCIES[currency].symbol})`,
    VatRate: Math.max(0, Math.min(100, opts.vat)),
    BankInfo: opts.bank.slice(0, 120) || (sample ? 'BCA 1234567890' : ''),
    PayTerms: Math.max(0, Math.round(opts.payTerms)),
    QuoteValid: 14,
    PrefixInv: 'INV',
    PrefixQuo: locale === 'id' ? 'PNW' : 'QUO',
    Signer: business,
    SignerTitle: t.signerDefault,
    FooterNote: t.footerDefault,
  };
  t.set.forEach(([label, name], i) => {
    const r = 5 + i;
    const v = setValues[name];
    const style: Style =
      name === 'CurrencyLabel'
        ? st.calcText
        : typeof v === 'number'
          ? { ...st.input, numFmt: name === 'VatRate' ? '0.0' : '0', align: { h: 'center' } }
          : st.inputText;
    shSet.set(`B${r}`, label, st.label).set(`C${r}`, v, style).height(r, 20);
    wb.defineName(name, ref(S.set, `$C$${r}`));
  });
  shSet.merge(`B${6 + t.set.length}:C${8 + t.set.length}`, t.vatNote, st.note);
  shSet.validate('C10', { type: 'whole', operator: 'between', formula1: '2000', formula2: '2100' });
  wb.defineName('CurrencyWord', ref(S.list, '$J$2'));
  shList.set('J2', t.currencyWord[currency]);

  // ---------- Pelanggan ----------
  sheetHeader(shCust, st, {
    brand: t.brand,
    title: S.cust,
    subtitle: t.subtitle.cust,
    lastCol: 'L',
    menu,
  });
  shCust.widths({ B: 26, C: 18, D: 16, E: 22, F: 30, G: 14, H: 18, I: 10, J: 15, K: 15, L: 15 });
  t.cust.forEach((h, i) => shCust.set(`${'BCDEFGHIJKL'[i]}${head}`, h, i < 7 ? st.thLeft : st.th));
  shCust.height(head, 30);
  for (let r = FIRST; r <= custLast; r++) {
    const c = sample?.customers[r - FIRST];
    shCust
      .set(`B${r}`, c?.[0] ?? null, st.inputText)
      .set(`C${r}`, c?.[1] ?? null, st.inputText)
      .set(`D${r}`, c?.[2] ?? null, st.inputText)
      .set(`E${r}`, null, st.inputText)
      .set(`F${r}`, c ? `${t.sample.address}${r * 3}` : null, st.inputText)
      .set(`G${r}`, c?.[3] ?? null, st.inputText)
      .set(`H${r}`, null, st.inputText)
      .set(`I${r}`, `=IF($B${r}="","",COUNTIFS(DocCustomer,$B${r},DocType,${INV}))`, st.calcInt)
      .set(
        `J${r}`,
        `=IF($B${r}="","",SUMIFS(DocTotal,DocCustomer,$B${r},DocType,${INV}))`,
        st.calcMoney,
      )
      .set(
        `K${r}`,
        `=IF($B${r}="","",SUMIFS(DocPaid,DocCustomer,$B${r},DocType,${INV}))`,
        st.calcMoney,
      )
      .set(`L${r}`, `=IF($B${r}="","",SUMIFS(DocBalance,DocCustomer,$B${r}))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      });
  }
  shCust.cond(`L${FIRST}:L${custLast}`, {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD, bold: true } },
  });
  shCust.validate(`B${FIRST}:B${custLast}`, {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${custLast},B${FIRST})=1`,
    error: locale === 'id' ? 'Nama pelanggan sudah ada.' : 'Customer name already exists.',
  });
  shCust.freeze(`C${FIRST}`).autoFilter(`B${head}:L${custLast}`);
  wb.defineName('Customers', col(S.cust, 'B', custLast));
  wb.defineName('CustAddress', col(S.cust, 'F', custLast));
  wb.defineName('CustCity', col(S.cust, 'G', custLast));
  wb.defineName('CustPhone', col(S.cust, 'D', custLast));
  wb.defineName('CustContact', col(S.cust, 'C', custLast));
  wb.defineName('CustSales', col(S.cust, 'J', custLast));

  // ---------- Produk ----------
  sheetHeader(shProd, st, {
    brand: t.brand,
    title: S.prod,
    subtitle: t.subtitle.prod,
    lastCol: 'I',
    menu,
  });
  shProd.widths({ B: 12, C: 32, D: 10, E: 15, F: 16, G: 26, H: 11, I: 15 });
  t.prod.forEach((h, i) =>
    shProd.set(`${'BCDEFGHI'[i]}${head}`, h, [1, 4, 5].includes(i) ? st.thLeft : st.th),
  );
  shProd.height(head, 30);
  for (let r = FIRST; r <= prodLast; r++) {
    const p = products[r - FIRST];
    shProd
      .set(`B${r}`, p?.code ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`C${r}`, p?.name ?? null, st.inputText)
      .set(`D${r}`, p?.unit || null, { ...st.inputText, align: { h: 'center' } })
      .set(`E${r}`, p?.price ?? null, st.inputMoney)
      .set(`F${r}`, p?.cat || null, st.inputText)
      .set(`G${r}`, null, st.inputText)
      .set(
        `H${r}`,
        `=IF($B${r}="","",SUMIFS(LineQty,LineProduct,$B${r},LineType,${INV}))`,
        st.calcQty,
      )
      .set(
        `I${r}`,
        `=IF($B${r}="","",SUMIFS(LineAmount,LineProduct,$B${r},LineType,${INV}))`,
        st.calcMoney,
      );
  }
  shProd.validate(`B${FIRST}:B${prodLast}`, {
    type: 'custom',
    formula1: `COUNTIF($B$${FIRST}:$B$${prodLast},B${FIRST})=1`,
    error: locale === 'id' ? 'Kode produk sudah dipakai.' : 'Product code already used.',
  });
  shProd.validate(`E${FIRST}:E${prodLast}`, {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
  });
  shProd.freeze(`D${FIRST}`).autoFilter(`B${head}:I${prodLast}`);
  wb.defineName('ProdCode', col(S.prod, 'B', prodLast));
  wb.defineName('ProdName', col(S.prod, 'C', prodLast));
  wb.defineName('ProdUnit', col(S.prod, 'D', prodLast));
  wb.defineName('ProdPrice', col(S.prod, 'E', prodLast));
  wb.defineName('ProdRevenue', col(S.prod, 'I', prodLast));

  // ---------- Dokumen ----------
  sheetHeader(shDocs, st, {
    brand: t.brand,
    title: S.docs,
    subtitle: t.subtitle.docs,
    lastCol: 'T',
    menu,
  });
  const DC = 'BCDEFGHIJKLMNOPQRST';
  [11, 16, 12, 24, 8, 13, 8, 6, 14, 22, 14, 12, 14, 12, 15, 14, 12, 14, 15].forEach((w, i) =>
    shDocs.width(DC[i], w),
  );
  for (const c of ['U', 'V', 'W']) shDocs.width(c, 6, true);
  t.docs.forEach((h, i) =>
    shDocs.set(`${DC[i]}${head}`, h, [3, 9].includes(i) ? st.thLeft : st.th),
  );
  for (const c of ['U', 'V', 'W']) shDocs.set(`${c}${head}`, '#');
  shDocs.height(head, 32);
  const ST = Object.fromEntries(Object.entries(t.status).map(([k, v]) => [k, q(v)])) as Record<
    keyof typeof t.status,
    string
  >;
  for (let r = FIRST; r <= docLast; r++) {
    const d = sample?.docs[r - FIRST];
    shDocs
      .set(`B${r}`, d ? (d.type === 'inv' ? t.types.inv : t.types.quo) : null, {
        ...st.inputText,
        align: { h: 'center' },
      })
      .set(
        `C${r}`,
        `=IF(OR($B${r}="",$D${r}=""),"",IF($B${r}=${INV},PrefixInv,PrefixQuo)&"/"&YEAR($D${r})&"/"&TEXT(COUNTIF($B$${FIRST}:$B${r},$B${r}),"000"))`,
        { ...st.calcCenter, font: { size: 10, bold: true } },
      )
      .set(`D${r}`, d?.date ?? null, st.inputDate)
      .set(`E${r}`, d?.customer ?? null, st.inputText)
      .set(`F${r}`, null, st.inputInt)
      .set(
        `G${r}`,
        `=IF($D${r}="","",$D${r}+IF($F${r}<>"",N($F${r}),IF($B${r}=${INV},N(PayTerms),N(QuoteValid))))`,
        st.calcDate,
      )
      .set(`H${r}`, d?.disc || null, { ...st.input, numFmt: '0"%"', align: { h: 'center' } })
      .set(`I${r}`, d ? (d.vat ? t.yes : t.no) : null, { ...st.inputText, align: { h: 'center' } })
      .set(`J${r}`, d?.ref ?? null, st.inputText)
      .set(`K${r}`, d?.note ?? null, st.inputText)
      .set(`L${r}`, `=IF($C${r}="","",SUMIFS(LineAmount,LineDoc,$C${r}))`, st.calcMoney)
      .set(`M${r}`, `=IF($C${r}="","",ROUND($L${r}*N($H${r})/100,0))`, st.calcMoney)
      .set(`N${r}`, `=IF($C${r}="","",$L${r}-$M${r})`, st.calcMoney)
      .set(
        `O${r}`,
        `=IF($C${r}="","",IF($I${r}=${YES},ROUND($N${r}*N(VatRate)/100,0),0))`,
        st.calcMoney,
      )
      .set(`P${r}`, `=IF($C${r}="","",$N${r}+$O${r})`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      .set(`Q${r}`, d?.paid ?? null, st.inputMoney)
      .set(`R${r}`, d?.paidOn ?? null, st.inputDate)
      .set(`S${r}`, `=IF(OR($C${r}="",$B${r}<>${INV}),"",$P${r}-N($Q${r}))`, st.calcMoney)
      .set(
        `T${r}`,
        `=IF($C${r}="","",IF($B${r}=${INV},IF(AND($P${r}>0,$S${r}<=0),${ST.paid},IF(TODAY()>$G${r},${ST.late},IF(N($Q${r})>0,${ST.part},${ST.open}))),IF(TODAY()>$G${r},${ST.expired},${ST.valid})))`,
        st.calcCenter,
      )
      // Bantu: bulan dokumen (tahun ini), bulan bayar, dan urutan "perlu ditagih" untuk dashboard.
      .set(`U${r}`, `=IF(OR($D${r}="",YEAR($D${r})<>DocYear),"",MONTH($D${r}))`)
      .set(`V${r}`, `=IF(OR($R${r}="",YEAR($R${r})<>DocYear),"",MONTH($R${r}))`)
      .set(
        `W${r}`,
        `=IF(AND($B${r}=${INV},N($S${r})>0,$G${r}<>"",N($G${r})<=TODAY()+7),N(W${r - 1})+1,N(W${r - 1}))`,
      );
  }
  const dr = (c: string) => `${c}${FIRST}:${c}${docLast}`;
  shDocs.validate(dr('B'), { type: 'list', formula1: '=DocTypes' });
  shDocs.validate(dr('D'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
  });
  shDocs.validate(dr('E'), {
    type: 'list',
    formula1: '=Customers',
    prompt: t.custMsg,
    errorStyle: 'warning',
  });
  shDocs.validate(dr('F'), {
    type: 'whole',
    operator: 'between',
    formula1: '0',
    formula2: '365',
    prompt: t.termsMsg,
  });
  shDocs.validate(dr('H'), {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '100',
  });
  shDocs.validate(dr('I'), { type: 'list', formula1: '=YesNo' });
  shDocs.validate(dr('Q'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.paidMsg,
  });
  shDocs.validate(dr('R'), {
    type: 'date',
    operator: 'between',
    formula1: 'DATE(2000,1,1)',
    formula2: 'DATE(2100,12,31)',
    errorStyle: 'warning',
  });
  for (const [s, fill, color] of [
    [ST.paid, GOOD_BG, GOOD],
    [ST.late, BAD_BG, BAD],
    [ST.part, WARN_BG, WARN],
    [ST.expired, 'EFE9DE', '6F675C'],
  ] as const)
    shDocs.cond(dr('T'), {
      type: 'cellIs',
      operator: 'equal',
      formula: s,
      style: { fill, font: { color, bold: true } },
    });
  shDocs.cond(dr('B'), {
    type: 'cellIs',
    operator: 'equal',
    formula: QUO,
    style: { font: { italic: true, color: '2C4A86' } },
  });
  shDocs.freeze(`D${FIRST}`).autoFilter(`B${head}:T${docLast}`).printTitles(head, head);
  const docNames: [string, string][] = [
    ['DocType', 'B'],
    ['DocNo', 'C'],
    ['DocDate', 'D'],
    ['DocCustomer', 'E'],
    ['DocDue', 'G'],
    ['DocDisc', 'H'],
    ['DocRef', 'J'],
    ['DocNote', 'K'],
    ['DocSubtotal', 'L'],
    ['DocDiscAmt', 'M'],
    ['DocDpp', 'N'],
    ['DocVat', 'O'],
    ['DocTotal', 'P'],
    ['DocPaid', 'Q'],
    ['DocBalance', 'S'],
    ['DocStatus', 'T'],
    ['DocMonth', 'U'],
    ['DocPaidMonth', 'V'],
    ['DocDueSeq', 'W'],
  ];
  for (const [n, c] of docNames) wb.defineName(n, col(S.docs, c, docLast));

  // ---------- Rincian ----------
  sheetHeader(shLines, st, {
    brand: t.brand,
    title: S.lines,
    subtitle: t.subtitle.lines,
    lastCol: 'K',
    menu,
  });
  const LC = 'BCDEFGHIJK';
  [16, 12, 26, 8, 14, 8, 32, 9, 14, 15].forEach((w, i) => shLines.width(LC[i], w));
  shLines.width('L', 6, true).width('M', 6, true);
  t.lines.forEach((h, i) =>
    shLines.set(`${LC[i]}${head}`, h, [2, 6].includes(i) ? st.thLeft : st.th),
  );
  shLines.set(`L${head}`, '#').set(`M${head}`, '#').height(head, 30);
  for (let r = FIRST; r <= lineLast; r++) {
    const l = sample?.lines[r - FIRST];
    const pi = `MATCH($C${r},ProdCode,0)`;
    shLines
      .set(`B${r}`, l?.doc ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`C${r}`, l?.code ?? null, { ...st.inputText, align: { h: 'center' } })
      .set(`D${r}`, l?.note ?? null, st.inputText)
      .set(`E${r}`, l?.qty ?? null, st.inputQty)
      .set(`F${r}`, null, st.inputMoney)
      .set(`G${r}`, null, { ...st.input, numFmt: '0"%"', align: { h: 'center' } })
      .set(
        `H${r}`,
        `=IF(AND($C${r}="",$D${r}=""),"",IF($C${r}="",$D${r},IFERROR(INDEX(ProdName,${pi}),"?")&IF($D${r}<>""," – "&$D${r},"")))`,
        st.calcText,
      )
      .set(`I${r}`, `=IF($C${r}="","",IFERROR(INDEX(ProdUnit,${pi})&"",""))`, st.calcCenter)
      .set(
        `J${r}`,
        `=IF($E${r}="","",IF($F${r}<>"",$F${r},IFERROR(N(INDEX(ProdPrice,${pi})),0)))`,
        st.calcMoney,
      )
      .set(`K${r}`, `=IF($E${r}="","",ROUND(N($E${r})*$J${r}*(1-N($G${r})/100),0))`, {
        ...st.calcMoney,
        font: { size: 10, bold: true },
      })
      // Bantu: jenis dokumen baris ini, dan urutan baris untuk dokumen yang dipilih di sheet Cetak.
      .set(`L${r}`, `=IF($B${r}="","",IFERROR(INDEX(DocType,MATCH($B${r},DocNo,0))&"",""))`)
      .set(`M${r}`, `=IF(AND($B${r}<>"",$B${r}=PrintDoc),N(M${r - 1})+1,N(M${r - 1}))`);
  }
  const lr = (c: string) => `${c}${FIRST}:${c}${lineLast}`;
  shLines.validate(lr('B'), {
    type: 'list',
    formula1: '=DocNo',
    prompt: t.lineDocMsg,
    errorStyle: 'warning',
  });
  shLines.validate(lr('C'), {
    type: 'list',
    formula1: '=ProdCode',
    prompt: t.lineProdMsg,
    errorStyle: 'warning',
  });
  shLines.validate(lr('E'), { type: 'decimal', operator: 'greaterThan', formula1: '0' });
  shLines.validate(lr('F'), {
    type: 'decimal',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    prompt: t.priceMsg,
  });
  shLines.validate(lr('G'), {
    type: 'decimal',
    operator: 'between',
    formula1: '0',
    formula2: '100',
  });
  shLines.cond(lr('H'), {
    type: 'expression',
    formula: `LEFT($H${FIRST},1)="?"`,
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });
  shLines.cond(lr('B'), {
    type: 'expression',
    formula: `AND($B${FIRST}<>"",$L${FIRST}="")`,
    style: { fill: BAD_BG },
  });
  shLines.freeze(`C${FIRST}`).autoFilter(`B${head}:K${lineLast}`).printTitles(head, head);
  const lineNames: [string, string][] = [
    ['LineDoc', 'B'],
    ['LineProduct', 'C'],
    ['LineQty', 'E'],
    ['LineItem', 'H'],
    ['LineUnit', 'I'],
    ['LinePrice', 'J'],
    ['LineAmount', 'K'],
    ['LineType', 'L'],
    ['LineSeq', 'M'],
  ];
  for (const [n, c] of lineNames) wb.defineName(n, col(S.lines, c, lineLast));

  // ---------- Cetak ----------
  sheetHeader(shPrint, st, {
    brand: t.brand,
    title: S.print,
    subtitle: t.subtitle.print,
    lastCol: 'G',
    menu,
  });
  shPrint.widths({ B: 6, C: 36, D: 8, E: 9, F: 15, G: 17 });
  for (const c of ['I', 'J', 'K']) shPrint.width(c, 6, true);
  const p = t.print;
  const lastInv = sample?.docs.filter((d) => d.type === 'inv').at(-1);
  shPrint
    .merge('B5:C5', p.pick, st.label)
    .merge('D5:F5', lastInv ? lastInv.no : '', {
      ...st.inputText,
      font: { size: 11, bold: true },
      align: { h: 'center' },
    })
    .height(5, 22);
  shPrint.validate('D5', { type: 'list', formula1: '=DocNo' });
  wb.defineName('PrintDoc', ref(S.print, '$D$5'));
  shPrint.set('I5', '=IFERROR(MATCH(PrintDoc,DocNo,0),"")');
  const dv = (name: string) => `IF($I$5="","",INDEX(${name},$I$5))`;
  const isInv = `INDEX(DocType,$I$5)=${INV}`;
  shPrint.merge('B6:G6', `=IF(AND(PrintDoc<>"",$I$5=""),${q(p.notFound)},"")`, {
    ...st.note,
    font: { size: 10, bold: true, color: BAD },
  });
  // Kop
  shPrint
    .merge('B8:D8', '=BizName', {
      font: { name: 'Georgia', size: 16, bold: true, color: INK },
      align: { v: 'center' },
    })
    .height(8, 28);
  shPrint.merge('B9:D9', '=IF(BizAddress="","",BizAddress)', st.footer);
  shPrint.merge(
    'B10:D10',
    `=TRIM(IF(BizPhone="","",BizPhone)&IF(BizEmail="",""," · "&BizEmail))`,
    st.footer,
  );
  shPrint.merge('B11:D11', `=IF(BizTaxId="","","NPWP "&BizTaxId)`, st.footer);
  shPrint.merge('E8:G8', `=IF($I$5="","",IF(${isInv},${q(p.invTitle)},${q(p.quoTitle)}))`, {
    font: { name: 'Georgia', size: 18, bold: true, color: accent.main },
    align: { h: 'right', v: 'center' },
  });
  const meta: [string, string, Style][] = [
    [p.no, '=PrintDoc', st.calcText],
    [p.date, `=${dv('DocDate')}`, { ...st.calcText, numFmt: st.date }],
    [
      `=IF($I$5="","",IF(${isInv},${q(p.due)},${q(p.valid)}))`,
      `=${dv('DocDue')}`,
      { ...st.calcText, numFmt: st.date },
    ],
  ];
  meta.forEach(([label, f, style], i) => {
    const r = 9 + i;
    shPrint
      .set(`E${r}`, label, { ...st.label, align: { h: 'right', v: 'center' } })
      .merge(`F${r}:G${r}`, f, { ...style, align: { h: 'right' } });
  });
  shPrint.style('B12:G12', { border: { bottom: { style: 'medium', color: accent.main } } });
  // Kepada
  const ci = `MATCH(INDEX(DocCustomer,$I$5),Customers,0)`;
  shPrint.set('B14', p.to, { ...st.label, font: { size: 9, bold: true, color: '6F675C' } });
  shPrint.merge('B15:D15', `=${dv('DocCustomer')}&""`, {
    font: { size: 12, bold: true, color: INK },
  });
  shPrint.merge('B16:D16', `=IF($I$5="","",IFERROR(INDEX(CustContact,${ci})&"",""))`, st.footer);
  shPrint.merge(
    'B17:D17',
    `=IF($I$5="","",IFERROR(TRIM(INDEX(CustAddress,${ci})&" "&INDEX(CustCity,${ci})),""))`,
    st.footer,
  );
  shPrint.merge('B18:D18', `=IF($I$5="","",IFERROR(INDEX(CustPhone,${ci})&"",""))`, st.footer);
  shPrint
    .set('E15', p.ref, { ...st.label, align: { h: 'right' } })
    .merge('F15:G15', `=${dv('DocRef')}&""`, { ...st.calcText, align: { h: 'right' } });
  // Tabel item
  const tHead = 20;
  p.head.forEach((h, i) => shPrint.set(`${'BCDEFG'[i]}${tHead}`, h, i === 1 ? st.thLeft : st.th));
  shPrint.height(tHead, 22);
  for (let k = 1; k <= PRINT_LINES; k++) {
    const r = tHead + k;
    const li = (n: string) => `INDEX(${n},$I${r})`;
    shPrint
      .set(`I${r}`, `=IF($I$5="","",IFERROR(MATCH(${k},LineSeq,0),""))`)
      .set(`B${r}`, `=IF($I${r}="","",${k})`, st.rowLabel)
      .set(`C${r}`, `=IF($I${r}="","",${li('LineItem')})`, {
        ...st.rowLabel,
        align: { wrap: true, indent: 1 },
      })
      .set(`D${r}`, `=IF($I${r}="","",${li('LineQty')})`, {
        ...st.rowMoney,
        numFmt: FMT.qty,
        align: { h: 'center' },
      })
      .set(`E${r}`, `=IF($I${r}="","",${li('LineUnit')})`, {
        ...st.rowLabel,
        align: { h: 'center' },
      })
      .set(`F${r}`, `=IF($I${r}="","",${li('LinePrice')})`, st.rowMoney)
      .set(`G${r}`, `=IF($I${r}="","",${li('LineAmount')})`, st.rowMoney);
  }
  const tot = tHead + PRINT_LINES + 1;
  shPrint.merge(`B${tot}:G${tot}`, `=IF(MAX(LineSeq)>${PRINT_LINES},${q(p.more)},"")`, {
    ...st.note,
    font: { size: 9, italic: true, color: WARN },
  });
  const sums: [string, string, Style, string?][] = [
    [p.subtotal, `=${dv('DocSubtotal')}`, st.rowMoney],
    [
      `=${q(p.disc)}&IF(N(${dv('DocDisc')})>0," ("&${dv('DocDisc')}&"%)","")`,
      `=${dv('DocDiscAmt')}`,
      st.rowMoney,
    ],
    [p.dpp, `=${dv('DocDpp')}`, st.rowMoney],
    [`=${q(p.vat)}&IF(N(${dv('DocVat')})>0," ("&VatRate&"%)","")`, `=${dv('DocVat')}`, st.rowMoney],
    [p.total, `=${dv('DocTotal')}`, st.grandMoney, 'grand'],
    [p.paid, `=IF($I$5="","",IF(${isInv},N(INDEX(DocPaid,$I$5)),""))`, st.rowMoney],
    [p.balance, `=IF($I$5="","",IF(${isInv},INDEX(DocBalance,$I$5),""))`, st.totalMoney, 'total'],
  ];
  sums.forEach(([label, f, style, kind], i) => {
    const r = tot + 1 + i;
    shPrint
      .merge(
        `E${r}:F${r}`,
        label,
        kind === 'grand'
          ? st.grandLabel
          : kind === 'total'
            ? st.totalLabel
            : { ...st.rowLabel, align: { h: 'right' } },
      )
      .set(`G${r}`, f, style);
  });
  const tLast = tot + sums.length;
  shPrint.height(tot + 5, 24);
  // Cap LUNAS
  shPrint.merge(
    `B${tot + 2}:C${tot + 4}`,
    `=IF($I$5="","",IF(INDEX(DocStatus,$I$5)=${ST.paid},${q(t.status.paid.toUpperCase())},""))`,
    {
      font: { name: 'Georgia', size: 26, bold: true, color: GOOD },
      align: { h: 'center', v: 'center' },
    },
  );
  // Terbilang
  const T = `INT(N(${dv('DocTotal')}))`;
  const w = (expr: string) => `INDEX(Words,${expr}+1)`;
  const g = (div: string) => `MOD(INT(${T}/${div}),1000)`;
  const thousand =
    locale === 'id'
      ? `IF(${g('1000')}>0,IF(${g('1000')}=1,"seribu ",${w(g('1000'))}&" ribu "),"")`
      : `IF(${g('1000')}>0,${w(g('1000'))}&" thousand ","")`;
  const scale =
    locale === 'id' ? ['triliun', 'miliar', 'juta'] : ['trillion', 'billion', 'million'];
  const decimals = CURRENCIES[currency].decimals
    ? `&IF(ROUND(MOD(N(${dv('DocTotal')}),1)*100,0)>0,${q(t.and)}&TEXT(ROUND(MOD(N(${dv('DocTotal')}),1)*100,0),"00")&"/100","")`
    : '';
  shPrint.set(
    'J5',
    `=IF(N(${dv('DocTotal')})<=0,"",TRIM(IF(${g('1E12')}>0,${w(g('1E12'))}&" ${scale[0]} ","")&IF(${g('1E9')}>0,${w(g('1E9'))}&" ${scale[1]} ","")&IF(${g('1E6')}>0,${w(g('1E6'))}&" ${scale[2]} ","")&${thousand}&${w(`MOD(${T},1000)`)})${decimals}&" "&CurrencyWord)`,
  );
  const wr = tLast + 2;
  shPrint.set(`B${wr}`, p.words, { ...st.label, font: { size: 9, bold: true, color: '6F675C' } });
  shPrint.merge(`C${wr}:G${wr}`, '=IF(J5="","",UPPER(LEFT(J5,1))&MID(J5,2,500))', {
    font: { size: 10, italic: true, color: INK },
    align: { wrap: true, v: 'top' },
  });
  shPrint.height(wr, 30);
  // Pembayaran, catatan, tanda tangan
  const nr = wr + 2;
  shPrint.set(`B${nr}`, p.pay, st.label).merge(`C${nr}:D${nr}`, '=IF(BankInfo="","",BankInfo)', {
    ...st.footer,
    align: { wrap: true, v: 'top' },
  });
  shPrint
    .set(`B${nr + 1}`, p.notes, st.label)
    .merge(`C${nr + 1}:D${nr + 2}`, `=${dv('DocNote')}&""`, {
      ...st.footer,
      align: { wrap: true, v: 'top' },
    });
  shPrint.merge(`B${nr + 3}:D${nr + 3}`, '=FooterNote&""', {
    ...st.footer,
    font: { size: 9, italic: true, color: '6F675C' },
  });
  shPrint.merge(`F${nr}:G${nr}`, p.regards, { ...st.footer, align: { h: 'center' } });
  shPrint.merge(`F${nr + 4}:G${nr + 4}`, '=Signer&""', {
    font: { size: 10, bold: true, color: INK },
    border: { top: { style: 'thin', color: INK } },
    align: { h: 'center' },
  });
  shPrint.merge(`F${nr + 5}:G${nr + 5}`, '=SignerTitle&""', {
    ...st.footer,
    align: { h: 'center' },
  });

  // ---------- Dashboard ----------
  sheetHeader(shDash, st, {
    brand: t.brand,
    title: S.dash,
    subtitle: t.subtitle.dash,
    lastCol: 'M',
    menu,
  });
  for (const c of 'BCDEFGHIJKLM') shDash.width(c, 11.5);
  for (const c of ['O', 'P', 'Q', 'R', 'S', 'T', 'U']) shDash.width(c, 6, true);
  shDash.set('B2', `=${q(S.dash + ' · ')}&BizName`, st.title);
  monthPicker(shDash, st, locale, { year, yearFormula: 'DocYear' });
  const salesM = (m: string) => `SUMIFS(DocTotal,DocType,${INV},DocMonth,${m})`;
  const recvM = (m: string) => `SUMIFS(DocPaid,DocType,${INV},DocPaidMonth,${m})`;
  const salesYtd = `SUMIFS(DocTotal,DocType,${INV},DocMonth,"<="&$F$5)`;
  const invYtd = `COUNTIFS(DocType,${INV},DocMonth,"<="&$F$5)`;
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 7,
    label: t.kSales,
    value: `=${salesM('$F$5')}`,
    note: `=COUNTIFS(DocType,${INV},DocMonth,$F$5)&${q(t.invCount)}&IF(OR($F$5=1,${salesM('$F$5-1')}=0),""," · "&${q(t.vsPrev)}&TEXT(${salesM('$F$5')}/${salesM('$F$5-1')}-1,"+0%;-0%"))`,
  });
  kpiCard(shDash, st, {
    col: 'E',
    toCol: 'G',
    row: 7,
    label: t.kReceived,
    value: `=${recvM('$F$5')}`,
  });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 7,
    label: t.kAr,
    value: '=SUM(DocBalance)',
    note: `=COUNTIFS(DocType,${INV},DocBalance,">0")&${q(t.invCount)}`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 7,
    label: t.kLate,
    value: `=COUNTIF(DocStatus,${ST.late})`,
    note: `=${q(t.lateValue)}&TEXT(SUMIFS(DocBalance,DocStatus,${ST.late}),"#,##0")`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, {
    col: 'B',
    toCol: 'D',
    row: 11,
    label: t.kQuotes,
    value: `=COUNTIFS(DocType,${QUO},DocMonth,$F$5)`,
    note: `=${q(t.quoteValue)}&TEXT(SUMIFS(DocTotal,DocType,${QUO},DocMonth,$F$5),"#,##0")`,
    numFmt: '#,##0',
  });
  kpiCard(shDash, st, { col: 'E', toCol: 'G', row: 11, label: t.kYtd, value: `=${salesYtd}` });
  kpiCard(shDash, st, {
    col: 'H',
    toCol: 'J',
    row: 11,
    label: t.kAvg,
    value: `=IF(${invYtd}=0,0,${salesYtd}/${invYtd})`,
  });
  kpiCard(shDash, st, {
    col: 'K',
    toCol: 'M',
    row: 11,
    label: t.kCust,
    value: '=COUNTIF(CustSales,">0")',
    note: t.custNote,
    numFmt: '#,##0',
  });
  shDash.cond('K8:M8', {
    type: 'cellIs',
    operator: 'greaterThan',
    formula: '0',
    style: { font: { color: BAD } },
  });
  // Rekap per bulan (tabel di bawah, sumber grafik)
  const mH = 58;
  shDash.merge(`B${mH}:H${mH}`, t.monthH, st.h2);
  shDash.merge(`B${mH + 1}:C${mH + 1}`, t.monthHead[0], st.thLeft);
  shDash
    .merge(`D${mH + 1}:E${mH + 1}`, t.monthHead[1], st.th)
    .merge(`F${mH + 1}:G${mH + 1}`, t.monthHead[2], st.th)
    .set(`H${mH + 1}`, t.monthHead[3], st.th);
  for (let mo = 1; mo <= 12; mo++) {
    const r = mH + 1 + mo;
    shDash
      .merge(`B${r}:C${r}`, months.long[mo - 1], st.rowLabel)
      .merge(`D${r}:E${r}`, `=${salesM(String(mo))}`, st.rowMoney)
      .merge(`F${r}:G${r}`, `=${recvM(String(mo))}`, st.rowMoney)
      .set(`H${r}`, `=COUNTIFS(DocType,${QUO},DocMonth,${mo})`, { ...st.rowMoney, numFmt: FMT.int })
      .set(`O${r}`, months.short[mo - 1]);
  }
  const mRange = (c: string) => ref(S.dash, `$${c}$${mH + 2}:$${c}$${mH + 13}`);
  shDash.chart({
    type: 'column',
    title: t.chartSales,
    from: 'B15',
    to: 'H33',
    numFmt: '#,##0',
    series: [
      { name: t.sales, categories: mRange('O'), values: mRange('D'), color: accent.main },
      { name: t.received, categories: mRange('O'), values: mRange('F'), color: '3C6A33' },
    ],
  });
  // 5 pelanggan dan 5 produk teratas (kolom bantu tersembunyi, urutan peringkat) untuk grafik batang.
  for (let k = 1; k <= 5; k++) {
    const r = 15 + k;
    shDash
      .set(`P${r}`, `=IFERROR(LARGE(CustSales,${k}),0)`)
      .set(`Q${r}`, `=IF(N(P${r})<=0,"",INDEX(Customers,MATCH(P${r},CustSales,0)))`)
      .set(`R${r}`, `=N(P${r})`)
      .set(`S${r}`, `=IFERROR(LARGE(ProdRevenue,${k}),0)`)
      .set(`T${r}`, `=IF(N(S${r})<=0,"",INDEX(ProdName,MATCH(S${r},ProdRevenue,0)))`)
      .set(`U${r}`, `=N(S${r})`);
  }
  shDash.chart({
    type: 'bar',
    title: t.chartCust,
    from: 'H15',
    to: 'N33',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.sales,
        categories: ref(S.dash, '$Q$16:$Q$20'),
        values: ref(S.dash, '$R$16:$R$20'),
        color: accent.main,
      },
    ],
  });
  shDash.chart({
    type: 'bar',
    title: t.chartProd,
    from: 'B35',
    to: 'H55',
    numFmt: '#,##0',
    legend: 'none',
    series: [
      {
        name: t.sales,
        categories: ref(S.dash, '$T$16:$T$20'),
        values: ref(S.dash, '$U$16:$U$20'),
        color: CHART_COLORS[1],
      },
    ],
  });
  // Perlu ditagih
  shDash.merge('I35:M35', t.dueH, st.h2);
  shDash
    .merge('I36:J36', t.dueHead[0], st.thLeft)
    .set('K36', t.dueHead[1], st.thLeft)
    .set('L36', t.dueHead[2], st.th)
    .set('M36', t.dueHead[3], st.th)
    .height(36, 26);
  for (let k = 1; k <= 12; k++) {
    const r = 36 + k;
    const ix = (n: string) => `IF($O${r}="","",INDEX(${n},$O${r}))`;
    shDash
      .set(`O${r}`, `=IFERROR(MATCH(${k},DocDueSeq,0),"")`)
      .merge(
        `I${r}:J${r}`,
        k === 1 ? `=IF($O${r}="",${q(t.noDue)},INDEX(DocNo,$O${r}))` : `=${ix('DocNo')}`,
        st.rowLabel,
      )
      .set(`K${r}`, `=${ix('DocCustomer')}`, st.rowLabel)
      .set(`L${r}`, `=${ix('DocDue')}`, { ...st.rowMoney, numFmt: st.date, align: { h: 'center' } })
      .set(`M${r}`, `=${ix('DocBalance')}`, st.rowMoney);
  }
  shDash.cond('L37:L48', {
    type: 'expression',
    formula: 'AND(ISNUMBER(L37),L37<TODAY())',
    style: { fill: BAD_BG, font: { color: BAD, bold: true } },
  });

  // ---------- Menu ----------
  menuSheet(shMenu, st, accent, locale, {
    brand: t.brand,
    title: t.name,
    subtitle: t.subtitle.menu,
    line: `=BizName&${q(' · ')}&DocYear`,
    steps: t.steps,
    items: [
      [S.dash, t.desc.dash],
      [S.print, t.desc.print],
      [S.docs, t.desc.docs],
      [S.lines, t.desc.lines],
      [S.cust, t.desc.cust],
      [S.prod, t.desc.prod],
      [S.set, t.desc.set],
    ],
  });

  return wb;

  // ---------- Contoh data ----------
  function makeSample() {
    const rnd = seeded(year * 11 + 7);
    const products = t.sample.products.map(([code, name, unit, price, cat]) => ({
      code,
      name,
      unit,
      price: money(price),
      cat,
    }));
    const customers = t.sample.customers;
    const now = new Date();
    const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    type Doc = {
      type: 'inv' | 'quo';
      date: number;
      customer: string;
      disc: number;
      vat: boolean;
      ref?: string;
      note?: string;
      paid?: number;
      paidOn?: number;
      no: string;
      total: number;
    };
    const docs: Doc[] = [];
    const lines: { doc: string; code: string; qty: number; note?: string }[] = [];
    const counters = { inv: 0, quo: 0 };
    const vatRate = Math.max(0, opts.vat);
    const today = excelDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const pref = { inv: 'INV', quo: locale === 'id' ? 'PNW' : 'QUO' };
    for (let m = 1; m <= lastMonth; m++) {
      const n = 3 + Math.floor(rnd() * 3);
      const days = new Date(year, m, 0).getDate();
      const entries = Array.from({ length: n + 1 }, (_, i) => ({
        type: (i === n ? 'quo' : 'inv') as 'inv' | 'quo',
        day: 1 + Math.floor(rnd() * (days - 1)),
      })).sort((a, b) => a.day - b.day);
      for (const e of entries) {
        const cust = customers[Math.floor(rnd() * customers.length)][0];
        counters[e.type]++;
        const no = `${pref[e.type]}/${year}/${String(counters[e.type]).padStart(3, '0')}`;
        const items = 1 + Math.floor(rnd() * 3);
        let subtotal = 0;
        const used = new Set<number>();
        for (let j = 0; j < items; j++) {
          let pi = Math.floor(rnd() * products.length);
          while (used.has(pi)) pi = (pi + 1) % products.length;
          used.add(pi);
          const prod = products[pi];
          const qty = prod.price >= money(1_000_000) ? 1 : [2, 3, 5, 10, 20][Math.floor(rnd() * 5)];
          lines.push({ doc: no, code: prod.code, qty });
          subtotal += qty * prod.price;
        }
        const disc = rnd() < 0.2 ? 5 : 0;
        const vat = vatRate > 0 && rnd() < 0.7;
        const dpp = Math.round(subtotal * (1 - disc / 100));
        const total = dpp + (vat ? Math.round((dpp * vatRate) / 100) : 0);
        const date = excelDate(year, m, e.day);
        const due = date + Math.round(opts.payTerms);
        const doc: Doc = {
          type: e.type,
          date,
          customer: cust,
          disc,
          vat,
          no,
          total,
          ref: rnd() < 0.3 ? `PO-${100 + docs.length}` : undefined,
        };
        if (e.type === 'inv') {
          // Sebagian besar lunas tepat waktu; invoice terbaru sebagian belum dibayar.
          const r = rnd();
          if (due < today - 10 ? r < 0.92 : r < 0.4) {
            doc.paid = total;
            doc.paidOn = Math.min(today, date + Math.floor(rnd() * Math.max(1, opts.payTerms + 5)));
          } else if (r < 0.55) {
            doc.paid = Math.round(total / 2);
            doc.paidOn = Math.min(today, date + 3);
            doc.note = t.sample.note;
          }
        }
        docs.push(doc);
      }
    }
    return {
      products,
      customers,
      docs: docs.slice(0, DOC_ROWS),
      lines: lines.slice(0, LINE_ROWS),
    };
  }
}

/**
 * Harga dari teks bebas: "3.500.000", "3,500,000", "Rp 3.500.000", "12.50" atau "12,5".
 * Titik/koma diikuti 1-2 angka di akhir dianggap desimal; selain itu pemisah ribuan.
 */
export function parsePrice(s: string): number | null {
  const x = s.replace(/[^\d.,]/g, '');
  if (!x) return null;
  const dec = /[.,](\d{1,2})$/.exec(x);
  const whole = (dec ? x.slice(0, dec.index) : x).replace(/[.,]/g, '');
  const n = Number(`${whole || '0'}${dec ? `.${dec[1]}` : ''}`);
  return Number.isFinite(n) && n > 0 ? n : null;
}
