<script setup lang="ts">
/**
 * Timeline interaktif editor video.
 * - Penggaris/area kosong/playhead: geser untuk scrub.
 * - Klip: geser untuk ubah urutan, tarik ujung kiri/kanan untuk memotong (klip lain menyesuaikan).
 * - Teks: geser untuk pindah waktu, tarik ujung untuk ubah durasi; teks bertumpuk dibagi lajur.
 * - Musik: geser untuk memilih bagian lagu yang diputar.
 * - Magnet ke playhead, batas klip, dan tepi teks (tahan Alt untuk menonaktifkan sementara).
 * - Zoom: Ctrl + scroll atau slider; klik kanan untuk menu cepat.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Messages } from '../../../../i18n';
import { fill } from '../../../../lib/format';
import { formatTime } from '../../../../lib/media/ffmpeg';
import {
  type Clip,
  type Project,
  clipLength,
  clipStarts,
  mediaOf,
  musicSpan,
  overlayEnd,
  totalDuration,
  type Overlay,
  type AudioItem,
} from '../../../../lib/editor/project';
import {
  SNAP_PX,
  nearestFrame,
  peaksRange,
  previewStarts,
  reorderTarget,
  snap,
  snapTargets,
  textLanes,
  trimClip,
  waveformPath,
} from '../../../../lib/editor/timeline';
import { FRAME_H, type Frame } from './useMediaPreviews';

export type TimelineAction =
  'split' | 'duplicate' | 'remove' | 'copyStyle' | 'pasteStyle' | 'duplicateText' | 'removeText';

const props = defineProps<{
  project: Project;
  time: number;
  playing: boolean;
  selectedClip: string;
  selectedText: string;
  selectedOverlay: string;
  selectedAudio: string;
  frames: Map<string, Frame[]>;
  peaks: Map<string, Float32Array>;
  thumbs: Map<string, string>;
  missing: Set<string>;
  canPasteStyle: boolean;
  t: Messages<'editor'>;
}>();
const emit = defineEmits<{
  seek: [t: number];
  selectClip: [id: string];
  selectText: [id: string];
  selectOverlay: [id: string];
  updateOverlay: [id: string, patch: Partial<Overlay>];
  insertOverlay: [mediaId: string, start: number];
  selectAudio: [id: string];
  updateAudio: [id: string, patch: Partial<AudioItem>];
  insertAudio: [mediaId: string, start: number];
  selectMusic: [];
  move: [from: number, to: number];
  trimClip: [index: number, clip: Clip];
  updateText: [id: string, patch: { start: number; end: number }];
  updateMusic: [patch: { offset?: number; start?: number; end?: number | null }];
  action: [kind: TimelineAction, id: string];
  insertMedia: [mediaId: string, index: number];
}>();

const PAD = 12;
const scroller = ref<HTMLDivElement>();
const inner = ref<HTMLDivElement>();
const width = ref(800);
const zoom = ref(1);
const snapOn = ref(true);
const snapLine = ref<number | null>(null);

const total = computed(() => totalDuration(props.project));
const span = computed(() => Math.max(1, total.value));
/** Piksel per detik: zoom 1 = seluruh video muat di layar. */
const pps = computed(() => Math.max(4, (width.value - PAD * 2 - 40) / span.value) * zoom.value);
const lengths = computed(() => props.project.clips.map(clipLength));
const starts = computed(() => clipStarts(props.project));
const px = (t: number) => Math.round(t * pps.value);
const innerWidth = computed(() => px(span.value) + 120);

const ticks = computed(() => {
  const steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s * pps.value >= 64) ?? 600;
  const out: number[] = [];
  for (let t = 0; t <= span.value + 0.001; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
});
const tickLabel = (t: number) =>
  t % 1 ? `${formatTime(Math.floor(t))}.${Math.round((t % 1) * 100)}` : formatTime(t);

// ---------- Status tarikan ----------

type Drag =
  | { kind: 'scrub' }
  | {
      kind: 'clip';
      index: number;
      startX: number;
      grab: number;
      x: number;
      target: number;
      moved: boolean;
    }
  | {
      kind: 'trim';
      index: number;
      edge: 'in' | 'out';
      orig: Clip;
      origStart: number;
      origLen: number;
      startT: number;
      applied: number;
      targets: number[];
    }
  | {
      kind: 'overlay';
      /** Overlay atau audio tambahan (aturan geser/potong sama). */
      target: 'overlay' | 'audio';
      id: string;
      mode: 'move' | 'start' | 'end';
      start: number;
      inn: number;
      out: number;
      /** Durasi sumber video (Infinity untuk foto/stiker/bentuk). */
      max: number;
      startT: number;
      startX: number;
      moved: boolean;
      targets: number[];
    }
  | {
      kind: 'text';
      id: string;
      mode: 'move' | 'start' | 'end';
      start: number;
      end: number;
      startT: number;
      startX: number;
      moved: boolean;
      targets: number[];
    }
  | {
      kind: 'music';
      mode: 'slip' | 'start' | 'end';
      offset: number;
      start: number;
      end: number;
      startT: number;
      startX: number;
      moved: boolean;
      targets: number[];
    };

