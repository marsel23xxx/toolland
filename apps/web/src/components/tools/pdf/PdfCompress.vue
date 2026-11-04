<script setup lang="ts">
import { fileName } from '../../../lib/names';
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import { cancelPdfWorker, PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import type { CompressLevel } from '../../../lib/pdf/types';
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

const level = ref<CompressLevel>('medium');
const sources = ref<File[]>([]);
const results = useFileResults();
const busy = ref(false);
const current = ref('');
const errors = ref<string[]>([]);
let lastLevel: CompressLevel = 'medium';

async function process(list: File[]) {
  busy.value = true;
  lastLevel = level.value;
  try {
    for (const file of list) {
      current.value = file.name;
      try {
        const r = await (await pdfWorker()).compress(await file.arrayBuffer(), level.value);
        const before = file.size;
        const after = r.bytes.byteLength;
        const detail = r.unchanged
          ? `${formatBytes(before)} · ${props.t['compress.unchanged']}`
          : `${fill(props.files.saved, { before: formatBytes(before), after: formatBytes(after), percent: Math.round((1 - after / before) * 100) })} · ${fill(props.t['compress.images'], { done: r.imagesRecompressed, total: r.imagesTotal })}`;
        results.add(
          withSuffix(file.name, fileName('small'), '.pdf'),
          new Blob([r.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
          detail,
        );
      } catch (e) {
        if (!busy.value) return;
        errors.value.push(`${file.name}: ${props.t[`error.${pdfErrorCode(e)}`]}`);
      }
    }
  } finally {
    busy.value = false;
    current.value = '';
  }
}

function add(list: File[]) {
  sources.value.push(...list);
  void process(list);
}

function apply() {
  results.clear();
  errors.value = [];
  void process(sources.value);
}

function cancel() {
  busy.value = false;
  cancelPdfWorker();
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" :accept="PDF_ACCEPT" @files="add" @prefetch="pdfWorker()" />
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="pc-level" class="label">{{ t['compress.level'] }}</label>
        <select id="pc-level" v-model="level" class="field w-auto">
          <option value="low">{{ t['compress.low'] }}</option>
          <option value="medium">{{ t['compress.medium'] }}</option>
          <option value="high">{{ t['compress.high'] }}</option>
        </select>
      </div>
      <button
        v-if="sources.length && level !== lastLevel && !busy"
        type="button"
        class="btn btn-primary"
        @click="apply"
      >
        {{ t['compress.apply'] }}
      </button>
      <button v-if="busy" type="button" class="btn btn-secondary" @click="cancel">
        {{ files.cancel }}
      </button>
    </div>
    <p class="text-sm text-slate-600 dark:text-slate-400">{{ t['compress.hint'] }}</p>
    <ProgressBar v-if="busy" :label="current || files.processing" />
    <ul v-if="errors.length" class="space-y-1" aria-live="polite">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      :zip-name="`${fileName('zipSmallPdf')}.zip`"
      @remove="results.remove"
    />
  </div>
</template>
