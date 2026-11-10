/**
 * Template PPT: sidang skripsi, seminar proposal, atau sidang tesis. Slide disusun dari isian:
 * cover, agenda, pendahuluan (dengan slide foto), teori dan model penelitian, metode dan profil
 * responden, hasil (angka, grafik, tabel) atau rencana penelitian (linimasa), lalu penutup.
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
import type { Locale } from '../format';
import { sample } from '../slides/photos';
import type { DeckSpec } from '../slides/model';
import { T, type Tr } from './letter-kit';
import {
  area,
  bars,
  deckFromValues,
  deckSpec,
  imageField,
  list,
  lookFields,
  numberFormat,
  pairs,
  photoField,
  pipeHint,
  rows,
  textField,
} from './ppt-common';

const W = {
  id: {
    sidang: 'Sidang Skripsi',
    sempro: 'Seminar Proposal',
    tesis: 'Sidang Tesis',
    agenda: 'Agenda',
    intro: 'Pendahuluan',
    background: 'Latar Belakang',
    problems: 'Rumusan Masalah',
    problem: 'Rumusan',
    goals: 'Tujuan Penelitian',
    review: 'Tinjauan Pustaka',
    theory: 'Landasan Teori',
    model: 'Model Penelitian',
    method: 'Metode Penelitian',
    methodSub: 'Tahapan penelitian',
    respondents: 'Profil Responden',
    sample: 'Rencana Sampel',
    results: 'Hasil dan Pembahasan',
    findings: 'Temuan Utama',
    scores: 'Rata-rata Skor Variabel',
    table: 'Hasil Uji Hipotesis',
    discussion: 'Pembahasan',
    closing: 'Penutup',
    conclusion: 'Kesimpulan',
    suggestions: 'Saran',
    plan: 'Rencana Penelitian',
    schedule: 'Jadwal Penelitian',
    output: 'Rencana Luaran',
    thanks: 'Terima Kasih',
    thanksSub: 'Mohon kritik dan saran dari Bapak/Ibu dosen penguji.',
    supervisor: 'Pembimbing',
    respondentsTotal: 'responden',
    planHead: ['Kegiatan', 'Waktu', 'Keluaran'],
  },
  en: {
    sidang: 'Thesis Defense',
    sempro: 'Research Proposal',
    tesis: 'Master’s Thesis Defense',
    agenda: 'Agenda',
    intro: 'Introduction',
    background: 'Background',
    problems: 'Research Questions',
    problem: 'Question',
    goals: 'Research Objectives',
    review: 'Literature Review',
    theory: 'Theoretical Framework',
    model: 'Research Model',
    method: 'Research Method',
    methodSub: 'Research stages',
    respondents: 'Respondent Profile',
    sample: 'Sampling Plan',
    results: 'Results and Discussion',
    findings: 'Key Findings',
    scores: 'Average Variable Scores',
    table: 'Hypothesis Tests',
    discussion: 'Discussion',
    closing: 'Closing',
    conclusion: 'Conclusions',
    suggestions: 'Recommendations',
    plan: 'Research Plan',
    schedule: 'Research Schedule',
    output: 'Planned Outputs',
    thanks: 'Thank You',
    thanksSub: 'I welcome your questions and feedback.',
    supervisor: 'Supervisor',
    respondentsTotal: 'respondents',
    planHead: ['Activity', 'Timing', 'Output'],
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const kind = choice(v, 'kind', ['sidang', 'sempro', 'tesis'] as const, 'sidang');
  const w = W[lang];
  const fmt = numberFormat(v);
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
    photo: assets.logo ? undefined : assets.coverPhoto,
  });

  const sections = [
    w.intro,
    w.review,
    w.method,
    proposal ? w.plan : w.results,
    ...(proposal ? [] : [w.closing]),
  ];
  deck.agenda({ title: w.agenda, items: sections });

  // 1. Pendahuluan
  deck.section({ number: 1, title: w.intro, subtitle: text(v, 'introSub', 160) });
  const fact = text(v, 'factValue', 30);
  deck.bullets({
    title: w.background,
    eyebrow: w.intro,
    items: list(v, 'background', 6),
    callout: fact ? { value: fact, text: text(v, 'factText', 200) } : undefined,
  });
  const why = text(v, 'whyText', 200);
  if (why)
    deck.statement({
      eyebrow: w.background,
      text: why,
      sub: text(v, 'whySub', 220),
      image: assets.contextPhoto,
    });
  deck.cards({
    title: w.problems,
    eyebrow: w.intro,
    items: list(v, 'problems', 6).map((x, i) => ({ title: `${w.problem} ${i + 1}`, text: x })),
  });
  deck.bullets({ title: w.goals, eyebrow: w.intro, items: list(v, 'goals', 6) });

  // 2. Tinjauan pustaka
  deck.section({ number: 2, title: w.review });
  deck.cards({ title: w.theory, eyebrow: w.review, items: pairs(v, 'theory', 6) });
  const inputs = list(v, 'variablesX', 5);
  if (inputs.length)
    deck.model({
      title: w.model,
      eyebrow: w.review,
      inputs,
      output: text(v, 'variableY', 80),
      labels: inputs.map((_, i) => `H${i + 1}`),
      note: text(v, 'modelNote', 200),
    });

  // 3. Metode
  deck.section({ number: 3, title: w.method });
  deck.process({ title: w.method, eyebrow: w.methodSub, steps: pairs(v, 'method', 5) });
  const profile = bars(v, 'respondents', 6);
  if (profile.length) {
    const total = profile.reduce((t, x) => t + x.value, 0);
    deck.donut({
      title: proposal ? w.sample : w.respondents,
      eyebrow: w.method,
      items: profile,
      center: { value: fmt(total), label: w.respondentsTotal },
      notes: list(v, 'respondentsNotes', 3),
      format: fmt,
    });
  }

  if (proposal) {
    // 4. Rencana penelitian
    deck.section({ number: 4, title: w.plan });
    const plan = rows(v, 'plan', 6);
    deck.timeline({
      title: w.schedule,
      eyebrow: w.plan,
      items: plan.map(([act = '', when = '', out = '']) => ({ when, title: act, text: out })),
    });
    deck.table({ title: w.output, eyebrow: w.plan, head: w.planHead, rows: plan });
  } else {
    // 4. Hasil dan pembahasan
    deck.section({ number: 4, title: w.results });
    const stats = pairs(v, 'stats', 4).map((x) => ({ value: x.title, label: x.text }));
    if (stats.length)
      deck.stats({
        title: w.findings,
        eyebrow: w.results,
        items: stats,
        note: text(v, 'statsNote', 220),
      });
    const scores = bars(v, 'scores', 8);
    if (scores.length)
      deck.chart({
        title: w.scores,
        eyebrow: w.results,
        bars: scores,
        unit: text(v, 'scoresUnit', 80),
        notes: list(v, 'scoresNotes', 3),
        format: (n) =>
          n.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { maximumFractionDigits: 2 }),
      });
    const head = rows(v, 'tableHead', 1)[0];
    const body = rows(v, 'table', 7);
    if (head?.length && body.length)
      deck.table({ title: w.table, eyebrow: w.results, head, rows: body });
    deck.bullets({ title: w.discussion, eyebrow: w.results, items: list(v, 'discussion', 6) });

    // 5. Penutup
    deck.section({ number: 5, title: w.closing });
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
    introSub: 'Mengapa pemasaran media sosial penting bagi UMKM kuliner?',
    factValue: '64%',
    factText:
      'konsumen muda menemukan tempat makan baru lewat Instagram dan TikTok (survei awal, n = 120).',
    background:
      'UMKM kuliner menyumbang porsi besar usaha di Kota Bandung, tetapi banyak yang belum memanfaatkan media sosial secara terencana.\nKonsumen muda semakin sering mencari rekomendasi makanan lewat Instagram dan TikTok.\nBelum banyak penelitian yang mengukur pengaruh konten, interaksi, dan ulasan terhadap minat beli di tingkat UMKM.',
    whyText:
      'Konten yang tepat bisa mengubah warung kecil menjadi tujuan kuliner yang dicari banyak orang.',
    whySub:
      'Penelitian ini mengukur faktor media sosial mana yang paling berpengaruh bagi UMKM kuliner.',
    problems:
      'Apakah kualitas konten berpengaruh terhadap minat beli?\nApakah interaksi akun dengan pengikut berpengaruh terhadap minat beli?\nApakah ulasan pelanggan di media sosial berpengaruh terhadap minat beli?',
    goals:
      'Mengukur pengaruh kualitas konten terhadap minat beli.\nMengukur pengaruh interaksi akun terhadap minat beli.\nMengukur pengaruh ulasan pelanggan terhadap minat beli.\nMemberi rekomendasi strategi media sosial bagi UMKM kuliner.',
    theory:
      'Pemasaran media sosial | Kegiatan promosi melalui platform sosial untuk membangun hubungan dengan konsumen.\nKualitas konten | Konten yang informatif, menarik, dan konsisten.\nMinat beli | Kecenderungan konsumen untuk membeli setelah terpapar informasi produk.',
    variablesX: 'Kualitas konten (X1)\nInteraksi akun (X2)\nUlasan pelanggan (X3)',
    variableY: 'Minat beli (Y)',
    modelNote: 'H1–H3: setiap variabel berpengaruh positif terhadap minat beli.',
    method:
      'Desain | Penelitian kuantitatif dengan pendekatan survei.\nSampel | 150 responden berusia 18–35 tahun di Kota Bandung.\nInstrumen | Kuesioner skala Likert 1–5, diuji validitas dan reliabilitas.\nAnalisis | Regresi linier berganda dengan SPSS 26.',
    respondents: '18–22 tahun | 54\n23–27 tahun | 61\n28–35 tahun | 35',
    respondentsNotes:
      '62% responden perempuan\nMayoritas membeli makanan online 2–4 kali per minggu',
    stats:
      '0,612 | Koefisien determinasi (R²)\n150 | Responden yang dianalisis\n3 dari 3 | Hipotesis diterima (p < 0,05)',
    statsNote:
      '61,2% variasi minat beli dijelaskan oleh kualitas konten, interaksi, dan ulasan pelanggan.',
    scoresUnit: 'Skala 1–5',
    scores:
      'Kualitas konten | 4,21\nInteraksi akun | 3,86\nUlasan pelanggan | 4,05\nMinat beli | 4,12',
    scoresNotes:
      'Semua variabel berada pada kategori tinggi (> 3,4)\nKualitas konten mendapat skor tertinggi',
    tableHead: 'Hipotesis | Koefisien | t hitung | Sig. | Hasil',
    table:
      'H1: Kualitas konten | 0,384 | 5,21 | 0,000 | Diterima\nH2: Interaksi akun | 0,247 | 3,46 | 0,001 | Diterima\nH3: Ulasan pelanggan | 0,198 | 2,87 | 0,005 | Diterima',
    discussion:
      'Kualitas konten memberi pengaruh paling besar terhadap minat beli.\nInteraksi seperti membalas komentar dan pesan meningkatkan kepercayaan calon pembeli.\nUlasan pelanggan berpengaruh, terutama untuk konsumen yang belum pernah membeli.',
    conclusion:
      'Ketiga variabel berpengaruh positif dan signifikan terhadap minat beli.\nKualitas konten adalah faktor yang paling dominan.',
    suggestions:
      'UMKM perlu menyusun jadwal konten yang konsisten.\nBalas komentar dan pesan secepatnya.\nPenelitian berikutnya dapat menambahkan variabel harga dan lokasi.',
    plan: 'Penyusunan instrumen | Jan 2026 | Kuesioner final\nUji coba kuesioner | Feb 2026 | Hasil uji validitas\nPengumpulan data | Mar 2026 | 150 responden\nAnalisis data | Apr 2026 | Hasil uji regresi\nPenulisan laporan | Mei 2026 | Draf skripsi',
  },
  en: {
    title:
      'The Effect of Social Media Marketing on Purchase Intention for Culinary SMEs in Bandung',
    program: 'Management Study Program',
    university: 'Nusantara Raya University',
    supervisors: 'Dr. Ayudiyah Pratiwi',
    year: 'Bandung, 2026',
    introSub: 'Why social media marketing matters for culinary SMEs',
    factValue: '64%',
    factText:
      'of young consumers discover new places to eat through Instagram and TikTok (pilot survey, n = 120).',
    background:
      'Culinary SMEs make up a large share of businesses in Bandung, yet many do not use social media in a planned way.\nYoung consumers increasingly look for food recommendations on Instagram and TikTok.\nFew studies measure how content, interaction, and reviews affect purchase intention for small businesses.',
    whyText: 'The right content can turn a small food stall into a destination people seek out.',
    whySub: 'This study measures which social media factors matter most for culinary SMEs.',
    problems:
      'Does content quality affect purchase intention?\nDoes account interaction with followers affect purchase intention?\nDo customer reviews on social media affect purchase intention?',
    goals:
      'Measure the effect of content quality on purchase intention.\nMeasure the effect of account interaction on purchase intention.\nMeasure the effect of customer reviews on purchase intention.\nRecommend social media strategies for culinary SMEs.',
    theory:
      'Social media marketing | Promotion through social platforms to build relationships with consumers.\nContent quality | Content that is informative, engaging, and consistent.\nPurchase intention | A consumer’s tendency to buy after seeing product information.',
    variablesX: 'Content quality (X1)\nAccount interaction (X2)\nCustomer reviews (X3)',
    variableY: 'Purchase intention (Y)',
    modelNote: 'H1–H3: each variable has a positive effect on purchase intention.',
    method:
      'Design | Quantitative research using a survey approach.\nSample | 150 respondents aged 18–35 in Bandung.\nInstrument | Five-point Likert questionnaire, tested for validity and reliability.\nAnalysis | Multiple linear regression in SPSS 26.',
    respondents: '18–22 years | 54\n23–27 years | 61\n28–35 years | 35',
    respondentsNotes: '62% of respondents are women\nMost order food online 2–4 times a week',
    stats:
      '0.612 | Coefficient of determination (R²)\n150 | Respondents analysed\n3 of 3 | Hypotheses supported (p < 0.05)',
    statsNote:
      '61.2% of the variation in purchase intention is explained by content quality, interaction, and reviews.',
    scoresUnit: 'Scale of 1–5',
    scores:
      'Content quality | 4.21\nAccount interaction | 3.86\nCustomer reviews | 4.05\nPurchase intention | 4.12',
    scoresNotes: 'All variables fall in the high category (> 3.4)\nContent quality scored highest',
    tableHead: 'Hypothesis | Coefficient | t value | Sig. | Result',
    table:
      'H1: Content quality | 0.384 | 5.21 | 0.000 | Supported\nH2: Account interaction | 0.247 | 3.46 | 0.001 | Supported\nH3: Customer reviews | 0.198 | 2.87 | 0.005 | Supported',
    discussion:
      'Content quality has the strongest effect on purchase intention.\nReplying to comments and messages builds trust with potential buyers.\nCustomer reviews matter most for first-time buyers.',
    conclusion:
      'All three variables have a positive, significant effect on purchase intention.\nContent quality is the dominant factor.',
    suggestions:
      'SMEs should plan a consistent content schedule.\nReply to comments and messages quickly.\nFuture research could add price and location variables.',
    plan: 'Instrument design | Jan 2026 | Final questionnaire\nPilot test | Feb 2026 | Validity results\nData collection | Mar 2026 | 150 respondents\nData analysis | Apr 2026 | Regression results\nReport writing | May 2026 | Thesis draft',
  },
};

export function skripsiForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const A = (key: string, label: Tr, r = 4, hint?: string) => area(locale, key, label, r, hint);
  const F = (key: string, label: Tr, extra = {}) => textField(key, label, locale, extra);
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
          F('name', T('Nama', 'Name'), { max: 80 }),
          F('nim', T('NIM', 'Student ID'), { max: 30 }),
          F('program', T('Program studi', 'Study program')),
          F('university', T('Kampus', 'University')),
          {
            key: 'supervisors',
            kind: 'textarea',
            label: L(T('Pembimbing (satu per baris)', 'Supervisors (one per line)')),
            rows: 2,
            span: 2,
            max: 400,
          },
          F('year', T('Kota dan tahun', 'City and year'), { max: 40 }),
          F('email', T('Email (slide penutup)', 'Email (closing slide)')),
          imageField(
            'logo',
            T(
              'Logo kampus (opsional, menggantikan foto cover)',
              'University logo (optional, replaces the cover photo)',
            ),
            locale,
            'logo',
          ),
          photoField('coverPhoto', T('Foto cover', 'Cover photo'), locale),
        ],
      },
      {
        id: 'intro',
        title: L(T('Pendahuluan', 'Introduction')),
        items: [
          F('introSub', T('Subjudul bab pendahuluan', 'Introduction subtitle'), { span: 2 }),
          A('background', T('Latar belakang', 'Background')),
          F('factValue', T('Angka sorotan (opsional)', 'Highlight figure (optional)'), {
            max: 30,
            placeholder: '64%',
          }),
          F('factText', T('Keterangan angka', 'What the figure means')),
          {
            key: 'whyText',
            kind: 'textarea',
            label: L(T('Kalimat besar di slide foto', 'Big statement on the photo slide')),
            rows: 2,
            span: 2,
            max: 200,
          },
          F('whySub', T('Keterangan di bawahnya', 'Line below it'), { span: 2 }),
          photoField('contextPhoto', T('Foto slide pernyataan', 'Statement slide photo'), locale),
          A('problems', T('Rumusan masalah', 'Research questions'), 3),
          A('goals', T('Tujuan penelitian', 'Objectives'), 3),
        ],
      },
      {
        id: 'method',
        title: L(T('Teori, model, dan metode', 'Theory, model, and method')),
        items: [
          A(
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
          A(
            'variablesX',
            T('Variabel bebas (X), satu per baris', 'Independent variables (X), one per line'),
            3,
          ),
          F('variableY', T('Variabel terikat (Y)', 'Dependent variable (Y)'), { max: 80 }),
          F('modelNote', T('Catatan model / hipotesis', 'Model / hypothesis note')),
          A(
            'method',
            T('Tahapan metode (maksimal 5)', 'Method stages (up to 5)'),
            4,
            pipeHint(locale, L(T('Sampel | 150 responden', 'Sample | 150 respondents'))),
          ),
          A(
            'respondents',
            T(
              'Profil responden / rencana sampel: kelompok | jumlah',
              'Respondent profile / sampling plan: group | count',
            ),
            3,
            '',
          ),
          A('respondentsNotes', T('Catatan di samping diagram', 'Notes beside the chart'), 2),
        ],
      },
      {
        id: 'results',
        title: L(T('Hasil (sidang)', 'Results (defense)')),
        items: [
          A(
            'stats',
            T('Angka utama (maksimal 4)', 'Key figures (up to 4)'),
            3,
            pipeHint(
              locale,
              L(T('0,612 | Koefisien determinasi', '0.612 | Coefficient of determination')),
            ),
          ),
          F('statsNote', T('Catatan di bawah angka', 'Note under the figures'), { span: 2 }),
          F('scoresUnit', T('Satuan grafik skor', 'Score chart unit')),
          A('scores', T('Grafik skor: variabel | angka', 'Score chart: variable | number'), 4, ''),
          A('scoresNotes', T('Catatan di samping grafik', 'Notes beside the chart'), 2),
          F(
            'tableHead',
            T('Judul kolom tabel (pisahkan dengan |)', 'Table headings (separate with |)'),
            { span: 2 },
          ),
          A(
            'table',
            T('Isi tabel (kolom dipisah |)', 'Table rows (columns separated by |)'),
            4,
            '',
          ),
          A('discussion', T('Pembahasan', 'Discussion'), 3),
          A('conclusion', T('Kesimpulan', 'Conclusions'), 3),
          A('suggestions', T('Saran', 'Recommendations'), 3),
        ],
      },
      {
        id: 'plan',
        title: L(T('Rencana penelitian (sempro)', 'Research plan (proposal)')),
        items: [
          A(
            'plan',
            T('Kegiatan | waktu | keluaran (maksimal 6)', 'Activity | timing | output (up to 6)'),
            5,
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
      coverPhoto: sample('study-desk'),
      contextPhoto: sample('library'),
      ...SAMPLE[locale],
    },
  };
}

export const SKRIPSI_FORM = { id: skripsiForm('id'), en: skripsiForm('en') };
