<script setup lang="ts">
import { ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { CASE_MODES, convertCase, type CaseMode } from '../../lib/case';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'caseConverter'>;

const text = ref('');
const previous = ref<string | null>(null);
const active = ref<CaseMode | null>(null);

function apply(mode: CaseMode) {
  previous.value = text.value;
  text.value = convertCase(text.value, mode);
  active.value = mode;
}

function undo() {
  if (previous.value === null) return;
  text.value = previous.value;
  previous.value = null;
  active.value = null;
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="group">
      <button
        v-for="mode in CASE_MODES"
        :key="mode"
        type="button"
        class="btn btn-secondary font-mono"
        :class="{ 'btn-active': active === mode }"
        :disabled="!text"
        @click="apply(mode)"
      >
        {{ m[mode] }}
      </button>
    </div>
    <label for="cc-text" class="sr-only">{{ m.label }}</label>
    <textarea
      id="cc-text"
      v-model="text"
      class="field h-64 sm:h-80"
      :placeholder="m.placeholder"
      @input="active = null"
    />
    <div class="flex flex-wrap justify-end gap-2">
      <button type="button" class="btn btn-secondary" :disabled="previous === null" @click="undo">
        {{ m.undo }}
      </button>
      <button type="button" class="btn btn-secondary" :disabled="!text" @click="text = ''">
        {{ m.clear }}
      </button>
      <CopyButton :text="text" :label="m.copy" :copied-label="m.copied" />
    </div>
  </div>
</template>
