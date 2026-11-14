<script setup lang="ts">
/**
 * Atur halaman PDF: putar, hapus, duplikat, dan seret untuk mengubah urutan. Thumbnail dirender
 * pdf.js di browser; hasil disusun pdf-lib di worker. Tidak ada yang diunggah.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import IconCopy from '~icons/lucide/copy';
import IconGrip from '~icons/lucide/grip-vertical';
import IconRotateCcw from '~icons/lucide/rotate-ccw';
import IconRotateCw from '~icons/lucide/rotate-cw';
import IconTrash from '~icons/lucide/trash';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import { fileName } from '../../../lib/names';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import {
  duplicatePage,
  initialPages,
  isChanged,
  movePage,
  removePage,
  reversePages,
  rotateAll,
  rotateOne,
  type PageItem,
} from '../../../lib/pdf/organize';
import { canvasToBlob, closePdf, openPdf, renderPage } from '../../../lib/pdf/render';
import { useFileResults, withSuffix } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  t: Messages<'pdf'>;
  o: Messages<'organize'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

const file = shallowRef<File | null>(null);
const count = ref(0);
const items = ref<PageItem[]>([]);
/** URL thumbnail per indeks halaman asal. */
const thumbs = ref<Record<number, string>>({});
const busy = ref(false);
const error = ref('');
const results = useFileResults();
const dragId = ref<number | null>(null);
const changed = computed(() => isChanged(items.value, count.value));

let doc: PDFDocumentProxy | null = null;
let loadId = 0;

function releaseThumbs() {
  Object.values(thumbs.value).forEach((u) => URL.revokeObjectURL(u));
  thumbs.value = {};
}

async function load(list: File[]) {
  const id = ++loadId;
  file.value = list[0] ?? null;
  results.clear();
  error.value = '';
  count.value = 0;
  items.value = [];
  releaseThumbs();
  if (doc) void closePdf(doc);
  doc = null;
  if (!file.value) return;
  try {
    const buf = await file.value.arrayBuffer();
    const n = await (await pdfWorker()).pageCount(buf);
    if (id !== loadId) return;
    count.value = n;
    items.value = initialPages(n);
    doc = await openPdf(buf);
    if (id !== loadId) return;
    // Thumbnail satu per satu agar halaman pertama cepat muncul dan memori tetap kecil.
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const w = page.getViewport({ scale: 1 }).width;
      const canvas = await renderPage(doc, i, Math.min(1, 220 / w));
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.8);
      if (id !== loadId) return;
      thumbs.value = { ...thumbs.value, [i - 1]: URL.createObjectURL(blob) };
    }
  } catch (e) {
    if (id === loadId && !count.value) error.value = props.t[`error.${pdfErrorCode(e)}`];
  }
}

function edit(next: PageItem[]) {
  items.value = next;
  results.clear();
}

const ROT_CLASS: Record<number, string> = {
  0: '',
  90: 'rotate-90',
  180: 'rotate-180',
  270: '-rotate-90',
};

// ---------- seret untuk mengubah urutan (mouse, sentuh, pena) ----------

function startDrag(e: PointerEvent, id: number) {
  if (e.button !== 0) return;
  e.preventDefault();
  dragId.value = id;
  addEventListener('pointermove', onDrag);
  addEventListener('pointerup', endDrag, { once: true });
  addEventListener('pointercancel', endDrag, { once: true });
}

function onDrag(e: PointerEvent) {
  if (dragId.value === null) return;
  const over = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest<HTMLElement>('[data-org-pos]');
  if (!over) return;
  const to = Number(over.dataset.orgPos);
  const from = items.value.findIndex((p) => p.id === dragId.value);
  if (from !== to) edit(movePage(items.value, from, to));
}

function endDrag() {
  dragId.value = null;
  removeEventListener('pointermove', onDrag);
}

