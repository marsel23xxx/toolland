/**
 * Perapian tanda tangan, tanpa AI dan tanpa server.
 * - Goresan: getaran tangan/mouse dihaluskan, lalu ttd yang miring diluruskan.
 * - Foto: tinta dipisahkan dari kertas (termasuk bayangan), lalu diluruskan.
 */

export interface Pt {
  x: number;
  y: number;
}
export type Stroke = Pt[];

/** Kemiringan di atas batas ini dianggap disengaja (atau salah baca), jadi tidak diubah. */
const MAX_TILT = (30 * Math.PI) / 180;
/** Kemiringan kecil dibiarkan supaya ttd yang sudah lurus tidak bergeser. */
const MIN_TILT = (1.5 * Math.PI) / 180;

/** Titik dengan jarak rata (step px), supaya penghalusan tidak bergantung kecepatan gerak. */
export function resample(stroke: Stroke, step: number): Stroke {
  if (stroke.length < 2) return stroke.slice();
  const out: Stroke = [stroke[0]];
  let prev = stroke[0];
  let carry = 0;
  for (let i = 1; i < stroke.length; i++) {
    const p = stroke[i];
    let seg = Math.hypot(p.x - prev.x, p.y - prev.y);
    let from = prev;
    while (carry + seg >= step) {
      const t = (step - carry) / seg;
      const q = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t };
      out.push(q);
      seg -= step - carry;
      from = q;
      carry = 0;
    }
    carry += seg;
    prev = p;
  }
  const last = stroke[stroke.length - 1];
  const end = out[out.length - 1];
  if (end.x !== last.x || end.y !== last.y) out.push(last);
  return out;
}

/** Rata-rata berbobot segitiga; ujung goresan tetap di tempatnya. */
export function smooth(stroke: Stroke, radius: number): Stroke {
  const n = stroke.length;
  if (n < 3 || radius < 1) return stroke.slice();
  return stroke.map((p, i) => {
    const r = Math.min(radius, i, n - 1 - i);
    if (r === 0) return p;
    let sx = 0,
      sy = 0,
      sw = 0;
    for (let k = -r; k <= r; k++) {
      const w = r + 1 - Math.abs(k);
      sx += stroke[i + k].x * w;
      sy += stroke[i + k].y * w;
      sw += w;
    }
    return { x: sx / sw, y: sy / sw };
  });
}

/** Arah sumbu utama sekumpulan titik berbobot (PCA), dalam radian, -90°..90°. */
export function principalAngle(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  ws?: ArrayLike<number>,
) {
  let sw = 0,
    mx = 0,
    my = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = ws ? ws[i] : 1;
    sw += w;
    mx += xs[i] * w;
    my += ys[i] * w;
  }
  if (sw === 0) return 0;
  mx /= sw;
  my /= sw;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = ws ? ws[i] : 1;
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx * w;
    syy += dy * dy * w;
    sxy += dx * dy * w;
  }
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
}

/** Sudut putar untuk meluruskan; 0 jika sudah lurus atau kemiringannya tidak wajar. */
export function straightenAngle(angle: number): number {
  const a = Math.abs(angle);
  return a < MIN_TILT || a > MAX_TILT ? 0 : -angle;
}

function rotate(strokes: Stroke[], angle: number): Stroke[] {
  if (angle === 0) return strokes;
  const all = strokes.flat();
  const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
  const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return strokes.map((s) =>
    s.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }),
  );
}

/** Haluskan lengkungan lalu luruskan ttd yang miring. */
export function tidyStrokes(strokes: Stroke[]): Stroke[] {
  const smoothed = strokes
    .filter((s) => s.length > 0)
    .map((s) => smooth(smooth(resample(s, 2), 4), 3));
  const all = smoothed.flat();
  if (all.length < 3) return smoothed;
  const angle = principalAngle(
    all.map((p) => p.x),
    all.map((p) => p.y),
  );
  return rotate(smoothed, straightenAngle(angle));
}

export function strokeBounds(strokes: Stroke[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of strokes)
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  return { minX, minY, maxX, maxY };
}

/** Gambar goresan dengan kurva halus dan ketebalan rata. */
export function drawStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  color: string,
  width: number,
) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.length === 1) {
      ctx.beginPath();
      ctx.arc(s[0].x, s[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (let i = 1; i < s.length - 1; i++) {
      const mx = (s[i].x + s[i + 1].x) / 2;
      const my = (s[i].y + s[i + 1].y) / 2;
      ctx.quadraticCurveTo(s[i].x, s[i].y, mx, my);
    }
    const last = s[s.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/**
 * Peta tinta dari foto (0 = kertas, 255 = tinta penuh).
 * Terang kertas diperkirakan per area, jadi bayangan dan cahaya tidak rata tidak ikut jadi tinta.
 */
export function inkMask(rgba: ArrayLike<number>, w: number, h: number): Uint8ClampedArray {
  const n = w * h;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++)
    lum[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];

  // Integral image untuk rata-rata kotak besar (perkiraan warna kertas di sekitar piksel).
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += lum[y * w + x];
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 24));
  const out = new Uint8ClampedArray(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const bg = (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]) / area;
      // Gelap relatif terhadap kertas di sekitarnya: < 12% dianggap kertas, > 35% tinta penuh.
      const dark = (bg - lum[y * w + x]) / Math.max(bg, 1);
      out[y * w + x] = Math.min(255, Math.max(0, ((dark - 0.12) / 0.23) * 255));
    }
  }
  return out;
}

/** Kemiringan tinta pada foto (radian). */
export function inkAngle(mask: Uint8ClampedArray, w: number, h: number): number {
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  const step = Math.max(1, Math.round(Math.sqrt((w * h) / 200000)));
  for (let y = 0; y < h; y += step)
    for (let x = 0; x < w; x += step) {
      const a = mask[y * w + x];
      if (a > 128) {
        xs.push(x);
        ys.push(y);
        ws.push(a);
      }
    }
  return xs.length < 20 ? 0 : principalAngle(xs, ys, ws);
}
