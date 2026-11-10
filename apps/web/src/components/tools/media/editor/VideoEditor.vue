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
  type Clip,
  type MediaItem,
  type MediaKind,
  type Project,
  type Quality,
  type TextLayer,
  MAX_CLIPS,
  MAX_TEXTS,
  clampClip,
  clampText,
  clipAt,
  clipFor,
  clipLength,
  mediaOf,
  moveClip,
  newProject,
  splitAt,
  totalDuration,
  uid,
} from '../../../../lib/editor/project';
import { exportVideo } from '../../../../lib/editor/render';
import IconMonitor from '~icons/lucide/monitor';
import Dropzone, { type DropzoneMessages } from '../../../ui/Dropzone.vue';
import FileResults from '../../../ui/FileResults.vue';
import ProgressBar from '../../../ui/ProgressBar.vue';
import EditorStage from './EditorStage.vue';
import EditorTimeline from './EditorTimeline.vue';

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
const tab = ref<'media' | 'clip' | 'text' | 'music'>('media');
const error = ref('');
const notice = ref('');
const busy = ref('');
const saveProgress = ref<number | null>(null);
const saved = ref(JSON.stringify(project.value));
const addInput = ref<HTMLInputElement>();
const openInput = ref<HTMLInputElement>();
const relinkInput = ref<HTMLInputElement>();
const saveMenu = ref<HTMLDetailsElement>();

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
  const url = URL.createObjectURL(f);
  setMap(sources, m.id, f);
  setMap(urls, m.id, url);
  if (m.kind === 'image') setMap(thumbs, m.id, url);
  else if (m.kind === 'video')
    probe(url, 'video')
      .then((p) => p.thumb && setMap(thumbs, m.id, p.thumb))
      .catch(() => {});
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
      try {
        info = await probe(url, kind);
      } catch {
        skipped.push(f.name);
        continue;
      } finally {
        URL.revokeObjectURL(url);
      }
      const m: MediaItem = {
        id: uid('m'),
        kind,
        name: f.name.slice(0, 200),
        size: f.size,
        duration: Math.round(info.duration * 1000) / 1000,
        width: info.width,
        height: info.height,
        lastModified: f.lastModified,
      };
      if (info.thumb) URL.revokeObjectURL(info.thumb);
      project.value.media.push(m);
      await attach(m, f);
      if (kind === 'audio') {
        project.value.music = { mediaId: m.id, offset: 0, volume: 0.6, fadeOut: true };
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
  project.value.music = { mediaId: m.id, offset: 0, volume: 0.6, fadeOut: true };
  tab.value = 'music';
}

function removeMedia(m: MediaItem) {
  const p = project.value;
  p.clips = p.clips.filter((c) => c.mediaId !== m.id);
  if (p.music?.mediaId === m.id) p.music = null;
  p.media = p.media.filter((x) => x.id !== m.id);
  // File tetap disimpan di memori sesi agar penghapusan bisa dibatalkan (undo).
}

function forget(id: string) {
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
      position: 'bottom',
      size: 'm',
      color: '#ffffff',
      box: false,
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
  } else if (e.key === 's' || e.key === 'S') split();
  else if (e.key === 'Delete') {
    if (tab.value === 'text') removeText();
    else removeClip();
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value && !empty.value) {
    e.preventDefault();
    e.returnValue = '';
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
  wideMq.removeEventListener('change', onWideChange);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('beforeunload', onBeforeUnload);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  document.documentElement.classList.remove('overflow-hidden');
  clearTimeout(histTimer);
  forgetAll();
});

