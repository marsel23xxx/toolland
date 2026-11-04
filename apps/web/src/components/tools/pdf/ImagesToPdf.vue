<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import IconArrowDown from '~icons/lucide/arrow-down';
import IconArrowUp from '~icons/lucide/arrow-up';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../../i18n';
import { fill } from '../../../lib/format';
import { jpegOrientation } from '../../../lib/image/exif';
import { IMAGE_ACCEPT, sniffFormat } from '../../../lib/image/format';
import { ImagePool } from '../../../lib/image/pool';
import { pdfWorker } from '../../../lib/pdf/client';
import type { ImagePageInput, ImagesToPdfOptions } from '../../../lib/pdf/types';
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
  url: string;
}
const entries = ref<Entry[]>([]);
const pageSize = ref<ImagesToPdfOptions['pageSize']>('a4');
const orientation = ref<ImagesToPdfOptions['orientation']>('auto');
const marginMm = ref(10);
const busy = ref(false);
const error = ref('');
const results = useFileResults();
const pool = new ImagePool();
let nextId = 0;

function add(list: File[]) {
  for (const file of list)
    entries.value.push({ id: nextId++, file, url: URL.createObjectURL(file) });
}
function remove(id: number) {
  const e = entries.value.find((x) => x.id === id);
  if (e) URL.revokeObjectURL(e.url);
  entries.value = entries.value.filter((x) => x.id !== id);
}
function move(i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= entries.value.length) return;
  const list = [...entries.value];
  [list[i], list[j]] = [list[j], list[i]];
  entries.value = list;
}

/** JPG tegak dan PNG langsung disisipkan; format lain atau JPG berotasi EXIF diubah ke JPG dulu. */
async function toPageInput(file: File): Promise<ImagePageInput> {
  const bytes = await file.arrayBuffer();
  const kind = sniffFormat(new Uint8Array(bytes.slice(0, 64)));
  if (kind === 'png') return { bytes, kind: 'png' };
  if (kind === 'jpeg' && jpegOrientation(bytes) === 1) return { bytes, kind: 'jpeg' };
  const r = await pool.run((api) => api.process(file, { format: 'jpeg', quality: 92 }));
  return { bytes: r.buffer, kind: 'jpeg' };
}

async function run() {
  if (!entries.value.length) return;
  busy.value = true;
  error.value = '';
  results.clear();
  try {
    const inputs = await Promise.all(entries.value.map((e) => toPageInput(e.file)));
    const bytes = await (
      await pdfWorker()
    ).imagesToPdf(inputs, {
      pageSize: pageSize.value,
      orientation: orientation.value,
      margin: marginMm.value * 2.835,
    });
    results.add(
      'gambar.pdf',
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      fill(props.t.pages, { n: inputs.length }),
    );
  } catch {
    error.value = props.t['error.invalid'];
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => {
  entries.value.forEach((e) => URL.revokeObjectURL(e.url));
  pool.destroy();
});
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" :accept="IMAGE_ACCEPT" @files="add" @prefetch="pdfWorker()" />

    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="ip-size" class="label">{{ t['fromImage.pageSize'] }}</label>
        <select id="ip-size" v-model="pageSize" class="field w-auto">
          <option value="a4">{{ t['fromImage.a4'] }}</option>
          <option value="letter">{{ t['fromImage.letter'] }}</option>
          <option value="fit">{{ t['fromImage.fit'] }}</option>
        </select>
      </div>
      <div v-if="pageSize !== 'fit'">
        <label for="ip-orient" class="label">{{ t['fromImage.orientation'] }}</label>
        <select id="ip-orient" v-model="orientation" class="field w-auto">
          <option value="auto">{{ t['fromImage.auto'] }}</option>
          <option value="portrait">{{ t['fromImage.portrait'] }}</option>
          <option value="landscape">{{ t['fromImage.landscape'] }}</option>
        </select>
      </div>
      <div>
        <label for="ip-margin" class="label">{{ t['fromImage.margin'] }}</label>
        <select id="ip-margin" v-model.number="marginMm" class="field w-auto">
          <option :value="0">{{ t['fromImage.noMargin'] }}</option>
          <option :value="10">10 mm</option>
          <option :value="20">20 mm</option>
        </select>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || !entries.length"
        @click="run"
      >
        {{ t['fromImage.run'] }}
      </button>
    </div>

    <ol v-if="entries.length" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <li v-for="(e, i) in entries" :key="e.id" class="card space-y-2 p-2">
        <img
          :src="e.url"
          alt=""
          class="aspect-[3/4] w-full rounded bg-slate-100 object-contain dark:bg-slate-800"
          loading="lazy"
        />
        <p class="truncate text-xs">
          <span class="font-bold">{{ i + 1 }}.</span> {{ e.file.name }}
        </p>
        <div class="flex justify-between gap-1">
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
            @click="remove(e.id)"
          >
            <IconX aria-hidden="true" />
          </button>
        </div>
      </li>
    </ol>

    <ProgressBar v-if="busy" :label="t['fromImage.preparing']" />
    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
