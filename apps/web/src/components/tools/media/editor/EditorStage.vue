<script setup lang="ts">
/**
 * Pratinjau editor video: memutar klip berurutan (video atau gambar) sesuai titik masuk/keluar,
 * menggambar teks dengan fungsi yang sama dengan ekspor, dan memutar musik latar selaras.
 * Waktu timeline dikendalikan lewat v-model:time dan v-model:playing.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { drawText } from '../../../../lib/editor/render';
import { textAnimAt } from '../../../../lib/editor/textfx';
import ClipLayer from './ClipLayer.vue';
import { loadEditorFonts } from './editorFonts';
import {
  type Project,
  clipAt,
  clipStarts,
  duckGain,
  musicFadeGain,
  musicSpan,
  outputSize,
  overlapAt,
  totalDuration,
  transitionAt,
  voicedSpans,
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
    /** mediaId yang diketahui punya audio (untuk ducking musik). */
    voiced?: Set<string>;
  }>(),
  { maxVh: 60, dragText: '', voiced: undefined },
);
const emit = defineEmits<{ moveText: [id: string, x: number, y: number] }>();
const time = defineModel<number>('time', { required: true });
const playing = defineModel<boolean>('playing', { required: true });

const music = ref<HTMLAudioElement>();
const canvas = ref<HTMLCanvasElement>();
const stage = ref<HTMLDivElement>();
const stageW = ref(640);

const size = computed(() => outputSize(props.project.settings.aspect, '720'));
const total = computed(() => totalDuration(props.project));
const starts = computed(() => clipStarts(props.project));
const hit = computed(() => clipAt(props.project, time.value));
const overlap = computed(() => overlapAt(props.project, time.value));

/**
 * Dua lapisan: klip genap di lapisan 0, ganjil di lapisan 1. Di luar transisi, lapisan lain
 * memuat klip berikutnya (tak terlihat) agar perpindahan mulus.
 */
const layers = computed(() =>
  [0, 1].map((slot) => {
    const ov = overlap.value;
    const h = hit.value;
    const n = props.project.clips.length;
    let index = -1;
    if (ov) index = ov.out % 2 === slot ? ov.out : ov.in;
    else if (h) index = h.index % 2 === slot ? h.index : h.index + 1 < n ? h.index + 1 : -1;
    const active = ov ? true : !!h && index === h.index;
    const incoming = ov ? index === ov.in : active;
    let fx: Record<string, string | number> = {};
    let gain = 1;
    if (ov) {
      const p = ov.progress;
      gain = incoming ? p : 1 - p;
      if (incoming) {
        if (ov.kind === 'cross') fx = { opacity: p };
        else if (ov.kind === 'wipe') fx = { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)` };
        else if (ov.kind === 'slide') fx = { transform: `translateX(${(1 - p) * 100}%)` };
        else fx = { clipPath: `circle(${p * 70.72}% at 50% 50%)` };
      } else if (ov.kind === 'slide') fx = { transform: `translateX(${-p * 100}%)` };
    }
    fx = { ...fx, zIndex: incoming ? 2 : 1, visibility: active ? 'visible' : 'hidden' };
    return { slot, index, active, fx, gain };
  }),
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

let raf = 0;
let last = 0;

const spans = computed(() => voicedSpans(props.project, props.voiced));

/** Musik: hanya terdengar di rentangnya, dengan fade dan ducking seperti hasil ekspor. */
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
  const span = musicSpan(m, total.value);
  const t = time.value;
  const g = musicFadeGain(m, span, t) * (m.duck ? duckGain(spans.value, t) : 1);
  a.volume = Math.max(0, Math.min(1, m.volume * g));
  if (t < span.start || t >= span.end) {
    a.pause();
    return;
  }
  const dur = a.duration || 0;
  const pos = m.offset + (t - span.start);
  const target = dur ? pos % dur : pos;
  if (Math.abs(a.currentTime - target) > 0.3) a.currentTime = target;
  if (!play) a.pause();
  else if (a.paused) a.play().catch(() => {});
}

/** Jam utama: waktu maju mengikuti requestAnimationFrame; lapisan video menyesuaikan diri. */
function tick(ts: number) {
  if (!playing.value) return;
  const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0;
  last = ts;
  const t = time.value + dt;
  if (t >= total.value) {
    time.value = total.value;
    playing.value = false;
    return;
  }
  time.value = t;
  syncMusic(true);
  raf = requestAnimationFrame(tick);
}

watch(playing, (p) => {
  cancelAnimationFrame(raf);
  if (p) {
    if (time.value >= total.value - 0.05) time.value = 0;
    last = 0;
    syncMusic(true);
    raf = requestAnimationFrame(tick);
  } else music.value?.pause();
});

watch(time, () => {
  if (!playing.value) syncMusic(false);
  draw();
});
watch(
  () => [props.project.clips, props.project.music, props.urls] as const,
  () => {
    if (!playing.value) syncMusic(false);
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
  for (const t of props.project.texts) {
    if (!t.text.trim() || time.value < t.start || time.value >= t.end) continue;
    const a = textAnimAt(t, time.value);
    if (a.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.translate(a.dx * w, a.dy * h);
    drawText(ctx, t, w, h);
    ctx.restore();
  }
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(() => {
    stageW.value = stage.value?.clientWidth ?? 640;
    draw();
  });
  if (stage.value) ro.observe(stage.value);
  document.fonts?.ready.then(draw);
  void loadEditorFonts().then(draw);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
});
</script>

<template>
  <div
    ref="stage"
    class="relative isolate mx-auto w-full overflow-hidden rounded-md bg-black select-none"
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
    <ClipLayer
      v-for="l in layers"
      :key="l.slot"
      :project="project"
      :index="l.index"
      :time="time"
      :starts="starts"
      :playing="playing"
      :active="l.active"
      :urls="urls"
      :stage-w="stageW"
      :fx="l.fx"
      :gain="l.gain"
      :data-layer="l.slot"
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
