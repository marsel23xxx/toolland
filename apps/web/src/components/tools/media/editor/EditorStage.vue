<script setup lang="ts">
/**
 * Pratinjau editor video: memutar klip berurutan (video atau gambar) sesuai titik masuk/keluar,
 * menggambar teks dengan fungsi yang sama dengan ekspor, dan memutar musik latar selaras.
 * Waktu timeline dikendalikan lewat v-model:time dan v-model:playing.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import {
  colorSvg,
  colorTransform,
  fadeGain,
  geometryAt,
  geometryCss,
} from '../../../../lib/editor/look';
import { drawText } from '../../../../lib/editor/render';
import { textAnimAt } from '../../../../lib/editor/textfx';
import { loadEditorFonts } from './editorFonts';
import {
  type Project,
  clipAt,
  clipLength,
  duckGain,
  mediaOf,
  musicFadeGain,
  musicSpan,
  outputSize,
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

const video = ref<HTMLVideoElement>();
const music = ref<HTMLAudioElement>();
const canvas = ref<HTMLCanvasElement>();
const stage = ref<HTMLDivElement>();
const bgCanvas = ref<HTMLCanvasElement>();
const img = ref<HTMLImageElement>();
const stageW = ref(640);
const filterId = `ed-col-${useId()}`;

const size = computed(() => outputSize(props.project.settings.aspect, '720'));
const total = computed(() => totalDuration(props.project));
const hit = computed(() => clipAt(props.project, time.value));
const media = computed(() =>
  hit.value ? mediaOf(props.project, hit.value.clip.mediaId) : undefined,
);
const imageUrl = computed(() =>
  media.value?.kind === 'image' ? props.urls.get(media.value.id) : undefined,
);

// ---------- Tampilan klip (sama rumusnya dengan ekspor, lihat lib/editor/look.ts) ----------
const clip = computed(() => hit.value?.clip);
const color = computed(() => {
  const c = clip.value;
  if (!c || colorTransform(c).identity) return null;
  return colorSvg(c);
});
const geoTransform = computed(() => {
  const h = hit.value;
  if (!h) return '';
  const len = clipLength(h.clip);
  return geometryCss(geometryAt(h.clip, len ? (time.value - h.start) / len : 0));
});
/** Kotak media: untuk putaran 90/270 lebar dan tinggi ditukar lalu diputar di tengah. */
const mediaBox = computed(() => {
  const c = clip.value;
  const rot = c?.rotate ?? 0;
  const flip = `scale(${c?.flipH ? -1 : 1}, ${c?.flipV ? -1 : 1})`;
  if (rot === 90 || rot === 270)
    return {
      width: `${(size.value.h / size.value.w) * 100}%`,
      height: `${(size.value.w / size.value.h) * 100}%`,
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) rotate(${rot}deg) ${flip}`,
    };
  return {
    width: '100%',
    height: '100%',
    left: '0',
    top: '0',
    transform: `rotate(${rot}deg) ${flip}`,
  };
});
const fitClass = computed(() => (clip.value?.fit === 'fill' ? 'object-cover' : 'object-contain'));
/** Blur latar setara boxblur ekspor (jari-jari = sisi pendek / 36), diskalakan ke ukuran tampilan. */
const blurPx = computed(
  () => (Math.min(stageW.value, (stageW.value * size.value.h) / size.value.w) / 36) * 0.9,
);

/** Latar blur: bingkai sekarang digambar kecil ke canvas, lalu diperbesar dan diburamkan CSS. */
function drawBg() {
  const c = bgCanvas.value;
  if (!c || clip.value?.fit !== 'blur') return;
  const el = media.value?.kind === 'image' ? img.value : video.value;
  const w = el instanceof HTMLVideoElement ? el.videoWidth : (el?.naturalWidth ?? 0);
  const h = el instanceof HTMLVideoElement ? el.videoHeight : (el?.naturalHeight ?? 0);
  if (!el || !w || !h) return;
  c.width = 64;
  c.height = Math.max(1, Math.round((64 * h) / w));
  c.getContext('2d')?.drawImage(el, 0, 0, c.width, c.height);
}

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
  v.playbackRate = h.clip.speed || 1;
  applyVolume();
  if (play) v.play().catch(() => (playing.value = false));
  else v.pause();
}

/** Volume klip termasuk fade in/out audio pada posisi sekarang. */
function applyVolume() {
  const h = hit.value;
  const v = video.value;
  if (!h || !v) return;
  const len = clipLength(h.clip);
  const g = fadeGain(h.clip, time.value - h.start, len);
  v.volume = Math.max(0, Math.min(1, h.clip.volume * g));
  v.muted = h.clip.volume === 0;
}

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

function tick(ts: number) {
  if (!playing.value) return;
  const dt = last ? (ts - last) / 1000 : 0;
  last = ts;
  const h = hit.value;
  let t = time.value;
  if (h && media.value?.kind === 'video' && video.value) {
    const v = video.value;
    const len = clipLength(h.clip);
    const sp = h.clip.speed || 1;
    t = h.start + Math.min(len, Math.max(0, (v.currentTime - h.clip.in) / sp));
    if (v.currentTime >= h.clip.out - 0.04 * sp || v.ended) t = h.start + len + 0.001;
  } else t += dt;
  if (t >= total.value) {
    time.value = total.value;
    playing.value = false;
    return;
  }
  time.value = t;
  if (clipAt(props.project, t)?.clip.id !== loadedClip) syncVideo(true);
  applyVolume();
  syncMusic(true);
  drawBg();
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
  drawBg();
});
// Saat pindah ke mode latar blur, canvas baru muncul dan perlu digambar.
watch(
  () => [clip.value?.fit, clip.value?.id],
  () => void nextTick(drawBg),
);
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
  syncVideo(false);
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
    <!-- Warna diterapkan ke seluruh bingkai (termasuk latar), seperti di ekspor. -->
    <div
      class="absolute inset-0"
      :style="{
        backgroundColor: project.settings.bg,
        filter: color ? `url(#${filterId})` : undefined,
      }"
    >
      <div class="absolute inset-0" :style="{ transform: geoTransform || undefined }">
        <div class="absolute" :style="mediaBox">
          <canvas
            v-if="clip?.fit === 'blur'"
            ref="bgCanvas"
            class="absolute inset-0 h-full w-full object-cover"
            :style="{ filter: `blur(${blurPx}px)` }"
          ></canvas>
          <video
            ref="video"
            class="absolute inset-0 h-full w-full"
            :class="[fitClass, media?.kind === 'video' ? '' : 'invisible']"
            playsinline
            preload="auto"
            @loadeddata="(!playing && syncVideo(false), drawBg())"
            @seeked="drawBg"
          ></video>
          <img
            v-if="imageUrl"
            ref="img"
            :src="imageUrl"
            alt=""
            draggable="false"
            class="absolute inset-0 h-full w-full"
            :class="fitClass"
            @load="drawBg"
          />
        </div>
      </div>
    </div>
    <svg class="absolute size-0" aria-hidden="true">
      <filter v-if="color" :id="filterId" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" :values="color.matrix" />
        <feComponentTransfer>
          <feFuncR type="linear" :slope="color.slope" :intercept="color.intercept" />
          <feFuncG type="linear" :slope="color.slope" :intercept="color.intercept" />
          <feFuncB type="linear" :slope="color.slope" :intercept="color.intercept" />
        </feComponentTransfer>
      </filter>
    </svg>
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
