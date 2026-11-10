/**
 * Template dokumen: surat kuasa (ambil BPKB, ijazah, urus bank, STNK, paket, atau umum).
 * Data pemberi dan penerima kuasa, keperluan, lalu dua kolom tanda tangan dengan kotak meterai.
 */
import {
  choice,
  longText,
  paragraphs,
  text,
  todayIso,
  longDate,
  type DocAssets,
  type DocForm,
  type DocValues,
} from '../docs/form';
import type { Block, DocSpec } from '../docs/model';
import type { Locale } from '../format';
import {
  T,
  alignField,
  fontField,
  meteraiField,
  placeDateFields,
  signColumn,
  signatureField,
  titleBlock,
  type Tr,
} from './letter-kit';

const PURPOSES: Record<string, Tr> = {
  bpkb: T(
    'Untuk mengambil BPKB kendaraan bermotor merek Honda Beat dengan nomor polisi D 1234 ABC atas nama Pemberi Kuasa di kantor PT Contoh Finance cabang Bandung, termasuk menandatangani dokumen serah terima yang diperlukan.',
    'To collect the vehicle ownership book (BPKB) for the Honda Beat motorcycle with registration number D 1234 ABC in the Grantor’s name at PT Contoh Finance, Bandung branch, including signing the required handover documents.',
  ),
  ijazah: T(
    'Untuk mengambil ijazah dan transkrip nilai asli atas nama Pemberi Kuasa di bagian akademik Universitas Padjadjaran, karena Pemberi Kuasa sedang berada di luar kota.',
    'To collect the original degree certificate and transcript in the Grantor’s name from the academic office of Padjadjaran University, as the Grantor is out of town.',
  ),
  bank: T(
    'Untuk mengurus penggantian buku tabungan atas nama Pemberi Kuasa di Bank Contoh cabang Dago, termasuk mengisi dan menandatangani formulir yang diperlukan.',
    'To arrange a replacement savings book in the Grantor’s name at Bank Contoh, Dago branch, including completing and signing the required forms.',
  ),
  stnk: T(
    'Untuk mengurus perpanjangan STNK kendaraan bermotor dengan nomor polisi D 1234 ABC atas nama Pemberi Kuasa di kantor Samsat Kota Bandung.',
    'To renew the vehicle registration (STNK) for registration number D 1234 ABC in the Grantor’s name at the Bandung City Samsat office.',
  ),
  paket: T(
    'Untuk mengambil paket kiriman atas nama Pemberi Kuasa di kantor pos atau agen ekspedisi, serta menandatangani tanda terimanya.',
    'To collect a parcel addressed to the Grantor at the post office or courier agent, and to sign the receipt.',
  ),
  umum: T(
    'Untuk mewakili Pemberi Kuasa dalam mengurus [tulis keperluan dengan jelas: apa yang diurus, di mana, dan atas nama siapa].',
    'To act on behalf of the Grantor in [describe clearly what is to be handled, where, and in whose name].',
  ),
};

const W = {
  id: {
    title: 'SURAT KUASA',
    number: 'Nomor',
    intro: 'Yang bertanda tangan di bawah ini:',
    giverIs: 'Selanjutnya disebut sebagai PEMBERI KUASA.',
    grant: 'Dengan ini memberikan kuasa kepada:',
    receiverIs: 'Selanjutnya disebut sebagai PENERIMA KUASA.',
    special: 'K H U S U S',
    name: 'Nama',
    nik: 'NIK',
    birth: 'Tempat, tanggal lahir',
    job: 'Pekerjaan',
    address: 'Alamat',
    relation: 'Hubungan',
    giver: 'Pemberi Kuasa,',
    receiver: 'Penerima Kuasa,',
    docTitle: 'Surat Kuasa',
  },
  en: {
    title: 'LETTER OF AUTHORIZATION',
    number: 'No.',
    intro: 'I, the undersigned:',
    giverIs: 'hereinafter referred to as the GRANTOR,',
    grant: 'hereby authorize:',
    receiverIs: 'hereinafter referred to as the AUTHORIZED PERSON,',
    special: 'SPECIFICALLY',
    name: 'Name',
    nik: 'ID number',
    birth: 'Place and date of birth',
    job: 'Occupation',
    address: 'Address',
    relation: 'Relationship',
    giver: 'Grantor,',
    receiver: 'Authorized person,',
    docTitle: 'Letter of Authorization',
  },
};