const aspects: Aspect[] = ['16:9', '9:16', '1:1', '4:5'];
const qualities: Quality[] = ['480', '720', '1080'];
const tabs = computed(() => [
  { id: 'media' as const, label: props.t['tab.media'] },
  { id: 'clip' as const, label: props.t['tab.clip'] },
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
            :max-vh="full ? 62 : 60"
            :drag-text="dragText"
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
            :class="full ? 'max-h-[62vh]' : 'max-h-[28rem]'"
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
              <ul class="space-y-2">
                <li
                  v-for="x in project.media"
                  :key="x.id"
                  class="flex items-center gap-2 rounded border border-rule p-2"
                  :class="{ 'border-secang/60 bg-secang/5': missing.has(x.id) }"
                >
                  <span
                    class="size-10 shrink-0 rounded bg-ink/10 bg-cover bg-center"
                    :style="
                      thumbs.get(x.id) ? { backgroundImage: `url(${thumbs.get(x.id)})` } : undefined
                    "
                  ></span>
                  <span class="min-w-0 grow">
                    <span class="block truncate font-medium" :title="x.name">{{ x.name }}</span>
                    <span class="block text-xs text-ink-3">
                      {{ kindLabel(x.kind) }}
                      <template v-if="x.duration"> · {{ formatTime(x.duration) }}</template>
                      · {{ formatBytes(x.size) }}
                      <template v-if="missing.has(x.id)"> · {{ t.missingShort }}</template>
                    </span>
                  </span>
                  <button
                    v-if="x.kind !== 'audio'"
                    type="button"
                    class="rounded px-1.5 py-1 text-xs font-semibold text-brand-700 hover:bg-paper-2 dark:text-brand-300"
                    :title="t.addToTimeline"
                    @click="addToTimeline(x)"
                  >
                    +
                  </button>
                  <button
                    v-else
                    type="button"
                    class="rounded px-1.5 py-1 text-xs font-semibold text-brand-700 hover:bg-paper-2 dark:text-brand-300"
                    @click="useAsMusic(x)"
                  >
                    ♪
                  </button>
                  <button
                    type="button"
                    class="rounded px-1.5 py-1 text-xs text-ink-3 hover:bg-paper-2 hover:text-secang"
                    :title="t.removeMedia"
                    :aria-label="`${t.removeMedia}: ${x.name}`"
                    @click="removeMedia(x)"
                  >
                    ✕
                  </button>
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
                    <label for="ed-vol" class="label">
                      {{ t.volume }} · {{ Math.round(clip.volume * 100) }}%
                    </label>
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
                <fieldset>
                  <legend class="label">{{ t.fit }}</legend>
                  <div class="flex gap-3">
                    <label class="flex items-center gap-1.5">
                      <input v-model="clip.fit" type="radio" value="fit" class="accent-brand-600" />
                      {{ t.fitFit }}
                    </label>
                    <label class="flex items-center gap-1.5">
                      <input
                        v-model="clip.fit"
                        type="radio"
                        value="fill"
                        class="accent-brand-600"
                      />
                      {{ t.fitFill }}
                    </label>
                  </div>
                </fieldset>
                <div v-if="clipIndex < project.clips.length - 1" class="space-y-2">
                  <div>
                    <label for="ed-tr" class="label">{{ t.transition }}</label>
                    <select id="ed-tr" v-model="clip.trans" class="field" data-transition>
                      <option value="none">{{ t['transition.none'] }}</option>
                      <option value="black">{{ t['transition.black'] }}</option>
                      <option value="white">{{ t['transition.white'] }}</option>
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
                <p v-else class="text-xs text-ink-3">{{ t.transitionLast }}</p>
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
                  <div>
                    <label for="ed-tp" class="label">{{ t.position }}</label>
                    <select id="ed-tp" v-model="text.position" class="field">
                      <option value="top">{{ t['position.top'] }}</option>
                      <option value="center">{{ t['position.center'] }}</option>
                      <option value="bottom">{{ t['position.bottom'] }}</option>
                      <option value="custom">{{ t['position.custom'] }}</option>
                    </select>
                  </div>
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
                  <label class="flex items-end gap-2 pb-2">
                    <input v-model="text.box" type="checkbox" class="accent-brand-600" />
                    {{ t.box }}
                  </label>
                </div>
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
                <label class="flex items-center gap-2">
                  <input v-model="project.music.fadeOut" type="checkbox" class="accent-brand-600" />
                  {{ t.musicFade }}
                </label>
                <button
                  type="button"
                  class="btn btn-secondary w-full text-secang"
                  @click="project.music = null"
                >
                  {{ t.removeMusic }}
                </button>
              </template>
              <p v-else class="text-ink-3">{{ t.noMusic }}</p>
            </template>
          </div>
        </div>
      </div>

      <EditorTimeline
        :project="project"
        :time="time"
        :selected-clip="selectedClip"
        :selected-text="selectedText"
        :thumbs="thumbs"
        :missing="missing"
        :labels="{
          clips: t['tab.clip'],
          texts: t['tab.text'],
          music: t['tab.music'],
          zoom: t.zoom,
          dragHint: t.dragHint,
        }"
        @seek="(s) => ((playing = false), (time = s))"
        @select-clip="select"
        @select-text="(id) => ((selectedText = id), (tab = 'text'))"
        @move="(a, b) => (project = moveClip(project, a, b))"
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