const drag = ref<Drag | null>(null);

function timeAt(clientX: number): number {
  const r = inner.value?.getBoundingClientRect();
  return r ? Math.max(0, (clientX - r.left - PAD) / pps.value) : 0;
}

function snapTo(value: number, targets: number[], e: PointerEvent): number {
  if (!snapOn.value || e.altKey) {
    snapLine.value = null;
    return value;
  }
  const s = snap(value, targets, SNAP_PX / pps.value);
  snapLine.value = s.hit;
  return s.value;
}

function begin(e: PointerEvent, d: Drag) {
  if (e.button !== 0) return;
  closeMenu();
  drag.value = d;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function startScrub(e: PointerEvent) {
  if (e.button !== 0) return;
  begin(e, { kind: 'scrub' });
  emit('seek', Math.min(total.value, timeAt(e.clientX)));
}

function startClip(e: PointerEvent, i: number) {
  begin(e, {
    kind: 'clip',
    index: i,
    startX: e.clientX,
    grab: timeAt(e.clientX) - starts.value[i],
    x: timeAt(e.clientX),
    target: i,
    moved: false,
  });
}

function startTrim(e: PointerEvent, i: number, edge: 'in' | 'out') {
  const c = props.project.clips[i];
  emit('selectClip', c.id);
  begin(e, {
    kind: 'trim',
    index: i,
    edge,
    orig: { ...c },
    origStart: starts.value[i],
    origLen: clipLength(c),
    startT: timeAt(e.clientX),
    applied: 0,
    targets:
      edge === 'out'
        ? snapTargets(props.project, { playhead: props.time, clipEdgesUntil: i })
        : snapTargets(props.project, { playhead: props.time, excludeClipEdges: [i] }),
  });
}

function startText(e: PointerEvent, id: string, mode: 'move' | 'start' | 'end') {
  const tx = props.project.texts.find((x) => x.id === id);
  if (!tx) return;
  emit('selectText', id);
  begin(e, {
    kind: 'text',
    id,
    mode,
    start: tx.start,
    end: tx.end,
    startT: timeAt(e.clientX),
    startX: e.clientX,
    moved: false,
    targets: snapTargets(props.project, { playhead: props.time, excludeText: id }),
  });
}

function startOverlay(e: PointerEvent, id: string, mode: 'move' | 'start' | 'end') {
  const o = props.project.overlays.find((x) => x.id === id);
  if (!o) return;
  emit('selectOverlay', id);
  const m = o.kind === 'media' ? mediaOf(props.project, o.mediaId) : undefined;
  begin(e, {
    kind: 'overlay',
    target: 'overlay',
    id,
    mode,
    start: o.start,
    inn: o.in,
    out: o.out,
    max: m?.kind === 'video' ? m.duration : Infinity,
    startT: timeAt(e.clientX),
    startX: e.clientX,
    moved: false,
    targets: snapTargets(props.project, { playhead: props.time, excludeText: id }),
  });
}

function startAudio(e: PointerEvent, id: string, mode: 'move' | 'start' | 'end') {
  const a = props.project.audios.find((x) => x.id === id);
  if (!a) return;
  emit('selectAudio', id);
  const m = mediaOf(props.project, a.mediaId);
  begin(e, {
    kind: 'overlay',
    target: 'audio',
    id,
    mode,
    start: a.start,
    inn: a.in,
    out: a.out,
    max: m?.duration || Infinity,
    startT: timeAt(e.clientX),
    startX: e.clientX,
    moved: false,
    targets: snapTargets(props.project, { playhead: props.time, excludeText: id }),
  });
}

/** Kirim perubahan item overlay/audio sesuai jenisnya. */
function emitItem(d: { target: 'overlay' | 'audio'; id: string }, patch: Partial<AudioItem>) {
  if (d.target === 'audio') emit('updateAudio', d.id, patch);
  else emit('updateOverlay', d.id, patch);
}

function startMusic(e: PointerEvent, mode: 'slip' | 'start' | 'end') {
  const m = props.project.music;
  if (!m) return;
  emit('selectMusic');
  const span = musicSpan(m, total.value);
  begin(e, {
    kind: 'music',
    mode,
    offset: m.offset,
    start: span.start,
    end: span.end,
    startT: timeAt(e.clientX),
    startX: e.clientX,
    moved: false,
    targets: snapTargets(props.project, { playhead: props.time }),
  });
}

function onMove(e: PointerEvent) {
  const d = drag.value;
  if (!d) return;
  const t = timeAt(e.clientX);
  autoScroll(e.clientX);
  if (d.kind === 'scrub') emit('seek', Math.min(total.value, t));
  else if (d.kind === 'clip') {
    if (!d.moved && Math.abs(e.clientX - d.startX) < 4) return;
    d.moved = true;
    d.x = t;
    d.target = reorderTarget(lengths.value, d.index, t - d.grab + lengths.value[d.index] / 2);
  } else if (d.kind === 'trim') {
    const m = mediaOf(props.project, d.orig.mediaId);
    const dt = t - d.startT;
    let next: Clip;
    if (d.edge === 'out') {
      const edge = snapTo(d.origStart + d.origLen + dt, d.targets, e);
      next = trimClip(d.orig, m, 'out', edge - (d.origStart + d.origLen));
      emit('seek', d.origStart + clipLength(next) - 0.04);
    } else {
      const edge = snapTo(d.origStart + dt, d.targets, e);
      next = trimClip(d.orig, m, 'in', edge - d.origStart);
      emit('seek', starts.value[d.index] + 0.001);
    }
    d.applied = d.edge === 'in' ? d.origLen - clipLength(next) : 0;
    emit('trimClip', d.index, next);
  } else if (d.kind === 'overlay') {
    if (!d.moved && Math.abs(e.clientX - d.startX) < 3) return;
    d.moved = true;
    const dt = t - d.startT;
    const len = d.out - d.inn;
    const end = d.start + len;
    const video = Number.isFinite(d.max);
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    if (d.mode === 'move') {
      const s1 = snap(d.start + dt, d.targets, SNAP_PX / pps.value);
      const s2 = snap(end + dt, d.targets, SNAP_PX / pps.value);
      let start = d.start + dt;
      if (snapOn.value && !e.altKey && (s1.hit !== null || s2.hit !== null)) {
        const use1 =
          s1.hit !== null &&
          (s2.hit === null || Math.abs(s1.hit - start) <= Math.abs(s2.hit - (start + len)));
        start = use1 ? s1.value : s2.value - len;
        snapLine.value = use1 ? s1.hit : s2.hit;
      } else snapLine.value = null;
      emitItem(d, { start: r3(Math.max(0, start)) });
    } else if (d.mode === 'start') {
      // Awal dipotong: video menggeser titik masuk sumber, lainnya memendekkan durasi.
      const lo = video ? d.start - d.inn : 0;
      const ns = Math.max(lo, Math.min(end - 0.2, snapTo(d.start + dt, d.targets, e)));
      const delta = ns - d.start;
      emitItem(
        d,
        video
          ? { start: r3(ns), in: r3(d.inn + delta) }
          : { start: r3(ns), out: r3(d.out - delta) },
      );
    } else {
      const hi = video ? d.start + (d.max - d.inn) : Infinity;
      const ne = Math.max(d.start + 0.2, Math.min(hi, snapTo(end + dt, d.targets, e)));
      emitItem(d, { out: r3(d.inn + (ne - d.start)) });
    }
  } else if (d.kind === 'text') {
    if (!d.moved && Math.abs(e.clientX - d.startX) < 3) return;
    d.moved = true;
    const dt = t - d.startT;
    const dur = d.end - d.start;
    const max = Math.max(0.5, total.value);
    let start = d.start;
    let end = d.end;
    if (d.mode === 'move') {
      const s1 = snap(d.start + dt, d.targets, SNAP_PX / pps.value);
      const s2 = snap(d.end + dt, d.targets, SNAP_PX / pps.value);
      start = d.start + dt;
      if (snapOn.value && !e.altKey && (s1.hit !== null || s2.hit !== null)) {
        const use1 =
          s1.hit !== null &&
          (s2.hit === null || Math.abs(s1.hit - start) <= Math.abs(s2.hit - (start + dur)));
        start = use1 ? s1.value : s2.value - dur;
        snapLine.value = use1 ? s1.hit : s2.hit;
      } else snapLine.value = null;
      start = Math.max(0, Math.min(max - dur, start));
      end = start + dur;
    } else if (d.mode === 'start') {
      start = Math.max(0, Math.min(d.end - 0.3, snapTo(d.start + dt, d.targets, e)));
    } else {
      end = Math.max(d.start + 0.3, Math.min(max, snapTo(d.end + dt, d.targets, e)));
    }
    emit('updateText', d.id, { start, end });
    emit('seek', d.mode === 'end' ? Math.max(start, end - 0.04) : start);
  } else if (d.kind === 'music') {
    if (!d.moved && Math.abs(e.clientX - d.startX) < 3) return;
    d.moved = true;
    const m = props.project.music;
    const dur = m ? (mediaOf(props.project, m.mediaId)?.duration ?? 0) : 0;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const dt = t - d.startT;
    if (d.mode === 'slip') {
      // Geser isi lagu: ke kanan = bagian lebih awal dari lagu yang terdengar.
      const off = Math.max(0, d.offset - dt);
      emit('updateMusic', { offset: r2(dur ? Math.min(off, Math.max(0, dur - 0.5)) : off) });
    } else if (d.mode === 'start') {
      const start = Math.max(0, Math.min(d.end - 0.5, snapTo(d.start + dt, d.targets, e)));
      // Isi lagu tetap di tempatnya saat awal dipotong.
      emit('updateMusic', {
        start: r2(start),
        offset: r2(Math.max(0, d.offset + start - d.start)),
      });
    } else {
      const end = Math.max(d.start + 0.5, Math.min(total.value, snapTo(d.end + dt, d.targets, e)));
      emit('updateMusic', { end: end >= total.value - 0.01 ? null : r2(end) });
    }
  }
}

function onUp(e: PointerEvent) {
  const d = drag.value;
  drag.value = null;
  snapLine.value = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
  if (!d || e.type === 'pointercancel') return;
  const t = timeAt(e.clientX);
  if (d.kind === 'clip') {
    const c = props.project.clips[d.index];
    if (d.moved && d.target !== d.index) emit('move', d.index, d.target);
    else if (!d.moved && c) {
      emit('selectClip', c.id);
      emit('seek', Math.min(total.value, t));
    }
  } else if (d.kind === 'text' && !d.moved) {
    emit('seek', Math.max(d.start, Math.min(d.end - 0.01, t)));
  } else if (d.kind === 'overlay' && !d.moved) {
    emit('seek', Math.max(d.start, Math.min(d.start + d.out - d.inn - 0.01, t)));
  }
}

/** Saat menarik di dekat tepi, timeline ikut menggulir. */
function autoScroll(clientX: number) {
  const s = scroller.value;
  if (!s) return;
  const r = s.getBoundingClientRect();
  if (clientX > r.right - 30) s.scrollLeft += 12;
  else if (clientX < r.left + 30) s.scrollLeft -= 12;
}

// ---------- Tata letak ----------

/** Posisi kiri setiap klip (detik), termasuk pratinjau saat digeser atau dipotong dari kiri. */
const clipLefts = computed(() => {
  const d = drag.value;
  if (d?.kind === 'clip' && d.moved) {
    const pv = previewStarts(lengths.value, d.index, d.target);
    pv[d.index] = Math.max(0, d.x - d.grab);
    return pv;
  }
  if (d?.kind === 'trim' && d.edge === 'in')
    return starts.value.map((s, i) => (i >= d.index ? s + d.applied : s));
  return starts.value;
});

// Media diseret dari galeri: posisi sisip = jumlah klip yang titik tengahnya di kiri kursor.
const MEDIA_TYPE = 'application/x-toolland-media';
const galleryDrop = ref<number | null>(null);
function insertIndexAt(t: number): number {
  return starts.value.filter((s, i) => s + lengths.value[i] / 2 < t).length;
}
function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes(MEDIA_TYPE)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  galleryDrop.value = insertIndexAt(timeAt(e.clientX));
}
function onDrop(e: DragEvent) {
  const id = e.dataTransfer?.getData(MEDIA_TYPE);
  // Dijatuhkan di jalur audio: jadi audio tambahan mulai di posisi kursor.
  if (id && (e.target as HTMLElement).closest('[data-track="audios"]')) {
    galleryDrop.value = null;
    e.preventDefault();
    emit('insertAudio', id, Math.min(total.value, timeAt(e.clientX)));
    return;
  }
  // Dijatuhkan di jalur overlay: jadi overlay mulai di posisi kursor.
  if (id && (e.target as HTMLElement).closest('[data-track="overlays"]')) {
    galleryDrop.value = null;
    e.preventDefault();
    emit('insertOverlay', id, Math.min(total.value, timeAt(e.clientX)));
    return;
  }
  const index = galleryDrop.value ?? insertIndexAt(timeAt(e.clientX));
  galleryDrop.value = null;
  if (!id) return;
  e.preventDefault();
  emit('insertMedia', id, index);
}

