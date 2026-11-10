/**
 * Template dokumen: kwitansi (bukti pembayaran). Ukuran A5 mendatar atau A4, nominal dengan
 * terbilang otomatis, dan kotak meterai otomatis untuk penerimaan di atas Rp5 juta.
 */
import {
  choice,
  longDate,
  text,
  todayIso,
  type DocAssets,
  type DocForm,
  type DocValues,
} from '../docs/form';
import { A4, A5_LANDSCAPE, type Block, type DocSpec } from '../docs/model';
import type { Locale } from '../format';
import { mix } from './cv-profesional';
import {
  T,
  fontField,
  meteraiField,
  placeDateFields,
  signColumn,
  signatureField,
  type Tr,
} from './letter-kit';
import { ACCENTS } from './surat-lamaran';
import { terbilang } from './terbilang';

/** Batas nominal yang wajib bermeterai (UU 10/2020 tentang Bea Meterai). */
export const METERAI_LIMIT = 5_000_000;

export function parseAmount(s: string): number {
  const n = Number(s.replace(/[^\d]/g, '').slice(0, 15));
  return Number.isFinite(n) ? n : 0;
}

export function rupiah(n: number, lang: 'id' | 'en'): string {
  return lang === 'id' ? `Rp${n.toLocaleString('id-ID')},-` : `IDR ${n.toLocaleString('en-US')}`;
}

export function amountWords(n: number, lang: 'id' | 'en'): string {
  const w = `${terbilang(n, lang)} rupiah`;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

const W = {
  id: {
    title: 'KWITANSI',
    no: 'No.',
    from: 'Sudah terima dari',
    words: 'Uang sejumlah',
    for: 'Untuk pembayaran',
    receiver: 'Penerima,',
    docTitle: 'Kwitansi',
  },
  en: {
    title: 'RECEIPT',
    no: 'No.',
    from: 'Received from',
    words: 'The sum of',
    for: 'Payment for',
    receiver: 'Received by,',
    docTitle: 'Receipt',
  },
};

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'sans');
  const accent = choice(
    v,
    'accent',
    ACCENTS.map((a) => a.value),
    '1f3a5f',
  );
  const paper = choice(v, 'paper', ['a5', 'a4'] as const, 'a5');
  const w = W[lang];
  const amount = parseAmount(text(v, 'amount', 30));
  const meteraiMode = choice(v, 'meterai', ['auto', 'yes', 'no'] as const, 'auto');
  const meterai = meteraiMode === 'yes' || (meteraiMode === 'auto' && amount > METERAI_LIMIT);
  const place = [text(v, 'city', 60), longDate(text(v, 'date') || todayIso(), lang)]
    .filter(Boolean)
    .join(', ');
  const soft = mix(accent, 'ffffff', 0.88);
  const business = text(v, 'business', 100);

  // Baris "label : isi" dengan isi berupa blok apa pun (teks atau kotak).
  // `offset` menurunkan label agar sejajar dengan teks di dalam kotak.
  const row = (label: string, content: Block[], before = 8, offset = 0): Block => {
    const lead: Block[] = offset ? [{ t: 'gap', h: offset }] : [];
    return {
      t: 'cols',
      widths: [118, 10, 380],
      gap: 0,
      before,
      cols: [
        [...lead, { t: 'p', runs: [{ text: label }] }],
        [...lead, { t: 'p', runs: [{ text: ':' }] }],
        content,
      ],
    };
  };

  const main: Block[] = [
    {
      t: 'cols',
      cols: [
        [
          { t: 'p', runs: [{ text: w.title, b: true, color: accent }], size: 22, lead: 1.1 },
          ...(business
            ? [{ t: 'p', runs: [{ text: business, b: true }], size: 9.5, before: 2 } as Block]
            : []),
          ...(text(v, 'businessInfo', 200)
            ? [
                {
                  t: 'p',
                  runs: [{ text: text(v, 'businessInfo', 200) }],
                  size: 8.5,
                  color: '555555',
                } as Block,
              ]
            : []),
        ],
        [
          {
            t: 'p',
            runs: [{ text: text(v, 'number', 40) ? `${w.no} ${text(v, 'number', 40)}` : '' }],
            align: 'right',
            before: 6,
          },
        ],
      ],
    },
    { t: 'rule', color: accent, weight: 1.5, before: 8, after: 10 },
    row(w.from, [{ t: 'p', runs: [{ text: text(v, 'payer', 100), b: true }] }], 0),
    row(
      w.words,
      [
        {
          t: 'box',
          runs: [{ text: amount ? amountWords(amount, lang) : '', i: true }],
          fill: soft,
          pad: 5,
        },
      ],
      8,
      5,
    ),
    row(w.for, [{ t: 'p', runs: [{ text: text(v, 'purpose', 300) }] }]),
    {
      t: 'cols',
      before: 18,
      widths: [1.15, 1],
      cols: [
        [
          { t: 'gap', h: 30 },
          {
            t: 'box',
            runs: [{ text: amount ? rupiah(amount, lang) : '', b: true }],
            size: 15,
            border: accent,
            fill: soft,
            w: 190,
            pad: 8,
          },
        ],
        signColumn({
          above: [place, w.receiver],
          name: text(v, 'receiver', 80),
          sub: text(v, 'receiverRole', 80),
          signature: assets.signature,
          meterai,
          lang,
          size: 10.5,
        }),
      ],
    },
  ];
  return {
    title: [w.docTitle, text(v, 'number', 40), text(v, 'payer', 100)].filter(Boolean).join(' - '),
    author: text(v, 'receiver', 80) || business,
    lang,
    font,
    size: 10.5,
    color: '1a1a1a',
    margin: 36,
    page: paper === 'a5' ? A5_LANDSCAPE : A4,
    main,
  };
}

