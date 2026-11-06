<script setup lang="ts">
import { fileName } from '../../../lib/names';
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { fill } from '../../../lib/format';
import { PDF_ACCEPT } from '../../../lib/pdf/client';
import { canvasToBlob, closePdf, openPdf, pdfjs, renderPage } from '../../../lib/pdf/render';
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

const format = ref<'jpeg' | 'png'>('jpeg');
const dpi = ref(150);
const results = useFileResults();
const progress = ref<{ label: string; value: number } | null>(null);
const errors = ref<string[]>([]);
let cancelled = false;
let running = false;
const pending: File[] = [];

/** Batas piksel per halaman (sekitar 16 juta, aman untuk Safari di iPhone). */
const MAX_PIXELS = 16_000_000;

async function process(list: File[]) {
  pending.push(...list);
  if (running) return;
  running = true;
  cancelled = false;
  try {
    while (pending.length && !cancelled) await processFile(pending.shift()!);
  } finally {
    pending.length = 0;
    running = false;
    progress.value = null;
  }
}

async function processFile(file: File) {
  let doc;
  try {
    doc = await openPdf(await file.arrayBuffer());
  } catch (e) {
    errors.value.push(
      `${file.name}: ${(e as Error).name === 'PasswordException' ? props.t['error.encrypted'] : props.t['error.invalid']}`,
    );
    return;
  }
  const total = doc.numPages;
  let failed = 0;
  try {
    for (let n = 1; n <= total && !cancelled; n++) {
      progress.value = {
        label: `${file.name} · ${fill(props.t['toImage.rendering'], { n, total })}`,
        value: ((n - 1) / total) * 100,
      };
      try {
        const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
        // Halaman sangat besar (poster, gambar teknik) diperkecil agar kanvas tidak gagal dibuat.
        const scale = Math.min(dpi.value / 72, Math.sqrt(MAX_PIXELS / (vp.width * vp.height)));
        const canvas = await renderPage(doc, n, scale);
        const blob = await canvasToBlob(
          canvas,
          format.value === 'png' ? 'image/png' : 'image/jpeg',
          0.9,
        );
        canvas.width = canvas.height = 0; // lepas memori canvas
        const ext = format.value === 'png' ? '.png' : '.jpg';
        results.add(withSuffix(file.name, `${fileName('page')}${n}`, ext), blob);
      } catch {
        failed++;
      }
    }
  } finally {
    await closePdf(doc);
  }
  if (failed)
    errors.value.push(`${file.name}: ${fill(props.t['toImage.pagesFailed'], { n: failed })}`);
}

function add(list: File[]) {
  errors.value = [];
  void process(list);
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" :accept="PDF_ACCEPT" @files="add" @prefetch="pdfjs()" />
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="pi-format" class="label">{{ t['toImage.format'] }}</label>
        <select id="pi-format" v-model="format" class="field w-auto">
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
        </select>
      </div>
      <div>
        <label for="pi-dpi" class="label">{{ t['toImage.dpi'] }}</label>
        <select id="pi-dpi" v-model.number="dpi" class="field w-auto">
          <option v-for="d in [72, 150, 300]" :key="d" :value="d">
            {{ fill(t['toImage.dpiOption'], { dpi: d }) }}
          </option>
        </select>
      </div>
      <button v-if="progress" type="button" class="btn btn-secondary" @click="cancelled = true">
        {{ files.cancel }}
      </button>
    </div>
    <ProgressBar v-if="progress" :label="progress.label" :value="progress.value" />
    <ul v-if="errors.length" class="space-y-1" aria-live="polite">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      :zip-name="`${fileName('zipPages')}.zip`"
      thumbnails
      @remove="results.remove"
    />
  </div>
</template>
