<script setup lang="ts">
/**
 * Satu overlay di pratinjau (video/foto/stiker/bentuk). Ukuran dan posisi relatif terhadap
 * bingkai, sama dengan rumus ekspor. Bila terpilih dan bisa diedit: geser untuk memindah,
 * tarik sudut kanan bawah untuk mengubah ukuran.
 */
import { computed, ref, watch } from 'vue';
import {
  type Overlay,
  type Project,
  mediaOf,
  overlayAlpha,
  overlayLength,
} from '../../../../lib/editor/project';
import { drawSticker } from '../../../../lib/editor/render';

const props = defineProps<{
  project: Project;
  overlay: Overlay;
  time: number;
  playing: boolean;
  urls: Map<string, string>;
  selected: boolean;
  editable: boolean;
}>();
const emit = defineEmits<{
  select: [];
  update: [patch: Partial<Overlay>];
}>();

const box = ref<HTMLDivElement>();
const video = ref<HTMLVideoElement>();
const o = computed(() => props.overlay);
const media = computed(() =>
  o.value.kind === 'media' ? mediaOf(props.project, o.value.mediaId) : undefined,
);
const url = computed(() => (media.value ? props.urls.get(media.value.id) : undefined));
const alpha = computed(() => overlayAlpha(o.value, props.time));
const inRange = computed(
  () => props.time >= o.value.start && props.time < o.value.start + overlayLength(o.value),
);
const local = computed(() =>
  Math.min(o.value.out, Math.max(o.value.in, o.value.in + props.time - o.value.start)),
);

/** Stiker dan bentuk digambar dengan fungsi yang sama dengan ekspor. */
const stickerUrl = computed(() => {
  const ov = o.value;
  if (ov.kind === 'media') return '';
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.max(2, Math.round(256 * ov.ratio));
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  drawSticker(ctx, ov, c.width, c.height);
  return c.toDataURL('image/png');
});

function sync() {
  const v = video.value;
  if (!v || media.value?.kind !== 'video' || !url.value) return;
  if (v.dataset.src !== url.value) {
    v.dataset.src = url.value;
    v.src = url.value;
  }
  v.volume = Math.max(0, Math.min(1, o.value.volume));
  v.muted = o.value.volume === 0 || !inRange.value;
  const drift = Math.abs(v.currentTime - local.value);
  if (props.playing && inRange.value) {
    if (drift > 0.25) v.currentTime = local.value;
    if (v.paused) v.play().catch(() => {});
  } else {
    if (!v.paused) v.pause();
    if (drift > 0.03) v.currentTime = local.value;
  }
}
watch(() => [local.value, props.playing, inRange.value, url.value, o.value.volume], sync);

// ---------- Geser dan ubah ukuran ----------
let mode: 'move' | 'resize' | null = null;
let startX = 0;
let startY = 0;
let orig = { x: 0, y: 0, w: 0 };

function stageRect() {
  return box.value?.parentElement?.getBoundingClientRect();
}
function down(e: PointerEvent, m: 'move' | 'resize') {
  if (!props.editable) return;
  e.stopPropagation();
  e.preventDefault();
  emit('select');
  mode = m;
  startX = e.clientX;
  startY = e.clientY;
  orig = { x: o.value.x, y: o.value.y, w: o.value.w };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  const r = stageRect();
  if (!mode || !r) return;
  const dx = (e.clientX - startX) / r.width;
  const dy = (e.clientY - startY) / r.height;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  if (mode === 'move')
    emit('update', {
      x: r3(Math.max(-0.2, Math.min(1.2, orig.x + dx))),
      y: r3(Math.max(-0.2, Math.min(1.2, orig.y + dy))),
    });
  else emit('update', { w: r3(Math.max(0.03, Math.min(1.5, orig.w + dx * 2))) });
}
function up() {
  mode = null;
}
</script>

<template>
  <div
    v-show="inRange || selected"
    ref="box"
    class="absolute"
    :class="[
      editable ? 'cursor-move touch-none' : 'pointer-events-none',
      selected && editable ? 'outline-2 outline-offset-2 outline-kunyit outline-dashed' : '',
    ]"
    :style="{
      left: `${o.x * 100}%`,
      top: `${o.y * 100}%`,
      width: `${o.w * 100}%`,
      aspectRatio: `1 / ${o.ratio}`,
      transform: `translate(-50%, -50%) rotate(${o.rotate}deg)`,
      opacity: inRange ? alpha : 0.35,
    }"
    :data-overlay="o.id"
    @pointerdown="down($event, 'move')"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="up"
  >
    <video
      v-if="media?.kind === 'video'"
      ref="video"
      class="h-full w-full object-fill"
      playsinline
      preload="auto"
      @loadeddata="sync"
    ></video>
    <img
      v-else-if="media?.kind === 'image' && url"
      :src="url"
      alt=""
      draggable="false"
      class="h-full w-full object-fill"
    />
    <img v-else-if="stickerUrl" :src="stickerUrl" alt="" draggable="false" class="h-full w-full" />
    <span
      v-if="selected && editable"
      class="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-full border-2 border-white bg-kunyit"
      data-overlay-resize
      @pointerdown="down($event, 'resize')"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    ></span>
  </div>
</template>
