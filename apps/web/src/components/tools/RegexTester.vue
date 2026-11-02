<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce } from '../../lib/download';
import { fill } from '../../lib/format';
import { segmentMatches, type RegexResult } from '../../lib/regex';
import type { RegexRequest, RegexResponse } from '../../workers/regex.worker';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'regex'>;

const TIMEOUT_MS = 1000;
const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;

const pattern = ref('');
const flags = ref<string[]>(['g']);
const text = ref('');
const useReplace = ref(false);
const replacement = ref('');
const result = shallowRef<RegexResult | null>(null);
const error = ref('');
const timedOut = ref(false);

let worker: Worker | undefined;
let lastId = 0;
let timer: number | undefined;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../../workers/regex.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<RegexResponse>) => {
      if (e.data.id !== lastId) return;
      window.clearTimeout(timer);
      if (e.data.ok) {
        result.value = e.data.result;
        error.value = '';
      } else {
        result.value = null;
        error.value = e.data.error;
      }
    };
  }
  return worker;
}

function run() {
  window.clearTimeout(timer);
  timedOut.value = false;
  if (!pattern.value) {
    result.value = null;
    error.value = '';
    return;
  }
  const req: RegexRequest = {
    id: ++lastId,
    pattern: pattern.value,
    flags: flags.value.join(''),
    text: text.value,
    replacement: useReplace.value ? replacement.value : undefined,
  };
  getWorker().postMessage(req);
  // Regex berbahaya (catastrophic backtracking): hentikan worker, buat baru saat dibutuhkan.
  timer = window.setTimeout(() => {
    worker?.terminate();
    worker = undefined;
    result.value = null;
    timedOut.value = true;
  }, TIMEOUT_MS);
}

watch([pattern, flags, text, useReplace, replacement], debounce(run, 150), { deep: true });
onBeforeUnmount(() => worker?.terminate());

const segments = computed(() =>
  result.value ? segmentMatches(text.value, result.value.matches) : [],
);
const shown = computed(() => result.value?.matches.slice(0, 100) ?? []);
</script>

<template>
  <div class="space-y-4">
    <div>
      <label for="rx-pattern" class="label">{{ m.pattern }}</label>
      <div class="field flex items-center gap-1 py-0 font-mono">
        <span class="text-slate-500" aria-hidden="true">/</span>
        <input
          id="rx-pattern"
          v-model="pattern"
          class="min-w-0 flex-1 bg-transparent py-2 focus:outline-none"
          placeholder="(\w+)@(\w+)\.com"
          spellcheck="false"
          autocomplete="off"
        />
        <span class="text-slate-500" aria-hidden="true">/{{ flags.join('') }}</span>
      </div>
      <fieldset class="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <legend class="sr-only">{{ m.flags }}</legend>
        <label v-for="f in FLAGS" :key="f" class="flex items-center gap-1.5 text-sm">
          <input v-model="flags" type="checkbox" :value="f" class="size-4 accent-brand-600" />
          <code class="font-mono font-semibold">{{ f }}</code>
          <span class="text-slate-600 dark:text-slate-400">{{ m[`flag.${f}`] }}</span>
        </label>
      </fieldset>
    </div>

    <div>
      <label for="rx-text" class="label">{{ m.text }}</label>
      <textarea
        id="rx-text"
        v-model="text"
        class="field h-40 font-mono text-sm"
        :placeholder="m.placeholder"
        spellcheck="false"
      />
    </div>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <p v-else-if="timedOut" class="error-text" aria-live="polite">{{ m.timeout }}</p>

    <section v-if="result" class="space-y-3" :aria-label="m.highlight">
      <p class="text-sm font-semibold" aria-live="polite">
        {{ result.matches.length ? fill(m.matches, { n: result.matches.length }) : m.noMatch }}
        <span v-if="result.truncated" class="font-normal text-slate-600 dark:text-slate-400">
          · {{ fill(m.truncated, { n: result.matches.length }) }}
        </span>
      </p>
      <div
        v-if="text"
        class="card max-h-72 overflow-auto font-mono text-sm break-words whitespace-pre-wrap"
      >
        <template v-for="(s, i) in segments" :key="i">
          <mark
            v-if="s.match >= 0"
            class="rounded-sm text-inherit"
            :class="s.match % 2 ? 'bg-sky-200 dark:bg-sky-800' : 'bg-amber-200 dark:bg-amber-700'"
            >{{ s.text }}</mark
          >
          <span v-else>{{ s.text }}</span>
        </template>
      </div>
      <ol v-if="shown.length" class="max-h-72 space-y-1 overflow-auto text-sm">
        <li v-for="(match, i) in shown" :key="i" class="card px-3 py-2">
          <span class="font-semibold">{{ fill(m.match, { n: i + 1 }) }}</span>
          <span class="text-slate-600 dark:text-slate-400"> @{{ match.index }}</span
          >:
          <code class="font-mono break-all">{{ match.text }}</code>
          <ul v-if="match.groups.length" class="mt-1 pl-4 text-xs">
            <li v-for="(g, gi) in match.groups" :key="gi">
              {{ fill(m.group, { n: gi + 1 }) }}:
              <code class="font-mono break-all">{{ g ?? '—' }}</code>
            </li>
            <li v-for="(v, name) in match.named ?? {}" :key="name">
              &lt;{{ name }}&gt;: <code class="font-mono break-all">{{ v ?? '—' }}</code>
            </li>
          </ul>
        </li>
      </ol>
    </section>

    <div class="space-y-2">
      <label class="flex items-center gap-2 text-sm font-medium">
        <input v-model="useReplace" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.replace }}
      </label>
      <template v-if="useReplace">
        <input
          v-model="replacement"
          class="field font-mono text-sm"
          :placeholder="m.replacePlaceholder"
          :aria-label="m.replace"
          spellcheck="false"
        />
        <label for="rx-replaced" class="label">{{ m.replaced }}</label>
        <textarea
          id="rx-replaced"
          :value="result?.replaced ?? ''"
          readonly
          class="field h-32 font-mono text-sm"
        />
      </template>
    </div>
  </div>
</template>
