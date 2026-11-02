<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { downloadText } from '../../lib/download';
import { uuidv7 } from '../../lib/random';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'uuid'>;

const version = ref<'v4' | 'v7'>('v4');
const count = ref(5);
const uppercase = ref(false);
const hyphens = ref(true);
const output = ref('');

function generate() {
  const n = Math.min(Math.max(1, Number(count.value) || 1), 1000);
  const ids = Array.from({ length: n }, () =>
    version.value === 'v4' ? crypto.randomUUID() : uuidv7(),
  );
  output.value = ids
    .map((id) => (hyphens.value ? id : id.replace(/-/g, '')))
    .map((id) => (uppercase.value ? id.toUpperCase() : id))
    .join('\n');
}

onMounted(generate);
watch([version, count, uppercase, hyphens], generate);
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="uu-ver" class="label">{{ m.version }}</label>
        <select id="uu-ver" v-model="version" class="field w-40">
          <option value="v4">{{ m.v4 }}</option>
          <option value="v7">{{ m.v7 }}</option>
        </select>
      </div>
      <div>
        <label for="uu-count" class="label">{{ m.count }}</label>
        <input
          id="uu-count"
          v-model.number="count"
          type="number"
          min="1"
          max="1000"
          class="field w-28"
        />
      </div>
      <label class="flex items-center gap-2 py-2 text-sm">
        <input v-model="uppercase" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.uppercase }}
      </label>
      <label class="flex items-center gap-2 py-2 text-sm">
        <input v-model="hyphens" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.hyphens }}
      </label>
    </div>
    <label for="uu-out" class="sr-only">{{ m.output }}</label>
    <textarea
      id="uu-out"
      :value="output"
      readonly
      class="field h-64 font-mono text-sm sm:h-80"
      spellcheck="false"
    />
    <div class="flex flex-wrap justify-end gap-2">
      <button type="button" class="btn btn-primary" @click="generate">{{ m.generate }}</button>
      <button type="button" class="btn btn-secondary" @click="downloadText(output, 'uuid.txt')">
        {{ m.download }}
      </button>
      <CopyButton :text="output" :label="m.copy" :copied-label="m.copied" />
    </div>
  </div>
</template>
