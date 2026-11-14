<script setup lang="ts">
/**
 * Kolase foto: 2-9 foto, tata letak otomatis sesuai jumlah, rasio untuk media sosial, jarak,
 * sudut, dan warna latar. Di pratinjau: seret di dalam kotak untuk menggeser foto, seret ke kotak
 * lain untuk menukar, dan zoom per foto. Semua di browser.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import IconMinus from '~icons/lucide/minus';
import IconPlus from '~icons/lucide/plus';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import {
  cellAt,
  clamp,
  collageRects,
  drawCollage,
  layoutsFor,
  MAX_PHOTOS,
  MAX_ZOOM,
  MIN_PHOTOS,
  panBy,
  RATIOS,
  type Cell,
  type CollagePhoto,
  type Framing,
  type Layout,
  type Ratio,
} from '../../../lib/collage';
import { fill, formatBytes } from '../../../lib/format';
import { IMAGE_ACCEPT, sniffFormat } from '../../../lib/image/format';
import { useFileResults } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';

const props = defineProps<{
  c: Messages<'collage'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

interface Photo {
  id: number;
  name: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  thumb: string;
  framing: Framing;
}

/** Sisi terpanjang foto setelah dimuat: cukup untuk kolase 2160 px dan hemat memori. */
const MAX_SIDE = 2400;
const BACKGROUNDS = ['#ffffff', '#f3ede2', '#111111', '#e8d5c4', '#c9d6c3'];

const photos = shallowRef<Photo[]>([]);
const ratio = ref<Ratio>('4:5');
const layoutId = ref('rows');
const gap = ref(16);
const radius = ref(0);
const background = ref('#ffffff');
const format = ref<'jpeg' | 'png'>('jpeg');
const scale = ref<1 | 2>(1);
const selected = ref(-1);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const results = useFileResults();
const canvas = ref<HTMLCanvasElement>();
const wrap = ref<HTMLElement>();
let nextId = 0;

const layouts = computed(() => layoutsFor(photos.value.length));
const layout = computed<Layout>(
  () => layouts.value.find((l) => l.id === layoutId.value) ?? layouts.value[0],
);
const size = computed(() => RATIOS[ratio.value]);
const style = computed(() => ({
  layout: layout.value,
  gap: gap.value,
  radius: radius.value,
  background: background.value,
}));
const selPhoto = computed(() => photos.value[selected.value]);
const layoutLabel = (id: string) => props.c[`layout.${id}` as keyof Messages<'collage'>] ?? id;

// ---------- memuat foto ----------

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // HEIC (foto iPhone) belum bisa dibaca browser selain Safari: pakai libheif.
    const buf = await file.arrayBuffer();
    if (sniffFormat(new Uint8Array(buf.slice(0, 32))) !== 'heic') throw new Error('decode');
    const lib = await (await import('libheif-js/libheif-wasm/libheif-bundle.mjs')).default();
    const images = new lib.HeifDecoder().decode(new Uint8Array(buf));
    if (!images.length) throw new Error('decode');
    const img = images[0];
    const width = img.get_width();
    const height = img.get_height();
    const data = await new Promise<Uint8ClampedArray<ArrayBuffer>>((resolve, reject) =>
      img.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (out) =>
        out ? resolve(out.data) : reject(new Error('decode')),
      ),
    );
    images.forEach((i) => i.free?.());
    return createImageBitmap(new ImageData(data, width, height));
  }
}

