<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { lorem, type LoremUnit } from '../../lib/lorem';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'lorem'>;

const LIMITS: Record<LoremUnit, number> = { paragraphs: 100, sentences: 500, words: 5000 };
const count = ref(3);
const unit = ref<LoremUnit>('paragraphs');
const startWithLorem = ref(true);
const output = ref('');

function generate() {
  const n = Math.min(Math.max(1, Number(count.value) || 1), LIMITS[unit.value]);
  output.value = lorem(n, unit.value, startWithLorem.value);
}

// Dibuat di browser (bukan saat build) agar hasil acak tidak bentrok dengan HTML statis.
onMounted(generate);
watch([count, unit, startWithLorem], generate);
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="li-count" class="label">{{ m.count }}</label>
        <input
          id="li-count"
          v-model.number="count"
          type="number"
          min="1"
          :max="LIMITS[unit]"
          class="field w-28"
        />
      </div>
      <div>
        <label for="li-unit" class="label">{{ m.unit }}</label>
        <select id="li-unit" v-model="unit" class="field w-40">
          <option value="paragraphs">{{ m.paragraphs }}</option>
          <option value="sentences">{{ m.sentences }}</option>
          <option value="words">{{ m.words }}</option>
        </select>
      </div>
      <label class="flex items-center gap-2 py-2 text-sm">
        <input v-model="startWithLorem" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.startWithLorem }}
      </label>
    </div>
    <label for="li-output" class="sr-only">{{ m.output }}</label>
    <textarea id="li-output" :value="output" readonly class="field h-64 sm:h-80" />
    <div class="flex flex-wrap justify-end gap-2">
      <button type="button" class="btn btn-secondary" @click="generate">{{ m.regenerate }}</button>
      <CopyButton :text="output" :label="m.copy" :copied-label="m.copied" />
    </div>
  </div>
</template>
