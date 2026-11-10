/**
 * Model proyek editor video dan operasi timeline (fungsi murni, tanpa DOM, agar mudah dites).
 *
 * Timeline: klip video/gambar diputar berurutan; teks tampil di atas video pada rentang waktu
 * tertentu; satu musik latar opsional. Semua waktu dalam detik.
 */

export type MediaKind = 'video' | 'image' | 'audio';
export type Aspect = '16:9' | '9:16' | '1:1' | '4:5';
export type Quality = '480' | '720' | '1080';
/** fit = utuh dengan latar warna, fill = memenuhi bingkai (terpotong), blur = utuh di atas versi blur. */
export type Fit = 'fit' | 'fill' | 'blur';
export type Rotate = 0 | 90 | 180 | 270;
export type ColorPreset = 'none' | 'warm' | 'cool' | 'bw' | 'vintage' | 'vivid' | 'fade';
/** Gerak pelan untuk foto: zoom masuk/keluar atau geser ke kiri/kanan. */
export type KenBurns = 'none' | 'in' | 'out' | 'left' | 'right';
export type Fps = 24 | 30 | 60;
export type TextPosition = 'top' | 'center' | 'bottom' | 'custom';
/**
 * Transisi ke klip berikutnya.
 * black/white: pudar lewat warna (durasi total tetap).
 * cross/wipe/slide/circle: kedua klip bertumpuk selama transisi (durasi total berkurang).
 */
export type Transition = 'none' | 'black' | 'white' | 'cross' | 'wipe' | 'slide' | 'circle';
export const OVERLAP_TRANSITIONS = ['cross', 'wipe', 'slide', 'circle'] as const;
/** Nama transisi xfade ffmpeg untuk transisi bertumpuk. */
export const XFADE: Record<(typeof OVERLAP_TRANSITIONS)[number], string> = {
  cross: 'fade',
  wipe: 'wipeleft',
  slide: 'slideleft',
  circle: 'circleopen',
};
export const isOverlap = (t: Transition): t is (typeof OVERLAP_TRANSITIONS)[number] =>
  (OVERLAP_TRANSITIONS as readonly string[]).includes(t);
export type TextSize = 's' | 'm' | 'l';
export type TextAlign = 'left' | 'center' | 'right';
export type FontId = 'jakarta' | 'bebas' | 'montserrat' | 'playfair' | 'caveat' | 'pacifico';
/** Animasi masuk/keluar teks: pudar, atau pudar sambil bergeser dari bawah/kiri. */
export type TextAnim = 'none' | 'fade' | 'up' | 'left';

/** Berkas sumber. File-nya sendiri disimpan terpisah (tidak ikut JSON proyek). */
export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  size: number;
  /** Durasi asli (detik); gambar = 0. */
  duration: number;
  width: number;
  height: number;
  lastModified: number;
}

export interface Clip {
  id: string;
  mediaId: string;
  /** Titik masuk dan keluar di media sumber. Untuk gambar: 0 dan durasi tampil. */
  in: number;
  out: number;
  /** Volume audio klip, 0-2 (1 = asli). */
  volume: number;
  fit: Fit;
  /** Transisi dari klip ini ke klip berikutnya (tidak mengubah durasi total). */
  trans: Transition;
  /** Lama transisi (detik), dibagi dua: separuh di akhir klip ini, separuh di awal berikutnya. */
  transDur: number;
  /** Kecepatan putar 0,25-4 (video saja). Panjang di timeline = (out - in) / speed. */
  speed: number;
  /** Fade audio di awal dan akhir klip (detik timeline). */
  fadeIn: number;
  fadeOut: number;
  rotate: Rotate;
  flipH: boolean;
  flipV: boolean;
  /** Zoom manual 1-3 dan titik geser -1..1 (0 = tengah). */
  zoom: number;
  panX: number;
  panY: number;
  /** Penyesuaian warna: kecerahan dan kontras 0,5-1,5, saturasi 0-2 (1 = asli). */
  brightness: number;
  contrast: number;
  saturation: number;
  preset: ColorPreset;
  kenBurns: KenBurns;
}

/** Nilai bawaan semua pengaturan klip selain sumber dan potongan. */
export const CLIP_DEFAULTS = {
  volume: 1,
  fit: 'fit',
  trans: 'none',
  transDur: 0.8,
  speed: 1,
  fadeIn: 0,
  fadeOut: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  preset: 'none',
  kenBurns: 'none',
} as const satisfies Omit<Clip, 'id' | 'mediaId' | 'in' | 'out'>;

