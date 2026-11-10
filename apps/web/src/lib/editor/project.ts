/**
 * Model proyek editor video dan operasi timeline (fungsi murni, tanpa DOM, agar mudah dites).
 *
 * Timeline: klip video/gambar diputar berurutan; teks tampil di atas video pada rentang waktu
 * tertentu; satu musik latar opsional. Semua waktu dalam detik.
 */

export type MediaKind = 'video' | 'image' | 'audio';
export type Aspect = '16:9' | '9:16' | '1:1' | '4:5';
export type Quality = '480' | '720' | '1080';
export type Fit = 'fit' | 'fill';
export type TextPosition = 'top' | 'center' | 'bottom';
export type TextSize = 's' | 'm' | 'l';

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
}

export interface TextLayer {
  id: string;
  text: string;
  start: number;
  end: number;
  position: TextPosition;
  size: TextSize;
  color: string;
  /** Kotak gelap di belakang teks agar mudah dibaca. */
  box: boolean;
}

export interface Music {
  mediaId: string;
  /** Mulai dari detik ke berapa di lagu. */
  offset: number;
  volume: number;
  fadeOut: boolean;
}

export interface Settings {
  aspect: Aspect;
  quality: Quality;
  /** Fade dari dan ke hitam di awal dan akhir video. */
  fade: boolean;
}

export interface Project {
  name: string;
  settings: Settings;
  media: MediaItem[];
  clips: Clip[];
  texts: TextLayer[];
  music: Music | null;
}

export const IMAGE_SECONDS = 3;
export const MIN_CLIP = 0.2;
export const MAX_CLIPS = 100;
export const MAX_TEXTS = 30;
export const FPS = 30;

export function newProject(name = ''): Project {
  return {
    name,
    settings: { aspect: '16:9', quality: '720', fade: false },
    media: [],
    clips: [],
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

export const clipLength = (c: Clip) => Math.max(0, c.out - c.in);

export function totalDuration(p: Pick<Project, 'clips'>): number {
  return p.clips.reduce((s, c) => s + clipLength(c), 0);
}

/** Waktu mulai setiap klip di timeline. */
export function clipStarts(p: Pick<Project, 'clips'>): number[] {
  const out: number[] = [];
  let t = 0;
  for (const c of p.clips) {
    out.push(t);
    t += clipLength(c);
  }
  return out;
}

/** Klip yang aktif di waktu timeline t, beserta posisi di dalam media sumbernya. */
export function clipAt(
  p: Pick<Project, 'clips'>,
  t: number,
): { index: number; clip: Clip; local: number; start: number } | null {
  const starts = clipStarts(p);
  for (let i = 0; i < p.clips.length; i++) {
    const c = p.clips[i];
    const len = clipLength(c);
    if (t < starts[i] + len || i === p.clips.length - 1) {
      const local = Math.min(len, Math.max(0, t - starts[i]));
      return { index: i, clip: c, local: c.in + local, start: starts[i] };
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
    volume: 1,
    fit: 'fit',
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
  const used = new Set([...p.clips.map((c) => c.mediaId), ...(p.music ? [p.music.mediaId] : [])]);
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
export function textLayout(t: Pick<TextLayer, 'size' | 'position'>, w: number, h: number) {
  const base = Math.min(w, h);
  const font = Math.round(base * { s: 0.05, m: 0.075, l: 0.11 }[t.size]);
  const margin = Math.round(h * 0.07);
  const y = t.position === 'top' ? margin : t.position === 'center' ? h / 2 : h - margin;
  const baseline = t.position === 'top' ? 'top' : t.position === 'center' ? 'middle' : 'bottom';
  return {
    font,
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
