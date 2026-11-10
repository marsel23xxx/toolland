<script setup lang="ts">
/**
 * Satu lapisan klip di pratinjau: latar, warna, zoom/geser, putar/balik, latar blur, dan elemen
 * video/gambar. Pratinjau memakai dua lapisan bergantian (klip genap/ganjil) agar transisi
 * bertumpuk bisa menampilkan dua klip sekaligus dan klip berikutnya sudah dimuat lebih dulu.
 * Waktu dikendalikan dari luar (jam utama); video hanya diselaraskan bila meleset.
 */
import { computed, nextTick, ref, useId, watch } from 'vue';
import {
  colorSvg,
  colorTransform,
  fadeGain,
  geometryAt,
  geometryCss,
} from '../../../../lib/editor/look';
import { type Project, clipLength, mediaOf, outputSize } from '../../../../lib/editor/project';

const props = defineProps<{
  project: Project;
  /** Indeks klip di lapisan ini (-1 = kosong). */
  index: number;
  /** Waktu timeline sekarang dan waktu mulai klip-klip. */
  time: number;
  starts: number[];
  playing: boolean;
  /** Terlihat dan bersuara (false = hanya dimuat lebih dulu). */
  active: boolean;
  urls: Map<string, string>;
  stageW: number;
  /** Efek transisi pada lapisan ini (opacity, clip-path, transform). */
  fx?: Record<string, string | number>;
  /** Pengali volume (crossfade audio). */
  gain?: number;
}>();

const video = ref<HTMLVideoElement>();
const img = ref<HTMLImageElement>();
const bgCanvas = ref<HTMLCanvasElement>();
const filterId = `ed-col-${useId()}`;

const clip = computed(() => (props.index >= 0 ? props.project.clips[props.index] : undefined));
const media = computed(() => (clip.value ? mediaOf(props.project, clip.value.mediaId) : undefined));
const url = computed(() => (media.value ? props.urls.get(media.value.id) : undefined));
const start = computed(() => props.starts[props.index] ?? 0);
const len = computed(() => (clip.value ? clipLength(clip.value) : 0));
/** Posisi di media sumber untuk waktu sekarang. */
const local = computed(() => {
  const c = clip.value;
  if (!c) return 0;
  const off = Math.min(len.value, Math.max(0, props.time - start.value));
  return c.in + off * (c.speed || 1);
});
const size = computed(() => outputSize(props.project.settings.aspect, '720'));

const color = computed(() => {
  const c = clip.value;
  if (!c || colorTransform(c).identity) return null;
  return colorSvg(c);
});
const geoTransform = computed(() => {
  const c = clip.value;
  if (!c) return '';
  return geometryCss(geometryAt(c, len.value ? (props.time - start.value) / len.value : 0));
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
/** Blur latar setara boxblur ekspor (jari-jari = sisi pendek / 36), diskalakan ke tampilan. */
const blurPx = computed(
  () => (Math.min(props.stageW, (props.stageW * size.value.h) / size.value.w) / 36) * 0.9,
);

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

/** Selaraskan elemen video dengan jam utama. */
function sync() {
  const v = video.value;
  const c = clip.value;
  if (!v) return;
  if (!c || media.value?.kind !== 'video' || !url.value) {
    if (!v.paused) v.pause();
    return;
  }
  if (v.dataset.src !== url.value) {
    v.dataset.src = url.value;
    v.src = url.value;
  }
  v.playbackRate = c.speed || 1;
  const g = fadeGain(c, props.time - start.value, len.value) * (props.gain ?? 1);
  v.volume = Math.max(0, Math.min(1, c.volume * g));
  v.muted = !props.active || c.volume === 0;
  const drift = Math.abs(v.currentTime - local.value);
  if (props.active && props.playing) {
    if (drift > 0.25) v.currentTime = local.value;
    if (v.paused) v.play().catch(() => {});
  } else {
    if (!v.paused) v.pause();
    if (drift > 0.03) v.currentTime = local.value;
  }
}

watch(
  () => [local.value, props.playing, props.active, url.value, props.gain, clip.value?.speed],
  sync,
);
watch(local, drawBg);
watch(
  () => [clip.value?.fit, clip.value?.id],
  () => void nextTick(drawBg),
);

defineExpose({ sync });
</script>

<template>
  <div class="absolute inset-0" :style="fx">
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
            @loadeddata="(sync(), drawBg())"
            @seeked="drawBg"
          ></video>
          <img
            v-if="media?.kind === 'image' && url"
            ref="img"
            :src="url"
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
  </div>
</template>
