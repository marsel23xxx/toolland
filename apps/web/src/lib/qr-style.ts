/**
 * QR code bergaya: bentuk titik (kotak, rounded, bulat, belah ketupat, hati, bintang), bentuk
 * "mata" (tiga penanda di pojok), warna, dan logo di tengah. Hasilnya SVG; PNG dibuat dengan
 * menggambar SVG ini ke canvas. Keterbacaan dicek terpisah dengan jsQR di komponen.
 *
 * Satuan koordinat = satu modul QR. Penanda pojok selalu digambar utuh (tidak ikut bentuk titik)
 * karena itulah yang dicari pemindai, dan logo hanya menutup area tengah yang bisa dipulihkan
 * oleh koreksi error tingkat H.
 */

export type ModuleShape = 'square' | 'rounded' | 'dots' | 'diamond' | 'heart' | 'star';
export type EyeShape = 'square' | 'rounded' | 'circle' | 'leaf';

export const MODULE_SHAPES: ModuleShape[] = [
  'square',
  'rounded',
  'dots',
  'diamond',
  'heart',
  'star',
];
export const EYE_SHAPES: EyeShape[] = ['square', 'rounded', 'circle', 'leaf'];

export interface QrLogo {
  /** Data URL gambar logo. */
  href: string;
  /** Lebar logo sebagai pecahan lebar QR (tanpa margin), 0.1-0.3. */
  size: number;
}

export interface QrStyle {
  shape: ModuleShape;
  eye: EyeShape;
  fg: string;
  eyeColor: string;
  bg: string;
  margin: number;
  logo?: QrLogo | null;
}

export interface Matrix {
  size: number;
  get(row: number, col: number): boolean;
  /**
   * Modul fungsi (pola penyelaras, timing, info format/versi). Digambar kotak penuh apa pun bentuk
   * titiknya, karena pemindai memakai pola ini untuk mengunci posisi; bentuk hias hanya untuk data.
   */
  isFunction?(row: number, col: number): boolean;
}

export const MAX_LOGO = 0.3;
const f = (n: number) => +n.toFixed(3);

/** Apakah (row, col) termasuk salah satu dari tiga penanda pojok 7×7. */
export function isFinder(size: number, r: number, c: number): boolean {
  const near = (v: number) => v < 7;
  const far = (v: number) => v >= size - 7;
  return (near(r) && near(c)) || (near(r) && far(c)) || (far(r) && near(c));
}

/** Rentang modul (inklusif) yang dikosongkan untuk logo, atau null tanpa logo. */
export function logoArea(size: number, logo?: QrLogo | null): { from: number; to: number } | null {
  if (!logo) return null;
  const w = Math.min(MAX_LOGO, Math.max(0.05, logo.size)) * size;
  // Ditambah setengah modul di tiap sisi sebagai jarak bersih di sekitar logo.
  const half = w / 2 + 0.5;
  const mid = size / 2;
  return { from: Math.floor(mid - half), to: Math.ceil(mid + half) - 1 };
}

/** Persegi panjang dengan radius per sudut [kiri-atas, kanan-atas, kanan-bawah, kiri-bawah]. */
function rrect(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: number[]): string {
  return (
    `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}` +
    (tr ? `a${f(tr)} ${f(tr)} 0 0 1 ${f(tr)} ${f(tr)}` : '') +
    `V${f(y + h - br)}` +
    (br ? `a${f(br)} ${f(br)} 0 0 1 ${f(-br)} ${f(br)}` : '') +
    `H${f(x + bl)}` +
    (bl ? `a${f(bl)} ${f(bl)} 0 0 1 ${f(-bl)} ${f(-bl)}` : '') +
    `V${f(y + tl)}` +
    (tl ? `a${f(tl)} ${f(tl)} 0 0 1 ${f(tl)} ${f(-tl)}` : '') +
    'z'
  );
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;
}

/** Hati dalam kotak 1×1: perintah path dan pasangan koordinat (x, y). */
const HEART: [string, number[]][] = [
  ['M', [0.5, 0.92]],
  ['C', [0.18, 0.68, 0.02, 0.5, 0.04, 0.3]],
  ['C', [0.07, 0.1, 0.35, 0.04, 0.5, 0.24]],
  ['C', [0.65, 0.04, 0.93, 0.1, 0.96, 0.3]],
  ['C', [0.98, 0.5, 0.82, 0.68, 0.5, 0.92]],
];

function heart(x: number, y: number): string {
  return (
    HEART.map(([cmd, v]) => cmd + v.map((n, i) => f(i % 2 ? y + n : x + n)).join(' ')).join('') +
    'z'
  );
}

function star(x: number, y: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.24 : 0.56;
    pts.push(`${f(x + 0.5 + Math.cos(a) * r)} ${f(y + 0.54 + Math.sin(a) * r)}`);
  }
  return `M${pts.join('L')}z`;
}

