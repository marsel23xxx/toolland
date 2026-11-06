<script setup lang="ts">
/**
 * Tanda tangan PDF: halaman dirender dengan pdf.js. Tanda tangan digores dengan signature_pad
 * (bisa dirapikan otomatis) atau diambil dari foto ttd di kertas, lalu dipasang dengan pdf-lib di worker.
 */
import { fileName } from '../../../lib/names';
import type SignaturePad from 'signature_pad';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import { downloadBlob } from '../../../lib/download';
import { fill } from '../../../lib/format';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import { canvasToBlob, closePdf, openPdf, renderPage } from '../../../lib/pdf/render';
import { useFileResults, withSuffix } from '../../../lib/results';
import {
  drawStrokes,
  inkAngle,
  inkMask,
  straightenAngle,
  strokeBounds,
  tidyStrokes,
} from '../../../lib/signature';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  t: Messages<'pdf'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

interface Page {
  n: number;
  url: string;
  /** ukuran terlihat dalam point */
  width: number;
  height: number;
}
/** Posisi dalam point, origin kiri atas (untuk UI). */
interface Stamp {
  id: number;
  page: number;
  x: number;
  y: number;
  width: number;
}

const file = shallowRef<File | null>(null);
const pages = ref<Page[]>([]);
const loading = ref(false);
const error = ref('');
const stamps = ref<Stamp[]>([]);
const results = useFileResults();
const saving = ref(false);
let nextId = 0;

// ---------- tanda tangan ----------
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

async function initPad() {
  await nextTick();
  // Kanvas yang tersembunyi (tab Foto) belum punya ukuran; dibuat saat tab Gores dibuka.
  if (!padCanvas.value || pad || !padCanvas.value.offsetWidth) return;
  const { default: Pad } = await import('signature_pad');
  const c = padCanvas.value;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  c.width = c.offsetWidth * dpr;
  c.height = c.offsetHeight * dpr;
  c.getContext('2d')!.scale(dpr, dpr);
  pad = new Pad(c, penOptions());
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
    photoError.value = props.t['sign.photoError'];
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
    if (!sig) photoError.value = props.t['sign.photoError'];
  } finally {
    photoBusy.value = false;
  }
}

function setSig(target: typeof drawn, s: Sig | null) {
  if (target.value) URL.revokeObjectURL(target.value.url);
  target.value = s;
}

function downloadSignature() {
  if (!signature.value) return;
  downloadBlob(
    new Blob([signature.value.png], { type: 'image/png' }),
    `${fileName('signature')}.png`,
  );
}

watch([color, weight], () => {
  applyPen();
  refreshDrawn();
  refreshPhoto();
});
watch(tidy, refreshDrawn);
watch(source, (v) => v === 'draw' && initPad());
onMounted(initPad);
watch(straighten, refreshPhoto);

// ---------- PDF ----------
async function load(list: File[]) {
  reset();
  file.value = list[0] ?? null;
  if (!file.value) return;
  loading.value = true;
  try {
    const doc = await openPdf(await file.value.arrayBuffer());
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const canvas = await renderPage(doc, n, Math.min(2, 1000 / vp.width));
      const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.85));
      pages.value.push({ n, url, width: vp.width, height: vp.height });
    }
    await closePdf(doc);
  } catch (e) {
    error.value =
      (e as Error).name === 'PasswordException'
        ? props.t['error.encrypted']
        : props.t['error.invalid'];
    file.value = null;
  } finally {
    loading.value = false;
  }
}

function place(page: Page, e: MouseEvent) {
  if (!signature.value) {
    error.value = props.t['sign.needSignature'];
    return;
  }
  error.value = '';
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const k = page.width / rect.width;
  const width = page.width * 0.3;
  const height = width / signature.value.ratio;
  const x = Math.min(Math.max(0, (e.clientX - rect.left) * k - width / 2), page.width - width);
  const y = Math.min(Math.max(0, (e.clientY - rect.top) * k - height / 2), page.height - height);
  stamps.value.push({ id: nextId++, page: page.n, x, y, width });
}

function stampHeight(s: Stamp) {
  return s.width / (signature.value?.ratio ?? 3);
}

function clampStamp(s: Stamp) {
  const p = pages.value[s.page - 1];
  s.width = Math.min(Math.max(20, s.width), p.width);
  s.x = Math.min(Math.max(0, s.x), p.width - s.width);
  s.y = Math.min(Math.max(0, s.y), p.height - stampHeight(s));
}

