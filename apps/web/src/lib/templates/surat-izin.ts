/**
 * Template dokumen: surat izin tidak masuk kerja (sakit atau keperluan keluarga) dan surat izin
 * sekolah dari orang tua. Tanggal izin dan lama hari dihitung otomatis.
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
  dateRange,
  dayCount,
  daysText,
  fontField,
  placeDateFields,
  signatureField,
  type Tr,
} from './letter-kit';
import { fit } from './surat-lamaran';

export const IZIN_TYPES = [
  'sakit-kerja',
  'keperluan-kerja',
  'sakit-sekolah',
  'keperluan-sekolah',
] as const;
type IzinType = (typeof IZIN_TYPES)[number];
const isSchool = (t: IzinType) => t.endsWith('sekolah');

const BODY: Record<IzinType, Tr> = {
  'sakit-kerja': T(
    'Dengan surat ini, saya memohon izin tidak masuk kerja selama {lama}, yaitu pada {tanggal}, karena sedang sakit dan perlu beristirahat sesuai anjuran dokter. Surat keterangan dokter saya lampirkan bersama surat ini.',
    'I am writing to request leave from work for {lama}, on {tanggal}, as I am unwell and have been advised by my doctor to rest. A doctor’s note is attached.',
  ),
  'keperluan-kerja': T(
    'Dengan surat ini, saya memohon izin tidak masuk kerja selama {lama}, yaitu pada {tanggal}, karena ada keperluan keluarga yang tidak dapat ditinggalkan. Pekerjaan saya selama izin sudah saya koordinasikan dengan rekan satu tim.',
    'I am writing to request leave from work for {lama}, on {tanggal}, for an urgent family matter. I have arranged for my teammates to cover my work while I am away.',
  ),
  'sakit-sekolah': T(
    'Dengan surat ini, kami memberitahukan bahwa anak kami tidak dapat mengikuti kegiatan belajar di sekolah selama {lama}, yaitu pada {tanggal}, karena sedang sakit.',
    'I am writing to let you know that my child will be absent from school for {lama}, on {tanggal}, due to illness.',
  ),
  'keperluan-sekolah': T(
    'Dengan surat ini, kami memohon izin anak kami tidak dapat mengikuti kegiatan belajar di sekolah selama {lama}, yaitu pada {tanggal}, karena ada keperluan keluarga yang tidak dapat ditinggalkan.',
    'I am writing to request that my child be excused from school for {lama}, on {tanggal}, for an urgent family matter.',
  ),
};

const CLOSING = {
  kerja: T(
    'Demikian surat izin ini saya sampaikan. Atas perhatian dan pengertian Bapak/Ibu, saya ucapkan terima kasih.',
    'Thank you for your understanding.',
  ),
  sekolah: T(
    'Demikian surat izin ini kami sampaikan. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.',
    'Thank you for your understanding.',
  ),
};

const RECIPIENT = {
  kerja: {
    recipient: T('Bapak Andi Wijaya', 'Mr Andi Wijaya'),
    recipientTitle: T('Kepala Bagian Keuangan', 'Head of Finance'),
    institution: T('PT Sumber Rezeki Distribusi', 'PT Sumber Rezeki Distribusi'),
  },
  sekolah: {
    recipient: T('Bapak/Ibu Wali Kelas 8B', 'Class 8B Homeroom Teacher'),
    recipientTitle: T('', ''),
    institution: T('SMP Negeri 5 Bandung', 'SMP Negeri 5 Bandung'),
  },
};

const W = {
  id: {
    to: 'Kepada Yth.',
    subject: 'Perihal',
    subjectWork: 'Permohonan Izin Tidak Masuk Kerja',
    subjectSchool: 'Permohonan Izin Tidak Masuk Sekolah',
    hello: 'Dengan hormat,',
    meWork: 'Saya yang bertanda tangan di bawah ini:',
    meSchool: 'Yang bertanda tangan di bawah ini, orang tua/wali dari:',
    name: 'Nama',
    role: 'Jabatan',
    dept: 'Divisi',
    student: 'Nama siswa',
    klass: 'Kelas',
    byeWork: 'Hormat saya,',
    byeSchool: 'Hormat kami,',
    parent: 'Orang tua/wali siswa',
    docTitle: 'Surat Izin',
  },
  en: {
    to: 'To:',
    subject: 'Subject',
    subjectWork: 'Leave of Absence Request',
    subjectSchool: 'School Absence',
    hello: 'Dear {penerima},',
    meWork: 'Employee details:',
    meSchool: 'Student details:',
    name: 'Name',
    role: 'Position',
    dept: 'Department',
    student: 'Student',
    klass: 'Class',
    byeWork: 'Sincerely,',
    byeSchool: 'Sincerely,',
    parent: 'Parent/guardian',
    docTitle: 'Leave Letter',
  },
};

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const type = choice(v, 'type', IZIN_TYPES, 'sakit-kerja');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'serif');
  const align = choice(v, 'align', ['left', 'justify'] as const, 'justify');
  const school = isSchool(type);
  const w = W[lang];
  const name = text(v, 'name', 80);
  const dateIso = text(v, 'date') || todayIso();
  const from = text(v, 'from') || dateIso;
  const to = text(v, 'to') || from;
  const recipient = text(v, 'recipient', 100);
  const tokens = {
    lama: daysText(dayCount(from, to), lang),
    tanggal: dateRange(from, to, lang),
    nama: name,
    siswa: text(v, 'student', 80),
    kelas: text(v, 'studentClass', 40),
    penerima: recipient || (lang === 'id' ? 'Bapak/Ibu' : 'Sir or Madam'),
  };
  const fill = (s: string) => fillTokens(s, tokens);
  const place = [text(v, 'city', 60), longDate(dateIso, lang)].filter(Boolean).join(', ');
  const paras = (key: string) =>
    paragraphs(fill(longText(v, key))).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    }));
  const sig = assets.signature;

  const main: Block[] = [
    { t: 'p', runs: [{ text: place }], align: 'right', after: 14 },
    { t: 'p', runs: [{ text: w.to }] },
    { t: 'p', runs: [{ text: recipient }] },
    { t: 'p', runs: [{ text: text(v, 'recipientTitle', 100) }] },
    { t: 'p', runs: [{ text: text(v, 'institution', 100) }] },
    { t: 'gap', h: 14 },
    {
      t: 'kv',
      label: 56,
      rows: [[w.subject, school ? w.subjectSchool : w.subjectWork]],
      after: 14,
    },
    { t: 'p', runs: [{ text: fill(w.hello) }], after: 8 },
    { t: 'p', runs: [{ text: school ? w.meSchool : w.meWork }], after: 4 },
    {
      t: 'kv',
      label: 110,
      rows: school
        ? [
            [w.student, text(v, 'student', 80)],
            [w.klass, text(v, 'studentClass', 40)],
          ]
        : [
            [w.name, name],
            [w.role, text(v, 'role', 80)],
            [w.dept, text(v, 'department', 80)],
          ],
      after: 8,
    },
    ...paras('body'),
    ...paras('closing'),
    { t: 'p', runs: [{ text: school ? w.byeSchool : w.byeWork }], before: 10 },
  ];
  if (school) main.push({ t: 'p', runs: [{ text: w.parent }] });
  main.push(
    sig
      ? {
          t: 'img',
          data: sig.data,
          type: sig.type,
          ...fit(sig.w, sig.h, 120, 54),
          before: 4,
          after: 2,
        }
      : { t: 'gap', h: 50 },
    { t: 'p', runs: [{ text: name, b: true }] },
  );
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

export function izinForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const fill = Object.fromEntries(
    IZIN_TYPES.map((t) => {
      const kind = isSchool(t) ? 'sekolah' : 'kerja';
      const r = RECIPIENT[kind];
      return [
        t,
        {
          body: BODY[t][locale],
          closing: CLOSING[kind][locale],
          recipient: r.recipient[locale],
          recipientTitle: r.recipientTitle[locale],
          institution: r.institution[locale],
        },
      ];
    }),
  );
  return {
    template: 'izin',
    storage: 'surat-izin',
    fileBase: L(T('Surat-Izin', 'Leave-Letter')),
    fileKey: 'name',
    sections: [
      {
        id: 'type',
        title: L(T('Jenis dan tampilan', 'Type and layout')),
        items: [
          {
            key: 'type',
            kind: 'select',
            label: L(T('Jenis izin', 'Type of leave')),
            span: 2,
            options: [
              {
                value: 'sakit-kerja',
                label: L(T('Izin kerja karena sakit', 'Sick leave from work')),
              },
              {
                value: 'keperluan-kerja',
                label: L(
                  T('Izin kerja karena keperluan keluarga', 'Leave from work for a family matter'),
                ),
              },
              {
                value: 'sakit-sekolah',
                label: L(
                  T(
                    'Izin sekolah karena sakit (dari orang tua)',
                    'School absence due to illness (from a parent)',
                  ),
                ),
              },
              {
                value: 'keperluan-sekolah',
                label: L(
                  T(
                    'Izin sekolah karena keperluan keluarga (dari orang tua)',
                    'School absence for a family matter (from a parent)',
                  ),
                ),
              },
            ],
            hint: L(
              T(
                'Mengganti pilihan mengisi ulang contoh teks selama belum kamu ubah.',
                'Changing this refills the example text as long as you haven’t edited it.',
              ),
            ),
          },
          fontField(locale),
          alignField(locale),
        ],
      },
      {
        id: 'me',
        title: L(T('Data pemohon', 'Your details')),
        items: [
          {
            key: 'name',
            kind: 'text',
            label: L(T('Nama lengkap (yang bertanda tangan)', 'Full name (signing)')),
            max: 80,
            span: 2,
          },
          {
            key: 'role',
            kind: 'text',
            label: L(T('Jabatan (izin kerja)', 'Position (work leave)')),
            max: 80,
          },
          {
            key: 'department',
            kind: 'text',
            label: L(T('Divisi (izin kerja)', 'Department (work leave)')),
            max: 80,
          },
          {
            key: 'student',
            kind: 'text',
            label: L(T('Nama siswa (izin sekolah)', 'Student name (school)')),
            max: 80,
          },
          {
            key: 'studentClass',
            kind: 'text',
            label: L(T('Kelas (izin sekolah)', 'Class (school)')),
            max: 40,
          },
        ],
      },
      {
        id: 'to',
        title: L(T('Tujuan dan tanggal izin', 'Recipient and dates')),
        items: [
          {
            key: 'recipient',
            kind: 'text',
            label: L(T('Ditujukan kepada', 'Addressed to')),
            max: 100,
          },
          {
            key: 'recipientTitle',
            kind: 'text',
            label: L(T('Jabatan penerima (opsional)', 'Their title (optional)')),
            max: 100,
          },
          {
            key: 'institution',
            kind: 'text',
            label: L(T('Perusahaan / sekolah', 'Company / school')),
            max: 100,
            span: 2,
          },
          {
            key: 'from',
            kind: 'date',
            label: L(T('Izin mulai', 'Leave from')),
            hint: L(T('Kosongkan untuk tanggal surat.', 'Leave empty for the letter date.')),
          },
          {
            key: 'to',
            kind: 'date',
            label: L(T('Sampai', 'Until')),
            hint: L(T('Kosongkan bila hanya satu hari.', 'Leave empty for a single day.')),
          },
          ...placeDateFields(locale),
        ],
      },
      {
        id: 'body',
        title: L(T('Isi surat', 'Letter body')),
        items: [
          {
            key: 'body',
            kind: 'textarea',
            label: L(T('Isi permohonan izin', 'Request')),
            rows: 5,
            span: 2,
            max: 2000,
            hint: L(
              T(
                '{lama} dan {tanggal} terisi otomatis dari tanggal izin.',
                '{lama} (length) and {tanggal} (dates) are filled in from the leave dates.',
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
        ],
      },
      { id: 'sign', title: L(T('Tanda tangan', 'Signature')), items: [signatureField(locale)] },
    ],
    sample: {
      lang: locale,
      type: 'sakit-kerja',
      font: 'serif',
      align: 'justify',
      name: 'Rina Pratama',
      role: L(T('Staf Keuangan', 'Finance Staff')),
      department: L(T('Keuangan & Akuntansi', 'Finance & Accounting')),
      student: 'Nayla Pratama',
      studentClass: '8B',
      from: '',
      to: '',
      city: 'Bandung',
      date: '',
      signature: '',
      ...fill['sakit-kerja'],
    },
    presets: { key: 'type', fill },
  };
}

export const IZIN_FORM = { id: izinForm('id'), en: izinForm('en') };
