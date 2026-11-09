/** Mata uang yang bisa dipilih di template (simbol dan jumlah desimal di format angka). */
export const CURRENCIES = {
  IDR: { symbol: 'Rp', decimals: 0 },
  USD: { symbol: '$', decimals: 2 },
  SGD: { symbol: 'S$', decimals: 2 },
  MYR: { symbol: 'RM', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
} as const;
export type Currency = keyof typeof CURRENCIES;
