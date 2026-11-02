<script setup lang="ts">
/** Satu file dalam batch: pratinjau, ukuran sebelum/sesudah, status, dan tombol unduh. */
import { computed } from 'vue';
import IconImage from '~icons/lucide/image';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../i18n';
import type { BatchItem } from '../../lib/image/batch';
import { fill, formatBytes } from '../../lib/format';
import ProgressBar from './ProgressBar.vue';

const props = defineProps<{ item: BatchItem; m: Messages<'image'> }>();
const emit = defineEmits<{ remove: []; downloaded: [] }>();

const change = computed(() => {
  const r = props.item.result;
  if (!r) return '';
  const before = props.item.file.size;
  const after = r.blob.size;
  const pct = Math.round((1 - after / before) * 100);
  const sizes = `${formatBytes(before)} → ${formatBytes(after)}`;
  if (r.unchanged) return `${sizes} · ${props.m.unchanged}`;
  return pct >= 0
    ? `${sizes} · ${fill(props.m.saved, { percent: pct })}`
    : `${sizes} · ${fill(props.m.larger, { percent: -pct })}`;
});

const errorText = computed(() => {
  const code = props.item.error ?? 'decode';
  const key = `error.${code}` as keyof Messages<'image'>;
  return props.m[key] ?? props.m['error.decode'];
});
</script>

<template>
  <li class="card flex items-center gap-3 p-3">
    <div
      class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
    >
      <img
        v-if="item.result"
        :src="item.result.url"
        alt=""
        class="size-full object-cover"
        loading="lazy"
      />
      <IconImage v-else class="size-6 text-slate-400" aria-hidden="true" />
    </div>

    <div class="min-w-0 flex-1 space-y-1">
      <p class="truncate text-sm font-semibold">{{ item.result?.name ?? item.file.name }}</p>
      <ProgressBar
        v-if="item.status === 'processing' || item.status === 'queued'"
        :label="item.status === 'queued' ? m.queued : m.processing"
      />
      <p v-else-if="item.status === 'error'" class="error-text">{{ errorText }}</p>
      <p v-else-if="item.result" class="text-xs text-slate-600 dark:text-slate-400">
        <span>{{ item.result.width }}×{{ item.result.height }}</span> · <span>{{ change }}</span>
      </p>
    </div>

    <a
      v-if="item.status === 'done' && item.result"
      :href="item.result.url"
      :download="item.result.name"
      class="btn btn-primary shrink-0"
      @click="emit('downloaded')"
    >
      {{ m.download }}
    </a>
    <button
      type="button"
      class="btn btn-secondary shrink-0 px-2"
      :aria-label="fill(m.remove, { name: item.file.name })"
      @click="emit('remove')"
    >
      <IconX aria-hidden="true" />
    </button>
  </li>
</template>
