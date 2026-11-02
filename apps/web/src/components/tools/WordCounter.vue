<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill } from '../../lib/format';
import { textStats } from '../../lib/text-stats';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'wordCounter'>;

const text = ref('');
const stats = ref(textStats(''));
let timer: number | undefined;

// Teks pendek dihitung langsung; teks sangat panjang ditunda sedikit agar mengetik tetap lancar.
watch(text, (t) => {
  window.clearTimeout(timer);
  if (t.length < 50_000) stats.value = textStats(t);
  else timer = window.setTimeout(() => (stats.value = textStats(t)), 150);
});

const nf = new Intl.NumberFormat('id-ID');
const items = computed(() => [
  { label: m.words, value: nf.format(stats.value.words) },
  { label: m.characters, value: nf.format(stats.value.characters) },
  { label: m.charactersNoSpaces, value: nf.format(stats.value.charactersNoSpaces) },
  { label: m.sentences, value: nf.format(stats.value.sentences) },
  { label: m.paragraphs, value: nf.format(stats.value.paragraphs) },
  { label: m.readingTime, value: fill(m.minutes, { n: stats.value.readingMinutes }) },
]);
</script>

<template>
  <div class="space-y-3">
    <dl class="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-live="polite">
      <div v-for="item in items" :key="item.label" class="card px-3 py-2 text-center">
        <dt class="text-xs text-slate-600 dark:text-slate-400">{{ item.label }}</dt>
        <dd class="text-xl font-bold tabular-nums">{{ item.value }}</dd>
      </div>
    </dl>
    <label for="wc-text" class="sr-only">{{ m.label }}</label>
    <textarea id="wc-text" v-model="text" class="field h-64 sm:h-80" :placeholder="m.placeholder" />
    <div class="flex justify-end">
      <button type="button" class="btn btn-secondary" :disabled="!text" @click="text = ''">
        {{ m.clear }}
      </button>
    </div>
  </div>
</template>
