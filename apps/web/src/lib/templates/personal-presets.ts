/** Pilihan bawaan template Keuangan Pribadi: batas daftar, dompet, dan preset per profil. */
import type { Locale } from '../format';

export const PERSONAL_LIMITS = { wallets: 12, income: 20, expense: 40 };

/** Kelompok anggaran 50/30/20: kebutuhan, keinginan, tabungan. */
export type BudgetGroup = 'N' | 'W' | 'S';

/** Kategori pengeluaran: nama, kelompok 50/30/20, anggaran sebulan (Rp). */
export type ExpenseCat = [string, BudgetGroup, number];

interface Preset {
  income: string[];
  expense: ExpenseCat[];
}

export type PersonalPresetId = 'lajang' | 'keluarga' | 'mahasiswa' | 'freelancer';

export const PERSONAL_WALLETS: Record<Locale, string[]> = {
  id: ['Dompet tunai', 'Rekening bank', 'E-wallet'],
  en: ['Cash', 'Bank account', 'E-wallet'],
};

export const PERSONAL_PRESETS: Record<Locale, Record<PersonalPresetId, Preset>> = {
  id: {
    lajang: {
      income: ['Gaji', 'Bonus & THR', 'Penghasilan sampingan', 'Lain-lain'],
      expense: [
        ['Makan & minum', 'N', 2_000_000],
        ['Belanja bulanan', 'N', 800_000],
        ['Kos / sewa', 'N', 1_500_000],
        ['Transportasi', 'N', 600_000],
        ['Listrik, air & internet', 'N', 400_000],
        ['Pulsa & paket data', 'N', 150_000],
        ['Kesehatan', 'N', 200_000],
        ['Cicilan', 'N', 900_000],
        ['Nongkrong & hiburan', 'W', 500_000],
        ['Belanja pribadi', 'W', 400_000],
        ['Langganan streaming', 'W', 150_000],
        ['Hadiah & donasi', 'W', 200_000],
        ['Tabungan & investasi', 'S', 1_500_000],
      ],
    },
    keluarga: {
      income: ['Gaji utama', 'Gaji pasangan', 'Usaha sampingan', 'Lain-lain'],
      expense: [
        ['Belanja dapur', 'N', 3_000_000],
        ['Listrik, air & gas', 'N', 700_000],
        ['Internet & pulsa', 'N', 400_000],
        ['Transportasi & bensin', 'N', 800_000],
        ['Sekolah & les anak', 'N', 1_500_000],
        ['Kesehatan & asuransi', 'N', 600_000],
        ['Cicilan rumah (KPR)', 'N', 3_000_000],
        ['Makan di luar', 'W', 600_000],
        ['Hiburan & liburan', 'W', 500_000],
        ['Pakaian', 'W', 300_000],
        ['Sedekah & arisan', 'W', 300_000],
        ['Dana darurat', 'S', 1_000_000],
        ['Tabungan & investasi', 'S', 1_000_000],
      ],
    },
    mahasiswa: {
      income: ['Uang saku', 'Beasiswa', 'Kerja paruh waktu', 'Lain-lain'],
      expense: [
        ['Makan', 'N', 1_200_000],
        ['Kos', 'N', 900_000],
        ['Transportasi', 'N', 250_000],
        ['Buku & alat kuliah', 'N', 150_000],
        ['Pulsa & internet', 'N', 100_000],
        ['Laundry', 'N', 100_000],
        ['Cicilan', 'N', 0],
        ['Nongkrong', 'W', 250_000],
        ['Hobi & hiburan', 'W', 150_000],
        ['Belanja', 'W', 150_000],
        ['Tabungan', 'S', 200_000],
      ],
    },
    freelancer: {
      income: ['Proyek klien', 'Royalti & afiliasi', 'Lain-lain'],
      expense: [
        ['Makan & minum', 'N', 1_800_000],
        ['Sewa tempat tinggal', 'N', 2_000_000],
        ['Listrik & internet', 'N', 600_000],
        ['Peralatan & software kerja', 'N', 400_000],
        ['Transportasi', 'N', 500_000],
        ['BPJS & asuransi', 'N', 400_000],
        ['Pajak', 'N', 300_000],
        ['Cicilan', 'N', 700_000],
        ['Hiburan', 'W', 500_000],
        ['Belanja pribadi', 'W', 400_000],
        ['Dana darurat', 'S', 1_500_000],
        ['Investasi', 'S', 1_000_000],
      ],
    },
  },
  en: {
    lajang: {
      income: ['Salary', 'Bonus', 'Side income', 'Other'],
      expense: [
        ['Food & drinks', 'N', 2_000_000],
        ['Groceries', 'N', 800_000],
        ['Rent', 'N', 1_500_000],
        ['Transport', 'N', 600_000],
        ['Utilities & internet', 'N', 400_000],
        ['Phone & data', 'N', 150_000],
        ['Health', 'N', 200_000],
        ['Loan repayments', 'N', 900_000],
        ['Going out & fun', 'W', 500_000],
        ['Personal shopping', 'W', 400_000],
        ['Subscriptions', 'W', 150_000],
        ['Gifts & donations', 'W', 200_000],
        ['Savings & investing', 'S', 1_500_000],
      ],
    },
    keluarga: {
      income: ['Main salary', 'Partner’s salary', 'Side business', 'Other'],
      expense: [
        ['Groceries', 'N', 3_000_000],
        ['Electricity, water & gas', 'N', 700_000],
        ['Internet & phone', 'N', 400_000],
        ['Transport & fuel', 'N', 800_000],
        ['School & tutoring', 'N', 1_500_000],
        ['Health & insurance', 'N', 600_000],
        ['Mortgage', 'N', 3_000_000],
        ['Eating out', 'W', 600_000],
        ['Fun & holidays', 'W', 500_000],
        ['Clothing', 'W', 300_000],
        ['Charity & gifts', 'W', 300_000],
        ['Emergency fund', 'S', 1_000_000],
        ['Savings & investing', 'S', 1_000_000],
      ],
    },
    mahasiswa: {
      income: ['Allowance', 'Scholarship', 'Part-time job', 'Other'],
      expense: [
        ['Food', 'N', 1_200_000],
        ['Rent', 'N', 900_000],
        ['Transport', 'N', 250_000],
        ['Books & supplies', 'N', 150_000],
        ['Phone & internet', 'N', 100_000],
        ['Laundry', 'N', 100_000],
        ['Loan repayments', 'N', 0],
        ['Going out', 'W', 250_000],
        ['Hobbies & fun', 'W', 150_000],
        ['Shopping', 'W', 150_000],
        ['Savings', 'S', 200_000],
      ],
    },
    freelancer: {
      income: ['Client projects', 'Royalties & affiliates', 'Other'],
      expense: [
        ['Food & drinks', 'N', 1_800_000],
        ['Rent', 'N', 2_000_000],
        ['Utilities & internet', 'N', 600_000],
        ['Work tools & software', 'N', 400_000],
        ['Transport', 'N', 500_000],
        ['Health insurance', 'N', 400_000],
        ['Taxes', 'N', 300_000],
        ['Loan repayments', 'N', 700_000],
        ['Fun', 'W', 500_000],
        ['Personal shopping', 'W', 400_000],
        ['Emergency fund', 'S', 1_500_000],
        ['Investing', 'S', 1_000_000],
      ],
    },
  },
};

/** Pemasukan contoh per bulan (Rp) per preset: [kategori ke-0, ke-1 (sesekali), ke-2 (sesekali)]. */
export const SAMPLE_INCOME: Record<PersonalPresetId, [number, number, number]> = {
  lajang: [9_500_000, 9_500_000, 1_200_000],
  keluarga: [13_000_000, 8_000_000, 2_000_000],
  mahasiswa: [2_500_000, 1_500_000, 800_000],
  freelancer: [12_000_000, 1_500_000, 500_000],
};
