/**
 * Template PPT: pitch deck / proposal bisnis (17 slide). Masalah, pernyataan berfoto, solusi,
 * produk, cara kerja, pasar (TAM/SAM/SOM), paket harga, traksi, segmen pelanggan, pesaing,
 * roadmap, tim, proyeksi, kebutuhan dana, testimoni, dan penutup.
 */
import { choice, text, type DocAssets, type DocForm, type DocValues } from '../docs/form';
import type { Locale } from '../format';
import type { DeckSpec } from '../slides/model';
import { sample } from '../slides/photos';
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
  plans,
  rows,
  textField,
  timelineItems,
} from './ppt-common';

const W = {
  id: {
    eyebrow: 'Pitch Deck',
    problem: 'Masalah',
    why: 'Mengapa Sekarang',
    solution: 'Solusi Kami',
    product: 'Produk',
    how: 'Cara Kerjanya',
    market: 'Peluang Pasar',
    pricing: 'Model Bisnis & Harga',
    traction: 'Traksi',
    customers: 'Segmen Pelanggan',
    competition: 'Pesaing',
    roadmap: 'Roadmap',
    team: 'Tim Kami',
    projection: 'Proyeksi Pendapatan',
    ask: 'Kebutuhan Dana',
    useOfFunds: 'Penggunaan dana',
    voice: 'Kata Pelanggan',
    thanks: 'Mari Bertumbuh Bersama',
    contact: 'Hubungi kami',
    tam: 'Total pasar (TAM)',
    sam: 'Pasar yang dilayani (SAM)',
    som: 'Target realistis (SOM)',
    customersTotal: 'pelanggan',
  },
  en: {
    eyebrow: 'Pitch Deck',
    problem: 'The Problem',
    why: 'Why Now',
    solution: 'Our Solution',
    product: 'Product',
    how: 'How It Works',
    market: 'Market Opportunity',
    pricing: 'Business Model & Pricing',
    traction: 'Traction',
    customers: 'Customer Segments',
    competition: 'Competition',
    roadmap: 'Roadmap',
    team: 'Our Team',
    projection: 'Revenue Projection',
    ask: 'The Ask',
    useOfFunds: 'Use of funds',
    voice: 'What Customers Say',
    thanks: 'Let’s Grow Together',
    contact: 'Get in touch',
    tam: 'Total market (TAM)',
    sam: 'Serviceable market (SAM)',
    som: 'Obtainable market (SOM)',
    customersTotal: 'customers',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const w = W[lang];
  const fmt = numberFormat(v);
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
  const why = text(v, 'whyText', 200);
  if (why)
    deck.statement({
      eyebrow: w.why,
      text: why,
      sub: text(v, 'whySub', 220),
      image: assets.whyPhoto,
    });
  deck.cards({ title: w.solution, eyebrow: w.solution, items: pairs(v, 'solution', 6) });
  deck.imageText({
    title: text(v, 'productTitle', 120) || w.product,
    eyebrow: w.product,
    text: text(v, 'productText', 600),
    items: list(v, 'productPoints', 5),
    image: assets.productPhoto,
  });
  deck.process({ title: w.how, eyebrow: w.product, steps: pairs(v, 'how', 5) });
  deck.circles({
    title: w.market,
    eyebrow: w.market,
    items: [
      { value: text(v, 'tam', 30), label: w.tam, note: text(v, 'tamNote', 120) },
      { value: text(v, 'sam', 30), label: w.sam, note: text(v, 'samNote', 120) },
      { value: text(v, 'som', 30), label: w.som, note: text(v, 'somNote', 120) },
    ],
  });
  const pricing = plans(v, 'plans', 3);
  if (pricing.length) deck.pricing({ title: w.pricing, eyebrow: w.pricing, plans: pricing });
  const traction = bars(v, 'traction', 12);
  if (traction.length)
    deck.lineChart({
      title: text(v, 'tractionTitle', 120) || w.traction,
      eyebrow: w.traction,
      points: traction,
      unit: text(v, 'tractionUnit', 80),
      notes: list(v, 'tractionNotes', 4),
      format: fmt,
    });
  const segments = bars(v, 'segments', 6);
  if (segments.length) {
    const total = segments.reduce((t, x) => t + x.value, 0);
    deck.donut({
      title: w.customers,
      eyebrow: w.traction,
      items: segments,
      center: { value: fmt(total), label: w.customersTotal },
      format: fmt,
    });
  }
  const comp = rows(v, 'competition', 6);
  const head = rows(v, 'competitionHead', 1)[0];
  if (head?.length && comp.length)
    deck.table({ title: w.competition, eyebrow: w.competition, head, rows: comp });
  const roadmap = timelineItems(v, 'roadmap', 6);
  if (roadmap.length) deck.timeline({ title: w.roadmap, eyebrow: w.roadmap, items: roadmap });
  const team = pairs(v, 'team', 4).map((x) => ({ name: x.title, role: x.text }));
  if (team.length) deck.team({ title: w.team, eyebrow: w.team, people: team });
  const projection = bars(v, 'projection', 8);
  if (projection.length)
    deck.chart({
      title: w.projection,
      eyebrow: w.projection,
      bars: projection,
      unit: text(v, 'projectionUnit', 80),
      notes: list(v, 'projectionNotes', 3),
      format: fmt,
    });
  const funds = bars(v, 'funds', 6);
  deck.donut({
    title: w.ask,
    eyebrow: w.useOfFunds,
    items: funds,
    center: { value: text(v, 'askAmount', 30), label: text(v, 'askText', 60) },
    notes: list(v, 'askNotes', 3),
    format: () => '',
  });
  const quote = text(v, 'testimonial', 300);
  if (quote)
    deck.quote({
      eyebrow: w.voice,
      text: quote,
      by: text(v, 'testimonialBy', 120),
      photo: assets.testimonialPhoto,
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
    whyText: 'Petani menanam kopi terbaik, tetapi menerima bagian paling kecil dari harganya.',
    whySub:
      'Konsumsi kopi spesialti terus naik, dan pembeli makin peduli dari mana kopinya berasal.',
    solution:
      'Langsung dari petani | Kami membeli dari kelompok tani dengan harga 35% di atas pasar.\nSangrai sesuai pesanan | Biji disangrai setiap minggu agar tetap segar.\nLangganan fleksibel | Pengiriman mingguan atau bulanan, bisa dijeda kapan saja.',
    productTitle: 'Langganan Kopi Ladang',
    productText:
      'Pelanggan memilih profil rasa, kami memilihkan biji dari kebun yang sedang panen, lalu mengirimnya dalam 48 jam setelah disangrai.',
    productPoints:
      'Kartu cerita kebun di setiap kemasan\nPaket kantor mulai 5 kg per bulan\nAplikasi web untuk mengatur langganan',
    how: 'Pilih rasa | Pelanggan memilih profil rasa di aplikasi.\nKurasi biji | Kami memilih biji dari kebun yang sedang panen.\nSangrai | Biji disangrai setiap Senin di Bandung.\nKirim | Sampai di rumah dalam 48 jam.',
    tam: 'Rp 80 T',
    tamNote: 'Pasar kopi Indonesia per tahun',
    sam: 'Rp 6 T',
    samNote: 'Kopi spesialti di kota besar',
    som: 'Rp 30 M',
    somNote: 'Target 3 tahun pertama',
    plans:
      'Rumahan | Rp 120 rb | per bulan, 500 g | 2 kali kirim; Pilih profil rasa; Jeda kapan saja\nKantor | Rp 900 rb | per bulan, 5 kg | Kirim mingguan; Alat seduh dipinjamkan; Kelas seduh gratis\nKedai | Rp 160 rb | per kg | Minimal 10 kg; Harga grosir; Pendampingan resep',
    tractionTitle: 'Pendapatan Bulanan',
    tractionUnit: 'Dalam juta rupiah',
    traction: 'Jun | 18\nJul | 26\nAgu | 35\nSep | 47\nOkt | 61\nNov | 78',
    tractionNotes:
      'Tumbuh rata-rata 34% per bulan\n420 pelanggan aktif\nTingkat berhenti langganan 4% per bulan',
    segments: 'Rumah tangga | 286\nKantor & coworking | 84\nKedai kopi | 50',
    competitionHead: 'Aspek | Kopi Ladang | Kedai biasa | Marketplace',
    competition:
      'Kesegaran biji | Disangrai mingguan | Bervariasi | Tidak jelas\nAsal biji | Kebun tercatat | Jarang | Jarang\nHarga untuk petani | +35% | Harga pasar | Harga pasar\nLangganan | Ya | Tidak | Tidak',
    roadmap:
      'Q1 2026 | Uji pasar | 50 pelanggan pertama\nQ3 2026 | Langganan | Aplikasi web diluncurkan\nQ1 2027 | Mesin 15 kg | Kapasitas naik 3 kali\nQ3 2027 | Jakarta | Gudang kedua\nQ1 2028 | Titik impas | Arus kas positif',
    team: 'Julian Marcell | Pendiri & CEO, 6 tahun di rantai pasok kopi\nAyudiyah Pratiwi | COO, mengelola operasional dan kemitraan petani',
    projectionUnit: 'Pendapatan per tahun, dalam juta rupiah',
    projection: '2026 | 520\n2027 | 1.450\n2028 | 3.200\n2029 | 5.800\n2030 | 9.100',
    projectionNotes:
      'Asumsi pertumbuhan pelanggan 8% per bulan\nMargin kotor naik ke 52% pada 2028',
    askAmount: 'Rp 1,5 M',
    askText: 'untuk 18 bulan',
    funds: 'Mesin sangrai | 40\nPemasaran | 30\nModal kerja | 20\nAplikasi | 10',
    askNotes: 'Target titik impas pada kuartal 1 2028',
    testimonial:
      'Kopinya selalu segar dan saya tahu persis dari kebun mana asalnya. Langganan ini membuat pagi saya lebih menyenangkan.',
    testimonialBy: 'Pelanggan langganan rumahan, Bandung',
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
    whyText: 'Farmers grow the best coffee, yet receive the smallest share of its price.',
    whySub:
      'Specialty coffee consumption keeps rising, and buyers increasingly care where it comes from.',
    solution:
      'Direct from farmers | We buy from farmer groups at 35% above market price.\nRoasted to order | Beans are roasted weekly so they stay fresh.\nFlexible subscriptions | Weekly or monthly delivery, pause any time.',
    productTitle: 'Kopi Ladang Subscription',
    productText:
      'Customers choose a flavour profile, we pick beans from the farm currently harvesting, and ship within 48 hours of roasting.',
    productPoints:
      'A farm story card in every pack\nOffice plans from 5 kg a month\nWeb app to manage subscriptions',
    how: 'Choose a flavour | Customers pick a flavour profile in the app.\nCurate | We select beans from farms currently harvesting.\nRoast | Beans are roasted every Monday in Bandung.\nDeliver | At the door within 48 hours.',
    tam: 'IDR 80T',
    tamNote: 'Indonesian coffee market per year',
    sam: 'IDR 6T',
    samNote: 'Specialty coffee in large cities',
    som: 'IDR 30B',
    somNote: 'Target for the first 3 years',
    plans:
      'Home | IDR 120K | a month, 500 g | 2 deliveries; Choose a flavour; Pause any time\nOffice | IDR 900K | a month, 5 kg | Weekly delivery; Brewing kit on loan; Free brewing class\nCafé | IDR 160K | per kg | 10 kg minimum; Wholesale price; Recipe support',
    tractionTitle: 'Monthly Revenue',
    tractionUnit: 'IDR million',
    traction: 'Jun | 18\nJul | 26\nAug | 35\nSep | 47\nOct | 61\nNov | 78',
    tractionNotes: 'Average growth of 34% a month\n420 active customers\n4% monthly churn',
    segments: 'Households | 286\nOffices & coworking | 84\nCafés | 50',
    competitionHead: 'Aspect | Kopi Ladang | Regular café | Marketplace',
    competition:
      'Bean freshness | Roasted weekly | Varies | Unclear\nOrigin | Recorded farm | Rarely | Rarely\nFarmer price | +35% | Market price | Market price\nSubscription | Yes | No | No',
    roadmap:
      'Q1 2026 | Market test | First 50 customers\nQ3 2026 | Subscriptions | Web app launch\nQ1 2027 | 15 kg roaster | 3x capacity\nQ3 2027 | Jakarta | Second warehouse\nQ1 2028 | Break-even | Positive cash flow',
    team: 'Julian Marcell | Founder & CEO, 6 years in the coffee supply chain\nAyudiyah Pratiwi | COO, runs operations and farmer partnerships',
    projectionUnit: 'Annual revenue, IDR million',
    projection: '2026 | 520\n2027 | 1,450\n2028 | 3,200\n2029 | 5,800\n2030 | 9,100',
    projectionNotes: 'Assumes 8% monthly customer growth\nGross margin rises to 52% by 2028',
    askAmount: 'IDR 1.5B',
    askText: 'for 18 months',
    funds: 'Roasting machine | 40\nMarketing | 30\nWorking capital | 20\nApp | 10',
    askNotes: 'Break-even targeted for Q1 2028',
    testimonial:
      'The coffee is always fresh and I know exactly which farm it comes from. This subscription makes my mornings better.',
    testimonialBy: 'Home subscriber, Bandung',
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
          photoField('coverPhoto', T('Foto cover', 'Cover photo'), locale),
        ],
      },
      {
        id: 'problem',
        title: L(T('Masalah dan solusi', 'Problem and solution')),
        items: [
          A('problem', T('Masalah yang diselesaikan', 'Problem'), 3),
          F('problemStat', T('Angka sorotan masalah', 'Problem highlight figure'), { max: 30 }),
          F('problemStatText', T('Keterangan angka', 'What the figure means')),
          {
            key: 'whyText',
            kind: 'textarea',
            label: L(T('Kalimat besar di slide foto', 'Big statement on the photo slide')),
            rows: 2,
            span: 2,
            max: 200,
          },
          F('whySub', T('Keterangan di bawahnya', 'Line below it'), { span: 2 }),
          photoField('whyPhoto', T('Foto slide pernyataan', 'Statement slide photo'), locale),
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
        ],
      },
      {
        id: 'product',
        title: L(T('Produk', 'Product')),
        items: [
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
          photoField('productPhoto', T('Foto produk', 'Product photo'), locale),
          A(
            'how',
            T('Cara kerja (maksimal 5 tahap)', 'How it works (up to 5 steps)'),
            4,
            pipeHint(locale, L(T('Kirim | Sampai dalam 48 jam', 'Deliver | Within 48 hours'))),
          ),
        ],
      },
      {
        id: 'market',
        title: L(T('Pasar dan harga', 'Market and pricing')),
        items: [
          F('tam', T('TAM', 'TAM'), { max: 30 }),
          F('tamNote', T('Keterangan TAM', 'TAM note')),
          F('sam', T('SAM', 'SAM'), { max: 30 }),
          F('samNote', T('Keterangan SAM', 'SAM note')),
          F('som', T('SOM', 'SOM'), { max: 30 }),
          F('somNote', T('Keterangan SOM', 'SOM note')),
          A(
            'plans',
            T(
              'Paket harga (maksimal 3): nama | harga | periode | fitur; fitur',
              'Plans (up to 3): name | price | period | feature; feature',
            ),
            4,
            '',
          ),
        ],
      },
      {
        id: 'traction',
        title: L(T('Traksi dan pesaing', 'Traction and competition')),
        items: [
          F('tractionTitle', T('Judul grafik traksi', 'Traction chart title')),
          F('tractionUnit', T('Satuan', 'Unit')),
          A('traction', T('Grafik garis: label | angka', 'Line chart: label | number'), 4, ''),
          A('tractionNotes', T('Catatan di samping grafik', 'Notes beside the chart'), 3),
          A(
            'segments',
            T(
              'Segmen pelanggan (donat): segmen | jumlah',
              'Customer segments (donut): segment | count',
            ),
            3,
            '',
          ),
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
        title: L(T('Roadmap, tim, dan proyeksi', 'Roadmap, team, and projection')),
        items: [
          A(
            'roadmap',
            T(
              'Roadmap: waktu | judul | keterangan (maksimal 6)',
              'Roadmap: when | title | note (up to 6)',
            ),
            5,
            '',
          ),
          A('team', T('Tim (maksimal 4): nama | peran', 'Team (up to 4): name | role'), 3, ''),
          F('projectionUnit', T('Satuan proyeksi', 'Projection unit'), { span: 2 }),
          A(
            'projection',
            T('Proyeksi (grafik batang): tahun | angka', 'Projection (bar chart): year | number'),
            4,
            '',
          ),
          A('projectionNotes', T('Asumsi proyeksi', 'Projection assumptions'), 2),
        ],
      },
      {
        id: 'ask',
        title: L(T('Dana, testimoni, dan kontak', 'Funding, testimonial, and contact')),
        items: [
          F('askAmount', T('Jumlah dana yang dicari', 'Amount sought'), { max: 30 }),
          F('askText', T('Keterangan singkat', 'Short note'), { max: 60 }),
          A(
            'funds',
            T('Penggunaan dana (donat): pos | persen', 'Use of funds (donut): item | percent'),
            4,
            '',
          ),
          A('askNotes', T('Catatan dana', 'Funding notes'), 2),
          {
            key: 'testimonial',
            kind: 'textarea',
            label: L(T('Testimoni pelanggan', 'Customer testimonial')),
            rows: 3,
            span: 2,
            max: 300,
          },
          F('testimonialBy', T('Nama / keterangan pemberi testimoni', 'Testimonial by'), {
            span: 2,
          }),
          photoField('testimonialPhoto', T('Foto pemberi testimoni', 'Testimonial photo'), locale),
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
      coverPhoto: sample('coffee-beans'),
      whyPhoto: sample('coffee-cherries'),
      productPhoto: sample('barista'),
      testimonialPhoto: sample('portrait-man'),
      ...SAMPLE[locale],
    },
  };
}

export const PITCH_FORM = { id: pitchForm('id'), en: pitchForm('en') };
