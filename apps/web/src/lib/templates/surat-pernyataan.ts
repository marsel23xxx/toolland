/**
 * Template dokumen: surat pernyataan (untuk lamaran kerja, belum menikah, tata tertib, atau
 * umum). Data diri, butir pernyataan bernomor, penutup, lalu tanda tangan dengan kotak meterai.
 */
import {
  choice,
  lines,
  longDate,
  longText,
  paragraphs,
  text,
  todayIso,
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

const STATEMENTS: Record<string, Tr> = {
  kerja: T(
    'Bersedia ditempatkan di seluruh wilayah kerja perusahaan.\nTidak terlibat dalam penyalahgunaan narkoba dan obat-obatan terlarang.\nTidak sedang terikat kontrak kerja dengan perusahaan lain.\nSemua data dan dokumen yang saya lampirkan dalam lamaran adalah benar.',
    'I am willing to be placed at any of the company’s work locations.\nI am not involved in the misuse of narcotics or illegal drugs.\nI am not currently bound by an employment contract with another company.\nAll information and documents in my application are true.',
  ),
  lajang: T(
    'Sampai dengan surat pernyataan ini dibuat, saya belum pernah menikah dan tidak sedang terikat perkawinan dengan siapa pun.',
    'As of the date of this statement, I have never been married and am not bound by marriage to anyone.',
  ),
  tatib: T(
    'Bersedia mematuhi seluruh peraturan dan tata tertib yang berlaku.\nBersedia menerima sanksi sesuai ketentuan apabila melanggar peraturan tersebut.',
    'I will comply with all applicable rules and regulations.\nI accept the sanctions set out in those rules if I break them.',
  ),
  umum: T(
    'Tulis isi pernyataanmu di sini, satu butir per baris.',
    'Write your statement here, one point per line.',
  ),
};

const CLOSING = T(
  'Demikian surat pernyataan ini saya buat dengan sebenar-benarnya, dalam keadaan sadar, dan tanpa paksaan dari pihak mana pun. Apabila di kemudian hari pernyataan ini terbukti tidak benar, saya bersedia menerima sanksi sesuai ketentuan yang berlaku.',
  'I make this statement truthfully, consciously, and without pressure from anyone. If it is later proven untrue, I accept the consequences under the applicable rules.',
);

const W = {
  id: {
    title: 'SURAT PERNYATAAN',
    intro: 'Saya yang bertanda tangan di bawah ini:',
    declare: 'Dengan ini menyatakan bahwa:',
    name: 'Nama',
    nik: 'NIK',
    birth: 'Tempat, tanggal lahir',
    job: 'Pekerjaan',
    address: 'Alamat',
    phone: 'Nomor HP',
    signer: 'Yang membuat pernyataan,',
    docTitle: 'Surat Pernyataan',
  },
  en: {
    title: 'STATEMENT LETTER',
    intro: 'I, the undersigned:',
    declare: 'hereby declare that:',
    name: 'Name',
    nik: 'ID number',
    birth: 'Place and date of birth',
    job: 'Occupation',
    address: 'Address',
    phone: 'Phone',
    signer: 'The declarant,',
    docTitle: 'Statement Letter',
  },
};

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'serif');
  const align = choice(v, 'align', ['left', 'justify'] as const, 'justify');
  const w = W[lang];
  const name = text(v, 'name', 80);
  const statements = lines(longText(v, 'statements', 3000), 15);
  const place = [text(v, 'city', 60), longDate(text(v, 'date') || todayIso(), lang)]
    .filter(Boolean)
    .join(', ');
  const main: Block[] = [
    ...titleBlock(w.title),
    { t: 'p', runs: [{ text: w.intro }], after: 4 },
    {
      t: 'kv',
      label: 130,
      rows: [
        [w.name, name],
        [w.nik, text(v, 'nik', 30)],
        [w.birth, text(v, 'birth', 100)],
        [w.job, text(v, 'job', 80)],
        [w.address, longText(v, 'address', 250).replace(/\s*\n\s*/g, ', ')],
        [w.phone, text(v, 'phone', 40)],
      ],
      after: 12,
    },
    { t: 'p', runs: [{ text: w.declare }], after: 6 },
    statements.length > 1
      ? { t: 'list', numbered: true, items: statements.map((x) => [{ text: x }]), after: 10 }
      : { t: 'p', runs: [{ text: statements[0] ?? '' }], align, after: 10 },
    ...paragraphs(longText(v, 'closing')).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    })),
    {
      t: 'cols',
      before: 12,
      widths: [1, 1],
      cols: [
        [],
        signColumn({
          above: [place, w.signer],
          name,
          signature: assets.signature,
          meterai: choice(v, 'meterai', ['yes', 'no'] as const, 'yes') === 'yes',
          lang,
        }),
      ],
    },
  ];
  return {
    title: [w.docTitle, name].filter(Boolean).join(' - '),
    author: name,
    lang,
    font,
    size: 11,
    color: '1a1a1a',
    margin: 64,
    main,
  };
}