export const CLOSING = T(
  'Demikian surat kuasa ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
  'This letter of authorization is made to be used as required.',
);

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'serif');
  const align = choice(v, 'align', ['left', 'justify'] as const, 'justify');
  const w = W[lang];
  const person = (p: string, relation = false): [string, string][] => [
    [w.name, text(v, `${p}Name`, 80)],
    [w.nik, text(v, `${p}Nik`, 30)],
    [w.birth, text(v, `${p}Birth`, 100)],
    [w.job, text(v, `${p}Job`, 80)],
    [w.address, longText(v, `${p}Address`, 250).replace(/\s*\n\s*/g, ', ')],
    ...(relation ? ([[w.relation, text(v, 'relation', 80)]] as [string, string][]) : []),
  ];
  const para = (s: string, extra: Partial<Extract<Block, { t: 'p' }>> = {}): Block => ({
    t: 'p',
    runs: [{ text: s }],
    align,
    ...extra,
  });
  const place = [text(v, 'city', 60), longDate(text(v, 'date') || todayIso(), lang)]
    .filter(Boolean)
    .join(', ');

  const main: Block[] = [
    ...titleBlock(w.title, text(v, 'number', 60), w.number),
    para(w.intro, { after: 4 }),
    { t: 'kv', label: 130, rows: person('giver'), after: 4 },
    para(w.giverIs, { after: 12 }),
    para(w.grant, { after: 4 }),
    { t: 'kv', label: 130, rows: person('receiver', true), after: 4 },
    para(w.receiverIs, { after: 12 }),
    { t: 'p', runs: [{ text: w.special, b: true }], align: 'center', after: 10 },
    ...paragraphs(longText(v, 'purpose')).map((p) => para(p, { after: 8 })),
    ...paragraphs(longText(v, 'closing')).map((p) => para(p, { after: 8 })),
    {
      t: 'cols',
      before: 12,
      cols: [
        signColumn({ above: ['', w.receiver], name: text(v, 'receiverName', 80), lang }),
        signColumn({
          above: [place, w.giver],
          name: text(v, 'giverName', 80),
          signature: assets.signature,
          meterai: choice(v, 'meterai', ['yes', 'no'] as const, 'yes') === 'yes',
          lang,
        }),
      ],
    },
  ];
  return {
    title: [w.docTitle, text(v, 'giverName', 80)].filter(Boolean).join(' - '),
    author: text(v, 'giverName', 80),
    lang,
    font,
    size: 11,
    color: '1a1a1a',
    margin: 64,
    main,
  };
}

