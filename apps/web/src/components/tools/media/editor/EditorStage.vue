<script setup lang="ts">
/**
 * Pratinjau editor video: memutar klip berurutan (video atau gambar) sesuai titik masuk/keluar,
 * menggambar teks dengan fungsi yang sama dengan ekspor, dan memutar musik latar selaras.
 * Waktu timeline dikendalikan lewat v-model:time dan v-model:playing.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawText } from '../../../../lib/editor/render';
import {
  type Project,
  clipAt,
  clipLength,
  mediaOf,
  outputSize,
  totalDuration,
  transitionAt,
} from '../../../../lib/editor/project';

const props = withDefaults(
  defineProps<{
    project: Project;
    urls: Map<string, string>;
    empty: string;
    /** Tinggi maksimal pratinjau (persen tinggi layar). */
    maxVh?: number;
    /** ID teks yang bisa digeser langsung di pratinjau (kosong = tidak ada). */
    dragText?: string;
  }>(),
  { maxVh: 60, dragText: '' },
);
const emit = defineEmits<{ moveText: [id: string, x: number, y: number] }>();
const time = defineModel<number>('time', { required: true });
const playing = defineModel<boolean>('playing', { required: true });

const video = ref<HTMLVideoElement>();
const music = ref<HTMLAudioElement>();
const canvas = ref<HTMLCanvasElement>();
const stage = ref<HTMLDivElement>();

const size = computed(() => outputSize(props.project.settings.aspect, '720'));
const total = computed(() => totalDuration(props.project));
const hit = computed(() => clipAt(props.project, time.value));
const media = computed(() =>
  hit.value ? mediaOf(props.project, hit.value.clip.mediaId) : undefined,
);
const imageUrl = computed(() =>
  media.value?.kind === 'image' ? props.urls.get(media.value.id) : undefined,
);

/** Lapisan pudar: transisi antarklip dan fade awal/akhir video (sama dengan hasil ekspor). */
const veil = computed(() => {
  const tr = transitionAt(props.project, time.value);
  let alpha = tr.alpha;
  if (props.project.settings.fade && total.value > 1.5) {
    const d = Math.min(0.6, total.value / 4);
    const t = time.value;
    alpha = Math.max(
      alpha,
      t < d ? 1 - t / d : 0,
      t > total.value - d ? 1 - (total.value - t) / d : 0,
    );
    if (alpha > tr.alpha) return { alpha, color: 'black' };
  }
  return { alpha, color: tr.color };
});

// Geser teks terpilih dengan mouse/jari: posisi jadi relatif 0-1 terhadap ukuran pratinjau.
let dragging = false;
function dragTo(e: PointerEvent) {
  const s = stage.value;
  if (!s || !props.dragText) return;
  const r = s.getBoundingClientRect();
  const clamp = (v: number) => Math.round(Math.max(0.05, Math.min(0.95, v)) * 1000) / 1000;
  emit(
    'moveText',
    props.dragText,
    clamp((e.clientX - r.left) / r.width),
    clamp((e.clientY - r.top) / r.height),
  );
}
function onDown(e: PointerEvent) {
  if (!props.dragText) return;
  dragging = true;
  stage.value?.setPointerCapture(e.pointerId);
  e.preventDefault();
  dragTo(e);
}
function onMove(e: PointerEvent) {
  if (dragging) dragTo(e);
}
function onUp() {
  dragging = false;
}

let loadedClip = '';
let raf = 0;
let last = 0;

/** Samakan elemen video dengan klip di waktu sekarang. */
function syncVideo(play: boolean) {
  const h = hit.value;
  const v = video.value;
  if (!v) return;
  if (!h || media.value?.kind !== 'video') {
    v.pause();
    loadedClip = h?.clip.id ?? '';
    return;
  }
  const url = props.urls.get(h.clip.mediaId);
  if (!url) return;
  if (v.dataset.src !== url) {
    v.dataset.src = url;
    v.src = url;
  }
  if (loadedClip !== h.clip.id || Math.abs(v.currentTime - h.local) > 0.3) v.currentTime = h.local;
  loadedClip = h.clip.id;
  v.volume = Math.min(1, h.clip.volume);
  v.muted = h.clip.volume === 0;
  if (play) v.play().catch(() => (playing.value = false));
  else v.pause();
}