/** Keyboard: panah kiri/kanan pada pegangan memindah halaman satu posisi. */
function keyMove(e: KeyboardEvent, pos: number) {
  const d =
    e.key === 'ArrowLeft' || e.key === 'ArrowUp'
      ? -1
      : e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : 0;
  if (!d) return;
  e.preventDefault();
  const to = pos + d;
  if (to < 0 || to >= items.value.length) return;
  edit(movePage(items.value, pos, to));
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-org-pos="${to}"] [data-org-handle]`)?.focus(),
  );
}

async function save() {
  if (!file.value || !items.value.length) return;
  busy.value = true;
  error.value = '';
  results.clear();
  try {
    const bytes = await (
      await pdfWorker()
    ).organize(
      await file.value.arrayBuffer(),
      items.value.map(({ index, rotate }) => ({ index, rotate })),
    );
    results.add(
      withSuffix(file.value.name, fileName('organized'), '.pdf'),
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      `${fill(props.t.pages, { n: items.value.length })} · ${formatBytes(bytes.length)}`,
    );
  } catch (e) {
    error.value = props.t[`error.${pdfErrorCode(e)}`];
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => {
  loadId++;
  endDrag();
  releaseThumbs();
  if (doc) void closePdf(doc);
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
    <template v-else>
      <div class="card flex flex-wrap items-center justify-between gap-2 p-3">
        <p class="min-w-0 truncate text-sm">
          <span class="font-semibold">{{ file.name }}</span>
          <span class="text-slate-600 dark:text-slate-400">
            · {{ count ? fill(t.pages, { n: count }) : files.processing }} ·
            {{ formatBytes(file.size) }}</span
          >
        </p>
        <button type="button" class="btn btn-secondary" @click="load([])">
          {{ t['split.change'] }}
        </button>
      </div>

      <template v-if="count">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            data-org-all="ccw"
            @click="edit(rotateAll(items, -90))"
          >
            <IconRotateCcw class="size-4" aria-hidden="true" />{{ o.rotateAllLeft }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-org-all="cw"
            @click="edit(rotateAll(items, 90))"
          >
            <IconRotateCw class="size-4" aria-hidden="true" />{{ o.rotateAllRight }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-org-reverse
            @click="edit(reversePages(items))"
          >
            {{ o.reverse }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="!changed"
            data-org-reset
            @click="edit(initialPages(count))"
          >
            {{ o.reset }}
          </button>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ o.hint }}</p>

        <ol
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          data-org-grid
        >
          <li
            v-for="(p, pos) in items"
            :key="p.id"
            class="card flex flex-col gap-2 p-2 transition-opacity"
            :class="{ 'opacity-50 ring-2 ring-brand-600': dragId === p.id }"
            :data-org-pos="pos"
            :data-org-index="p.index"
            :data-org-rotate="p.rotate"
          >
            <div
              class="flex aspect-square cursor-grab items-center justify-center overflow-hidden rounded bg-slate-100 select-none active:cursor-grabbing dark:bg-slate-800"
              @pointerdown="$event.pointerType === 'mouse' && startDrag($event, p.id)"
            >
              <img
                v-if="thumbs[p.index]"
                :src="thumbs[p.index]"
                :alt="fill(o.pageAlt, { n: p.index + 1 })"
                class="max-h-full max-w-full shadow transition-transform"
                :class="ROT_CLASS[p.rotate]"
                draggable="false"
              />
              <span v-else class="text-xs text-slate-500">{{ p.index + 1 }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                type="button"
                class="cursor-grab touch-none rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                :aria-label="fill(o.move, { n: p.index + 1 })"
                data-org-handle
                @pointerdown="startDrag($event, p.id)"
                @keydown="keyMove($event, pos)"
              >
                <IconGrip class="size-4" aria-hidden="true" />
              </button>
              <span class="mr-auto text-sm font-semibold tabular-nums">{{ p.index + 1 }}</span>
              <button
                type="button"
                class="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                :aria-label="o.rotateLeft"
                :title="o.rotateLeft"
                data-org-ccw
                @click="edit(rotateOne(items, p.id, -90))"
              >
                <IconRotateCcw class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                :aria-label="o.rotateRight"
                :title="o.rotateRight"
                data-org-cw
                @click="edit(rotateOne(items, p.id, 90))"
              >
                <IconRotateCw class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                :aria-label="o.duplicate"
                :title="o.duplicate"
                data-org-dup
                @click="edit(duplicatePage(items, p.id))"
              >
                <IconCopy class="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950"
                :aria-label="o.remove"
                :title="o.remove"
                :disabled="items.length === 1"
                data-org-del
                @click="edit(removePage(items, p.id))"
              >
                <IconTrash class="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ol>

        <button type="button" class="btn btn-primary" :disabled="busy" data-org-save @click="save">
          {{ fill(o.save, { n: items.length }) }}
        </button>
      </template>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <ProgressBar v-if="busy" :label="files.processing" />
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
