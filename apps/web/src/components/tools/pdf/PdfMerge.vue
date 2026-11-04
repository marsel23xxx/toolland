<script setup lang="ts">
import { computed, ref } from 'vue';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import { useFileResults } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  t: Messages<'pdf'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

interface Entry {
  id: number;
  file: File;
  pages?: number;
  error?: string;
}
const entries = ref<Entry[]>([]);
const busy = ref(false);
const error = ref('');
const results = useFileResults();
let nextId = 0;

const errorText = (e: unknown) => props.t[`error.${pdfErrorCode(e)}`];

async function add(list: File[]) {
  const api = await pdfWorker();
  for (const file of list) {
    entries.value.push({ id: nextId++, file });
    const entry = entries.value[entries.value.length - 1];
    try {
      entry.pages = await api.pageCount(await file.arrayBuffer());
    } catch (e) {
      entry.error = errorText(e);
    }
  }
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= entries.value.length) return;
  const list = [...entries.value];
  [list[i], list[j]] = [list[j], list[i]];
  entries.value = list;
}

const valid = computed(() => entries.value.filter((e) => e.pages && !e.error));
const totalPages = computed(() => valid.value.reduce((s, e) => s + (e.pages ?? 0), 0));

async function run() {
  if (valid.value.length < 2) {
    error.value = props.t['merge.needTwo'];
    return;
  }
  error.value = '';
  busy.value = true;
  results.clear();
  try {
    const api = await pdfWorker();
    const bufs = await Promise.all(valid.value.map((e) => e.file.arrayBuffer()));
    const bytes = await api.merge(bufs);
    results.add(
      'gabungan.pdf',
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      fill(props.t.pages, { n: totalPages.value }),
    );
  } catch (e) {
    error.value = errorText(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" :accept="PDF_ACCEPT" @files="add" @prefetch="pdfWorker()" />
    <p class="text-sm text-slate-600 dark:text-slate-400">{{ t['merge.hint'] }}</p>

    <ol v-if="entries.length" class="space-y-2">
      <li v-for="(e, i) in entries" :key="e.id" class="card flex items-center gap-2 p-3">
        <span class="w-6 text-center text-sm font-bold text-slate-500">{{ i + 1 }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ e.file.name }}</p>
          <p class="text-xs" :class="e.error ? 'error-text' : 'text-slate-600 dark:text-slate-400'">
            {{
              e.error ??
              (e.pages
                ? `${fill(t.pages, { n: e.pages })} · ${formatBytes(e.file.size)}`
                : files.processing)
            }}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :disabled="i === 0"
          :aria-label="fill(files.moveUp, { name: e.file.name })"
          @click="move(i, -1)"
        >
          <IconArrowUp aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :disabled="i === entries.length - 1"
          :aria-label="fill(files.moveDown, { name: e.file.name })"
          @click="move(i, 1)"
        >
          <IconArrowDown aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-secondary px-2"
          :aria-label="fill(files.remove, { name: e.file.name })"
          @click="entries = entries.filter((x) => x.id !== e.id)"
        >
          <IconX aria-hidden="true" />
        </button>
      </li>
    </ol>

    <div v-if="entries.length" class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || valid.length < 2"
        @click="run"
      >
        {{ t['merge.run'] }}
      </button>
      <span v-if="valid.length" class="text-sm text-slate-600 dark:text-slate-400">{{
        fill(t.pages, { n: totalPages })
      }}</span>
    </div>
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