async function loadPhoto(file: File): Promise<Photo> {
  let bmp = await decode(file);
  const f = MAX_SIDE / Math.max(bmp.width, bmp.height);
  if (f < 1) {
    const small = await createImageBitmap(bmp, {
      resizeWidth: Math.round(bmp.width * f),
      resizeHeight: Math.round(bmp.height * f),
      resizeQuality: 'high',
    });
    bmp.close();
    bmp = small;
  }
  const t = 160 / Math.max(bmp.width, bmp.height);
  const tc = new OffscreenCanvas(Math.round(bmp.width * t), Math.round(bmp.height * t));
  tc.getContext('2d')!.drawImage(bmp, 0, 0, tc.width, tc.height);
  const thumb = URL.createObjectURL(await tc.convertToBlob({ type: 'image/jpeg', quality: 0.8 }));
  return {
    id: nextId++,
    name: file.name,
    bitmap: bmp,
    width: bmp.width,
    height: bmp.height,
    thumb,
    framing: { zoom: 1, panX: 0, panY: 0 },
  };
}

async function add(list: File[]) {
  error.value = '';
  notice.value = '';
  const room = MAX_PHOTOS - photos.value.length;
  if (list.length > room) notice.value = fill(props.c.tooMany, { n: MAX_PHOTOS });
  loading.value = true;
  const added: Photo[] = [];
  let failed = 0;
  for (const file of list.slice(0, Math.max(0, room))) {
    try {
      added.push(await loadPhoto(file));
    } catch {
      failed++;
    }
  }
  loading.value = false;
  if (failed) error.value = fill(props.c.failed, { n: failed });
  photos.value = [...photos.value, ...added];
  results.clear();
}

function remove(i: number) {
  const p = photos.value[i];
  p.bitmap.close();
  URL.revokeObjectURL(p.thumb);
  photos.value = photos.value.filter((_, j) => j !== i);
  selected.value = -1;
  results.clear();
}

function clearAll() {
  photos.value.forEach((p) => {
    p.bitmap.close();
    URL.revokeObjectURL(p.thumb);
  });
  photos.value = [];
  selected.value = -1;
  results.clear();
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  void add([...(input.files ?? [])]);
  input.value = '';
}

// Jumlah foto berubah: pakai tata letak bawaan untuk jumlah itu bila yang lama tidak tersedia.
watch(
  () => photos.value.length,
  () => {
    if (!layouts.value.some((l) => l.id === layoutId.value)) layoutId.value = layouts.value[0]?.id;
  },
);

// ---------- pratinjau ----------

const view = ref({ w: 0, h: 0 });
let ro: ResizeObserver | undefined;
let raf = 0;

function measure() {
  const el = wrap.value;
  if (!el) return;
  const [W, H] = size.value;
  const maxW = el.clientWidth;
  const maxH = Math.min(640, window.innerHeight * 0.7);
  const s = Math.min(maxW / W, maxH / H);
  view.value = { w: Math.floor(W * s), h: Math.floor(H * s) };
}

function rects(): Cell[] {
  return collageRects(style.value, view.value.w, view.value.h);
}

function draw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const cv = canvas.value;
    if (!cv || !view.value.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { w, h } = view.value;
    if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr);
    if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr);
    // Ukuran tampil lewat CSSOM (CSP melarang atribut style inline).
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCollage(ctx, w, h, style.value, collagePhotos());
    // Penanda kotak terpilih dan target tukar (hanya di pratinjau).
    const rs = rects();
    const mark = (i: number, color: string, dash: number[]) => {
      const r = rs[i];
      if (!r) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash(dash);
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
      ctx.restore();
    };
    if (drag.value?.target !== undefined && drag.value.target >= 0)
      mark(drag.value.target, '#2563eb', [8, 6]);
    else if (selected.value >= 0) mark(selected.value, '#2563eb', []);
  });
}

function collagePhotos(): CollagePhoto[] {
  return photos.value.map((p) => ({
    image: p.bitmap,
    width: p.width,
    height: p.height,
    framing: p.framing,
  }));
}

watch([photos, style, view, selected], draw, { deep: true });
watch(ratio, () => nextTick(measure));
watch(
  () => photos.value.length >= MIN_PHOTOS,
  async (ok) => {
    if (!ok) return;
    await nextTick();
    measure();
    if (wrap.value && !ro) {
      ro = new ResizeObserver(measure);
      ro.observe(wrap.value);
    }
  },
);