export interface TextLayer {
  id: string;
  text: string;
  start: number;
  end: number;
  position: TextPosition;
  size: TextSize;
  color: string;
  /** Kotak di belakang teks agar mudah dibaca. */
  box: boolean;
  /** Titik tengah teks untuk posisi 'custom', relatif 0-1 terhadap lebar dan tinggi video. */
  x: number;
  y: number;
  font: FontId;
  align: TextAlign;
  /** Garis tepi gelap dan bayangan. */
  stroke: boolean;
  shadow: boolean;
  boxColor: string;
  /** Kepekatan kotak 0-1. */
  boxOpacity: number;
  animIn: TextAnim;
  animOut: TextAnim;
  /** Lama animasi (detik). */
  animDur: number;
}

export const TEXT_DEFAULTS = {
  position: 'bottom',
  size: 'm',
  color: '#ffffff',
  box: false,
  x: 0.5,
  y: 0.8,
  font: 'jakarta',
  align: 'center',
  stroke: true,
  shadow: false,
  boxColor: '#000000',
  boxOpacity: 0.6,
  animIn: 'none',
  animOut: 'none',
  animDur: 0.4,
} as const satisfies Omit<TextLayer, 'id' | 'text' | 'start' | 'end'>;

export interface Music {
  mediaId: string;
  /** Mulai dari detik ke berapa di lagu. */
  offset: number;
  volume: number;
  /** Rentang waktu musik di timeline; end = null berarti sampai akhir video. */
  start: number;
  end: number | null;
  /** Fade in/out musik (detik). */
  fadeIn: number;
  fadeOut: number;
  /** Musik otomatis mengecil saat klip video bersuara. */
  duck: boolean;
}

export const MUSIC_DEFAULTS = {
  offset: 0,
  volume: 0.6,
  start: 0,
  end: null,
  fadeIn: 0,
  fadeOut: 2,
  duck: false,
} as const satisfies Omit<Music, 'mediaId'>;

/** Kepekatan musik saat diredam (ducking) dan lama peralihannya. */
export const DUCK_LEVEL = 0.3;
export const DUCK_RAMP = 0.3;

/** Rentang musik yang benar-benar terdengar [start, end) di dalam durasi total. */
export function musicSpan(
  m: Pick<Music, 'start' | 'end'>,
  total: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.min(m.start, total));
  const end = Math.max(start, Math.min(m.end ?? total, total));
  return { start, end };
}

/**
 * Rentang waktu klip video yang bersuara (untuk ducking). withAudio = mediaId yang punya audio;
 * bila tidak diketahui, semua klip video bervolume dianggap bersuara.
 */
export function voicedSpans(
  p: Pick<Project, 'clips' | 'media'>,
  withAudio?: Set<string>,
): [number, number][] {
  const out: [number, number][] = [];
  const starts = clipStarts(p);
  p.clips.forEach((c, i) => {
    const len = clipLength(c);
    const t = starts[i];
    const m = p.media.find((x) => x.id === c.mediaId);
    if (m?.kind === 'video' && c.volume > 0 && (!withAudio || withAudio.has(m.id))) {
      const last = out.at(-1);
      if (last && last[1] >= t - 1e-6) last[1] = Math.max(last[1], t + len);
      else out.push([t, t + len]);
    }
  });
  return out;
}

/** Penguatan musik akibat ducking pada waktu t (sama untuk pratinjau dan ekspor). */
export function duckGain(spans: [number, number][], t: number): number {
  let g = 1;
  for (const [a, b] of spans) {
    const ramp = Math.max(0, Math.min(1, (t - a) / DUCK_RAMP, (b - t) / DUCK_RAMP));
    g = Math.min(g, 1 - (1 - DUCK_LEVEL) * ramp);
  }
  return g;
}

/** Penguatan fade in/out musik pada waktu t. */
export function musicFadeGain(
  m: Pick<Music, 'fadeIn' | 'fadeOut'>,
  span: { start: number; end: number },
  t: number,
): number {
  let g = 1;
  if (m.fadeIn > 0) g = Math.min(g, (t - span.start) / m.fadeIn);
  if (m.fadeOut > 0) g = Math.min(g, (span.end - t) / m.fadeOut);
  return Math.max(0, Math.min(1, g));
}

export interface Settings {
  aspect: Aspect;
  quality: Quality;
  /** Fade dari dan ke hitam di awal dan akhir video. */
  fade: boolean;
  /** Warna latar untuk klip "Pas" (bingkai di sisi video). */
  bg: string;
  fps: Fps;
}

