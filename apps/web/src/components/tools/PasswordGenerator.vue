<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import IconRefresh from '~icons/lucide/refresh-cw';
import type { ToolMessages } from '../../i18n';
import { fill } from '../../lib/format';
import { generatePassword, passwordEntropy, type PasswordOptions } from '../../lib/random';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'password'>;

const o = reactive<PasswordOptions>({
  length: 16,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
});
const password = ref('');
const hasCharset = computed(() => o.lower || o.upper || o.digits || o.symbols);

function generate() {
  o.length = Math.min(Math.max(4, Number(o.length) || 16), 128);
  password.value = hasCharset.value ? generatePassword(o) : '';
}

onMounted(generate);
watch(o, generate);

const entropy = computed(() => passwordEntropy(o));
const strength = computed(() => {
  const b = entropy.value;
  if (b < 40) return { label: m.weak, cls: 'bg-red-600', width: 'w-1/4' };
  if (b < 60) return { label: m.fair, cls: 'bg-amber-500', width: 'w-2/4' };
  if (b < 80) return { label: m.strong, cls: 'bg-brand-600', width: 'w-3/4' };
  return { label: m.veryStrong, cls: 'bg-green-600', width: 'w-full' };
});

const options = ['lower', 'upper', 'digits', 'symbols', 'excludeAmbiguous'] as const;
</script>

<template>
  <div class="space-y-4">
    <div class="card space-y-3">
      <label for="pw-out" class="sr-only">{{ m.result }}</label>
      <div class="flex items-center gap-2">
        <input
          id="pw-out"
          :value="password"
          readonly
          class="field font-mono text-lg sm:text-xl"
          spellcheck="false"
          autocomplete="off"
        />
        <button
          type="button"
          class="btn btn-secondary shrink-0"
          :aria-label="m.regenerate"
          :disabled="!hasCharset"
          @click="generate"
        >
          <IconRefresh aria-hidden="true" />
        </button>
        <CopyButton class="shrink-0" :text="password" :label="m.copy" :copied-label="m.copied" />
      </div>
      <div v-if="hasCharset" class="flex items-center gap-3 text-sm">
        <span class="font-medium">{{ m.strength }}:</span>
        <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full rounded-full transition-all" :class="[strength.cls, strength.width]" />
        </div>
        <span class="font-semibold">{{ strength.label }}</span>
        <span class="hidden text-slate-600 sm:inline dark:text-slate-400"
          >({{ fill(m.entropy, { bits: entropy }) }})</span
        >
      </div>
      <p v-else class="error-text">{{ m.noCharset }}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label for="pw-len" class="label">{{ m.length }}: {{ o.length }}</label>
        <div class="flex items-center gap-3">
          <input
            id="pw-len"
            v-model.number="o.length"
            type="range"
            min="4"
            max="128"
            class="w-full accent-brand-600"
          />
          <input
            v-model.number="o.length"
            type="number"
            min="4"
            max="128"
            class="field w-20 py-1"
            :aria-label="m.length"
          />
        </div>
      </div>
      <fieldset class="space-y-1">
        <legend class="sr-only">{{ m.strength }}</legend>
        <label v-for="opt in options" :key="opt" class="flex items-center gap-2 text-sm">
          <input v-model="o[opt]" type="checkbox" class="size-4 accent-brand-600" />
          {{ m[opt] }}
        </label>
      </fieldset>
    </div>
  </div>
</template>
