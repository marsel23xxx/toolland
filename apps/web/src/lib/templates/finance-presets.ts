/** Pilihan bawaan template Keuangan UMKM: batas daftar, preset kategori per jenis usaha, akun. */
import type { Locale } from '../format';

export const FINANCE_LIMITS = { accounts: 15, income: 25, expense: 40 };

type Preset = { income: string[]; expense: string[] };
export type FinancePresetId = 'umum' | 'toko' | 'kuliner' | 'jasa' | 'online';

/**
 * Urutan kategori pengeluaran sengaja sama di semua preset: [0] belanja/bahan, [1] gaji,
 * [2] sewa, [3...] tagihan rutin. Contoh data di keuangan-umkm.ts mengandalkan urutan ini.
 */
export const FINANCE_PRESETS: Record<Locale, Record<FinancePresetId, Preset>> = {
  id: {
    umum: {
      income: ['Penjualan produk', 'Penjualan jasa', 'Pendapatan lain-lain'],
      expense: [
        'Pembelian stok/bahan',
        'Gaji & upah',
        'Sewa tempat',
        'Listrik & air',
        'Internet & pulsa',
        'Transportasi',
        'Pemasaran & iklan',
        'Peralatan & perlengkapan',
        'Biaya bank & admin',
        'Pajak',
        'Lain-lain',
      ],
    },
    toko: {
      income: ['Penjualan tunai', 'Penjualan kredit', 'Pendapatan lain-lain'],
      expense: [
        'Pembelian barang dagangan',
        'Gaji karyawan',
        'Sewa toko',
        'Listrik & air',
        'Kemasan & kantong',
        'Ongkos angkut',
        'Promosi',
        'Perawatan toko',
        'Biaya bank & EDC',
        'Pajak',
        'Lain-lain',
      ],
    },
    kuliner: {
      income: [
        'Penjualan makan di tempat',
        'Penjualan ojek online',
        'Pesanan katering',
        'Pendapatan lain-lain',
      ],
      expense: [
        'Bahan baku',
        'Gaji & upah',
        'Sewa tempat',
        'Gas & bahan bakar',
        'Listrik & air',
        'Kemasan',
        'Komisi aplikasi',
        'Peralatan dapur',
        'Promosi',
        'Pajak',
        'Lain-lain',
      ],
    },
    jasa: {
      income: ['Pendapatan proyek', 'Pendapatan langganan', 'Pendapatan lain-lain'],
      expense: [
        'Biaya proyek & vendor',
        'Gaji & honor',
        'Sewa kantor',
        'Software & langganan',
        'Internet & pulsa',
        'Transportasi',
        'Pemasaran',
        'Peralatan kantor',
        'Biaya bank & admin',
        'Pajak',
        'Lain-lain',
      ],
    },
    online: {
      income: [
        'Penjualan marketplace',
        'Penjualan media sosial',
        'Penjualan website',
        'Pendapatan lain-lain',
      ],
      expense: [
        'Pembelian stok',
        'Gaji admin',
        'Sewa gudang',
        'Biaya admin marketplace',
        'Iklan online',
        'Ongkos kirim',
        'Kemasan',
        'Internet & pulsa',
        'Peralatan',
        'Pajak',
        'Lain-lain',
      ],
    },
  },
  en: {
    umum: {
      income: ['Product sales', 'Service income', 'Other income'],
      expense: [
        'Inventory & materials',
        'Salaries & wages',
        'Rent',
        'Electricity & water',
        'Internet & phone',
        'Transport',
        'Marketing & ads',
        'Equipment & supplies',
        'Bank fees',
        'Taxes',
        'Other',
      ],
    },
    toko: {
      income: ['Cash sales', 'Credit sales', 'Other income'],
      expense: [
        'Merchandise purchases',
        'Staff salaries',
        'Shop rent',
        'Electricity & water',
        'Packaging & bags',
        'Freight',
        'Promotion',
        'Shop maintenance',
        'Bank & card fees',
        'Taxes',
        'Other',
      ],
    },
    kuliner: {
      income: ['Dine-in sales', 'Delivery app sales', 'Catering orders', 'Other income'],
      expense: [
        'Ingredients',
        'Salaries & wages',
        'Rent',
        'Gas & fuel',
        'Electricity & water',
        'Packaging',
        'App commissions',
        'Kitchen equipment',
        'Promotion',
        'Taxes',
        'Other',
      ],
    },
    jasa: {
      income: ['Project income', 'Subscription income', 'Other income'],
      expense: [
        'Project costs & vendors',
        'Salaries & fees',
        'Office rent',
        'Software & subscriptions',
        'Internet & phone',
        'Transport',
        'Marketing',
        'Office equipment',
        'Bank fees',
        'Taxes',
        'Other',
      ],
    },
    online: {
      income: ['Marketplace sales', 'Social media sales', 'Website sales', 'Other income'],
      expense: [
        'Inventory purchases',
        'Admin salaries',
        'Warehouse rent',
        'Marketplace fees',
        'Online ads',
        'Shipping',
        'Packaging',
        'Internet & phone',
        'Equipment',
        'Taxes',
        'Other',
      ],
    },
  },
};

export const FINANCE_DEFAULT_ACCOUNTS: Record<Locale, string[]> = {
  id: ['Kas tunai', 'Rekening bank', 'Dompet digital/QRIS'],
  en: ['Cash on hand', 'Bank account', 'E-wallet'],
};