export function pernyataanForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  return {
    template: 'pernyataan',
    storage: 'surat-pernyataan',
    fileBase: L(T('Surat-Pernyataan', 'Statement-Letter')),
    fileKey: 'name',
    sections: [
      {
        id: 'type',
        title: L(T('Jenis dan tampilan', 'Type and layout')),
        items: [
          {
            key: 'type',
            kind: 'select',
            label: L(T('Jenis pernyataan', 'Statement type')),
            span: 2,
            options: [
              {
                value: 'kerja',
                label: L(T('Persyaratan lamaran kerja', 'Job application requirements')),
              },
              { value: 'lajang', label: L(T('Belum menikah', 'Never married')) },
              {
                value: 'tatib',
                label: L(T('Mematuhi peraturan / tata tertib', 'Comply with rules')),
              },
              { value: 'umum', label: L(T('Lainnya (tulis sendiri)', 'Other (write your own)')) },
            ],
            hint: L(
              T(
                'Mengganti pilihan mengisi ulang contoh butir pernyataan selama belum kamu ubah.',
                'Changing this refills the example statements as long as you haven’t edited them.',
              ),
            ),
          },
          fontField(locale),
          alignField(locale),
          meteraiField(locale),
        ],
      },
      {
        id: 'me',
        title: L(T('Data diri', 'Your details')),
        items: [
          { key: 'name', kind: 'text', label: L(T('Nama lengkap', 'Full name')), max: 80 },
          { key: 'nik', kind: 'text', label: L(T('NIK (nomor KTP)', 'ID number')), max: 30 },
          {
            key: 'birth',
            kind: 'text',
            label: L(T('Tempat, tanggal lahir', 'Place and date of birth')),
            max: 100,
          },
          { key: 'job', kind: 'text', label: L(T('Pekerjaan', 'Occupation')), max: 80 },
          {
            key: 'address',
            kind: 'textarea',
            label: L(T('Alamat', 'Address')),
            rows: 2,
            span: 2,
            max: 250,
          },
          {
            key: 'phone',
            kind: 'text',
            label: L(T('Nomor HP (opsional)', 'Phone (optional)')),
            max: 40,
          },
        ],
      },
      {
        id: 'body',
        title: L(T('Isi pernyataan', 'Statement')),
        items: [
          {
            key: 'statements',
            kind: 'textarea',
            label: L(T('Butir pernyataan (satu per baris)', 'Statements (one per line)')),
            rows: 6,
            span: 2,
            max: 3000,
            hint: L(
              T(
                'Lebih dari satu baris otomatis menjadi daftar bernomor.',
                'More than one line becomes a numbered list.',
              ),
            ),
          },
          {
            key: 'closing',
            kind: 'textarea',
            label: L(T('Penutup', 'Closing')),
            rows: 4,
            span: 2,
            max: 1000,
          },
          ...placeDateFields(locale),
        ],
      },
      { id: 'sign', title: L(T('Tanda tangan', 'Signature')), items: [signatureField(locale)] },
    ],
    sample: {
      lang: locale,
      type: 'kerja',
      font: 'serif',
      align: 'justify',
      meterai: locale === 'id' ? 'yes' : 'no',
      name: 'Julian Marcell',
      nik: '3273011205000001',
      birth: L(T('Bandung, 12 Mei 2000', 'Bandung, 12 May 2000')),
      job: L(T('Karyawan swasta', 'Private employee')),
      address: 'Jl. Melati No. 21, Coblong, Bandung 40132',
      phone: '0812-3456-7890',
      statements: STATEMENTS.kerja[locale],
      closing: CLOSING[locale],
      city: 'Bandung',
      date: '',
      signature: '',
    },
    presets: {
      key: 'type',
      fill: Object.fromEntries(
        Object.entries(STATEMENTS).map(([k, t]) => [k, { statements: t[locale] }]),
      ),
    },
  };
}

export const PERNYATAAN_FORM = { id: pernyataanForm('id'), en: pernyataanForm('en') };