const dropLine = computed(() => {
  if (galleryDrop.value !== null) {
    const i = galleryDrop.value;
    return i < starts.value.length ? starts.value[i] : total.value;
  }
  const d = drag.value;
  if (d?.kind !== 'clip' || !d.moved || d.target === d.index) return null;
  return previewStarts(lengths.value, d.index, d.target)[d.index];
});

interface Tile {
  key: number;
  left: number;
  url?: string;
}

/** Gambar filmstrip dan gelombang suara per klip (dihitung ulang saat klip atau zoom berubah). */
const visuals = computed(() => {
  const out = new Map<string, { tiles: Tile[]; tileW: number; wave: string; waveW: number }>();
  for (const c of props.project.clips) {
    const m = mediaOf(props.project, c.mediaId);
    const w = Math.max(1, px(clipLength(c)));
    const ratio = m && m.width && m.height ? m.width / m.height : 16 / 9;
    const tileW = Math.round(Math.max(36, Math.min(110, FRAME_H * ratio)));
    const n = Math.min(400, Math.ceil(w / tileW));
    const fr = props.frames.get(c.mediaId) ?? [];
    const still = m?.kind === 'image' ? props.thumbs.get(c.mediaId) : undefined;
    const tiles: Tile[] = [];
    for (let k = 0; k < n; k++) {
      const src = c.in + (((k + 0.5) * tileW) / pps.value) * (c.speed || 1);
      tiles.push({ key: k, left: k * tileW, url: still ?? nearestFrame(fr, src)?.url });
    }
    const pk = props.peaks.get(c.mediaId);
    const waveW = Math.min(w, 4000);
    const wave =
      pk && m && m.kind === 'video' && c.volume > 0
        ? waveformPath(
            peaksRange(pk, m.duration, c.in, c.out, Math.max(4, Math.floor(waveW / 3))),
            waveW,
            14,
          )
        : '';
    out.set(c.id, { tiles, tileW, wave, waveW });
  }
  return out;
});

