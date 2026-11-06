<script setup lang="ts">
import { fileName } from '../../../lib/names';
import { ref, shallowRef } from 'vue';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import { parseRanges } from '../../../lib/pdf/ranges';
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

type Mode = 'each' | 'ranges' | 'extract';
const file = shallowRef<File | null>(null);
const pages = ref(0);
const mode = ref<Mode>('ranges');
const ranges = ref('');
const busy = ref(false);
const error = ref('');
const results = useFileResults();

async function load(list: File[]) {
  file.value = list[0] ?? null;
  results.clear();
  error.value = '';
  pages.value = 0;
  if (!file.value) return;
  try {
    pages.value = await (await pdfWorker()).pageCount(await file.value.arrayBuffer());
    ranges.value =
      pages.value > 1 ? `1-${Math.ceil(pages.value / 2)}, ${Math.ceil(pages.value / 2) + 1}-` : '1';
  } catch (e) {
    error.value = props.t[`error.${pdfErrorCode(e)}`];
  }
}

function label(group: number[]) {
  const first = `${fileName('page')}${group[0]}`;
  return group.length === 1 ? first : `${first}-${group[group.length - 1]}`;
}

async function run() {
  if (!file.value) return;
  error.value = '';
  let groups: number[][];
  try {
    if (mode.value === 'each') groups = Array.from({ length: pages.value }, (_, i) => [i + 1]);
    else {
      const parsed = parseRanges(ranges.value, pages.value);
      groups =
        mode.value === 'extract' ? [[...new Set(parsed.flat())].sort((a, b) => a - b)] : parsed;
    }
  } catch (e) {
    error.value = fill(props.t['split.invalid'], { part: (e as Error).message, n: pages.value });
    return;
  }
  busy.value = true;
  results.clear();
  try {
    const outputs = await (await pdfWorker()).split(await file.value.arrayBuffer(), groups);
    outputs.forEach((bytes, i) => {
      const name = withSuffix(
        file.value!.name,
        mode.value === 'extract' ? fileName('selection') : label(groups[i]),
        '.pdf',
      );
      results.add(
        name,
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        fill(props.t.pages, { n: groups[i].length }),
      );
    });
  } catch (e) {
    error.value = props.t[`error.${pdfErrorCode(e)}`];
  } finally {
    busy.value = false;
  }
}
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
            · {{ pages ? fill(t.pages, { n: pages }) : files.processing }} ·
            {{ formatBytes(file.size) }}</span
          >
        </p>
        <button type="button" class="btn btn-secondary" @click="load([])">
          {{ t['split.change'] }}
        </button>
      </div>

      <fieldset v-if="pages">
        <legend class="label">{{ t['split.mode'] }}</legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="o in ['ranges', 'each', 'extract'] as const"
            :key="o"
            type="button"
            class="btn btn-secondary"
            :class="{ 'btn-active': mode === o }"
            :aria-pressed="mode === o"
            @click="mode = o"
          >
            {{ t[`split.${o}`] }}
          </button>
        </div>
      </fieldset>

      <div v-if="pages && mode !== 'each'">
        <label for="sp-ranges" class="label">{{ t['split.rangesLabel'] }}</label>
        <input
          id="sp-ranges"
          v-model="ranges"
          class="field max-w-md font-mono"
          autocomplete="off"
          @keydown.enter="run"
        />
        <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {{ mode === 'ranges' ? t['split.rangesHint'] : t['split.extractHint'] }}
        </p>
      </div>

      <button v-if="pages" type="button" class="btn btn-primary" :disabled="busy" @click="run">
        {{ t['split.run'] }}
      </button>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <ProgressBar v-if="busy" :label="files.processing" />
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      :zip-name="`${fileName('zipSplit')}.zip`"
      @remove="results.remove"
    />
  </div>
</template>