/** Geser atau ubah ukuran dengan pointer (mouse, sentuh, pena). */
function drag(s: Stamp, e: PointerEvent, mode: 'move' | 'resize') {
  e.preventDefault();
  e.stopPropagation();
  const pageEl = (e.currentTarget as HTMLElement).closest('[data-page]') as HTMLElement;
  const k = pages.value[s.page - 1].width / pageEl.getBoundingClientRect().width;
  const start = { x: e.clientX, y: e.clientY, sx: s.x, sy: s.y, sw: s.width };
  const onMove = (ev: PointerEvent) => {
    const dx = (ev.clientX - start.x) * k;
    const dy = (ev.clientY - start.y) * k;
    if (mode === 'move') {
      s.x = start.sx + dx;
      s.y = start.sy + dy;
    } else {
      s.width = start.sw + dx;
    }
    clampStamp(s);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

/** Keyboard: panah menggeser, Shift+panah lebih jauh, + dan - mengubah ukuran, Delete menghapus. */
function onKey(s: Stamp, e: KeyboardEvent) {
  const step = e.shiftKey ? 10 : 2;
  const map: Record<string, () => void> = {
    ArrowLeft: () => (s.x -= step),
    ArrowRight: () => (s.x += step),
    ArrowUp: () => (s.y -= step),
    ArrowDown: () => (s.y += step),
    '+': () => (s.width *= 1.05),
    '=': () => (s.width *= 1.05),
    '-': () => (s.width /= 1.05),
    Delete: () => removeStamp(s.id),
    Backspace: () => removeStamp(s.id),
  };
  const fn = map[e.key];
  if (!fn) return;
  e.preventDefault();
  fn();
  if (stamps.value.includes(s)) clampStamp(s);
}

function removeStamp(id: number) {
  stamps.value = stamps.value.filter((s) => s.id !== id);
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

async function save() {
  if (!file.value || !signature.value) return;
  if (!stamps.value.length) {
    error.value = props.t['sign.needPlacement'];
    return;
  }
  saving.value = true;
  error.value = '';
  results.clear();
  try {
    const placements = stamps.value.map((s) => {
      const p = pages.value[s.page - 1];
      const h = stampHeight(s);
      return { page: s.page - 1, x: s.x, y: p.height - s.y - h, width: s.width, height: h };
    });
    const bytes = await (
      await pdfWorker()
    ).sign(await file.value.arrayBuffer(), signature.value.png.slice(0), placements);
    results.add(
      withSuffix(file.value.name, fileName('signed'), '.pdf'),
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
  } catch (e) {
    error.value = props.t[`error.${pdfErrorCode(e)}`];
  } finally {
    saving.value = false;
  }
}

function reset() {
  // Tanda tangan tetap disimpan saat PDF diganti.
  pages.value.forEach((p) => URL.revokeObjectURL(p.url));
  pages.value = [];
  stamps.value = [];
  file.value = null;
  error.value = '';
  results.clear();
}

onBeforeUnmount(() => {
  reset();
  setSig(drawn, null);
  setSig(fromPhoto, null);
  photo?.close();
  pad?.off();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card space-y-4">
      <p class="font-semibold">{{ t['sign.title'] }}</p>

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
          {{ opt === 'draw' ? t['sign.sourceDraw'] : t['sign.sourcePhoto'] }}
        </button>
      </div>

      <div class="space-y-3" :class="{ hidden: source !== 'draw' }">
        <canvas
          ref="padCanvas"
          class="h-44 w-full max-w-xl touch-none rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-600"
          :aria-label="t['sign.padLabel']"
        />
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-secondary" :disabled="!strokeCount" @click="undo">
            {{ t['sign.undo'] }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="!strokeCount"
            @click="clearPad"
          >
            {{ t['sign.clear'] }}
          </button>
        </div>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="tidy" type="checkbox" class="mt-1" />
          <span>
            <span class="font-medium">{{ t['sign.tidy'] }}</span>
            <span class="block text-slate-600 dark:text-slate-400">{{ t['sign.tidyHint'] }}</span>
          </span>
        </label>
      </div>

      <div class="space-y-3" :class="{ hidden: source !== 'photo' }">
        <label class="btn btn-secondary cursor-pointer">
          {{ t['sign.photoPick'] }}
          <input
            type="file"
            accept="image/*"
            class="sr-only"
            @change="pickPhoto([...(($event.target as HTMLInputElement).files ?? [])])"
          />
        </label>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ t['sign.photoHint'] }}</p>
        <label class="flex items-center gap-2 text-sm">
          <input v-model="straighten" type="checkbox" />
          <span class="font-medium">{{ t['sign.straighten'] }}</span>
        </label>
        <ProgressBar v-if="photoBusy" :label="t['sign.photoBusy']" />
        <p v-if="photoError" class="error-text" aria-live="polite">{{ photoError }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <div class="flex items-center gap-2" role="group" :aria-label="t['sign.color']">
          <span>{{ t['sign.color'] }}</span>
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
              :class="
                key === 'blue' ? 'bg-[#0b2a8a]' : 'bg-[#111827] dark:ring-1 dark:ring-white/40'
              "
              aria-hidden="true"
            />
            {{ t[`sign.${key}`] }}
          </button>
        </div>
        <div
          class="flex items-center gap-2"
          :class="{ hidden: source !== 'draw' }"
          role="group"
          :aria-label="t['sign.weight']"
        >
          <span>{{ t['sign.weight'] }}</span>
          <button
            v-for="key in ['thin', 'medium', 'bold'] as const"
            :key="key"
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            :class="{ 'btn-active': weight === key }"
            :aria-pressed="weight === key"
            @click="weight = key"
          >
            {{ t[`sign.${key}`] }}
          </button>
        </div>
      </div>

      <div v-if="signature" class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-medium">{{ t['sign.result'] }}</span>
        <img
          :src="signature.url"
          :alt="t['sign.result']"
          data-signature
          class="h-16 max-w-full rounded border border-slate-200 bg-white object-contain px-3 py-1 dark:border-slate-700"
        />
        <button type="button" class="btn btn-secondary" @click="downloadSignature">
          {{ t['sign.downloadPng'] }}
        </button>
      </div>
    </div>

    <p v-if="!file" class="font-semibold">{{ t['sign.pickPdf'] }}</p>
    <Dropzone
      v-if="!file"
      :messages="dropzone"
      :accept="PDF_ACCEPT"
      :multiple="false"
      @files="load"
      @prefetch="pdfWorker()"
    />
    <ProgressBar v-if="loading" :label="t['sign.loading']" />

    <template v-if="file && !loading">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="truncate font-medium">{{ file.name }}</p>
        <button type="button" class="btn btn-secondary" @click="reset">
          {{ t['sign.change'] }}
        </button>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ t['sign.placeHint'] }}</p>

      <div class="space-y-6">
        <figure v-for="p in pages" :key="p.n" class="mx-auto max-w-3xl">
          <div
            :data-page="p.n"
            class="relative cursor-crosshair overflow-hidden rounded shadow ring-1 ring-slate-200 select-none dark:ring-slate-700"
            @click="place(p, $event)"
          >
            <img
              :src="p.url"
              :alt="fill(t['sign.pageLabel'], { n: p.n })"
              class="block w-full"
              draggable="false"
            />
            <div
              v-for="s in stamps.filter((x) => x.page === p.n)"
              :key="s.id"
              tabindex="0"
              role="group"
              :aria-label="t['sign.remove']"
              class="absolute cursor-move touch-none outline-2 outline-brand-500 outline-dashed focus-visible:outline-solid"
              :style="{
                left: pct(s.x, p.width),
                top: pct(s.y, p.height),
                width: pct(s.width, p.width),
                height: pct(stampHeight(s), p.height),
              }"
              @pointerdown="drag(s, $event, 'move')"
              @click.stop
              @keydown="onKey(s, $event)"
            >
              <img
                v-if="signature"
                :src="signature.url"
                alt=""
                class="pointer-events-none size-full"
                draggable="false"
              />
              <button
                type="button"
                class="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-red-600 text-white"
                :aria-label="t['sign.remove']"
                @pointerdown.stop
                @click.stop="removeStamp(s.id)"
              >
                <IconX class="size-3.5" aria-hidden="true" />
              </button>
              <span
                class="absolute -right-1.5 -bottom-1.5 size-4 cursor-se-resize rounded-sm bg-brand-600"
                @pointerdown="drag(s, $event, 'resize')"
              />
            </div>
          </div>
          <figcaption class="mt-1 text-center text-xs text-slate-600 dark:text-slate-400">
            {{ fill(t['sign.pageLabel'], { n: p.n }) }}
          </figcaption>
        </figure>
      </div>

      <div class="sticky bottom-3 flex justify-center">
        <button type="button" class="btn btn-primary shadow-lg" :disabled="saving" @click="save">
          {{ t['sign.run'] }}
        </button>
      </div>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <ProgressBar v-if="saving" :label="files.processing" />
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
