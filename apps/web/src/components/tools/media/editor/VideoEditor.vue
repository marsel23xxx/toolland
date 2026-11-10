<script setup lang="ts">
/**
 * Editor video dasar di browser: susun klip video/gambar, potong, atur urutan, tambah teks dan
 * musik latar, lalu ekspor MP4 dengan ffmpeg.wasm. Progres bisa disimpan sebagai file .ayu
 * (ringan = hanya proyek, atau beserta video untuk pindah perangkat).
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Messages } from '../../../../i18n';
import { downloadBlob } from '../../../../lib/download';
import { fill, formatBytes } from '../../../../lib/format';
import { MAX_MEDIA_BYTES, formatTime, useFfmpeg } from '../../../../lib/media/ffmpeg';
import { useFileResults } from '../../../../lib/results';
import { matchFiles, openAyu, saveAyu } from '../../../../lib/editor/ayu';
import {
  type Aspect,
  type AudioItem,
  type Clip,
  type KenBurns,
  type MediaItem,
  type MediaKind,
  type Overlay,
  type ShapeKind,
  type Project,
  type Quality,
  type Rotate,
  type TextAnim,
  type TextLayer,
  FPS,
  MAX_AUDIOS,
  MAX_CLIPS,
  MAX_OVERLAYS,
  MUSIC_DEFAULTS,
  OVERLAY_DEFAULTS,
  TEXT_DEFAULTS,
  MAX_TEXTS,
  clampClip,
  clampText,
  clipAt,
  clipFor,
  clipLength,
  isOverlap,
  mediaOf,
  moveClip,
  newProject,
  splitAt,
  totalDuration,
  uid,
} from '../../../../lib/editor/project';
import { COLOR_PRESETS } from '../../../../lib/editor/look';
import { FONTS, FONT_IDS, TEXT_STYLES, type TextStyleId } from '../../../../lib/editor/textfx';
import { loadEditorFonts } from './editorFonts';
import { makeProxy, suggestProxy } from '../../../../lib/editor/proxy';
import { exportVideo, limitThreads } from '../../../../lib/editor/render';
import IconMonitor from '~icons/lucide/monitor';
import Dropzone, { type DropzoneMessages } from '../../../ui/Dropzone.vue';
import FileResults from '../../../ui/FileResults.vue';
import ProgressBar from '../../../ui/ProgressBar.vue';
import EditorSection from './EditorSection.vue';
import EditorStage from './EditorStage.vue';
import EditorTimeline, { type TimelineAction } from './EditorTimeline.vue';
import { useMediaPreviews } from './useMediaPreviews';

const props = defineProps<{
  m: Messages<'media'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'editor'>;
}>();

const ACCEPT =
  'video/*,image/jpeg,image/png,image/webp,audio/*,.mkv,.mov,.m4v,.mp3,.m4a,.wav,.ogg,.flac,.ayu';

const project = ref<Project>(newProject());
/** File asli per mediaId (tidak pernah disalin). */
const sources = shallowRef(new Map<string, File>());
const urls = shallowRef(new Map<string, string>());
const thumbs = shallowRef(new Map<string, string>());
const time = ref(0);
const playing = ref(false);
const selectedClip = ref('');
const selectedText = ref('');
const tab = ref<'media' | 'clip' | 'overlay' | 'text' | 'music'>('media');
const selectedOverlay = ref('');
const selectedAudio = ref('');
const error = ref('');
const notice = ref('');
const busy = ref('');
const saveProgress = ref<number | null>(null);
const saved = ref(JSON.stringify(project.value));
const addInput = ref<HTMLInputElement>();
const openInput = ref<HTMLInputElement>();
const relinkInput = ref<HTMLInputElement>();
const saveMenu = ref<HTMLDetailsElement>();

const previews = useMediaPreviews();
const ff = useFfmpeg();
const results = useFileResults();
const exporting = ref(false);
const exportProgress = ref(0);
let cancelled = false;

const total = computed(() => totalDuration(project.value));
const dirty = computed(() => JSON.stringify(project.value) !== saved.value);
const missing = computed(
  () => new Set(project.value.media.filter((x) => !sources.value.has(x.id)).map((x) => x.id)),
);
const clip = computed(() => project.value.clips.find((c) => c.id === selectedClip.value));
const clipIndex = computed(() => (clip.value ? project.value.clips.indexOf(clip.value) : -1));
const clipMedia = computed(() =>
  clip.value ? mediaOf(project.value, clip.value.mediaId) : undefined,
);
const text = computed(() => project.value.texts.find((x) => x.id === selectedText.value));
const overlay = computed(() => project.value.overlays.find((x) => x.id === selectedOverlay.value));
const audioItem = computed(() => project.value.audios.find((x) => x.id === selectedAudio.value));
const hasRecorded = computed(() => project.value.media.some((m) => m.recorded));
const overlayMedia = computed(() =>
  overlay.value?.kind === 'media' ? mediaOf(project.value, overlay.value.mediaId) : undefined,
);
const empty = computed(() => !project.value.media.length);

const num = (e: Event) => Number((e.target as HTMLInputElement).value) || 0;
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------- Media ----------

function kindOf(f: File): MediaKind | null {
  const n = f.name.toLowerCase();
  if (f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|m4v)$/.test(n)) return 'video';
  if (/^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/.test(n)) return 'image';
  if (f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac)$/.test(n))
    return 'audio';
  return null;
}

interface Probe {
  duration: number;
  width: number;
  height: number;
  thumb?: string;
}

/** Baca durasi, ukuran, dan gambar kecil lewat elemen media browser. */
function probe(url: string, kind: MediaKind): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('unplayable')), 20_000);
    const done = (p: Probe) => (clearTimeout(timer), resolve(p));
    const fail = () => (clearTimeout(timer), reject(new Error('unplayable')));
    if (kind === 'image') {
      const img = new Image();
      img.onload = () => done({ duration: 0, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = fail;
      img.src = url;
      return;
    }
    if (kind === 'audio') {
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () =>
        Number.isFinite(a.duration) ? done({ duration: a.duration, width: 0, height: 0 }) : fail();
      a.onerror = fail;
      a.src = url;
      return;
    }
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'auto';
    v.playsInline = true;
    v.onerror = fail;
    v.onloadedmetadata = () => {
      if (!Number.isFinite(v.duration) || !v.videoWidth) return fail();
      v.currentTime = Math.min(1, v.duration / 2);
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      c.height = 72;
      c.width = Math.max(1, Math.round((72 * v.videoWidth) / v.videoHeight));
      c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
      const info = { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
      c.toBlob(
        (b) => {
          v.removeAttribute('src');
          v.load();
          done({ ...info, thumb: b ? URL.createObjectURL(b) : undefined });
        },
        'image/jpeg',
        0.7,
      );
    };
    v.src = url;
  });
}

function setMap<K, V>(r: { value: Map<K, V> }, k: K, v: V) {
  const next = new Map(r.value);
  next.set(k, v);
  r.value = next;
}

/** Pasang File untuk media tertentu: buat object URL dan gambar kecil. */
async function attach(m: MediaItem, f: File) {
  setMap(sources, m.id, f);
  // Video yang memakai salinan ringan: pratinjau menunggu salinannya selesai dibuat.
  if (m.proxy && !proxyFiles.value.has(m.id)) {
    void ensureProxy(m, f);
    return;
  }
  showPreview(m, m.proxy ? proxyFiles.value.get(m.id)! : f);
}

/** Pasang file pratinjau (asli atau salinan ringan): object URL, filmstrip, gelombang, gambar kecil. */
function showPreview(m: MediaItem, f: File) {
  const old = urls.value.get(m.id);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(f);
  setMap(urls, m.id, url);
  previews.remove(m.id);
  previews.add(m, url, f);
  if (m.kind === 'image') setMap(thumbs, m.id, url);
  else if (m.kind === 'video')
    probe(url, 'video')
      .then((p) => p.thumb && setMap(thumbs, m.id, p.thumb))
      .catch(() => {});
}

// ---------- Salinan ringan untuk pratinjau ----------

/** Salinan pratinjau per mediaId (tidak disimpan di .ayu; dibuat ulang saat dibuka). */
const proxyFiles = shallowRef(new Map<string, File>());
const pendingProxy = ref(new Set<string>());
let proxyQueue: Promise<unknown> = Promise.resolve();

/** Buat salinan pratinjau satu per satu (ffmpeg hanya satu proses). */
function buildProxy(f: File, name: string): Promise<File> {
  const job = proxyQueue.then(async () => {
    const prev = busy.value;
    busy.value = fill(props.t.proxying, { name });
    saveProgress.value = 0;
    try {
      const engine = await ff.load();
      return await makeProxy(
        engine,
        f,
        uid('p'),
        limitThreads,
        (p) => (saveProgress.value = p * 100),
      );
    } finally {
      busy.value = prev;
      saveProgress.value = null;
    }
  });
  proxyQueue = job.catch(() => {});
  return job;
}

async function ensureProxy(m: MediaItem, f: File) {
  if (pendingProxy.value.has(m.id)) return;
  pendingProxy.value = new Set([...pendingProxy.value, m.id]);
  try {
    const pf = await buildProxy(f, m.name);
    if (sources.value.get(m.id) !== f) return; // media sudah dihapus/diganti
    setMap(proxyFiles, m.id, pf);
    showPreview(m, pf);
  } catch {
    error.value = fill(props.t['error.proxy'], { name: m.name });
  } finally {
    const next = new Set(pendingProxy.value);
    next.delete(m.id);
    pendingProxy.value = next;
  }
}

/** Pakai pratinjau ringan untuk video berat (4K). Ekspor tetap memakai file asli. */
function useLightPreview(m: MediaItem) {
  const f = sources.value.get(m.id);
  if (!f || m.proxy) return;
  m.proxy = true;
  void ensureProxy(m, f);
}

