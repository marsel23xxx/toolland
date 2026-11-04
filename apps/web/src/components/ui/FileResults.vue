<script setup lang="ts">
/** Daftar file hasil (PDF, gambar halaman, audio, ...) dengan unduh, ZIP, dan kartu donasi. */
import { computed, defineAsyncComponent, ref } from 'vue';
import IconFile from '~icons/lucide/file';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../i18n';
import { fill, formatBytes } from '../../lib/format';
import type { FileResult } from '../../lib/results';

const DownloadAll = defineAsyncComponent(() => import('./DownloadAll.vue'));
const DonateCard = defineAsyncComponent(() => import('./DonateCard.vue'));

const props = withDefaults(
  defineProps<{
    items: FileResult[];
    m: Messages<'files'>;
    donate: Messages<'donate'>;
    zipName?: string;
    /** Tampilkan pratinjau gambar (untuk hasil berupa gambar). */
    thumbnails?: boolean;
  }>(),
  { zipName: 'toolland.zip', thumbnails: false },
);
const emit = defineEmits<{ remove: [id: number] }>();
const downloads = ref(0);
const zipEntries = computed(() => props.items.map((i) => ({ name: i.name, blob: i.blob })));
</script>

<template>
  <div v-if="items.length" class="space-y-3">
    <div v-if="items.length > 1" class="flex justify-end">
      <DownloadAll
        :files="zipEntries"
        :label="m.downloadAll"
        :busy-label="m.zipping"
        :zip-name="zipName"
        @downloaded="downloads++"
      />
    </div>
    <DonateCard :m="donate" :trigger="downloads" />
    <ul class="space-y-2">
      <li v-for="item in items" :key="item.id" class="card flex items-center gap-3 p-3">
        <div
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
        >
          <img
            v-if="thumbnails"
            :src="item.url"
            alt=""
            class="size-full object-cover"
            loading="lazy"
          />
          <IconFile v-else class="size-6 text-slate-500" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ item.name }}</p>
          <p class="text-xs text-slate-600 dark:text-slate-400">
            {{ item.detail ?? formatBytes(item.blob.size) }}
          </p>
        </div>
        <a
          :href="item.url"
          :download="item.name"
          class="btn btn-primary shrink-0"
          @click="downloads++"
          >{{ m.download }}</a
        >
        <button
          type="button"
          class="btn btn-secondary shrink-0 px-2"
          :aria-label="fill(m.remove, { name: item.name })"
          @click="emit('remove', item.id)"
        >
          <IconX aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>