// ---------- seret: geser foto di kotaknya, atau tukar dengan kotak lain ----------

const drag = ref<{ from: number; x: number; y: number; target: number } | null>(null);

function point(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function setFraming(i: number, f: Partial<Framing>) {
  const list = [...photos.value];
  list[i] = { ...list[i], framing: { ...list[i].framing, ...f } };
  photos.value = list;
  results.clear();
}

function onDown(e: PointerEvent) {
  const p = point(e);
  const i = cellAt(rects(), p.x, p.y);
  selected.value = i;
  if (i < 0 || !photos.value[i]) return;
  canvas.value!.setPointerCapture(e.pointerId);
  drag.value = { from: i, x: p.x, y: p.y, target: -1 };
}

function onMove(e: PointerEvent) {
  const d = drag.value;
  if (!d) return;
  const p = point(e);
  const rs = rects();
  const over = cellAt(rs, p.x, p.y);
  if (over >= 0 && over !== d.from) {
    if (d.target !== over) {
      d.target = over;
      draw();
    }
  } else {
    if (d.target !== -1) {
      d.target = -1;
      draw();
    }
    const ph = photos.value[d.from];
    setFraming(d.from, panBy(ph.framing, ph.width, ph.height, rs[d.from], p.x - d.x, p.y - d.y));
  }
  d.x = p.x;
  d.y = p.y;
}

function onUp() {
  const d = drag.value;
  drag.value = null;
  if (d && d.target >= 0) {
    const list = [...photos.value];
    [list[d.from], list[d.target]] = [list[d.target], list[d.from]];
    photos.value = list;
    selected.value = d.target;
    results.clear();
  }
  draw();
}

function onWheel(e: WheelEvent) {
  const p = point(e as unknown as PointerEvent);
  const i = cellAt(rects(), p.x, p.y);
  if (i < 0 || i !== selected.value) return;
  e.preventDefault();
  zoomBy(i, Math.exp(-e.deltaY * 0.0015));
}

function zoomBy(i: number, factor: number) {
  const ph = photos.value[i];
  if (ph) setFraming(i, { zoom: clamp(ph.framing.zoom * factor, 1, MAX_ZOOM) });
}

/** Keyboard pada kanvas: panah menggeser foto terpilih, +/- zoom. */
function onKey(e: KeyboardEvent) {
  const i = selected.value;
  const ph = photos.value[i];
  if (!ph) return;
  const step = 10;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [step, 0],
    ArrowRight: [-step, 0],
    ArrowUp: [0, step],
    ArrowDown: [0, -step],
  };
  if (moves[e.key]) {
    e.preventDefault();
    const [dx, dy] = moves[e.key];
    setFraming(i, panBy(ph.framing, ph.width, ph.height, rects()[i], dx, dy));
  } else if (e.key === '+' || e.key === '=') zoomBy(i, 1.15);
  else if (e.key === '-') zoomBy(i, 1 / 1.15);
}

// ---------- unduh ----------

async function save() {
  if (photos.value.length < MIN_PHOTOS) return;
  busy.value = true;
  error.value = '';
  results.clear();
  try {
    const [W0, H0] = size.value;
    const W = W0 * scale.value;
    const H = H0 * scale.value;
    const cv = new OffscreenCanvas(W, H);
    drawCollage(cv.getContext('2d')!, W, H, style.value, collagePhotos());
    const type = format.value === 'png' ? 'image/png' : 'image/jpeg';
    const blob = await cv.convertToBlob({ type, quality: 0.92 });
    results.add(
      `${props.c.fileName}.${format.value === 'png' ? 'png' : 'jpg'}`,
      blob,
      `${W} × ${H} · ${formatBytes(blob.size)}`,
    );
  } catch {
    error.value = props.c.saveFailed;
  } finally {
    busy.value = false;
  }
}

