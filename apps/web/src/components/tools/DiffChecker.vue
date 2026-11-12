<script setup lang="ts">
/**
 * Bandingkan Teks: satu alur untuk dua kebutuhan. Setelah kedua teks diisi, ringkasan kemiripan
 * (deteksi plagiarisme antar dokumen) selalu tampil, lalu pengguna memilih satu tampilan:
 * bagian yang sama, atau perbedaan per baris, kata, atau karakter.
 * Teks bisa ditempel atau diambil dari file (TXT, DOCX, ODT, PDF). Semua berjalan di browser.
 */
import type { ChangeObject } from 'diff';
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { compareTexts, similarityLevel, type SimilarityResult } from '../../lib/similarity';
import { TEXT_ACCEPT } from '../../lib/text-extract';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'diff'>;

type View = 'similar' | 'lines' | 'words' | 'chars';
const VIEWS: View[] = ['similar', 'lines', 'words', 'chars'];
const VIEW_KEY = 'toolland-diff-view';
const view = ref<View>('lines');
function selectView(v: View) {
  view.value = v;
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // Penyimpanan tidak tersedia.
  }
}
onMounted(() => {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    if (v && VIEWS.includes(v)) view.value = v;
  } catch {
    // Abaikan.
  }
});

type Mode = 'lines' | 'words' | 'chars';
const original = ref('');
const changed = ref('');
const mode = ref<Mode>('lines');
const parts = shallowRef<ChangeObject<string>[] | null>(null);
const timedOut = ref(false);

// --- Unggah file -------------------------------------------------------------------------------
type Side = 'a' | 'b';
const fileName = ref<Record<Side, string>>({ a: '', b: '' });
const fileErr = ref<Record<Side, string>>({ a: '', b: '' });
const reading = ref<Record<Side, boolean>>({ a: false, b: false });
const inputs: Partial<Record<Side, HTMLInputElement>> = {};
const dragOver = ref<Side | ''>('');

async function loadFile(side: Side, file: File | undefined) {
  if (!file) return;
  fileErr.value[side] = '';
  reading.value[side] = true;
  try {
    const { extractText } = await import('../../lib/text-extract');
    const text = await extractText(file);
    if (side === 'a') original.value = text;
    else changed.value = text;
    fileName.value[side] = file.name;
  } catch (e) {
    const code = (e as { code?: string }).code ?? 'broken';
    fileErr.value[side] = m[`fileErr_${code}` as 'fileErr_broken'] ?? m.fileErr_broken;
  } finally {
    reading.value[side] = false;
  }
}
function onPick(side: Side, e: Event) {
  const input = e.target as HTMLInputElement;
  void loadFile(side, input.files?.[0]);
  input.value = '';
}
function onDrop(side: Side, e: DragEvent) {
  dragOver.value = '';
  const file = e.dataTransfer?.files?.[0];
  if (file) void loadFile(side, file);
}
function clearSide(side: Side) {
  if (side === 'a') original.value = '';
  else changed.value = '';
  fileName.value[side] = '';
  fileErr.value[side] = '';
}
// Kolom yang diketik ulang bukan lagi isi file aslinya.
watch(original, (v) => {
  if (!v) fileName.value.a = '';
});
watch(changed, (v) => {
  if (!v) fileName.value.b = '';
});

const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

// --- Perbedaan ---------------------------------------------------------------------------------
async function compare() {
  timedOut.value = false;
  if (!original.value && !changed.value) {
    parts.value = null;
    return;
  }
  const d = await import('diff');
  // Mode baris: samakan akhir baris (CRLF dari Windows, enter di akhir teks) agar tidak dianggap
  // perbedaan. Tanpa ini, baris terakhir yang sama tampil sebagai "dihapus" lalu "ditambah".
  const lineEnds = (s: string) => {
    const t = s.replace(/\r\n?/g, '\n');
    return t && !t.endsWith('\n') ? `${t}\n` : t;
  };
  const a = mode.value === 'lines' ? lineEnds(original.value) : original.value;
  const b = mode.value === 'lines' ? lineEnds(changed.value) : changed.value;
  // timeout: hentikan perbandingan yang terlalu berat agar halaman tidak macet
  const opts = { timeout: 2000 };
  const result =
    mode.value === 'lines'
      ? d.diffLines(a, b, opts)
      : mode.value === 'words'
        ? d.diffWordsWithSpace(a, b, opts)
        : d.diffChars(a, b, opts);
  if (!result) {
    timedOut.value = true;
    parts.value = null;
    return;
  }
  parts.value = result;
}

const compareSoon = debounce(() => {
  if (view.value !== 'similar') void compare();
}, 250);
watch([original, changed], compareSoon);
watch(mode, compare);

