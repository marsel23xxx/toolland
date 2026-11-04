<script setup lang="ts">
/**
 * Tanda tangan PDF: halaman dirender dengan pdf.js, tanda tangan dibuat dengan signature_pad
 * (atau unggah gambar), lalu ditempel dan dipasang permanen dengan pdf-lib di worker.
 */
import type SignaturePad from 'signature_pad';
import { nextTick, onBeforeUnmount, ref, shallowRef } from 'vue';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import { fill } from '../../../lib/format';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import { canvasToBlob, closePdf, openPdf, renderPage } from '../../../lib/pdf/render';
import { useFileResults, withSuffix } from '../../../lib/results';
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
const padCanvas = ref<HTMLCanvasElement>();
let pad: SignaturePad | null = null;
const signature = shallowRef<{ png: ArrayBuffer; url: string; ratio: number } | null>(null);

async function initPad() {
  await nextTick();
  if (!padCanvas.value || pad) return;
  const { default: Pad } = await import('signature_pad');
  const c = padCanvas.value;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  c.width = c.offsetWidth * dpr;
  c.height = c.offsetHeight * dpr;
  c.getContext('2d')!.scale(dpr, dpr);
  pad = new Pad(c, { penColor: '#0b1f6b', minWidth: 0.8, maxWidth: 2.6 });
}

/** Potong area kosong di sekeliling coretan, hasil PNG transparan. */
async function trimmed(
  source: HTMLCanvasElement,
): Promise<{ png: ArrayBuffer; url: string; ratio: number } | null> {
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
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad) - minX;
  const h = Math.min(height, maxY + pad) - minY;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')!.drawImage(source, minX, minY, w, h, 0, 0, w, h);
  const blob = await canvasToBlob(out, 'image/png');
  return { png: await blob.arrayBuffer(), url: URL.createObjectURL(blob), ratio: w / h };
}

async function useDrawn() {
  if (!pad || pad.isEmpty() || !padCanvas.value) return;
  setSignature(await trimmed(padCanvas.value));
}

async function useUploaded(list: File[]) {
  const f = list[0];
  if (!f) return;
  const bmp = await createImageBitmap(f);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  // latar putih dari foto/scan dibuat transparan
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const d = img.data;
    if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) d[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  setSignature(await trimmed(c));
}

function setSignature(s: { png: ArrayBuffer; url: string; ratio: number } | null) {
  if (signature.value) URL.revokeObjectURL(signature.value.url);
  signature.value = s;
}

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
  // Kanvas tanda tangan baru dirender setelah loading selesai.
  if (file.value) await initPad();
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
      withSuffix(file.value.name, '-ttd', '.pdf'),
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
  } catch (e) {
    error.value = props.t[`error.${pdfErrorCode(e)}`];
  } finally {
    saving.value = false;
  }
}

function reset() {
  // Kanvas lama ikut hilang saat file diganti, jadi signature_pad dibuat ulang.
  pad?.off();
  pad = null;
  pages.value.forEach((p) => URL.revokeObjectURL(p.url));
  pages.value = [];
  stamps.value = [];
  file.value = null;
  error.value = '';
  results.clear();
}

onBeforeUnmount(() => {
  reset();
  setSignature(null);
  pad?.off();
});
</script>

<template>
  <div class="space-y-4">
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
      <div class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="font-semibold">{{ t['sign.draw'] }}</p>
          <button type="button" class="btn btn-secondary" @click="reset">
            {{ t['sign.change'] }}
          </button>
        </div>
        <canvas
          ref="padCanvas"
          class="h-40 w-full max-w-xl touch-none rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-600"
          :aria-label="t['sign.padLabel']"
        />
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn btn-secondary" @click="pad?.clear()">
            {{ t['sign.clear'] }}
          </button>
          <button type="button" class="btn btn-primary" @click="useDrawn">
            {{ t['sign.useThis'] }}
          </button>
          <label class="btn btn-secondary cursor-pointer">
            {{ t['sign.upload'] }}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="sr-only"
              @change="useUploaded([...(($event.target as HTMLInputElement).files ?? [])])"
            />
          </label>
          <img
            v-if="signature"
            :src="signature.url"
            alt=""
            class="h-10 rounded border border-slate-200 bg-white px-2 dark:border-slate-700"
          />
        </div>
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