async function addFiles(list: File[]) {
  error.value = '';
  notice.value = '';
  const ayu = list.find((f) => /\.ayu$/i.test(f.name));
  if (ayu) return openProject(ayu);
  const skipped: string[] = [];
  busy.value = props.t.reading;
  try {
    for (const f of list) {
      const kind = kindOf(f);
      if (!kind || f.size > MAX_MEDIA_BYTES) {
        skipped.push(f.name);
        continue;
      }
      if (kind !== 'audio' && project.value.clips.length >= MAX_CLIPS) {
        notice.value = fill(props.t.maxClips, { n: MAX_CLIPS });
        break;
      }
      const url = URL.createObjectURL(f);
      let info: Probe;
      let proxyFile: File | undefined;
      try {
        info = await probe(url, kind);
      } catch {
        URL.revokeObjectURL(url);
        // Video yang tidak bisa diputar browser (misalnya HEVC): buat salinan ringan untuk
        // pratinjau; ekspor tetap memakai file asli.
        if (kind !== 'video') {
          skipped.push(f.name);
          continue;
        }
        try {
          proxyFile = await buildProxy(f, f.name);
          const pu = URL.createObjectURL(proxyFile);
          try {
            info = await probe(pu, 'video');
          } finally {
            URL.revokeObjectURL(pu);
          }
        } catch {
          skipped.push(f.name);
          continue;
        } finally {
          busy.value = props.t.reading;
        }
      }
      URL.revokeObjectURL(url);
      const m: MediaItem = {
        id: uid('m'),
        kind,
        name: f.name.slice(0, 200),
        size: f.size,
        duration: Math.round(info.duration * 1000) / 1000,
        width: info.width,
        height: info.height,
        lastModified: f.lastModified,
        ...(proxyFile ? { proxy: true } : {}),
      };
      if (info.thumb) URL.revokeObjectURL(info.thumb);
      if (proxyFile) setMap(proxyFiles, m.id, proxyFile);
      project.value.media.push(m);
      await attach(m, f);
      if (kind === 'audio') {
        project.value.music = { mediaId: m.id, ...MUSIC_DEFAULTS };
      } else {
        const c = clipFor(m);
        project.value.clips.push(c);
        if (!selectedClip.value) selectedClip.value = c.id;
        if (project.value.clips.length === 1) fitAspect(m);
      }
    }
  } finally {
    busy.value = '';
  }
  if (skipped.length) error.value = fill(props.t.skipped, { names: skipped.join(', ') });
}

/** Rasio video mengikuti media pertama (tegak = 9:16, persegi = 1:1). */
function fitAspect(m: MediaItem) {
  if (!m.width || !m.height) return;
  const r = m.width / m.height;
  project.value.settings.aspect = r < 0.7 ? '9:16' : r < 0.9 ? '4:5' : r < 1.2 ? '1:1' : '16:9';
}

function onAddInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const list = [...(input.files ?? [])];
  input.value = '';
  if (list.length) addFiles(list);
}

function addToTimeline(m: MediaItem) {
  if (project.value.clips.length >= MAX_CLIPS) {
    notice.value = fill(props.t.maxClips, { n: MAX_CLIPS });
    return;
  }
  const c = clipFor(m);
  project.value.clips.push(c);
  select(c.id);
}

function useAsMusic(m: MediaItem) {
  project.value.music = { mediaId: m.id, ...MUSIC_DEFAULTS };
  tab.value = 'music';
}

function removeMedia(m: MediaItem) {
  const p = project.value;
  p.clips = p.clips.filter((c) => c.mediaId !== m.id);
  p.overlays = p.overlays.filter((o) => o.mediaId !== m.id);
  p.audios = p.audios.filter((a) => a.mediaId !== m.id);
  if (p.music?.mediaId === m.id) p.music = null;
  p.media = p.media.filter((x) => x.id !== m.id);
  // File tetap disimpan di memori sesi agar penghapusan bisa dibatalkan (undo).
}

function forget(id: string) {
  previews.remove(id);
  if (proxyFiles.value.has(id)) {
    const next = new Map(proxyFiles.value);
    next.delete(id);
    proxyFiles.value = next;
  }
  const u = urls.value.get(id);
  if (u) URL.revokeObjectURL(u);
  const th = thumbs.value.get(id);
  if (th && th !== u) URL.revokeObjectURL(th);
  for (const r of [sources, urls, thumbs] as { value: Map<string, unknown> }[]) {
    const next = new Map(r.value);
    next.delete(id);
    r.value = next;
  }
}

function forgetAll() {
  for (const id of new Set([...urls.value.keys(), ...thumbs.value.keys()])) forget(id);
}

// ---------- Klip ----------

function select(id: string) {
  selectedClip.value = id;
  tab.value = 'clip';
}

function updateClip(patch: Partial<Clip>) {
  const c = clip.value;
  if (!c) return;
  const i = project.value.clips.indexOf(c);
  project.value.clips[i] = clampClip({ ...c, ...patch }, clipMedia.value);
}

/** Titik masuk/keluar dari playhead (hanya bila playhead ada di klip terpilih). */
const playheadLocal = computed(() => {
  const h = clipAt(project.value, time.value);
  return h && h.clip.id === selectedClip.value && clipMedia.value?.kind === 'video'
    ? h.local
    : null;
});

function split() {
  const before = project.value.clips.length;
  const hit = clipAt(project.value, time.value);
  project.value = splitAt(project.value, time.value);
  if (project.value.clips.length === before) notice.value = props.t.cantSplit;
  else if (hit) selectedClip.value = project.value.clips[hit.index + 1].id;
}

function duplicate() {
  const c = clip.value;
  if (!c || project.value.clips.length >= MAX_CLIPS) return;
  const i = project.value.clips.indexOf(c);
  const copy = { ...c, id: uid('c') };
  project.value.clips.splice(i + 1, 0, copy);
  selectedClip.value = copy.id;
}

function shift(d: number) {
  const c = clip.value;
  if (!c) return;
  const i = project.value.clips.indexOf(c);
  project.value = moveClip(project.value, i, i + d);
}

function removeClip() {
  const c = clip.value;
  if (!c) return;
  const i = project.value.clips.indexOf(c);
  project.value.clips.splice(i, 1);
  selectedClip.value = project.value.clips[Math.min(i, project.value.clips.length - 1)]?.id ?? '';
}

// ---------- Teks ----------

function addText() {
  if (project.value.texts.length >= MAX_TEXTS || !total.value) return;
  const t: TextLayer = clampText(
    {
      id: uid('t'),
      text: props.t.sampleText,
      start: time.value >= total.value - 0.5 ? 0 : time.value,
      end: (time.value >= total.value - 0.5 ? 0 : time.value) + 3,
      ...TEXT_DEFAULTS,
      x: 0.5,
      y: 0.8,
    },
    total.value,
  );
  project.value.texts.push(t);
  selectedText.value = t.id;
  tab.value = 'text';
}

function updateText(patch: Partial<TextLayer>) {
  const t = text.value;
  if (!t) return;
  const i = project.value.texts.indexOf(t);
  project.value.texts[i] = clampText({ ...t, ...patch }, total.value);
}

function removeText() {
  const t = text.value;
  if (!t) return;
  project.value.texts = project.value.texts.filter((x) => x.id !== t.id);
  selectedText.value = project.value.texts[0]?.id ?? '';
}

// ---------- Overlay ----------

const EMOJIS = ['😀', '😂', '😍', '🥳', '😎', '🤩', '😮', '😢', '👍', '👏', '🙌', '🔥', '✨', '⭐', '❤️', '💯', '🎉', '🎂', '🎁', '📍', '✅', '❌', '⚠️', '👉', '👆', '💡', '📢', '🎵', '☕', '🌴', '☀️', '🌙']; // prettier-ignore
const SHAPES: ShapeKind[] = ['rect', 'round', 'circle'];

/** Waktu mulai overlay baru: posisi playhead (atau awal bila playhead di ujung). */
function overlayStart(at?: number): number {
  const t = at ?? time.value;
  return Math.round((t >= total.value - 0.5 ? 0 : t) * 1000) / 1000;
}
function pushOverlay(o: Overlay) {
  if (project.value.overlays.length >= MAX_OVERLAYS) {
    notice.value = fill(props.t.maxOverlays, { n: MAX_OVERLAYS });
    return;
  }
  project.value.overlays.push(o);
  selectedOverlay.value = o.id;
  tab.value = 'overlay';
}
function addOverlayMedia(mediaId: string, at?: number) {
  const m = mediaOf(project.value, mediaId);
  if (!m || m.kind === 'audio') return;
  const start = overlayStart(at);
  const room = Math.max(1, total.value - start);
  pushOverlay({
    ...OVERLAY_DEFAULTS,
    id: uid('o'),
    kind: 'media',
    mediaId,
    start,
    in: 0,
    out:
      Math.round((m.kind === 'video' ? Math.min(m.duration, room) : Math.min(3, room)) * 1000) /
      1000,
    w: m.kind === 'video' ? 0.35 : 0.3,
    ratio: m.width && m.height ? m.height / m.width : 9 / 16,
  });
}
function addEmoji(char: string) {
  const start = overlayStart();
  pushOverlay({
    ...OVERLAY_DEFAULTS,
    id: uid('o'),
    kind: 'emoji',
    char,
    start,
    in: 0,
    out: Math.min(3, Math.max(1, total.value - start)),
    x: 0.5,
    y: 0.45,
    w: 0.15,
    ratio: 1,
  });
}
function addShape(shape: ShapeKind) {
  const start = overlayStart();
  pushOverlay({
    ...OVERLAY_DEFAULTS,
    id: uid('o'),
    kind: 'shape',
    shape,
    start,
    in: 0,
    out: Math.min(3, Math.max(1, total.value - start)),
    x: 0.5,
    y: 0.5,
    w: shape === 'circle' ? 0.2 : 0.4,
    ratio: shape === 'circle' ? 1 : 0.4,
    opacity: 0.85,
  });
}
function updateOverlay(id: string, patch: Partial<Overlay>) {
  const i = project.value.overlays.findIndex((x) => x.id === id);
  if (i >= 0) project.value.overlays[i] = { ...project.value.overlays[i], ...patch };
}
/** Atur durasi overlay dari isian angka (video dibatasi panjang sumber). */
function setOverlayDuration(d: number) {
  const o = overlay.value;
  if (!o) return;
  const max = overlayMedia.value?.kind === 'video' ? overlayMedia.value.duration - o.in : 3600;
  o.out = Math.round((o.in + Math.max(0.2, Math.min(max, d))) * 1000) / 1000;
}
function removeOverlay() {
  const o = overlay.value;
  if (!o) return;
  const i = project.value.overlays.indexOf(o);
  project.value.overlays.splice(i, 1);
  selectedOverlay.value =
    project.value.overlays[Math.min(i, project.value.overlays.length - 1)]?.id ?? '';
}
function duplicateOverlay() {
  const o = overlay.value;
  if (!o) return;
  pushOverlay({ ...o, id: uid('o'), x: Math.min(1, o.x + 0.05), y: Math.min(1, o.y + 0.05) });
}
/** Ubah urutan lapisan: +1 = ke depan, -1 = ke belakang. */
function layer(d: number) {
  const o = overlay.value;
  if (!o) return;
  const list = project.value.overlays;
  const i = list.indexOf(o);
  const j = Math.max(0, Math.min(list.length - 1, i + d));
  if (i === j) return;
  list.splice(i, 1);
  list.splice(j, 0, o);
}

// ---------- Audio tambahan dan rekam narasi ----------