/** Path satu modul gelap. `n` = tetangga gelap [atas, kanan, bawah, kiri] untuk bentuk rounded. */
function modulePath(shape: ModuleShape, x: number, y: number, n: boolean[]): string {
  switch (shape) {
    case 'square':
      return `M${x} ${y}h1v1h-1z`;
    case 'rounded': {
      const [up, right, down, left] = n;
      const r = 0.5;
      return rrect(x, y, 1, 1, [
        !up && !left ? r : 0,
        !up && !right ? r : 0,
        !down && !right ? r : 0,
        !down && !left ? r : 0,
      ]);
    }
    case 'dots':
      return circle(x + 0.5, y + 0.5, 0.45);
    case 'diamond':
      return `M${x + 0.5} ${f(y + 0.02)}L${f(x + 0.98)} ${y + 0.5}L${x + 0.5} ${f(y + 0.98)}L${f(x + 0.02)} ${y + 0.5}z`;
    case 'heart':
      return heart(x, y);
    case 'star':
      return star(x, y);
  }
}

/** Path satu penanda pojok (cincin luar 7×7 dan inti 3×3) dengan origin (x, y). */
function eyePaths(eye: EyeShape, x: number, y: number): { ring: string; core: string } {
  switch (eye) {
    case 'square':
      return {
        ring: `M${x} ${y}h7v7h-7z M${x + 1} ${y + 1}v5h5v-5z`,
        core: `M${x + 2} ${y + 2}h3v3h-3z`,
      };
    case 'rounded':
      return {
        ring: rrect(x, y, 7, 7, [2, 2, 2, 2]) + rrect(x + 1, y + 1, 5, 5, [1.3, 1.3, 1.3, 1.3]),
        core: rrect(x + 2, y + 2, 3, 3, [0.9, 0.9, 0.9, 0.9]),
      };
    case 'circle':
      return {
        ring: circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5),
        core: circle(x + 3.5, y + 3.5, 1.5),
      };
    case 'leaf':
      return {
        ring: rrect(x, y, 7, 7, [3, 0, 3, 0]) + rrect(x + 1, y + 1, 5, 5, [2.2, 0, 2.2, 0]),
        core: rrect(x + 2, y + 2, 3, 3, [1.3, 0, 1.3, 0]),
      };
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Bangun SVG QR bergaya. `px` = ukuran sisi gambar (atribut width/height). */
export function qrSvg(m: Matrix, s: QrStyle, px: number): string {
  const N = m.size;
  const M = Math.max(0, Math.round(s.margin));
  const total = N + M * 2;
  const area = logoArea(N, s.logo);
  const inLogo = (r: number, c: number) =>
    !!area && r >= area.from && r <= area.to && c >= area.from && c <= area.to;
  const dark = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < N && c < N && m.get(r, c) && !isFinder(N, r, c) && !inLogo(r, c);

  let mods = '';
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      if (dark(r, c))
        mods += modulePath(
          m.isFunction?.(r, c) && s.shape !== 'rounded' ? 'square' : s.shape,
          c + M,
          r + M,
          [dark(r - 1, c), dark(r, c + 1), dark(r + 1, c), dark(r, c - 1)],
        );

  let rings = '';
  let cores = '';
  for (const [r, c] of [
    [0, 0],
    [0, N - 7],
    [N - 7, 0],
  ]) {
    const e = eyePaths(s.eye, c + M, r + M);
    rings += e.ring;
    cores += e.core;
  }

  let logo = '';
  if (area && s.logo) {
    const x = area.from + M;
    const w = area.to - area.from + 1;
    const pad = 0.6;
    logo =
      `<path fill="${esc(s.bg)}" d="${rrect(x, x, w, w, [w * 0.18, w * 0.18, w * 0.18, w * 0.18])}"/>` +
      `<image href="${esc(s.logo.href)}" x="${f(x + pad)}" y="${f(x + pad)}" width="${f(w - pad * 2)}" height="${f(w - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${px}" height="${px}"${s.shape === 'square' && s.eye === 'square' ? ' shape-rendering="crispEdges"' : ''}>` +
    `<rect width="${total}" height="${total}" fill="${esc(s.bg)}"/>` +
    `<path fill="${esc(s.fg)}" d="${mods}"/>` +
    `<path fill="${esc(s.eyeColor)}" fill-rule="evenodd" d="${rings}"/>` +
    `<path fill="${esc(s.eyeColor)}" d="${cores}"/>` +
    logo +
    '</svg>'
  );
}

/** Luminans relatif warna hex (WCAG). */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * Kontras warna QR terhadap latar. Pemindai di HP umumnya butuh QR lebih gelap dari latar;
 * QR terang di latar gelap (terbalik) sering gagal dipindai, jadi dianggap tidak aman.
 */
export function contrastOk(fg: string, bg: string): boolean {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a >= b) return false;
  return (b + 0.05) / (a + 0.05) >= 3;
}
