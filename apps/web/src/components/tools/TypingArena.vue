<script setup lang="ts">
/**
 * Tool tes mengetik: dua mode dalam satu halaman, yaitu game luar angkasa "Laskar Kata" (bawaan)
 * dan tes klasik. Pilihan tab diingat di localStorage.
 */
import { defineAsyncComponent, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import TypingGame from './TypingGame.vue';

const TypingTest = defineAsyncComponent(() => import('./TypingTest.vue'));

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'typing'>;

const KEY = 'toolland-typing-tab';
type Tab = 'game' | 'classic';
let saved: Tab = 'game';
try {
  if (localStorage.getItem(KEY) === 'classic') saved = 'classic';
} catch {
  // Penyimpanan tidak tersedia.
}
const tab = ref<Tab>(saved);
function select(t: Tab) {
  tab.value = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // Abaikan.
  }
}
</script>

<template>
  <div class="space-y-4">
    <div role="tablist" :aria-label="m.modeLabel" class="flex gap-1.5 border-b border-rule">
      <button
        v-for="t in ['game', 'classic'] as const"
        :key="t"
        type="button"
        role="tab"
        :aria-selected="tab === t"
        class="-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors"
        :class="
          tab === t
            ? 'border-brand-600 text-ink dark:border-brand-400'
            : 'border-transparent text-ink-3 hover:text-ink'
        "
        :data-ty-tab="t"
        @click="select(t)"
      >
        {{ t === 'game' ? `🚀 ${m.tabGame}` : `⌨ ${m.tabClassic}` }}
      </button>
    </div>
    <TypingGame v-if="tab === 'game'" :m="m" />
    <TypingTest v-else :m="m" />
  </div>
</template>
