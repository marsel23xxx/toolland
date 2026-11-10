/**
 * Font dan animasi teks. Animasi dihitung dengan rumus yang sama untuk pratinjau (canvas) dan
 * ekspor (fade alpha + ekspresi posisi overlay di ffmpeg).
 */
import type { FontId, TextAnim, TextLayer } from './project';

export interface FontDef {
  family: string;
  weight: number;
  label: string;
}

/** Font yang disediakan (semua OFL, disimpan sendiri di situs). */
export const FONTS: Record<FontId, FontDef> = {
  jakarta: { family: 'Plus Jakarta Sans Variable', weight: 800, label: 'Plus Jakarta Sans' },
  bebas: { family: 'Bebas Neue', weight: 400, label: 'Bebas Neue' },
  montserrat: { family: 'Montserrat', weight: 800, label: 'Montserrat' },
  playfair: { family: 'Playfair Display', weight: 700, label: 'Playfair Display' },
  caveat: { family: 'Caveat', weight: 700, label: 'Caveat' },
  pacifico: { family: 'Pacifico', weight: 400, label: 'Pacifico' },
};
export const FONT_IDS = Object.keys(FONTS) as FontId[];

/** String font canvas untuk ukuran px. */
export function fontCss(id: FontId, px: number): string {
  const f = FONTS[id] ?? FONTS.jakarta;
  return `${f.weight} ${px}px "${f.family}", system-ui, sans-serif`;
}

/** Jarak geser animasi, relatif terhadap lebar/tinggi video. */
export const SLIDE = 0.06;

type AnimInput = Pick<TextLayer, 'start' | 'end' | 'animIn' | 'animOut' | 'animDur'>;

const animLen = (t: AnimInput) => Math.max(0.05, Math.min(t.animDur, (t.end - t.start) / 2));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Kepekatan dan pergeseran (pecahan lebar/tinggi) teks pada waktu time. */
export function textAnimAt(t: AnimInput, time: number): { alpha: number; dx: number; dy: number } {
  const d = animLen(t);
  let alpha = 1;
  let dx = 0;
  let dy = 0;
  if (t.animIn !== 'none') {
    const a = clamp01((time - t.start) / d);
    alpha *= a;
    if (t.animIn === 'up') dy += SLIDE * (1 - a);
    if (t.animIn === 'left') dx -= SLIDE * (1 - a);
  }
  if (t.animOut !== 'none') {
    const b = clamp01((t.end - time) / d);
    alpha *= b;
    if (t.animOut === 'up') dy -= SLIDE * (1 - b);
    if (t.animOut === 'left') dx -= SLIDE * (1 - b);
  }
  return { alpha, dx, dy };
}

const f4 = (n: number) => String(Math.round(n * 10000) / 10000);

function slideExpr(
  anim: TextAnim,
  dir: 'x' | 'y',
  inPart: boolean,
  start: number,
  end: number,
  d: number,
) {
  const on = (dir === 'y' && anim === 'up') || (dir === 'x' && anim === 'left');
  if (!on) return '';
  const p = inPart
    ? `clip((t-${f4(start)})/${f4(d)}\\,0\\,1)`
    : `clip((${f4(end)}-t)/${f4(d)}\\,0\\,1)`;
  const sign = dir === 'y' && inPart ? '+' : '-';
  return `${sign}${SLIDE}*(1-${p})`;
}

/**
 * Bagian filter ffmpeg untuk satu teks: rantai pada input PNG (fade alpha, geser waktu ke start)
 * dan opsi overlay (posisi x/y sebagai ekspresi waktu).
 */
export function textOverlay(t: AnimInput, end: number): { chain: string; x: string; y: string } {
  const d = animLen({ ...t, end });
  const len = end - t.start;
  const parts = ['format=rgba'];
  if (t.animIn !== 'none') parts.push(`fade=t=in:st=0:d=${f4(d)}:alpha=1`);
  if (t.animOut !== 'none') parts.push(`fade=t=out:st=${f4(len - d)}:d=${f4(d)}:alpha=1`);
  parts.push(`setpts=PTS-STARTPTS+${f4(t.start)}/TB`);
  const xs =
    slideExpr(t.animIn, 'x', true, t.start, end, d) +
    slideExpr(t.animOut, 'x', false, t.start, end, d);
  const ys =
    slideExpr(t.animIn, 'y', true, t.start, end, d) +
    slideExpr(t.animOut, 'y', false, t.start, end, d);
  return {
    chain: parts.join(','),
    x: xs ? `'W*(0${xs})'` : '0',
    y: ys ? `'H*(0${ys})'` : '0',
  };
}

/** Gaya siap pakai untuk teks. */
export const TEXT_STYLES = {
  title: { font: 'bebas', size: 'l', position: 'center', align: 'center', color: '#ffffff', stroke: false, shadow: true, box: false, animIn: 'up', animOut: 'fade' },
  caption: { font: 'jakarta', size: 's', position: 'bottom', align: 'center', color: '#ffffff', stroke: false, shadow: false, box: true, boxColor: '#000000', boxOpacity: 0.6, animIn: 'fade', animOut: 'fade' },
  quote: { font: 'playfair', size: 'm', position: 'center', align: 'center', color: '#fff7e6', stroke: false, shadow: true, box: false, animIn: 'fade', animOut: 'fade' },
  fun: { font: 'pacifico', size: 'm', position: 'top', align: 'center', color: '#ffd23f', stroke: true, shadow: true, box: false, animIn: 'left', animOut: 'fade' },
  hand: { font: 'caveat', size: 'l', position: 'bottom', align: 'left', color: '#ffffff', stroke: false, shadow: true, box: false, animIn: 'fade', animOut: 'none' },
} as const satisfies Record<string, Partial<TextLayer>>; // prettier-ignore
export type TextStyleId = keyof typeof TEXT_STYLES;
