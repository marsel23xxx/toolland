<script setup lang="ts">
/**
 * Pembuat tanda tangan: digores dengan signature_pad (bisa dirapikan otomatis) atau diambil dari
 * foto ttd di kertas. Hasil diunduh sebagai PNG transparan atau PDF seukuran ttd. Semua di browser.
 */
import type SignaturePad from 'signature_pad';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fileName } from '../../lib/names';
import { pdfWorker } from '../../lib/pdf/client';
import { canvasToBlob } from '../../lib/pdf/render';
import {
  drawStrokes,
  inkAngle,
  inkMask,
  straightenAngle,
  strokeBounds,
  tidyStrokes,
} from '../../lib/signature';
import ProgressBar from '../ui/ProgressBar.vue';

const props = defineProps<{ t: Messages<'sign'> }>();

type Sig = { png: ArrayBuffer; url: string; ratio: number };
const COLORS = { blue: '#0b2a8a', black: '#111827' } as const;
/** Ketebalan garis dalam px layar kanvas gores. */
const WEIGHTS = { thin: 1.6, medium: 2.6, bold: 3.8 } as const;
/** Hasil gores dirender lebih tajam dari layar supaya tetap halus saat diperbesar di PDF. */
const SCALE = 3;

const source = ref<'draw' | 'photo'>('draw');
const color = ref<keyof typeof COLORS>('blue');
const weight = ref<keyof typeof WEIGHTS>('medium');
const tidy = ref(true);
const straighten = ref(true);
const strokeCount = ref(0);
const photoBusy = ref(false);
const photoError = ref('');
const pdfBusy = ref(false);

const padCanvas = ref<HTMLCanvasElement>();
let pad: SignaturePad | null = null;
let photo: ImageBitmap | null = null;
const drawn = shallowRef<Sig | null>(null);
const fromPhoto = shallowRef<Sig | null>(null);
const signature = computed(() => (source.value === 'draw' ? drawn.value : fromPhoto.value));

function penOptions() {
  const w = WEIGHTS[weight.value];
  return { penColor: COLORS[color.value], minWidth: w * 0.45, maxWidth: w * 1.15 };
}

let resizer: ResizeObserver | null = null;
const dpr = () => Math.max(1, window.devicePixelRatio || 1);

function sizeCanvas(c: HTMLCanvasElement) {
  c.width = Math.round(c.offsetWidth * dpr());
  c.height = Math.round(c.offsetHeight * dpr());
  c.getContext('2d')!.scale(dpr(), dpr());
}

async function initPad() {
  await nextTick();
  // Kanvas yang tersembunyi (tab Foto) belum punya ukuran; dibuat saat tab Gores dibuka.
  if (!padCanvas.value || pad || !padCanvas.value.offsetWidth) return;
  const { default: Pad } = await import('signature_pad');
  const c = padCanvas.value;
  sizeCanvas(c);
  pad = new Pad(c, penOptions());
  // HP diputar atau jendela diubah: ukuran piksel kanvas disesuaikan dan goresan digambar ulang,
  // supaya coretan berikutnya tidak bergeser dari posisi jari/mouse.
  resizer = new ResizeObserver(() => {
    if (!pad || !c.offsetWidth || c.width === Math.round(c.offsetWidth * dpr())) return;
    const data = pad.toData();
    sizeCanvas(c);
    pad.fromData(data);
  });
  resizer.observe(c);
  pad.addEventListener('endStroke', () => {
    strokeCount.value = pad!.toData().length;
    refreshDrawn();
  });
}

/** Ganti warna/ketebalan semua goresan yang sudah ada, bukan hanya goresan berikutnya. */
function applyPen() {
  if (!pad) return;
  const opts = penOptions();
  Object.assign(pad, opts);
  pad.fromData(pad.toData().map((g) => ({ ...g, ...opts })));
}

function undo() {
  if (!pad) return;
  const data = pad.toData();
  data.pop();
  pad.fromData(data);
  strokeCount.value = data.length;
  refreshDrawn();
}

function clearPad() {
  pad?.clear();
  strokeCount.value = 0;
  refreshDrawn();
}

