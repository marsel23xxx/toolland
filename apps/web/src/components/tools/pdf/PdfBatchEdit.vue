<script setup lang="ts">
/** Watermark atau nomor halaman untuk banyak PDF sekaligus. */
import { fileName } from '../../../lib/names';
import { computed, ref } from 'vue';
import type { Messages } from '../../../i18n';
import { fill } from '../../../lib/format';
import { cancelPdfWorker, PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import type { NumberPosition } from '../../../lib/pdf/geometry';
import type { PageNumberOptions, WatermarkOptions } from '../../../lib/pdf/types';
import { useFileResults, withSuffix } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  t: Messages<'pdf'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  mode: 'watermark' | 'numbers';
}>();

const sources = ref<File[]>([]);
const results = useFileResults();
const busy = ref(false);
const current = ref('');
const errors = ref<string[]>([]);

// watermark
const wm = ref<WatermarkOptions>({
  text: props.t['watermark.defaultText'],
  fontSize: 60,
  opacity: 0.25,
  rotation: 45,
  color: '#dc2626',
  mode: 'center',
});
// nomor halaman
const POSITIONS: { value: NumberPosition; key: keyof Messages<'pdf'> }[] = [
  { value: 'bottom-center', key: 'numbers.bottomCenter' },
  { value: 'bottom-right', key: 'numbers.bottomRight' },
  { value: 'bottom-left', key: 'numbers.bottomLeft' },
  { value: 'top-center', key: 'numbers.topCenter' },
  { value: 'top-right', key: 'numbers.topRight' },
  { value: 'top-left', key: 'numbers.topLeft' },
];
const TEMPLATES = computed(() => [
  { value: '{n}', label: props.t['numbers.formatPlain'] },
  { value: '{n} / {total}', label: props.t['numbers.formatOf'] },
  { value: props.t['numbers.templateHalaman'], label: props.t['numbers.formatHalaman'] },
]);
const nums = ref<PageNumberOptions>({
  position: 'bottom-center',
  template: '{n}',
  start: 1,
  fontSize: 11,
  skipFirst: false,
});

function add(list: File[]) {
  sources.value.push(...list);
}
function removeSource(i: number) {
  sources.value.splice(i, 1);
}

async function run() {
  results.clear();
  errors.value = [];
  busy.value = true;
  const opts = JSON.parse(JSON.stringify(props.mode === 'watermark' ? wm.value : nums.value));
  try {
    for (const file of sources.value) {
      current.value = file.name;
      try {
        const api = await pdfWorker();
        const buf = await file.arrayBuffer();
        const bytes =
          props.mode === 'watermark'
            ? await api.watermark(buf, opts)
            : await api.pageNumbers(buf, opts);
        const suffix = fileName(props.mode === 'watermark' ? 'watermarked' : 'numbered');
        results.add(
          withSuffix(file.name, suffix, '.pdf'),
          new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
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

function cancel() {
  busy.value = false;
  cancelPdfWorker();
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" :accept="PDF_ACCEPT" @files="add" @prefetch="pdfWorker()" />

    <ul v-if="sources.length" class="flex flex-wrap gap-2">
      <li
        v-for="(f, i) in sources"
        :key="i"
        class="card flex items-center gap-2 px-3 py-1.5 text-sm"
      >
        <span class="max-w-56 truncate">{{ f.name }}</span>
        <button
          type="button"
          class="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          :aria-label="fill(files.remove, { name: f.name })"
          @click="removeSource(i)"
        >
          ✕
        </button>
      </li>
    </ul>

    <div v-if="mode === 'watermark'" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div class="sm:col-span-2 lg:col-span-1">
        <label for="wm-text" class="label">{{ t['watermark.text'] }}</label>
        <input id="wm-text" v-model="wm.text" class="field" maxlength="80" />
      </div>
      <div>
        <label for="wm-mode" class="label">{{ t['watermark.mode'] }}</label>
        <select id="wm-mode" v-model="wm.mode" class="field">
          <option value="center">{{ t['watermark.center'] }}</option>
          <option value="tile">{{ t['watermark.tile'] }}</option>
        </select>
      </div>
      <div>
        <label for="wm-color" class="label">{{ t['watermark.color'] }}</label>
        <input id="wm-color" v-model="wm.color" type="color" class="field h-10 w-20 p-1" />
      </div>
      <div>
        <label for="wm-size" class="label">{{ t['watermark.fontSize'] }}: {{ wm.fontSize }}</label>
        <input
          id="wm-size"
          v-model.number="wm.fontSize"
          type="range"
          min="12"
          max="160"
          class="w-full accent-brand-600"
        />
      </div>
      <div>
        <label for="wm-op" class="label"
          >{{ t['watermark.opacity'] }}: {{ Math.round(wm.opacity * 100) }}%</label
        >
        <input
          id="wm-op"
          v-model.number="wm.opacity"
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          class="w-full accent-brand-600"
        />
      </div>
      <div>
        <label for="wm-rot" class="label">{{ t['watermark.rotation'] }}: {{ wm.rotation }}°</label>
        <input
          id="wm-rot"
          v-model.number="wm.rotation"
          type="range"
          min="-90"
          max="90"
          step="5"
          class="w-full accent-brand-600"
        />
      </div>
    </div>

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label for="pn-pos" class="label">{{ t['numbers.position'] }}</label>
        <select id="pn-pos" v-model="nums.position" class="field">
          <option v-for="p in POSITIONS" :key="p.value" :value="p.value">{{ t[p.key] }}</option>
        </select>
      </div>
      <div>
        <label for="pn-fmt" class="label">{{ t['numbers.format'] }}</label>
        <select id="pn-fmt" v-model="nums.template" class="field">
          <option v-for="f in TEMPLATES" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </div>
      <div>
        <label for="pn-start" class="label">{{ t['numbers.start'] }}</label>
        <input
          id="pn-start"
          v-model.number="nums.start"
          type="number"
          min="0"
          max="9999"
          class="field"
        />
      </div>
      <div>
        <label for="pn-size" class="label">{{ t['numbers.fontSize'] }}</label>
        <input
          id="pn-size"
          v-model.number="nums.fontSize"
          type="number"
          min="6"
          max="48"
          class="field"
        />
      </div>
      <label class="flex items-center gap-2 text-sm sm:col-span-2">
        <input v-model="nums.skipFirst" type="checkbox" class="size-4 accent-brand-600" />
        {{ t['numbers.skipFirst'] }}
      </label>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || !sources.length || (mode === 'watermark' && !wm.text.trim())"
        @click="run"
      >
        {{ mode === 'watermark' ? t['watermark.run'] : t['numbers.run'] }}
      </button>
      <button v-if="busy" type="button" class="btn btn-secondary" @click="cancel">
        {{ files.cancel }}
      </button>
    </div>
    <ProgressBar v-if="busy" :label="current || files.processing" />
    <ul v-if="errors.length" class="space-y-1" aria-live="polite">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