export function kuasaForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const person = (p: 'giver' | 'receiver') => [
    { key: `${p}Name`, kind: 'text' as const, label: L(T('Nama lengkap', 'Full name')), max: 80 },
    { key: `${p}Nik`, kind: 'text' as const, label: L(T('NIK (nomor KTP)', 'ID number')), max: 30 },
    {
      key: `${p}Birth`,
      kind: 'text' as const,
      label: L(T('Tempat, tanggal lahir', 'Place and date of birth')),
      max: 100,
    },
    { key: `${p}Job`, kind: 'text' as const, label: L(T('Pekerjaan', 'Occupation')), max: 80 },
    {
      key: `${p}Address`,
      kind: 'textarea' as const,
      label: L(T('Alamat', 'Address')),
      rows: 2,
      span: 2 as const,
      max: 250,
    },
  ];
  const fill = Object.fromEntries(
    Object.entries(PURPOSES).map(([k, t]) => [k, { purpose: t[locale] }]),
  );
  return {
    template: 'kuasa',
    storage: 'surat-kuasa',
    fileBase: L(T('Surat-Kuasa', 'Letter-of-Authorization')),
    fileKey: 'giverName',
    sections: [
      {
        id: 'type',
        title: L(T('Jenis dan tampilan', 'Type and layout')),
        items: [
          {
            key: 'type',
            kind: 'select',
            label: L(T('Keperluan', 'Purpose')),
            span: 2,
            options: [
              {
                value: 'bpkb',
                label: L(T('Mengambil BPKB', 'Collect a vehicle ownership book (BPKB)')),
              },
              { value: 'ijazah', label: L(T('Mengambil ijazah', 'Collect a degree certificate')) },
              { value: 'bank', label: L(T('Urusan bank', 'Bank matters')) },
              {
                value: 'stnk',
                label: L(T('Perpanjang STNK', 'Renew vehicle registration (STNK)')),
              },
              { value: 'paket', label: L(T('Mengambil paket', 'Collect a parcel')) },
              { value: 'umum', label: L(T('Lainnya (tulis sendiri)', 'Other (write your own)')) },
            ],
            hint: L(
              T(
                'Mengganti pilihan mengisi ulang contoh teks keperluan selama belum kamu ubah.',
                'Changing this refills the example purpose text as long as you haven’t edited it.',
              ),
            ),
          },
          fontField(locale),
          alignField(locale),
          meteraiField(locale),
          {
            key: 'number',
            kind: 'text',
            label: L(T('Nomor surat (opsional)', 'Reference number (optional)')),
            max: 60,
          },
        ],
      },
      { id: 'giver', title: L(T('Pemberi kuasa (kamu)', 'Grantor (you)')), items: person('giver') },
      {
        id: 'receiver',
        title: L(T('Penerima kuasa', 'Authorized person')),
        items: [
          ...person('receiver'),
          {
            key: 'relation',
            kind: 'text',
            label: L(
              T('Hubungan dengan pemberi kuasa (opsional)', 'Relationship to grantor (optional)'),
            ),
            max: 80,
            span: 2,
            placeholder: L(T('Adik kandung', 'Brother')),
          },
        ],
      },
      {
        id: 'body',
        title: L(T('Isi kuasa', 'Authorization')),
        items: [
          {
            key: 'purpose',
            kind: 'textarea',
            label: L(T('Keperluan yang dikuasakan', 'What the person may do')),
            rows: 5,
            span: 2,
            max: 1500,
            hint: L(
              T(
                'Tulis sejelas mungkin: apa yang diurus, di mana, dan nomor dokumen atau kendaraan bila ada.',
                'Be specific: what is handled, where, and any document or vehicle numbers.',
              ),
            ),
          },
          {
            key: 'closing',
            kind: 'textarea',
            label: L(T('Penutup', 'Closing')),
            rows: 2,
            span: 2,
            max: 600,
          },
          ...placeDateFields(locale),
        ],
      },
      {
        id: 'sign',
        title: L(T('Tanda tangan', 'Signature')),
        items: [
          signatureField(
            locale,
            T('Tanda tangan pemberi kuasa (opsional)', 'Grantor’s signature (optional)'),
          ),
        ],
      },
    ],
    sample: {
      lang: locale,
      type: 'bpkb',
      font: 'serif',
      align: 'justify',
      meterai: locale === 'id' ? 'yes' : 'no',
      number: '',
      giverName: 'Julian Marcell',
      giverNik: '3273011205000001',
      giverBirth: L(T('Bandung, 12 Mei 2000', 'Bandung, 12 May 2000')),
      giverJob: L(T('Karyawan swasta', 'Private employee')),
      giverAddress: 'Jl. Melati No. 21, Coblong, Bandung 40132',
      receiverName: 'Dimas Pratama',
      receiverNik: '3273010808030002',
      receiverBirth: L(T('Bandung, 8 Agustus 2003', 'Bandung, 8 August 2003')),
      receiverJob: L(T('Mahasiswa', 'Student')),
      receiverAddress: 'Jl. Melati No. 21, Coblong, Bandung 40132',
      relation: L(T('Adik kandung', 'Brother')),
      purpose: PURPOSES.bpkb[locale],
      closing: CLOSING[locale],
      city: 'Bandung',
      date: '',
      signature: '',
    },
    presets: { key: 'type', fill },
  };
}

export const KUASA_FORM = { id: kuasaForm('id'), en: kuasaForm('en') };