onMounted(() => addEventListener('resize', measure));
onBeforeUnmount(() => {
  removeEventListener('resize', measure);
  ro?.disconnect();
  cancelAnimationFrame(raf);
  photos.value.forEach((p) => {
    p.bitmap.close();
    URL.revokeObjectURL(p.thumb);
  });
});
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      v-if="!photos.length"
      :messages="dropzone"
      :accept="IMAGE_ACCEPT"
      :multiple="true"
      @files="add"
    />
    <p v-if="loading" class="text-sm" aria-live="polite">{{ c.loading }}</p>

    <template v-if="photos.length">
      <!-- Daftar foto -->
      <div class="flex flex-wrap items-center gap-2" data-cl-photos>
        <div v-for="(p, i) in photos" :key="p.id" class="relative">
          <img
            :src="p.thumb"
            :alt="p.name"
            class="size-16 rounded object-cover ring-offset-2"
            :class="{ 'ring-2 ring-brand-600': selected === i }"
          />
          <button
            type="button"
            class="absolute -top-2 -right-2 rounded-full bg-slate-900 p-0.5 text-white"
            :aria-label="fill(c.remove, { name: p.name })"
            data-cl-remove
            @click="remove(i)"
          >
            <IconX class="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <label
          v-if="photos.length < MAX_PHOTOS"
          class="flex size-16 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-400 text-xs text-slate-600 hover:border-brand-600 dark:text-slate-400"
        >
          <IconPlus class="size-4" aria-hidden="true" />
          {{ c.add }}
          <input
            type="file"
            :accept="IMAGE_ACCEPT"
            multiple
            class="sr-only"
            data-cl-add
            @change="onPick"
          />
        </label>
        <button type="button" class="btn btn-secondary ml-auto" @click="clearAll">
          {{ c.clear }}
        </button>
      </div>
      <p v-if="photos.length < MIN_PHOTOS" class="text-sm text-amber-700 dark:text-amber-400">
        {{ c.needMore }}
      </p>
    </template>

    <p v-if="notice" class="text-sm text-amber-700 dark:text-amber-400">{{ notice }}</p>
    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>

    <div v-if="photos.length >= MIN_PHOTOS" class="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <!-- Pratinjau -->
      <div class="space-y-2">
        <div ref="wrap" class="flex justify-center">
          <canvas
            ref="canvas"
            class="cursor-grab touch-none rounded shadow-sm focus-visible:outline-2 focus-visible:outline-brand-600 active:cursor-grabbing"
            tabindex="0"
            role="img"
            :aria-label="c.previewLabel"
            data-cl-canvas
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
            @wheel="onWheel"
            @keydown="onKey"
          />
        </div>
        <p class="text-center text-sm text-slate-600 dark:text-slate-400">{{ c.hint }}</p>
        <div v-if="selPhoto" class="flex flex-wrap items-center justify-center gap-2" data-cl-zoom>
          <button
            type="button"
            class="btn btn-secondary"
            :aria-label="c.zoomOut"
            @click="zoomBy(selected, 1 / 1.15)"
          >
            <IconMinus class="size-4" aria-hidden="true" />
          </button>
          <label for="cl-zoom" class="sr-only">{{ c.zoom }}</label>
          <input
            id="cl-zoom"
            type="range"
            min="1"
            :max="MAX_ZOOM"
            step="0.01"
            :value="selPhoto.framing.zoom"
            class="w-40 accent-brand-600"
            @input="setFraming(selected, { zoom: +($event.target as HTMLInputElement).value })"
          />
          <button
            type="button"
            class="btn btn-secondary"
            :aria-label="c.zoomIn"
            @click="zoomBy(selected, 1.15)"
          >
            <IconPlus class="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            @click="setFraming(selected, { zoom: 1, panX: 0, panY: 0 })"
          >
            {{ c.resetPhoto }}
          </button>
        </div>
      </div>

      <!-- Pengaturan -->
      <div class="space-y-5">
        <fieldset>
          <legend class="label">{{ c.ratio }}</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in Object.keys(RATIOS) as Ratio[]"
              :key="r"
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn-active': ratio === r }"
              :aria-pressed="ratio === r"
              :data-cl-ratio="r"
              @click="ratio = r"
            >
              {{ r }}
            </button>
          </div>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ c[`ratio.${ratio}`] }}</p>
        </fieldset>

        <fieldset>
          <legend class="label">{{ c.layout }}</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="l in layouts"
              :key="l.id"
              type="button"
              class="rounded border p-1"
              :class="
                layout.id === l.id
                  ? 'border-brand-600 ring-1 ring-brand-600'
                  : 'border-slate-300 dark:border-slate-600'
              "
              :aria-pressed="layout.id === l.id"
              :aria-label="layoutLabel(l.id)"
              :title="layoutLabel(l.id)"
              :data-cl-layout="l.id"
              @click="layoutId = l.id"
            >
              <svg viewBox="0 0 40 40" class="size-10" aria-hidden="true">
                <rect
                  v-for="(cell, i) in l.cells"
                  :key="i"
                  :x="cell.x * 40 + 1"
                  :y="cell.y * 40 + 1"
                  :width="cell.w * 40 - 2"
                  :height="cell.h * 40 - 2"
                  rx="1.5"
                  class="fill-slate-400 dark:fill-slate-500"
                />
              </svg>
            </button>
          </div>
        </fieldset>

        <div>
          <label for="cl-gap" class="label">{{ fill(c.gap, { n: gap }) }}</label>
          <input
            id="cl-gap"
            v-model.number="gap"
            type="range"
            min="0"
            max="60"
            class="w-full accent-brand-600"
          />
        </div>
        <div>
          <label for="cl-radius" class="label">{{ fill(c.radius, { n: radius }) }}</label>
          <input
            id="cl-radius"
            v-model.number="radius"
            type="range"
            min="0"
            max="80"
            class="w-full accent-brand-600"
          />
        </div>

        <fieldset>
          <legend class="label">{{ c.background }}</legend>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="b in BACKGROUNDS"
              :key="b"
              type="button"
              class="size-7 rounded-full border border-slate-300 dark:border-slate-600"
              :class="[
                `cl-bg-${b.slice(1)}`,
                { 'ring-2 ring-brand-600 ring-offset-2': background === b },
              ]"
              :aria-label="b"
              :aria-pressed="background === b"
              @click="background = b"
            />
            <label class="flex items-center gap-2 text-sm">
              <input v-model="background" type="color" class="h-7 w-10 cursor-pointer" data-cl-bg />
              {{ c.custom }}
            </label>
          </div>
        </fieldset>

        <div class="flex flex-wrap gap-3">
          <div>
            <label for="cl-fmt" class="label">{{ c.format }}</label>
            <select id="cl-fmt" v-model="format" class="field w-auto">
              <option value="jpeg">JPG</option>
              <option value="png">PNG</option>
            </select>
          </div>
          <div>
            <label for="cl-size" class="label">{{ c.size }}</label>
            <select id="cl-size" v-model.number="scale" class="field w-auto">
              <option :value="1">{{ fill(c.sizeStd, { w: size[0], h: size[1] }) }}</option>
              <option :value="2">{{ fill(c.sizeHigh, { w: size[0] * 2, h: size[1] * 2 }) }}</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-primary w-full"
          :disabled="busy"
          data-cl-save
          @click="save"
        >
          {{ c.save }}
        </button>
      </div>
    </div>

    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      :thumbnails="true"
      @remove="results.remove"
    />
  </div>
</template>

<style scoped>
.cl-bg-ffffff {
  background-color: #ffffff;
}
.cl-bg-f3ede2 {
  background-color: #f3ede2;
}
.cl-bg-111111 {
  background-color: #111111;
}
.cl-bg-e8d5c4 {
  background-color: #e8d5c4;
}
.cl-bg-c9d6c3 {
  background-color: #c9d6c3;
}
</style>
