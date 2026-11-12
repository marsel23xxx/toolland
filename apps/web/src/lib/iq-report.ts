/**
 * Kartu hasil tes IQ untuk disimpan sebagai PNG atau PDF: perkiraan IQ, kurva sebaran normal
 * dengan posisi pengguna, skor per jenis soal dan per tingkat, serta catatan bahwa ini bukan tes
 * resmi. Memakai helper canvas yang sama dengan kartu tes mengetik.
 */
import { C, SANS, SERIF, fit, loadFonts, pngToPdf, roundRect, toBlob, wrap } from './typing-report';

export interface IqReportData {
  title: string;
  subtitle: string;
  iqLabel: string;
  iq: number;
  band: string;
  percentile: string;
  stats: { label: string; value: string }[];
  levels: { label: string; correct: number; total: number }[];
  levelsTitle: string;
  curveTitle: string;
  disclaimer: string;
  footer: string;
}

export const IQ_REPORT_W = 1200;
export const IQ_REPORT_H = 860;
const P = 48;
const GREEN = '#3c6a33';

function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strong = false,
) {
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = strong ? C.ink : C.rule;
  ctx.lineWidth = strong ? 2 : 1.5;
  ctx.stroke();
}

/** Kurva normal (rata-rata 100, SD 15) dengan area di kiri skor diarsir. */
function curve(
  ctx: CanvasRenderingContext2D,
  d: IqReportData,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  panel(ctx, x, y, w, h);
  ctx.font = `700 17px ${SANS}`;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.curveTitle, x + 24, y + 30);
  const L = x + 30;
  const R = x + w - 30;
  const B = y + h - 44;
  const T = y + 100;
  const lo = 55;
  const hi = 145;
  const px = (v: number) => L + ((v - lo) / (hi - lo)) * (R - L);
  const pdf = (v: number) => Math.exp(-(((v - 100) / 15) ** 2) / 2);
  const py = (v: number) => B - pdf(v) * (B - T);
  const path = (to: number) => {
    ctx.beginPath();
    ctx.moveTo(px(lo), B);
    for (let v = lo; v <= to; v += 0.5) ctx.lineTo(px(v), py(v));
    ctx.lineTo(px(to), B);
    ctx.closePath();
  };
  path(hi);
  ctx.fillStyle = 'rgba(27, 24, 20, 0.05)';
  ctx.fill();
  path(Math.min(hi, d.iq));
  ctx.fillStyle = 'rgba(143, 94, 10, 0.22)';
  ctx.fill();
  ctx.beginPath();
  for (let v = lo; v <= hi; v += 0.5) (v === lo ? ctx.moveTo : ctx.lineTo).call(ctx, px(v), py(v));
  ctx.strokeStyle = C.ink2;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = C.rule;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(L, B);
  ctx.lineTo(R, B);
  ctx.stroke();
  ctx.font = `500 14px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of [70, 85, 100, 115, 130, 145]) ctx.fillText(String(v), px(v), B + 10);
  // Penanda skor.
  const mx = px(Math.min(hi, Math.max(lo, d.iq)));
  ctx.strokeStyle = C.brand;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(mx, T - 6);
  ctx.lineTo(mx, B);
  ctx.stroke();
  ctx.setLineDash([]);
  roundRect(ctx, mx - 30, T - 34, 60, 28, 8);
  ctx.fillStyle = C.brand;
  ctx.fill();
  ctx.fillStyle = '#fffdf9';
  ctx.font = `700 16px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(d.iq), mx, T - 20);
}