const counts = computed(() => {
  let added = 0;
  let removed = 0;
  for (const p of parts.value ?? []) {
    if (p.added) added += p.count ?? 0;
    if (p.removed) removed += p.count ?? 0;
  }
  return { added, removed };
});

/** Untuk mode baris: satu entri per baris dengan penanda +, -, atau spasi. */
const lines = computed(() =>
  (parts.value ?? []).flatMap((p) =>
    p.value
      .replace(/\n$/, '')
      .split('\n')
      .map((text) => ({ text, type: p.added ? 'add' : p.removed ? 'del' : 'same' })),
  ),
);

const identical = computed(
  () => parts.value !== null && counts.value.added === 0 && counts.value.removed === 0,
);

// --- Cek kemiripan -----------------------------------------------------------------------------
const K_OPTIONS = [3, 5, 8] as const;
const k = ref<(typeof K_OPTIONS)[number]>(5);
const sim = shallowRef<SimilarityResult | null>(null);
const active = ref<number | null>(null);
const panels: Partial<Record<Side, HTMLDivElement>> = {};

function runSimilarity() {
  active.value = null;
  if (!original.value.trim() || !changed.value.trim()) {
    sim.value = null;
    return;
  }
  sim.value = compareTexts(original.value, changed.value, k.value);
}
// Kemiripan selalu dihitung karena ringkasannya tampil di semua tampilan.
const similaritySoon = debounce(runSimilarity, 300);
watch([original, changed], similaritySoon);
watch(k, runSimilarity);
watch(view, (v) => {
  if (v === 'similar') return;
  if (mode.value === v) void compare();
  else mode.value = v;
});

const level = computed(() => similarityLevel(sim.value?.overall ?? 0));
const LEVEL_STYLE = {
  low: 'text-green-700 dark:text-green-400',
  medium: 'text-amber-700 dark:text-amber-400',
  high: 'text-red-700 dark:text-red-400',
} as const;
const LEVEL_BAR = {
  low: 'fill-green-600 dark:fill-green-500',
  medium: 'fill-amber-500 dark:fill-amber-400',
  high: 'fill-red-600 dark:fill-red-500',
} as const;
const MARKS = [
  'bg-amber-200/80 dark:bg-amber-700/60',
  'bg-sky-200/80 dark:bg-sky-700/60',
  'bg-rose-200/80 dark:bg-rose-700/60',
  'bg-lime-200/80 dark:bg-lime-700/60',
  'bg-violet-200/80 dark:bg-violet-700/60',
  'bg-orange-200/80 dark:bg-orange-700/60',
];
const markClass = (id: number) => MARKS[id % MARKS.length];

const topPassages = computed(() =>
  [...(sim.value?.passages ?? [])].sort((x, y) => y.len - x.len).slice(0, 12),
);
const longest = computed(() => topPassages.value[0]?.len ?? 0);

