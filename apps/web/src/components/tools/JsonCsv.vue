<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce, downloadText, pickTextFile } from '../../lib/download';
import { fill } from '../../lib/format';
import type { Delimiter } from '../../lib/json-csv';
import { parseJson } from '../../lib/json';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'jsonCsv'>;

type Mode = 'json2csv' | 'csv2json';
const mode = ref<Mode>('json2csv');
const delimiter = ref<Delimiter | ''>('');
const input = ref('');
const output = ref('');
const error = ref('');
const info = ref('');

async function convert() {
  error.value = '';
  info.value = '';
  if (!input.value.trim()) {
    output.value = '';
    return;
  }
  // papaparse dimuat saat pertama kali dibutuhkan
  const lib = await import('../../lib/json-csv');
  if (mode.value === 'json2csv') {
    const r = parseJson(input.value);
    if (!r.ok) {
      error.value = fill(m.invalidJson, { message: r.error.message });
      output.value = '';
      return;
    }
    output.value = lib.jsonToCsv(r.value, delimiter.value || ',');
    info.value = fill(m.rows, { n: Array.isArray(r.value) ? r.value.length : 1 });
  } else {
    const r = lib.csvToJson(input.value, delimiter.value || undefined);
    output.value = JSON.stringify(r.rows, null, 2);
    info.value = fill(m.rows, { n: r.rows.length });
    if (r.errors.length) {
      const e = r.errors[0];
      error.value = fill(m.csvError, { row: (e.row ?? 0) + 2, message: e.message });
    }
  }
}

watch(input, debounce(convert, 300));
watch([mode, delimiter], convert);

function swap() {
  if (output.value && !error.value) input.value = output.value;
  mode.value = mode.value === 'json2csv' ? 'csv2json' : 'json2csv';
}

async function open() {
  const f = await pickTextFile('.json,.csv,.tsv,.txt,application/json,text/csv');
  if (!f) return;
  mode.value = f.name.toLowerCase().endsWith('.json') ? 'json2csv' : 'csv2json';
  input.value = f.text;
}

function download() {
  if (mode.value === 'json2csv') downloadText(output.value, 'data.csv', 'text/csv');
  else downloadText(output.value, 'data.json', 'application/json');
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-end gap-2">
      <div class="flex gap-2" role="group">
        <button
          v-for="opt in ['json2csv', 'csv2json'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': mode === opt }"
          :aria-pressed="mode === opt"
          @click="mode = opt"
        >
          {{ opt === 'json2csv' ? m.jsonToCsv : m.csvToJson }}
        </button>
      </div>
      <label class="flex items-center gap-2 text-sm">
        {{ m.delimiter }}
        <select v-model="delimiter" class="field w-auto py-1.5">
          <option value="">{{ mode === 'csv2json' ? m.auto : m.comma }}</option>
          <option v-if="mode === 'csv2json'" value=",">{{ m.comma }}</option>
          <option value=";">{{ m.semicolon }}</option>
          <option value="&#9;">{{ m.tab }}</option>
        </select>
      </label>
      <button type="button" class="btn btn-secondary" @click="open">{{ m.openFile }}</button>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div>
        <label for="jc-in" class="label"
          >{{ m.input }} ({{ mode === 'json2csv' ? 'JSON' : 'CSV' }})</label
        >
        <textarea
          id="jc-in"
          v-model="input"
          class="field h-64 font-mono text-sm sm:h-80"
          :placeholder="mode === 'json2csv' ? m.placeholderJson : m.placeholderCsv"
          spellcheck="false"
        />
      </div>
      <div>
        <label for="jc-out" class="label"
          >{{ m.output }} ({{ mode === 'json2csv' ? 'CSV' : 'JSON' }})</label
        >
        <textarea
          id="jc-out"
          :value="output"
          readonly
          class="field h-64 font-mono text-sm sm:h-80"
          spellcheck="false"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <p aria-live="polite" class="min-h-5 text-sm">
        <span v-if="error" class="error-text">{{ error }}</span>
        <span v-else-if="info" class="text-slate-600 dark:text-slate-400">{{ info }}</span>
      </p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-secondary" @click="swap">⇄</button>
        <button type="button" class="btn btn-secondary" :disabled="!output" @click="download">
          {{ m.download }}
        </button>
        <CopyButton :text="output" :label="m.copy" :copied-label="m.copied" />
      </div>
    </div>
  </div>
</template>
