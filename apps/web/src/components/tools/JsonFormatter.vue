<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce, downloadText } from '../../lib/download';
import { fill } from '../../lib/format';
import { formatJson, parseJson, type Indent, type JsonError } from '../../lib/json';
import CodeEditor from '../ui/CodeEditor.vue';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'jsonFormatter'>;

const text = ref('');
const indent = ref<Indent>(2);
const sortKeys = ref(false);
const error = ref<JsonError | null>(null);
const valid = ref(false);

function validate() {
  if (!text.value.trim()) {
    error.value = null;
    valid.value = false;
    return null;
  }
  const r = parseJson(text.value);
  error.value = r.ok ? null : r.error;
  valid.value = r.ok;
  return r.ok ? r : null;
}

watch(text, debounce(validate, 300));

function format(minify = false) {
  const r = validate();
  if (r) text.value = formatJson(r.value, minify ? 0 : indent.value, sortKeys.value);
}

const errorText = computed(() => {
  const e = error.value;
  if (!e) return '';
  return e.line
    ? fill(m.invalidAt, { line: e.line, column: e.column ?? 0, message: e.message })
    : fill(m.invalid, { message: e.message });
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-2">
      <button type="button" class="btn btn-primary" :disabled="!text" @click="format()">
        {{ m.format }}
      </button>
      <button type="button" class="btn btn-secondary" :disabled="!text" @click="format(true)">
        {{ m.minify }}
      </button>
      <label class="ml-1 flex items-center gap-2 text-sm">
        {{ m.indent }}
        <select v-model="indent" class="field w-auto py-1.5">
          <option :value="2">{{ fill(m.spaces, { n: 2 }) }}</option>
          <option :value="4">{{ fill(m.spaces, { n: 4 }) }}</option>
          <option value="tab">{{ m.tab }}</option>
        </select>
      </label>
      <label class="flex items-center gap-2 py-2 text-sm">
        <input v-model="sortKeys" type="checkbox" class="size-4 accent-brand-600" />
        {{ m.sortKeys }}
      </label>
    </div>

    <CodeEditor v-model="text" language="json" :label="m.label" :placeholder="m.placeholder" />

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" class="min-h-5 text-sm">
        <span v-if="error" class="error-text">{{ errorText }}</span>
        <span v-else-if="valid" class="font-semibold text-brand-700 dark:text-brand-300"
          >✓ {{ m.valid }}</span
        >
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary" :disabled="!text" @click="text = ''">
          {{ m.clear }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!valid"
          @click="downloadText(text, 'data.json', 'application/json')"
        >
          {{ m.download }}
        </button>
        <CopyButton :text="text" :label="m.copy" :copied-label="m.copied" />
      </div>
    </div>
  </div>
</template>
