/**
 * Baris tulisan yang sudah ada di PDF (dari pdf.js getTextContent), untuk fitur "klik tulisan
 * lalu edit" di PDF Editor. Semua koordinat dalam point, origin kiri atas halaman seperti
 * terlihat (sudah memperhitungkan rotasi halaman).
 */

export type FontFamily = 'helvetica' | 'times' | 'courier';

/** Bagian dari TextItem pdf.js yang dipakai. */
export interface RawTextItem {
  str: string;
  /** Matriks teks [a, b, c, d, e, f] dalam koordinat PDF. */
  transform: number[];
  /** Lebar dalam satuan PDF. */
  width: number;
  fontName: string;
}

export interface TextStyle {
  ascent?: number;
  descent?: number;
}

export interface TextLine {
  /** Kunci unik per halaman, untuk menandai baris yang sedang diedit. */
  key: string;
  text: string;
  /** Titik awal baseline. */
  x: number;
  baseline: number;
  width: number;
  size: number;
  /** Tinggi di atas dan di bawah baseline, dalam point. */
  above: number;
  below: number;
  fontName: string;
}

const apply = (m: number[], x: number, y: number) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/**
 * Kelompokkan potongan teks menjadi baris: satu baseline, satu font, dan berdekatan.
 * Kolom yang berjauhan (misalnya "Nama" lalu ": Budi") menjadi baris terpisah.
 * `viewport` = viewport.transform pdf.js pada skala 1.
 */
export function groupLines(
  items: RawTextItem[],
  viewport: number[],
  styles: Record<string, TextStyle>,
): TextLine[] {
  interface Piece {
    str: string;
    x: number;
    y: number;
    w: number;
    size: number;
    fontName: string;
  }
  const pieces: Piece[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const [a, b, c, d, e, f] = it.transform;
    // Arah teks di layar: hanya baris mendatar kiri ke kanan yang bisa diedit.
    const [dx, dy] = [viewport[0] * a + viewport[2] * b, viewport[1] * a + viewport[3] * b];
    if (dx <= 0 || Math.abs(dy) > Math.abs(dx) * 0.02) continue;
    const size = Math.hypot(c, d);
    if (size < 2) continue;
    const [x, y] = apply(viewport, e, f);
    pieces.push({ str: it.str, x, y, w: Math.abs(it.width), size, fontName: it.fontName });
  }
  pieces.sort((p, q) => (Math.abs(p.y - q.y) > p.size * 0.2 ? p.y - q.y : p.x - q.x));

  const lines: TextLine[] = [];
  let cur: (TextLine & { end: number }) | null = null;
  const flush = () => {
    if (cur && cur.text.trim()) {
      const c: TextLine & { end: number } = cur;
      const line: TextLine = {
        key: c.key,
        text: c.text,
        x: c.x,
        baseline: c.baseline,
        width: c.width,
        size: c.size,
        above: c.above,
        below: c.below,
        fontName: c.fontName,
      };
      const lead = line.text.length - line.text.trimStart().length;
      line.text = line.text.trim();
      if (lead) line.x += (line.width * lead) / (line.text.length + lead);
      line.width = Math.max(1, line.width);
      lines.push(line);
    }
    cur = null;
  };
  for (const p of pieces) {
    // Spasi lebar (tab, perataan kolom) memisahkan kolom: "Nama" dan ": Budi" jadi dua baris.
    if (!p.str.trim() && p.w > p.size * 0.9) {
      flush();
      continue;
    }
    const gap = cur ? p.x - cur.end : 0;
    const same =
      cur &&
      cur.fontName === p.fontName &&
      Math.abs(cur.size - p.size) < 0.5 &&
      Math.abs(cur.baseline - p.y) < p.size * 0.2 &&
      gap > -p.size * 0.3 &&
      gap < p.size * 0.9;
    if (!same) {
      flush();
      const st = styles[p.fontName] ?? {};
      const ascent = st.ascent && st.ascent > 0.3 ? st.ascent : 0.8;
      const descent = st.descent ? Math.abs(st.descent) : 0.2;
      cur = {
        key: `${Math.round(p.x)}:${Math.round(p.y)}:${lines.length}`,
        text: p.str,
        x: p.x,
        baseline: p.y,
        width: p.w,
        size: p.size,
        above: ascent * p.size,
        below: Math.min(descent, 0.35) * p.size,
        fontName: p.fontName,
        end: p.x + p.w,
      };
      continue;
    }
    const c = cur!;
    const needSpace = gap > p.size * 0.15 && !c.text.endsWith(' ') && !p.str.startsWith(' ');
    c.text += (needSpace ? ' ' : '') + p.str;
    c.end = Math.max(c.end, p.x + p.w);
    c.width = c.end - c.x;
  }
  flush();
  return lines;
}