/** Ttd versi rapi: goresan dihaluskan, diluruskan, lalu digambar ulang dengan ketebalan rata. */
async function renderTidy(): Promise<Sig | null> {
  const strokes = tidyStrokes(pad!.toData().map((g) => g.points.map(({ x, y }) => ({ x, y }))));
  const b = strokeBounds(strokes);
  if (!Number.isFinite(b.minX)) return null;
  const w = WEIGHTS[weight.value];
  const margin = w * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil((b.maxX - b.minX + margin * 2) * SCALE);
  c.height = Math.ceil((b.maxY - b.minY + margin * 2) * SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.translate(margin - b.minX, margin - b.minY);
  drawStrokes(ctx, strokes, COLORS[color.value], w);
  return toSig(c);
}

let drawJob = 0;
async function refreshDrawn() {
  const job = ++drawJob;
  const next =
    !pad || pad.isEmpty()
      ? null
      : tidy.value
        ? await renderTidy()
        : padCanvas.value
          ? await trimmed(padCanvas.value)
          : null;
  // Abaikan hasil lama jika pengguna sudah menggores lagi.
  if (job !== drawJob) return next && URL.revokeObjectURL(next.url);
  setSig(drawn, next);
}

async function toSig(c: HTMLCanvasElement): Promise<Sig> {
  const blob = await canvasToBlob(c, 'image/png');
  return {
    png: await blob.arrayBuffer(),
    url: URL.createObjectURL(blob),
    ratio: c.width / c.height,
  };
}

/** Potong area kosong di sekeliling coretan, hasil PNG transparan. */
async function trimmed(source: HTMLCanvasElement): Promise<Sig | null> {
  const ctx = source.getContext('2d')!;
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const margin = 4;
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  const w = Math.min(width, maxX + margin) - minX;
  const h = Math.min(height, maxY + margin) - minY;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(source, minX, minY, w, h, 0, 0, w, h);
  return toSig(out);
}

async function pickPhoto(list: File[]) {
  const f = list[0];
  if (!f) return;
  photoError.value = '';
  try {
    photo?.close();
    photo = await createImageBitmap(f, { imageOrientation: 'from-image' });
  } catch {
    photo = null;
    setSig(fromPhoto, null);
    photoError.value = props.t.photoError;
    return;
  }
  await refreshPhoto();
}

/** Foto ttd di kertas: kertas dan bayangan dihapus, tinta diberi warna pilihan, lalu diluruskan. */
async function refreshPhoto() {
  if (!photo) return;
  photoBusy.value = true;
  try {
    const k = Math.min(1, 1600 / Math.max(photo.width, photo.height));
    const w = Math.round(photo.width * k);
    const h = Math.round(photo.height * k);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(photo, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const mask = inkMask(img.data, w, h);
    const hex = COLORS[color.value];
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let i = 0; i < mask.length; i++) img.data.set([rgb[0], rgb[1], rgb[2], mask[i]], i * 4);
    ctx.putImageData(img, 0, 0);

    const angle = straighten.value ? straightenAngle(inkAngle(mask, w, h)) : 0;
    let out = c;
    if (angle) {
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      out = document.createElement('canvas');
      out.width = Math.ceil(w * cos + h * sin);
      out.height = Math.ceil(w * sin + h * cos);
      const o = out.getContext('2d')!;
      o.translate(out.width / 2, out.height / 2);
      o.rotate(angle);
      o.drawImage(c, -w / 2, -h / 2);
    }
    const sig = await trimmed(out);
    setSig(fromPhoto, sig);
    if (!sig) photoError.value = props.t.photoError;
  } finally {
    photoBusy.value = false;
  }
}

function setSig(target: typeof drawn, s: Sig | null) {
  if (target.value) URL.revokeObjectURL(target.value.url);
  target.value = s;
}

function downloadPng() {
  if (!signature.value) return;
  downloadBlob(
    new Blob([signature.value.png], { type: 'image/png' }),
    `${fileName('signature')}.png`,
  );
}

/** Lebar ttd di PDF dalam point (± 6,4 cm), tinggi mengikuti bentuk ttd. */
const PDF_WIDTH = 180;

async function downloadPdf() {
  if (!signature.value) return;
  pdfBusy.value = true;
  try {
    const bytes = await (await pdfWorker()).signaturePdf(signature.value.png.slice(0), PDF_WIDTH);
    downloadBlob(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      `${fileName('signature')}.pdf`,
    );
  } finally {
    pdfBusy.value = false;
  }
}

watch([color, weight], () => {
  applyPen();
  refreshDrawn();
  refreshPhoto();
});
watch(tidy, refreshDrawn);
watch(source, (v) => v === 'draw' && initPad());
onMounted(initPad);

onBeforeUnmount(() => {
  setSig(drawn, null);
  setSig(fromPhoto, null);
  photo?.close();
  pad?.off();
  resizer?.disconnect();
});
watch(straighten, refreshPhoto);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <button
        v-for="opt in ['draw', 'photo'] as const"
        :key="opt"
        type="button"
        class="btn btn-secondary"
        :class="{ 'btn-active': source === opt }"
        :aria-pressed="source === opt"
        @click="source = opt"
      >
        {{ opt === 'draw' ? t.sourceDraw : t.sourcePhoto }}
      </button>
    </div>

    <div class="space-y-3" :class="{ hidden: source !== 'draw' }">
      <canvas
        ref="padCanvas"
        class="h-44 w-full max-w-xl touch-none rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-600"
        :aria-label="t.padLabel"
      />
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-secondary" :disabled="!strokeCount" @click="undo">
          {{ t.undo }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="!strokeCount" @click="clearPad">
          {{ t.clear }}
        </button>
      </div>
      <label class="flex items-start gap-2 text-sm">
        <input v-model="tidy" type="checkbox" class="mt-1" />
        <span>
          <span class="font-medium">{{ t.tidy }}</span>
          <span class="block text-slate-600 dark:text-slate-400">{{ t.tidyHint }}</span>
        </span>
      </label>
    </div>

    <div class="space-y-3" :class="{ hidden: source !== 'photo' }">
      <label class="btn btn-secondary cursor-pointer">
        {{ t.photoPick }}
        <input
          type="file"
          accept="image/*"
          class="sr-only"
          @change="pickPhoto([...(($event.target as HTMLInputElement).files ?? [])])"
        />
      </label>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ t.photoHint }}</p>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="straighten" type="checkbox" />
        <span class="font-medium">{{ t.straighten }}</span>
      </label>
      <ProgressBar v-if="photoBusy" :label="t.photoBusy" />
      <p v-if="photoError" class="error-text" aria-live="polite">{{ photoError }}</p>
    </div>

    <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <div class="flex items-center gap-2" role="group" :aria-label="t.color">
        <span>{{ t.color }}</span>
        <button
          v-for="(hex, key) in COLORS"
          :key="key"
          type="button"
          class="btn btn-secondary px-3 py-1.5"
          :class="{ 'btn-active': color === key }"
          :aria-pressed="color === key"
          @click="color = key"
        >
          <span
            class="inline-block size-3 rounded-full"
            :class="key === 'blue' ? 'bg-[#0b2a8a]' : 'bg-[#111827] dark:ring-1 dark:ring-white/40'"
            aria-hidden="true"
          />
          {{ t[key] }}
        </button>
      </div>
      <div
        class="flex items-center gap-2"
        :class="{ hidden: source !== 'draw' }"
        role="group"
        :aria-label="t.weight"
      >
        <span>{{ t.weight }}</span>
        <button
          v-for="key in ['thin', 'medium', 'bold'] as const"
          :key="key"
          type="button"
          class="btn btn-secondary px-3 py-1.5"
          :class="{ 'btn-active': weight === key }"
          :aria-pressed="weight === key"
          @click="weight = key"
        >
          {{ t[key] }}
        </button>
      </div>
    </div>

    <p v-if="!signature" class="text-sm text-slate-600 dark:text-slate-400">
      {{ source === 'draw' ? t.emptyDraw : t.emptyPhoto }}
    </p>
    <div v-else class="flex flex-wrap items-center gap-3">
      <span class="text-sm font-medium">{{ t.result }}</span>
      <img
        :src="signature.url"
        :alt="t.result"
        data-signature
        class="h-16 max-w-full rounded border border-slate-200 bg-white object-contain px-3 py-1 dark:border-slate-700"
      />
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" @click="downloadPng">
          {{ t.downloadPng }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="pdfBusy" @click="downloadPdf">
          {{ t.downloadPdf }}
        </button>
      </div>
    </div>
  </div>
</template>
