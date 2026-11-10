/**
 * Tampilan klip: warna, zoom/geser, Ken Burns, dan kecepatan. Satu rumus untuk dua keluaran:
 * pratinjau (filter SVG + transform CSS) dan ekspor (filter ffmpeg), agar hasilnya sama.
 *
 * Warna = matriks 3x3 (saturasi + preset) lalu kurva linear per kanal (kontras + kecerahan):
 *   v' = slope * (M · v) + intercept, dalam ruang sRGB 0-1.
 * Pratinjau: feColorMatrix + feComponentTransfer (color-interpolation-filters = sRGB).
 * Ekspor: colorchannelmixer + lutrgb.
 */
import type { Clip, ColorPreset, KenBurns } from './project';

type M3 = [number, number, number, number, number, number, number, number, number];
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mul(a: M3, b: M3): M3 {
  const o = new Array<number>(9) as M3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}

/** Matriks saturasi standar (sama dengan CSS saturate()). */
function saturate(s: number): M3 {
  return [
    0.213 + 0.787 * s,
    0.715 - 0.715 * s,
    0.072 - 0.072 * s,
    0.213 - 0.213 * s,
    0.715 + 0.285 * s,
    0.072 - 0.072 * s,
    0.213 - 0.213 * s,
    0.715 - 0.715 * s,
    0.072 + 0.928 * s,
  ];
}

/** Sepia dengan kadar a (matriks CSS sepia()). */
function sepia(a: number): M3 {
  const s: M3 = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
  return s.map((v, i) => I3[i] + (v - I3[i]) * a) as M3;
}

const PRESETS: Record<ColorPreset, { m: M3; contrast: number; brightness: number }> = {
  none: { m: I3, contrast: 1, brightness: 1 },
  warm: { m: [1.08, 0.02, 0, 0, 1.0, 0, 0, 0, 0.86], contrast: 1, brightness: 1 },
  cool: { m: [0.9, 0, 0, 0, 1.0, 0.02, 0, 0.03, 1.1], contrast: 1, brightness: 1 },
  bw: { m: saturate(0), contrast: 1.1, brightness: 1 },
  vintage: { m: mul(sepia(0.55), saturate(0.8)), contrast: 0.9, brightness: 1.05 },
  vivid: { m: saturate(1.4), contrast: 1.12, brightness: 1 },
  fade: { m: saturate(0.75), contrast: 0.8, brightness: 1.06 },
};

export const COLOR_PRESETS = Object.keys(PRESETS) as ColorPreset[];

type ColorInput = Pick<Clip, 'brightness' | 'contrast' | 'saturation' | 'preset'>;

export interface ColorTransform {
  m: M3;
  slope: number;
  intercept: number;
  identity: boolean;
}

export function colorTransform(c: ColorInput): ColorTransform {
  const p = PRESETS[c.preset] ?? PRESETS.none;
  const m = mul(p.m, saturate(c.saturation));
  const contrast = c.contrast * p.contrast;
  const brightness = c.brightness * p.brightness;
  const slope = brightness * contrast;
  const intercept = brightness * 0.5 * (1 - contrast);
  const identity =
    m.every((v, i) => Math.abs(v - I3[i]) < 1e-4) &&
    Math.abs(slope - 1) < 1e-4 &&
    Math.abs(intercept) < 1e-4;
  return { m, slope, intercept, identity };
}

const f4 = (n: number) => String(Math.round(n * 10000) / 10000);

/** Filter ffmpeg untuk warna (kosong bila tidak berubah). */
export function colorFilter(c: ColorInput): string {
  const t = colorTransform(c);
  if (t.identity) return '';
  const k = ['rr', 'rg', 'rb', 'gr', 'gg', 'gb', 'br', 'bg', 'bb'];
  const mixer = `colorchannelmixer=${t.m.map((v, i) => `${k[i]}=${f4(v)}`).join(':')}`;
  const lut = `clip(val*${f4(t.slope)}+${f4(t.intercept * 255)}\\,0\\,255)`;
  return `${mixer},lutrgb=r='${lut}':g='${lut}':b='${lut}'`;
}

/** Nilai feColorMatrix (4x5) dan kurva linear untuk pratinjau SVG. */
export function colorSvg(c: ColorInput): { matrix: string; slope: number; intercept: number } {
  const t = colorTransform(c);
  const m = t.m;
  const matrix = [
    m[0], m[1], m[2], 0, 0,
    m[3], m[4], m[5], 0, 0,
    m[6], m[7], m[8], 0, 0,
    0, 0, 0, 1, 0,
  ].map(f4).join(' '); // prettier-ignore
  return { matrix, slope: t.slope, intercept: t.intercept };
}

