/**
 * Data dan form CV yang dipakai bersama oleh CV ATS (satu kolom) dan CV profesional (dua kolom
 * dengan foto). Keduanya menyimpan isian di kunci yang sama, jadi isian bisa dipakai bergantian.
 */
import {
  choice,
  itemText,
  items,
  lines,
  longText,
  paragraphs,
  period,
  text,
  type DocField,
  type DocForm,
  type DocRepeat,
  type DocSection,
  type DocValues,
} from '../docs/form';
import type { Run } from '../docs/model';
import type { Locale } from '../format';

export const CV_HEADINGS = {
  id: {
    summary: 'Ringkasan',
    profile: 'Profil',
    experience: 'Pengalaman Kerja',
    education: 'Pendidikan',
    skills: 'Keahlian',
    certs: 'Sertifikasi',
    orgs: 'Organisasi & Proyek',
    languages: 'Bahasa',
    contact: 'Kontak',
    gpa: 'IPK',
  },
  en: {
    summary: 'Summary',
    profile: 'Profile',
    experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    certs: 'Certifications',
    orgs: 'Organizations & Projects',
    languages: 'Languages',
    contact: 'Contact',
    gpa: 'GPA',
  },
};

export interface CvEntry {
  title: string;
  org: string;
  city: string;
  when: string;
  extra: string;
  bullets: string[];
}

export interface CvData {
  lang: 'id' | 'en';
  font: 'sans' | 'serif';
  name: string;
  headline: string;
  contacts: Run[];
  /** Kontak satu per baris (untuk kolom samping). */
  contactLines: Run[];
  summary: string[];
  experience: CvEntry[];
  education: CvEntry[];
  orgs: CvEntry[];
  skills: { group: string; list: string }[];
  certs: { name: string; issuer: string; year: string }[];
  languages: string[];
}

