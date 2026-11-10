/**
 * Template PPT: laporan kerja / bulanan (16 slide). Ringkasan, KPI, tren bulanan (garis), data
 * mingguan (batang), porsi kanal (donat), capaian target (progres dan tabel), pencapaian,
 * dokumentasi, evaluasi SWOT, kendala dan solusi, fokus berikutnya, rencana, dan penutup.
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
  percents,
  photoField,
  pipeHint,
  quads,
  rows,
  textField,
  timelineItems,
} from './ppt-common';

const W = {
  id: {
    eyebrow: 'Laporan Kerja',
    agenda: 'Agenda',
    summary: 'Ringkasan',
    kpi: 'Indikator Kinerja',
    trend: 'Tren 6 Bulan',
    weekly: 'Data Mingguan',
    channels: 'Porsi per Kanal',
    progress: 'Capaian Target',
    target: 'Target vs Realisasi',
    targetHead: ['Indikator', 'Target', 'Realisasi', 'Capaian'],
    wins: 'Pencapaian',
    gallery: 'Dokumentasi Kegiatan',
    swot: 'Evaluasi',
    issues: 'Kendala & Solusi',
    issue: 'Kendala',
    fix: 'Solusi',
    focus: 'Fokus Berikutnya',
    plan: 'Rencana Berikutnya',
    thanks: 'Terima Kasih',
    qa: 'Sesi tanya jawab',
    total: 'total',
  },
  en: {
    eyebrow: 'Work Report',
    agenda: 'Agenda',
    summary: 'Summary',
    kpi: 'Key Metrics',
    trend: '6-Month Trend',
    weekly: 'Weekly Data',
    channels: 'Share by Channel',
    progress: 'Target Achievement',
    target: 'Target vs Actual',
    targetHead: ['Metric', 'Target', 'Actual', 'Achievement'],
    wins: 'Highlights',
    gallery: 'Activity Photos',
    swot: 'Review',
    issues: 'Challenges & Solutions',
    issue: 'Challenges',
    fix: 'Solutions',
    focus: 'Next Focus',
    plan: 'Next Steps',
    thanks: 'Thank You',
    qa: 'Questions and answers',
    total: 'total',
  },
};

export function buildDeck(v: DocValues, assets: DocAssets): DeckSpec {
  const lang = choice(v, 'lang', ['id', 'en'] as const, 'id');
  const w = W[lang];
  const fmt = numberFormat(v);
  const title = text(v, 'title', 120);
  const period = text(v, 'period', 60);
  const deck = deckFromValues(v, [title, period, text(v, 'team', 80)].filter(Boolean).join(' · '));

  deck.cover({
    eyebrow: period || w.eyebrow,
    title,
    subtitle: text(v, 'team', 120),
    meta: [text(v, 'name', 80), text(v, 'role', 80), text(v, 'date', 60)],
    logo: assets.logo,
    photo: assets.logo ? undefined : assets.coverPhoto,
  });
  deck.agenda({ title: w.agenda, items: [w.summary, w.kpi, w.progress, w.wins, w.issues, w.plan] });
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
  const trend = bars(v, 'monthly', 12);
  if (trend.length)
    deck.lineChart({
      title: text(v, 'monthlyTitle', 120) || w.trend,
      eyebrow: period,
      points: trend,
      unit: text(v, 'monthlyUnit', 80),
      notes: list(v, 'monthlyNotes', 3),
      format: fmt,
    });
  const weekly = bars(v, 'trend', 12);
  if (weekly.length)
    deck.chart({
      title: text(v, 'trendTitle', 120) || w.weekly,
      eyebrow: period,
      bars: weekly,
      unit: text(v, 'trendUnit', 80),
      notes: list(v, 'trendNotes', 4),
      format: fmt,
    });
  const channels = bars(v, 'channels', 6);
  if (channels.length) {
    const total = channels.reduce((t, x) => t + x.value, 0);
    deck.donut({
      title: text(v, 'channelsTitle', 120) || w.channels,
      eyebrow: period,
      items: channels,
      center: { value: fmt(total), label: text(v, 'channelsUnit', 40) || w.total },
      notes: list(v, 'channelsNotes', 2),
      format: fmt,
    });
  }
  const prog = percents(v, 'progress', 6);
  if (prog.length) deck.progress({ title: w.progress, eyebrow: period, items: prog });
  const target = rows(v, 'target', 7);
  if (target.length)
    deck.table({ title: w.target, eyebrow: period, head: w.targetHead, rows: target });
  deck.cards({ title: w.wins, eyebrow: period, items: pairs(v, 'wins', 6) });
  deck.gallery({
    title: w.gallery,
    eyebrow: period,
    photos: [1, 2, 3]
      .map((i) => ({ image: assets[`gallery${i}`], caption: text(v, `caption${i}`, 60) }))
      .filter((x) => x.image),
  });
  const sw = quads(v, 'swot');
  if (sw.length === 4) deck.swot({ title: w.swot, eyebrow: period, quads: sw });
  deck.twoCol({
    title: w.issues,
    eyebrow: period,
    left: { head: w.issue, items: list(v, 'issues', 5) },
    right: { head: w.fix, items: list(v, 'fixes', 5) },
  });
  const focus = text(v, 'focus', 200);
  if (focus)
    deck.statement({
      eyebrow: w.focus,
      text: focus,
      sub: text(v, 'focusSub', 220),
      image: assets.focusPhoto,
    });
  const plan = timelineItems(v, 'plan', 6);
  if (plan.length)
    deck.timeline({ title: w.plan, eyebrow: text(v, 'nextPeriod', 60), items: plan });
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
    monthlyTitle: 'Penjualan Online 6 Bulan Terakhir',
    monthlyUnit: 'Dalam juta rupiah',
    monthly: 'Jun | 241\nJul | 268\nAgu | 295\nSep | 322\nOkt | 349\nNov | 412',
    monthlyNotes: 'Naik 71% dalam 6 bulan\nLonjakan November dari kampanye 11.11',
    trendTitle: 'Penjualan per Minggu, November',
    trendUnit: 'Dalam juta rupiah',
    trend: 'Minggu 1 | 78\nMinggu 2 | 132\nMinggu 3 | 94\nMinggu 4 | 108',
    trendNotes: 'Puncak di minggu ke-2 karena kampanye 11.11\nPesanan pelanggan lama naik 22%',
    channelsTitle: 'Pesanan per Kanal',
    channelsUnit: 'pesanan',
    channels: 'Shopee | 1.420\nTokopedia | 890\nSitus web | 510\nWhatsApp | 360',
    channelsNotes: 'Situs web tumbuh tercepat (+41%)',
    progress:
      'Penjualan online | 103 | Rp 412 jt dari target Rp 400 jt\nPesanan | 106 | 3.180 dari 3.000\nPengikut baru | 87 | 4.350 dari 5.000\nUlasan bintang 5 | 109 | 655 dari 600',
    target:
      'Penjualan online | Rp 400 jt | Rp 412 jt | 103%\nPesanan | 3.000 | 3.180 | 106%\nPengikut baru | 5.000 | 4.350 | 87%\nUlasan bintang 5 | 600 | 655 | 109%',
    wins: 'Kampanye 11.11 | Penjualan Rp 132 juta dalam satu minggu.\nIklan lebih hemat | Biaya per pesanan turun 21%.\nUlasan meningkat | Rating toko naik menjadi 4,9.',
    caption1: 'Rapat evaluasi kampanye',
    caption2: 'Presentasi ke manajemen',
    caption3: 'Analisis data penjualan',
    swot: 'Kekuatan: Kampanye musiman yang efektif; Ulasan pelanggan sangat baik\nKelemahan: Stok sering habis saat kampanye; Waktu balas chat lambat\nPeluang: Kampanye 12.12 dan akhir tahun; Kolaborasi dengan kreator lokal\nAncaman: Biaya iklan marketplace naik; Pesaing memberi diskon besar',
    issues:
      'Stok produk terlaris habis 3 hari saat kampanye.\nWaktu balas chat pelanggan rata-rata 2 jam.\nPertumbuhan pengikut di bawah target.',
    fixes:
      'Koordinasi stok dengan gudang dua minggu sebelum kampanye.\nTambah satu admin chat pada jam sibuk.\nKolaborasi dengan 5 kreator lokal.',
    focus: 'Desember: jaga momentum 12.12 tanpa kehabisan stok.',
    focusSub: 'Target penjualan Rp 450 juta dengan biaya iklan per pesanan di bawah Rp 17.000.',
    nextPeriod: 'Rencana Desember 2026',
    plan: '1 Des | Stok kampanye | Konfirmasi stok dengan gudang\n5 Des | Kreator lokal | Konten bersama 5 kreator\n12 Des | Kampanye 12.12 | Target Rp 150 juta sepekan\n20 Des | Layanan chat | Waktu balas < 30 menit\n30 Des | Evaluasi tahunan | Laporan 2026 dan rencana 2027',
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
    monthlyTitle: 'Online Sales, Last 6 Months',
    monthlyUnit: 'IDR million',
    monthly: 'Jun | 241\nJul | 268\nAug | 295\nSep | 322\nOct | 349\nNov | 412',
    monthlyNotes: 'Up 71% in 6 months\nNovember spike from the 11.11 campaign',
    trendTitle: 'Weekly Sales, November',
    trendUnit: 'IDR million',
    trend: 'Week 1 | 78\nWeek 2 | 132\nWeek 3 | 94\nWeek 4 | 108',
    trendNotes: 'Peak in week 2 thanks to the 11.11 campaign\nRepeat-customer orders up 22%',
    channelsTitle: 'Orders by Channel',
    channelsUnit: 'orders',
    channels: 'Shopee | 1,420\nTokopedia | 890\nWebsite | 510\nWhatsApp | 360',
    channelsNotes: 'Website grew fastest (+41%)',
    progress:
      'Online sales | 103 | IDR 412M of IDR 400M target\nOrders | 106 | 3,180 of 3,000\nNew followers | 87 | 4,350 of 5,000\n5-star reviews | 109 | 655 of 600',
    target:
      'Online sales | IDR 400M | IDR 412M | 103%\nOrders | 3,000 | 3,180 | 106%\nNew followers | 5,000 | 4,350 | 87%\n5-star reviews | 600 | 655 | 109%',
    wins: '11.11 campaign | IDR 132 million in sales in one week.\nLeaner ads | Cost per order down 21%.\nBetter reviews | Store rating up to 4.9.',
    caption1: 'Campaign review meeting',
    caption2: 'Management presentation',
    caption3: 'Sales data analysis',
    swot: 'Strengths: Effective seasonal campaigns; Excellent customer reviews\nWeaknesses: Stock runs out during campaigns; Slow chat replies\nOpportunities: 12.12 and year-end campaigns; Local creator partnerships\nThreats: Rising marketplace ad costs; Competitors offering deep discounts',
    issues:
      'Best-selling stock ran out for 3 days during the campaign.\nAverage chat reply time was 2 hours.\nFollower growth was below target.',
    fixes:
      'Plan stock with the warehouse two weeks before campaigns.\nAdd one chat admin during peak hours.\nPartner with 5 local creators.',
    focus: 'December: keep the 12.12 momentum without running out of stock.',
    focusSub: 'Sales target of IDR 450 million with ad cost per order under IDR 17,000.',
    nextPeriod: 'December 2026 plan',
    plan: 'Dec 1 | Campaign stock | Confirm stock with the warehouse\nDec 5 | Local creators | Content with 5 creators\nDec 12 | 12.12 campaign | IDR 150M target in a week\nDec 20 | Chat service | Replies under 30 minutes\nDec 30 | Annual review | 2026 report and 2027 plan',
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
            T(
              'Logo perusahaan (opsional, menggantikan foto cover)',
              'Company logo (optional, replaces the cover photo)',
            ),
            locale,
            'logo',
          ),
          photoField('coverPhoto', T('Foto cover', 'Cover photo'), locale),
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
        id: 'charts',
        title: L(T('Grafik', 'Charts')),
        items: [
          F('monthlyTitle', T('Judul grafik garis (tren)', 'Line chart title (trend)')),
          F('monthlyUnit', T('Satuan', 'Unit')),
          A('monthly', T('Grafik garis: bulan | angka', 'Line chart: month | number'), 4, ''),
          A('monthlyNotes', T('Catatan grafik garis', 'Line chart notes'), 2),
          F('trendTitle', T('Judul grafik batang', 'Bar chart title')),
          F('trendUnit', T('Satuan', 'Unit')),
          A('trend', T('Grafik batang: label | angka', 'Bar chart: label | number'), 4, ''),
          A('trendNotes', T('Catatan grafik batang', 'Bar chart notes'), 2),
          F('channelsTitle', T('Judul diagram donat', 'Donut chart title')),
          F('channelsUnit', T('Satuan di tengah donat', 'Unit in the donut centre'), { max: 40 }),
          A('channels', T('Diagram donat: bagian | angka', 'Donut chart: part | number'), 4, ''),
          A('channelsNotes', T('Catatan donat', 'Donut notes'), 2),
        ],
      },
      {
        id: 'targets',
        title: L(T('Target', 'Targets')),
        items: [
          A(
            'progress',
            T(
              'Capaian target: indikator | persen | catatan',
              'Achievement: metric | percent | note',
            ),
            4,
            '',
          ),
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
        title: L(T('Evaluasi', 'Review')),
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
          photoField('gallery1', T('Foto dokumentasi 1', 'Activity photo 1'), locale),
          F('caption1', T('Keterangan foto 1', 'Caption 1'), { span: 2 }),
          photoField('gallery2', T('Foto dokumentasi 2', 'Activity photo 2'), locale),
          F('caption2', T('Keterangan foto 2', 'Caption 2'), { span: 2 }),
          photoField('gallery3', T('Foto dokumentasi 3', 'Activity photo 3'), locale),
          F('caption3', T('Keterangan foto 3', 'Caption 3'), { span: 2 }),
          A(
            'swot',
            T('SWOT (4 baris): Kekuatan: poin; poin', 'SWOT (4 lines): Strengths: point; point'),
            4,
            '',
          ),
          A('issues', T('Kendala', 'Challenges'), 3),
          A('fixes', T('Solusi', 'Solutions'), 3),
        ],
      },
      {
        id: 'plan',
        title: L(T('Rencana', 'Plan')),
        items: [
          {
            key: 'focus',
            kind: 'textarea',
            label: L(T('Fokus berikutnya (slide foto)', 'Next focus (photo slide)')),
            rows: 2,
            span: 2,
            max: 200,
          },
          F('focusSub', T('Keterangan fokus', 'Focus note'), { span: 2 }),
          photoField('focusPhoto', T('Foto slide fokus', 'Focus slide photo'), locale),
          F('nextPeriod', T('Label rencana', 'Plan label'), { span: 2 }),
          A(
            'plan',
            T(
              'Rencana: tanggal | kegiatan | keterangan (maksimal 6)',
              'Plan: date | activity | note (up to 6)',
            ),
            5,
            '',
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
      coverPhoto: sample('laptop-charts'),
      gallery1: sample('meeting'),
      gallery2: sample('team-presentation'),
      gallery3: sample('team-desk'),
      focusPhoto: sample('laptop-coffee'),
      ...SAMPLE[locale],
    },
  };
}

export const LAPORAN_FORM = { id: laporanForm('id'), en: laporanForm('en') };
