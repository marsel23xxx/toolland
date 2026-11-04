<script setup lang="ts">
/**
 * Tools yang memakai server: Word/Excel/PowerPoint ke PDF (Gotenberg) dan kompres PDF maksimal
 * (Ghostscript). File diproses satu per satu agar tidak membebani server.
 */
import { fileName } from '../../../lib/names';
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import type { CompressLevel } from '../../../lib/pdf/types';
import { useFileResults, withSuffix } from '../../../lib/results';
import { errorCode, postFile, SERVER_MAX_BYTES } from '../../../lib/server';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  m: Messages<'server'>;
  t: Messages<'pdf'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  mode: 'word' | 'excel' | 'ppt' | 'compress';
}>();

const ACCEPT: Record<typeof props.mode, string> = {
  word: '.doc,.docx,.odt,.rtf',
  excel: '.xls,.xlsx,.ods',
  ppt: '.ppt,.pptx,.odp',
  compress: '.pdf,application/pdf',
};

const level = ref<CompressLevel>('medium');
const results = useFileResults();
const progress = ref<{ label: string; value?: number } | null>(null);
const errors = ref<string[]>([]);
const queue: File[] = [];
let running = false;
let abort: (() => void) | null = null;

async function pump() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const file = queue.shift()!;
      const compress = props.mode === 'compress';
      try {
        const job = postFile(
          compress ? '/pdf/compress' : '/office-to-pdf',
          file,
          compress ? { level: level.value } : {},
          (p) => {
            progress.value =
              p < 100
                ? {
                    label: fill(props.m.uploading, { name: file.name, percent: Math.round(p) }),
                    value: p,
                  }
                : {
                    label: fill(compress ? props.m.compressing : props.m.converting, {
                      name: file.name,
                    }),
                  };
          },
        );
        abort = job.abort;
        progress.value = {
          label: fill(props.m.uploading, { name: file.name, percent: 0 }),
          value: 0,
        };
        const r = await job.promise;
        let detail = formatBytes(r.blob.size);
        if (compress) {
          const pct = Math.round((1 - r.blob.size / file.size) * 100);
          detail = r.unchanged
            ? `${formatBytes(file.size)} · ${props.m.unchanged}`
            : fill(props.files.saved, {
                before: formatBytes(file.size),
                after: formatBytes(r.blob.size),
                percent: pct,
              });
        }
        results.add(
          withSuffix(file.name, compress ? fileName('small') : '', '.pdf'),
          r.blob,
          detail,
        );
      } catch (e) {
        const code = errorCode(e);
        if (code === 'cancelled') break;
        errors.value.push(`${file.name}: ${props.m[`error.${code}`]}`);
      }
    }
  } finally {
    running = false;
    abort = null;
    progress.value = null;
  }
}

function add(list: File[]) {
  errors.value = [];
  queue.push(...list);
  void pump();
}

function cancel() {
  queue.length = 0;
  abort?.();
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      :messages="dropzone"
      :accept="ACCEPT[mode]"
      :max-size="SERVER_MAX_BYTES"
      @files="add"
    />
    <p class="text-sm text-slate-600 dark:text-slate-400">
      {{ mode === 'compress' ? '' : m[`officeHint.${mode}`] }} {{ m.privacy }}
    </p>
    <div v-if="mode === 'compress'">
      <label for="sc-level" class="label">{{ t['compress.level'] }}</label>
      <select id="sc-level" v-model="level" class="field w-auto">
        <option value="low">{{ t['compress.low'] }}</option>
        <option value="medium">{{ t['compress.medium'] }}</option>
        <option value="high">{{ t['compress.high'] }}</option>
      </select>
    </div>
    <div v-if="progress" class="flex items-center gap-3">
      <ProgressBar class="flex-1" :label="progress.label" :value="progress.value" />
      <button type="button" class="btn btn-secondary" @click="cancel">{{ files.cancel }}</button>
    </div>
    <ul v-if="errors.length" class="space-y-1" aria-live="polite">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      :zip-name="`${fileName('zipPdf')}.zip`"
      @remove="results.remove"
    />
  </div>
</template>
