<script setup lang="ts">
/**
 * Kartu donasi kecil setelah unduhan berhasil. Paling banyak sekali per sesi (sessionStorage),
 * tanpa popup dan tanpa menunda unduhan. Tidak tampil bila link Saweria belum diatur.
 */
import { onMounted, ref, watch } from 'vue';
import IconHeart from '~icons/lucide/heart';
import IconX from '~icons/lucide/x';
import type { Messages } from '../../i18n';
import { SITE } from '../../lib/site';

const props = defineProps<{ m: Messages<'donate'>; trigger: number }>();
const KEY = 'toolland:donate-shown';
const visible = ref(false);
let shownBefore = true;

onMounted(() => {
  try {
    shownBefore = sessionStorage.getItem(KEY) === '1';
  } catch {
    shownBefore = false;
  }
});

watch(
  () => props.trigger,
  (n) => {
    if (!n || !SITE.saweria || shownBefore) return;
    shownBefore = true;
    visible.value = true;
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* mode privat: abaikan */
    }
  },
);
</script>

<template>
  <aside
    v-if="visible"
    class="card relative flex items-start gap-3 border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/30"
  >
    <IconHeart
      class="mt-0.5 size-5 shrink-0 text-brand-600 dark:text-brand-300"
      aria-hidden="true"
    />
    <div class="space-y-2 pr-6">
      <p class="font-semibold">{{ m.title }}</p>
      <p class="text-sm text-slate-700 dark:text-slate-300">{{ m.text }}</p>
      <a :href="SITE.saweria" target="_blank" rel="noopener" class="btn btn-primary">{{
        m.button
      }}</a>
    </div>
    <button
      type="button"
      class="absolute top-2 right-2 rounded p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      :aria-label="m.close"
      @click="visible = false"
    >
      <IconX aria-hidden="true" />
    </button>
  </aside>
</template>