export function kwitansiForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  return {
    template: 'kwitansi',
    storage: 'kwitansi',
    fileBase: L(T('Kwitansi', 'Receipt')),
    fileKey: 'payer',
    sections: [
      {
        id: 'look',
        title: L(T('Tampilan', 'Layout')),
        items: [
          {
            key: 'paper',
            kind: 'select',
            label: L(T('Ukuran kertas', 'Paper size')),
            options: [
              {
                value: 'a5',
                label: L(T('A5 mendatar (setengah A4)', 'A5 landscape (half of A4)')),
              },
              { value: 'a4', label: 'A4' },
            ],
          },
          fontField(locale),
          { ...meteraiField(locale, true), span: 2 },
          {
            key: 'accent',
            kind: 'swatch',
            label: L(T('Warna', 'Colour')),
            span: 2,
            options: ACCENTS.map((a) => ({ value: a.value, label: a[locale] })),
          },
        ],
      },
      {
        id: 'payment',
        title: L(T('Pembayaran', 'Payment')),
        items: [
          { key: 'number', kind: 'text', label: L(T('Nomor kwitansi', 'Receipt number')), max: 40 },
          {
            key: 'amount',
            kind: 'text',
            label: L(T('Jumlah (Rp)', 'Amount (IDR)')),
            max: 30,
            placeholder: '1500000',
            hint: L(
              T(
                'Ketik angka saja; terbilang dibuat otomatis.',
                'Numbers only; the amount in words is written for you.',
              ),
            ),
          },
          {
            key: 'payer',
            kind: 'text',
            label: L(T('Sudah terima dari', 'Received from')),
            max: 100,
            span: 2,
          },
          {
            key: 'purpose',
            kind: 'textarea',
            label: L(T('Untuk pembayaran', 'Payment for')),
            rows: 2,
            span: 2,
            max: 300,
          },
          ...placeDateFields(locale),
        ],
      },
      {
        id: 'receiver',
        title: L(T('Penerima', 'Received by')),
        items: [
          { key: 'receiver', kind: 'text', label: L(T('Nama penerima', 'Name')), max: 80 },
          {
            key: 'receiverRole',
            kind: 'text',
            label: L(T('Keterangan (opsional)', 'Title (optional)')),
            max: 80,
            placeholder: L(T('Pemilik kos', 'Landlord')),
          },
          {
            key: 'business',
            kind: 'text',
            label: L(T('Nama usaha (opsional)', 'Business name (optional)')),
            max: 100,
          },
          {
            key: 'businessInfo',
            kind: 'text',
            label: L(
              T('Alamat / kontak usaha (opsional)', 'Business address / contact (optional)'),
            ),
            max: 200,
          },
          signatureField(locale),
        ],
      },
    ],
    sample: {
      lang: locale,
      paper: 'a5',
      font: 'sans',
      meterai: 'auto',
      accent: '1f3a5f',
      number: 'KW/2026/011',
      amount: '1500000',
      payer: 'Ayudiyah Pratiwi',
      purpose: L(
        T('Sewa kamar kos nomor 7 untuk bulan Desember 2026', 'Rent for room 7 for December 2026'),
      ),
      city: 'Bandung',
      date: '',
      receiver: 'Julian Marcell',
      receiverRole: L(T('Pemilik Kos Melati', 'Owner, Kos Melati')),
      business: '',
      businessInfo: '',
      signature: '',
    },
  };
}

export const KWITANSI_FORM = { id: kwitansiForm('id'), en: kwitansiForm('en') };
