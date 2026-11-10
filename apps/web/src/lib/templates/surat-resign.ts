/**
 * Template dokumen: surat pengunduran diri (resign). Gaya formal (format surat Indonesia dengan
 * data karyawan) dan modern (kop nama), bahasa Indonesia atau Inggris.
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
import { ACCENTS, fit } from './surat-lamaran';

const RESIGN_TEXT = {
  id: {
    statement:
      'Melalui surat ini, saya bermaksud mengajukan pengunduran diri dari posisi {jabatan} di {perusahaan}. Hari kerja terakhir saya adalah {hari_terakhir}.',
    thanks:
      'Saya mengucapkan terima kasih atas kesempatan, bimbingan, dan pengalaman berharga yang saya peroleh selama bekerja di {perusahaan}. Saya juga memohon maaf apabila selama ini terdapat kesalahan yang kurang berkenan.',
    handover:
      'Sampai hari kerja terakhir, saya akan tetap menyelesaikan tanggung jawab saya dan membantu proses serah terima pekerjaan agar berjalan lancar.',
    closing:
      'Demikian surat pengunduran diri ini saya sampaikan. Atas perhatian dan pengertian Bapak/Ibu, saya ucapkan terima kasih.',
    recipientTitle: 'HRD Manager',
    address: 'di Tempat',
  },
  en: {
    statement:
      'Please accept this letter as formal notice of my resignation from my position as {jabatan} at {perusahaan}. My last working day will be {hari_terakhir}.',
    thanks:
      'Thank you for the opportunities, guidance, and valuable experience I have gained while working at {perusahaan}.',
    handover:
      'Until my last day, I will continue to fulfil my responsibilities and help ensure a smooth handover of my work.',
    closing: 'I wish you and the team continued success.',
    recipientTitle: 'HR Manager',
    address: '',
  },
};

const WORDS = {
  id: {
    subject: 'Perihal',
    subjectText: 'Pengunduran Diri',
    to: 'Kepada Yth.',
    hello: 'Dengan hormat,',
    helloModern: 'Yth. {penerima},',
    me: 'Saya yang bertanda tangan di bawah ini:',
    name: 'Nama',
    role: 'Jabatan',
    dept: 'Divisi / Departemen',
    id: 'NIK karyawan',
    bye: 'Hormat saya,',
    title: 'Surat Pengunduran Diri',
  },
  en: {
    subject: 'Subject',
    subjectText: 'Resignation',
    to: 'To:',
    hello: 'Dear {penerima},',
    helloModern: 'Dear {penerima},',
    me: 'Employee details:',
    name: 'Name',
    role: 'Position',
    dept: 'Department',
    id: 'Employee ID',
    bye: 'Sincerely,',
    title: 'Resignation Letter',
  },
};

export function buildDoc(v: DocValues, assets: DocAssets): DocSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const style = choice(v, 'style', ['formal', 'modern'] as const, 'formal');
  const font = choice(v, 'font', ['sans', 'serif'] as const, 'serif');
  const align = choice(v, 'align', ['left', 'justify'] as const, 'justify');
  const accent = choice(
    v,
    'accent',
    ACCENTS.map((a) => a.value),
    '1a1a1a',
  );
  const w = WORDS[lang];

  const name = text(v, 'name', 80);
  const role = text(v, 'role', 100);
  const company = text(v, 'company', 100);
  const recipientName = text(v, 'recipient', 100);
  const recipientTitle = text(v, 'recipientTitle', 100);
  const greetingName =
    recipientName || recipientTitle || (lang === 'id' ? 'Bapak/Ibu' : 'Sir or Madam');
  const dateIso = text(v, 'date') || todayIso();
  // Tanpa hari terakhir: 30 hari setelah tanggal surat (masa pemberitahuan yang umum).
  const lastDay = longDate(text(v, 'lastDay') || addDays(dateIso, 30), lang);
  const tokens = {
    jabatan: role,
    perusahaan: company,
    hari_terakhir: lastDay,
    penerima: greetingName,
    nama: name,
  };
  const fill = (s: string) => fillTokens(s, tokens);
  const date = longDate(dateIso, lang);
  const place = [text(v, 'city', 60), date].filter(Boolean).join(', ');
  const paras = (key: string) =>
    paragraphs(fill(longText(v, key))).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    }));

  const recipientBlock: Block[] = [
    ...(style === 'formal' ? [{ t: 'p', runs: [{ text: w.to }] } as Block] : []),
    { t: 'p', runs: [{ text: recipientName, b: style === 'modern' }] },
    { t: 'p', runs: [{ text: recipientTitle }] },
    { t: 'p', runs: [{ text: company, b: style === 'modern' && !recipientName }] },
    { t: 'p', runs: [{ text: longText(v, 'companyAddress', 300) }] },
  ];
  const details: [string, string][] = [
    [w.name, name],
    [w.role, role],
    [w.dept, text(v, 'department', 100)],
    [w.id, text(v, 'employeeId', 40)],
  ];
  const signature = assets.signature;
  const signBlock: Block[] = [
    { t: 'p', runs: [{ text: w.bye }], before: 10 },
    signature
      ? {
          t: 'img',
          data: signature.data,
          type: signature.type,
          ...fit(signature.w, signature.h, 120, 54),
          before: 4,
          after: 2,
        }
      : { t: 'gap', h: 50 },
    { t: 'p', runs: [{ text: name, b: true }] },
  ];
  if (style === 'modern' && role)
    signBlock.push({ t: 'p', runs: [{ text: role }], color: '555555' });

  const main: Block[] = [];
  if (style === 'formal') {
    main.push({ t: 'p', runs: [{ text: place }], align: 'right', after: 14 });
    main.push(...recipientBlock, { t: 'gap', h: 14 });
    main.push({ t: 'kv', label: 56, rows: [[w.subject, w.subjectText]], after: 14 });
    main.push({ t: 'p', runs: [{ text: fill(w.hello) }], after: 8 });
    if (details.some(([, x]) => x)) {
      main.push({ t: 'p', runs: [{ text: w.me }], after: 4 });
      main.push({ t: 'kv', label: 130, rows: details, after: 8 });
    }
  } else {
    const contact = [text(v, 'phone', 40), text(v, 'email', 80)].filter(Boolean);
    main.push({ t: 'p', runs: [{ text: name, b: true, color: accent }], size: 22, lead: 1.15 });
    if (contact.length)
      main.push({
        t: 'p',
        runs: [{ text: contact.join('  ·  ') }],
        size: 9.5,
        color: '555555',
        before: 4,
      });
    main.push({ t: 'rule', color: accent, weight: 1.2, before: 10, after: 18 });
    main.push({ t: 'p', runs: [{ text: place }], after: 14 });
    main.push(...recipientBlock, { t: 'gap', h: 14 });
    main.push({ t: 'p', runs: [{ text: w.subjectText, b: true }], after: 10 });
    main.push({ t: 'p', runs: [{ text: fill(w.helloModern) }], after: 8 });
  }
  main.push(...paras('statement'), ...paras('thanks'), ...paras('handover'), ...paras('closing'));
  main.push(...signBlock);

  return {
    title: [w.title, name, company].filter(Boolean).join(' - '),
    author: name,
    lang,
    font,
    size: 11,
    color: '1a1a1a',
    margin: 64,
    main,
  };
}

export function addDays(iso: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return todayIso(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
}

const T = (id: string, en: string) => ({ id, en });

export function resignForm(locale: Locale): DocForm {
  const L = (x: { id: string; en: string }) => x[locale];
  const rt = RESIGN_TEXT[locale];
  const tokenHint = L(
    T(
      '{jabatan}, {perusahaan}, dan {hari_terakhir} terisi otomatis dari data di atas.',
      '{jabatan} (position), {perusahaan} (company) and {hari_terakhir} (last day) are filled in from the fields above.',
    ),
  );
  return {
    template: 'resign',
    storage: 'surat-resign',
    fileBase: L(T('Surat-Resign', 'Resignation-Letter')),
    fileKey: 'name',
    sections: [
      {
        id: 'style',
        title: L(T('Gaya surat', 'Letter style')),
        items: [
          {
            key: 'style',
            kind: 'select',
            label: L(T('Gaya', 'Style')),
            options: [
              {
                value: 'formal',
                label: L(
                  T('Formal (perihal dan data karyawan)', 'Formal (subject and employee details)'),
                ),
              },
              {
                value: 'modern',
                label: L(T('Modern (kop nama, ringkas)', 'Modern (name header, concise)')),
              },
            ],
          },
          {
            key: 'lang',
            kind: 'select',
            label: L(T('Bahasa surat', 'Letter language')),
            options: [
              { value: 'id', label: 'Bahasa Indonesia' },
              { value: 'en', label: 'English' },
            ],
          },
          {
            key: 'font',
            kind: 'select',
            label: L(T('Huruf', 'Font')),
            options: [
              { value: 'serif', label: 'Times New Roman' },
              { value: 'sans', label: 'Arial / Helvetica' },
            ],
          },
          {
            key: 'align',
            kind: 'select',
            label: L(T('Perataan paragraf', 'Paragraph alignment')),
            options: [
              { value: 'justify', label: L(T('Rata kanan-kiri', 'Justified')) },
              { value: 'left', label: L(T('Rata kiri', 'Left')) },
            ],
          },
          {
            key: 'accent',
            kind: 'swatch',
            label: L(T('Warna kop (gaya modern)', 'Header colour (modern style)')),
            span: 2,
            options: ACCENTS.map((a) => ({ value: a.value, label: a[locale] })),
          },
        ],
      },
      {
        id: 'me',
        title: L(T('Data karyawan', 'Your details')),
        items: [
          { key: 'name', kind: 'text', label: L(T('Nama lengkap', 'Full name')), max: 80 },
          { key: 'role', kind: 'text', label: L(T('Jabatan', 'Position')), max: 100 },
          {
            key: 'department',
            kind: 'text',
            label: L(T('Divisi / departemen', 'Department')),
            max: 100,
          },
          {
            key: 'employeeId',
            kind: 'text',
            label: L(T('NIK karyawan (opsional)', 'Employee ID (optional)')),
            max: 40,
          },
          {
            key: 'phone',
            kind: 'text',
            label: L(T('Nomor HP (gaya modern)', 'Phone (modern style)')),
            max: 40,
          },
          {
            key: 'email',
            kind: 'text',
            label: L(T('Email (gaya modern)', 'Email (modern style)')),
            max: 80,
          },
        ],
      },
      {
        id: 'to',
        title: L(T('Tujuan surat', 'Recipient')),
        items: [
          {
            key: 'recipient',
            kind: 'text',
            label: L(T('Nama atasan / HRD', 'Manager or HR name')),
            max: 100,
            placeholder: L(T('Bapak Andi Wijaya', 'Mr Andi Wijaya')),
          },
          {
            key: 'recipientTitle',
            kind: 'text',
            label: L(T('Jabatan penerima', 'Their title')),
            max: 100,
            placeholder: rt.recipientTitle,
          },
          { key: 'company', kind: 'text', label: L(T('Nama perusahaan', 'Company')), max: 100 },
          {
            key: 'companyAddress',
            kind: 'textarea',
            label: L(T('Alamat perusahaan', 'Company address')),
            rows: 2,
            max: 300,
          },
          { key: 'city', kind: 'text', label: L(T('Kota penulisan surat', 'City')), max: 60 },
          {
            key: 'date',
            kind: 'date',
            label: L(T('Tanggal surat', 'Date')),
            hint: L(T('Kosongkan untuk tanggal hari ini.', 'Leave empty for today.')),
          },
          {
            key: 'lastDay',
            kind: 'date',
            label: L(T('Hari kerja terakhir', 'Last working day')),
            hint: L(
              T(
                'Kosongkan untuk 30 hari setelah tanggal surat, masa pemberitahuan yang umum. Cek juga kontrak kerjamu.',
                'Leave empty for 30 days after the letter date, the usual notice period. Check your contract too.',
              ),
            ),
          },
        ],
      },
      {
        id: 'body',
        title: L(T('Isi surat', 'Letter body')),
        items: [
          {
            key: 'statement',
            kind: 'textarea',
            label: L(T('Pernyataan pengunduran diri', 'Resignation statement')),
            rows: 3,
            span: 2,
            max: 1200,
            hint: tokenHint,
          },
          {
            key: 'thanks',
            kind: 'textarea',
            label: L(T('Ucapan terima kasih', 'Thanks')),
            rows: 3,
            span: 2,
            max: 1500,
          },
          {
            key: 'handover',
            kind: 'textarea',
            label: L(T('Komitmen serah terima', 'Handover commitment')),
            rows: 3,
            span: 2,
            max: 1200,
          },
          {
            key: 'closing',
            kind: 'textarea',
            label: L(T('Penutup', 'Closing')),
            rows: 2,
            span: 2,
            max: 800,
          },
        ],
      },
      {
        id: 'sign',
        title: L(T('Tanda tangan', 'Signature')),
        items: [
          {
            key: 'signature',
            kind: 'image',
            image: 'signature',
            label: L(T('Gambar tanda tangan (opsional)', 'Signature image (optional)')),
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
          },
        ],
      },
    ],
    sample: {
      style: 'formal',
      lang: locale,
      font: 'serif',
      align: 'justify',
      accent: '1f3a5f',
      name: 'Rina Pratama',
      role: L(T('Staf Keuangan', 'Finance Staff')),
      department: L(T('Keuangan & Akuntansi', 'Finance & Accounting')),
      employeeId: '2023-0815',
      phone: '0812-3456-7890',
      email: 'rina.pratama@email.com',
      recipient: L(T('Bapak Andi Wijaya', 'Mr Andi Wijaya')),
      recipientTitle: rt.recipientTitle,
      company: 'PT Sumber Rezeki Distribusi',
      companyAddress: rt.address,
      city: 'Bandung',
      date: '',
      lastDay: '',
      statement: rt.statement,
      thanks: rt.thanks,
      handover: rt.handover,
      closing: rt.closing,
      signature: '',
    },
    langText: {
      id: pick(RESIGN_TEXT.id),
      en: pick(RESIGN_TEXT.en),
    },
  };
}

function pick(x: (typeof RESIGN_TEXT)['id']) {
  return {
    statement: x.statement,
    thanks: x.thanks,
    handover: x.handover,
    closing: x.closing,
    recipientTitle: x.recipientTitle,
    companyAddress: x.address,
  };
}

export const RESIGN_FORM = { id: resignForm('id'), en: resignForm('en') };
