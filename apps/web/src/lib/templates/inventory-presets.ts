/** Pilihan bawaan template Inventaris & Gudang: batas daftar dan preset per jenis usaha. */
import type { Locale } from '../format';

/** Gudang dibatasi 6 karena sheet Stok per Gudang punya satu kolom per gudang. */
export const INVENTORY_LIMITS = { warehouses: 6, categories: 30, units: 20 };

/** Contoh barang: nama, indeks kategori, indeks satuan, harga beli & jual (Rp), stok minimum, jumlah pesan. */
export type SampleItem = [string, number, number, number, number, number, number];

interface Preset {
  warehouses: string[];
  categories: string[];
  units: string[];
  items: SampleItem[];
}

export type InventoryPresetId = 'umum' | 'toko' | 'kuliner' | 'online';

export const INVENTORY_PRESETS: Record<Locale, Record<InventoryPresetId, Preset>> = {
  id: {
    umum: {
      warehouses: ['Gudang utama', 'Gudang cabang'],
      categories: ['Bahan baku', 'Barang jadi', 'Kemasan', 'Suku cadang', 'Perlengkapan kantor'],
      units: ['pcs', 'box', 'kg', 'liter', 'rim', 'roll', 'unit', 'lusin'],
      items: [
        ['Kardus 40x30x30', 2, 0, 4_500, 7_000, 100, 300],
        ['Lakban bening 2 inci', 2, 0, 9_000, 13_000, 40, 120],
        ['Bubble wrap 50 m', 2, 5, 65_000, 85_000, 5, 15],
        ['Kertas HVS A4 70 g', 4, 4, 48_000, 58_000, 10, 30],
        ['Tinta printer hitam', 4, 0, 85_000, 110_000, 5, 12],
        ['Baut M8 isi 100', 3, 1, 35_000, 50_000, 8, 20],
        ['Bearing 6203', 3, 0, 28_000, 42_000, 15, 40],
        ['Oli mesin', 3, 3, 62_000, 80_000, 12, 36],
        ['Biji plastik PP', 0, 2, 21_000, 0, 100, 500],
        ['Cat dasar putih', 0, 2, 38_000, 0, 20, 60],
        ['Rak besi siku', 1, 6, 320_000, 450_000, 4, 10],
        ['Kursi lipat', 1, 6, 145_000, 210_000, 6, 20],
      ],
    },
    toko: {
      warehouses: ['Gudang belakang', 'Rak toko'],
      categories: [
        'Sembako',
        'Makanan',
        'Minuman',
        'Perawatan diri',
        'Kebutuhan rumah tangga',
        'Alat tulis',
      ],
      units: ['pcs', 'pak', 'dus', 'kg', 'liter', 'botol', 'renceng'],
      items: [
        ['Beras premium 5 kg', 0, 1, 68_000, 76_000, 10, 30],
        ['Minyak goreng 2 L', 0, 0, 34_000, 38_500, 12, 36],
        ['Gula pasir 1 kg', 0, 1, 16_500, 18_500, 20, 50],
        ['Telur ayam', 0, 3, 27_000, 30_000, 10, 25],
        ['Mi instan goreng', 1, 2, 105_000, 120_000, 5, 15],
        ['Biskuit kelapa', 1, 0, 7_500, 9_500, 24, 72],
        ['Air mineral 600 ml', 2, 2, 42_000, 52_000, 6, 20],
        ['Teh botol 350 ml', 2, 2, 78_000, 92_000, 4, 12],
        ['Kopi sachet', 2, 6, 11_000, 13_500, 15, 40],
        ['Sabun mandi batang', 3, 0, 3_500, 4_500, 36, 96],
        ['Sampo sachet', 3, 6, 9_000, 11_500, 15, 40],
        ['Deterjen bubuk 800 g', 4, 0, 19_500, 23_500, 12, 36],
      ],
    },
    kuliner: {
      warehouses: ['Gudang kering', 'Kulkas & freezer'],
      categories: [
        'Bahan pokok',
        'Daging & seafood',
        'Sayur & buah',
        'Bumbu',
        'Minuman',
        'Kemasan',
      ],
      units: ['kg', 'liter', 'pcs', 'pak', 'ikat', 'botol', 'karton'],
      items: [
        ['Beras', 0, 0, 13_500, 0, 25, 100],
        ['Ayam potong', 1, 0, 36_000, 0, 10, 30],
        ['Daging sapi', 1, 0, 130_000, 0, 5, 15],
        ['Udang segar', 1, 0, 95_000, 0, 3, 10],
        ['Bawang merah', 3, 0, 38_000, 0, 4, 10],
        ['Bawang putih', 3, 0, 32_000, 0, 3, 8],
        ['Cabai rawit', 3, 0, 55_000, 0, 2, 6],
        ['Minyak goreng', 0, 1, 17_500, 0, 15, 40],
        ['Kangkung', 2, 4, 3_000, 0, 20, 60],
        ['Jeruk nipis', 2, 0, 18_000, 0, 2, 6],
        ['Kopi bubuk arabika', 4, 0, 180_000, 0, 2, 5],
        ['Cup plastik 16 oz', 5, 3, 28_000, 0, 10, 30],
      ],
    },
    online: {
      warehouses: ['Gudang rumah', 'Gudang fulfillment'],
      categories: ['Atasan', 'Bawahan', 'Hijab & aksesoris', 'Sepatu & sandal', 'Kemasan'],
      units: ['pcs', 'pasang', 'lusin', 'pak', 'roll'],
      items: [
        ['Kaos polos hitam M', 0, 0, 32_000, 59_000, 20, 60],
        ['Kaos polos putih L', 0, 0, 32_000, 59_000, 20, 60],
        ['Kemeja flanel', 0, 0, 78_000, 139_000, 8, 24],
        ['Celana chino', 1, 0, 95_000, 169_000, 8, 20],
        ['Rok plisket', 1, 0, 62_000, 115_000, 6, 18],
        ['Hijab segi empat voal', 2, 0, 28_000, 55_000, 25, 60],
        ['Pashmina ceruty', 2, 0, 24_000, 49_000, 25, 60],
        ['Sneakers kanvas', 3, 1, 120_000, 219_000, 5, 15],
        ['Sandal slop', 3, 1, 35_000, 69_000, 10, 30],
        ['Polymailer 25x35', 4, 3, 45_000, 0, 5, 15],
        ['Bubble wrap 50 m', 4, 4, 65_000, 0, 2, 6],
        ['Label thermal 100x150', 4, 4, 38_000, 0, 3, 8],
      ],
    },
  },
  en: {
    umum: {
      warehouses: ['Main warehouse', 'Branch warehouse'],
      categories: [
        'Raw materials',
        'Finished goods',
        'Packaging',
        'Spare parts',
        'Office supplies',
      ],
      units: ['pcs', 'box', 'kg', 'liter', 'ream', 'roll', 'unit', 'dozen'],
      items: [
        ['Carton box 40x30x30', 2, 0, 4_500, 7_000, 100, 300],
        ['Clear tape 2 inch', 2, 0, 9_000, 13_000, 40, 120],
        ['Bubble wrap 50 m', 2, 5, 65_000, 85_000, 5, 15],
        ['A4 copy paper 70 gsm', 4, 4, 48_000, 58_000, 10, 30],
        ['Black printer ink', 4, 0, 85_000, 110_000, 5, 12],
        ['M8 bolts, box of 100', 3, 1, 35_000, 50_000, 8, 20],
        ['Bearing 6203', 3, 0, 28_000, 42_000, 15, 40],
        ['Engine oil', 3, 3, 62_000, 80_000, 12, 36],
        ['PP plastic pellets', 0, 2, 21_000, 0, 100, 500],
        ['White primer paint', 0, 2, 38_000, 0, 20, 60],
        ['Steel shelving rack', 1, 6, 320_000, 450_000, 4, 10],
        ['Folding chair', 1, 6, 145_000, 210_000, 6, 20],
      ],
    },
    toko: {
      warehouses: ['Back store', 'Shop floor'],
      categories: ['Groceries', 'Snacks', 'Drinks', 'Personal care', 'Household', 'Stationery'],
      units: ['pcs', 'pack', 'case', 'kg', 'liter', 'bottle', 'strip'],
      items: [
        ['Premium rice 5 kg', 0, 1, 68_000, 76_000, 10, 30],
        ['Cooking oil 2 L', 0, 0, 34_000, 38_500, 12, 36],
        ['Sugar 1 kg', 0, 1, 16_500, 18_500, 20, 50],
        ['Eggs', 0, 3, 27_000, 30_000, 10, 25],
        ['Instant noodles', 1, 2, 105_000, 120_000, 5, 15],
        ['Coconut biscuits', 1, 0, 7_500, 9_500, 24, 72],
        ['Mineral water 600 ml', 2, 2, 42_000, 52_000, 6, 20],
        ['Bottled tea 350 ml', 2, 2, 78_000, 92_000, 4, 12],
        ['Coffee sachets', 2, 6, 11_000, 13_500, 15, 40],
        ['Bar soap', 3, 0, 3_500, 4_500, 36, 96],
        ['Shampoo sachets', 3, 6, 9_000, 11_500, 15, 40],
        ['Laundry powder 800 g', 4, 0, 19_500, 23_500, 12, 36],
      ],
    },
    kuliner: {
      warehouses: ['Dry storage', 'Fridge & freezer'],
      categories: ['Staples', 'Meat & seafood', 'Produce', 'Spices', 'Beverages', 'Packaging'],
      units: ['kg', 'liter', 'pcs', 'pack', 'bunch', 'bottle', 'carton'],
      items: [
        ['Rice', 0, 0, 13_500, 0, 25, 100],
        ['Chicken', 1, 0, 36_000, 0, 10, 30],
        ['Beef', 1, 0, 130_000, 0, 5, 15],
        ['Fresh prawns', 1, 0, 95_000, 0, 3, 10],
        ['Shallots', 3, 0, 38_000, 0, 4, 10],
        ['Garlic', 3, 0, 32_000, 0, 3, 8],
        ['Bird’s eye chili', 3, 0, 55_000, 0, 2, 6],
        ['Cooking oil', 0, 1, 17_500, 0, 15, 40],
        ['Water spinach', 2, 4, 3_000, 0, 20, 60],
        ['Limes', 2, 0, 18_000, 0, 2, 6],
        ['Arabica ground coffee', 4, 0, 180_000, 0, 2, 5],
        ['Plastic cups 16 oz', 5, 3, 28_000, 0, 10, 30],
      ],
    },
    online: {
      warehouses: ['Home storage', 'Fulfillment center'],
      categories: ['Tops', 'Bottoms', 'Scarves & accessories', 'Footwear', 'Packaging'],
      units: ['pcs', 'pair', 'dozen', 'pack', 'roll'],
      items: [
        ['Plain black tee M', 0, 0, 32_000, 59_000, 20, 60],
        ['Plain white tee L', 0, 0, 32_000, 59_000, 20, 60],
        ['Flannel shirt', 0, 0, 78_000, 139_000, 8, 24],
        ['Chino pants', 1, 0, 95_000, 169_000, 8, 20],
        ['Pleated skirt', 1, 0, 62_000, 115_000, 6, 18],
        ['Voile square scarf', 2, 0, 28_000, 55_000, 25, 60],
        ['Chiffon shawl', 2, 0, 24_000, 49_000, 25, 60],
        ['Canvas sneakers', 3, 1, 120_000, 219_000, 5, 15],
        ['Slide sandals', 3, 1, 35_000, 69_000, 10, 30],
        ['Poly mailers 25x35', 4, 3, 45_000, 0, 5, 15],
        ['Bubble wrap 50 m', 4, 4, 65_000, 0, 2, 6],
        ['Thermal labels 100x150', 4, 4, 38_000, 0, 3, 8],
      ],
    },
  },
};

/** Pemasok contoh di sheet Pengaturan (hanya saat contoh data dicentang). */
export const SAMPLE_SUPPLIERS: Record<Locale, [string, string, number][]> = {
  id: [
    ['UD Sumber Makmur', '0812-0000-1111', 3],
    ['PT Distribusi Nusantara', '021-000-2222', 7],
    ['CV Mitra Kemas', '0813-0000-3333', 5],
  ],
  en: [
    ['Prime Source Ltd', '555-0101', 3],
    ['National Distribution Co.', '555-0102', 7],
    ['PackRight Supplies', '555-0103', 5],
  ],
};
