/**
 * Template dokumen: surat lamaran kerja. Dua gaya: formal (format surat Indonesia dengan
 * perihal, data diri, dan daftar lampiran) dan modern (kop nama, paragraf ringkas).
 */
import {
  choice,
  fillTokens,
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

export const ACCENTS = [
  { value: '1a1a1a', id: 'Hitam', en: 'Black' },
  { value: '1f3a5f', id: 'Biru tua', en: 'Navy' },
  { value: '2f5d3a', id: 'Hijau', en: 'Green' },
  { value: '8c3b22', id: 'Terakota', en: 'Terracotta' },
];

const LETTER_TEXT = {
  id: {
    opening:
      'Berdasarkan informasi lowongan kerja yang saya peroleh dari {sumber}, saya bermaksud melamar posisi {posisi} di {perusahaan}.',
    body: 'Saya lulusan S1 Akuntansi dengan pengalaman dua tahun sebagai staf keuangan di perusahaan distribusi. Saya terbiasa menyusun laporan keuangan bulanan, melakukan rekonsiliasi bank, dan mencatat pajak menggunakan Excel dan Accurate.\n\nSaya teliti, terbiasa bekerja dengan tenggat waktu, dan senang mempelajari sistem baru. Saya yakin pengalaman tersebut sesuai dengan kebutuhan posisi {posisi}.',
    closing:
      'Besar harapan saya untuk dapat mengikuti tahap seleksi berikutnya dan menjelaskan lebih jauh bagaimana saya dapat berkontribusi bagi {perusahaan}. Atas perhatian Bapak/Ibu, saya ucapkan terima kasih.',
    attachments:
      'Daftar riwayat hidup (CV)\nFotokopi ijazah dan transkrip nilai\nFotokopi KTP\nSertifikat Brevet A dan B\nPas foto terbaru',
    source: 'situs karier resmi perusahaan',
    recipient: 'HRD Manager',
  },
  en: {
    opening:
      'I am writing to apply for the {position} position at {company}, which I found on {sumber}.',
    body: 'I hold a bachelor’s degree in Accounting and have two years of experience as a finance staff member at a distribution company. I prepare monthly financial reports, reconcile bank statements, and record taxes using Excel and Accurate.\n\nI am detail-oriented, comfortable working to deadlines, and quick to learn new systems. I am confident this experience matches what you need for the {position} role.',
    closing:
      'I would welcome the opportunity to discuss how I can contribute to {company}. Thank you for your time and consideration.',
    attachments:
      'Curriculum vitae (CV)\nDegree certificate and transcript\nCopy of ID card\nTraining certificates',
    source: 'your company’s careers page',
    recipient: 'Hiring Manager',
  },
};

const WORDS = {
  id: {
    subject: 'Perihal',
    subjectText: 'Lamaran Pekerjaan sebagai {posisi}',
    attach: 'Lampiran',
    files: 'berkas',
    to: 'Kepada Yth.',
    hello: 'Dengan hormat,',
    helloModern: 'Yth. Bapak/Ibu {penerima},',
    details: 'Adapun data diri saya sebagai berikut:',
    name: 'Nama',
    birth: 'Tempat, tanggal lahir',
    education: 'Pendidikan terakhir',
    address: 'Alamat',
    phone: 'Telepon',
    email: 'Email',
    enclosed: 'Sebagai bahan pertimbangan, saya lampirkan:',
    enclosedShort: 'Lampiran',
    bye: 'Hormat saya,',
    byeModern: 'Salam hormat,',
    title: 'Surat Lamaran Kerja',
  },
  en: {
    subject: 'Subject',
    subjectText: 'Application for {position}',
    attach: 'Enclosures',
    files: '',
    to: 'To:',
    hello: 'Dear {penerima},',
    helloModern: 'Dear {penerima},',
    details: 'My details are as follows:',
    name: 'Name',
    birth: 'Place and date of birth',
    education: 'Education',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    enclosed: 'Please find enclosed:',
    enclosedShort: 'Enclosures',
    bye: 'Sincerely,',
    byeModern: 'Kind regards,',
    title: 'Cover Letter',
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
  const position = text(v, 'position', 100);
  const company = text(v, 'company', 100);
  const recipient = text(v, 'recipient', 100) || LETTER_TEXT[lang].recipient;
  const tokens = {
    posisi: position,
    position,
    perusahaan: company,
    company,
    sumber: text(v, 'source', 100),
    penerima: recipient,
    nama: name,
  };
  const fill = (s: string) => fillTokens(s, tokens);
  const date = longDate(text(v, 'date') || todayIso(), lang);
  const city = text(v, 'city', 60);
  const place = [city, date].filter(Boolean).join(', ');
  const attachments = lines(longText(v, 'attachments', 1500), 12);
  const paras = (key: string) =>
    paragraphs(fill(longText(v, key))).map((p): Block => ({
      t: 'p',
      runs: [{ text: p }],
      align,
      after: 8,
    }));

  const recipientBlock: Block[] = [
    ...(style === 'formal' ? [{ t: 'p', runs: [{ text: w.to }] } as Block] : []),
    { t: 'p', runs: [{ text: recipient }] },
    { t: 'p', runs: [{ text: company, b: style === 'modern' }] },
    { t: 'p', runs: [{ text: longText(v, 'companyAddress', 300) }] },
  ];

  const signature = assets.signature;
  const signBlock: Block[] = [
    { t: 'p', runs: [{ text: style === 'formal' ? w.bye : w.byeModern }], before: 10 },
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

  const main: Block[] = [];
  if (style === 'formal') {
    main.push({ t: 'p', runs: [{ text: place }], align: 'right', after: 14 });
    main.push({
      t: 'kv',
      label: 62,
      rows: [
        [w.subject, fill(w.subjectText)],
        [w.attach, attachments.length ? `${attachments.length} ${w.files}`.trim() : ''],
      ],
      after: 14,
    });
    main.push(...recipientBlock, { t: 'gap', h: 14 });
    main.push({ t: 'p', runs: [{ text: fill(w.hello) }], after: 8 });
    main.push(...paras('opening'));
    const details: [string, string][] = [
      [w.name, name],
      [w.birth, text(v, 'birth', 100)],
      [w.education, text(v, 'education', 150)],
      [w.address, longText(v, 'address', 200).replace(/\s*\n\s*/g, ', ')],
      [w.phone, text(v, 'phone', 40)],
      [w.email, text(v, 'email', 80)],
    ];
    if (details.some(([, x]) => x)) {
      main.push({ t: 'p', runs: [{ text: w.details }], after: 4 });
      main.push({ t: 'kv', label: 130, rows: details, after: 8 });
    }
    main.push(...paras('body'));
    if (attachments.length) {
      main.push({ t: 'p', runs: [{ text: w.enclosed }], after: 2 });
      main.push({
        t: 'list',
        numbered: true,
        items: attachments.map((x) => [{ text: x }]),
        after: 8,
      });
    }
    main.push(...paras('closing'));
    main.push(...signBlock);
  } else {
    const contact = [
      longText(v, 'address', 200).replace(/\s*\n\s*/g, ', '),
      text(v, 'phone', 40),
      text(v, 'email', 80),
    ].filter(Boolean);
    main.push({ t: 'p', runs: [{ text: name, b: true, color: accent }], size: 22, lead: 1.15 });
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
    main.push({ t: 'p', runs: [{ text: fill(w.subjectText), b: true }], after: 10 });
    main.push({ t: 'p', runs: [{ text: fill(w.helloModern) }], after: 8 });
    main.push(...paras('opening'), ...paras('body'), ...paras('closing'));
    main.push(...signBlock);
    if (attachments.length)
      main.push({
        t: 'p',
        runs: [{ text: `${w.enclosedShort}: `, b: true }, { text: attachments.join(', ') }],
        size: 9.5,
        color: '555555',
        before: 18,
      });
  }

  return {
    title: [w.title, position, company].filter(Boolean).join(' - '),
    author: name,
    lang,
    font,
    size: 11,
    color: '1a1a1a',
    margin: 64,
    main,
  };
}

/** Ukuran gambar agar muat di kotak maks w x h tanpa mengubah perbandingan. */
export function fit(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h);
  return { w: w * s, h: h * s };
}

const T = (id: string, en: string) => ({ id, en });

export function letterForm(locale: Locale): DocForm {
  const L = (x: { id: string; en: string }) => x[locale];
  const lt = LETTER_TEXT[locale];
  return {
    template: 'lamaran',
    storage: 'surat-lamaran',
    fileBase: L(T('Surat-Lamaran', 'Cover-Letter')),
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
                  T(
                    'Formal (perihal, data diri, lampiran)',
                    'Formal (subject, details, enclosures)',
                  ),
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
        title: L(T('Data diri', 'Your details')),
        items: [
          { key: 'name', kind: 'text', label: L(T('Nama lengkap', 'Full name')), max: 80 },
          {
            key: 'birth',
            kind: 'text',
            label: L(T('Tempat, tanggal lahir', 'Place and date of birth')),
            max: 100,
            placeholder: L(T('Bandung, 12 Mei 2000', 'Bandung, 12 May 2000')),
          },
          {
            key: 'education',
            kind: 'text',
            label: L(T('Pendidikan terakhir', 'Education')),
            span: 2,
            max: 150,
          },
          {
            key: 'address',
            kind: 'textarea',
            label: L(T('Alamat', 'Address')),
            rows: 2,
            span: 2,
            max: 200,
          },
          { key: 'phone', kind: 'text', label: L(T('Nomor HP', 'Phone')), max: 40 },
          { key: 'email', kind: 'text', label: 'Email', max: 80 },
        ],
      },
      {
        id: 'target',
        title: L(T('Lowongan yang dilamar', 'The job')),
        items: [
          { key: 'position', kind: 'text', label: L(T('Posisi', 'Position')), max: 100 },
          { key: 'company', kind: 'text', label: L(T('Nama perusahaan', 'Company')), max: 100 },
          {
            key: 'recipient',
            kind: 'text',
            label: L(T('Ditujukan kepada', 'Addressed to')),
            max: 100,
            placeholder: lt.recipient,
            hint: L(
              T(
                'Misalnya HRD Manager atau nama perekrut bila tahu.',
                'For example Hiring Manager, or the recruiter’s name if you know it.',
              ),
            ),
          },
          {
            key: 'source',
            kind: 'text',
            label: L(T('Info lowongan dari', 'Where you found the job')),
            max: 100,
            placeholder: lt.source,
          },
          {
            key: 'companyAddress',
            kind: 'textarea',
            label: L(T('Alamat perusahaan', 'Company address')),
            rows: 2,
            span: 2,
            max: 300,
          },
          { key: 'city', kind: 'text', label: L(T('Kota penulisan surat', 'City')), max: 60 },
          {
            key: 'date',
            kind: 'date',
            label: L(T('Tanggal surat', 'Date')),
            hint: L(T('Kosongkan untuk tanggal hari ini.', 'Leave empty for today.')),
          },
        ],
      },
      {
        id: 'body',
        title: L(T('Isi surat', 'Letter body')),
        items: [
          {
            key: 'opening',
            kind: 'textarea',
            label: L(T('Paragraf pembuka', 'Opening paragraph')),
            rows: 3,
            span: 2,
            max: 1200,
          },
          {
            key: 'body',
            kind: 'textarea',
            label: L(T('Paragraf isi: kenapa kamu cocok', 'Main paragraph: why you fit')),
            rows: 7,
            span: 2,
            max: 3000,
            hint: L(
              T(
                'Pisahkan paragraf dengan satu baris kosong.',
                'Separate paragraphs with a blank line.',
              ),
            ),
          },
          {
            key: 'closing',
            kind: 'textarea',
            label: L(T('Paragraf penutup', 'Closing paragraph')),
            rows: 3,
            span: 2,
            max: 1200,
          },
          {
            key: 'attachments',
            kind: 'textarea',
            label: L(T('Lampiran (satu per baris)', 'Enclosures (one per line)')),
            rows: 5,
            span: 2,
            max: 1500,
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
      birth: L(T('Bandung, 12 Mei 2000', 'Bandung, 12 May 2000')),
      education: L(
        T(
          'S1 Akuntansi, Universitas Padjadjaran (IPK 3,62)',
          'Bachelor of Accounting, Padjadjaran University (GPA 3.62)',
        ),
      ),
      address: 'Jl. Melati No. 21, Coblong, Bandung 40132',
      phone: '0812-3456-7890',
      email: 'rina.pratama@email.com',
      position: L(T('Staf Administrasi Keuangan', 'Finance Administration Staff')),
      company: 'PT Maju Bersama Nusantara',
      recipient: lt.recipient,
      source: lt.source,
      companyAddress: 'Jl. Jenderal Sudirman Kav. 45\nJakarta Selatan 12930',
      city: 'Bandung',
      date: '',
      opening: lt.opening,
      body: lt.body,
      closing: lt.closing,
      attachments: lt.attachments,
      signature: '',
    },
    langText: {
      id: pick(LETTER_TEXT.id),
      en: pick(LETTER_TEXT.en),
    },
  };
}

function pick(x: (typeof LETTER_TEXT)['id']) {
  return {
    opening: x.opening,
    body: x.body,
    closing: x.closing,
    attachments: x.attachments,
    source: x.source,
    recipient: x.recipient,
  };
}

export const LETTER_FORM = { id: letterForm('id'), en: letterForm('en') };