export type OverlayKind = 'media' | 'emoji' | 'shape';
export type ShapeKind = 'rect' | 'round' | 'circle';

/**
 * Lapisan di atas video utama: video/foto (picture-in-picture, logo), stiker emoji, atau bentuk.
 * Urutan di array = urutan lapisan (belakang ke depan).
 */
export interface Overlay {
  id: string;
  kind: OverlayKind;
  /** Media sumber (kind 'media'); kosong untuk emoji/bentuk. */
  mediaId: string;
  char: string;
  shape: ShapeKind;
  fill: string;
  /** Waktu mulai di timeline; in/out = potongan sumber (non-video: in 0, out = durasi). */
  start: number;
  in: number;
  out: number;
  /** Titik tengah (0-1) dan lebar relatif terhadap lebar video. */
  x: number;
  y: number;
  w: number;
  /** Tinggi / lebar dalam piksel (dari media, 1 untuk emoji, bebas untuk bentuk). */
  ratio: number;
  rotate: number;
  opacity: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export const OVERLAY_DEFAULTS = {
  mediaId: '',
  char: '',
  shape: 'rect',
  fill: '#ffd23f',
  x: 0.75,
  y: 0.25,
  w: 0.3,
  ratio: 1,
  rotate: 0,
  opacity: 1,
  volume: 0,
  fadeIn: 0,
  fadeOut: 0,
} as const satisfies Partial<Overlay>;

export const overlayLength = (o: Pick<Overlay, 'in' | 'out'>) => Math.max(0, o.out - o.in);
export const overlayEnd = (o: Pick<Overlay, 'start' | 'in' | 'out'>) => o.start + overlayLength(o);

/** Kepekatan overlay pada waktu t (fade masuk/keluar dikali opacity). */
export function overlayAlpha(o: Overlay, t: number): number {
  const len = overlayLength(o);
  const off = t - o.start;
  if (off < 0 || off >= len) return 0;
  let g = 1;
  if (o.fadeIn > 0) g = Math.min(g, off / o.fadeIn);
  if (o.fadeOut > 0) g = Math.min(g, (len - off) / o.fadeOut);
  return Math.max(0, Math.min(1, g)) * o.opacity;
}

/** Ukuran overlay dalam piksel untuk video w x h (genap, minimal 2). */
export function overlayPixels(
  o: Pick<Overlay, 'w' | 'ratio'>,
  w: number,
): { pw: number; ph: number } {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const pw = even(o.w * w);
  return { pw, ph: even(pw * o.ratio) };
}

export interface Project {
  name: string;
  settings: Settings;
  media: MediaItem[];
  clips: Clip[];
  overlays: Overlay[];
  texts: TextLayer[];
  music: Music | null;
}

export const IMAGE_SECONDS = 3;
export const MIN_CLIP = 0.2;
export const MAX_CLIPS = 100;
export const MAX_TEXTS = 30;
export const MAX_OVERLAYS = 20;
export const FPS = 30;

export function newProject(name = ''): Project {
  return {
    name,
    settings: { aspect: '16:9', quality: '720', fade: false, bg: '#000000', fps: 30 },
    media: [],
    clips: [],
    overlays: [],
    texts: [],
    music: null,
  };
}

let counter = 0;
/** ID pendek unik dalam satu sesi (cukup untuk kunci di proyek). */
export function uid(prefix: string): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Ukuran keluaran (genap, sesuai syarat H.264) untuk rasio dan kualitas. */
export function outputSize(aspect: Aspect, quality: Quality): { w: number; h: number } {
  const short = Number(quality);
  const even = (n: number) => Math.round(n / 2) * 2;
  switch (aspect) {
    case '16:9':
      return { w: even((short * 16) / 9), h: short };
    case '9:16':
      return { w: short, h: even((short * 16) / 9) };
    case '1:1':
      return { w: short, h: short };
    case '4:5':
      return { w: short, h: even((short * 5) / 4) };
  }
}

/** Panjang klip di timeline (memperhitungkan kecepatan). */
export const clipLength = (c: Pick<Clip, 'in' | 'out'> & { speed?: number }) =>
  Math.max(0, (c.out - c.in) / (c.speed || 1));

/**
 * Lama tumpukan di batas klip i dan i+1 untuk transisi bertumpuk (0 untuk transisi lain).
 * Dibatasi separuh panjang klip yang lebih pendek agar tidak ada tiga klip bertumpuk.
 */
export function transitionOverlap(p: Pick<Project, 'clips'>, i: number): number {
  const a = p.clips[i];
  const b = p.clips[i + 1];
  if (!a || !b || !isOverlap(a.trans)) return 0;
  return round(Math.max(0, Math.min(a.transDur, clipLength(a) / 2, clipLength(b) / 2)));
}

/** Waktu mulai setiap klip di timeline (klip berikutnya maju sebesar tumpukan transisi). */
export function clipStarts(p: Pick<Project, 'clips'>): number[] {
  const out: number[] = [];
  let t = 0;
  p.clips.forEach((c, i) => {
    out.push(round(t));
    t += clipLength(c) - transitionOverlap(p, i);
  });
  return out;
}

export function totalDuration(p: Pick<Project, 'clips'>): number {
  const n = p.clips.length;
  if (!n) return 0;
  return round(clipStarts(p)[n - 1] + clipLength(p.clips[n - 1]));
}

/**
 * Klip yang aktif di waktu timeline t, beserta posisi di dalam media sumbernya. Selama transisi
 * bertumpuk, yang dikembalikan adalah klip yang baru masuk.
 */
export function clipAt(
  p: Pick<Project, 'clips'>,
  t: number,
): { index: number; clip: Clip; local: number; start: number } | null {
  if (!p.clips.length) return null;
  const starts = clipStarts(p);
  let i = p.clips.length - 1;
  while (i > 0 && t < starts[i]) i--;
  const c = p.clips[i];
  const off = Math.min(clipLength(c), Math.max(0, t - starts[i]));
  return { index: i, clip: c, local: c.in + off * (c.speed || 1), start: starts[i] };
}

/** Posisi sumber klip i pada waktu timeline t (dibatasi di dalam klip). */
export function localAt(
  p: Pick<Project, 'clips'>,
  i: number,
  t: number,
  starts = clipStarts(p),
): number {
  const c = p.clips[i];
  const off = Math.min(clipLength(c), Math.max(0, t - starts[i]));
  return c.in + off * (c.speed || 1);
}

/** Transisi bertumpuk yang sedang berlangsung pada waktu t: klip keluar, klip masuk, kemajuan 0-1. */
export function overlapAt(
  p: Pick<Project, 'clips'>,
  t: number,
): {
  out: number;
  in: number;
  progress: number;
  kind: (typeof OVERLAP_TRANSITIONS)[number];
} | null {
  const starts = clipStarts(p);
  for (let i = 0; i < p.clips.length - 1; i++) {
    const d = transitionOverlap(p, i);
    if (d > 0 && t >= starts[i + 1] && t < starts[i + 1] + d) {
      const kind = p.clips[i].trans as (typeof OVERLAP_TRANSITIONS)[number];
      return { out: i, in: i + 1, progress: (t - starts[i + 1]) / d, kind };
    }
  }
  return null;
}

export function mediaOf(p: Pick<Project, 'media'>, id: string): MediaItem | undefined {
  return p.media.find((m) => m.id === id);
}

/** Klip baru untuk satu media: video utuh, atau gambar selama IMAGE_SECONDS. */
export function clipFor(m: MediaItem): Clip {
  return {
    id: uid('c'),
    mediaId: m.id,
    in: 0,
    out: m.kind === 'image' ? IMAGE_SECONDS : m.duration,
    ...CLIP_DEFAULTS,
  };
}

/** Rapikan titik masuk/keluar agar tetap di dalam media dan panjang minimal MIN_CLIP. */
export function clampClip(c: Clip, m: MediaItem | undefined): Clip {
  const max = m && m.kind === 'video' ? m.duration : 3600;
  let inn = Math.max(0, Math.min(c.in, max - MIN_CLIP));
  let out = Math.max(inn + MIN_CLIP, Math.min(c.out, max));
  if (m?.kind === 'image') {
    inn = 0;
    out = Math.max(MIN_CLIP, Math.min(c.out - c.in, 3600));
  }
  return { ...c, in: round(inn), out: round(out), volume: Math.max(0, Math.min(2, c.volume)) };
}

/** Potong klip di waktu timeline t menjadi dua. Mengembalikan proyek baru (atau yang sama). */
export function splitAt(p: Project, t: number): Project {
  const hit = clipAt(p, t);
  if (!hit) return p;
  const { index, clip, local } = hit;
  if (local - clip.in < MIN_CLIP || clip.out - local < MIN_CLIP) return p;
  const media = mediaOf(p, clip.mediaId);
  const first = { ...clip, out: round(local) };
  const second = { ...clip, id: uid('c'), in: round(local) };
  if (media?.kind === 'image') {
    first.in = 0;
    first.out = round(local - clip.in);
    second.in = 0;
    second.out = round(clip.out - local);
  }
  const clips = [...p.clips];
  clips.splice(index, 1, first, second);
  return { ...p, clips };
}

export function moveClip(p: Project, from: number, to: number): Project {
  if (from === to || from < 0 || to < 0 || from >= p.clips.length || to >= p.clips.length) return p;
  const clips = [...p.clips];
  const [c] = clips.splice(from, 1);
  clips.splice(to, 0, c);
  return { ...p, clips };
}

/** Hapus media yang tidak dipakai klip maupun musik. */
export function pruneMedia(p: Project): Project {
  const used = new Set([
    ...p.clips.map((c) => c.mediaId),
    ...p.overlays.map((o) => o.mediaId),
    ...(p.music ? [p.music.mediaId] : []),
  ]);
  return { ...p, media: p.media.filter((m) => used.has(m.id)) };
}

/** Teks dirapikan: tidak keluar dari durasi video dan panjang minimal 0,5 detik. */
export function clampText(t: TextLayer, total: number): TextLayer {
  const end = Math.max(0.5, total);
  const start = Math.max(0, Math.min(t.start, end - 0.5));
  return {
    ...t,
    start: round(start),
    end: round(Math.max(start + 0.5, Math.min(t.end, end))),
    text: t.text.slice(0, 200),
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Tata letak teks yang sama untuk pratinjau (CSS) dan ekspor (canvas): ukuran huruf dan posisi
 * relatif terhadap tinggi video.
 */
export function textLayout(
  t: Pick<TextLayer, 'size' | 'position'> & Partial<Pick<TextLayer, 'x' | 'y'>>,
  w: number,
  h: number,
) {
  const base = Math.min(w, h);
  const font = Math.round(base * { s: 0.05, m: 0.075, l: 0.11 }[t.size]);
  const margin = Math.round(h * 0.07);
  const custom = t.position === 'custom';
  const y = custom
    ? h * (t.y ?? 0.5)
    : t.position === 'top'
      ? margin
      : t.position === 'center'
        ? h / 2
        : h - margin;
  const baseline = t.position === 'top' ? 'top' : t.position === 'bottom' ? 'bottom' : 'middle';
  return {
    font,
    x: custom ? w * (t.x ?? 0.5) : w / 2,
    y,
    baseline: baseline as 'top' | 'middle' | 'bottom',
    maxWidth: w * 0.9,
    pad: Math.round(font * 0.35),
  };
}

/** Pecah teks menjadi baris yang muat di lebar maksimal (measure = lebar teks dalam piksel). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines.slice(0, 6);
}

/** Panjang separuh transisi di batas klip i dan i+1 (0 bila tidak ada transisi). */
export function transitionHalf(p: Pick<Project, 'clips'>, i: number): number {
  const a = p.clips[i];
  const b = p.clips[i + 1];
  if (!a || !b || (a.trans !== 'black' && a.trans !== 'white')) return 0;
  return round(Math.max(0, Math.min(a.transDur / 2, clipLength(a) / 2, clipLength(b) / 2)));
}

/** Pudar masuk dan keluar untuk klip k (dipakai ekspor dan pratinjau). */
export function clipFades(p: Pick<Project, 'clips'>, k: number) {
  const prev = p.clips[k - 1];
  return {
    in: transitionHalf(p, k - 1),
    inColor: prev?.trans === 'white' ? 'white' : 'black',
    out: transitionHalf(p, k),
    outColor: p.clips[k]?.trans === 'white' ? 'white' : 'black',
  } as const;
}

/** Warna dan kepekatan lapisan transisi di waktu t (0 = tidak terlihat, 1 = penuh). */
export function transitionAt(
  p: Pick<Project, 'clips'>,
  t: number,
): { alpha: number; color: string } {
  const hit = clipAt(p, t);
  if (!hit) return { alpha: 0, color: 'black' };
  const f = clipFades(p, hit.index);
  const pos = t - hit.start;
  const len = clipLength(hit.clip);
  if (f.in && pos < f.in) return { alpha: 1 - pos / f.in, color: f.inColor };
  if (f.out && len - pos < f.out) return { alpha: 1 - (len - pos) / f.out, color: f.outColor };
  return { alpha: 0, color: 'black' };
}
