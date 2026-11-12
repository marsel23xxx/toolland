/**
 * Kartu hasil tes mengetik untuk disimpan sebagai gambar PNG atau PDF: nilai, KPM, akurasi,
 * statistik lain, dan grafik kecepatan per detik. Digambar langsung di canvas (bukan tangkapan
 * layar DOM) dengan tema terang agar rapi saat dicetak.
 */
import type { Grade, SecondPoint } from './typing';

export interface ReportStat {
  label: string;
  value: string;
  tone?: 'brand' | 'bad';
}

export interface ReportData {
  title: string;
  /** Baris keterangan di bawah judul, misalnya mode, bahasa, dan tanggal. */
  subtitle: string;
  grade: Grade;
  gradeNote: string;
  /** Dua angka utama (KPM dan akurasi). */
  main: [ReportStat, ReportStat];
  /** Angka pendukung, maksimal enam. */
  stats: ReportStat[];
  series: SecondPoint[];
  raw: number;
  labels: { chartTitle: string; chartAvg: string; errors: string; wpm: string; footer: string };
}

export const C = {
  paper: '#f3eee4',
  card: '#faf7f1',
  ink: '#1b1814',
  ink2: '#4a433a',
  ink3: '#635b50',
  rule: '#ddd4c4',
  brand: '#8f5e0a',
  brandSoft: 'rgba(143, 94, 10, 0.12)',
  bad: '#9a2e3f',
};
const GRADE_BG: Record<Grade, string> = {
  S: '#3c6a33',
  A: '#2c4a86',
  B: '#8f5e0a',
  C: '#a8461f',
  D: '#9a2e3f',
};
export const SANS =
  "'Plus Jakarta Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

export const REPORT_W = 1200;
export const REPORT_H = 860;

export async function loadFonts() {
  if (!('fonts' in document)) return;
  await Promise.all(
    [`600 48px ${SERIF}`, `700 20px ${SANS}`, `500 16px ${SANS}`].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Pecah teks menjadi baris yang muat di lebar tertentu. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Perkecil huruf sampai teks muat di lebar tertentu. */
export function fit(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: (px: number) => string,
  px: number,
  max: number,
) {
  ctx.font = font(px);
  while (px > 10 && ctx.measureText(text).width > max) ctx.font = font(--px);
}

function tile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  s: ReportStat,
  big: boolean,
) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = s.tone === 'brand' ? C.brand : s.tone === 'bad' ? C.bad : C.ink;
  ctx.textBaseline = 'alphabetic';
  if (big) {
    fit(ctx, s.value, (px) => `600 ${px}px ${SERIF}`, 64, w - 24);
    ctx.fillText(s.value, x + w / 2, y + h / 2 + 14);
    ctx.font = `700 15px ${SANS}`;
    ctx.fillStyle = C.ink3;
    ctx.fillText(s.label.toUpperCase(), x + w / 2, y + h - 22);
  } else {
    fit(ctx, s.value, (px) => `700 ${px}px ${SANS}`, 30, w - 20);
    ctx.fillText(s.value, x + w / 2, y + h / 2 + 2);
    ctx.font = `500 15px ${SANS}`;
    ctx.fillStyle = C.ink3;
    ctx.fillText(s.label, x + w / 2, y + h / 2 + 28);
  }
}

function chart(
  ctx: CanvasRenderingContext2D,
  d: ReportData,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Judul dan legenda.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 17px ${SANS}`;
  ctx.fillStyle = C.ink;
  let lx = x + 24;
  const ly = y + 30;
  ctx.fillText(d.labels.chartTitle, lx, ly);
  lx += ctx.measureText(d.labels.chartTitle).width + 28;
  ctx.font = `500 15px ${SANS}`;
  const legend = (draw: () => void, label: string) => {
    draw();
    ctx.fillStyle = C.ink2;
    ctx.fillText(label, lx + 32, ly);
    lx += 32 + ctx.measureText(label).width + 24;
  };
  legend(() => {
    ctx.strokeStyle = C.brand;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 24, ly);
    ctx.stroke();
  }, d.labels.wpm);
  legend(() => {
    ctx.strokeStyle = C.ink3;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 24, ly);
    ctx.stroke();
    ctx.setLineDash([]);
  }, d.labels.chartAvg);
  legend(() => {
    ctx.fillStyle = C.bad;
    ctx.font = `700 16px ${SANS}`;
    ctx.fillText('✕', lx + 6, ly);
    ctx.font = `500 15px ${SANS}`;
  }, d.labels.errors);

  const s = d.series;
  const L = x + 64;
  const R = x + w - 28;
  const T = y + 62;
  const B = y + h - 40;
  if (!s.length) return;
  const maxY = Math.max(10, Math.ceil(Math.max(...s.map((p) => p.wpm), d.raw) / 20) * 20);
  const px = (i: number) => (s.length === 1 ? (L + R) / 2 : L + (i / (s.length - 1)) * (R - L));
  const py = (v: number) => B - (Math.min(v, maxY) / maxY) * (B - T);

  // Garis bantu dan sumbu.
  ctx.font = `500 14px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.textAlign = 'right';
  for (const v of [0, maxY / 2, maxY]) {
    ctx.strokeStyle = C.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, py(v));
    ctx.lineTo(R, py(v));
    ctx.stroke();
    ctx.fillText(String(v), L - 10, py(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.max(1, Math.ceil(s.length / 10));
  s.forEach((p, i) => {
    if (i % step === 0 || i === s.length - 1) ctx.fillText(`${p.sec}s`, px(i), B + 12);
  });

  // Area, garis KPM, rata-rata, dan tanda salah ketik.
  ctx.beginPath();
  s.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.wpm)) : ctx.moveTo(px(i), py(p.wpm))));
  ctx.lineTo(px(s.length - 1), B);
  ctx.lineTo(px(0), B);
  ctx.closePath();
  ctx.fillStyle = C.brandSoft;
  ctx.fill();

  ctx.strokeStyle = C.ink3;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(L, py(d.raw));
  ctx.lineTo(R, py(d.raw));
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  s.forEach((p, i) => (i ? ctx.lineTo(px(i), py(p.wpm)) : ctx.moveTo(px(i), py(p.wpm))));
  ctx.stroke();

  ctx.strokeStyle = C.bad;
  ctx.lineWidth = 2.5;
  s.forEach((p, i) => {
    if (!p.errors) return;
    const cx = px(i);
    const cy = py(p.wpm);
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 6);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.moveTo(cx - 6, cy + 6);
    ctx.lineTo(cx + 6, cy - 6);
    ctx.stroke();
  });
}

