<script setup lang="ts">
/**
 * Blur wajah: deteksi otomatis dengan MediaPipe Face Detector (di browser), area manual dengan
 * menarik kotak, lalu blur atau mosaik diterapkan di canvas. Gambar tidak keluar dari perangkat.
 */
import type { FaceDetector } from '@mediapipe/tasks-vision';
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import { fill } from '../../../lib/format';
import { IMAGE_ACCEPT, sniffFormat } from '../../../lib/image/format';
import type { Rect } from '../../../lib/image/geometry';
import { ImagePool } from '../../../lib/image/pool';
import { expand, mergeDetections, tiles } from '../../../lib/image/regions';
import { canvasToBlob } from '../../../lib/pdf/render';
import { useFileResults, withSuffix } from '../../../lib/results';
import { VENDOR } from '../../../lib/vendor';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

defineProps<{
  t: Messages<'blur'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

interface Region extends Rect {
  id: number;
  enabled: boolean;
  auto: boolean;
}

const source = shallowRef<{ name: string; bitmap: ImageBitmap; url: string; type: string } | null>(
  null,
);
const regions = ref<Region[]>([]);
const detecting = ref(false);
const detected = ref<number | null>(null);
const mode = ref<'blur' | 'pixelate'>('blur');
const strength = ref(6);
const results = useFileResults();
const draft = ref<Rect | null>(null);
const pool = new ImagePool();
let detector: Promise<FaceDetector> | undefined;
let nextId = 0;

function getDetector() {
  detector ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(`${VENDOR.mediapipe}wasm`);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${VENDOR.mediapipe}blaze_face_short_range.tflite`,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    });
  })();
  return detector;
}

async function load(list: File[]) {
  const file = list[0];
  if (!file) return;
  reset();
  let blob: Blob = file;
  let type = file.type || 'image/jpeg';
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (sniffFormat(head) === 'heic') {
    const r = await pool.run((api) => api.process(file, { format: 'jpeg', quality: 95 }));
    blob = new Blob([r.buffer], { type: 'image/jpeg' });
    type = 'image/jpeg';
  }
  const bitmap = await createImageBitmap(blob);
  source.value = { name: file.name, bitmap, url: URL.createObjectURL(blob), type };
  await detect();
}

/** Deteksi pada gambar penuh dan potongan 2×2/3×3 agar wajah kecil di foto grup ikut terdeteksi. */
async function detect() {
  const src = source.value;
  if (!src) return;
  detecting.value = true;
  try {
    const det = await getDetector();
    const { width, height } = src.bitmap;
    const grids = [
      1,
      ...(Math.max(width, height) > 900 ? [2] : []),
      ...(Math.max(width, height) > 2400 ? [3] : []),
    ];
    const found: (Rect & { score: number })[] = [];
    const canvas = document.createElement('canvas');
    for (const n of grids) {
      for (const tile of tiles(width, height, n)) {
        canvas.width = tile.width;
        canvas.height = tile.height;
        canvas
          .getContext('2d')!
          .drawImage(
            src.bitmap,
            tile.x,
            tile.y,
            tile.width,
            tile.height,
            0,
            0,
            tile.width,
            tile.height,
          );
        for (const d of det.detect(canvas).detections) {
          const b = d.boundingBox;
          if (!b) continue;
          found.push({
            x: b.originX + tile.x,
            y: b.originY + tile.y,
            width: b.width,
            height: b.height,
            score: d.categories[0]?.score ?? 0.5,
          });
        }
      }
    }
    const faces = mergeDetections(found).map((f) => expand(f, 1.35, width, height));
    regions.value = faces.map((f) => ({ ...f, id: nextId++, enabled: true, auto: true }));
    detected.value = faces.length;
  } finally {
    detecting.value = false;
  }
}

// ---------- area manual: tarik di atas gambar ----------
function startDraw(e: PointerEvent) {
  const src = source.value;
  if (!src || (e.target as HTMLElement).closest('[data-region]')) return;
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const k = src.bitmap.width / rect.width;
  const x0 = (e.clientX - rect.left) * k;
  const y0 = (e.clientY - rect.top) * k;
  draft.value = { x: x0, y: y0, width: 0, height: 0 };
  el.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => {
    const x1 = Math.min(Math.max(0, (ev.clientX - rect.left) * k), src.bitmap.width);
    const y1 = Math.min(Math.max(0, (ev.clientY - rect.top) * k), src.bitmap.height);
    draft.value = {
      x: Math.min(x0, x1),
      y: Math.min(y0, y1),
      width: Math.abs(x1 - x0),
      height: Math.abs(y1 - y0),
    };
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    const d = draft.value;
    if (d && d.width > 8 * k && d.height > 8 * k)
      regions.value.push({ ...d, id: nextId++, enabled: true, auto: false });
    draft.value = null;
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;
const boxStyle = (r: Rect) => {
  const b = source.value!.bitmap;
  return {
    left: pct(r.x, b.width),
    top: pct(r.y, b.height),
    width: pct(r.width, b.width),
    height: pct(r.height, b.height),
  };
};

// ---------- terapkan efek ----------
function applyRegion(ctx: CanvasRenderingContext2D, r: Region) {
  const x = Math.round(r.x);
  const y = Math.round(r.y);
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  // potongan kecil lalu diperbesar: halus (blur) atau kotak-kotak (mosaik)
  const size = Math.max(w, h);
  const cells =
    mode.value === 'pixelate'
      ? Math.max(3, Math.round(26 - strength.value * 2.2))
      : Math.max(2, Math.round(16 - strength.value * 1.4));
  const sw = Math.max(1, Math.round((w / size) * cells));
  const sh = Math.max(1, Math.round((h / size) * cells));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh);
  ctx.save();
  ctx.beginPath();
  if (r.auto) ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.imageSmoothingEnabled = mode.value === 'blur';
  ctx.imageSmoothingQuality = 'high';
  if (mode.value === 'blur') {
    // dua tahap pembesaran agar transisi lebih halus
    const mid = document.createElement('canvas');
    mid.width = Math.max(1, Math.round(w / 4));
    mid.height = Math.max(1, Math.round(h / 4));
    const mctx = mid.getContext('2d')!;
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(small, 0, 0, mid.width, mid.height);
    ctx.drawImage(mid, x, y, w, h);
  } else {
    ctx.drawImage(small, x, y, w, h);
  }
  ctx.restore();
}

const active = computed(() => regions.value.filter((r) => r.enabled));

async function run() {
  const src = source.value;
  if (!src) return;
  const c = document.createElement('canvas');
  c.width = src.bitmap.width;
  c.height = src.bitmap.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src.bitmap, 0, 0);
  for (const r of active.value) applyRegion(ctx, r);
  const type =
    src.type === 'image/png'
      ? 'image/png'
      : src.type === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
  const ext = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg';
  results.clear();
  results.add(withSuffix(src.name, '-blur', ext), await canvasToBlob(c, type, 0.92));
}

function reset() {
  if (source.value) {
    source.value.bitmap.close();
    URL.revokeObjectURL(source.value.url);
  }
  source.value = null;
  regions.value = [];
  detected.value = null;
  results.clear();
}

onBeforeUnmount(() => {
  reset();
  pool.destroy();
});
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      v-if="!source"
      :messages="dropzone"
      :accept="IMAGE_ACCEPT"
      :multiple="false"
      @files="load"
      @prefetch="getDetector()"
    />

    <template v-else>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
        <fieldset>
          <legend class="label">{{ t.mode }}</legend>
          <div class="flex gap-2">
            <button
              v-for="o in ['blur', 'pixelate'] as const"
              :key="o"
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn-active': mode === o }"
              :aria-pressed="mode === o"
              @click="mode = o"
            >
              {{ t[o] }}
            </button>
          </div>
        </fieldset>
        <div class="min-w-48">
          <label for="fb-str" class="label">{{ t.strength }}: {{ strength }}</label>
          <input
            id="fb-str"
            v-model.number="strength"
            type="range"
            min="1"
            max="10"
            class="w-full accent-brand-600"
          />
        </div>
        <button type="button" class="btn btn-secondary" @click="reset">{{ t.change }}</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="detecting || !active.length"
          @click="run"
        >
          {{ t.run }}
        </button>
      </div>

      <ProgressBar v-if="detecting" :label="t.detecting" />
      <p
        v-else-if="detected !== null"
        class="text-sm text-slate-600 dark:text-slate-400"
        aria-live="polite"
      >
        {{ detected ? fill(t.found, { n: detected }) : t.none }}
      </p>

      <div
        class="relative mx-auto max-w-3xl touch-none select-none"
        :aria-label="t.canvas"
        role="group"
        @pointerdown="startDraw"
      >
        <img :src="source.url" alt="" class="block w-full rounded-lg" draggable="false" />
        <div
          v-for="(r, i) in regions"
          :key="r.id"
          data-region
          class="absolute border-2"
          :class="[
            r.enabled
              ? 'border-solid border-red-500 bg-red-500/20'
              : 'border-dashed border-white/80 bg-transparent',
            r.auto ? 'rounded-[50%]' : 'rounded',
          ]"
          :style="boxStyle(r)"
        >
          <button
            type="button"
            class="absolute inset-0 size-full cursor-pointer"
            :aria-label="fill(t.area, { n: i + 1 })"
            :aria-pressed="r.enabled"
            @click="r.enabled = !r.enabled"
          />
          <button
            v-if="!r.auto"
            type="button"
            class="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-red-600 text-white"
            :aria-label="fill(t.removeArea, { n: i + 1 })"
            @click.stop="regions = regions.filter((x) => x.id !== r.id)"
          >
            <IconX class="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <div
          v-if="draft"
          class="absolute rounded border-2 border-dashed border-brand-400"
          :style="boxStyle(draft)"
        />
      </div>
      <p class="text-center text-xs text-slate-600 dark:text-slate-400">{{ t.manualHint }}</p>
    </template>

    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      thumbnails
      @remove="results.remove"
    />
  </div>
</template>