function addAudioItem(mediaId: string, at?: number, length?: number) {
  const m = mediaOf(project.value, mediaId);
  if (!m || m.kind !== 'audio') return;
  if (project.value.audios.length >= MAX_AUDIOS) {
    notice.value = fill(props.t.maxAudios, { n: MAX_AUDIOS });
    return;
  }
  const start = at ?? overlayStart();
  const len = length ?? Math.min(m.duration, Math.max(1, total.value - start));
  const a: AudioItem = {
    id: uid('a'),
    mediaId,
    start: Math.round(start * 1000) / 1000,
    in: 0,
    out: Math.round(Math.min(m.duration || len, len) * 1000) / 1000,
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
  };
  project.value.audios.push(a);
  selectedAudio.value = a.id;
  tab.value = 'music';
}
function updateAudio(id: string, patch: Partial<AudioItem>) {
  const i = project.value.audios.findIndex((x) => x.id === id);
  if (i >= 0) project.value.audios[i] = { ...project.value.audios[i], ...patch };
}
function removeAudio() {
  const a = audioItem.value;
  if (!a) return;
  const i = project.value.audios.indexOf(a);
  project.value.audios.splice(i, 1);
  selectedAudio.value =
    project.value.audios[Math.min(i, project.value.audios.length - 1)]?.id ?? '';
}
function downloadRecording(mediaId: string) {
  const f = sources.value.get(mediaId);
  if (f) downloadBlob(f, f.name);
}

const recording = ref(false);
const micStarting = ref(false);
const recSeconds = ref(0);
let recorder: MediaRecorder | null = null;
let recStream: MediaStream | null = null;
let recChunks: Blob[] = [];
let recStart = 0;
let recT0 = 0;
let recTimer: ReturnType<typeof setInterval> | undefined;
let recCount = 0;

/** Rekam narasi dari mikrofon sambil pratinjau diputar (tanpa suara) mulai dari playhead. */
async function startRecording() {
  error.value = '';
  notice.value = '';
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    error.value = props.t['error.noMic'];
    return;
  }
  // Mikrofon bisa butuh 1-2 detik untuk siap (dan menunggu izin pengguna).
  micStarting.value = true;
  try {
    recStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch {
    error.value = props.t['error.micDenied'];
    return;
  } finally {
    micStarting.value = false;
  }
  const type =
    ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((x) =>
      MediaRecorder.isTypeSupported(x),
    ) ?? '';
  recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
  recChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) recChunks.push(e.data);
  };
  recorder.onstop = () => void finishRecording();
  recStart = time.value >= total.value - 0.2 ? 0 : time.value;
  time.value = recStart;
  recorder.start(250);
  recT0 = performance.now();
  recSeconds.value = 0;
  recording.value = true;
  recTimer = setInterval(() => (recSeconds.value = (performance.now() - recT0) / 1000), 200);
  if (project.value.clips.length) playing.value = true;
}

function stopRecording() {
  if (recorder?.state === 'recording') recorder.stop();
  playing.value = false;
}

async function finishRecording() {
  clearInterval(recTimer);
  recording.value = false;
  // Durasi dari jam sendiri: file webm hasil MediaRecorder sering tidak mencatat durasinya.
  const dur = Math.round(((performance.now() - recT0) / 1000) * 1000) / 1000;
  recStream?.getTracks().forEach((t) => t.stop());
  recStream = null;
  const type = recorder?.mimeType || 'audio/webm';
  recorder = null;
  const blob = new Blob(recChunks, { type });
  recChunks = [];
  if (dur < 0.3 || !blob.size) return;
  recCount++;
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
  const name = `${props.t.recordingName}-${recCount}.${ext}`;
  const file = new File([blob], name, { type: type.split(';')[0], lastModified: Date.now() });
  const m: MediaItem = {
    id: uid('m'),
    kind: 'audio',
    name,
    size: file.size,
    duration: dur,
    width: 0,
    height: 0,
    lastModified: file.lastModified,
    recorded: true,
  };
  project.value.media.push(m);
  await attach(m, file);
  addAudioItem(m.id, recStart, dur);
  notice.value = props.t.recorded;
}

// ---------- Simpan / buka .ayu ----------

const fileBase = computed(
  () =>
    project.value.name
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .slice(0, 80) || props.t.defaultName,
);

async function save(bundled: boolean) {
  if (saveMenu.value) saveMenu.value.open = false;
  error.value = '';
  notice.value = '';
  if (bundled && missing.value.size) {
    error.value = props.t['error.missingBundle'];
    return;
  }
  busy.value = bundled ? props.t.packing : '';
  saveProgress.value = bundled ? 0 : null;
  try {
    const blob = await saveAyu(
      project.value,
      sources.value,
      bundled,
      (p) => (saveProgress.value = p * 100),
    );
    downloadBlob(blob, `${fileBase.value}.ayu`);
    saved.value = JSON.stringify(project.value);
    notice.value = bundled
      ? fill(props.t.savedBundle, { size: formatBytes(blob.size) })
      : props.t.savedLight;
  } catch (e) {
    error.value =
      (e as Error).message === 'too-large' ? props.t['error.tooLarge'] : props.m['error.failed'];
  } finally {
    busy.value = '';
    saveProgress.value = null;
  }
}

async function openProject(f: File) {
  if (dirty.value && !empty.value && !confirm(props.t.confirmDiscard)) return;
  error.value = '';
  notice.value = '';
  busy.value = props.t.opening;
  try {
    const opened = await openAyu(f);
    playing.value = false;
    forgetAll();
    results.clear();
    project.value = opened.project;
    for (const m of opened.project.media) {
      const file = opened.files.get(m.id);
      if (file) await attach(m, file);
    }
    saved.value = JSON.stringify(project.value);
    resetHistory();
    time.value = 0;
    selectedClip.value = project.value.clips[0]?.id ?? '';
    selectedText.value = project.value.texts[0]?.id ?? '';
    selectedOverlay.value = project.value.overlays[0]?.id ?? '';
    selectedAudio.value = project.value.audios[0]?.id ?? '';
    tab.value = 'media';
    notice.value = missing.value.size
      ? fill(props.t.relinkNeeded, { n: missing.value.size })
      : props.t.opened;
  } catch (e) {
    const code = (e as Error).message;
    error.value = code === 'newer' ? props.t['error.newer'] : props.t['error.invalid'];
  } finally {
    busy.value = '';
  }
}

function onOpenInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (f) openProject(f);
}

function onRelink(e: Event) {
  const input = e.target as HTMLInputElement;
  const chosen = [...(input.files ?? [])];
  input.value = '';
  const lost = project.value.media.filter((x) => missing.value.has(x.id));
  const found = matchFiles(lost, chosen);
  for (const m of lost) {
    const f = found.get(m.id);
    if (f) attach(m, f);
  }
  notice.value = fill(props.t.relinked, { n: found.size, total: lost.length });
}

function reset() {
  if (dirty.value && !empty.value && !confirm(props.t.confirmDiscard)) return;
  playing.value = false;
  forgetAll();
  results.clear();
  project.value = newProject();
  saved.value = JSON.stringify(project.value);
  resetHistory();
  time.value = 0;
  selectedClip.value = '';
  selectedText.value = '';
  selectedOverlay.value = '';
  selectedAudio.value = '';
  error.value = '';
  notice.value = '';
  tab.value = 'media';
}

// ---------- Ekspor ----------

async function runExport() {
  if (!project.value.clips.length || exporting.value) return;
  error.value = '';
  notice.value = '';
  if (missing.value.size) {
    error.value = props.t['error.missing'];
    return;
  }
  playing.value = false;
  cancelled = false;
  exporting.value = true;
  exportProgress.value = 0;
  try {
    const engine = await ff.load();
    // Font teks harus sudah dimuat sebelum teks digambar ke PNG.
    await loadEditorFonts();
    const blob = await exportVideo(
      engine,
      project.value,
      sources.value,
      (p) => (exportProgress.value = p * 100),
    );
    results.clear();
    results.add(`${fileBase.value}.mp4`, blob, formatBytes(blob.size));
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    error.value = cancelled
      ? props.m['error.cancelled']
      : msg === 'missing-media'
        ? props.t['error.missing']
        : /memory|RangeError|OOM/i.test(msg)
          ? props.m['error.memory']
          : props.m['error.failed'];
  } finally {
    exporting.value = false;
  }
}

function cancelExport() {
  cancelled = true;
  ff.cancel();
}

// ---------- Lain-lain ----------

watch(total, (t) => {
  if (time.value > t) time.value = t;
});

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (!wide.value) return;
  const typing = !!el.closest('input, textarea, select, [contenteditable]');
  if (!typing) commitHistory();
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing && !empty.value) {
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'y') {
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo();
      else undo();
    } else if (k === 'c' && clip.value && !window.getSelection()?.toString()) {
      e.preventDefault();
      clipboard.value = { ...clip.value };
      notice.value = props.t.copied;
    } else if (k === 'v' && clipboard.value) {
      e.preventDefault();
      pasteClip();
    }
    return;
  }
  if (e.key === 'Escape' && full.value && !document.fullscreenElement) {
    full.value = false;
    return;
  }
  if (
    el.closest('input, textarea, select, [contenteditable]') ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (e.key === ' ' && project.value.clips.length) {
    e.preventDefault();
    playing.value = !playing.value;
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    playing.value = false;
    const step = (e.shiftKey ? 1 : 1 / FPS) * (e.key === 'ArrowLeft' ? -1 : 1);
    time.value = Math.max(0, Math.min(total.value, Math.round((time.value + step) * 1000) / 1000));
  } else if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    playing.value = false;
    time.value = e.key === 'Home' ? 0 : total.value;
  } else if (e.key === 's' || e.key === 'S') split();
  else if (e.key === 'Delete') {
    if (tab.value === 'text') removeText();
    else if (tab.value === 'overlay') removeOverlay();
    else if (tab.value === 'music') removeAudio();
    else removeClip();
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value && !empty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}

// ---------- Aksi dari timeline ----------

/** Klip yang disalin (Ctrl+C) dan pengaturan yang disalin dari menu klik kanan. */
const clipboard = ref<Clip | null>(null);
/** Semua pengaturan klip selain sumber dan potongan (untuk Salin/Tempel pengaturan). */
type ClipStyle = Omit<Clip, 'id' | 'mediaId' | 'in' | 'out'>;
const styleClip = ref<ClipStyle | null>(null);
function styleOf(c: Clip): ClipStyle {
  const rest: Partial<Clip> = { ...c };
  delete rest.id;
  delete rest.mediaId;
  delete rest.in;
  delete rest.out;
  return rest as ClipStyle;
}

function pasteClip() {
  const c = clipboard.value;
  if (!c || !mediaOf(project.value, c.mediaId) || project.value.clips.length >= MAX_CLIPS) return;
  const i = clip.value ? project.value.clips.indexOf(clip.value) : project.value.clips.length - 1;
  const copy = { ...c, id: uid('c') };
  project.value.clips.splice(i + 1, 0, copy);
  select(copy.id);
}