/** Gambar kartu hasil ke canvas baru berukuran REPORT_W x REPORT_H (dikali skala). */
export async function renderReport(d: ReportData, scale = 2): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = REPORT_W * scale;
  canvas.height = REPORT_H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D tidak tersedia');
  ctx.scale(scale, scale);

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, REPORT_W, REPORT_H);
  // Pita warna di atas, khas kategori teks.
  ctx.fillStyle = C.brand;
  ctx.fillRect(0, 0, REPORT_W, 10);

  const P = 48;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink;
  fit(ctx, d.title, (px) => `600 ${px}px ${SERIF}`, 44, REPORT_W - P * 2);
  ctx.fillText(d.title, P, 82);
  ctx.font = `500 18px ${SANS}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText(d.subtitle, P, 116);

  // Kotak nilai.
  const top = 148;
  const gw = 260;
  const gh = 312;
  roundRect(ctx, P, top, gw, gh, 12);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, P + (gw - 150) / 2, top + 28, 150, 150, 12);
  ctx.fillStyle = GRADE_BG[d.grade];
  ctx.fill();
  ctx.fillStyle = '#fffdf9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 104px ${SERIF}`;
  ctx.fillText(d.grade, P + gw / 2, top + 28 + 80);
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = C.ink2;
  ctx.textBaseline = 'alphabetic';
  wrap(ctx, d.gradeNote, gw - 36)
    .slice(0, 4)
    .forEach((line, i) => ctx.fillText(line, P + gw / 2, top + 214 + i * 23));

  // Angka utama dan pendukung.
  const sx = P + gw + 20;
  const sw = REPORT_W - P - sx;
  const gap = 14;
  const bigW = (sw - gap) / 2;
  tile(ctx, sx, top, bigW, 150, { ...d.main[0], tone: 'brand' }, true);
  tile(ctx, sx + bigW + gap, top, bigW, 150, d.main[1], true);
  const n = Math.min(6, d.stats.length);
  const cols = n <= 3 ? n : Math.ceil(n / 2) > 3 ? 3 : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols) || 1;
  const smallH = (gh - 150 - gap * rows) / rows;
  const smallW = (sw - gap * (cols - 1)) / cols;
  d.stats.slice(0, 6).forEach((s, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    tile(
      ctx,
      sx + c * (smallW + gap),
      top + 150 + gap + r * (smallH + gap),
      smallW,
      smallH,
      s,
      false,
    );
  });

  chart(ctx, d, P, top + gh + 24, REPORT_W - P * 2, REPORT_H - (top + gh + 24) - 62);

  ctx.font = `500 15px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(d.labels.footer, P, REPORT_H - 24);
  return canvas;
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('gagal membuat PNG'))), 'image/png'),
  );
}

export async function reportPng(d: ReportData): Promise<Blob> {
  return toBlob(await renderReport(d));
}

/** PDF A4 mendatar berisi kartu hasil, siap dicetak. */
export async function reportPdf(d: ReportData): Promise<Blob> {
  return pngToPdf(await reportPng(d), REPORT_W, REPORT_H, d.title, d.subtitle);
}

/** Bungkus gambar PNG kartu (w x h) ke satu halaman PDF A4 mendatar. */
export async function pngToPdf(
  png: Blob,
  w0: number,
  h0: number,
  title: string,
  subject: string,
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setSubject(subject);
  pdf.setCreator('Toolland');
  const img = await pdf.embedPng(await png.arrayBuffer());
  const page = pdf.addPage([841.89, 595.28]);
  const m = 28;
  const k = Math.min((page.getWidth() - m * 2) / w0, (page.getHeight() - m * 2) / h0);
  const w = w0 * k;
  const h = h0 * k;
  page.drawImage(img, {
    x: (page.getWidth() - w) / 2,
    y: (page.getHeight() - h) / 2,
    width: w,
    height: h,
  });
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Tanggal dan jam saat ini dalam format lokal, untuk baris keterangan kartu. */
export function reportDate(locale: string): string {
  return new Date().toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Alamat halaman ini tanpa protokol, untuk catatan kaki kartu. */
export function reportSite(): string {
  return `${location.host}${location.pathname}`.replace(/\/$/, '');
}