function syncMusic(play: boolean) {
  const a = music.value;
  const m = props.project.music;
  const url = m ? props.urls.get(m.mediaId) : undefined;
  if (!a) return;
  if (!m || !url) {
    a.pause();
    return;
  }
  if (a.dataset.src !== url) {
    a.dataset.src = url;
    a.src = url;
  }
  a.volume = Math.min(1, m.volume);
  const dur = a.duration || 0;
  const target = dur ? (m.offset + time.value) % dur : m.offset + time.value;
  if (Math.abs(a.currentTime - target) > 0.3) a.currentTime = target;
  if (play) a.play().catch(() => {});
  else a.pause();
}

function tick(ts: number) {
  if (!playing.value) return;
  const dt = last ? (ts - last) / 1000 : 0;
  last = ts;
  const h = hit.value;
  let t = time.value;
  if (h && media.value?.kind === 'video' && video.value) {
    const v = video.value;
    const len = clipLength(h.clip);
    t = h.start + Math.min(len, Math.max(0, v.currentTime - h.clip.in));
    if (v.currentTime >= h.clip.out - 0.04 || v.ended) t = h.start + len + 0.001;
  } else t += dt;
  if (t >= total.value) {
    time.value = total.value;
    playing.value = false;
    return;
  }
  time.value = t;
  if (clipAt(props.project, t)?.clip.id !== loadedClip) syncVideo(true);
  raf = requestAnimationFrame(tick);
}

watch(playing, (p) => {
  cancelAnimationFrame(raf);
  if (p) {
    if (time.value >= total.value - 0.05) time.value = 0;
    last = 0;
    syncVideo(true);
    syncMusic(true);
    raf = requestAnimationFrame(tick);
  } else {
    video.value?.pause();
    music.value?.pause();
  }
});

// Saat berhenti, menggeser playhead langsung menampilkan bingkai di posisi itu.
watch(time, () => {
  if (!playing.value) {
    syncVideo(false);
    syncMusic(false);
  }
  draw();
});
watch(
  () => [props.project.clips, props.project.music, props.urls] as const,
  () => {
    loadedClip = '';
    if (!playing.value) syncVideo(false);
    draw();
  },
  { deep: true },
);
watch(() => props.project.texts, draw, { deep: true });

/** Teks digambar di canvas seukuran tampilan (dikali devicePixelRatio agar tajam). */
function draw() {
  const c = canvas.value;
  const s = stage.value;
  if (!c || !s) return;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(s.clientWidth * dpr);
  const h = Math.round(s.clientHeight * dpr);
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (const t of props.project.texts)
    if (t.text.trim() && time.value >= t.start && time.value < t.end) drawText(ctx, t, w, h);
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(draw);
  if (stage.value) ro.observe(stage.value);
  syncVideo(false);
  document.fonts?.ready.then(draw);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
});
</script>

<template>
  <div
    ref="stage"
    class="relative mx-auto w-full overflow-hidden rounded-md bg-black select-none"
    :class="{ 'cursor-move touch-none': dragText }"
    :style="{
      aspectRatio: `${size.w} / ${size.h}`,
      maxHeight: `${maxVh}vh`,
      maxWidth: `calc(${maxVh}vh * ${size.w / size.h})`,
    }"
    data-stage
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <video
      v-show="media?.kind === 'video'"
      ref="video"
      class="absolute inset-0 h-full w-full"
      :class="hit?.clip.fit === 'fill' ? 'object-cover' : 'object-contain'"
      playsinline
      preload="auto"
      @loadeddata="!playing && syncVideo(false)"
    ></video>
    <img
      v-if="imageUrl"
      :src="imageUrl"
      alt=""
      draggable="false"
      class="absolute inset-0 h-full w-full"
      :class="hit?.clip.fit === 'fill' ? 'object-cover' : 'object-contain'"
    />
    <div
      v-if="veil.alpha > 0"
      class="pointer-events-none absolute inset-0"
      :style="{ backgroundColor: veil.color, opacity: veil.alpha }"
    ></div>
    <canvas ref="canvas" class="pointer-events-none absolute inset-0 h-full w-full"></canvas>
    <p
      v-if="!project.clips.length"
      class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70"
    >
      {{ empty }}
    </p>
    <audio ref="music" preload="auto"></audio>
  </div>
</template>
