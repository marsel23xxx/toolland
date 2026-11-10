/**
 * Logika interaksi timeline (fungsi murni, dites terpisah): snapping, tarik ujung klip, geser
 * urutan, lajur teks yang bertumpuk, dan ringkasan gelombang suara.
 */
import {
  type Clip,
  type MediaItem,
  type Overlay,
  type Project,
  type TextLayer,
  MIN_CLIP,
  clipLength,
  clipStarts,
  totalDuration,
} from './project';

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Jarak tarik magnet dalam piksel layar. */
export const SNAP_PX = 8;

/** Tempelkan nilai ke target terdekat bila jaraknya di bawah ambang (detik). */
export function snap(
  value: number,
  targets: number[],
  threshold: number,
): { value: number; hit: number | null } {
  let best: number | null = null;
  for (const t of targets)
    if (
      Math.abs(t - value) <= threshold &&
      (best === null || Math.abs(t - value) < Math.abs(best - value))
    )
      best = t;
  return best === null ? { value, hit: null } : { value: best, hit: best };
}

export interface SnapOptions {
  playhead: number;
  /** Batas klip dengan indeks ini tidak dipakai sebagai target. */
  excludeClipEdges?: number[];
  /** Hanya batas klip sampai indeks ini (batas setelahnya ikut bergeser saat ditarik). */
  clipEdgesUntil?: number;
  excludeText?: string;
}

/**
 * Titik magnet: playhead, batas antarklip (indeks batas k = awal klip k, batas terakhir = akhir
 * video), serta awal dan akhir setiap teks.
 */
export function snapTargets(
  p: Pick<Project, 'clips' | 'texts'> & { overlays?: Overlay[] },
  o: SnapOptions,
): number[] {
  const starts = clipStarts(p);
  const edges = [...starts, totalDuration(p)];
  const out = [o.playhead];
  edges.forEach((t, k) => {
    if (o.excludeClipEdges?.includes(k)) return;
    if (o.clipEdgesUntil !== undefined && k > o.clipEdgesUntil) return;
    out.push(t);
  });
  for (const t of p.texts) if (t.id !== o.excludeText) out.push(t.start, t.end);
  for (const v of p.overlays ?? [])
    if (v.id !== o.excludeText) out.push(v.start, v.start + v.out - v.in);
  return out;
}

/**
 * Tarik ujung klip sejauh delta detik dari keadaan awal tarikan. Ujung kiri ke kanan = awal
 * dipotong; ujung kanan ke kanan = klip lebih panjang. Gambar hanya berubah durasinya.
 */
export function trimClip(
  c: Clip,
  m: MediaItem | undefined,
  edge: 'in' | 'out',
  delta: number,
): Clip {
  if (!m || m.kind === 'image') {
    const len = clipLength(c) + (edge === 'in' ? -delta : delta);
    return { ...c, in: 0, out: round(Math.max(MIN_CLIP, Math.min(3600, len))) };
  }
  // delta dalam detik timeline; di media sumber dikali kecepatan.
  const d = delta * (c.speed || 1);
  if (edge === 'in') return { ...c, in: round(Math.max(0, Math.min(c.out - MIN_CLIP, c.in + d))) };
  return { ...c, out: round(Math.max(c.in + MIN_CLIP, Math.min(m.duration, c.out + d))) };
}

/**
 * Posisi tujuan klip yang digeser: banyaknya klip lain yang titik tengahnya ada di kiri waktu t
 * (waktu titik tengah klip yang digeser).
 */
export function reorderTarget(lengths: number[], from: number, t: number): number {
  let pos = 0;
  let target = 0;
  lengths.forEach((len, i) => {
    if (i === from) return;
    if (pos + len / 2 < t) target++;
    pos += len;
  });
  return target;
}

