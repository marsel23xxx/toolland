/**
 * Gambar kecil berderet (filmstrip) untuk klip video dan gelombang suara untuk audio/video,
 * dibuat bertahap di latar belakang satu per satu agar editor tetap responsif.
 */
import { onBeforeUnmount, shallowRef } from 'vue';
import type { MediaItem } from '../../../../lib/editor/project';
import { computePeaks } from '../../../../lib/editor/timeline';

export interface Frame {
  /** Waktu di media sumber (detik). */
  t: number;
  url: string;
}

/** Tinggi gambar filmstrip (piksel). */
export const FRAME_H = 56;
/** File lebih besar dari ini tidak didekode untuk gelombang (memori). */
const MAX_DECODE_BYTES = 250 * 1024 ** 2;

function once(el: HTMLMediaElement, ev: string, ms = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('timeout')), ms);
    const ok = () => done();
    const fail = () => done(new Error('error'));
    function done(err?: Error) {
      clearTimeout(timer);
      el.removeEventListener(ev, ok);
      el.removeEventListener('error', fail);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(ev, ok);
    el.addEventListener('error', fail);
  });
}

export function useMediaPreviews() {
  const frames = shallowRef(new Map<string, Frame[]>());
  const peaks = shallowRef(new Map<string, Float32Array>());
  const alive = new Set<string>();
  const queue: (() => Promise<void>)[] = [];
  let running = false;

  function set<V>(r: { value: Map<string, V> }, id: string, v: V) {
    const next = new Map(r.value);
    next.set(id, v);
    r.value = next;
  }

  async function pump() {
    running = true;
    while (queue.length) {
      try {
        await queue.shift()!();
      } catch {
        // Pratinjau hanya pelengkap; kegagalan tidak mengganggu editor.
      }
    }
    running = false;
  }
  function enqueue(job: () => Promise<void>) {
    queue.push(job);
    if (!running) void pump();
  }

  async function filmstrip(m: MediaItem, url: string) {
    const n = Math.min(30, Math.max(4, Math.ceil(m.duration / 2)));
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.src = url;
    try {
      await once(v, 'loadeddata');
      const c = document.createElement('canvas');
      c.height = FRAME_H;
      c.width = Math.max(1, Math.round((FRAME_H * v.videoWidth) / (v.videoHeight || 1)));
      const ctx = c.getContext('2d');
      const list: Frame[] = [];
      for (let i = 0; i < n && alive.has(m.id); i++) {
        const t = ((i + 0.5) * m.duration) / n;
        v.currentTime = t;
        await once(v, 'seeked');
        ctx?.drawImage(v, 0, 0, c.width, c.height);
        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.6));
        if (!blob) continue;
        list.push({ t, url: URL.createObjectURL(blob) });
        // Tampilkan bertahap: gambar pertama segera, lalu setiap beberapa gambar.
        if (alive.has(m.id) && (list.length === 1 || list.length % 4 === 0 || i === n - 1))
          set(frames, m.id, [...list]);
      }
      if (!alive.has(m.id)) list.forEach((f) => URL.revokeObjectURL(f.url));
    } finally {
      v.removeAttribute('src');
      v.load();
    }
  }

  async function waveform(m: MediaItem, file: File) {
    if (file.size > MAX_DECODE_BYTES) return;
    // Didekode pada 8 kHz agar hemat memori; cukup untuk gambaran gelombang.
    const ctx = new OfflineAudioContext(1, 1, 8000);
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    if (!alive.has(m.id)) return;
    const channels = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) =>
      buf.getChannelData(i),
    );
    set(
      peaks,
      m.id,
      computePeaks(channels, Math.min(6000, Math.max(200, Math.ceil(buf.duration * 25)))),
    );
  }

  /** Mulai membuat pratinjau untuk satu media (dilewati bila sudah ada). */
  function add(m: MediaItem, url: string, file: File) {
    if (alive.has(m.id)) return;
    alive.add(m.id);
    if (m.kind === 'video') enqueue(() => filmstrip(m, url));
    if (m.kind !== 'image') enqueue(() => waveform(m, file));
  }

  function remove(id: string) {
    alive.delete(id);
    frames.value.get(id)?.forEach((f) => URL.revokeObjectURL(f.url));
    for (const r of [frames, peaks] as { value: Map<string, unknown> }[]) {
      if (!r.value.has(id)) continue;
      const next = new Map(r.value);
      next.delete(id);
      r.value = next;
    }
  }

  function clear() {
    for (const id of new Set([...alive, ...frames.value.keys(), ...peaks.value.keys()])) remove(id);
    queue.length = 0;
  }

  onBeforeUnmount(clear);
  return { frames, peaks, add, remove, clear };
}