const lanes = computed(() => textLanes(props.project.texts));
const auLanes = computed(() =>
  textLanes(
    props.project.audios.map((a) => ({ id: a.id, start: a.start, end: a.start + a.out - a.in })),
  ),
);
/** Gelombang suara item audio tambahan. */
function audioWave(a: AudioItem): { d: string; w: number } {
  const m = mediaOf(props.project, a.mediaId);
  const pk = props.peaks.get(a.mediaId);
  const w = Math.min(Math.max(1, px(a.out - a.in)), 4000);
  if (!pk || !m?.duration) return { d: '', w };
  return {
    d: waveformPath(peaksRange(pk, m.duration, a.in, a.out, Math.max(4, Math.floor(w / 3))), w, 16),
    w,
  };
}
const ovLanes = computed(() =>
  textLanes(props.project.overlays.map((o) => ({ id: o.id, start: o.start, end: overlayEnd(o) }))),
);
function overlayLabel(o: Overlay): string {
  if (o.kind === 'emoji') return o.char;
  if (o.kind === 'shape') return props.t[`shape.${o.shape}`];
  return mediaOf(props.project, o.mediaId)?.name ?? '';
}
const LANE_H = 22;

const musicWave = computed(() => {
  const m = props.project.music;
  if (!m) return { d: '', w: 0 };
  const media = mediaOf(props.project, m.mediaId);
  const pk = props.peaks.get(m.mediaId);
  const span = musicSpan(m, total.value);
  const w = Math.min(Math.max(1, px(span.end - span.start)), 8000);
  if (!pk || !media) return { d: '', w };
  const values = peaksRange(
    pk,
    media.duration,
    m.offset,
    m.offset + span.end - span.start,
    Math.max(4, Math.floor(w / 3)),
    true,
  );
  return { d: waveformPath(values, w, 20), w };
});

