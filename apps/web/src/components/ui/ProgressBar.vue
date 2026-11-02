<script setup lang="ts">
/**
 * Progress satu file. Memakai elemen <progress> asli (aksesibel tanpa ARIA tambahan,
 * dan tanpa atribut style inline sehingga aman dengan CSP ketat).
 * Tanpa `value` = progress tak tentu (misalnya saat memuat WASM).
 */
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  /** 0 sampai 100. Kosongkan untuk mode tak tentu. */
  value?: number;
  /** Teks tambahan di kanan, misalnya estimasi waktu "± 12 detik". */
  detail?: string;
}>();

const percent = computed(() =>
  props.value === undefined ? undefined : Math.round(Math.min(100, Math.max(0, props.value))),
);
</script>

<template>
  <div class="w-full">
    <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
      <span class="truncate font-medium">{{ label }}</span>
      <span class="shrink-0 text-slate-600 tabular-nums dark:text-slate-400">
        <template v-if="detail">{{ detail }}</template>
        <template v-if="detail && percent !== undefined"> · </template>
        <template v-if="percent !== undefined">{{ percent }}%</template>
      </span>
    </div>
    <progress
      class="block h-2 w-full appearance-none overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800 [&::-moz-progress-bar]:bg-brand-600 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand-600 dark:[&::-moz-progress-bar]:bg-brand-400 dark:[&::-webkit-progress-value]:bg-brand-400"
      max="100"
      :value="percent"
      :aria-label="label"
    />
  </div>
</template>