/** Tambahkan https:// agar tautan di PDF dan Word bisa diklik. */
export function asUrl(s: string): string {
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function readCv(v: DocValues): CvData {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const email = text(v, 'email', 80);
  const linkedin = text(v, 'linkedin', 120);
  const website = text(v, 'website', 120);
  const contactParts: Run[] = [
    { text: text(v, 'city', 60) },
    { text: text(v, 'phone', 40) },
    email ? { text: email, href: `mailto:${email}` } : { text: '' },
    linkedin
      ? { text: linkedin.replace(/^https?:\/\/(www\.)?/i, ''), href: asUrl(linkedin) }
      : { text: '' },
    website
      ? { text: website.replace(/^https?:\/\/(www\.)?/i, ''), href: asUrl(website) }
      : { text: '' },
  ].filter((r) => r.text);
  const entry = (it: Record<string, string>, t: string, o: string, extra = ''): CvEntry => ({
    title: itemText(it, t, 120),
    org: itemText(it, o, 120),
    city: itemText(it, 'city', 60),
    when: period(itemText(it, 'start', 10), itemText(it, 'end', 10), lang),
    extra,
    bullets: lines(typeof it.bullets === 'string' ? it.bullets.slice(0, 2000) : '', 10),
  });
  const gpaWord = CV_HEADINGS[lang].gpa;
  return {
    lang,
    font: choice(v, 'font', ['sans', 'serif'] as const, 'sans'),
    name: text(v, 'name', 80),
    headline: text(v, 'headline', 120),
    contacts: contactParts,
    contactLines: contactParts,
    summary: paragraphs(longText(v, 'summary', 1500)),
    experience: items(v, 'experience', 10)
      .map((it) => entry(it, 'role', 'company'))
      .filter((e) => e.title || e.org),
    education: items(v, 'education', 6)
      .map((it) => {
        const gpa = itemText(it, 'gpa', 30);
        return {
          ...entry(it, 'school', 'degree', gpa ? `${gpaWord} ${gpa}` : ''),
          bullets: lines(typeof it.notes === 'string' ? it.notes.slice(0, 1000) : '', 5),
        };
      })
      .filter((e) => e.title || e.org),
    orgs: items(v, 'orgs', 8)
      .map((it) => entry(it, 'role', 'org'))
      .filter((e) => e.title || e.org),
    skills: items(v, 'skills', 8)
      .map((it) => ({ group: itemText(it, 'group', 60), list: itemText(it, 'list', 400) }))
      .filter((s) => s.list),
    certs: items(v, 'certs', 10)
      .map((it) => ({
        name: itemText(it, 'name', 120),
        issuer: itemText(it, 'issuer', 80),
        year: itemText(it, 'year', 20),
      }))
      .filter((c) => c.name),
    languages: lines(longText(v, 'languages', 400), 6),
  };
}

const T = (id: string, en: string) => ({ id, en });

const SAMPLE = {
  id: {
    headline: 'Staf Akuntansi',
    summary:
      'Lulusan S1 Akuntansi dengan pengalaman dua tahun di bidang keuangan perusahaan distribusi. Terbiasa menyusun laporan keuangan bulanan, rekonsiliasi bank, dan perpajakan (PPN, PPh 21). Teliti, cepat mempelajari sistem baru, dan terbiasa bekerja dengan tenggat waktu.',
    experience: [
      {
        role: 'Staf Keuangan',
        company: 'PT Sumber Rezeki Distribusi',
        city: 'Bandung',
        start: '2023-08',
        end: '',
        bullets:
          'Menyusun laporan keuangan bulanan untuk 3 cabang, rata-rata selesai 2 hari sebelum tenggat.\nMelakukan rekonsiliasi bank harian untuk 6 rekening dengan selisih di bawah 0,1%.\nMengelola pencatatan PPN dan PPh 21 menggunakan Accurate dan e-Bupot.',
      },
      {
        role: 'Magang Akuntansi',
        company: 'KAP Wijaya & Rekan',
        city: 'Bandung',
        start: '2022-07',
        end: '2022-12',
        bullets:
          'Membantu audit laporan keuangan 4 klien UMKM.\nMenyiapkan kertas kerja dan menguji lebih dari 300 bukti transaksi.',
      },
    ],
    education: [
      {
        school: 'Universitas Padjadjaran',
        degree: 'S1 Akuntansi',
        city: 'Sumedang',
        start: '2018-08',
        end: '2022-10',
        gpa: '3,62 / 4,00',
        notes: 'Skripsi: pengaruh pencatatan kas digital terhadap akurasi laporan keuangan UMKM',
      },
    ],
    skills: [
      { group: 'Akuntansi', list: 'Laporan keuangan, rekonsiliasi bank, PPN, PPh 21, PSAK' },
      {
        group: 'Perangkat lunak',
        list: 'Microsoft Excel (VLOOKUP, PivotTable), Accurate, SAP Business One, Google Sheets',
      },
      { group: 'Lainnya', list: 'Ketelitian, manajemen waktu, komunikasi tertulis' },
    ],
    certs: [
      { name: 'Brevet Pajak A dan B', issuer: 'IAI', year: '2023' },
      { name: 'Microsoft Office Specialist: Excel Associate', issuer: 'Microsoft', year: '2022' },
    ],
    orgs: [
      {
        role: 'Bendahara',
        org: 'Himpunan Mahasiswa Akuntansi',
        city: '',
        start: '2020-03',
        end: '2021-03',
        bullets:
          'Mengelola anggaran kegiatan Rp120 juta per tahun dengan laporan pertanggungjawaban tepat waktu.',
      },
    ],
    languages: 'Bahasa Indonesia (penutur asli)\nBahasa Inggris (TOEFL ITP 550)',
  },
  en: {
    headline: 'Accounting Staff',
    summary:
      'Accounting graduate with two years of experience in finance at a distribution company. Prepares monthly financial statements, bank reconciliations, and tax filings (VAT, income tax). Detail-oriented, quick to learn new systems, and comfortable working to deadlines.',
    experience: [
      {
        role: 'Finance Staff',
        company: 'PT Sumber Rezeki Distribusi',
        city: 'Bandung',
        start: '2023-08',
        end: '',
        bullets:
          'Prepare monthly financial statements for 3 branches, on average 2 days ahead of deadline.\nReconcile 6 bank accounts daily with variances below 0.1%.\nRecord VAT and payroll tax using Accurate and the e-Bupot system.',
      },
      {
        role: 'Accounting Intern',
        company: 'KAP Wijaya & Rekan',
        city: 'Bandung',
        start: '2022-07',
        end: '2022-12',
        bullets:
          'Assisted the audit of financial statements for 4 small-business clients.\nPrepared working papers and tested more than 300 transaction records.',
      },
    ],
    education: [
      {
        school: 'Padjadjaran University',
        degree: 'Bachelor of Accounting',
        city: 'Sumedang',
        start: '2018-08',
        end: '2022-10',
        gpa: '3.62 / 4.00',
        notes:
          'Thesis: digital cash records and the accuracy of small-business financial statements',
      },
    ],
    skills: [
      {
        group: 'Accounting',
        list: 'Financial statements, bank reconciliation, VAT, payroll tax, IFRS-based standards',
      },
      {
        group: 'Software',
        list: 'Microsoft Excel (VLOOKUP, PivotTable), Accurate, SAP Business One, Google Sheets',
      },
      { group: 'Other', list: 'Attention to detail, time management, written communication' },
    ],
    certs: [
      { name: 'Tax Certification (Brevet A and B)', issuer: 'IAI', year: '2023' },
      { name: 'Microsoft Office Specialist: Excel Associate', issuer: 'Microsoft', year: '2022' },
    ],
    orgs: [
      {
        role: 'Treasurer',
        org: 'Accounting Students Association',
        city: '',
        start: '2020-03',
        end: '2021-03',
        bullets:
          'Managed an annual activity budget of IDR 120 million with on-time accountability reports.',
      },
    ],
    languages: 'Indonesian (native)\nEnglish (TOEFL ITP 550)',
  },
};

export function cvSample(locale: Locale): DocValues {
  const s = SAMPLE[locale];
  return {
    lang: locale,
    font: 'sans',
    accent: '1f3a5f',
    atsAccent: '1a1a1a',
    photoShape: 'circle',
    name: 'Julian Marcell',
    headline: s.headline,
    city: 'Bandung',
    phone: '0812-3456-7890',
    email: 'julian.marcell@email.com',
    linkedin: 'linkedin.com/in/julianmarcell',
    website: '',
    photo: '',
    summary: s.summary,
    experience: s.experience,
    education: s.education,
    skills: s.skills,
    certs: s.certs,
    orgs: s.orgs,
    languages: s.languages,
  };
}

/** Bagian form CV. `pro` menambah foto dan warna kolom samping. */
export function cvSections(
  locale: Locale,
  pro: boolean,
  accents: { value: string; label: string }[],
): DocSection[] {
  const L = (x: { id: string; en: string }) => x[locale];
  const month = (
    key: string,
    label: { id: string; en: string },
    hint?: { id: string; en: string },
  ): DocField => ({
    key,
    kind: 'month',
    label: L(label),
    hint: hint ? L(hint) : undefined,
  });
  const startEnd = [
    month('start', T('Mulai', 'Start')),
    month(
      'end',
      T('Selesai', 'End'),
      T('Kosongkan bila masih berlangsung.', 'Leave empty if ongoing.'),
    ),
  ];
  const bullets: DocField = {
    key: 'bullets',
    kind: 'textarea',
    label: L(T('Tugas dan pencapaian (satu per baris)', 'Duties and achievements (one per line)')),
    rows: 4,
    span: 2,
    hint: L(
      T(
        'Mulai dengan kata kerja dan sertakan angka, misalnya "Menaikkan penjualan 20%".',
        'Start with a verb and add numbers, for example "Grew sales by 20%".',
      ),
    ),
  };
  const repeat = (r: DocRepeat) => r;
  return [
    {
      id: 'look',
      title: L(T('Tampilan', 'Appearance')),
      items: [
        {
          key: 'lang',
          kind: 'select',
          label: L(T('Bahasa judul bagian', 'Section heading language')),
          options: [
            { value: 'id', label: 'Bahasa Indonesia' },
            { value: 'en', label: 'English' },
          ],
          hint: L(
            T('Isi CV tetap seperti yang kamu tulis.', 'Your content stays as you write it.'),
          ),
        },
        {
          key: 'font',
          kind: 'select',
          label: L(T('Huruf', 'Font')),
          options: [
            { value: 'sans', label: 'Arial / Helvetica' },
            { value: 'serif', label: 'Times New Roman' },
          ],
        },
        {
          key: pro ? 'accent' : 'atsAccent',
          kind: 'swatch',
          label: L(
            pro ? T('Warna kolom samping', 'Sidebar colour') : T('Warna judul', 'Heading colour'),
          ),
          options: accents,
          span: pro ? 1 : 2,
        },
        ...(pro
          ? [
              {
                key: 'photoShape',
                kind: 'select',
                label: L(T('Bentuk foto', 'Photo shape')),
                options: [
                  { value: 'circle', label: L(T('Bulat', 'Circle')) },
                  { value: 'square', label: L(T('Kotak', 'Square')) },
                  { value: 'none', label: L(T('Tanpa foto', 'No photo')) },
                ],
              } as DocField,
            ]
          : []),
      ],
    },
    {
      id: 'me',
      title: L(T('Data diri', 'Personal details')),
      items: [
        ...(pro
          ? [
              {
                key: 'photo',
                kind: 'image',
                image: 'photo',
                label: L(T('Foto (opsional)', 'Photo (optional)')),
                span: 2,
                hint: L(
                  T(
                    'Foto dipotong persegi dari bagian tengah. Pakai foto formal dengan latar polos.',
                    'The photo is cropped square from the centre. Use a formal photo with a plain background.',
                  ),
                ),
              } as DocField,
            ]
          : []),
        { key: 'name', kind: 'text', label: L(T('Nama lengkap', 'Full name')), max: 80 },
        {
          key: 'headline',
          kind: 'text',
          label: L(T('Posisi atau profesi', 'Job title')),
          max: 120,
          placeholder: L(T('Staf Akuntansi', 'Accounting Staff')),
        },
        { key: 'city', kind: 'text', label: L(T('Kota domisili', 'City')), max: 60 },
        { key: 'phone', kind: 'text', label: L(T('Nomor HP', 'Phone')), max: 40 },
        { key: 'email', kind: 'text', label: 'Email', max: 80 },
        {
          key: 'linkedin',
          kind: 'text',
          label: 'LinkedIn',
          max: 120,
          placeholder: 'linkedin.com/in/nama',
        },
        {
          key: 'website',
          kind: 'text',
          label: L(T('Portofolio / situs (opsional)', 'Portfolio / website (optional)')),
          max: 120,
          span: 2,
        },
      ],
    },
    {
      id: 'summary',
      title: L(T('Ringkasan', 'Summary')),
      items: [
        {
          key: 'summary',
          kind: 'textarea',
          label: L(
            T('Ringkasan profil (2 sampai 4 kalimat)', 'Profile summary (2 to 4 sentences)'),
          ),
          rows: 5,
          span: 2,
          max: 1500,
        },
      ],
    },
    {
      id: 'experience',
      title: L(T('Pengalaman kerja', 'Work experience')),
      items: [
        repeat({
          key: 'experience',
          kind: 'repeat',
          label: L(T('Pengalaman', 'Experience')),
          add: L(T('Tambah pengalaman', 'Add experience')),
          title: 'role',
          max: 10,
          hint: L(T('Urutkan dari yang terbaru.', 'List the most recent first.')),
          fields: [
            { key: 'role', kind: 'text', label: L(T('Posisi', 'Job title')), max: 120 },
            { key: 'company', kind: 'text', label: L(T('Perusahaan', 'Company')), max: 120 },
            { key: 'city', kind: 'text', label: L(T('Kota', 'City')), max: 60, span: 2 },
            ...startEnd,
            bullets,
          ],
        }),
      ],
    },
    {
      id: 'education',
      title: L(T('Pendidikan', 'Education')),
      items: [
        repeat({
          key: 'education',
          kind: 'repeat',
          label: L(T('Pendidikan', 'Education')),
          add: L(T('Tambah pendidikan', 'Add education')),
          title: 'school',
          max: 6,
          fields: [
            {
              key: 'school',
              kind: 'text',
              label: L(T('Sekolah / kampus', 'School / university')),
              max: 120,
            },
            {
              key: 'degree',
              kind: 'text',
              label: L(T('Jurusan / gelar', 'Degree / major')),
              max: 120,
            },
            { key: 'city', kind: 'text', label: L(T('Kota', 'City')), max: 60 },
            {
              key: 'gpa',
              kind: 'text',
              label: L(T('IPK / nilai (opsional)', 'GPA (optional)')),
              max: 30,
            },
            ...startEnd,
            {
              key: 'notes',
              kind: 'textarea',
              label: L(
                T(
                  'Catatan (skripsi, prestasi), satu per baris',
                  'Notes (thesis, awards), one per line',
                ),
              ),
              rows: 2,
              span: 2,
            },
          ],
        }),
      ],
    },
    {
      id: 'skills',
      title: L(T('Keahlian', 'Skills')),
      items: [
        repeat({
          key: 'skills',
          kind: 'repeat',
          label: L(T('Kelompok keahlian', 'Skill group')),
          add: L(T('Tambah kelompok', 'Add group')),
          title: 'group',
          max: 8,
          hint: L(
            T(
              'Pakai kata kunci yang sama dengan iklan lowongan agar lolos penyaringan ATS.',
              'Use the same keywords as the job ad so you pass ATS screening.',
            ),
          ),
          fields: [
            {
              key: 'group',
              kind: 'text',
              label: L(T('Kelompok', 'Group')),
              max: 60,
              placeholder: L(T('Perangkat lunak', 'Software')),
            },
            {
              key: 'list',
              kind: 'text',
              label: L(T('Keahlian, pisahkan dengan koma', 'Skills, comma separated')),
              max: 400,
            },
          ],
        }),
      ],
    },
    {
      id: 'certs',
      title: L(T('Sertifikasi', 'Certifications')),
      items: [
        repeat({
          key: 'certs',
          kind: 'repeat',
          label: L(T('Sertifikat', 'Certificate')),
          add: L(T('Tambah sertifikat', 'Add certificate')),
          title: 'name',
          max: 10,
          fields: [
            {
              key: 'name',
              kind: 'text',
              label: L(T('Nama sertifikat', 'Certificate')),
              max: 120,
              span: 2,
            },
            { key: 'issuer', kind: 'text', label: L(T('Penerbit', 'Issuer')), max: 80 },
            { key: 'year', kind: 'text', label: L(T('Tahun', 'Year')), max: 20 },
          ],
        }),
      ],
    },
    {
      id: 'orgs',
      title: L(T('Organisasi & proyek', 'Organizations & projects')),
      items: [
        repeat({
          key: 'orgs',
          kind: 'repeat',
          label: L(T('Kegiatan', 'Activity')),
          add: L(T('Tambah kegiatan', 'Add activity')),
          title: 'role',
          max: 8,
          fields: [
            { key: 'role', kind: 'text', label: L(T('Peran', 'Role')), max: 120 },
            {
              key: 'org',
              kind: 'text',
              label: L(T('Organisasi / proyek', 'Organization / project')),
              max: 120,
            },
            ...startEnd,
            {
              ...bullets,
              label: L(T('Kontribusi (satu per baris)', 'Contributions (one per line)')),
              rows: 3,
              hint: undefined,
            },
          ],
        }),
      ],
    },
    {
      id: 'languages',
      title: L(T('Bahasa', 'Languages')),
      items: [
        {
          key: 'languages',
          kind: 'textarea',
          label: L(T('Bahasa yang dikuasai (satu per baris)', 'Languages (one per line)')),
          rows: 3,
          span: 2,
          max: 400,
        },
      ],
    },
  ];
}

export function cvForm(
  locale: Locale,
  pro: boolean,
  accents: { value: string; label: string }[],
): DocForm {
  return {
    template: pro ? 'cv-pro' : 'cv-ats',
    storage: 'cv',
    fileBase: pro ? 'CV' : 'CV-ATS',
    fileKey: 'name',
    sections: cvSections(locale, pro, accents),
    sample: cvSample(locale),
  };
}
