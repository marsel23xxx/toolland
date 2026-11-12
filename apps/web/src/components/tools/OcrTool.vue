<script setup lang="ts">
/**
 * Gambar ke Teks (OCR): foto, screenshot, atau PDF hasil scan dibaca menjadi teks yang bisa
 * disalin dan diedit. Berjalan di browser (tesseract.js), bahasa Indonesia dan/atau Inggris.
 * Kata yang kurang yakin bisa ditandai di pratinjau untuk dicek ulang.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Messages } from '../../i18n';
import { downloadText } from '../../lib/download';
import { fill } from '../../lib/format';
import type { OcrLang, OcrStage, OcrWord } from '../../lib/ocr';
import CopyButton from '../ui/CopyButton.vue';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';
import ProgressBar from '../ui/ProgressBar.vue';

const props = defineProps<{
  m: Messages<'ocr'> & Messages<'common'>;
  dropzone: DropzoneMessages;
}>();
const m = props.m;

const LANGS: OcrLang[] = ['ind+eng', 'ind', 'eng'];
const lang = ref<OcrLang>('ind+eng');
const MAX_PDF_PAGES = 30;
/** Kata dengan keyakinan di bawah ini ditandai sebagai meragukan. */
const LOW_CONF = 60;

interface Item {
  id: number;
  name: string;
  file: File;
  /** Nomor halaman untuk PDF, selain itu 0. */
  page: number;
  rotation: number;
  status: 'wait' | 'run' | 'done' | 'error';
  stage: OcrStage;
  value: number;
  preview: string;
  width: number;
  height: number;
  text: string;
  confidence: number;
  words: OcrWord[];
}

const items = ref<Item[]>([]);
const errors = ref<string[]>([]);
const showLow = ref(true);
let nextId = 0;
let running = false;

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

async function add(files: File[]) {
  errors.value = [];
  for (const file of files) {
    if (isPdf(file)) {
      try {
        const { openPdf, closePdf } = await import('../../lib/pdf/render');
        const doc = await openPdf(await file.arrayBuffer());
        const n = doc.numPages;
        await closePdf(doc);
        if (n > MAX_PDF_PAGES)
          errors.value.push(fill(m.tooManyPages, { name: file.name, n: MAX_PDF_PAGES }));
        for (let p = 1; p <= Math.min(n, MAX_PDF_PAGES); p++) push(file, p);
      } catch {
        errors.value.push(fill(m.badFile, { name: file.name }));
      }
    } else push(file, 0);
  }
  void run();
}

function push(file: File, page: number) {
  items.value.push({
    id: nextId++,
    name: page ? fill(m.pageOf, { name: file.name, n: page }) : file.name,
    file,
    page,
    rotation: 0,
    status: 'wait',
    stage: 'load',
    value: 0,
    preview: '',
    width: 0,
    height: 0,
    text: '',
    confidence: 0,
    words: [],
  });
}

async function canvasFor(item: Item): Promise<HTMLCanvasElement> {
  const ocr = await import('../../lib/ocr');
  if (!item.page) return ocr.imageToCanvas(item.file, item.rotation);
  const { openPdf, closePdf, renderPage } = await import('../../lib/pdf/render');
  const doc = await openPdf(await item.file.arrayBuffer());
  try {
    const page = await doc.getPage(item.page);
    const vp = page.getViewport({ scale: 1 });
    // Sekitar 200 DPI: cukup tajam untuk OCR tanpa membuat canvas raksasa.
    const scale = Math.min(200 / 72, ocr.MAX_SIDE / Math.max(vp.width, vp.height));
    return ocr.rotateCanvas(await renderPage(doc, item.page, scale), item.rotation);
  } finally {
    await closePdf(doc);
  }
}

async function process(item: Item) {
  item.status = 'run';
  item.stage = 'load';
  item.value = 0;
  try {
    const { recognize } = await import('../../lib/ocr');
    const canvas = await canvasFor(item);
    if (item.preview) URL.revokeObjectURL(item.preview);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    item.preview = blob ? URL.createObjectURL(blob) : '';
    item.width = canvas.width;
    item.height = canvas.height;
    const res = await recognize(canvas, lang.value, (stage, value) => {
      item.stage = stage;
      item.value = value;
    });
    item.text = res.text;
    item.confidence = res.confidence;
    item.words = res.words;
    item.status = 'done';
  } catch {
    item.status = 'error';
  }
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = items.value.find((i) => i.status === 'wait');
      if (!next) break;
      await process(next);
    }
  } finally {
    running = false;
  }
}

function rotate(item: Item) {
  item.rotation = (item.rotation + 90) % 360;
  item.status = 'wait';
  void run();
}
function redo(item: Item) {
  item.status = 'wait';
  void run();
}
function remove(item: Item) {
  if (item.preview) URL.revokeObjectURL(item.preview);
  items.value = items.value.filter((i) => i !== item);
}
function setLang(l: OcrLang) {
  if (l === lang.value) return;
  lang.value = l;
  // Baca ulang hasil yang sudah ada dengan bahasa baru.
  for (const i of items.value) if (i.status === 'done' || i.status === 'error') i.status = 'wait';
  void run();
}

const done = computed(() => items.value.filter((i) => i.status === 'done'));
const allText = computed(() =>
  done.value
    .map((i) => (done.value.length > 1 ? `--- ${i.name} ---\n${i.text}` : i.text))
    .join('\n\n'),
);
const busy = computed(() => items.value.some((i) => i.status === 'run' || i.status === 'wait'));
const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;
const lowWords = (i: Item) => i.words.filter((w) => w.conf < LOW_CONF && w.text.trim());
const baseName = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-');
const stageLabel = (i: Item) =>
  i.stage === 'read' ? m.stageRead : i.stage === 'lang' ? m.stageLang : m.stageLoad;
