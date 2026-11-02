<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { downloadText } from '../../lib/download';
import { loadEsbuild, minify, toMinifyError, type MinifyError } from '../../lib/esbuild';
import { fill, formatBytes } from '../../lib/format';
import CopyButton from '../ui/CopyButton.vue';
import ProgressBar from '../ui/ProgressBar.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'minify'>;

const lang = ref<'css' | 'js'>('css');
const input = ref('');
const output = ref('');
const error = ref<MinifyError | null>(null);
const loading = ref(false);
const running = ref(false);

watch(lang, () => {
  output.value = '';
  error.value = null;
});

/** Mulai unduh esbuild saat pengguna menunjukkan niat memakai tool. */
function prefetch() {
  loadEsbuild().catch(() => {});
}

async function run() {
  if (!input.value.trim()) return;
  error.value = null;
  running.value = true;
  const t = window.setTimeout(() => (loading.value = true), 150);
  try {
    output.value = await minify(input.value, lang.value);
  } catch (e) {
    output.value = '';
    error.value = toMinifyError(e);
  } finally {
    window.clearTimeout(t);
    loading.value = false;
    running.value = false;
  }
}

const size = (s: string) => new TextEncoder().encode(s).length;
const saving = computed(() => {
  if (!output.value) return '';
  const before = size(input.value);
  const after = size(output.value);
  return fill(m.saved, {
    before: formatBytes(before),
    after: formatBytes(after),
    percent: before ? Math.max(0, Math.round((1 - after / before) * 100)) : 0,
  });
});

const errorText = computed(() => {
  const e = error.value;
  if (!e) return '';
  return e.line
    ? fill(m.errorAt, { line: e.line, column: e.column ?? 0, message: e.message })
    : e.message;
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-2" role="group">
        <button
          v-for="opt in ['css', 'js'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': lang === opt }"
          :aria-pressed="lang === opt"
          @click="lang = opt"
        >
          {{ m[opt] }}
        </button>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!input.trim() || running"
        @pointerenter="prefetch"
        @click="run"
      >
        {{ m.run }}
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <label for="mf-in" class="label">{{ m.input }}</label>
        <textarea
          id="mf-in"
          v-model="input"
          class="field h-64 font-mono text-sm sm:h-80"
          :placeholder="lang === 'css' ? m.placeholderCss : m.placeholderJs"
          spellcheck="false"
          @focus="prefetch"
        />
      </div>
      <div>
        <label for="mf-out" class="label">{{ m.output }}</label>
        <textarea
          id="mf-out"
          :value="output"
          readonly
          class="field h-64 font-mono text-sm break-all sm:h-80"
          spellcheck="false"
        />
      </div>
    </div>

    <ProgressBar v-if="loading" :label="m.loading" />

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" class="min-h-5 text-sm">
        <span v-if="error" class="error-text">{{ errorText }}</span>
        <span v-else-if="saving" class="font-semibold text-brand-700 dark:text-brand-300">{{
          saving
        }}</span>
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!output"
          @click="
            downloadText(
              output,
              lang === 'css' ? 'style.min.css' : 'script.min.js',
              lang === 'css' ? 'text/css' : 'text/javascript',
            )
          "
        >
          {{ m.download }}
        </button>
        <CopyButton :text="output" :label="m.copy" :copied-label="m.copied" />
      </div>
    </div>
  </div>
</template>
