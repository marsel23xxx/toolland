<script setup lang="ts">
/**
 * Form template dokumen (surat dan CV) dengan pratinjau langsung. Pratinjau adalah PDF yang sama
 * dengan hasil unduhan, dirender dengan pdf.js. Isian disimpan di localStorage browser ini saja.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconDownload from '~icons/lucide/download';
import IconFileText from '~icons/lucide/file-text';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash-2';
import type { Messages } from '../../i18n';
import type {
  DocAssets,
  DocField,
  DocForm,
  DocItem,
  DocModule,
  DocRepeat,
  DocValues,
} from '../../lib/docs/form';
import { safeFileName } from '../../lib/docs/form';
import { downloadBlob } from '../../lib/download';
import { fill } from '../../lib/format';

const props = defineProps<{ form: DocForm; m: Record<string, string> }>();
const m = props.m as Messages<'docForm'>;
const f = props.form;

const LOADERS: Record<string, () => Promise<DocModule>> = {
  lamaran: () => import('../../lib/templates/surat-lamaran'),
  resign: () => import('../../lib/templates/surat-resign'),
  'cv-ats': () => import('../../lib/templates/cv-ats'),
  'cv-pro': () => import('../../lib/templates/cv-profesional'),
  kuasa: () => import('../../lib/templates/surat-kuasa'),
  pernyataan: () => import('../../lib/templates/surat-pernyataan'),
  izin: () => import('../../lib/templates/surat-izin'),
  keterangan: () => import('../../lib/templates/surat-keterangan-kerja'),
  kwitansi: () => import('../../lib/templates/kwitansi'),
};
/** Template yang sebaiknya muat satu halaman (peringatan bila lebih). */
const LETTERS = new Set([
  'lamaran',
  'resign',
  'kuasa',
  'pernyataan',
  'izin',
  'keterangan',
  'kwitansi',
]);
/** Field pengaturan yang tidak ikut dikosongkan. */
const SETTINGS = new Set([
  'style',
  'lang',
  'font',
  'align',
  'accent',
  'atsAccent',
  'photoShape',
  'type',
  'paper',
  'meterai',
]);
const STORE_KEY = `toolland-doc:${f.storage}`;

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const isRepeat = (x: DocField | DocRepeat): x is DocRepeat => x.kind === 'repeat';
const allFields = f.sections.flatMap((s) => s.items);

function load(): DocValues {
  const base = clone(f.sample);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && typeof saved === 'object')
      for (const [k, v] of Object.entries(saved))
        if (typeof v === 'string' || Array.isArray(v)) base[k] = v as DocValues[string];
  } catch {
    // Penyimpanan tidak tersedia (mode privat) atau rusak: pakai contoh.
  }
  return base;
}

const values = reactive<DocValues>(clone(f.sample));
/** Akses field teks biasa untuk v-model (field berulang memakai list()). */
const sv = values as Record<string, string>;
const str = (k: string) => (typeof values[k] === 'string' ? (values[k] as string) : '');
const list = (k: string) => (Array.isArray(values[k]) ? (values[k] as DocItem[]) : []);

const busy = ref<'' | 'pdf' | 'docx'>('');
const status = ref('');
const error = ref('');
const pages = ref(0);
const rendering = ref(false);
const previewError = ref(false);
const imageError = ref('');
const pagesEl = ref<HTMLDivElement>();
const ready = ref(false);

// --- Bahasa: ganti teks contoh bila belum diubah ------------------------------------------------
watch(
  () => values.lang,
  (now, before) => {
    if (!f.langText || !ready.value || now === before) return;
    const from = f.langText[before as 'id' | 'en'];
    const to = f.langText[now as 'id' | 'en'];
    if (!from || !to) return;
    for (const [k, txt] of Object.entries(to)) if (str(k) === from[k] || !str(k)) values[k] = txt;
  },
);

