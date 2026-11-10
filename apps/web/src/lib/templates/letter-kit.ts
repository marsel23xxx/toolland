/**
 * Potongan bersama untuk template surat: field form yang sering dipakai, judul surat bergaris
 * bawah, kolom tanda tangan (dengan kotak meterai), dan format rentang tanggal.
 */
import { longDate, type DocAssets, type DocField } from '../docs/form';
import type { Block } from '../docs/model';
import type { Locale } from '../format';
import { fit } from './surat-lamaran';
import { terbilang } from './terbilang';

export const T = (id: string, en: string) => ({ id, en });
export type Tr = ReturnType<typeof T>;

export function fontField(locale: Locale): DocField {
  return {
    key: 'font',
    kind: 'select',
    label: T('Huruf', 'Font')[locale],
    options: [
      { value: 'serif', label: 'Times New Roman' },
      { value: 'sans', label: 'Arial / Helvetica' },
    ],
  };
}

export function alignField(locale: Locale): DocField {
  return {
    key: 'align',
    kind: 'select',
    label: T('Perataan paragraf', 'Paragraph alignment')[locale],
    options: [
      { value: 'justify', label: T('Rata kanan-kiri', 'Justified')[locale] },
      { value: 'left', label: T('Rata kiri', 'Left')[locale] },
    ],
  };
}

export function meteraiField(locale: Locale, auto = false): DocField {
  const L = (x: Tr) => x[locale];
  return {
    key: 'meterai',
    kind: 'select',
    label: L(T('Kotak meterai', 'Stamp duty box')),
    options: [
      ...(auto
        ? [
            {
              value: 'auto',
              label: L(T('Otomatis (di atas Rp5 juta)', 'Automatic (above IDR 5 million)')),
            },
          ]
        : []),
      { value: 'yes', label: L(T('Tampilkan', 'Show')) },
      { value: 'no', label: L(T('Tidak perlu', 'Not needed')) },
    ],
    hint: L(
      T(
        'Kotak putus-putus sebagai tempat menempel meterai Rp10.000 sebelum ditandatangani.',
        'A dashed box where an Indonesian IDR 10,000 duty stamp (meterai) is placed before signing.',
      ),
    ),
  };
}

export function signatureField(locale: Locale, label?: Tr): DocField {
  const L = (x: Tr) => x[locale];
  return {
    key: 'signature',
    kind: 'image',
    image: 'signature',
    label: L(label ?? T('Gambar tanda tangan (opsional)', 'Signature image (optional)')),
    span: 2,
    hint: L(
      T(
        'PNG dengan latar transparan paling rapi. Tanpa gambar, disediakan ruang kosong untuk tanda tangan basah.',
        'A PNG with a transparent background looks best. Without one, space is left to sign by hand.',
      ),
    ),
    link: {
      href: L(T('/tools/buat-tanda-tangan', '/en/tools/signature-maker')),
      label: L(T('Buat tanda tangan digital', 'Create a digital signature')),
    },
  };
}

export function placeDateFields(locale: Locale): DocField[] {
  const L = (x: Tr) => x[locale];
  return [
    { key: 'city', kind: 'text', label: L(T('Kota penulisan surat', 'City')), max: 60 },
    {
      key: 'date',
      kind: 'date',
      label: L(T('Tanggal surat', 'Date')),
      hint: L(T('Kosongkan untuk tanggal hari ini.', 'Leave empty for today.')),
    },
  ];
}

/** Judul surat di tengah, tebal dan bergaris bawah, dengan nomor surat opsional di bawahnya. */
export function titleBlock(title: string, number = '', numberLabel = 'Nomor'): Block[] {
  const out: Block[] = [
    { t: 'p', runs: [{ text: title, b: true, u: true }], size: 13, align: 'center' },
  ];
  if (number)
    out.push({ t: 'p', runs: [{ text: `${numberLabel}: ${number}` }], align: 'center', before: 2 });
  out.push({ t: 'gap', h: 16 });
  return out;
}

/** Tinggi ruang tanda tangan: kotak meterai 48 pt + jarak 4 pt di atas dan bawah. */
export const SIGN_SPACE = 56;

export function meteraiBox(lang: 'id' | 'en'): Block {
  return {
    t: 'box',
    runs: [{ text: lang === 'id' ? 'Meterai\n10.000' : 'Duty stamp\nIDR 10,000' }],
    size: 7.5,
    color: '8a8a8a',
    align: 'center',
    border: 'a0a0a0',
    dash: true,
    w: 78,
    h: 48,
    place: 'center',
    before: 4,
    after: 4,
  };
}

/** Satu kolom tanda tangan rata tengah: baris di atas, ruang tanda tangan, nama, keterangan. */
export function signColumn(o: {
  above: string[];
  name: string;
  sub?: string;
  signature?: DocAssets[string];
  meterai?: boolean;
  lang: 'id' | 'en';
  /** Ukuran huruf dasar dokumen, untuk tinggi baris kosong. */
  size?: number;
}): Block[] {
  // Baris kosong tetap memakan satu baris agar kolom-kolom tanda tangan sejajar.
  const line = (o.size ?? 11) * 1.35;
  const out: Block[] = o.above.map((x) =>
    x
      ? ({ t: 'p', runs: [{ text: x }], align: 'center' } as Block)
      : ({ t: 'gap', h: line } as Block),
  );
  // Ruang tanda tangan selalu setinggi SIGN_SPACE: meterai, gambar, atau kosong.
  if (o.meterai) out.push(meteraiBox(o.lang));
  else if (o.signature) {
    const size = fit(o.signature.w, o.signature.h, 120, 52);
    const pad = (SIGN_SPACE - size.h) / 2;
    out.push({
      t: 'img',
      data: o.signature.data,
      type: o.signature.type,
      ...size,
      align: 'center',
      before: pad,
      after: pad,
    });
  } else out.push({ t: 'gap', h: SIGN_SPACE });
  out.push({ t: 'p', runs: [{ text: o.name || ' ', b: true, u: !!o.name }], align: 'center' });
  if (o.sub) out.push({ t: 'p', runs: [{ text: o.sub }], align: 'center' });
  return out;
}

/** "11 November 2026", "11 sampai 13 November 2026", atau "30 November sampai 2 Desember 2026". */
export function dateRange(a: string, b: string, lang: 'id' | 'en'): string {
  const from = longDate(a, lang);
  const to = longDate(b, lang);
  if (!from) return '';
  if (!to || a === b || b < a) return from;
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const sep = lang === 'id' ? ' sampai ' : ' to ';
  if (ya === yb && ma === mb)
    return lang === 'id' ? `${da}${sep}${to}` : `${from.replace(/, \d{4}$/, '')}${sep}${db}, ${yb}`;
  if (ya === yb) return `${from.replace(/,? \d{4}$/, '')}${sep}${to}`;
  return `${from}${sep}${to}`;
}

/** Jumlah hari (inklusif) antara dua tanggal ISO, minimal 1. */
export function dayCount(a: string, b: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a)) return 1;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b) || b < a) return 1;
  return Math.round((d(b) - d(a)) / 86400000) + 1;
}

/** "2 (dua) hari" atau "2 days". */
export function daysText(n: number, lang: 'id' | 'en'): string {
  return lang === 'id' ? `${n} (${terbilang(n, 'id')}) hari` : `${n} ${n === 1 ? 'day' : 'days'}`;
}
