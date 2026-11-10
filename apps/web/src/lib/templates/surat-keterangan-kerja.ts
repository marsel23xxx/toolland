/**
 * Template dokumen: surat keterangan kerja dari perusahaan. Dua jenis: paklaring untuk karyawan
 * yang sudah berhenti, dan keterangan masih bekerja (untuk KPR, visa, dan sejenisnya).
 * Kop surat dengan logo opsional.
 */
import {
  choice,
  fillTokens,
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
  placeDateFields,
  signColumn,
  signatureField,
  titleBlock,
  type Tr,
} from './letter-kit';
import { ACCENTS, fit } from './surat-lamaran';

const BODY: Record<'berhenti' | 'aktif', Tr> = {
  berhenti: T(
    'Yang bersangkutan adalah benar karyawan {perusahaan} sejak {mulai} sampai dengan {selesai}, dengan jabatan terakhir sebagai {jabatan}.\n\nSelama bekerja, yang bersangkutan telah menunjukkan dedikasi, tanggung jawab, dan kinerja yang baik. Yang bersangkutan berhenti bekerja atas permintaan sendiri. Kami mengucapkan terima kasih atas kontribusinya dan berharap yang bersangkutan sukses di tempat yang baru.',
    'The above-named person was employed by {perusahaan} from {mulai} to {selesai}, most recently as {jabatan}.\n\nDuring this time, they showed dedication, responsibility, and good performance. They left the company at their own request. We thank them for their contribution and wish them every success in the future.',
  ),
  aktif: T(
    'Yang bersangkutan adalah benar karyawan tetap {perusahaan} sejak {mulai} sampai saat ini, dengan jabatan {jabatan}.\n\nSurat keterangan ini dibuat untuk keperluan {keperluan}.',
    'The above-named person has been a permanent employee of {perusahaan} since {mulai} and currently holds the position of {jabatan}.\n\nThis letter is issued for the purpose of {keperluan}.',
  ),
};

const CLOSING = T(
  'Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.',
  'This letter is issued truthfully to be used as required.',
);