// --- Preset jenis: isi ulang field yang belum diubah pengguna -------------------------------------
if (f.presets) {
  const { key, fill: presetFill } = f.presets;
  const known = (k: string) =>
    new Set(['', ...Object.values(presetFill).map((x) => x[k] ?? '')].map((x) => x.trim()));
  watch(
    () => values[key],
    (now) => {
      if (!ready.value) return;
      for (const [k, txt] of Object.entries(presetFill[now as string] ?? {}))
        if (known(k).has(str(k).trim())) values[k] = txt;
    },
  );
}

// --- Item berulang --------------------------------------------------------------------------
function addItem(r: DocRepeat) {
  const arr = list(r.key).slice();
  if (arr.length >= r.max) return;
  arr.push(Object.fromEntries(r.fields.map((x) => [x.key, ''])));
  values[r.key] = arr;
  openItems.add(`${r.key}:${arr.length - 1}`);
}
function removeItem(r: DocRepeat, i: number) {
  values[r.key] = list(r.key).filter((_, j) => j !== i);
}
function moveItem(r: DocRepeat, i: number, d: number) {
  const arr = list(r.key).slice();
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  values[r.key] = arr;
}
const openItems = reactive(new Set<string>());
function toggleItem(key: string) {
  if (openItems.has(key)) openItems.delete(key);
  else openItems.add(key);
}

// --- Gambar ---------------------------------------------------------------------------------
async function pickImage(x: DocField, e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  imageError.value = '';
  try {
    const { processPhoto, processSignature } = await import('../../lib/docs/images');
    // Logo dan tanda tangan sama-sama dipertahankan transparan (PNG).
    values[x.key] = x.image === 'photo' ? await processPhoto(file) : await processSignature(file);
  } catch {
    imageError.value = x.key;
  }
}

async function collectAssets(): Promise<DocAssets> {
  const { toAsset } = await import('../../lib/docs/images');
  const out: DocAssets = {};
  for (const x of allFields) {
    if (isRepeat(x) || x.kind !== 'image') continue;
    const url = str(x.key);
    if (!url) continue;
    const a = await toAsset(url);
    if (a) out[x.key] = a;
    if (x.image === 'photo') {
      const c = await toAsset(url, true);
      if (c) out[`${x.key}:circle`] = c;
    }
  }
  return out;
}

// --- Buat dokumen ---------------------------------------------------------------------------
async function buildSpec() {
  const mod = await LOADERS[f.template]();
  return mod.buildDoc(clone(values), await collectAssets());
}

const fileBase = computed(() => safeFileName(f.fileBase, str(f.fileKey)) || f.fileBase);

async function download(kind: 'pdf' | 'docx') {
  busy.value = kind;
  status.value = '';
  error.value = '';
  try {
    const spec = await buildSpec();
    const name = `${fileBase.value}.${kind}`;
    if (kind === 'pdf') {
      const { renderPdf } = await import('../../lib/docs/pdf');
      const { bytes } = await renderPdf(spec);
      downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), name);
    } else {
      const { renderDocx, DOCX_MIME } = await import('../../lib/docs/docx');
      downloadBlob(new Blob([new Uint8Array(renderDocx(spec))], { type: DOCX_MIME }), name);
    }
    status.value = fill(m.done, { file: name });
  } catch (e) {
    console.error(e);
    error.value = m.error;
  } finally {
    busy.value = '';
  }
}

// --- Pratinjau ------------------------------------------------------------------------------
let version = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function renderPreview() {
  const v = ++version;
  rendering.value = true;
  try {
    const [{ renderPdf }, pdf] = await Promise.all([
      import('../../lib/docs/pdf'),
      import('../../lib/pdf/render'),
    ]);
    const { bytes, pages: n } = await renderPdf(await buildSpec());
    if (v !== version) return;
    const doc = await pdf.openPdf(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    const el = pagesEl.value;
    const width = Math.max(280, el?.clientWidth ?? 600);
    const scale = (width / 595.28) * Math.min(2, window.devicePixelRatio || 1);
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= doc.numPages; i++) canvases.push(await pdf.renderPage(doc, i, scale));
    await pdf.closePdf(doc);
    if (v !== version || !el) return;
    canvases.forEach((c, i) => {
      c.className = 'block h-auto w-full bg-white shadow-sm ring-1 ring-black/10';
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', fill(m.pageLabel, { n: i + 1 }));
    });
    el.replaceChildren(...canvases);
    pages.value = n;
    previewError.value = false;
  } catch (e) {
    console.error(e);
    if (v === version) previewError.value = true;
  } finally {
    if (v === version) rendering.value = false;
  }
}

