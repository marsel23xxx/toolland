<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { base64Decode, base64Encode } from '../../lib/encoding';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'base64'>;

const mode = ref<'encode' | 'decode'>('encode');
const urlSafe = ref(false);
const input = ref('');

const result = computed(() => {
  if (!input.value) return { output: '', error: false };
  try {
    return {
      output:
        mode.value === 'encode'
          ? base64Encode(input.value, urlSafe.value)
          : base64Decode(input.value),
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
      <label v-if="mode === 'encode'" class="flex items-center gap-2 py-2 text-sm">
        <input v-model="urlSafe" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.urlSafe }}
      </label>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <label for="b64-in" class="label">{{ m.input }}</label>
        <textarea
          id="b64-in"
          v-model="input"
          class="field h-56 font-mono text-sm sm:h-72"
          :placeholder="mode === 'encode' ? m.placeholderEncode : m.placeholderDecode"
          spellcheck="false"
        />
      </div>
      <div>
        <label for="b64-out" class="label">{{ m.output }}</label>
        <textarea
          id="b64-out"
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