/** Pilih font standar PDF yang paling mirip dari nama font asli dan jenisnya. */
export function standardFamily(name: string | undefined, fallback: string | undefined): FontFamily {
  const n = (name ?? '').replace(/^[A-Z]{6}\+/, '');
  if (/courier|mono|consol|menlo/i.test(n) || fallback === 'monospace') return 'courier';
  if (/sans|arial|helvet|calibri|verdana|tahoma|segoe|roboto|open ?sans|noto ?sans/i.test(n))
    return 'helvetica';
  if (
    /times|roman|serif|georgia|garamond|cambria|book|minion|palatino|baskerville/i.test(n) ||
    fallback === 'serif'
  )
    return 'times';
  return 'helvetica';
}

export type Rgb = [number, number, number];

const dist = (p: Rgb, q: Rgb) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
export const toHex = (c: Rgb) =>
  `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Warna latar dan warna tulisan dari piksel hasil render. `data` = RGBA area kotak tulisan
 * yang sedikit diperbesar; `inner` = kotak tulisan di dalam area itu (piksel).
 * Latar: warna paling sering di tepi area. Tulisan: piksel paling kontras dengan latar.
 */
export function pickColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  inner: { x: number; y: number; w: number; h: number },
): { bg: Rgb; fg: Rgb } {
  const px = (x: number, y: number): Rgb => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // Latar dari bingkai di luar kotak tulisan.
  const counts = new Map<string, { n: number; sum: Rgb }>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
      if (inside) continue;
      const c = px(x, y);
      const k = c.map((v) => v >> 4).join(',');
      const e = counts.get(k) ?? { n: 0, sum: [0, 0, 0] as Rgb };
      e.n++;
      e.sum = [e.sum[0] + c[0], e.sum[1] + c[1], e.sum[2] + c[2]];
      counts.set(k, e);
    }
  }
  let bg: Rgb = [255, 255, 255];
  let best = 0;
  for (const e of counts.values())
    if (e.n > best) {
      best = e.n;
      bg = [e.sum[0] / e.n, e.sum[1] / e.n, e.sum[2] / e.n];
    }

  // Tulisan: rata-rata piksel yang paling jauh dari warna latar (inti huruf, bukan tepi halus).
  const inside: { c: Rgb; d: number }[] = [];
  for (let y = inner.y; y < inner.y + inner.h && y < height; y++)
    for (let x = inner.x; x < inner.x + inner.w && x < width; x++) {
      const c = px(x, y);
      inside.push({ c, d: dist(c, bg) });
    }
  const max = inside.reduce((m, p) => Math.max(m, p.d), 0);
  if (max < 40) return { bg, fg: [0, 0, 0] };
  const core = inside.filter((p) => p.d >= max * 0.8);
  const fg = core
    .reduce<Rgb>((s, p) => [s[0] + p.c[0], s[1] + p.c[1], s[2] + p.c[2]], [0, 0, 0])
    .map((v) => v / core.length) as Rgb;
  return { bg, fg };
}
