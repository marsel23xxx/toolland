/**
 * Template PPT: sidang skripsi atau seminar proposal. Slide disusun dari isian: cover, agenda,
 * pendahuluan, tinjauan pustaka, metode, hasil (sidang), kesimpulan dan saran, lalu penutup.
 */
import {
  choice,
  lines,
  longText,
  text,
  type DocAssets,
  type DocForm,
  type DocValues,
} from '../docs/form';
import type { DeckSpec } from '../slides/model';
import type { Locale } from '../format';
import { T, type Tr } from './letter-kit';
import { deckFromValues, deckSpec, list, lookFields, pairs, pipeHint, rows } from './ppt-common';

const W = {
  id: {
    sidang: 'Sidang Skripsi',
    sempro: 'Seminar Proposal',
    tesis: 'Sidang Tesis',
    agenda: 'Agenda',
    intro: 'Pendahuluan',
    background: 'Latar Belakang',
    problems: 'Rumusan Masalah',
    goals: 'Tujuan Penelitian',
    review: 'Tinjauan Pustaka',
    theory: 'Landasan Teori',
    method: 'Metode Penelitian',
    methodSub: 'Tahapan penelitian',
    results: 'Hasil dan Pembahasan',
    findings: 'Temuan Utama',
    table: 'Hasil Pengujian',
    closing: 'Penutup',
    conclusion: 'Kesimpulan',
    suggestions: 'Saran',
    plan: 'Rencana Penelitian',
    thanks: 'Terima Kasih',
    thanksSub: 'Mohon kritik dan saran dari Bapak/Ibu dosen penguji.',
    supervisor: 'Pembimbing',
  },
  en: {
    sidang: 'Thesis Defense',
    sempro: 'Research Proposal',
    tesis: 'Master’s Thesis Defense',
    agenda: 'Agenda',
    intro: 'Introduction',
    background: 'Background',
    problems: 'Research Questions',
    goals: 'Research Objectives',
    review: 'Literature Review',
    theory: 'Theoretical Framework',
    method: 'Research Method',
    methodSub: 'Research stages',
    results: 'Results and Discussion',
    findings: 'Key Findings',
    table: 'Test Results',
    closing: 'Closing',
    conclusion: 'Conclusions',
    suggestions: 'Recommendations',
    plan: 'Research Plan',
    thanks: 'Thank You',
    thanksSub: 'I welcome your questions and feedback.',
    supervisor: 'Supervisor',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const kind = choice(v, 'kind', ['sidang', 'sempro', 'tesis'] as const, 'sidang');
  const w = W[lang];
  const title = text(v, 'title', 250);
  const name = text(v, 'name', 80);
  const proposal = kind === 'sempro';
  const deck = deckFromValues(v, `${name}${name && title ? ' · ' : ''}${title}`.slice(0, 110));
  const supervisors = lines(longText(v, 'supervisors', 400), 3);

  deck.cover({
    eyebrow: w[kind],
    title,
    subtitle: [text(v, 'program', 120), text(v, 'university', 120)].filter(Boolean).join(' · '),
    meta: [
      [name, text(v, 'nim', 30)].filter(Boolean).join(' · '),
      ...supervisors.map(
        (s, i) => `${w.supervisor}${supervisors.length > 1 ? ` ${i + 1}` : ''}: ${s}`,
      ),
      text(v, 'year', 40),
    ],
    logo: assets.logo,
  });

  const sections = [
    w.intro,
    w.review,
    w.method,
    ...(proposal ? [w.plan] : [w.results]),
    ...(proposal ? [] : [w.closing]),
  ];
  deck.agenda({ title: w.agenda, items: sections });

  let s = 0;
  deck.section({ number: ++s, title: w.intro });
  const fact = text(v, 'factValue', 30);
  deck.bullets({
    title: w.background,
    eyebrow: w.intro,
    items: list(v, 'background', 6),
    callout: fact ? { value: fact, text: text(v, 'factText', 200) } : undefined,
  });
  deck.cards({
    title: w.problems,
    eyebrow: w.intro,
    items: list(v, 'problems', 6).map((x, i) => ({
      title: `${lang === 'id' ? 'Rumusan' : 'Question'} ${i + 1}`,
      text: x,
    })),
  });
  deck.bullets({ title: w.goals, eyebrow: w.intro, items: list(v, 'goals', 6) });

  deck.section({ number: ++s, title: w.review });
  deck.cards({ title: w.theory, eyebrow: w.review, items: pairs(v, 'theory', 6) });

  deck.section({ number: ++s, title: w.method });
  deck.process({ title: w.method, eyebrow: w.methodSub, steps: pairs(v, 'method', 5) });

  if (proposal) {
    deck.section({ number: s + 1, title: w.plan });
    deck.table({
      title: w.plan,
      eyebrow: w.plan,
      head: lang === 'id' ? ['Kegiatan', 'Waktu', 'Keluaran'] : ['Activity', 'Timing', 'Output'],
      rows: rows(v, 'plan', 7),
    });
  } else {
    deck.section({ number: s + 1, title: w.results });
    const stats = pairs(v, 'stats', 4).map((x) => ({ value: x.title, label: x.text }));
    if (stats.length)
      deck.stats({
        title: w.findings,
        eyebrow: w.results,
        items: stats,
        note: text(v, 'statsNote', 220),
      });
    const head = rows(v, 'tableHead', 1)[0];
    const body = rows(v, 'table', 7);
    if (head?.length && body.length)
      deck.table({ title: w.table, eyebrow: w.results, head, rows: body });
    deck.bullets({ title: w.results, eyebrow: w.results, items: list(v, 'discussion', 6) });
    deck.section({ number: s + 2, title: w.closing });
    deck.twoCol({
      title: `${w.conclusion} & ${w.suggestions}`,
      eyebrow: w.closing,
      left: { head: w.conclusion, items: list(v, 'conclusion', 6) },
      right: { head: w.suggestions, items: list(v, 'suggestions', 6) },
    });
  }

  deck.closing({
    title: w.thanks,
    subtitle: w.thanksSub,
    lines: [name, text(v, 'email', 80), text(v, 'university', 120)],
    logo: assets.logo,
  });
  return deckSpec(deck, v, [w[kind], title].filter(Boolean).join(' - '), name);
}

const SAMPLE: Record<Locale, Record<string, string>> = {
  id: {
    title:
      'Pengaruh Pemasaran Media Sosial terhadap Minat Beli Produk UMKM Kuliner di Kota Bandung',
    program: 'Program Studi Manajemen',
    university: 'Universitas Nusantara Raya',
    supervisors: 'Dr. Ayudiyah Pratiwi, S.E., M.M.',
    year: 'Bandung, 2026',
    factValue: '64%',
    factText:
      'konsumen muda menemukan tempat makan baru lewat Instagram dan TikTok (survei awal, n = 120).',
    background:
      'UMKM kuliner menyumbang porsi besar usaha di Kota Bandung, tetapi banyak yang belum memanfaatkan media sosial secara terencana.\nKonsumen muda semakin sering mencari rekomendasi makanan lewat Instagram dan TikTok.\nBelum banyak penelitian yang mengukur pengaruh konten, interaksi, dan ulasan terhadap minat beli di tingkat UMKM.',
    problems:
      'Apakah kualitas konten berpengaruh terhadap minat beli?\nApakah interaksi akun dengan pengikut berpengaruh terhadap minat beli?\nApakah ulasan pelanggan di media sosial berpengaruh terhadap minat beli?',
    goals:
      'Mengukur pengaruh kualitas konten terhadap minat beli.\nMengukur pengaruh interaksi akun terhadap minat beli.\nMengukur pengaruh ulasan pelanggan terhadap minat beli.\nMemberi rekomendasi strategi media sosial bagi UMKM kuliner.',
    theory:
      'Pemasaran media sosial | Kegiatan promosi melalui platform sosial untuk membangun hubungan dengan konsumen.\nKualitas konten | Konten yang informatif, menarik, dan konsisten.\nMinat beli | Kecenderungan konsumen untuk membeli setelah terpapar informasi produk.',
    method:
      'Desain | Penelitian kuantitatif dengan pendekatan survei.\nSampel | 150 responden berusia 18–35 tahun di Kota Bandung.\nInstrumen | Kuesioner skala Likert 1–5, diuji validitas dan reliabilitas.\nAnalisis | Regresi linier berganda dengan SPSS 26.',
    stats:
      '0,612 | Koefisien determinasi (R²)\n150 | Responden yang dianalisis\n3 dari 3 | Hipotesis diterima (p < 0,05)',
    statsNote:
      '61,2% variasi minat beli dijelaskan oleh kualitas konten, interaksi, dan ulasan pelanggan.',
    tableHead: 'Variabel | Koefisien | t hitung | Sig.',
    table:
      'Kualitas konten | 0,384 | 5,21 | 0,000\nInteraksi akun | 0,247 | 3,46 | 0,001\nUlasan pelanggan | 0,198 | 2,87 | 0,005',
    discussion:
      'Kualitas konten memberi pengaruh paling besar terhadap minat beli.\nInteraksi seperti membalas komentar dan pesan meningkatkan kepercayaan calon pembeli.\nUlasan pelanggan berpengaruh, terutama untuk konsumen yang belum pernah membeli.',
    conclusion:
      'Ketiga variabel berpengaruh positif dan signifikan terhadap minat beli.\nKualitas konten adalah faktor yang paling dominan.',
    suggestions:
      'UMKM perlu menyusun jadwal konten yang konsisten.\nBalas komentar dan pesan secepatnya.\nPenelitian berikutnya dapat menambahkan variabel harga dan lokasi.',
    plan: 'Penyusunan instrumen | Januari 2026 | Kuesioner final\nPengumpulan data | Februari–Maret 2026 | 150 responden\nAnalisis data | April 2026 | Hasil uji regresi\nPenulisan laporan | Mei 2026 | Draf skripsi',
  },
  en: {
    title:
      'The Effect of Social Media Marketing on Purchase Intention for Culinary SMEs in Bandung',
    program: 'Management Study Program',
    university: 'Nusantara Raya University',
    supervisors: 'Dr. Ayudiyah Pratiwi',
    year: 'Bandung, 2026',
    factValue: '64%',
    factText:
      'of young consumers discover new places to eat through Instagram and TikTok (pilot survey, n = 120).',
    background:
      'Culinary SMEs make up a large share of businesses in Bandung, yet many do not use social media in a planned way.\nYoung consumers increasingly look for food recommendations on Instagram and TikTok.\nFew studies measure how content, interaction, and reviews affect purchase intention for small businesses.',
    problems:
      'Does content quality affect purchase intention?\nDoes account interaction with followers affect purchase intention?\nDo customer reviews on social media affect purchase intention?',
    goals:
      'Measure the effect of content quality on purchase intention.\nMeasure the effect of account interaction on purchase intention.\nMeasure the effect of customer reviews on purchase intention.\nRecommend social media strategies for culinary SMEs.',
    theory:
      'Social media marketing | Promotion through social platforms to build relationships with consumers.\nContent quality | Content that is informative, engaging, and consistent.\nPurchase intention | A consumer’s tendency to buy after seeing product information.',
    method:
      'Design | Quantitative research using a survey approach.\nSample | 150 respondents aged 18–35 in Bandung.\nInstrument | Five-point Likert questionnaire, tested for validity and reliability.\nAnalysis | Multiple linear regression in SPSS 26.',
    stats:
      '0.612 | Coefficient of determination (R²)\n150 | Respondents analysed\n3 of 3 | Hypotheses supported (p < 0.05)',
    statsNote:
      '61.2% of the variation in purchase intention is explained by content quality, interaction, and reviews.',
    tableHead: 'Variable | Coefficient | t value | Sig.',
    table:
      'Content quality | 0.384 | 5.21 | 0.000\nAccount interaction | 0.247 | 3.46 | 0.001\nCustomer reviews | 0.198 | 2.87 | 0.005',
    discussion:
      'Content quality has the strongest effect on purchase intention.\nReplying to comments and messages builds trust with potential buyers.\nCustomer reviews matter most for first-time buyers.',
    conclusion:
      'All three variables have a positive, significant effect on purchase intention.\nContent quality is the dominant factor.',
    suggestions:
      'SMEs should plan a consistent content schedule.\nReply to comments and messages quickly.\nFuture research could add price and location variables.',
    plan: 'Instrument design | January 2026 | Final questionnaire\nData collection | February–March 2026 | 150 respondents\nData analysis | April 2026 | Regression results\nReport writing | May 2026 | Thesis draft',
  },
};

export function skripsiForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const s = SAMPLE[locale];
  const area = (key: string, label: Tr, rows = 4, hint?: string) => ({
    key,
    kind: 'textarea' as const,
    label: L(label),
    rows,
    span: 2 as const,
    max: 3000,
    hint: hint ?? L(T('Satu poin per baris.', 'One point per line.')),
  });
  return {
    template: 'ppt-skripsi',
    output: 'deck',
    storage: 'ppt-skripsi',
    fileBase: L(T('PPT-Sidang', 'Thesis-Slides')),
    fileKey: 'name',
    sections: [
      {
        id: 'look',
        title: L(T('Jenis dan tampilan', 'Type and look')),
        items: [
          {
            key: 'kind',
            kind: 'select',
            label: L(T('Jenis presentasi', 'Presentation type')),
            options: [
              { value: 'sidang', label: L(T('Sidang skripsi', 'Thesis defense')) },
              { value: 'sempro', label: L(T('Seminar proposal', 'Research proposal')) },
              { value: 'tesis', label: L(T('Sidang tesis', 'Master’s thesis defense')) },
            ],
          },
          ...lookFields(locale),
        ],
      },
      {
        id: 'id',
        title: L(T('Identitas', 'Details')),
        items: [
          {
            key: 'title',
            kind: 'textarea',
            label: L(T('Judul penelitian', 'Research title')),
            rows: 2,
            span: 2,
            max: 250,
          },
          { key: 'name', kind: 'text', label: L(T('Nama', 'Name')), max: 80 },
          { key: 'nim', kind: 'text', label: L(T('NIM', 'Student ID')), max: 30 },
          { key: 'program', kind: 'text', label: L(T('Program studi', 'Study program')), max: 120 },
          { key: 'university', kind: 'text', label: L(T('Kampus', 'University')), max: 120 },
          {
            key: 'supervisors',
            kind: 'textarea',
            label: L(T('Pembimbing (satu per baris)', 'Supervisors (one per line)')),
            rows: 2,
            span: 2,
            max: 400,
          },
          { key: 'year', kind: 'text', label: L(T('Kota dan tahun', 'City and year')), max: 40 },
          {
            key: 'email',
            kind: 'text',
            label: L(T('Email (slide penutup)', 'Email (closing slide)')),
            max: 80,
          },
          {
            key: 'logo',
            kind: 'image',
            image: 'logo',
            label: L(T('Logo kampus (opsional)', 'University logo (optional)')),
            span: 2,
          },
        ],
      },
      {
        id: 'intro',
        title: L(T('Pendahuluan', 'Introduction')),
        items: [
          area('background', T('Latar belakang', 'Background')),
          {
            key: 'factValue',
            kind: 'text',
            label: L(T('Angka sorotan (opsional)', 'Highlight figure (optional)')),
            max: 30,
            placeholder: '64%',
          },
          {
            key: 'factText',
            kind: 'text',
            label: L(T('Keterangan angka', 'What the figure means')),
            max: 200,
          },
          area('problems', T('Rumusan masalah', 'Research questions'), 3),
          area('goals', T('Tujuan penelitian', 'Objectives'), 3),
        ],
      },
      {
        id: 'method',
        title: L(T('Teori dan metode', 'Theory and method')),
        items: [
          area(
            'theory',
            T('Landasan teori', 'Theoretical framework'),
            4,
            pipeHint(
              locale,
              L(
                T(
                  'Minat beli | Kecenderungan konsumen untuk membeli',
                  'Purchase intention | A consumer’s tendency to buy',
                ),
              ),
            ),
          ),
          area(
            'method',
            T('Tahapan metode (maksimal 5)', 'Method stages (up to 5)'),
            4,
            pipeHint(locale, L(T('Sampel | 150 responden', 'Sample | 150 respondents'))),
          ),
        ],
      },
      {
        id: 'results',
        title: L(T('Hasil (sidang) atau rencana (sempro)', 'Results (defense) or plan (proposal)')),
        items: [
          area(
            'stats',
            T('Angka utama (maksimal 4)', 'Key figures (up to 4)'),
            3,
            pipeHint(
              locale,
              L(T('0,612 | Koefisien determinasi', '0.612 | Coefficient of determination')),
            ),
          ),
          {
            key: 'statsNote',
            kind: 'text',
            label: L(T('Catatan di bawah angka', 'Note under the figures')),
            max: 220,
            span: 2,
          },
          {
            key: 'tableHead',
            kind: 'text',
            label: L(
              T('Judul kolom tabel (pisahkan dengan |)', 'Table headings (separate with |)'),
            ),
            max: 200,
            span: 2,
          },
          area(
            'table',
            T(
              'Isi tabel (satu baris per baris, kolom dipisah |)',
              'Table rows (columns separated by |)',
            ),
            4,
            '',
          ),
          area('discussion', T('Pembahasan', 'Discussion'), 3),
          area('conclusion', T('Kesimpulan', 'Conclusions'), 3),
          area('suggestions', T('Saran', 'Recommendations'), 3),
          area(
            'plan',
            T(
              'Rencana penelitian (sempro): kegiatan | waktu | keluaran',
              'Research plan (proposal): activity | timing | output',
            ),
            4,
            '',
          ),
        ],
      },
    ],
    sample: {
      lang: locale,
      kind: 'sidang',
      style: 'geo',
      font: 'sans',
      palette: '1f3a5f',
      name: 'Julian Marcell',
      nim: '1201220045',
      email: 'julian.marcell@email.com',
      logo: '',
      ...s,
    },
  };
}

export const SKRIPSI_FORM = { id: skripsiForm('id'), en: skripsiForm('en') };