function levels(
  ctx: CanvasRenderingContext2D,
  d: IqReportData,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  panel(ctx, x, y, w, h);
  ctx.font = `700 17px ${SANS}`;
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(d.levelsTitle, x + 24, y + 30);
  const n = d.levels.length;
  const top = y + 62;
  const bottom = y + h - 40;
  const slot = (w - 48) / n;
  const bw = Math.min(54, slot * 0.6);
  d.levels.forEach((l, i) => {
    const cx = x + 24 + slot * i + slot / 2;
    const ratio = l.total ? l.correct / l.total : 0;
    roundRect(ctx, cx - bw / 2, top, bw, bottom - top, 6);
    ctx.fillStyle = 'rgba(27, 24, 20, 0.06)';
    ctx.fill();
    const bh = (bottom - top) * ratio;
    if (bh > 0) {
      roundRect(ctx, cx - bw / 2, bottom - bh, bw, bh, 6);
      ctx.fillStyle = ratio >= 0.5 ? GREEN : C.brand;
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.font = `700 15px ${SANS}`;
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${l.correct}/${l.total}`, cx, Math.min(bottom - bh, bottom - 4) - 6);
    ctx.font = `500 14px ${SANS}`;
    ctx.fillStyle = C.ink3;
    ctx.textBaseline = 'top';
    ctx.fillText(l.label, cx, bottom + 10);
  });
}

export async function renderIqReport(d: IqReportData, scale = 2): Promise<HTMLCanvasElement> {
  await loadFonts();
  const W = IQ_REPORT_W;
  const H = IQ_REPORT_H;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D tidak tersedia');
  ctx.scale(scale, scale);
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.brand;
  ctx.fillRect(0, 0, W, 10);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink;
  fit(ctx, d.title, (px) => `600 ${px}px ${SERIF}`, 44, W - P * 2);
  ctx.fillText(d.title, P, 82);
  ctx.font = `500 18px ${SANS}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText(d.subtitle, P, 116);

  // Skor utama.
  const top = 148;
  const sw = 330;
  const sh = 300;
  panel(ctx, P, top, sw, sh, true);
  ctx.textAlign = 'center';
  ctx.font = `700 15px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(d.iqLabel.toUpperCase(), P + sw / 2, top + 44);
  ctx.font = `600 120px ${SERIF}`;
  ctx.fillStyle = C.brand;
  ctx.fillText(String(d.iq), P + sw / 2, top + 160);
  ctx.font = `700 22px ${SANS}`;
  ctx.fillStyle = C.ink;
  fit(ctx, d.band, (px) => `700 ${px}px ${SANS}`, 22, sw - 36);
  ctx.fillText(d.band, P + sw / 2, top + 206);
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = C.ink2;
  wrap(ctx, d.percentile, sw - 40)
    .slice(0, 2)
    .forEach((line, i) => ctx.fillText(line, P + sw / 2, top + 240 + i * 22));

  curve(ctx, d, P + sw + 20, top, W - P * 2 - sw - 20, sh);

  // Angka-angka.
  const ty = top + sh + 20;
  const th = 96;
  const n = d.stats.length;
  const gap = 14;
  const tw = (W - P * 2 - gap * (n - 1)) / n;
  d.stats.forEach((s, i) => {
    const x = P + i * (tw + gap);
    panel(ctx, x, ty, tw, th);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.ink;
    fit(ctx, s.value, (px) => `700 ${px}px ${SANS}`, 30, tw - 20);
    ctx.fillText(s.value, x + tw / 2, ty + 46);
    ctx.font = `500 15px ${SANS}`;
    ctx.fillStyle = C.ink3;
    ctx.fillText(s.label, x + tw / 2, ty + 74);
  });

  // Per tingkat + catatan.
  const ly = ty + th + 20;
  const lh = H - ly - 62;
  const lw = 520;
  levels(ctx, d, P, ly, lw, lh);
  const nx = P + lw + 20;
  const nw = W - P - nx;
  panel(ctx, nx, ly, nw, lh);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 16px ${SANS}`;
  ctx.fillStyle = C.ink2;
  wrap(ctx, d.disclaimer, nw - 48)
    .slice(0, 7)
    .forEach((line, i) => ctx.fillText(line, nx + 24, ly + 40 + i * 24));

  ctx.font = `500 15px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(d.footer, P, H - 24);
  return canvas;
}

export async function iqReportPng(d: IqReportData): Promise<Blob> {
  return toBlob(await renderIqReport(d));
}

export async function iqReportPdf(d: IqReportData): Promise<Blob> {
  return pngToPdf(await iqReportPng(d), IQ_REPORT_W, IQ_REPORT_H, d.title, d.subtitle);
}