watch(
  values,
  () => {
    if (!ready.value) return;
    clearTimeout(timer);
    timer = setTimeout(renderPreview, 350);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(values));
      } catch {
        // Kuota penuh atau mode privat: isian tetap dipakai, hanya tidak tersimpan.
      }
    }, 500);
  },
  { deep: true },
);

let resizeObs: ResizeObserver | undefined;
let lastWidth = 0;
onMounted(() => {
  Object.assign(values, load());
  ready.value = true;
  renderPreview();
  if (pagesEl.value && 'ResizeObserver' in window) {
    resizeObs = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      if (lastWidth && Math.abs(w - lastWidth) > 40) {
        clearTimeout(timer);
        timer = setTimeout(renderPreview, 250);
      }
      lastWidth = w;
    });
    resizeObs.observe(pagesEl.value);
  }
});
onBeforeUnmount(() => {
  resizeObs?.disconnect();
  clearTimeout(timer);
  clearTimeout(saveTimer);
});

function useSample() {
  Object.assign(values, clone(f.sample));
}
function clearAll() {
  for (const x of allFields) {
    if (isRepeat(x)) values[x.key] = [];
    else if (!SETTINGS.has(x.key)) values[x.key] = '';
  }
}
function forget() {
  if (!confirm(m.confirmForget)) return;
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Abaikan.
  }
  useSample();
}

/**
 * Warna bulatan swatch diset lewat CSSOM setelah mount: atribut style di HTML hasil SSR diblokir
 * CSP (style-src-attr), sedangkan el.style dari JavaScript diizinkan.
 */
const vBg = {
  mounted: (el: HTMLElement, b: { value: string }) => (el.style.background = `#${b.value}`),
  updated: (el: HTMLElement, b: { value: string }) => (el.style.background = `#${b.value}`),
};

