/**
 * Template PPT: pitch deck / proposal bisnis. Masalah, solusi, produk, pasar (TAM/SAM/SOM), model
 * bisnis, traksi, pesaing, strategi, tim, proyeksi, kebutuhan dana, dan penutup.
 */
import { choice, text, type DocAssets, type DocForm, type DocValues } from '../docs/form';
import type { DeckSpec } from '../slides/model';
import type { Locale } from '../format';
import { T, type Tr } from './letter-kit';
import {
  area,
  bars,
  numberFormat,
  deckFromValues,
  deckSpec,
  imageField,
  list,
  lookFields,
  pairs,
  pipeHint,
  rows,
  textField,
} from './ppt-common';

const W = {
  id: {
    eyebrow: 'Pitch Deck',
    problem: 'Masalah',
    solution: 'Solusi Kami',
    product: 'Produk',
    market: 'Peluang Pasar',
    model: 'Model Bisnis',
    traction: 'Traksi',
    competition: 'Pesaing',
    strategy: 'Strategi Pemasaran',
    team: 'Tim Kami',
    ask: 'Kebutuhan Dana',
    useOfFunds: 'Penggunaan dana',
    thanks: 'Mari Bertumbuh Bersama',
    contact: 'Hubungi kami',
    tam: 'Total pasar (TAM)',
    sam: 'Pasar yang dilayani (SAM)',
    som: 'Target realistis (SOM)',
  },
  en: {
    eyebrow: 'Pitch Deck',
    problem: 'The Problem',
    solution: 'Our Solution',
    product: 'Product',
    market: 'Market Opportunity',
    model: 'Business Model',
    traction: 'Traction',
    competition: 'Competition',
    strategy: 'Go-to-Market Strategy',
    team: 'Our Team',
    ask: 'The Ask',
    useOfFunds: 'Use of funds',
    thanks: 'Let’s Grow Together',
    contact: 'Get in touch',
    tam: 'Total market (TAM)',
    sam: 'Serviceable market (SAM)',
    som: 'Obtainable market (SOM)',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const w = W[lang];
  const company = text(v, 'company', 80);
  const deck = deckFromValues(v, [company, text(v, 'tagline', 100)].filter(Boolean).join(' · '));

  deck.cover({
    eyebrow: text(v, 'eyebrow', 60) || w.eyebrow,
    title: company,
    subtitle: text(v, 'tagline', 160),
    meta: [text(v, 'presenter', 80), text(v, 'role', 80), text(v, 'event', 100)],
    logo: assets.logo,
    photo: assets.coverPhoto,
  });
  const stat = text(v, 'problemStat', 30);
  deck.bullets({
    title: w.problem,
    eyebrow: w.problem,
    items: list(v, 'problem', 5),
    callout: stat ? { value: stat, text: text(v, 'problemStatText', 200) } : undefined,
  });
  deck.cards({ title: w.solution, eyebrow: w.solution, items: pairs(v, 'solution', 6) });
  deck.imageText({
    title: text(v, 'productTitle', 120) || w.product,
    eyebrow: w.product,
    text: text(v, 'productText', 600),
    items: list(v, 'productPoints', 5),
    image: assets.productPhoto,
  });
  deck.stats({
    title: w.market,
    eyebrow: w.market,
    items: [
      { value: text(v, 'tam', 30), label: w.tam, note: text(v, 'tamNote', 120) },
      { value: text(v, 'sam', 30), label: w.sam, note: text(v, 'samNote', 120) },
      { value: text(v, 'som', 30), label: w.som, note: text(v, 'somNote', 120) },
    ],
  });
  deck.cards({ title: w.model, eyebrow: w.model, items: pairs(v, 'model', 4) });
  const traction = bars(v, 'traction', 12);
  if (traction.length)
    deck.chart({
      title: text(v, 'tractionTitle', 120) || w.traction,
      eyebrow: w.traction,
      bars: traction,
      format: numberFormat(v),
      unit: text(v, 'tractionUnit', 80),
      notes: list(v, 'tractionNotes', 4),
    });
  const comp = rows(v, 'competition', 6);
  const head = rows(v, 'competitionHead', 1)[0];
  if (head?.length && comp.length)
    deck.table({ title: w.competition, eyebrow: w.competition, head, rows: comp });
  deck.process({ title: w.strategy, eyebrow: w.strategy, steps: pairs(v, 'strategy', 5) });
  const team = pairs(v, 'team', 4).map((x) => ({ name: x.title, role: x.text }));
  if (team.length) deck.team({ title: w.team, eyebrow: w.team, people: team });
  deck.bullets({
    title: w.ask,
    eyebrow: w.ask,
    intro: w.useOfFunds,
    items: list(v, 'funds', 5),
    callout: { value: text(v, 'askAmount', 30), text: text(v, 'askText', 200) },
  });
  deck.closing({
    title: w.thanks,
    subtitle: w.contact,
    lines: [
      text(v, 'presenter', 80),
      text(v, 'email', 80),
      text(v, 'phone', 40),
      text(v, 'website', 80),
    ],
    logo: assets.logo,
  });
  return deckSpec(
    deck,
    v,
    [w.eyebrow, company].filter(Boolean).join(' - '),
    text(v, 'presenter', 80),
  );
}

const SAMPLE: Record<Locale, Record<string, string>> = {
  id: {
    company: 'Kopi Ladang',
    tagline: 'Kopi spesialti langsung dari petani lokal, dikirim segar ke rumah dan kantor.',
    eyebrow: 'Proposal Bisnis 2026',
    role: 'Pendiri & CEO',
    event: 'Demo Day Inkubator Bisnis, Desember 2026',
    problem:
      'Petani kopi hanya menerima sekitar 20% dari harga jual akhir.\nPenikmat kopi sulit menemukan biji segar dengan informasi asal yang jelas.\nKedai kecil membeli dalam jumlah kecil dengan harga tinggi.',
    problemStat: '20%',
    problemStatText:
      'bagian harga yang diterima petani dari secangkir kopi (perkiraan dari wawancara 30 petani).',
    solution:
      'Langsung dari petani | Kami membeli dari kelompok tani dengan harga 35% di atas pasar.\nSangrai sesuai pesanan | Biji disangrai setiap minggu agar tetap segar.\nLangganan fleksibel | Pengiriman mingguan atau bulanan, bisa dijeda kapan saja.',
    productTitle: 'Langganan Kopi Ladang',
    productText:
      'Pelanggan memilih profil rasa, kami memilihkan biji dari kebun yang sedang panen, lalu mengirimnya dalam 48 jam setelah disangrai.',
    productPoints:
      'Kartu cerita kebun di setiap kemasan\nPaket kantor mulai 5 kg per bulan\nAplikasi web untuk mengatur langganan',
    tam: 'Rp 80 T',
    tamNote: 'Pasar kopi Indonesia per tahun',
    sam: 'Rp 6 T',
    samNote: 'Kopi spesialti di kota besar',
    som: 'Rp 30 M',
    somNote: 'Target 3 tahun pertama',
    model:
      'Langganan rumah | Rp 120.000 per bulan, margin kotor 45%.\nPaket kantor | Kontrak bulanan untuk kantor dan coworking.\nGrosir kedai | Pasokan biji untuk kedai kopi kecil.',
    tractionTitle: 'Pendapatan Bulanan',
    tractionUnit: 'Dalam juta rupiah',
    traction: 'Jun | 18\nJul | 26\nAgu | 35\nSep | 47\nOkt | 61\nNov | 78',
    tractionNotes:
      'Tumbuh rata-rata 34% per bulan\n420 pelanggan aktif\nTingkat berhenti langganan 4% per bulan',
    competitionHead: 'Aspek | Kopi Ladang | Kedai biasa | Marketplace',
    competition:
      'Kesegaran biji | Disangrai mingguan | Bervariasi | Tidak jelas\nAsal biji | Kebun tercatat | Jarang | Jarang\nHarga untuk petani | +35% | Harga pasar | Harga pasar\nLangganan | Ya | Tidak | Tidak',
    strategy:
      'Komunitas | Kelas seduh dan cupping bulanan.\nKonten | Cerita petani di Instagram dan TikTok.\nKemitraan | Coworking dan kantor rintisan.\nReferal | Diskon untuk pelanggan yang mengajak teman.',
    team: 'Julian Marcell | Pendiri & CEO, 6 tahun di rantai pasok kopi\nAyudiyah Pratiwi | COO, mengelola operasional dan kemitraan petani',
    askAmount: 'Rp 1,5 M',
    askText: 'untuk 18 bulan menuju titik impas.',
    funds:
      'Mesin sangrai kapasitas 15 kg (40%)\nPemasaran dan komunitas (30%)\nModal kerja pembelian biji (20%)\nPengembangan aplikasi (10%)',
    phone: '0812-3456-7890',
    website: 'kopiladang.id',
  },
  en: {
    company: 'Kopi Ladang',
    tagline: 'Specialty coffee straight from local farmers, delivered fresh to homes and offices.',
    eyebrow: 'Business Proposal 2026',
    role: 'Founder & CEO',
    event: 'Incubator Demo Day, December 2026',
    problem:
      'Coffee farmers receive only about 20% of the final retail price.\nCoffee lovers struggle to find fresh beans with a clear origin.\nSmall cafés buy in small quantities at high prices.',
    problemStat: '20%',
    problemStatText:
      'of the price of a cup goes to the farmer (estimate from interviews with 30 farmers).',
    solution:
      'Direct from farmers | We buy from farmer groups at 35% above market price.\nRoasted to order | Beans are roasted weekly so they stay fresh.\nFlexible subscriptions | Weekly or monthly delivery, pause any time.',
    productTitle: 'Kopi Ladang Subscription',
    productText:
      'Customers choose a flavour profile, we pick beans from the farm currently harvesting, and ship within 48 hours of roasting.',
    productPoints:
      'A farm story card in every pack\nOffice plans from 5 kg a month\nWeb app to manage subscriptions',
    tam: 'IDR 80T',
    tamNote: 'Indonesian coffee market per year',
    sam: 'IDR 6T',
    samNote: 'Specialty coffee in large cities',
    som: 'IDR 30B',
    somNote: 'Target for the first 3 years',
    model:
      'Home subscription | IDR 120,000 a month, 45% gross margin.\nOffice plans | Monthly contracts for offices and coworking spaces.\nCafé wholesale | Bean supply for small cafés.',
    tractionTitle: 'Monthly Revenue',
    tractionUnit: 'IDR million',
    traction: 'Jun | 18\nJul | 26\nAug | 35\nSep | 47\nOct | 61\nNov | 78',
    tractionNotes: 'Average growth of 34% a month\n420 active customers\n4% monthly churn',
    competitionHead: 'Aspect | Kopi Ladang | Regular café | Marketplace',
    competition:
      'Bean freshness | Roasted weekly | Varies | Unclear\nOrigin | Recorded farm | Rarely | Rarely\nFarmer price | +35% | Market price | Market price\nSubscription | Yes | No | No',
    strategy:
      'Community | Monthly brewing and cupping classes.\nContent | Farmer stories on Instagram and TikTok.\nPartnerships | Coworking spaces and startups.\nReferrals | Discounts for customers who invite friends.',
    team: 'Julian Marcell | Founder & CEO, 6 years in the coffee supply chain\nAyudiyah Pratiwi | COO, runs operations and farmer partnerships',
    askAmount: 'IDR 1.5B',
    askText: 'to reach break-even within 18 months.',
    funds:
      '15 kg roasting machine (40%)\nMarketing and community (30%)\nWorking capital for beans (20%)\nApp development (10%)',
    phone: '+62 812-3456-7890',
    website: 'kopiladang.id',
  },
};

export function pitchForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const A = (key: string, label: Tr, r = 4, hint?: string) => area(locale, key, label, r, hint);
  const F = (key: string, label: Tr, extra = {}) => textField(key, label, locale, extra);
  return {
    template: 'ppt-pitch',
    output: 'deck',
    storage: 'ppt-pitch',
    fileBase: 'Pitch-Deck',
    fileKey: 'company',
    sections: [
      { id: 'look', title: L(T('Tampilan', 'Look')), items: lookFields(locale) },
      {
        id: 'cover',
        title: L(T('Cover', 'Cover')),
        items: [
          F('company', T('Nama usaha', 'Company name'), { max: 80 }),
          F('eyebrow', T('Label kecil di atas judul', 'Small label above the title'), { max: 60 }),
          {
            key: 'tagline',
            kind: 'textarea',
            label: L(
              T(
                'Tagline / satu kalimat tentang usaha',
                'Tagline / one sentence about the business',
              ),
            ),
            rows: 2,
            span: 2,
            max: 160,
          },
          F('presenter', T('Nama presenter', 'Presenter')),
          F('role', T('Jabatan', 'Role')),
          F('event', T('Acara / tanggal', 'Event / date'), { span: 2 }),
          imageField('logo', T('Logo (opsional)', 'Logo (optional)'), locale, 'logo'),
          imageField('coverPhoto', T('Foto cover (opsional)', 'Cover photo (optional)'), locale),
        ],
      },
      {
        id: 'problem',
        title: L(T('Masalah dan solusi', 'Problem and solution')),
        items: [
          A('problem', T('Masalah yang diselesaikan', 'Problem'), 3),
          F('problemStat', T('Angka sorotan masalah', 'Problem highlight figure'), { max: 30 }),
          F('problemStatText', T('Keterangan angka', 'What the figure means')),
          A(
            'solution',
            T('Solusi (maksimal 6)', 'Solution (up to 6)'),
            4,
            pipeHint(
              locale,
              L(
                T(
                  'Langganan fleksibel | Bisa dijeda kapan saja',
                  'Flexible plans | Pause any time',
                ),
              ),
            ),
          ),
          F('productTitle', T('Nama produk', 'Product name'), { span: 2 }),
          {
            key: 'productText',
            kind: 'textarea',
            label: L(T('Penjelasan produk', 'Product description')),
            rows: 3,
            span: 2,
            max: 600,
          },
          A('productPoints', T('Keunggulan produk', 'Product highlights'), 3),
          imageField(
            'productPhoto',
            T('Foto produk (opsional)', 'Product photo (optional)'),
            locale,
          ),
        ],
      },
      {
        id: 'market',
        title: L(T('Pasar dan model bisnis', 'Market and business model')),
        items: [
          F('tam', T('TAM', 'TAM'), { max: 30 }),
          F('tamNote', T('Keterangan TAM', 'TAM note')),
          F('sam', T('SAM', 'SAM'), { max: 30 }),
          F('samNote', T('Keterangan SAM', 'SAM note')),
          F('som', T('SOM', 'SOM'), { max: 30 }),
          F('somNote', T('Keterangan SOM', 'SOM note')),
          A(
            'model',
            T('Sumber pendapatan (maksimal 4)', 'Revenue streams (up to 4)'),
            3,
            pipeHint(
              locale,
              L(T('Langganan | Rp 120.000 per bulan', 'Subscription | IDR 120,000 a month')),
            ),
          ),
        ],
      },
      {
        id: 'traction',
        title: L(T('Traksi dan pesaing', 'Traction and competition')),
        items: [
          F('tractionTitle', T('Judul grafik', 'Chart title')),
          F('tractionUnit', T('Satuan grafik', 'Chart unit')),
          A('traction', T('Data grafik: label | angka', 'Chart data: label | number'), 4, ''),
          A('tractionNotes', T('Catatan di samping grafik', 'Notes beside the chart'), 3),
          F(
            'competitionHead',
            T('Judul kolom perbandingan (pisahkan |)', 'Comparison headings (separate with |)'),
            { span: 2 },
          ),
          A(
            'competition',
            T('Isi perbandingan (kolom dipisah |)', 'Comparison rows (columns separated by |)'),
            4,
            '',
          ),
        ],
      },
      {
        id: 'team',
        title: L(T('Strategi, tim, dan dana', 'Strategy, team, and funding')),
        items: [
          A(
            'strategy',
            T('Strategi (maksimal 5 tahap)', 'Strategy (up to 5 stages)'),
            4,
            pipeHint(
              locale,
              L(T('Komunitas | Kelas seduh bulanan', 'Community | Monthly classes')),
            ),
          ),
          A('team', T('Tim (maksimal 4): nama | peran', 'Team (up to 4): name | role'), 3, ''),
          F('askAmount', T('Jumlah dana yang dicari', 'Amount sought'), { max: 30 }),
          F('askText', T('Keterangan dana', 'Funding note')),
          A('funds', T('Penggunaan dana', 'Use of funds'), 4),
          F('email', T('Email', 'Email')),
          F('phone', T('Telepon', 'Phone'), { max: 40 }),
          F('website', T('Situs / Instagram', 'Website / Instagram'), { span: 2 }),
        ],
      },
    ],
    sample: {
      lang: locale,
      style: 'gradient',
      font: 'sans',
      palette: '9a3f24',
      presenter: 'Julian Marcell',
      email: 'julian.marcell@email.com',
      logo: '',
      coverPhoto: '',
      productPhoto: '',
      ...SAMPLE[locale],
    },
  };
}

export const PITCH_FORM = { id: pitchForm('id'), en: pitchForm('en') };
