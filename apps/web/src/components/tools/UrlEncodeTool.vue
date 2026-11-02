<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { urlDecode, urlEncode, type UrlMode } from '../../lib/encoding';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'urlEncode'>;

const mode = ref<'encode' | 'decode'>('encode');
const scope = ref<UrlMode>('component');
const plusAsSpace = ref(true);
const input = ref('');

const result = computed(() => {
  if (!input.value) return { output: '', error: false };
  try {
    return {
      output:
        mode.value === 'encode'
          ? urlEncode(input.value, scope.value)
          : urlDecode(input.value, plusAsSpace.value),
      error: false,
    };
  } catch {
    return { output: '', error: true };
  }
});

function swap() {
  if (!result.value.error) input.value = result.value.output;
  mode.value = mode.value === 'encode' ? 'decode' : 'encode';
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-2" role="group">
        <button
          v-for="opt in ['encode', 'decode'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': mode === opt }"
          :aria-pressed="mode === opt"
          @click="mode = opt"
        >
          {{ m[opt] }}
        </button>
      </div>
      <select
        v-if="mode === 'encode'"
        v-model="scope"
        class="field w-auto py-1.5 text-sm"
        :aria-label="m.encode"
      >
        <option value="component">{{ m.component }}</option>
        <option value="full">{{ m.full }}</option>
      </select>
      <label v-else class="flex items-center gap-2 py-2 text-sm">
        <input v-model="plusAsSpace" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.plusAsSpace }}
      </label>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <label for="url-in" class="label">{{ m.input }}</label>
        <textarea
          id="url-in"
          v-model="input"
          class="field h-56 font-mono text-sm sm:h-72"
          :placeholder="mode === 'encode' ? m.placeholderEncode : m.placeholderDecode"
          spellcheck="false"
        />
      </div>
      <div>
        <label for="url-out" class="label">{{ m.output }}</label>
        <textarea
          id="url-out"
          :value="result.output"
          readonly
          class="field h-56 font-mono text-sm break-all sm:h-72"
        />
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" class="min-h-5">
        <span v-if="result.error" class="error-text">{{ m.invalid }}</span>
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary" @click="swap">⇄ {{ m.swap }}</button>
        <button type="button" class="btn btn-secondary" :disabled="!input" @click="input = ''">
          {{ m.clear }}
        </button>
        <CopyButton :text="result.output" :label="m.copy" :copied-label="m.copied" />
      </div>
    </div>
  </div>
</template>
