<script setup lang="ts">
/**
 * Tool tes mengetik: dua mode dalam satu halaman, yaitu game luar angkasa "Laskar Kata" (bawaan)
 * dan tes klasik. Pilihan tab diingat di localStorage. Keduanya bisa dibuka layar penuh; bila
 * browser tidak mendukung Fullscreen API (mis. Safari iPhone), arena menutupi seluruh jendela.
 */
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
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

const rootEl = ref<HTMLDivElement>();
/** Layar penuh asli (Fullscreen API). */
const nativeFs = ref(false);
/** Layar penuh tiruan: menutupi jendela saat Fullscreen API tidak tersedia. */
const pseudoFs = ref(false);
const isFs = () => nativeFs.value || pseudoFs.value;

function setPseudo(on: boolean) {
  pseudoFs.value = on;
  document.documentElement.classList.toggle('overflow-hidden', on);
}

async function toggleFullscreen() {
  if (nativeFs.value) {
    await document.exitFullscreen().catch(() => undefined);
    return;
  }
  if (pseudoFs.value) {
    setPseudo(false);
    return;
  }
  const el = rootEl.value;
  if (el && document.fullscreenEnabled && el.requestFullscreen) {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' });
      return;
    } catch {
      // Ditolak browser: pakai mode tiruan.
    }
  }
  setPseudo(true);
}

function onFsChange() {
  nativeFs.value = document.fullscreenElement === rootEl.value && !!rootEl.value;
}

onMounted(() => document.addEventListener('fullscreenchange', onFsChange));
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange);
  if (pseudoFs.value) setPseudo(false);
  if (nativeFs.value) void document.exitFullscreen().catch(() => undefined);
});
</script>

<template>
  <div
    ref="rootEl"
    :class="
      isFs()
        ? 'flex flex-col gap-4 overflow-auto bg-paper p-3 sm:p-5' +
          (pseudoFs ? ' fixed inset-0 z-[60]' : ' h-full w-full')
        : 'space-y-4'
    "
    :data-ty-fs="isFs() ? (nativeFs ? 'native' : 'pseudo') : undefined"
  >
    <div
      role="tablist"
      :aria-label="m.modeLabel"
      class="flex shrink-0 items-end gap-1.5 border-b border-rule"
    >
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
      <button
        type="button"
        class="mb-1 ml-auto inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold text-ink-2 hover:bg-paper-2 hover:text-ink"
        :aria-pressed="isFs()"
        data-ty-fullscreen
        @click="toggleFullscreen"
      >
        <span aria-hidden="true">{{ isFs() ? '🗗' : '⛶' }}</span>
        <span class="hidden sm:inline">{{ isFs() ? m.exitFullscreen : m.fullscreen }}</span>
        <span class="sr-only sm:hidden">{{ isFs() ? m.exitFullscreen : m.fullscreen }}</span>
      </button>
    </div>
    <TypingGame
      v-if="tab === 'game'"
      :m="m"
      :fullscreen="isFs()"
      :class="isFs() ? 'min-h-0 flex-1' : ''"
    />
    <div v-else :class="isFs() ? 'mx-auto w-full max-w-5xl' : ''">
      <TypingTest :m="m" />
    </div>
  </div>
</template>
