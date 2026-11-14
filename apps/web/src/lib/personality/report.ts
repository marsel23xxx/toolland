/**
 * Kartu hasil tes kepribadian (PNG/PDF): kode dan nama tipe, ringkasan, batang skor, tiga daftar
 * pertama (misalnya kekuatan, tantangan, pekerjaan), dan catatan. Satu tata letak untuk semua tes.
 */
import {
  C,
  SANS,
  SERIF,
  fit,
  loadFonts,
  pngToPdf,
  roundRect,
  toBlob,
  wrap,
} from '../typing-report';
import type { Bar, Profile } from './core';

export interface PersonalityReport {
  title: string;
  subtitle: string;
  profile: Profile;
  disclaimer: string;
  footer: string;
}

export const P_REPORT_W = 1200;
export const P_REPORT_H = 900;
const P = 48;

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

function track(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(27, 24, 20, 0.08)';
  ctx.fill();
}

/** Satu baris batang; mengembalikan tinggi yang dipakai. */
function bar(ctx: CanvasRenderingContext2D, b: Bar, x: number, y: number, w: number): number {
  ctx.textBaseline = 'alphabetic';
  const v = Math.max(0, Math.min(100, b.value));
  if (b.kind === 'uni') {
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = `${b.strong ? 700 : 600} 16px ${SANS}`;
    ctx.fillText(b.label, x, y + 16);
    ctx.textAlign = 'right';
    ctx.font = `700 16px ${SANS}`;
    ctx.fillText(b.text, x + w, y + 16);
    track(ctx, x, y + 26, w, 14);
    ctx.fillStyle = b.strong ? C.brand : C.ink3;
    if (b.mid) {
      const mid = x + w / 2;
      const end = x + (w * v) / 100;
      ctx.fillRect(Math.min(mid, end), y + 26, Math.max(2, Math.abs(end - mid)), 14);
      ctx.fillStyle = C.ink;
      ctx.fillRect(mid - 1, y + 22, 2, 22);
    } else {
      roundRect(ctx, x, y + 26, Math.max(14, (w * v) / 100), 14, 7);
      ctx.fill();
    }
    return 56;
  }
  const leftWins = v >= 50;
  ctx.font = `600 15px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = leftWins ? C.ink : C.ink3;
  ctx.fillText(`${b.left} ${v}%`, x, y + 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = leftWins ? C.ink3 : C.ink;
  ctx.fillText(`${100 - v}% ${b.right}`, x + w, y + 16);
  track(ctx, x, y + 26, w, 14);
  ctx.fillStyle = C.brand;
  const mid = x + w / 2;
  // Batang tumbuh dari tengah ke arah kutub yang menang: v=100 mentok kiri, v=0 mentok kanan.
  const end = x + w * (1 - v / 100);
  ctx.fillRect(Math.min(end, mid), y + 26, Math.max(2, Math.abs(end - mid)), 14);
  ctx.fillStyle = C.ink;
  ctx.fillRect(mid - 1, y + 22, 2, 22);
  return 62;
}

export async function renderPersonalityReport(
  d: PersonalityReport,
  scale = 2,
): Promise<HTMLCanvasElement> {
  await loadFonts();
  const W = P_REPORT_W;
  const H = P_REPORT_H;
  const pr = d.profile;
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

  // Kiri: kode, nama, ringkasan.
  const top = 148;
  const ph = 400;
  const lw = 400;
  panel(ctx, P, top, lw, ph, true);
  const cx = P + 24;
  const cw = lw - 48;
  ctx.font = `700 14px ${SANS}`;
  ctx.fillStyle = C.ink3;
  ctx.fillText(pr.eyebrow.toUpperCase(), cx, top + 40);
  let y = top + 40;
  if (pr.code) {
    ctx.fillStyle = C.brand;
    fit(ctx, pr.code, (px) => `600 ${px}px ${SERIF}`, 96, cw);
    ctx.fillText(pr.code, cx, top + 136);
    y = top + 136;
  } else if (pr.chips?.length) {
    // Kotak skor kecil sebagai pengganti kode tipe.
    const n = pr.chips.length;
    const g = 10;
    const bw = (cw - g * (n - 1)) / n;
    pr.chips.forEach((c, i) => {
      const bx = cx + i * (bw + g);
      roundRect(ctx, bx, top + 62, bw, 76, 8);
      ctx.fillStyle = C.brandSoft;
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = C.brand;
      ctx.font = `600 34px ${SERIF}`;
      ctx.fillText(c.value, bx + bw / 2, top + 106);
      ctx.fillStyle = C.ink3;
      ctx.font = `700 14px ${SANS}`;
      ctx.fillText(c.label, bx + bw / 2, top + 128);
    });
    ctx.textAlign = 'left';
    y = top + 140;
  }
  ctx.fillStyle = C.ink;
  fit(ctx, pr.name, (px) => `700 ${px}px ${SANS}`, 26, cw);
  ctx.fillText(pr.name, cx, y + 44);
  y += 80;
  const room = top + ph - 20 - y;
  let px = 17;
  let lines: string[];
  for (;;) {
    ctx.font = `500 ${px}px ${SANS}`;
    lines = wrap(ctx, pr.summary, cw);
    if (lines.length * (px + 7) <= room || px <= 13) break;
    px--;
  }
  ctx.fillStyle = C.ink2;
  const lh = px + 7;
  lines.slice(0, Math.floor(room / lh)).forEach((l, i) => ctx.fillText(l, cx, y + i * lh));

  // Kanan: batang skor.
  const rx = P + lw + 20;
  const rw = W - P - rx;
  panel(ctx, rx, top, rw, ph);
  ctx.textAlign = 'left';
  ctx.font = `700 17px ${SANS}`;
  ctx.fillStyle = C.ink;
  ctx.fillText(pr.barsTitle, rx + 24, top + 40);
  const rowH = pr.bars[0]?.kind === 'bi' ? 62 : 56;
  const used = pr.bars.length * rowH;
  let by = top + 60 + Math.max(0, (ph - 80 - used) / 2);
  for (const b of pr.bars) by += bar(ctx, b, rx + 24, by, rw - 48);

  // Bawah: sampai tiga daftar.
  const lists = pr.sections.filter((s) => s.list?.length).slice(0, 3);
  const sy = top + ph + 20;
  const sh = 230;
  const gap = 20;
  const n = Math.max(1, lists.length);
  const sw = (W - P * 2 - gap * (n - 1)) / n;
  lists.forEach((s, i) => {
    const x = P + i * (sw + gap);
    panel(ctx, x, sy, sw, sh);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    fit(ctx, s.title, (p) => `700 ${p}px ${SANS}`, 17, sw - 48);
    ctx.fillText(s.title, x + 24, sy + 38);
    ctx.fillStyle = C.ink2;
    // Butir panjang dibungkus (bukan dikecilkan) supaya ukuran huruf seragam.
    ctx.font = `500 15px ${SANS}`;
    let ly = sy + 70;
    for (const item of s.list!) {
      const lines = wrap(ctx, item, sw - 66);
      if (ly + (lines.length - 1) * 20 > sy + sh - 14) break;
      ctx.fillText('•', x + 24, ly);
      lines.forEach((l, k) => ctx.fillText(l, x + 42, ly + k * 20));
      ly += lines.length * 20 + 8;
    }
  });

  ctx.textAlign = 'left';
  ctx.font = `500 13px ${SANS}`;
  ctx.fillStyle = C.ink3;
  wrap(ctx, d.disclaimer, W - P * 2)
    .slice(0, 2)
    .forEach((l, i) => ctx.fillText(l, P, sy + sh + 28 + i * 18));
  ctx.font = `500 15px ${SANS}`;
  ctx.fillText(d.footer, P, H - 20);
  return canvas;
}

export async function personalityPng(d: PersonalityReport): Promise<Blob> {
  return toBlob(await renderPersonalityReport(d));
}

export async function personalityPdf(d: PersonalityReport): Promise<Blob> {
  return pngToPdf(await personalityPng(d), P_REPORT_W, P_REPORT_H, d.title, d.subtitle);
}