/** Sorot satu bagian di kedua dokumen dan gulirkan keduanya ke sana. */
function focusPassage(id: number) {
  active.value = id;
  void nextTick(() => {
    for (const panel of [panels.a, panels.b]) {
      const el = panel?.querySelector<HTMLElement>(`[data-sim-id="${id}"]`);
      if (panel && el) panel.scrollTop = el.offsetTop - panel.offsetTop - 40;
    }
  });
}
/** Persen dengan pemisah desimal sesuai bahasa halaman (54,2 / 54.2). */
const num = (n: number) => n.toLocaleString(pageLocale() === 'id' ? 'id-ID' : 'en-US');
const snippet = (s: string) => (s.length > 180 ? `${s.slice(0, 180)}…` : s);
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-ink-2">{{ m.intro }}</p>

    <div class="grid gap-3 md:grid-cols-2">
      <div v-for="side in ['a', 'b'] as const" :key="side">
        <div class="mb-1 flex flex-wrap items-end justify-between gap-2">
          <label :for="`df-${side}`" class="label mb-0">
            {{ side === 'a' ? m.text1 : m.text2 }}
          </label>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="btn btn-secondary px-2.5 py-1 text-xs"
              :disabled="reading[side]"
              :data-df-upload="side"
              @click="inputs[side]?.click()"
            >
              📄 {{ reading[side] ? m.reading : m.upload }}
            </button>
            <button
              v-if="side === 'a' ? original : changed"
              type="button"
              class="btn btn-secondary px-2.5 py-1 text-xs"
              :aria-label="m.clear"
              @click="clearSide(side)"
            >
              ✕
            </button>
          </div>
          <input
            :ref="(el) => (inputs[side] = (el as HTMLInputElement) ?? undefined)"
            type="file"
            class="sr-only"
            tabindex="-1"
            :accept="TEXT_ACCEPT"
            :data-df-file="side"
            @change="onPick(side, $event)"
          />
        </div>
        <textarea
          v-if="side === 'a'"
          id="df-a"
          v-model="original"
          class="field h-48 font-mono text-sm sm:h-64"
          :class="{ 'ring-2 ring-brand-600 dark:ring-brand-400': dragOver === 'a' }"
          :placeholder="m.placeholderOriginal"
          spellcheck="false"
          @dragover.prevent="dragOver = 'a'"
          @dragleave="dragOver = ''"
          @drop.prevent="onDrop('a', $event)"
        />
        <textarea
          v-else
          id="df-b"
          v-model="changed"
          class="field h-48 font-mono text-sm sm:h-64"
          :class="{ 'ring-2 ring-brand-600 dark:ring-brand-400': dragOver === 'b' }"
          :placeholder="m.placeholderChanged"
          spellcheck="false"
          @dragover.prevent="dragOver = 'b'"
          @dragleave="dragOver = ''"
          @drop.prevent="onDrop('b', $event)"
        />
        <p v-if="fileErr[side]" class="error-text mt-1" role="alert">{{ fileErr[side] }}</p>
        <p v-else class="mt-1 text-xs text-ink-3 tabular-nums" :data-df-meta="side">
          <template v-if="fileName[side]">📎 {{ fileName[side] }} · </template>
          {{ fill(m.wordsN, { n: wordCount(side === 'a' ? original : changed) }) }}
        </p>
      </div>
    </div>
    <p class="text-xs text-ink-3">{{ m.uploadHint }}</p>

    <!-- Ringkasan: selalu tampil bila kedua teks terisi -->
    <div
      v-if="sim"
      class="grid items-center gap-4 rounded-md border border-ink bg-paper-2 p-4 sm:grid-cols-[auto_1fr]"
      data-sim-summary
    >
      <div class="text-center sm:px-4">
        <p class="text-xs font-semibold tracking-wider text-ink-3 uppercase">
          {{ m.simOverall }}
        </p>
        <p
          class="font-display text-5xl leading-none tabular-nums"
          :class="LEVEL_STYLE[level]"
          data-sim-overall
        >
          {{ num(sim.overall) }}<span class="text-2xl">%</span>
        </p>
        <p class="mt-1 text-sm font-bold" :class="LEVEL_STYLE[level]" data-sim-level>
          {{ m[`level_${level}`] }}
        </p>
      </div>
      <div class="space-y-2.5">
        <div v-for="row in ['a', 'b'] as const" :key="row">
          <p class="flex justify-between gap-3 text-sm">
            <span>{{ row === 'a' ? m.coverA : m.coverB }}</span>
            <b class="tabular-nums" :data-sim-cover="row"
              >{{ num(row === 'a' ? sim.coverA : sim.coverB) }}%</b
            >
          </p>
          <svg
            viewBox="0 0 100 4"
            preserveAspectRatio="none"
            class="mt-1 h-2 w-full"
            aria-hidden="true"
          >
            <rect width="100" height="4" rx="2" class="fill-ink/10" />
            <rect
              :width="row === 'a' ? sim.coverA : sim.coverB"
              height="4"
              rx="2"
              :class="LEVEL_BAR[level]"
            />
          </svg>
        </div>
        <p class="text-xs text-ink-3 tabular-nums">
          {{ fill(m.passagesN, { n: sim.passages.length }) }}
          <template v-if="longest"> · {{ fill(m.longest, { n: longest }) }}</template>
          · {{ fill(m.wordsBoth, { a: sim.wordsA, b: sim.wordsB }) }}
        </p>
      </div>
    </div>

    <!-- Satu pilihan tampilan untuk semua hasil -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <fieldset class="flex flex-wrap items-center gap-2">
        <legend class="sr-only">{{ m.view }}</legend>
        <span class="text-sm font-medium">{{ m.view }}</span>
        <button
          v-for="opt in VIEWS"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': view === opt }"
          :aria-pressed="view === opt"
          :data-df-view="opt"
          @click="selectView(opt)"
        >
          {{ m[`view_${opt}`] }}
        </button>
      </fieldset>
      <p
        v-if="view !== 'similar' && parts && !identical"
        class="text-sm font-semibold"
        aria-live="polite"
      >
        <span class="text-green-700 dark:text-green-400">{{
          fill(m.added, { n: counts.added })
        }}</span>
        ·
        <span class="text-red-700 dark:text-red-400">{{
          fill(m.removed, { n: counts.removed })
        }}</span>
      </p>
    </div>

    <!-- Bagian yang sama -->
    <section v-if="view === 'similar'" :aria-label="m.simResult" class="space-y-4" data-sim-result>
      <p v-if="!sim" class="text-sm text-ink-3">{{ m.simEmpty }}</p>
      <template v-else>
        <fieldset class="flex flex-wrap items-center gap-2">
          <legend class="sr-only">{{ m.sensitivity }}</legend>
          <span class="text-xs font-medium text-ink-2">{{ m.sensitivity }}</span>
          <button
            v-for="opt in K_OPTIONS"
            :key="opt"
            type="button"
            class="btn btn-secondary px-2.5 py-1 text-xs"
            :class="{ 'btn-active': k === opt }"
            :aria-pressed="k === opt"
            :data-sim-k="opt"
            @click="k = opt"
          >
            {{ m[`sens${opt}` as 'sens5'] }}
          </button>
        </fieldset>

        <p v-if="!sim.passages.length" class="text-sm text-ink-3">{{ m.noMatch }}</p>
        <template v-else>
          <p class="text-xs text-ink-3">{{ m.clickHint }}</p>
          <div class="grid gap-3 md:grid-cols-2">
            <div v-for="side in ['a', 'b'] as const" :key="side">
              <p class="label">{{ side === 'a' ? m.text1 : m.text2 }}</p>
              <div
                :ref="(el) => (panels[side] = (el as HTMLDivElement) ?? undefined)"
                class="card relative max-h-96 overflow-y-auto text-sm leading-relaxed break-words whitespace-pre-wrap"
                :data-sim-panel="side"
              >
                <template v-for="(s, i) in side === 'a' ? sim.segA : sim.segB" :key="i">
                  <mark
                    v-if="s.id !== null"
                    class="cursor-pointer rounded-sm text-inherit"
                    :class="[
                      markClass(s.id),
                      active === s.id ? 'ring-2 ring-ink dark:ring-white' : '',
                    ]"
                    :data-sim-id="s.id"
                    @click="focusPassage(s.id)"
                    >{{ s.text }}</mark
                  ><template v-else>{{ s.text }}</template>
                </template>
              </div>
            </div>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold">{{ m.passagesTitle }}</h3>
            <ol class="space-y-1.5">
              <li v-for="p in topPassages" :key="p.id">
                <button
                  type="button"
                  class="flex w-full gap-3 rounded-md border border-rule bg-paper-2 p-2.5 text-left text-sm hover:border-ink-3"
                  :class="{ 'border-ink': active === p.id }"
                  data-sim-passage
                  @click="focusPassage(p.id)"
                >
                  <span
                    class="h-auto w-1.5 shrink-0 rounded-full"
                    :class="markClass(p.id)"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 flex-1">{{ snippet(p.text) }}</span>
                  <span class="shrink-0 text-xs text-ink-3 tabular-nums">{{
                    fill(m.wordsN, { n: p.len })
                  }}</span>
                </button>
              </li>
            </ol>
          </div>
        </template>
        <p class="rounded-md border border-rule bg-paper-2 p-3 text-xs text-ink-3">
          {{ m.simNote }}
        </p>
      </template>
    </section>

    <!-- Perbedaan -->
    <section v-else :aria-label="m.result">
      <p v-if="timedOut" class="error-text">{{ m.timeout }}</p>
      <p v-else-if="!parts" class="text-sm text-slate-600 dark:text-slate-400">{{ m.empty }}</p>
      <p v-else-if="identical" class="text-sm font-semibold text-brand-700 dark:text-brand-300">
        {{ m.identical }}
      </p>

      <div v-else-if="mode === 'lines'" class="card overflow-x-auto p-0 font-mono text-sm">
        <div
          v-for="(line, i) in lines"
          :key="i"
          class="flex whitespace-pre-wrap"
          :class="{
            'bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200':
              line.type === 'add',
            'bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200': line.type === 'del',
          }"
        >
          <span class="w-6 shrink-0 text-center select-none" aria-hidden="true">{{
            line.type === 'add' ? '+' : line.type === 'del' ? '−' : ' '
          }}</span>
          <span class="min-w-0 flex-1 px-1 break-words">{{ line.text || ' ' }}</span>
        </div>
      </div>

      <div v-else class="card font-mono text-sm break-words whitespace-pre-wrap">
        <template v-for="(p, i) in parts" :key="i">
          <ins
            v-if="p.added"
            class="bg-green-100 text-green-900 no-underline dark:bg-green-900/60 dark:text-green-100"
            >{{ p.value }}</ins
          >
          <del
            v-else-if="p.removed"
            class="bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100"
            >{{ p.value }}</del
          >
          <span v-else>{{ p.value }}</span>
        </template>
      </div>
    </section>
  </div>
</template>