// ---------- Zoom dan gulir ----------

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const s = scroller.value;
  if (!s) return;
  const t = timeAt(e.clientX);
  const offset = e.clientX - s.getBoundingClientRect().left;
  zoom.value = Math.max(1, Math.min(40, zoom.value * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
  void nextTick(() => (s.scrollLeft = t * pps.value + PAD - offset));
}

function fitAll() {
  zoom.value = 1;
  if (scroller.value) scroller.value.scrollLeft = 0;
}

// Saat diputar, timeline mengikuti playhead.
watch(
  () => props.time,
  (t) => {
    const s = scroller.value;
    if (!s || !props.playing || drag.value) return;
    const x = t * pps.value + PAD;
    if (x > s.scrollLeft + s.clientWidth - 40) s.scrollLeft = x - 40;
    else if (x < s.scrollLeft) s.scrollLeft = Math.max(0, x - 40);
  },
);

// ---------- Menu klik kanan ----------

const menu = reactive({ open: false, x: 0, y: 0, kind: 'clip' as 'clip' | 'text', id: '' });

function openMenu(e: MouseEvent, kind: 'clip' | 'text', id: string) {
  menu.open = true;
  menu.x = Math.min(e.clientX, window.innerWidth - 220);
  menu.y = Math.min(e.clientY, window.innerHeight - 220);
  menu.kind = kind;
  menu.id = id;
  if (kind === 'clip') emit('selectClip', id);
  else emit('selectText', id);
}
function closeMenu() {
  menu.open = false;
}
function act(kind: TimelineAction) {
  emit('action', kind, menu.id);
  closeMenu();
}
const playheadInMenuClip = computed(() => {
  const i = props.project.clips.findIndex((c) => c.id === menu.id);
  if (i < 0) return false;
  const local = props.time - starts.value[i];
  return local > 0.2 && local < lengths.value[i] - 0.2;
});

function onDocDown(e: PointerEvent) {
  if (menu.open && !(e.target as HTMLElement).closest('[data-tl-menu]')) closeMenu();
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu();
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = e.contentRect.width));
  if (scroller.value) ro.observe(scroller.value);
  document.addEventListener('pointerdown', onDocDown, true);
  document.addEventListener('keydown', onDocKey);
});
onBeforeUnmount(() => {
  ro?.disconnect();
  document.removeEventListener('pointerdown', onDocDown, true);
  document.removeEventListener('keydown', onDocKey);
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
});

const musicBar = computed(() =>
  props.project.music ? musicSpan(props.project.music, total.value) : { start: 0, end: 0 },
);
const musicMedia = computed(() =>
  props.project.music ? mediaOf(props.project, props.project.music.mediaId) : undefined,
);
</script>

