<script setup lang="ts">
import type { ChangeObject } from 'diff';
import { computed, ref, shallowRef, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill } from '../../lib/format';
import { debounce } from '../../lib/download';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'diff'>;

type Mode = 'lines' | 'words' | 'chars';
const original = ref('');
const changed = ref('');
const mode = ref<Mode>('lines');
const parts = shallowRef<ChangeObject<string>[] | null>(null);
const timedOut = ref(false);

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

const compareSoon = debounce(compare, 250);
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
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <label for="df-a" class="label">{{ m.original }}</label>
        <textarea
          id="df-a"
          v-model="original"
          class="field h-48 font-mono text-sm sm:h-64"
          :placeholder="m.placeholderOriginal"
          spellcheck="false"
        />
      </div>
      <div>
        <label for="df-b" class="label">{{ m.changed }}</label>
        <textarea
          id="df-b"
          v-model="changed"
          class="field h-48 font-mono text-sm sm:h-64"
          :placeholder="m.placeholderChanged"
          spellcheck="false"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <fieldset class="flex flex-wrap items-center gap-2">
        <legend class="sr-only">{{ m.mode }}</legend>
        <span class="text-sm font-medium">{{ m.mode }}</span>
        <button
          v-for="opt in ['lines', 'words', 'chars'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': mode === opt }"
          :aria-pressed="mode === opt"
          @click="mode = opt"
        >
          {{ m[opt] }}
        </button>
      </fieldset>
      <p v-if="parts && !identical" class="text-sm font-semibold" aria-live="polite">
        <span class="text-green-700 dark:text-green-400">{{
          fill(m.added, { n: counts.added })
        }}</span>
        ·
        <span class="text-red-700 dark:text-red-400">{{
          fill(m.removed, { n: counts.removed })
        }}</span>
      </p>
    </div>

    <section :aria-label="m.result">
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