const confClass = (c: number) =>
  c >= 85
    ? 'text-green-700 dark:text-green-400'
    : c >= 65
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-red-700 dark:text-red-400';

onBeforeUnmount(() => {
  for (const i of items.value) if (i.preview) URL.revokeObjectURL(i.preview);
  void import('../../lib/ocr').then((o) => o.stopOcr());
});
</script>

<template>
  <div class="space-y-4">
    <fieldset class="flex flex-wrap items-center gap-2">
      <legend class="sr-only">{{ m.lang }}</legend>
      <span class="text-sm font-medium">{{ m.lang }}</span>
      <button
        v-for="l in LANGS"
        :key="l"
        type="button"
        class="btn btn-secondary"
        :class="{ 'btn-active': lang === l }"
        :aria-pressed="lang === l"
        :data-ocr-lang="l"
        @click="setLang(l)"
      >
        {{ m[`lang_${l.replace('+', '_')}` as 'lang_ind'] }}
      </button>
    </fieldset>

    <Dropzone
      :messages="dropzone"
      accept="image/*,.pdf,application/pdf"
      :max-size="30 * 1024 * 1024"
      @files="add"
      @rejected="(e) => (errors = e)"
    />
    <p class="text-xs text-ink-3">{{ m.hint }}</p>
    <ul v-if="errors.length" class="space-y-1">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>

    <div v-if="done.length > 1" class="flex flex-wrap items-center gap-2">
      <CopyButton :text="allText" :label="m.copyAll" :copied-label="m.copied" />
      <button type="button" class="btn btn-secondary" @click="downloadText(allText, m.allFile)">
        ⬇ {{ m.downloadAll }}
      </button>
    </div>

    <label v-if="items.length" class="flex items-center gap-2 text-sm">
      <input v-model="showLow" type="checkbox" class="size-4" />
      {{ m.markLow }}
    </label>

    <ol class="space-y-4">
      <li v-for="item in items" :key="item.id" class="card space-y-3" data-ocr-item>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 truncate font-semibold">{{ item.name }}</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="btn btn-secondary px-2.5 py-1 text-xs"
              :disabled="item.status === 'run'"
              :title="m.rotate"
              data-ocr-rotate
              @click="rotate(item)"
            >
              ↻ {{ m.rotate }}
            </button>
            <button
              v-if="item.status === 'done' || item.status === 'error'"
              type="button"
              class="btn btn-secondary px-2.5 py-1 text-xs"
              @click="redo(item)"
            >
              {{ m.redo }}
            </button>
            <button
              type="button"
              class="btn btn-secondary px-2.5 py-1 text-xs"
              :disabled="item.status === 'run'"
              :aria-label="m.remove"
              @click="remove(item)"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <!-- Pratinjau dengan penanda kata meragukan -->
          <div class="relative self-start overflow-hidden rounded border border-rule bg-paper-2">
            <template v-if="item.preview">
              <img :src="item.preview" :alt="item.name" class="block h-auto w-full" />
              <svg
                v-if="showLow && item.status === 'done'"
                :viewBox="`0 0 ${item.width} ${item.height}`"
                class="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <rect
                  v-for="(w, i) in lowWords(item)"
                  :key="i"
                  :x="w.x0"
                  :y="w.y0"
                  :width="w.x1 - w.x0"
                  :height="w.y1 - w.y0"
                  class="fill-amber-400/30 stroke-amber-500"
                  :stroke-width="Math.max(2, item.width / 500)"
                />
              </svg>
            </template>
            <div v-else class="grid aspect-[4/3] place-items-center text-sm text-ink-3">…</div>
          </div>

          <!-- Teks hasil -->
          <div class="flex min-h-48 flex-col gap-2">
            <template v-if="item.status === 'done'">
              <textarea
                v-model="item.text"
                class="field min-h-48 flex-1 text-sm"
                :aria-label="fill(m.resultFor, { name: item.name })"
                data-ocr-text
              />
              <p class="text-xs text-ink-3 tabular-nums">
                {{ fill(m.wordsN, { n: wordCount(item.text) }) }} ·
                <span :class="confClass(item.confidence)" data-ocr-conf>{{
                  fill(m.confidence, { n: item.confidence })
                }}</span>
                <template v-if="lowWords(item).length">
                  · {{ fill(m.lowN, { n: lowWords(item).length }) }}</template
                >
              </p>
              <p v-if="!item.text" class="text-sm text-ink-3">{{ m.noText }}</p>
              <div class="flex flex-wrap gap-2">
                <CopyButton :text="item.text" :label="m.copy" :copied-label="m.copied" />
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="!item.text"
                  @click="downloadText(item.text, `${baseName(item.name)}.txt`)"
                >
                  ⬇ .txt
                </button>
              </div>
            </template>
            <ProgressBar
              v-else-if="item.status === 'run'"
              :label="stageLabel(item)"
              :value="item.stage === 'read' ? item.value * 100 : undefined"
            />
            <p v-else-if="item.status === 'wait'" class="text-sm text-ink-3">{{ m.waiting }}</p>
            <p v-else class="error-text">{{ m.failed }}</p>
          </div>
        </div>
      </li>
    </ol>
    <p
      v-if="busy && items.some((i) => i.stage === 'load' && i.status === 'run')"
      class="text-xs text-ink-3"
    >
      {{ m.firstLoad }}
    </p>
  </div>
</template>
