/**
 * Template PPT: laporan kerja / bulanan. Ringkasan, KPI, grafik tren, target vs realisasi,
 * pencapaian, kendala dan solusi, rencana periode berikutnya, dan penutup.
 */
import { choice, text, type DocAssets, type DocForm, type DocValues } from '../docs/form';
import type { DeckSpec } from '../slides/model';
import type { Locale } from '../format';
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
  pipeHint,
  rows,
  textField,
} from './ppt-common';

const W = {
  id: {
    eyebrow: 'Laporan Kerja',
    agenda: 'Agenda',
    summary: 'Ringkasan',
    kpi: 'Indikator Kinerja',
    trend: 'Tren',
    target: 'Target vs Realisasi',
    targetHead: ['Indikator', 'Target', 'Realisasi', 'Capaian'],
    wins: 'Pencapaian',
    issues: 'Kendala & Solusi',
    issue: 'Kendala',
    fix: 'Solusi',
    plan: 'Rencana Berikutnya',
    thanks: 'Terima Kasih',
    qa: 'Sesi tanya jawab',
  },
  en: {
    eyebrow: 'Work Report',
    agenda: 'Agenda',
    summary: 'Summary',
    kpi: 'Key Metrics',
    trend: 'Trend',
    target: 'Target vs Actual',
    targetHead: ['Metric', 'Target', 'Actual', 'Achievement'],
    wins: 'Highlights',
    issues: 'Challenges & Solutions',
    issue: 'Challenges',
    fix: 'Solutions',
    plan: 'Next Steps',
    thanks: 'Thank You',
    qa: 'Questions and answers',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const w = W[lang];
  const title = text(v, 'title', 120);
  const period = text(v, 'period', 60);
  const deck = deckFromValues(v, [title, period, text(v, 'team', 80)].filter(Boolean).join(' · '));

  deck.cover({
    eyebrow: period || w.eyebrow,
    title,
    subtitle: text(v, 'team', 120),
    meta: [text(v, 'name', 80), text(v, 'role', 80), text(v, 'date', 60)],
    logo: assets.logo,
  });
  deck.agenda({ title: w.agenda, items: [w.summary, w.kpi, w.target, w.wins, w.issues, w.plan] });
  const head = text(v, 'headline', 30);
  deck.bullets({
    title: w.summary,
    eyebrow: period,
    items: list(v, 'summary', 5),
    callout: head ? { value: head, text: text(v, 'headlineText', 200) } : undefined,
  });
  const kpi = pairs(v, 'kpi', 4).map((x) => ({ value: x.title, label: x.text }));
  if (kpi.length)
    deck.stats({ title: w.kpi, eyebrow: period, items: kpi, note: text(v, 'kpiNote', 200) });
  const trend = bars(v, 'trend', 12);
  if (trend.length)
    deck.chart({
      title: text(v, 'trendTitle', 120) || w.trend,
      eyebrow: period,
      bars: trend,
      unit: text(v, 'trendUnit', 80),
      notes: list(v, 'trendNotes', 4),
      format: numberFormat(v),
    });
  const target = rows(v, 'target', 7);
  if (target.length)
    deck.table({ title: w.target, eyebrow: period, head: w.targetHead, rows: target });
  deck.cards({ title: w.wins, eyebrow: period, items: pairs(v, 'wins', 6) });
  deck.twoCol({
    title: w.issues,
    eyebrow: period,
    left: { head: w.issue, items: list(v, 'issues', 5) },
    right: { head: w.fix, items: list(v, 'fixes', 5) },
  });
  deck.process({ title: w.plan, eyebrow: text(v, 'nextPeriod', 60), steps: pairs(v, 'plan', 5) });
  deck.closing({
    title: w.thanks,
    subtitle: w.qa,
    lines: [text(v, 'name', 80), text(v, 'role', 80), text(v, 'email', 80)],
    logo: assets.logo,
  });
  return deckSpec(deck, v, [title, period].filter(Boolean).join(' - '), text(v, 'name', 80));
}

const SAMPLE: Record<Locale, Record<string, string>> = {
  id: {
    title: 'Laporan Kinerja Tim Pemasaran',
    period: 'November 2026',
    team: 'Divisi Pemasaran Digital, PT Sumber Rezeki Distribusi',
    role: 'Koordinator Pemasaran Digital',
    date: '1 Desember 2026',
    headline: '+18%',
    headlineText: 'kenaikan penjualan online dibanding Oktober.',
    summary:
      'Penjualan online mencapai Rp 412 juta, melampaui target 103%.\nBiaya iklan per pesanan turun dari Rp 21.000 menjadi Rp 16.500.\nKampanye 11.11 menjadi kampanye dengan hasil terbaik tahun ini.',
    kpi: 'Rp 412 jt | Penjualan online\n3.180 | Pesanan\n2,9% | Tingkat konversi\nRp 16.500 | Biaya iklan per pesanan',
    kpiNote: 'Data dari dasbor marketplace dan Google Analytics per 30 November 2026.',
    trendTitle: 'Penjualan Online per Minggu',
    trendUnit: 'Dalam juta rupiah',
    trend: 'Minggu 1 | 78\nMinggu 2 | 132\nMinggu 3 | 94\nMinggu 4 | 108',
    trendNotes: 'Puncak di minggu ke-2 karena kampanye 11.11\nPesanan pelanggan lama naik 22%',
    target:
      'Penjualan online | Rp 400 jt | Rp 412 jt | 103%\nPesanan | 3.000 | 3.180 | 106%\nPengikut baru | 5.000 | 4.350 | 87%\nUlasan bintang 5 | 600 | 655 | 109%',
    wins: 'Kampanye 11.11 | Penjualan Rp 132 juta dalam satu minggu.\nIklan lebih hemat | Biaya per pesanan turun 21%.\nUlasan meningkat | Rating toko naik menjadi 4,9.',
    issues:
      'Stok produk terlaris habis 3 hari saat kampanye.\nWaktu balas chat pelanggan rata-rata 2 jam.\nPertumbuhan pengikut di bawah target.',
    fixes:
      'Koordinasi stok dengan gudang dua minggu sebelum kampanye.\nTambah satu admin chat pada jam sibuk.\nKolaborasi dengan 5 kreator lokal.',
    nextPeriod: 'Rencana Desember 2026',
    plan: 'Kampanye 12.12 | Target penjualan Rp 450 juta.\nKreator lokal | Kolaborasi konten dengan 5 kreator.\nLayanan chat | Target waktu balas di bawah 30 menit.\nEvaluasi tahunan | Laporan kinerja 2026 dan rencana 2027.',
  },
  en: {
    title: 'Marketing Team Performance Report',
    period: 'November 2026',
    team: 'Digital Marketing Division, PT Sumber Rezeki Distribusi',
    role: 'Digital Marketing Coordinator',
    date: 'December 1, 2026',
    headline: '+18%',
    headlineText: 'growth in online sales compared with October.',
    summary:
      'Online sales reached IDR 412 million, 103% of target.\nAd cost per order fell from IDR 21,000 to IDR 16,500.\nThe 11.11 campaign was our best campaign this year.',
    kpi: 'IDR 412M | Online sales\n3,180 | Orders\n2.9% | Conversion rate\nIDR 16,500 | Ad cost per order',
    kpiNote: 'Data from marketplace dashboards and Google Analytics as of November 30, 2026.',
    trendTitle: 'Weekly Online Sales',
    trendUnit: 'IDR million',
    trend: 'Week 1 | 78\nWeek 2 | 132\nWeek 3 | 94\nWeek 4 | 108',
    trendNotes: 'Peak in week 2 thanks to the 11.11 campaign\nRepeat-customer orders up 22%',
    target:
      'Online sales | IDR 400M | IDR 412M | 103%\nOrders | 3,000 | 3,180 | 106%\nNew followers | 5,000 | 4,350 | 87%\n5-star reviews | 600 | 655 | 109%',
    wins: '11.11 campaign | IDR 132 million in sales in one week.\nLeaner ads | Cost per order down 21%.\nBetter reviews | Store rating up to 4.9.',
    issues:
      'Best-selling stock ran out for 3 days during the campaign.\nAverage chat reply time was 2 hours.\nFollower growth was below target.',
    fixes:
      'Plan stock with the warehouse two weeks before campaigns.\nAdd one chat admin during peak hours.\nPartner with 5 local creators.',
    nextPeriod: 'December 2026 plan',
    plan: '12.12 campaign | Sales target of IDR 450 million.\nLocal creators | Content collaborations with 5 creators.\nChat service | Reply time under 30 minutes.\nAnnual review | 2026 performance report and 2027 plan.',
  },
};

export function laporanForm(locale: Locale): DocForm {
  const L = (x: Tr) => x[locale];
  const A = (key: string, label: Tr, r = 4, hint?: string) => area(locale, key, label, r, hint);
  const F = (key: string, label: Tr, extra = {}) => textField(key, label, locale, extra);
  return {
    template: 'ppt-laporan',
    output: 'deck',
    storage: 'ppt-laporan',
    fileBase: L(T('Laporan-Kerja', 'Work-Report')),
    fileKey: 'period',
    sections: [
      { id: 'look', title: L(T('Tampilan', 'Look')), items: lookFields(locale) },
      {
        id: 'cover',
        title: L(T('Judul laporan', 'Report details')),
        items: [
          F('title', T('Judul laporan', 'Report title'), { span: 2, max: 120 }),
          F('period', T('Periode', 'Period'), { max: 60 }),
          F('date', T('Tanggal presentasi', 'Presentation date'), { max: 60 }),
          F('team', T('Tim / divisi', 'Team / division'), { span: 2 }),
          F('name', T('Nama penyaji', 'Presenter')),
          F('role', T('Jabatan', 'Role')),
          F('email', T('Email (slide penutup)', 'Email (closing slide)'), { span: 2 }),
          imageField(
            'logo',
            T('Logo perusahaan (opsional)', 'Company logo (optional)'),
            locale,
            'logo',
          ),
        ],
      },
      {
        id: 'summary',
        title: L(T('Ringkasan dan KPI', 'Summary and metrics')),
        items: [
          F('headline', T('Angka utama', 'Headline figure'), { max: 30 }),
          F('headlineText', T('Keterangan angka utama', 'Headline note')),
          A('summary', T('Ringkasan', 'Summary'), 3),
          A(
            'kpi',
            T('KPI (maksimal 4): angka | nama', 'Metrics (up to 4): value | name'),
            4,
            pipeHint(locale, L(T('3.180 | Pesanan', '3,180 | Orders'))),
          ),
          F('kpiNote', T('Sumber data / catatan', 'Data source / note'), { span: 2 }),
        ],
      },
      {
        id: 'trend',
        title: L(T('Grafik dan target', 'Chart and targets')),
        items: [
          F('trendTitle', T('Judul grafik', 'Chart title')),
          F('trendUnit', T('Satuan', 'Unit')),
          A('trend', T('Data grafik: label | angka', 'Chart data: label | number'), 4, ''),
          A('trendNotes', T('Catatan di samping grafik', 'Notes beside the chart'), 3),
          A(
            'target',
            T(
              'Target vs realisasi: indikator | target | realisasi | capaian',
              'Target vs actual: metric | target | actual | achievement',
            ),
            5,
            '',
          ),
        ],
      },
      {
        id: 'review',
        title: L(T('Evaluasi dan rencana', 'Review and plan')),
        items: [
          A(
            'wins',
            T('Pencapaian (maksimal 6)', 'Highlights (up to 6)'),
            4,
            pipeHint(
              locale,
              L(T('Kampanye 11.11 | Penjualan Rp 132 juta', '11.11 campaign | IDR 132M in sales')),
            ),
          ),
          A('issues', T('Kendala', 'Challenges'), 3),
          A('fixes', T('Solusi', 'Solutions'), 3),
          F('nextPeriod', T('Label rencana', 'Plan label'), { span: 2 }),
          A(
            'plan',
            T('Rencana (maksimal 5)', 'Plan (up to 5)'),
            4,
            pipeHint(
              locale,
              L(T('Kampanye 12.12 | Target Rp 450 juta', '12.12 campaign | IDR 450M target')),
            ),
          ),
        ],
      },
    ],
    sample: {
      lang: locale,
      style: 'geo',
      font: 'sans',
      palette: '4b2e83',
      name: 'Julian Marcell',
      email: 'julian.marcell@email.com',
      logo: '',
      ...SAMPLE[locale],
    },
  };
}

export const LAPORAN_FORM = { id: laporanForm('id'), en: laporanForm('en') };