const longLetter = computed(() => LETTERS.has(f.template) && pages.value > 1);
const itemTitle = (r: DocRepeat, it: DocItem) => it[r.title]?.trim() || m.untitled;
const span = (x: DocField) => (x.span === 2 ? 'sm:col-span-2' : '');
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <form class="min-w-0 space-y-4" @submit.prevent="download('pdf')">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          class="btn btn-secondary px-2.5 py-1.5"
          data-doc-sample
          @click="useSample"
        >
          {{ m.sample }}
        </button>
        <button
          type="button"
          class="btn btn-secondary px-2.5 py-1.5"
          data-doc-clear
          @click="clearAll"
        >
          {{ m.clear }}
        </button>
      </div>

      <details
        v-for="(s, si) in f.sections"
        :key="s.id"
        class="group rounded-md border border-rule bg-paper"
        :open="si < 3"
        :data-doc-section="s.id"
      >
        <summary
          class="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden"
        >
          {{ s.title }}
          <span
            class="font-display text-xl leading-none text-brand-600 transition-transform group-open:rotate-45 dark:text-brand-400"
            aria-hidden="true"
            >+</span
          >
        </summary>
        <div class="space-y-4 border-t border-rule px-4 pt-4 pb-5">
          <template v-for="x in s.items" :key="x.key">
            <!-- Item berulang: pengalaman, pendidikan, dst. -->
            <div v-if="isRepeat(x)" class="space-y-3" :data-doc-repeat="x.key">
              <p v-if="x.hint" class="text-sm text-ink-3">{{ x.hint }}</p>
              <div
                v-for="(it, i) in list(x.key)"
                :key="i"
                class="rounded-md border border-rule bg-paper-2"
              >
                <div class="flex items-center gap-1 px-3 py-2">
                  <button
                    type="button"
                    class="min-w-0 flex-1 truncate text-left font-medium"
                    :aria-expanded="openItems.has(`${x.key}:${i}`)"
                    @click="toggleItem(`${x.key}:${i}`)"
                  >
                    {{ itemTitle(x, it) }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-paper disabled:opacity-30"
                    :aria-label="m.up"
                    :disabled="i === 0"
                    @click="moveItem(x, i, -1)"
                  >
                    <IconArrowUp class="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-paper disabled:opacity-30"
                    :aria-label="m.down"
                    :disabled="i === list(x.key).length - 1"
                    @click="moveItem(x, i, 1)"
                  >
                    <IconArrowDown class="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-ink-2 hover:bg-paper disabled:opacity-30"
                    :aria-label="m.remove"
                    @click="removeItem(x, i)"
                  >
                    <IconTrash class="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div
                  v-if="openItems.has(`${x.key}:${i}`)"
                  class="grid gap-3 border-t border-rule p-3 sm:grid-cols-2"
                >
                  <div v-for="sf in x.fields" :key="sf.key" :class="span(sf)">
                    <label :for="`df-${x.key}-${i}-${sf.key}`" class="label">{{ sf.label }}</label>
                    <textarea
                      v-if="sf.kind === 'textarea'"
                      :id="`df-${x.key}-${i}-${sf.key}`"
                      v-model="it[sf.key]"
                      :rows="sf.rows ?? 3"
                      class="field text-sm"
                    />
                    <input
                      v-else
                      :id="`df-${x.key}-${i}-${sf.key}`"
                      v-model="it[sf.key]"
                      :type="sf.kind === 'month' ? 'month' : 'text'"
                      :maxlength="sf.max"
                      :placeholder="sf.placeholder"
                      class="field"
                    />
                    <p v-if="sf.hint" class="mt-1 text-xs text-ink-3">{{ sf.hint }}</p>
                  </div>
                </div>
              </div>
              <button
                v-if="list(x.key).length < x.max"
                type="button"
                class="btn btn-secondary px-2.5 py-1.5"
                :data-doc-add="x.key"
                @click="addItem(x)"
              >
                <IconPlus class="size-4" aria-hidden="true" />
                {{ x.add }}
              </button>
            </div>
          </template>

          <div v-if="s.items.some((x) => !isRepeat(x))" class="grid gap-4 sm:grid-cols-2">
            <template v-for="x in s.items" :key="x.key">
              <div v-if="!isRepeat(x)" :class="span(x)">
                <label
                  v-if="x.kind !== 'swatch' && x.kind !== 'image'"
                  :for="`df-${x.key}`"
                  class="label"
                  >{{ x.label }}</label
                >
                <select
                  v-if="x.kind === 'select'"
                  :id="`df-${x.key}`"
                  v-model="sv[x.key]"
                  class="field"
                >
                  <option v-for="o in x.options" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
                <textarea
                  v-else-if="x.kind === 'textarea'"
                  :id="`df-${x.key}`"
                  v-model="sv[x.key]"
                  :rows="x.rows ?? 3"
                  :maxlength="x.max"
                  class="field text-sm leading-relaxed"
                />
                <fieldset v-else-if="x.kind === 'swatch'">
                  <legend class="label">{{ x.label }}</legend>
                  <div class="flex flex-wrap gap-2">
                    <label
                      v-for="o in x.options"
                      :key="o.value"
                      class="flex cursor-pointer items-center gap-2 rounded-full border px-2 py-1 text-sm"
                      :class="values[x.key] === o.value ? 'border-ink' : 'border-rule'"
                    >
                      <input
                        v-model="sv[x.key]"
                        type="radio"
                        :name="`df-${x.key}`"
                        :value="o.value"
                        class="sr-only"
                      />
                      <span
                        v-bg="o.value"
                        class="size-4 rounded-full ring-1 ring-black/10"
                        aria-hidden="true"
                      />
                      {{ o.label }}
                    </label>
                  </div>
                </fieldset>
                <div v-else-if="x.kind === 'image'">
                  <p class="label">{{ x.label }}</p>
                  <div class="flex flex-wrap items-center gap-3">
                    <img
                      v-if="str(x.key)"
                      :src="str(x.key)"
                      alt=""
                      class="h-16 rounded border border-rule bg-white object-contain"
                      :class="x.image === 'photo' ? 'w-16 object-cover' : 'max-w-40'"
                    />
                    <label class="btn btn-secondary px-2.5 py-1.5 cursor-pointer">
                      {{ m.upload }}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        class="sr-only"
                        :data-doc-image="x.key"
                        @change="pickImage(x, $event)"
                      />
                    </label>
                    <button
                      v-if="str(x.key)"
                      type="button"
                      class="btn btn-secondary px-2.5 py-1.5"
                      @click="values[x.key] = ''"
                    >
                      {{ m.removeImage }}
                    </button>
                  </div>
                  <p v-if="imageError === x.key" role="alert" class="error-text mt-1">
                    {{ m.imageError }}
                  </p>
                </div>
                <input
                  v-else
                  :id="`df-${x.key}`"
                  v-model="sv[x.key]"
                  :type="x.kind === 'date' ? 'date' : x.kind === 'month' ? 'month' : 'text'"
                  :maxlength="x.max"
                  :placeholder="x.placeholder"
                  class="field"
                />
                <p v-if="x.hint" class="mt-1 text-xs text-ink-3">{{ x.hint }}</p>
                <a
                  v-if="x.link"
                  :href="x.link.href"
                  target="_blank"
                  class="mt-1 inline-block text-xs font-semibold text-brand-700 underline dark:text-brand-300"
                  >{{ x.link.label }} ↗</a
                >
              </div>
            </template>
          </div>
        </div>
      </details>

      <p class="text-sm text-ink-3">
        {{ m.saved }}
        <span v-if="f.storage === 'cv'">{{ m.sharedCv }}</span>
        <button type="button" class="underline hover:text-ink" @click="forget">
          {{ m.forget }}
        </button>
      </p>
    </form>

    <aside class="min-w-0 lg:sticky lg:top-20 lg:self-start" :aria-label="m.preview">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p class="flex items-center gap-2 font-semibold">
          <IconFileText class="size-4 text-brand-600" aria-hidden="true" />
          {{ m.preview }}
          <span v-if="pages" class="eyebrow" data-doc-pages>{{ fill(m.pages, { n: pages }) }}</span>
          <span v-if="rendering" class="text-xs font-normal text-ink-3">{{ m.rendering }}</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-primary"
          data-doc-pdf
          :disabled="!!busy"
          @click="download('pdf')"
        >
          <IconDownload aria-hidden="true" />
          {{ busy === 'pdf' ? m.building : m.pdf }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-doc-docx
          :disabled="!!busy"
          @click="download('docx')"
        >
          <IconDownload aria-hidden="true" />
          {{ busy === 'docx' ? m.building : m.word }}
        </button>
      </div>
      <p
        v-if="status"
        role="status"
        class="mt-2 text-sm font-medium text-brand-700 dark:text-brand-300"
      >
        {{ status }}
      </p>
      <p v-if="error" role="alert" class="error-text mt-2">{{ error }}</p>
      <p
        v-if="longLetter"
        class="mt-3 rounded-md border border-kunyit bg-kunyit/10 p-3 text-sm"
        data-doc-long
      >
        {{ m.longLetter }}
      </p>
      <p v-if="previewError" role="alert" class="error-text mt-3">{{ m.previewError }}</p>
      <div
        ref="pagesEl"
        class="mt-4 space-y-4 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pr-1"
        data-doc-preview
      >
        <div class="aspect-[210/297] w-full animate-pulse rounded bg-paper" aria-hidden="true" />
      </div>
    </aside>
  </div>
</template>