const W = {
  id: {
    title: 'SURAT KETERANGAN KERJA',
    number: 'Nomor',
    intro: 'Yang bertanda tangan di bawah ini:',
    states: 'menerangkan bahwa:',
    name: 'Nama',
    role: 'Jabatan',
    id: 'NIK karyawan',
    dept: 'Divisi',
    birth: 'Tempat, tanggal lahir',
    docTitle: 'Surat Keterangan Kerja',
  },
  en: {
    title: 'CERTIFICATE OF EMPLOYMENT',
    number: 'No.',
    intro: 'The undersigned:',
    states: 'hereby certifies that:',
    name: 'Name',
    role: 'Position',
    id: 'Employee ID',
    dept: 'Department',
    birth: 'Place and date of birth',
    docTitle: 'Certificate of Employment',
  },
};

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'serif');
  const align = choice(v, 'align', ['left', 'justify'] as const, 'justify');
  const accent = choice(
    v,
    'accent',
    ACCENTS.map((a) => a.value),
    '1f3a5f',
  );
  const w = W[lang];
  const company = text(v, 'company', 100);
  const employee = text(v, 'employee', 80);
  const tokens = {
    perusahaan: company,
    jabatan: text(v, 'employeeRole', 80),
    mulai: longDate(text(v, 'start'), lang) || (lang === 'id' ? '[tanggal mulai]' : '[start date]'),
    selesai:
      longDate(text(v, 'end'), lang) || (lang === 'id' ? '[tanggal berhenti]' : '[end date]'),
    keperluan: text(v, 'purpose', 150) || (lang === 'id' ? '[keperluan]' : '[purpose]'),
    nama: employee,
  };
  const fill = (s: string) => fillTokens(s, tokens);
  const place = [text(v, 'city', 60), longDate(text(v, 'date') || todayIso(), lang)]
    .filter(Boolean)
    .join(', ');

  // Kop surat: logo (opsional) di kiri, nama dan alamat perusahaan di kanannya.
  const kopText: Block[] = [
    { t: 'p', runs: [{ text: company, b: true, color: accent }], size: 16, lead: 1.15 },
    {
      t: 'p',
      runs: [{ text: longText(v, 'companyAddress', 300).replace(/\s*\n\s*/g, ', ') }],
      size: 9.5,
      color: '444444',
      before: 2,
    },
    { t: 'p', runs: [{ text: text(v, 'companyContact', 200) }], size: 9.5, color: '444444' },
  ];
  const logo = assets.logo;
  const kop: Block = logo
    ? {
        t: 'cols',
        widths: [1, 6],
        gap: 12,
        cols: [
          [{ t: 'img', data: logo.data, type: logo.type, ...fit(logo.w, logo.h, 60, 52) }],
          kopText,
        ],
      }
    : { t: 'cols', cols: [kopText] };

  const main: Block[] = [
    kop,
    { t: 'rule', color: accent, weight: 2, before: 8 },
    { t: 'rule', color: accent, weight: 0.6, before: 1.5, after: 18 },
    ...titleBlock(w.title, text(v, 'number', 60), w.number),
    { t: 'p', runs: [{ text: w.intro }], after: 4 },
    {
      t: 'kv',
      label: 120,
      rows: [
        [w.name, text(v, 'signer', 80)],
        [w.role, text(v, 'signerRole', 80)],
      ],
      after: 8,
    },
    { t: 'p', runs: [{ text: w.states }], after: 4 },
    {
      t: 'kv',
      label: 120,
      rows: [
        [w.name, employee],
        [w.birth, text(v, 'employeeBirth', 100)],
        [w.id, text(v, 'employeeId', 40)],
        [w.role, text(v, 'employeeRole', 80)],
        [w.dept, text(v, 'employeeDept', 80)],
      ],
      after: 10,
    },
    ...paragraphs(fill(longText(v, 'body'))).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    })),
    ...paragraphs(longText(v, 'closing')).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    })),
    {
      t: 'cols',
      before: 14,
      cols: [
        [],
        signColumn({
          above: [place, company],
          name: text(v, 'signer', 80),
          sub: text(v, 'signerRole', 80),
          signature: assets.signature,
          lang,
        }),
      ],
    },
  ];
  return {
    title: [w.docTitle, employee, company].filter(Boolean).join(' - '),
    author: company,
    lang,
    font,
    size: 11,
    color: '1a1a1a',
    margin: 56,
    main,
  };
}