// ---------- Geometri: zoom, geser, Ken Burns ----------

const KB: Record<KenBurns, { z0: number; z1: number; x0: number; x1: number }> = {
  none: { z0: 1, z1: 1, x0: 0, x1: 0 },
  in: { z0: 1, z1: 1.25, x0: 0, x1: 0 },
  out: { z0: 1.25, z1: 1, x0: 0, x1: 0 },
  left: { z0: 1.2, z1: 1.2, x0: 1, x1: -1 },
  right: { z0: 1.2, z1: 1.2, x0: -1, x1: 1 },
};

type GeoInput = Pick<Clip, 'zoom' | 'panX' | 'panY' | 'kenBurns'>;

/** Zoom dan titik geser pada kemajuan p (0-1) di dalam klip. */
export function geometryAt(c: GeoInput, p: number): { z: number; px: number; py: number } {
  const k = KB[c.kenBurns] ?? KB.none;
  const q = Math.max(0, Math.min(1, p));
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    z: c.zoom * (k.z0 + (k.z1 - k.z0) * q),
    px: clamp(c.panX + k.x0 + (k.x1 - k.x0) * q),
    py: clamp(c.panY),
  };
}

export function hasGeometry(c: GeoInput): boolean {
  return c.zoom !== 1 || c.kenBurns !== 'none';
}

/**
 * Filter zoompan untuk zoom/geser (setelah fps, sehingga nomor bingkai "in" = waktu × fps).
 * frames = jumlah bingkai klip di timeline.
 */
export function geometryFilter(
  c: GeoInput,
  w: number,
  h: number,
  fps: number,
  frames: number,
): string {
  if (!hasGeometry(c)) return '';
  const k = KB[c.kenBurns] ?? KB.none;
  const p = `min(in/${Math.max(1, frames - 1)}\\,1)`;
  const z = `${f4(c.zoom)}*(${f4(k.z0)}+${f4(k.z1 - k.z0)}*${p})`;
  const px = `max(-1\\,min(1\\,${f4(c.panX + k.x0)}+${f4(k.x1 - k.x0)}*${p}))`;
  const py = f4(Math.max(-1, Math.min(1, c.panY)));
  return `zoompan=z='${z}':x='(iw-iw/zoom)/2*(1+${px})':y='(ih-ih/zoom)/2*(1+${py})':d=1:s=${w}x${h}:fps=${fps}`;
}

/** transform CSS untuk lapisan pratinjau (zoom di sekitar titik tengah lalu digeser). */
export function geometryCss(g: { z: number; px: number; py: number }): string {
  if (g.z === 1) return '';
  const tx = (-(g.z - 1) / 2) * g.px * 100;
  const ty = (-(g.z - 1) / 2) * g.py * 100;
  return `translate(${f4(tx)}%, ${f4(ty)}%) scale(${f4(g.z)})`;
}

/** Filter putar dan balik (sebelum diskalakan ke bingkai keluaran). */
export function orientFilter(c: Pick<Clip, 'rotate' | 'flipH' | 'flipV'>): string {
  const f: string[] = [];
  if (c.rotate === 90) f.push('transpose=1');
  else if (c.rotate === 270) f.push('transpose=2');
  else if (c.rotate === 180) f.push('hflip', 'vflip');
  if (c.flipH) f.push('hflip');
  if (c.flipV) f.push('vflip');
  return f.join(',');
}

// ---------- Kecepatan ----------

/** Rantai atempo (tiap filter hanya 0,5-2). */
export function atempoChain(speed: number): string {
  if (Math.abs(speed - 1) < 1e-3) return '';
  const parts: string[] = [];
  let s = speed;
  while (s > 2) {
    parts.push('atempo=2');
    s /= 2;
  }
  while (s < 0.5) {
    parts.push('atempo=0.5');
    s /= 0.5;
  }
  parts.push(`atempo=${f4(s)}`);
  return parts.join(',');
}

/** Penguatan fade audio klip pada detik ke-off dari panjang len (untuk pratinjau). */
export function fadeGain(c: Pick<Clip, 'fadeIn' | 'fadeOut'>, off: number, len: number): number {
  let g = 1;
  if (c.fadeIn > 0 && off < c.fadeIn) g = Math.min(g, off / c.fadeIn);
  if (c.fadeOut > 0 && len - off < c.fadeOut) g = Math.min(g, (len - off) / c.fadeOut);
  return Math.max(0, Math.min(1, g));
}
