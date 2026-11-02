<script setup lang="ts">
import { proxy, wrap, type Remote } from 'comlink';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce } from '../../lib/download';
import { fill, formatBytes } from '../../lib/format';
import { ALGORITHMS, findMatch, hashText, type HashResult } from '../../lib/hash';
import type { HashWorker } from '../../workers/hash.worker';
import CopyButton from '../ui/CopyButton.vue';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';
import ProgressBar from '../ui/ProgressBar.vue';

const props = defineProps<{ m: Record<string, string>; dropzone: DropzoneMessages }>();
const m = props.m as ToolMessages<'hash'>;

const tab = ref<'text' | 'file'>('text');
const uppercase = ref(false);
const compare = ref('');

// --- Teks ---
const text = ref('');
const textResult = ref<HashResult | null>(null);
let textRun = 0;
const updateText = debounce(async (t: string) => {
  const run = ++textRun;
  const r = await hashText(t);
  if (run === textRun) textResult.value = r;
}, 150);
watch(text, (t) => updateText(t), { immediate: false });

// --- File (di Web Worker, satu worker dipakai ulang untuk semua file) ---
interface FileItem {
  id: number;
  name: string;
  size: number;
  done: number;
  result?: HashResult;
}
const files = ref<FileItem[]>([]);
let worker: Worker | undefined;
let api: Remote<HashWorker> | undefined;
let nextId = 0;
const busy = ref(false);
let queue: { item: FileItem; file: File }[] = [];

function getApi() {
  if (!api) {
    worker = new Worker(new URL('../../workers/hash.worker.ts', import.meta.url), {
      type: 'module',
    });
    api = wrap<HashWorker>(worker);
  }
  return api;
}

function prefetch() {
  getApi();
}

async function addFiles(list: File[]) {
  for (const file of list) {
    const item: FileItem = { id: nextId++, name: file.name, size: file.size, done: 0 };
    files.value.push(item);
    queue.push({ item: files.value[files.value.length - 1], file });
  }
  if (busy.value) return;
  busy.value = true;
  while (queue.length) {
    const { item, file } = queue.shift()!;
    try {
      item.result = await getApi().hashFile(
        file,
        proxy((bytes: number) => (item.done = bytes)),
      );
    } catch {
      break; // dibatalkan
    }
  }
  busy.value = false;
}

function cancel() {
  worker?.terminate();
  worker = undefined;
  api = undefined;
  queue = [];
  files.value = files.value.filter((f) => f.result);
  busy.value = false;
}

onBeforeUnmount(() => worker?.terminate());

const show = (h: string) => (uppercase.value ? h.toUpperCase() : h);

const match = computed(() => {
  if (!compare.value.trim()) return null;
  const results = tab.value === 'text' ? [textResult.value] : files.value.map((f) => f.result);
  for (const r of results) {
    const algo = r && findMatch(r, compare.value);
    if (algo) return algo;
  }
  return '';
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex gap-2" role="group">
        <button
          v-for="opt in ['text', 'file'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': tab === opt }"
          :aria-pressed="tab === opt"
          @click="tab = opt"
        >
          {{ m[opt] }}
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="uppercase" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.uppercase }}
      </label>
    </div>

    <div v-if="tab === 'text'" class="space-y-3">
      <label for="hs-text" class="sr-only">{{ m.text }}</label>
      <textarea
        id="hs-text"
        v-model="text"
        class="field h-40"
        :placeholder="m.placeholder"
        spellcheck="false"
      />
      <dl v-if="textResult && text" class="space-y-2">
        <div
          v-for="algo in ALGORITHMS"
          :key="algo"
          class="card flex flex-wrap items-center gap-2 px-3 py-2"
        >
          <dt class="w-20 shrink-0 text-sm font-semibold">{{ algo }}</dt>
          <dd class="min-w-0 flex-1 font-mono text-sm break-all">{{ show(textResult[algo]) }}</dd>
          <CopyButton :text="show(textResult[algo])" :label="m.copy" :copied-label="m.copied" />
        </div>
      </dl>
    </div>

    <div v-else class="space-y-3">
      <Dropzone :messages="dropzone" @files="addFiles" @prefetch="prefetch" />
      <ul class="space-y-3">
        <li v-for="f in files" :key="f.id" class="card space-y-2">
          <ProgressBar
            v-if="!f.result"
            :label="f.name"
            :value="f.size ? (f.done / f.size) * 100 : undefined"
            :detail="formatBytes(f.size)"
          />
          <template v-else>
            <p class="truncate text-sm font-semibold">
              {{ f.name }}
              <span class="font-normal text-slate-600 dark:text-slate-400"
                >· {{ formatBytes(f.size) }}</span
              >
            </p>
            <dl class="space-y-1">
              <div v-for="algo in ALGORITHMS" :key="algo" class="flex flex-wrap items-center gap-2">
                <dt class="w-20 shrink-0 text-xs font-semibold">{{ algo }}</dt>
                <dd class="min-w-0 flex-1 font-mono text-xs break-all">
                  {{ show(f.result[algo]) }}
                </dd>
                <CopyButton :text="show(f.result[algo])" :label="m.copy" :copied-label="m.copied" />
              </div>
            </dl>
          </template>
        </li>
      </ul>
      <button v-if="busy" type="button" class="btn btn-secondary" @click="cancel">
        {{ m.cancel }}
      </button>
    </div>

    <div>
      <label for="hs-cmp" class="label">{{ m.compare }}</label>
      <input
        id="hs-cmp"
        v-model="compare"
        class="field font-mono text-sm"
        :placeholder="m.comparePlaceholder"
        spellcheck="false"
      />
      <p v-if="match !== null" aria-live="polite" class="mt-1 text-sm font-semibold">
        <span v-if="match" class="text-brand-700 dark:text-brand-300"
          >✓ {{ fill(m.match, { algo: match }) }}</span
        >
        <span v-else class="error-text">{{ m.noMatch }}</span>
      </p>
    </div>
  </div>
</template>