<template>
  <div class="rounded-md border border-rule bg-paper-2 select-none">
    <!-- Bilah alat timeline -->
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-3 py-1.5 text-xs text-ink-3"
    >
      <span class="grow">{{ t.dragHint }}</span>
      <label class="flex cursor-pointer items-center gap-1.5">
        <input v-model="snapOn" type="checkbox" class="accent-brand-600" data-snap />
        {{ t.snap }}
      </label>
      <button type="button" class="hover:text-ink" data-zoom-fit @click="fitAll">
        {{ t.zoomFit }}
      </button>
      <label class="flex items-center gap-2">
        {{ t.zoom }}
        <input
          v-model.number="zoom"
          type="range"
          min="1"
          max="40"
          step="0.5"
          class="w-28 accent-brand-600"
          data-zoom
        />
      </label>
    </div>

    <div
      ref="scroller"
      class="relative overflow-x-auto overflow-y-hidden pb-2"
      :class="{ 'cursor-grabbing': drag?.kind === 'clip' && drag.moved }"
      @wheel="onWheel"
    >
      <div
        ref="inner"
        class="relative"
        :style="{ width: `${innerWidth}px`, paddingLeft: `${PAD}px`, paddingRight: `${PAD}px` }"
        data-tl
        @pointerdown.self="startScrub"
        @dragover="onDragOver"
        @dragleave.self="galleryDrop = null"
        @drop="onDrop"
      >
        <!-- Penggaris -->
        <div class="relative h-6 cursor-col-resize" data-ruler @pointerdown="startScrub">
          <span
            v-for="tk in ticks"
            :key="tk"
            class="pointer-events-none absolute top-1 border-l border-rule pl-1 font-mono text-[10px] text-ink-3"
            :style="{ left: `${px(tk)}px` }"
          >
            {{ tickLabel(tk) }}
          </span>
        </div>

        <!-- Jalur overlay (di atas video utama) -->
        <div
          class="relative mt-0.5"
          :style="{ height: `${ovLanes.count * LANE_H + 2}px` }"
          data-track="overlays"
          @pointerdown.self="startScrub"
        >
          <span
            v-if="!project.overlays.length"
            class="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] text-ink-3"
          >
            {{ t.overlayTrackHint }}
          </span>
          <div
            v-for="o in project.overlays"
            :key="o.id"
            role="button"
            tabindex="0"
            class="group absolute flex cursor-grab items-center overflow-hidden rounded border text-[10px]"
            :class="
              o.id === selectedOverlay
                ? 'z-10 border-kunyit bg-kunyit text-ink'
                : 'border-kunyit/50 bg-kunyit/20 text-ink-2'
            "
            :style="{
              left: `${px(o.start)}px`,
              width: `${Math.max(8, px(overlayEnd(o) - o.start))}px`,
              top: `${(ovLanes.lane.get(o.id) ?? 0) * LANE_H}px`,
              height: `${LANE_H - 3}px`,
            }"
            :data-overlay-bar="o.id"
            @pointerdown.stop="startOverlay($event, o.id, 'move')"
            @keydown.enter.prevent="(emit('selectOverlay', o.id), emit('seek', o.start))"
          >
            <span class="pointer-events-none truncate px-2">⧉ {{ overlayLabel(o) }}</span>
            <span
              class="absolute inset-y-0 left-0 w-2 cursor-ew-resize group-hover:bg-kunyit"
              data-overlay-edge="start"
              @pointerdown.stop="startOverlay($event, o.id, 'start')"
            ></span>
            <span
              class="absolute inset-y-0 right-0 w-2 cursor-ew-resize group-hover:bg-kunyit"
              data-overlay-edge="end"
              @pointerdown.stop="startOverlay($event, o.id, 'end')"
            ></span>
          </div>
        </div>

        <!-- Jalur klip -->
        <div
          class="relative mt-0.5"
          :style="{ height: `${FRAME_H + 4}px` }"
          data-track="clips"
          @pointerdown.self="startScrub"
        >
          <span class="sr-only">{{ t['tab.clip'] }}</span>
          <div
            v-for="(c, i) in project.clips"
            :key="c.id"
            role="button"
            tabindex="0"
            class="group absolute top-0 overflow-hidden rounded border-2 bg-ink/80 text-[10px] text-white"
            :class="[
              c.id === selectedClip
                ? 'border-brand-500 ring-2 ring-brand-500/40'
                : 'border-paper-2',
              drag?.kind === 'clip' && drag.moved && drag.index === i
                ? 'z-20 cursor-grabbing opacity-90 shadow-xl'
                : 'cursor-grab transition-[left] duration-150',
              missing.has(c.mediaId) ? 'bg-secang/70' : '',
            ]"
            :style="{
              left: `${px(clipLefts[i])}px`,
              width: `${Math.max(6, px(lengths[i]))}px`,
              height: `${FRAME_H + 4}px`,
            }"
            :title="mediaOf(project, c.mediaId)?.name"
            :data-clip="c.id"
            :data-len="lengths[i]"
            :data-media="c.mediaId"
            @pointerdown.stop="startClip($event, i)"
            @keydown.enter.prevent="(emit('selectClip', c.id), emit('seek', starts[i] + 0.001))"
            @contextmenu.prevent="openMenu($event, 'clip', c.id)"
          >
            <!-- Filmstrip -->
            <span
              v-for="tile in visuals.get(c.id)?.tiles"
              :key="tile.key"
              class="pointer-events-none absolute top-0 h-full bg-cover bg-center"
              :style="{
                left: `${tile.left}px`,
                width: `${visuals.get(c.id)?.tileW}px`,
                backgroundImage: tile.url ? `url(${tile.url})` : undefined,
              }"
            ></span>
            <!-- Gelombang audio klip -->
            <svg
              v-if="visuals.get(c.id)?.wave"
              class="pointer-events-none absolute bottom-0 left-0 h-3.5 text-white/80"
              :width="visuals.get(c.id)?.waveW"
              height="14"
              :viewBox="`0 0 ${visuals.get(c.id)?.waveW} 14`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path :d="visuals.get(c.id)?.wave" fill="currentColor" />
            </svg>
            <span
              class="pointer-events-none absolute inset-x-0 top-0 truncate bg-gradient-to-b from-black/70 to-transparent px-1.5 pt-0.5 pb-2"
            >
              {{ formatTime(lengths[i]) }} · {{ mediaOf(project, c.mediaId)?.name }}
            </span>
            <span
              v-if="c.trans !== 'none' && i < project.clips.length - 1"
              class="pointer-events-none absolute right-2.5 bottom-1 rounded px-1 text-[10px] leading-4 font-bold"
              :class="c.trans === 'white' ? 'bg-white text-ink' : 'bg-black text-white'"
              data-trans-mark
            >
              ⇢
            </span>
            <!-- Pegangan potong -->
            <span
              class="absolute inset-y-0 left-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-brand-500/0 group-hover:bg-brand-500/90"
              :class="{ 'bg-brand-500/90': c.id === selectedClip }"
              data-trim="in"
              :aria-label="t.trimStart"
              @pointerdown.stop="startTrim($event, i, 'in')"
            >
              <span class="h-5 w-0.5 rounded bg-white/90"></span>
            </span>
            <span
              class="absolute inset-y-0 right-0 z-10 flex w-2.5 cursor-ew-resize items-center justify-center bg-brand-500/0 group-hover:bg-brand-500/90"
              :class="{ 'bg-brand-500/90': c.id === selectedClip }"
              data-trim="out"
              :aria-label="t.trimEnd"
              @pointerdown.stop="startTrim($event, i, 'out')"
            >
              <span class="h-5 w-0.5 rounded bg-white/90"></span>
            </span>
          </div>
          <div
            v-if="dropLine !== null"
            class="pointer-events-none absolute -top-1 -bottom-1 z-30 w-1 -translate-x-1/2 rounded bg-kunyit"
            :style="{ left: `${px(dropLine)}px` }"
          ></div>
        </div>

        <!-- Jalur teks -->
        <div
          class="relative mt-1"
          :style="{ height: `${lanes.count * LANE_H + 2}px` }"
          data-track="texts"
          @pointerdown.self="startScrub"
        >
          <span class="sr-only">{{ t['tab.text'] }}</span>
          <div
            v-for="tx in project.texts"
            :key="tx.id"
            role="button"
            tabindex="0"
            class="group absolute flex cursor-grab items-center overflow-hidden rounded border text-[10px]"
            :class="
              tx.id === selectedText
                ? 'z-10 border-nila bg-nila text-white'
                : 'border-nila/40 bg-nila/15 text-nila dark:text-[#94aee6]'
            "
            :style="{
              left: `${px(tx.start)}px`,
              width: `${Math.max(8, px(tx.end - tx.start))}px`,
              top: `${(lanes.lane.get(tx.id) ?? 0) * LANE_H}px`,
              height: `${LANE_H - 3}px`,
            }"
            :data-text="tx.id"
            @pointerdown.stop="startText($event, tx.id, 'move')"
            @keydown.enter.prevent="(emit('selectText', tx.id), emit('seek', tx.start))"
            @contextmenu.prevent="openMenu($event, 'text', tx.id)"
          >
            <span class="pointer-events-none truncate px-2">T · {{ tx.text || '…' }}</span>
            <span
              class="absolute inset-y-0 left-0 w-2 cursor-ew-resize group-hover:bg-nila/60"
              data-text-edge="start"
              @pointerdown.stop="startText($event, tx.id, 'start')"
            ></span>
            <span
              class="absolute inset-y-0 right-0 w-2 cursor-ew-resize group-hover:bg-nila/60"
              data-text-edge="end"
              @pointerdown.stop="startText($event, tx.id, 'end')"
            ></span>
          </div>
        </div>

        <!-- Jalur musik -->
        <div class="relative mt-1 h-7" data-track="music" @pointerdown.self="startScrub">
          <div
            v-if="project.music"
            class="group absolute inset-y-0 flex cursor-grab items-center overflow-hidden rounded border border-daun/40 bg-daun/15 text-daun dark:text-[#93c584]"
            :style="{
              left: `${px(musicBar.start)}px`,
              width: `${Math.max(8, px(musicBar.end - musicBar.start))}px`,
            }"
            :title="t.musicDrag"
            data-music
            @pointerdown.stop="startMusic($event, 'slip')"
          >
            <svg
              v-if="musicWave.d"
              class="pointer-events-none absolute inset-y-0 left-0 h-full opacity-60"
              :width="musicWave.w"
              height="20"
              :viewBox="`0 0 ${musicWave.w} 20`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path :d="musicWave.d" fill="currentColor" />
            </svg>
            <span
              class="pointer-events-none relative ml-1 truncate rounded bg-paper-2/85 px-1.5 py-0.5 text-[10px] font-medium"
            >
              ♪ {{ musicMedia?.name }} ·
              {{ fill(t.musicStart, { time: formatTime(project.music.offset) }) }}
            </span>
            <span
              class="absolute inset-y-0 left-0 w-2 cursor-ew-resize group-hover:bg-daun/60"
              data-music-edge="start"
              @pointerdown.stop="startMusic($event, 'start')"
            ></span>
            <span
              class="absolute inset-y-0 right-0 w-2 cursor-ew-resize group-hover:bg-daun/60"
              data-music-edge="end"
              @pointerdown.stop="startMusic($event, 'end')"
            ></span>
          </div>
        </div>

        <!-- Jalur audio tambahan (narasi, efek suara) -->
        <div
          class="relative mt-1"
          :style="{ height: `${auLanes.count * LANE_H + 2}px` }"
          data-track="audios"
          @pointerdown.self="startScrub"
        >
          <span
            v-if="!project.audios.length"
            class="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] text-ink-3"
          >
            {{ t.audioTrackHint }}
          </span>
          <div
            v-for="a in project.audios"
            :key="a.id"
            role="button"
            tabindex="0"
            class="group absolute flex cursor-grab items-center overflow-hidden rounded border text-[10px]"
            :class="
              a.id === selectedAudio
                ? 'z-10 border-nila bg-nila/80 text-white'
                : 'border-nila/40 bg-nila/10 text-nila dark:text-[#94aee6]'
            "
            :style="{
              left: `${px(a.start)}px`,
              width: `${Math.max(8, px(a.out - a.in))}px`,
              top: `${(auLanes.lane.get(a.id) ?? 0) * LANE_H}px`,
              height: `${LANE_H - 3}px`,
            }"
            :data-audio-bar="a.id"
            @pointerdown.stop="startAudio($event, a.id, 'move')"
            @keydown.enter.prevent="(emit('selectAudio', a.id), emit('seek', a.start))"
          >
            <svg
              v-if="audioWave(a).d"
              class="pointer-events-none absolute inset-y-0 left-0 h-full opacity-50"
              :width="audioWave(a).w"
              height="16"
              :viewBox="`0 0 ${audioWave(a).w} 16`"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path :d="audioWave(a).d" fill="currentColor" />
            </svg>
            <span class="pointer-events-none relative truncate px-2">
              🎙 {{ mediaOf(project, a.mediaId)?.name }}
            </span>
            <span
              class="absolute inset-y-0 left-0 w-2 cursor-ew-resize group-hover:bg-nila/60"
              @pointerdown.stop="startAudio($event, a.id, 'start')"
            ></span>
            <span
              class="absolute inset-y-0 right-0 w-2 cursor-ew-resize group-hover:bg-nila/60"
              @pointerdown.stop="startAudio($event, a.id, 'end')"
            ></span>
          </div>
        </div>

        <!-- Garis magnet -->
        <div
          v-if="snapLine !== null"
          class="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-kunyit"
          :style="{ left: `${PAD + px(snapLine)}px` }"
          data-snap-line
        ></div>

        <!-- Playhead -->
        <div
          class="pointer-events-none absolute top-0 bottom-0 z-40 w-0.5 bg-secang"
          :style="{ left: `${PAD + px(time)}px` }"
          data-playhead
        >
          <span
            class="pointer-events-auto absolute -top-0.5 -left-[7px] size-4 cursor-col-resize rounded-b-full bg-secang"
            @pointerdown.stop="startScrub"
          ></span>
        </div>
      </div>
    </div>

    <!-- Menu klik kanan -->
    <div
      v-if="menu.open"
      class="fixed z-[60] w-52 rounded-md border border-rule bg-paper p-1 text-sm shadow-xl"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      role="menu"
      data-tl-menu
    >
      <template v-if="menu.kind === 'clip'">
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left hover:bg-paper-2 disabled:opacity-40"
          :disabled="!playheadInMenuClip"
          @click="act('split')"
        >
          {{ t.split }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left hover:bg-paper-2"
          data-menu="duplicate"
          @click="act('duplicate')"
        >
          {{ t.duplicate }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left hover:bg-paper-2"
          @click="act('copyStyle')"
        >
          {{ t.copyStyle }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left hover:bg-paper-2 disabled:opacity-40"
          :disabled="!canPasteStyle"
          @click="act('pasteStyle')"
        >
          {{ t.pasteStyle }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left text-secang hover:bg-paper-2"
          @click="act('remove')"
        >
          {{ t.removeClip }}
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left hover:bg-paper-2"
          @click="act('duplicateText')"
        >
          {{ t.duplicate }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="block w-full rounded px-3 py-1.5 text-left text-secang hover:bg-paper-2"
          @click="act('removeText')"
        >
          {{ t.removeText }}
        </button>
      </template>
    </div>
  </div>
</template>
