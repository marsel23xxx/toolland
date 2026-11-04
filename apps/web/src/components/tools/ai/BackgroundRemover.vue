<script setup lang="ts">
import type { Remote } from 'comlink';
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';
import type { Messages } from '../../../i18n';
import { downloadBlob } from '../../../lib/download';
import { fill, formatBytes } from '../../../lib/format';
import { canvasToBlob } from '../../../lib/pdf/render';
import { withSuffix } from '../../../lib/results';
import { VENDOR } from '../../../lib/vendor';
import type { BgWorkerApi } from '../../../workers/bg.worker';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const DownloadAll = defineAsyncComponent(() => import('../../ui/DownloadAll.vue'));
const DonateCard = defineAsyncComponent(() => import('../../ui/DonateCard.vue'));

const props = defineProps<{
  t: Messages<'ai'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

interface Item {
  id: number;
  name: string;
  /** PNG transparan dari model */
  png: Blob;
  /** hasil sesuai pilihan latar */
  out: Blob;
  url: string;
}

const items = ref<Item[]>([]);
const progress = ref<{ label: string; value?: number } | null>(null);
const device = ref<'gpu' | 'cpu' | null>(null);
const errors = ref<string[]>([]);
const background = ref<'transparent' | 'white' | 'custom'>('transparent');
const color = ref('#2563eb');
const downloads = ref(0);
let worker: Worker | undefined;
let api: Remote<BgWorkerApi> | undefined;
let nextId = 0;
const queue: File[] = [];
let running = false;

async function getApi() {
  if (!api) {
    const { wrap } = await import('comlink');
    worker = new Worker(new URL('../../../workers/bg.worker.ts', import.meta.url), {
      type: 'module',
    });
    api = wrap<BgWorkerApi>(worker);
    device.value = await api.device();
  }
  return api;
}

const fillColor = computed(() =>
  background.value === 'white' ? '#ffffff' : background.value === 'custom' ? color.value : null,
);

/** Gabungkan PNG transparan dengan warna latar (JPG) atau biarkan transparan (PNG). */
async function compose(png: Blob): Promise<Blob> {
  if (!fillColor.value) return png;
  const bmp = await createImageBitmap(png);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fillColor.value;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return canvasToBlob(c, 'image/jpeg', 0.92);
}

const outName = (name: string) => withSuffix(name, '-tanpa-bg', fillColor.value ? '.jpg' : '.png');

async function pump() {
  if (running) return;
  running = true;
  const { proxy } = await import('comlink');
  try {
    while (queue.length) {
      const file = queue.shift()!;
      progress.value = { label: fill(props.t.processing, { name: file.name }) };
      try {
        const r = await (
          await getApi()
        ).remove(
          file,
          new URL(VENDOR.imgly, location.href).href,
          proxy((stage, current, total) => {
            progress.value =
              stage === 'download' && total > 0
                ? {
                    label: fill(props.t.downloading, {
                      current: formatBytes(current),
                      total: formatBytes(total),
                    }),
                    value: (current / total) * 100,
                  }
                : { label: fill(props.t.processing, { name: file.name }) };
          }),
        );
        device.value = r.device;
        const png = new Blob([r.png], { type: 'image/png' });
        const out = await compose(png);
        items.value.push({
          id: nextId++,
          name: file.name,
          png,
          out,
          url: URL.createObjectURL(out),
        });
      } catch {
        errors.value.push(fill(props.t.error, { name: file.name }));
      }
    }
  } finally {
    running = false;
    progress.value = null;
  }
}

function add(list: File[]) {
  queue.push(...list);
  void pump();
}

// Ganti latar: susun ulang semua hasil tanpa menjalankan model lagi.
watch([background, color], async () => {
  for (const item of items.value) {
    URL.revokeObjectURL(item.url);
    item.out = await compose(item.png);
    item.url = URL.createObjectURL(item.out);
  }
});

function remove(id: number) {
  const item = items.value.find((i) => i.id === id);
  if (item) URL.revokeObjectURL(item.url);
  items.value = items.value.filter((i) => i.id !== id);
}

function download(item: Item) {
  downloadBlob(item.out, outName(item.name));
  downloads.value++;
}

const zipEntries = computed(() => items.value.map((i) => ({ name: outName(i.name), blob: i.out })));

onBeforeUnmount(() => {
  worker?.terminate();
  items.value.forEach((i) => URL.revokeObjectURL(i.url));
});
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" accept="image/*,.heic,.heif" @files="add" @prefetch="getApi()" />
    <p class="text-sm text-slate-600 dark:text-slate-400">
      {{
        device === 'gpu'
          ? t.deviceGpu
          : device === 'cpu'
            ? t.deviceCpu
            : fill(t.firstRunNote, { size: '44–88 MB' })
      }}
    </p>

    <div class="flex flex-wrap items-end gap-3">
      <fieldset>
        <legend class="label">{{ t.background }}</legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="o in ['transparent', 'white', 'custom'] as const"
            :key="o"
            type="button"
            class="btn btn-secondary"
            :class="{ 'btn-active': background === o }"
            :aria-pressed="background === o"
            @click="background = o"
          >
            {{ t[o] }}
          </button>
        </div>
      </fieldset>
      <input
        v-if="background === 'custom'"
        v-model="color"
        type="color"
        class="field h-10 w-16 p-1"
        :aria-label="t.custom"
      />
      <DownloadAll
        v-if="items.length > 1"
        :files="zipEntries"
        :label="files.downloadAll"
        :busy-label="files.zipping"
        zip-name="tanpa-background.zip"
        @downloaded="downloads++"
      />
    </div>

    <ProgressBar v-if="progress" :label="progress.label" :value="progress.value" />
    <ul v-if="errors.length" class="space-y-1" aria-live="polite">
      <li v-for="e in errors" :key="e" class="error-text">{{ e }}</li>
    </ul>
    <DonateCard :m="donate" :trigger="downloads" />

    <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="item in items" :key="item.id" class="card space-y-2 p-3">
        <div
          class="checker flex aspect-square items-center justify-center overflow-hidden rounded-lg"
        >
          <img
            :src="item.url"
            :alt="fill(t.result, { name: item.name })"
            class="max-h-full max-w-full object-contain"
          />
        </div>
        <p class="truncate text-sm font-semibold">{{ outName(item.name) }}</p>
        <div class="flex gap-2">
          <button type="button" class="btn btn-primary flex-1" @click="download(item)">
            {{ files.download }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            :aria-label="fill(files.remove, { name: item.name })"
            @click="remove(item.id)"
          >
            ✕
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
