<script setup lang="ts">
/**
 * Kerangka bersama tools gambar batch: dropzone, pengaturan (slot), daftar file,
 * ringkasan, unduh ZIP, dan kartu donasi.
 */
import { fileName } from '../../lib/names';
import { computed, defineAsyncComponent, ref } from 'vue';
import type { Messages } from '../../i18n';
import { fill, formatBytes } from '../../lib/format';
import type { useImageBatch } from '../../lib/image/batch';
import { IMAGE_ACCEPT } from '../../lib/image/format';
import Dropzone, { type DropzoneMessages } from './Dropzone.vue';

// Baru dibutuhkan setelah ada file, jadi tidak ikut JavaScript awal halaman.
const ResultCard = defineAsyncComponent(() => import('./ResultCard.vue'));
const DownloadAll = defineAsyncComponent(() => import('./DownloadAll.vue'));
const DonateCard = defineAsyncComponent(() => import('./DonateCard.vue'));

const props = withDefaults(
  defineProps<{
    batch: ReturnType<typeof useImageBatch>;
    m: Messages<'image'>;
    dropzone: DropzoneMessages;
    donate: Messages<'donate'>;
    accept?: string;
    zipName?: string;
  }>(),
  { accept: IMAGE_ACCEPT, zipName: () => `${fileName('zipImages')}.zip` },
);
const emit = defineEmits<{ files: [files: File[]]; prefetch: [] }>();
const downloads = ref(0);

const summary = computed(() => {
  const b = props.batch;
  const parts = [fill(props.m.summary, { done: b.done.length, total: b.items.length })];
  const { before, after } = b.totals;
  if (b.done.length > 1 && before > 0) {
    parts.push(
      fill(props.m.totalSaved, {
        before: formatBytes(before),
        after: formatBytes(after),
        percent: Math.max(0, Math.round((1 - after / before) * 100)),
      }),
    );
  }
  if (b.eta) parts.push(fill(props.m.eta, { n: b.eta }));
  return parts.join(' · ');
});

const zipEntries = computed(() =>
  props.batch.done.map((i) => ({ name: i.result!.name, blob: i.result!.blob })),
);
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      :messages="dropzone"
      :accept="accept"
      @files="(f) => emit('files', f)"
      @prefetch="emit('prefetch')"
    />

    <slot />

    <template v-if="batch.items.length">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">{{ summary }}</p>
        <div class="flex flex-wrap gap-2">
          <button v-if="batch.busy" type="button" class="btn btn-secondary" @click="batch.cancel()">
            {{ m.cancel }}
          </button>
          <button v-else type="button" class="btn btn-secondary" @click="batch.clear()">
            {{ m.clear }}
          </button>
          <DownloadAll
            v-if="batch.done.length > 1"
            :files="zipEntries"
            :label="m.downloadAll"
            :busy-label="m.zipping"
            :zip-name="zipName"
            @downloaded="downloads++"
          />
        </div>
      </div>

      <DonateCard :m="donate" :trigger="downloads" />

      <ul class="space-y-2">
        <ResultCard
          v-for="item in batch.items"
          :key="item.id"
          :item="item"
          :m="m"
          @remove="batch.remove(item.id)"
          @downloaded="downloads++"
        />
      </ul>
    </template>
  </div>
</template>
