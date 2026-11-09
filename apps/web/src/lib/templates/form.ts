/**
 * Konfigurasi form generik untuk template Excel. Halaman template mengirim konfigurasi ini ke
 * komponen TemplateBuilder.vue (harus bisa diserialisasi: tanpa fungsi). Nilai isian dikirim balik
 * ke fungsi buildFromForm() milik template.
 */

export type FormValue = string | number | boolean | string[];
export type FormValues = Record<string, FormValue>;

export interface FormField {
  /** Nama nilai yang diterima buildFromForm. */
  key: string;
  kind: 'text' | 'year' | 'currency' | 'select' | 'date' | 'number' | 'list';
  label: string;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Nilai awal. Untuk list: baris dipisah "\n". Untuk date: "YYYY-MM-DD" atau "today+N" (hari). */
  value?: string | number;
  /** List: jumlah baris maksimal. Number: nilai maksimal. */
  max?: number;
  min?: number;
  step?: number;
  /** Lebar di grid 4 kolom (layar lebar). */
  span?: 1 | 2 | 4;
}

export interface TemplateForm {
  /** Kunci pemuat kode template di TemplateBuilder.vue. */
  template: string;
  /** Awalan nama file unduhan, misalnya "Invoice-Penawaran". */
  fileBase: string;
  /** Field teks yang ikut masuk nama file (nama usaha, nama proyek, ...). */
  fileKey?: string;
  heading: string;
  fields: FormField[];
  /** Pilihan preset (tombol): mengisi ulang field list sesuai preset. */
  presets?: {
    key: string;
    label: string;
    hint?: string;
    options: { value: string; label: string }[];
    fill: Record<string, Record<string, string>>;
  };
  /** Kotak info di samping field list. */
  note?: string;
  sample: { label: string; hint: string };
}

export function formText(v: FormValues, key: string, max = 80): string {
  const x = v[key];
  return typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function formNumber(
  v: FormValues,
  key: string,
  fallback: number,
  min = -Infinity,
  max = Infinity,
): number {
  const n = Number(v[key]);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function formList(v: FormValues, key: string): string[] {
  const x = v[key];
  return Array.isArray(x) ? x.map(String) : typeof x === 'string' ? x.split('\n') : [];
}

export function formChoice<T extends string>(
  v: FormValues,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const x = v[key];
  return allowed.includes(x as T) ? (x as T) : fallback;
}

/** Tanggal "YYYY-MM-DD" -> [tahun, bulan, hari], atau undefined bila tidak valid. */
export function formDate(v: FormValues, key: string): [number, number, number] | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v[key] ?? ''));
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y >= 2000 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31
    ? [y, mo, d]
    : undefined;
}