function onTrimClip(i: number, c: Clip) {
  if (project.value.clips[i]?.id === c.id) project.value.clips[i] = c;
}

function onUpdateText(id: string, patch: { start: number; end: number }) {
  const i = project.value.texts.findIndex((x) => x.id === id);
  if (i >= 0)
    project.value.texts[i] = clampText({ ...project.value.texts[i], ...patch }, total.value);
}

function onUpdateMusic(patch: { offset?: number; start?: number; end?: number | null }) {
  if (project.value.music) Object.assign(project.value.music, patch);
}

function onAction(kind: TimelineAction, id: string) {
  const p = project.value;
  if (kind === 'duplicateText' || kind === 'removeText') {
    selectedText.value = id;
    tab.value = 'text';
    const tx = p.texts.find((x) => x.id === id);
    if (!tx) return;
    if (kind === 'removeText') removeText();
    else if (p.texts.length < MAX_TEXTS) {
      const copy = { ...tx, id: uid('t') };
      p.texts.push(copy);
      selectedText.value = copy.id;
    }
    return;
  }
  const c = p.clips.find((x) => x.id === id);
  if (!c) return;
  select(id);
  if (kind === 'split') split();
  else if (kind === 'duplicate') duplicate();
  else if (kind === 'remove') removeClip();
  else if (kind === 'copyStyle') {
    styleClip.value = styleOf(c);
    notice.value = props.t.styleCopied;
  } else if (kind === 'pasteStyle' && styleClip.value) {
    const i = p.clips.indexOf(c);
    p.clips[i] = { ...c, ...styleClip.value };
  }
}

// ---------- Undo / redo ----------
// Riwayat berupa snapshot JSON proyek. Perubahan beruntun (mengetik, menggeser) digabung jadi
// satu langkah lewat jeda 400 ms.
const MAX_HISTORY = 100;
const past = ref<string[]>([]);
const future = ref<string[]>([]);
let current = JSON.stringify(project.value);
let histTimer: ReturnType<typeof setTimeout> | undefined;

function commitHistory() {
  clearTimeout(histTimer);
  const now = JSON.stringify(project.value);
  if (now === current) return;
  past.value = [...past.value.slice(-(MAX_HISTORY - 1)), current];
  future.value = [];
  current = now;
}
watch(
  project,
  () => {
    clearTimeout(histTimer);
    histTimer = setTimeout(commitHistory, 400);
  },
  { deep: true },
);

function restore(json: string) {
  current = json;
  playing.value = false;
  project.value = JSON.parse(json) as Project;
  const p = project.value;
  if (!p.clips.some((c) => c.id === selectedClip.value)) selectedClip.value = p.clips[0]?.id ?? '';
  if (!p.texts.some((x) => x.id === selectedText.value)) selectedText.value = p.texts[0]?.id ?? '';
  if (!p.overlays.some((x) => x.id === selectedOverlay.value))
    selectedOverlay.value = p.overlays[0]?.id ?? '';
  if (!p.audios.some((x) => x.id === selectedAudio.value))
    selectedAudio.value = p.audios[0]?.id ?? '';
}
function undo() {
  commitHistory();
  const prev = past.value.at(-1);
  if (prev === undefined) return;
  past.value = past.value.slice(0, -1);
  future.value = [...future.value, current];
  restore(prev);
}
function redo() {
  commitHistory();
  const next = future.value.at(-1);
  if (next === undefined) return;
  future.value = future.value.slice(0, -1);
  past.value = [...past.value, current];
  restore(next);
}
function resetHistory() {
  clearTimeout(histTimer);
  past.value = [];
  future.value = [];
  current = JSON.stringify(project.value);
}

// ---------- Layar penuh ----------
const root = ref<HTMLDivElement>();
const full = ref(false);
async function toggleFull() {
  if (full.value) {
    full.value = false;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    return;
  }
  full.value = true;
  // Fullscreen API bila tersedia; jika tidak (misalnya iPhone), cukup menutupi seluruh jendela.
  await root.value?.requestFullscreen?.().catch(() => {});
}
function onFullscreenChange() {
  if (!document.fullscreenElement && full.value) full.value = false;
}
watch(full, (f) => document.documentElement.classList.toggle('overflow-hidden', f));

// ---------- Geser teks di pratinjau ----------
const dragText = computed(() => (tab.value === 'text' && text.value ? text.value.id : ''));
function moveText(id: string, x: number, y: number) {
  const i = project.value.texts.findIndex((t) => t.id === id);
  if (i < 0) return;
  const t = project.value.texts[i];
  if (time.value < t.start || time.value >= t.end) {
    playing.value = false;
    time.value = t.start;
  }
  project.value.texts[i] = { ...t, position: 'custom', x, y };
}

function transitionAll() {
  const c = clip.value;
  if (!c) return;
  project.value.clips = project.value.clips.map((x) => ({
    ...x,
    trans: c.trans,
    transDur: c.transDur,
  }));
}

// ---------- Hanya layar lebar ----------
// Timeline dan panel butuh ruang; di HP editor tidak dibuka (cukup keterangan).
const WIDE_QUERY = '(min-width: 1024px)';
const wideMq = window.matchMedia(WIDE_QUERY);
const wide = ref(wideMq.matches);
function onWideChange(e: MediaQueryListEvent) {
  wide.value = e.matches;
  if (!e.matches) playing.value = false;
}

onMounted(() => {
  wideMq.addEventListener('change', onWideChange);
  window.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('beforeunload', onBeforeUnload);
});
onBeforeUnmount(() => {
  if (recorder?.state === 'recording') recorder.stop();
  recStream?.getTracks().forEach((t) => t.stop());
  clearInterval(recTimer);
  wideMq.removeEventListener('change', onWideChange);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('beforeunload', onBeforeUnload);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.documentElement.classList.remove('overflow-hidden');
  clearTimeout(histTimer);
  forgetAll();
});

const pct = (v: number) => `${Math.round(v * 100)}%`;
const overlaySliders = computed(() => [
  { id: 'x' as const, label: props.t.posX, min: 0, max: 1, step: 0.01, show: pct },
  { id: 'y' as const, label: props.t.posY, min: 0, max: 1, step: 0.01, show: pct },
  { id: 'w' as const, label: props.t.overlaySize, min: 0.03, max: 1.5, step: 0.01, show: pct },
  {
    id: 'rotate' as const,
    label: props.t.rotation,
    min: -180,
    max: 180,
    step: 1,
    show: (v: number) => `${v}°`,
  },
]);
const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const anims: TextAnim[] = ['none', 'fade', 'up', 'left'];
const aligns = computed(() => [
  { id: 'left' as const, label: props.t['align.left'] },
  { id: 'center' as const, label: props.t['align.center'] },
  { id: 'right' as const, label: props.t['align.right'] },
]);
const textStyles = computed(() =>
  (Object.keys(TEXT_STYLES) as TextStyleId[]).map((id) => ({ id, label: props.t[`style.${id}`] })),
);
function applyTextStyle(id: TextStyleId) {
  const tx = text.value;
  if (tx) Object.assign(tx, TEXT_STYLES[id]);
}

/** Atur rentang musik dari isian angka (akhir kosong = sampai akhir video). */
function setMusicSpan(patch: { start?: number; end?: string }) {
  const m = project.value.music;
  if (!m) return;
  if (patch.start !== undefined)
    m.start = Math.max(0, Math.min(patch.start, Math.max(0, total.value - 0.5)));
  if (patch.end !== undefined) {
    const v = Number(patch.end);
    m.end =
      patch.end.trim() === '' || !Number.isFinite(v) || v >= total.value
        ? null
        : Math.max(m.start + 0.5, v);
  }
}

/** Berapa kali setiap media dipakai di timeline (termasuk sebagai musik). */
const usage = computed(() => {
  const u = new Map<string, number>();
  for (const c of project.value.clips) u.set(c.mediaId, (u.get(c.mediaId) ?? 0) + 1);
  if (project.value.music)
    u.set(project.value.music.mediaId, (u.get(project.value.music.mediaId) ?? 0) + 1);
  return u;
});