/** Waktu mulai setiap klip bila urutannya diubah sementara (from dipindah ke to). */
export function previewStarts(lengths: number[], from: number, to: number): number[] {
  const order = lengths.map((_, i) => i);
  if (from >= 0 && to >= 0 && from !== to) {
    const [x] = order.splice(from, 1);
    order.splice(to, 0, x);
  }
  const starts = new Array<number>(lengths.length);
  let t = 0;
  for (const i of order) {
    starts[i] = t;
    t += lengths[i];
  }
  return starts;
}

/** Bagi teks ke lajur agar yang waktunya bertumpuk tidak saling menutupi. */
export function textLanes(texts: Pick<TextLayer, 'id' | 'start' | 'end'>[]): {
  lane: Map<string, number>;
  count: number;
} {
  const lane = new Map<string, number>();
  const ends: number[] = [];
  for (const t of [...texts].sort((a, b) => a.start - b.start || a.end - b.end)) {
    let i = ends.findIndex((e) => e <= t.start + 1e-6);
    if (i < 0) i = ends.push(0) - 1;
    ends[i] = t.end;
    lane.set(t.id, i);
  }
  return { lane, count: Math.max(1, ends.length) };
}

/**
 * Ringkas sampel audio menjadi n puncak 0-1 (nilai absolut terbesar per kelompok). Dipakai sekali
 * per media setelah audio didekode.
 */
export function computePeaks(channels: Float32Array[], n: number): Float32Array {
  const len = channels[0]?.length ?? 0;
  const out = new Float32Array(n);
  if (!len) return out;
  const step = len / n;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step);
    const b = Math.max(a + 1, Math.floor((i + 1) * step));
    // Lompat-lompat agar cepat untuk audio panjang; cukup untuk gambaran visual.
    const stride = Math.max(1, Math.floor((b - a) / 64));
    let peak = 0;
    for (const ch of channels)
      for (let j = a; j < b && j < len; j += stride) {
        const v = Math.abs(ch[j]);
        if (v > peak) peak = v;
      }
    out[i] = peak;
    if (peak > max) max = peak;
  }
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

/**
 * Ambil count nilai puncak untuk rentang waktu [from, to) dari media berdurasi duration.
 * loop = rentang di luar durasi diulang dari awal (musik latar diputar berulang).
 */
export function peaksRange(
  peaks: Float32Array,
  duration: number,
  from: number,
  to: number,
  count: number,
  loop = false,
): number[] {
  const out: number[] = [];
  if (!peaks.length || duration <= 0 || count <= 0) return out;
  const per = peaks.length / duration;
  const span = (to - from) / count;
  for (let i = 0; i < count; i++) {
    let a = from + i * span;
    let b = a + span;
    if (loop) {
      a %= duration;
      b = a + span;
    }
    const ia = Math.floor(a * per);
    const ib = Math.max(ia + 1, Math.ceil(b * per));
    let v = 0;
    for (let j = ia; j < ib; j++) {
      const idx = loop ? j % peaks.length : j;
      if (idx >= 0 && idx < peaks.length && peaks[idx] > v) v = peaks[idx];
    }
    out.push(v);
  }
  return out;
}

/** Path SVG gelombang simetris dari nilai 0-1 untuk kotak lebar w dan tinggi h. */
export function waveformPath(values: number[], w: number, h: number): string {
  if (!values.length) return '';
  const step = w / values.length;
  const mid = h / 2;
  const top: string[] = [];
  const bottom: string[] = [];
  values.forEach((v, i) => {
    const x = round(i * step + step / 2);
    const d = round(Math.max(0.5, v * mid));
    top.push(`${x},${round(mid - d)}`);
    bottom.unshift(`${x},${round(mid + d)}`);
  });
  return `M0,${mid} L${top.join(' L')} L${w},${mid} L${bottom.join(' L')} Z`;
}

/** Pilih gambar filmstrip terdekat dengan waktu sumber t. */
export function nearestFrame<T extends { t: number }>(frames: T[], t: number): T | undefined {
  let best: T | undefined;
  for (const f of frames) if (!best || Math.abs(f.t - t) < Math.abs(best.t - t)) best = f;
  return best;
}