export function keteranganForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  return {
    template: 'keterangan',
    storage: 'surat-keterangan-kerja',
    fileBase: L(T('Surat-Keterangan-Kerja', 'Certificate-of-Employment')),
    fileKey: 'employee',
    sections: [
      {
        id: 'type',
        title: L(T('Jenis dan tampilan', 'Type and layout')),
        items: [
          {
            key: 'type',
            kind: 'select',
            label: L(T('Jenis surat', 'Letter type')),
            span: 2,
            options: [
              {
                value: 'berhenti',
                label: L(
                  T('Paklaring (karyawan sudah berhenti)', 'Former employee (left the company)'),
                ),
              },
              {
                value: 'aktif',
                label: L(
                  T(
                    'Masih bekerja (untuk KPR, visa, dll.)',
                    'Current employee (for a mortgage, visa, etc.)',
                  ),
                ),
              },
            ],
            hint: L(
              T(
                'Mengganti pilihan mengisi ulang contoh isi surat selama belum kamu ubah.',
                'Changing this refills the example body as long as you haven’t edited it.',
              ),
            ),
          },
          fontField(locale),
          alignField(locale),
          {
            key: 'accent',
            kind: 'swatch',
            label: L(T('Warna kop surat', 'Letterhead colour')),
            span: 2,
            options: ACCENTS.map((a) => ({ value: a.value, label: a[locale] })),
          },
        ],
      },
      {
        id: 'company',
        title: L(T('Kop perusahaan', 'Company letterhead')),
        items: [
          {
            key: 'logo',
            kind: 'image',
            image: 'logo',
            label: L(T('Logo perusahaan (opsional)', 'Company logo (optional)')),
            span: 2,
          },
          {
            key: 'company',
            kind: 'text',
            label: L(T('Nama perusahaan', 'Company name')),
            max: 100,
            span: 2,
          },
          {
            key: 'companyAddress',
            kind: 'textarea',
            label: L(T('Alamat', 'Address')),
            rows: 2,
            span: 2,
            max: 300,
          },
          {
            key: 'companyContact',
            kind: 'text',
            label: L(T('Telepon, email, situs', 'Phone, email, website')),
            max: 200,
            span: 2,
          },
          { key: 'number', kind: 'text', label: L(T('Nomor surat', 'Reference number')), max: 60 },
          { key: 'signer', kind: 'text', label: L(T('Nama penanda tangan', 'Signed by')), max: 80 },
          {
            key: 'signerRole',
            kind: 'text',
            label: L(T('Jabatan penanda tangan', 'Signer’s position')),
            max: 80,
          },
        ],
      },
      {
        id: 'employee',
        title: L(T('Data karyawan', 'Employee')),
        items: [
          { key: 'employee', kind: 'text', label: L(T('Nama karyawan', 'Employee name')), max: 80 },
          {
            key: 'employeeBirth',
            kind: 'text',
            label: L(T('Tempat, tanggal lahir (opsional)', 'Place and date of birth (optional)')),
            max: 100,
          },
          {
            key: 'employeeId',
            kind: 'text',
            label: L(T('NIK karyawan (opsional)', 'Employee ID (optional)')),
            max: 40,
          },
          {
            key: 'employeeRole',
            kind: 'text',
            label: L(T('Jabatan (terakhir)', 'Position (last held)')),
            max: 80,
          },
          { key: 'employeeDept', kind: 'text', label: L(T('Divisi', 'Department')), max: 80 },
          { key: 'start', kind: 'date', label: L(T('Mulai bekerja', 'Start date')) },
          {
            key: 'end',
            kind: 'date',
            label: L(T('Berhenti bekerja (paklaring)', 'End date (former employee)')),
          },
          {
            key: 'purpose',
            kind: 'text',
            label: L(T('Keperluan surat (masih bekerja)', 'Purpose (current employee)')),
            max: 150,
            placeholder: L(T('pengajuan KPR', 'a mortgage application')),
          },
        ],
      },
      {
        id: 'body',
        title: L(T('Isi surat', 'Letter body')),
        items: [
          {
            key: 'body',
            kind: 'textarea',
            label: L(T('Isi keterangan', 'Body')),
            rows: 6,
            span: 2,
            max: 2500,
            hint: L(
              T(
                '{perusahaan}, {jabatan}, {mulai}, {selesai}, dan {keperluan} terisi otomatis.',
                '{perusahaan}, {jabatan}, {mulai}, {selesai} and {keperluan} are filled in automatically.',
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
            T('Tanda tangan penanda tangan (opsional)', 'Signer’s signature (optional)'),
          ),
        ],
      },
    ],
    sample: {
      lang: locale,
      type: 'berhenti',
      font: 'serif',
      align: 'justify',
      accent: '1f3a5f',
      logo: '',
      company: 'PT Sumber Rezeki Distribusi',
      companyAddress: 'Jl. Soekarno-Hatta No. 120, Bandung 40286',
      companyContact: '(022) 555-0123 · hrd@sumberrezeki.co.id',
      number: '045/HRD/SRD/XI/2026',
      signer: 'Ayudiyah Pratiwi',
      signerRole: L(T('Manajer HRD', 'HR Manager')),
      employee: 'Julian Marcell',
      employeeBirth: L(T('Bandung, 12 Mei 2000', 'Bandung, 12 May 2000')),
      employeeId: '2023-0815',
      employeeRole: L(T('Staf Keuangan', 'Finance Staff')),
      employeeDept: L(T('Keuangan & Akuntansi', 'Finance & Accounting')),
      start: '2023-08-01',
      end: '2026-12-10',
      purpose: '',
      body: BODY.berhenti[locale],
      closing: CLOSING[locale],
      city: 'Bandung',
      date: '',
      signature: '',
    },
    presets: {
      key: 'type',
      fill: { berhenti: { body: BODY.berhenti[locale] }, aktif: { body: BODY.aktif[locale] } },
    },
  };
}

export const KETERANGAN_FORM = { id: keteranganForm('id'), en: keteranganForm('en') };