/** Seret media dari galeri ke timeline. */
function onGalleryDrag(e: DragEvent, m: MediaItem) {
  e.dataTransfer?.setData('application/x-toolland-media', m.id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
}
function insertMedia(id: string, index: number) {
  const m = mediaOf(project.value, id);
  if (!m) return;
  if (m.kind === 'audio') return useAsMusic(m);
  if (project.value.clips.length >= MAX_CLIPS) {
    notice.value = fill(props.t.maxClips, { n: MAX_CLIPS });
    return;
  }
  const c = clipFor(m);
  project.value.clips.splice(Math.max(0, Math.min(index, project.value.clips.length)), 0, c);
  select(c.id);
}

/** Media yang sudah terbukti punya audio (gelombangnya berhasil dibaca), untuk ducking. */
const voiced = computed(() => new Set(previews.peaks.value.keys()));
const kenBurnsList: KenBurns[] = ['none', 'in', 'out', 'left', 'right'];
const fits = computed(() => [
  { id: 'fit' as const, label: props.t.fitFit },
  { id: 'fill' as const, label: props.t.fitFill },
  { id: 'blur' as const, label: props.t.fitBlur },
]);
const colorKeys = computed(() => [
  { id: 'brightness' as const, label: props.t.brightness, min: 0.5, max: 1.5 },
  { id: 'contrast' as const, label: props.t.contrast, min: 0.5, max: 1.5 },
  { id: 'saturation' as const, label: props.t.saturation, min: 0, max: 2 },
]);

function rotate(d: number) {
  const c = clip.value;
  if (c) c.rotate = ((((c.rotate + d) % 360) + 360) % 360) as Rotate;
}
function resetFrame() {
  const c = clip.value;
  if (!c) return;
  Object.assign(c, {
    rotate: 0,
    flipH: false,
    flipV: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    kenBurns: 'none',
  });
}
function resetColor() {
  const c = clip.value;
  if (c) Object.assign(c, { brightness: 1, contrast: 1, saturation: 1, preset: 'none' });
}

const aspects: Aspect[] = ['16:9', '9:16', '1:1', '4:5'];
const qualities: Quality[] = ['480', '720', '1080'];
const tabs = computed(() => [
  { id: 'media' as const, label: props.t['tab.media'] },
  { id: 'clip' as const, label: props.t['tab.clip'] },
  { id: 'overlay' as const, label: props.t['tab.overlay'] },
  { id: 'text' as const, label: props.t['tab.text'] },
  { id: 'music' as const, label: props.t['tab.music'] },
]);
const kindLabel = (k: MediaKind) => props.t[`kind.${k}`];
</script>

<template>
  <div
    v-if="!wide"
    class="flex flex-col items-center gap-3 px-4 py-10 text-center"
    role="note"
    data-desktop-only
  >
    <IconMonitor class="size-10 text-brand-600 dark:text-brand-400" aria-hidden="true" />
    <p class="font-display text-xl">{{ t.desktopOnlyTitle }}</p>
    <p class="max-w-md text-sm leading-relaxed text-ink-2">{{ t.desktopOnlyBody }}</p>
  </div>
  <div
    v-else
    ref="root"
    class="space-y-4"
    :class="{ 'fixed inset-0 z-50 overflow-y-auto bg-paper p-3 sm:p-4': full }"
    data-editor
    @pointerdown.capture="commitHistory"
  >
    <!-- Bilah atas: proyek -->
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="project.name"
        type="text"
        maxlength="80"
        class="field w-full sm:w-56"
        :placeholder="t.namePlaceholder"
        :aria-label="t.name"
      />
      <button type="button" class="btn btn-secondary" :disabled="exporting" @click="reset">
        {{ t.new }}
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="exporting"
        data-open-ayu
        @click="openInput?.click()"
      >
        {{ t.open }}
      </button>
      <input
        ref="openInput"
        type="file"
        accept=".ayu"
        class="hidden"
        data-open-input
        @change="onOpenInput"
      />
      <details ref="saveMenu" class="relative">
        <summary
          class="btn btn-secondary cursor-pointer list-none"
          :class="{ 'pointer-events-none opacity-50': empty || exporting }"
          data-save
        >
          {{ t.save }}<span v-if="dirty && !empty" class="text-secang"> •</span>
        </summary>
        <div
          class="absolute left-0 z-20 mt-1 w-72 space-y-1 rounded-md border border-rule bg-paper p-1.5 shadow-lg"
        >
          <button
            type="button"
            class="block w-full rounded px-3 py-2 text-left hover:bg-paper-2"
            data-save-light
            @click="save(false)"
          >
            <span class="block text-sm font-semibold">{{ t.saveLight }}</span>
            <span class="block text-xs text-ink-3">{{ t.saveLightHint }}</span>
            <span v-if="hasRecorded" class="mt-1 block text-xs text-secang">
              {{ t.recordedLightWarn }}
            </span>
          </button>
          <button
            type="button"
            class="block w-full rounded px-3 py-2 text-left hover:bg-paper-2"
            data-save-bundle
            @click="save(true)"
          >
            <span class="block text-sm font-semibold">{{ t.saveBundle }}</span>
            <span class="block text-xs text-ink-3">{{ t.saveBundleHint }}</span>
          </button>
        </div>
      </details>
      <button
        type="button"
        class="btn btn-secondary px-3"
        :disabled="!past.length || exporting"
        :title="t.undo"
        :aria-label="t.undo"
        data-undo
        @click="undo"
      >
        ↶
      </button>
      <button
        type="button"
        class="btn btn-secondary px-3"
        :disabled="!future.length || exporting"
        :title="t.redo"
        :aria-label="t.redo"
        data-redo
        @click="redo"
      >
        ↷
      </button>
      <span class="grow"></span>
      <button
        type="button"
        class="btn btn-secondary"
        :aria-pressed="full"
        data-fullscreen
        @click="toggleFull"
      >
        {{ full ? t.exitFullscreen : t.fullscreen }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!project.clips.length || exporting || !!busy"
        data-export
        @click="runExport"
      >
        {{ t.export }}
      </button>
    </div>

    <ProgressBar v-if="busy" :label="busy" :value="saveProgress ?? undefined" />
    <div v-if="exporting" class="flex items-center gap-3">
      <ProgressBar v-if="ff.loading.value" class="flex-1" :label="m.loadingEngine" />
      <ProgressBar
        v-else
        class="flex-1"
        :label="fill(m.processing, { percent: Math.round(exportProgress) })"
        :value="exportProgress"
      />
      <button type="button" class="btn btn-secondary" @click="cancelExport">{{ m.cancel }}</button>
    </div>
    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <p v-else-if="notice" class="text-sm text-ink-2" aria-live="polite" data-notice>{{ notice }}</p>

    <!-- Media hilang setelah membuka proyek ringan -->
    <div
      v-if="missing.size"
      class="flex flex-wrap items-center gap-3 rounded-md border border-kunyit/60 bg-kunyit/10 p-3 text-sm"
      data-relink
    >
      <span class="grow">{{ fill(t.missingBanner, { n: missing.size }) }}</span>
      <button type="button" class="btn btn-secondary" @click="relinkInput?.click()">
        {{ t.relink }}
      </button>
      <input
        ref="relinkInput"
        type="file"
        multiple
        :accept="ACCEPT"
        class="hidden"
        data-relink-input
        @change="onRelink"
      />
    </div>

    <Dropzone
      v-if="empty"
      :messages="dropzone"
      :accept="ACCEPT"
      :max-size="MAX_MEDIA_BYTES"
      @files="addFiles"
      @rejected="(errs) => (error = errs.join(' '))"
      @prefetch="ff.load().catch(() => {})"
    />

    <template v-else>
      <div
        class="grid gap-4"
        :class="full ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : 'lg:grid-cols-[minmax(0,1fr)_20rem]'"
      >
        <!-- Pratinjau -->
        <div class="min-w-0 space-y-2">
          <EditorStage
            v-model:time="time"
            v-model:playing="playing"
            :project="project"
            :urls="urls"
            :empty="t.stageEmpty"
            :max-vh="full ? 50 : 60"
            :drag-text="dragText"
            :selected-overlay="selectedOverlay"
            :overlay-editable="tab === 'overlay'"
            :voiced="voiced"
            :muted="recording"
            @select-overlay="(id) => (selectedOverlay = id)"
            @update-overlay="updateOverlay"
            @move-text="moveText"
          />
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="btn btn-secondary w-24"
              :disabled="!project.clips.length"
              data-play
              @click="playing = !playing"
            >
              {{ playing ? t.pause : t.play }}
            </button>
            <span class="font-mono text-sm tabular-nums" data-time>
              {{ formatTime(time) }} / {{ formatTime(total) }}
            </span>
            <span class="grow"></span>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!project.clips.length"
              :title="t.splitKey"
              data-split
              @click="split"
            >
              {{ t.split }}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!total || project.texts.length >= MAX_TEXTS"
              data-add-text
              @click="addText"
            >
              {{ t.addText }}
            </button>
          </div>
        </div>

        <!-- Panel -->
        <div class="min-w-0 rounded-md border border-rule bg-paper">
          <div role="tablist" class="flex border-b border-rule text-sm">
            <button
              v-for="x in tabs"
              :key="x.id"
              type="button"
              role="tab"
              :aria-selected="tab === x.id"
              class="flex-1 border-b-2 px-2 py-2 font-medium"
              :class="
                tab === x.id
                  ? 'border-brand-600 text-ink'
                  : 'border-transparent text-ink-3 hover:text-ink'
              "
              :data-tab="x.id"
              @click="tab = x.id"
            >
              {{ x.label }}
            </button>
          </div>
          <div
            class="space-y-3 overflow-y-auto p-3 text-sm"
            :class="full ? 'max-h-[calc(50vh+2rem)]' : 'max-h-[28rem]'"
            role="tabpanel"
          >
            <!-- Media -->
            <template v-if="tab === 'media'">
              <button type="button" class="btn btn-secondary w-full" @click="addInput?.click()">
                {{ t.addMedia }}
              </button>
              <input
                ref="addInput"
                type="file"
                multiple
                :accept="ACCEPT"
                class="hidden"
                data-add-input
                @change="onAddInput"
              />
              <p v-if="project.media.length" class="text-xs text-ink-3">{{ t.galleryHint }}</p>
              <ul class="grid grid-cols-2 gap-2" data-gallery>
                <li
                  v-for="x in project.media"
                  :key="x.id"
                  class="group relative overflow-hidden rounded border border-rule bg-paper-2"
                  :class="{
                    'border-secang/60': missing.has(x.id),
                    'cursor-grab': true,
                  }"
                  draggable="true"
                  :data-media-item="x.id"
                  @dragstart="onGalleryDrag($event, x)"
                >
                  <span
                    class="relative block aspect-video bg-ink/10 bg-cover bg-center"
                    :style="
                      thumbs.get(x.id) ? { backgroundImage: `url(${thumbs.get(x.id)})` } : undefined
                    "
                  >
                    <span
                      v-if="x.kind === 'audio'"
                      class="absolute inset-0 grid place-items-center text-2xl text-daun"
                      aria-hidden="true"
                      >♪</span
                    >
                    <span
                      v-if="x.duration"
                      class="absolute right-1 bottom-1 rounded bg-black/70 px-1 font-mono text-[10px] text-white"
                    >
                      {{ formatTime(x.duration) }}
                    </span>
                    <span
                      v-if="usage.get(x.id)"
                      class="absolute top-1 left-1 rounded bg-brand-600 px-1 text-[10px] font-semibold text-white"
                      :title="t.used"
                    >
                      {{ usage.get(x.id) }}×
                    </span>
                    <span
                      v-if="missing.has(x.id)"
                      class="absolute inset-x-0 top-0 bg-secang/90 px-1 text-[10px] text-white"
                    >
                      {{ t.missingShort }}
                    </span>
                    <span
                      v-else-if="pendingProxy.has(x.id)"
                      class="absolute inset-x-0 top-0 bg-ink/80 px-1 text-[10px] text-white"
                    >
                      {{ t.proxyPending }}
                    </span>
                    <span
                      v-else-if="x.proxy"
                      class="absolute top-1 right-1 rounded bg-kunyit px-1 text-[10px] font-semibold text-ink"
                      :title="t.proxyBadgeHint"
                      data-proxy-badge
                    >
                      ⚡ {{ t.proxyBadge }}
                    </span>
                  </span>
                  <span class="block truncate px-1.5 pt-1 text-xs font-medium" :title="x.name">
                    {{ x.name }}
                  </span>
                  <span class="flex items-center justify-between px-1 pb-1">
                    <span class="truncate px-0.5 text-[10px] text-ink-3">
                      {{ kindLabel(x.kind) }} · {{ formatBytes(x.size) }}
                    </span>
                    <span class="flex shrink-0">
                      <button
                        type="button"
                        class="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-paper dark:text-brand-300"
                        :title="x.kind === 'audio' ? t.useAsMusic : t.addToTimeline"
                        :aria-label="`${x.kind === 'audio' ? t.useAsMusic : t.addToTimeline}: ${x.name}`"
                        @click="x.kind === 'audio' ? useAsMusic(x) : addToTimeline(x)"
                      >
                        {{ x.kind === 'audio' ? '♪' : '+' }}
                      </button>
                      <button
                        v-if="suggestProxy(x) && !x.proxy && !missing.has(x.id)"
                        type="button"
                        class="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-paper dark:text-brand-300"
                        :title="t.makeLight"
                        :aria-label="`${t.makeLight}: ${x.name}`"
                        @click="useLightPreview(x)"
                      >
                        ⚡
                      </button>
                      <button
                        v-if="x.kind === 'audio'"
                        type="button"
                        class="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-paper dark:text-brand-300"
                        :title="t.addAudioTrack"
                        :aria-label="`${t.addAudioTrack}: ${x.name}`"
                        :data-add-audio="x.id"
                        @click="addAudioItem(x.id)"
                      >
                        +
                      </button>
                      <button
                        v-if="x.kind !== 'audio'"
                        type="button"
                        class="rounded px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-paper dark:text-brand-300"
                        :title="t.asOverlay"
                        :aria-label="`${t.asOverlay}: ${x.name}`"
                        :data-as-overlay="x.id"
                        @click="addOverlayMedia(x.id)"
                      >
                        ⧉
                      </button>
                      <button
                        type="button"
                        class="rounded px-1.5 py-0.5 text-xs text-ink-3 hover:bg-paper hover:text-secang"
                        :title="t.removeMedia"
                        :aria-label="`${t.removeMedia}: ${x.name}`"
                        @click="removeMedia(x)"
                      >
                        ✕
                      </button>
                    </span>
                  </span>
                </li>
              </ul>
              <div class="grid grid-cols-2 gap-2 border-t border-rule pt-3">
                <div>
                  <label for="ed-aspect" class="label">{{ t.aspect }}</label>
                  <select id="ed-aspect" v-model="project.settings.aspect" class="field">
                    <option v-for="a in aspects" :key="a" :value="a">{{ a }}</option>
                  </select>
                </div>
                <div>
                  <label for="ed-quality" class="label">{{ t.quality }}</label>
                  <select id="ed-quality" v-model="project.settings.quality" class="field">
                    <option v-for="q in qualities" :key="q" :value="q">{{ q }}p</option>
                  </select>
                </div>
                <div>
                  <label for="ed-bg" class="label">{{ t.bg }}</label>
                  <input
                    id="ed-bg"
                    v-model="project.settings.bg"
                    type="color"
                    class="h-9 w-full"
                    data-bg
                  />
                </div>
                <div>
                  <label for="ed-fps" class="label">{{ t.fps }}</label>
                  <select id="ed-fps" v-model.number="project.settings.fps" class="field">
                    <option v-for="f in [24, 30, 60]" :key="f" :value="f">{{ f }} fps</option>
                  </select>
                </div>
                <label class="col-span-2 flex items-center gap-2">
                  <input v-model="project.settings.fade" type="checkbox" class="accent-brand-600" />
                  {{ t.fade }}
                </label>
              </div>
            </template>

            <!-- Klip -->
            <template v-else-if="tab === 'clip'">
              <p v-if="!clip" class="text-ink-3">{{ t.noClip }}</p>
              <template v-else>
                <p class="truncate font-medium" :title="clipMedia?.name">
                  {{ clipMedia?.name }} · {{ formatTime(clipLength(clip)) }}
                </p>

                <EditorSection :title="t['section.time']">
                  <template v-if="clipMedia?.kind === 'video'">
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label for="ed-in" class="label">{{ t.in }}</label>
                        <input
                          id="ed-in"
                          type="number"
                          min="0"
                          step="0.1"
                          class="field"
                          :value="r1(clip.in)"
                          data-clip-in
                          @change="updateClip({ in: num($event) })"
                        />
                      </div>
                      <div>
                        <label for="ed-out" class="label">{{ t.out }}</label>
                        <input
                          id="ed-out"
                          type="number"
                          min="0"
                          step="0.1"
                          class="field"
                          :value="r1(clip.out)"
                          data-clip-out
                          @change="updateClip({ out: num($event) })"
                        />
                      </div>
                      <button
                        type="button"
                        class="btn btn-secondary text-xs"
                        :disabled="playheadLocal === null"
                        @click="updateClip({ in: playheadLocal ?? clip.in })"
                      >
                        {{ t.inHere }}
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary text-xs"
                        :disabled="playheadLocal === null"
                        @click="updateClip({ out: playheadLocal ?? clip.out })"
                      >
                        {{ t.outHere }}
                      </button>
                    </div>
                    <p class="text-xs text-ink-3">
                      {{ fill(t.sourceLength, { time: formatTime(clipMedia.duration) }) }}
                    </p>
                    <div>
                      <span class="label">{{ t.speed }}</span>
                      <div class="flex flex-wrap gap-1" role="group" :aria-label="t.speed">
                        <button
                          v-for="sp in speeds"
                          :key="sp"
                          type="button"
                          class="rounded border px-2 py-1 text-xs tabular-nums"
                          :class="
                            clip.speed === sp
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-rule hover:border-ink-3'
                          "
                          :aria-pressed="clip.speed === sp"
                          :data-speed="sp"
                          @click="clip.speed = sp"
                        >
                          {{ sp }}×
                        </button>
                      </div>
                    </div>
                  </template>
                  <div v-else>
                    <label for="ed-dur" class="label">{{ t.imageDuration }}</label>
                    <input
                      id="ed-dur"
                      type="number"
                      min="0.2"
                      max="3600"
                      step="0.5"
                      class="field"
                      :value="r1(clipLength(clip))"
                      @change="updateClip({ in: 0, out: num($event) })"
                    />
                  </div>
                </EditorSection>

                <EditorSection v-if="clipMedia?.kind === 'video'" :title="t['section.audio']">
                  <div>
                    <div class="flex items-center justify-between">
                      <label for="ed-vol" class="label">
                        {{ t.volume }} · {{ Math.round(clip.volume * 100) }}%
                      </label>
                      <button
                        type="button"
                        class="text-xs text-brand-700 hover:underline dark:text-brand-300"
                        data-mute
                        @click="clip.volume = clip.volume > 0 ? 0 : 1"
                      >
                        {{ clip.volume > 0 ? t.mute : t.unmute }}
                      </button>
                    </div>
                    <input
                      id="ed-vol"
                      v-model.number="clip.volume"
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      class="w-full accent-brand-600"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="ed-fi" class="label"
                        >{{ t.fadeIn }} · {{ clip.fadeIn.toFixed(1) }} s</label
                      >
                      <input
                        id="ed-fi"
                        v-model.number="clip.fadeIn"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-fo" class="label"
                        >{{ t.fadeOut }} · {{ clip.fadeOut.toFixed(1) }} s</label
                      >
                      <input
                        id="ed-fo"
                        v-model.number="clip.fadeOut"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                </EditorSection>

                <EditorSection :title="t['section.frame']">
                  <div class="grid grid-cols-3 gap-1" role="group" :aria-label="t.fit">
                    <button
                      v-for="f in fits"
                      :key="f.id"
                      type="button"
                      class="rounded border px-1 py-1.5 text-xs"
                      :class="
                        clip.fit === f.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-rule hover:border-ink-3'
                      "
                      :aria-pressed="clip.fit === f.id"
                      :data-fit="f.id"
                      @click="clip.fit = f.id"
                    >
                      {{ f.label }}
                    </button>
                  </div>
                  <div class="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      class="btn btn-secondary px-1 text-xs"
                      :title="t.rotateLeft"
                      :aria-label="t.rotateLeft"
                      @click="rotate(-90)"
                    >
                      ⟲
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary px-1 text-xs"
                      :title="t.rotateRight"
                      :aria-label="t.rotateRight"
                      data-rotate
                      @click="rotate(90)"
                    >
                      ⟳
                    </button>
                    <button
                      type="button"
                      class="btn px-1 text-xs"
                      :class="clip.flipH ? 'btn-active' : 'btn-secondary'"
                      :aria-pressed="clip.flipH"
                      :title="t.flipH"
                      @click="clip.flipH = !clip.flipH"
                    >
                      ⇋
                    </button>
                    <button
                      type="button"
                      class="btn px-1 text-xs"
                      :class="clip.flipV ? 'btn-active' : 'btn-secondary'"
                      :aria-pressed="clip.flipV"
                      :title="t.flipV"
                      @click="clip.flipV = !clip.flipV"
                    >
                      ⇵
                    </button>
                  </div>
                  <div>
                    <label for="ed-zoom" class="label"
                      >{{ t.zoomClip }} · {{ Math.round(clip.zoom * 100) }}%</label
                    >
                    <input
                      id="ed-zoom"
                      v-model.number="clip.zoom"
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      class="w-full accent-brand-600"
                      data-zoom-clip
                    />
                  </div>
                  <div v-if="clip.zoom > 1" class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="ed-px" class="label">{{ t.panX }}</label>
                      <input
                        id="ed-px"
                        v-model.number="clip.panX"
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-py" class="label">{{ t.panY }}</label>
                      <input
                        id="ed-py"
                        v-model.number="clip.panY"
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                  <div v-if="clipMedia?.kind === 'image'">
                    <label for="ed-kb" class="label">{{ t.kenBurns }}</label>
                    <select id="ed-kb" v-model="clip.kenBurns" class="field" data-ken-burns>
                      <option v-for="k in kenBurnsList" :key="k" :value="k">
                        {{ t[`kenBurns.${k}`] }}
                      </option>
                    </select>
                  </div>
                  <button
                    type="button"
                    class="text-xs text-ink-3 hover:text-ink"
                    @click="resetFrame"
                  >
                    {{ t.resetFrame }}
                  </button>
                </EditorSection>

                <EditorSection :title="t['section.color']">
                  <div class="grid grid-cols-4 gap-1" role="group" :aria-label="t['section.color']">
                    <button
                      v-for="pr in COLOR_PRESETS"
                      :key="pr"
                      type="button"
                      class="rounded border px-1 py-1.5 text-[11px]"
                      :class="
                        clip.preset === pr
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-rule hover:border-ink-3'
                      "
                      :aria-pressed="clip.preset === pr"
                      :data-preset="pr"
                      @click="clip.preset = pr"
                    >
                      {{ t[`preset.${pr}`] }}
                    </button>
                  </div>
                  <div v-for="k in colorKeys" :key="k.id">
                    <label :for="`ed-${k.id}`" class="label"
                      >{{ k.label }} · {{ Math.round(clip[k.id] * 100) }}%</label
                    >
                    <input
                      :id="`ed-${k.id}`"
                      v-model.number="clip[k.id]"
                      type="range"
                      :min="k.min"
                      :max="k.max"
                      step="0.05"
                      class="w-full accent-brand-600"
                    />
                  </div>
                  <button
                    type="button"
                    class="text-xs text-ink-3 hover:text-ink"
                    @click="resetColor"
                  >
                    {{ t.resetColor }}
                  </button>
                </EditorSection>

                <EditorSection :title="t['section.transition']">
                  <div v-if="clipIndex < project.clips.length - 1" class="space-y-2">
                    <div>
                      <label for="ed-tr" class="label">{{ t.transition }}</label>
                      <select id="ed-tr" v-model="clip.trans" class="field" data-transition>
                        <option value="none">{{ t['transition.none'] }}</option>
                        <option value="black">{{ t['transition.black'] }}</option>
                        <option value="white">{{ t['transition.white'] }}</option>
                        <option value="cross">{{ t['transition.cross'] }}</option>
                        <option value="wipe">{{ t['transition.wipe'] }}</option>
                        <option value="slide">{{ t['transition.slide'] }}</option>
                        <option value="circle">{{ t['transition.circle'] }}</option>
                      </select>
                    </div>
                    <div v-if="clip.trans !== 'none'">
                      <label for="ed-trd" class="label">
                        {{ t.transitionDur }} · {{ clip.transDur.toFixed(1) }} s
                      </label>
                      <input
                        id="ed-trd"
                        v-model.number="clip.transDur"
                        type="range"
                        min="0.2"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <button
                      v-if="project.clips.length > 2"
                      type="button"
                      class="btn btn-secondary w-full text-xs"
                      @click="transitionAll"
                    >
                      {{ t.transitionAll }}
                    </button>
                  </div>
                  <p
                    v-if="clipIndex < project.clips.length - 1 && isOverlap(clip.trans)"
                    class="text-xs text-ink-3"
                  >
                    {{ t.transitionOverlapHint }}
                  </p>
                  <p v-else class="text-xs text-ink-3">{{ t.transitionLast }}</p>
                </EditorSection>
                <div class="grid grid-cols-2 gap-2 border-t border-rule pt-3">
                  <button type="button" class="btn btn-secondary text-xs" @click="shift(-1)">
                    ← {{ t.moveLeft }}
                  </button>
                  <button type="button" class="btn btn-secondary text-xs" @click="shift(1)">
                    {{ t.moveRight }} →
                  </button>
                  <button type="button" class="btn btn-secondary text-xs" @click="duplicate">
                    {{ t.duplicate }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary text-xs text-secang"
                    data-remove-clip
                    @click="removeClip"
                  >
                    {{ t.removeClip }}
                  </button>
                </div>
              </template>
            </template>

            <!-- Overlay -->
            <template v-else-if="tab === 'overlay'">
              <EditorSection :title="t['section.addOverlay']">
                <p class="text-xs text-ink-3">{{ t.overlayHint }}</p>
                <div>
                  <span class="label">{{ t.emoji }}</span>
                  <div class="grid grid-cols-8 gap-0.5" role="group" :aria-label="t.emoji">
                    <button
                      v-for="em in EMOJIS"
                      :key="em"
                      type="button"
                      class="rounded py-0.5 text-lg hover:bg-paper-2"
                      :data-emoji="em"
                      @click="addEmoji(em)"
                    >
                      {{ em }}
                    </button>
                  </div>
                </div>
                <div>
                  <span class="label">{{ t.shapes }}</span>
                  <div class="grid grid-cols-3 gap-1">
                    <button
                      v-for="sh in SHAPES"
                      :key="sh"
                      type="button"
                      class="btn btn-secondary text-xs"
                      :data-shape="sh"
                      @click="addShape(sh)"
                    >
                      {{ t[`shape.${sh}`] }}
                    </button>
                  </div>
                </div>
              </EditorSection>
              <div v-if="project.overlays.length > 1" class="flex flex-wrap gap-1">
                <button
                  v-for="(x, i) in project.overlays"
                  :key="x.id"
                  type="button"
                  class="rounded border px-2 py-0.5 text-xs"
                  :class="
                    x.id === selectedOverlay ? 'border-kunyit bg-kunyit text-ink' : 'border-rule'
                  "
                  @click="selectedOverlay = x.id"
                >
                  {{ i + 1 }}
                </button>
              </div>
              <p v-if="!overlay" class="text-ink-3">{{ t.noOverlay }}</p>
              <template v-else>
                <p class="rounded bg-kunyit/15 px-2 py-1.5 text-xs text-ink-2">
                  {{ t.overlayDragHint }}
                </p>
                <EditorSection :title="t['section.placement']">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-os" class="label">{{ t.textStart }}</label>
                      <input
                        id="ed-os"
                        type="number"
                        min="0"
                        step="0.1"
                        class="field"
                        :value="r1(overlay.start)"
                        @change="overlay.start = Math.max(0, num($event))"
                      />
                    </div>
                    <div>
                      <label for="ed-od" class="label">{{ t.overlayDuration }}</label>
                      <input
                        id="ed-od"
                        type="number"
                        min="0.2"
                        step="0.1"
                        class="field"
                        :value="r1(overlay.out - overlay.in)"
                        @change="setOverlayDuration(num($event))"
                      />
                    </div>
                  </div>
                  <div v-for="k in overlaySliders" :key="k.id">
                    <label :for="`ed-o${k.id}`" class="label"
                      >{{ k.label }} · {{ k.show(overlay[k.id]) }}</label
                    >
                    <input
                      :id="`ed-o${k.id}`"
                      v-model.number="overlay[k.id]"
                      type="range"
                      :min="k.min"
                      :max="k.max"
                      :step="k.step"
                      class="w-full accent-brand-600"
                      :data-overlay-slider="k.id"
                    />
                  </div>
                  <div v-if="overlay.kind === 'shape'" class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-ofill" class="label">{{ t.color }}</label>
                      <input id="ed-ofill" v-model="overlay.fill" type="color" class="h-9 w-full" />
                    </div>
                    <div>
                      <label for="ed-oratio" class="label">{{ t.shapeHeight }}</label>
                      <input
                        id="ed-oratio"
                        v-model.number="overlay.ratio"
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.05"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                </EditorSection>
                <EditorSection :title="t['section.overlayLook']">
                  <div>
                    <label for="ed-oop" class="label"
                      >{{ t.boxOpacity }} · {{ Math.round(overlay.opacity * 100) }}%</label
                    >
                    <input
                      id="ed-oop"
                      v-model.number="overlay.opacity"
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      class="w-full accent-brand-600"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="ed-ofi" class="label"
                        >{{ t.fadeIn }} · {{ overlay.fadeIn.toFixed(1) }} s</label
                      >
                      <input
                        id="ed-ofi"
                        v-model.number="overlay.fadeIn"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-ofo" class="label"
                        >{{ t.fadeOut }} · {{ overlay.fadeOut.toFixed(1) }} s</label
                      >
                      <input
                        id="ed-ofo"
                        v-model.number="overlay.fadeOut"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                  <div v-if="overlayMedia?.kind === 'video'">
                    <label for="ed-ovol" class="label"
                      >{{ t.volume }} · {{ Math.round(overlay.volume * 100) }}%</label
                    >
                    <input
                      id="ed-ovol"
                      v-model.number="overlay.volume"
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      class="w-full accent-brand-600"
                    />
                  </div>
                </EditorSection>
                <div class="grid grid-cols-2 gap-2 border-t border-rule pt-3">
                  <button
                    type="button"
                    class="btn btn-secondary text-xs"
                    data-layer-down
                    @click="layer(-1)"
                  >
                    {{ t.layerBack }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary text-xs"
                    data-layer-up
                    @click="layer(1)"
                  >
                    {{ t.layerFront }}
                  </button>
                  <button type="button" class="btn btn-secondary text-xs" @click="duplicateOverlay">
                    {{ t.duplicate }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary text-xs text-secang"
                    @click="removeOverlay"
                  >
                    {{ t.removeOverlay }}
                  </button>
                </div>
              </template>
            </template>

            <!-- Teks -->
            <template v-else-if="tab === 'text'">
              <button
                type="button"
                class="btn btn-secondary w-full"
                :disabled="!total || project.texts.length >= MAX_TEXTS"
                @click="addText"
              >
                {{ t.addText }}
              </button>
              <div v-if="project.texts.length > 1" class="flex flex-wrap gap-1">
                <button
                  v-for="(x, i) in project.texts"
                  :key="x.id"
                  type="button"
                  class="rounded border px-2 py-0.5 text-xs"
                  :class="x.id === selectedText ? 'border-nila bg-nila text-white' : 'border-rule'"
                  @click="selectedText = x.id"
                >
                  {{ i + 1 }}
                </button>
              </div>
              <p v-if="!text" class="text-ink-3">{{ t.noText }}</p>
              <template v-else>
                <p class="rounded bg-nila/10 px-2 py-1.5 text-xs text-ink-2">
                  {{ t.dragTextHint }}
                </p>
                <div>
                  <label for="ed-text" class="label">{{ t.textContent }}</label>
                  <textarea
                    id="ed-text"
                    v-model="text.text"
                    rows="3"
                    maxlength="200"
                    class="field"
                    data-text-input
                  ></textarea>
                </div>

                <EditorSection :title="t['section.style']">
                  <div class="grid grid-cols-3 gap-1" role="group" :aria-label="t['section.style']">
                    <button
                      v-for="st in textStyles"
                      :key="st.id"
                      type="button"
                      class="rounded border border-rule px-1 py-1.5 text-xs hover:border-ink-3"
                      :data-text-style="st.id"
                      @click="applyTextStyle(st.id)"
                    >
                      {{ st.label }}
                    </button>
                  </div>
                  <div>
                    <span class="label">{{ t.font }}</span>
                    <div class="grid grid-cols-2 gap-1" role="group" :aria-label="t.font">
                      <button
                        v-for="fid in FONT_IDS"
                        :key="fid"
                        type="button"
                        class="truncate rounded border px-2 py-1 text-left text-sm"
                        :class="
                          text.font === fid
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-rule hover:border-ink-3'
                        "
                        :style="{
                          fontFamily: `'${FONTS[fid].family}'`,
                          fontWeight: FONTS[fid].weight,
                        }"
                        :aria-pressed="text.font === fid"
                        :data-font="fid"
                        @click="text.font = fid"
                      >
                        {{ FONTS[fid].label }}
                      </button>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-tz" class="label">{{ t.size }}</label>
                      <select id="ed-tz" v-model="text.size" class="field">
                        <option value="s">{{ t['size.s'] }}</option>
                        <option value="m">{{ t['size.m'] }}</option>
                        <option value="l">{{ t['size.l'] }}</option>
                      </select>
                    </div>
                    <div>
                      <label for="ed-tc" class="label">{{ t.color }}</label>
                      <input id="ed-tc" v-model="text.color" type="color" class="h-9 w-full" />
                    </div>
                  </div>
                  <div class="grid grid-cols-3 gap-1" role="group" :aria-label="t.align">
                    <button
                      v-for="al in aligns"
                      :key="al.id"
                      type="button"
                      class="rounded border px-1 py-1 text-xs"
                      :class="
                        text.align === al.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-rule hover:border-ink-3'
                      "
                      :aria-pressed="text.align === al.id"
                      @click="text.align = al.id"
                    >
                      {{ al.label }}
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-x-4 gap-y-2">
                    <label class="flex items-center gap-2">
                      <input v-model="text.stroke" type="checkbox" class="accent-brand-600" />
                      {{ t.stroke }}
                    </label>
                    <label class="flex items-center gap-2">
                      <input v-model="text.shadow" type="checkbox" class="accent-brand-600" />
                      {{ t.shadow }}
                    </label>
                    <label class="flex items-center gap-2">
                      <input
                        v-model="text.box"
                        type="checkbox"
                        class="accent-brand-600"
                        data-text-box
                      />
                      {{ t.box }}
                    </label>
                  </div>
                  <div v-if="text.box" class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-bc" class="label">{{ t.boxColor }}</label>
                      <input id="ed-bc" v-model="text.boxColor" type="color" class="h-9 w-full" />
                    </div>
                    <div>
                      <label for="ed-bo" class="label">
                        {{ t.boxOpacity }} · {{ Math.round(text.boxOpacity * 100) }}%
                      </label>
                      <input
                        id="ed-bo"
                        v-model.number="text.boxOpacity"
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                </EditorSection>

                <EditorSection :title="t['section.placement']">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-ts" class="label">{{ t.textStart }}</label>
                      <input
                        id="ed-ts"
                        type="number"
                        min="0"
                        step="0.1"
                        class="field"
                        :value="r1(text.start)"
                        @change="updateText({ start: num($event) })"
                      />
                    </div>
                    <div>
                      <label for="ed-te" class="label">{{ t.textEnd }}</label>
                      <input
                        id="ed-te"
                        type="number"
                        min="0"
                        step="0.1"
                        class="field"
                        :value="r1(text.end)"
                        @change="updateText({ end: num($event) })"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="ed-tp" class="label">{{ t.position }}</label>
                    <select id="ed-tp" v-model="text.position" class="field">
                      <option value="top">{{ t['position.top'] }}</option>
                      <option value="center">{{ t['position.center'] }}</option>
                      <option value="bottom">{{ t['position.bottom'] }}</option>
                      <option value="custom">{{ t['position.custom'] }}</option>
                    </select>
                  </div>
                </EditorSection>

                <EditorSection :title="t['section.animation']">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-ai" class="label">{{ t.animIn }}</label>
                      <select id="ed-ai" v-model="text.animIn" class="field" data-anim-in>
                        <option v-for="an in anims" :key="an" :value="an">
                          {{ t[`anim.${an}`] }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label for="ed-ao" class="label">{{ t.animOut }}</label>
                      <select id="ed-ao" v-model="text.animOut" class="field">
                        <option v-for="an in anims" :key="an" :value="an">
                          {{ t[`anim.${an}`] }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div v-if="text.animIn !== 'none' || text.animOut !== 'none'">
                    <label for="ed-ad" class="label">
                      {{ t.animDur }} · {{ text.animDur.toFixed(1) }} s
                    </label>
                    <input
                      id="ed-ad"
                      v-model.number="text.animDur"
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.1"
                      class="w-full accent-brand-600"
                    />
                  </div>
                </EditorSection>

                <button
                  type="button"
                  class="btn btn-secondary w-full text-secang"
                  @click="removeText"
                >
                  {{ t.removeText }}
                </button>
              </template>
            </template>

            <!-- Musik -->
            <template v-else>
              <template v-if="project.music">
                <p class="truncate font-medium">
                  ♪ {{ mediaOf(project, project.music.mediaId)?.name }}
                </p>
                <div>
                  <label for="ed-mv" class="label">
                    {{ t.volume }} · {{ Math.round(project.music.volume * 100) }}%
                  </label>
                  <input
                    id="ed-mv"
                    v-model.number="project.music.volume"
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    class="w-full accent-brand-600"
                  />
                </div>
                <label class="flex items-start gap-2">
                  <input
                    v-model="project.music.duck"
                    type="checkbox"
                    class="mt-1 accent-brand-600"
                    data-duck
                  />
                  <span>
                    {{ t.duck }}
                    <span class="block text-xs text-ink-3">{{ t.duckHint }}</span>
                  </span>
                </label>
                <EditorSection :title="t['section.musicRange']">
                  <div>
                    <label for="ed-mo" class="label">{{ t.musicOffset }}</label>
                    <input
                      id="ed-mo"
                      type="number"
                      min="0"
                      step="0.5"
                      class="field"
                      :value="r1(project.music.offset)"
                      @change="project.music.offset = Math.max(0, num($event))"
                    />
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-ms" class="label">{{ t.musicFrom }}</label>
                      <input
                        id="ed-ms"
                        type="number"
                        min="0"
                        step="0.5"
                        class="field"
                        :value="r1(project.music.start)"
                        data-music-start
                        @change="setMusicSpan({ start: num($event) })"
                      />
                    </div>
                    <div>
                      <label for="ed-me" class="label">{{ t.musicTo }}</label>
                      <input
                        id="ed-me"
                        type="number"
                        min="0"
                        step="0.5"
                        class="field"
                        :placeholder="t.musicToEnd"
                        :value="project.music.end === null ? '' : r1(project.music.end)"
                        @change="setMusicSpan({ end: ($event.target as HTMLInputElement).value })"
                      />
                    </div>
                  </div>
                  <p class="text-xs text-ink-3">{{ t.musicRangeHint }}</p>
                </EditorSection>
                <EditorSection :title="t['section.musicFade']">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label for="ed-mfi" class="label">
                        {{ t.fadeIn }} · {{ project.music.fadeIn.toFixed(1) }} s
                      </label>
                      <input
                        id="ed-mfi"
                        v-model.number="project.music.fadeIn"
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-mfo" class="label">
                        {{ t.fadeOut }} · {{ project.music.fadeOut.toFixed(1) }} s
                      </label>
                      <input
                        id="ed-mfo"
                        v-model.number="project.music.fadeOut"
                        type="range"
                        min="0"
                        max="5"
                        step="0.5"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                </EditorSection>
                <button
                  type="button"
                  class="btn btn-secondary w-full text-secang"
                  @click="project.music = null"
                >
                  {{ t.removeMusic }}
                </button>
              </template>
              <p v-else class="text-ink-3">{{ t.noMusic }}</p>

              <EditorSection :title="t['section.extraAudio']">
                <button
                  v-if="!recording"
                  type="button"
                  class="btn btn-secondary w-full"
                  :disabled="exporting || !!busy || micStarting"
                  data-record
                  @click="startRecording"
                >
                  🎙 {{ micStarting ? t.micStarting : t.record }}
                </button>
                <button
                  v-else
                  type="button"
                  class="btn w-full bg-secang text-white hover:bg-secang/90"
                  data-record-stop
                  @click="stopRecording"
                >
                  ● {{ fill(t.recordingNow, { time: formatTime(recSeconds) }) }}
                </button>
                <p class="text-xs text-ink-3">{{ t.recordHint }}</p>
                <div v-if="project.audios.length > 1" class="flex flex-wrap gap-1">
                  <button
                    v-for="(x, i) in project.audios"
                    :key="x.id"
                    type="button"
                    class="rounded border px-2 py-0.5 text-xs"
                    :class="
                      x.id === selectedAudio ? 'border-nila bg-nila text-white' : 'border-rule'
                    "
                    @click="selectedAudio = x.id"
                  >
                    {{ i + 1 }}
                  </button>
                </div>
                <template v-if="audioItem">
                  <p class="truncate font-medium">
                    🎙 {{ mediaOf(project, audioItem.mediaId)?.name }}
                  </p>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label for="ed-as" class="label">{{ t.textStart }}</label>
                      <input
                        id="ed-as"
                        type="number"
                        min="0"
                        step="0.1"
                        class="field"
                        :value="r1(audioItem.start)"
                        @change="audioItem.start = Math.max(0, num($event))"
                      />
                    </div>
                    <div>
                      <label for="ed-avol" class="label">
                        {{ t.volume }} · {{ Math.round(audioItem.volume * 100) }}%
                      </label>
                      <input
                        id="ed-avol"
                        v-model.number="audioItem.volume"
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-afi" class="label">
                        {{ t.fadeIn }} · {{ audioItem.fadeIn.toFixed(1) }} s
                      </label>
                      <input
                        id="ed-afi"
                        v-model.number="audioItem.fadeIn"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                    <div>
                      <label for="ed-afo" class="label">
                        {{ t.fadeOut }} · {{ audioItem.fadeOut.toFixed(1) }} s
                      </label>
                      <input
                        id="ed-afo"
                        v-model.number="audioItem.fadeOut"
                        type="range"
                        min="0"
                        max="3"
                        step="0.1"
                        class="w-full accent-brand-600"
                      />
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      v-if="mediaOf(project, audioItem.mediaId)?.recorded"
                      type="button"
                      class="btn btn-secondary text-xs"
                      @click="downloadRecording(audioItem.mediaId)"
                    >
                      {{ t.downloadRecording }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary text-xs text-secang"
                      @click="removeAudio"
                    >
                      {{ t.removeAudio }}
                    </button>
                  </div>
                </template>
              </EditorSection>
            </template>
          </div>
        </div>
      </div>

      <EditorTimeline
        :project="project"
        :time="time"
        :playing="playing"
        :selected-clip="selectedClip"
        :selected-text="selectedText"
        :selected-overlay="selectedOverlay"
        :selected-audio="selectedAudio"
        :frames="previews.frames.value"
        :peaks="previews.peaks.value"
        :thumbs="thumbs"
        :missing="missing"
        :can-paste-style="!!styleClip"
        :t="t"
        @seek="(s) => ((playing = false), (time = s))"
        @select-clip="select"
        @select-text="(id) => ((selectedText = id), (tab = 'text'))"
        @select-overlay="(id) => ((selectedOverlay = id), (tab = 'overlay'))"
        @update-overlay="updateOverlay"
        @insert-overlay="(id, at) => addOverlayMedia(id, at)"
        @select-audio="(id) => ((selectedAudio = id), (tab = 'music'))"
        @update-audio="updateAudio"
        @insert-audio="(id, at) => addAudioItem(id, at)"
        @select-music="tab = 'music'"
        @move="(a, b) => (project = moveClip(project, a, b))"
        @trim-clip="onTrimClip"
        @update-text="onUpdateText"
        @update-music="onUpdateMusic"
        @insert-media="insertMedia"
        @action="onAction"
      />
      <p class="text-xs text-ink-3">{{ t.shortcuts }}</p>
    </template>

    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
