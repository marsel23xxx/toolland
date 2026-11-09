<script setup lang="ts">
/**
 * Form generik template Excel: field diambil dari konfigurasi template (lib/templates/form.ts).
 * File .xlsx dibuat di browser saat tombol unduh diklik; kode template dimuat terpisah.
 */
import { computed, reactive, ref, watch } from 'vue';
import IconDownload from '~icons/lucide/download';
import IconInfo from '~icons/lucide/info';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { CURRENCIES } from '../../lib/templates/currencies';
import type { FormField, FormValues, TemplateForm } from '../../lib/templates/form';

const props = defineProps<{ form: TemplateForm; m: Record<string, string> }>();
const m = props.m as Messages<'tplForm'>;
const f = props.form;

type Builder = { buildFromForm: (v: FormValues) => { toBlob(): Blob } };
const LOADERS: Record<string, () => Promise<Builder>> = {
  invoice: () => import('../../lib/templates/invoice-penawaran'),
  rab: () => import('../../lib/templates/rab-proyek'),
  schedule: () => import('../../lib/templates/jadwal-proyek'),
  sales: () => import('../../lib/templates/kasir-penjualan'),
};

const locale = pageLocale();
const thisYear = new Date().getFullYear();
const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

/** Tanggal awal "today+N" dihitung di browser agar selalu relatif ke hari ini. */
function initial(field: FormField): string | number {
  if (field.kind === 'year') return Number(field.value ?? thisYear);
  if (field.kind === 'currency') return String(field.value ?? (locale === 'id' ? 'IDR' : 'USD'));
  if (field.kind === 'date' && typeof field.value === 'string' && field.value.startsWith('today')) {
    const d = new Date();
    d.setDate(d.getDate() + Number(field.value.slice(6) || 0));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return field.value ?? '';
}

const values = reactive<Record<string, string | number>>(
  Object.fromEntries(f.fields.map((x) => [x.key, initial(x)])),
);
const preset = ref(f.presets?.options[0]?.value ?? '');
const sample = ref(false);
const busy = ref(false);
const status = ref('');
const error = ref('');

watch(preset, (p) => {
  const fillMap = f.presets?.fill[p];
  if (fillMap) for (const [k, v] of Object.entries(fillMap)) values[k] = v;
});

const topFields = f.fields.filter((x) => x.kind !== 'list');
const listFields = f.fields.filter((x) => x.kind === 'list');
const listCols = { 1: 'md:grid-cols-2', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }[
  Math.min(3, listFields.length + (f.note && listFields.length < 3 ? 1 : 0)) as 1 | 2 | 3
];
const span = (x: FormField) =>
  ({ 1: '', 2: 'sm:col-span-2', 4: 'sm:col-span-2 lg:col-span-4' })[x.span ?? 1];

const lines = (s: string, max = 100) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);

function collect(): FormValues {
  const out: FormValues = { locale, sample: sample.value };
  if (f.presets) out[f.presets.key] = preset.value;
  for (const x of f.fields)
    out[x.key] = x.kind === 'list' ? lines(String(values[x.key]), x.max) : values[x.key];
  return out;
}

const fileName = computed(() => {
  const name = String(f.fileKey ? values[f.fileKey] : '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const year = f.fields.find((x) => x.kind === 'year');
  return `${[f.fileBase, name, year ? values[year.key] : ''].filter(Boolean).join('-')}.xlsx`;
});

async function download() {
  busy.value = true;
  status.value = '';
  error.value = '';
  try {
    const mod = await LOADERS[f.template]();
    const wb = mod.buildFromForm(collect());
    const name = fileName.value;
    downloadBlob(wb.toBlob(), name);
    status.value = fill(m.done, { file: name });
  } catch (e) {
    console.error(e);
    error.value = m.error;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="download">
    <h2 class="font-display text-2xl">{{ f.heading }}</h2>

    <div v-if="topFields.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="x in topFields" :key="x.key" :class="span(x)">
        <label :for="`tf-${x.key}`" class="label">{{ x.label }}</label>
        <select
          v-if="x.kind === 'year'"
          :id="`tf-${x.key}`"
          v-model.number="values[x.key]"
          class="field"
        >
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
        <select
          v-else-if="x.kind === 'currency'"
          :id="`tf-${x.key}`"
          v-model="values[x.key]"
          class="field"
        >
          <option v-for="(c, code) in CURRENCIES" :key="code" :value="code">
            {{ code }} ({{ c.symbol }})
          </option>
        </select>
        <select
          v-else-if="x.kind === 'select'"
          :id="`tf-${x.key}`"
          v-model="values[x.key]"
          class="field"
        >
          <option v-for="o in x.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <input
          v-else-if="x.kind === 'number'"
          :id="`tf-${x.key}`"
          v-model.number="values[x.key]"
          type="number"
          :min="x.min"
          :max="x.max"
          :step="x.step ?? 1"
          class="field"
        />
        <input
          v-else-if="x.kind === 'date'"
          :id="`tf-${x.key}`"
          v-model="values[x.key]"
          type="date"
          class="field"
        />
        <input
          v-else
          :id="`tf-${x.key}`"
          v-model="values[x.key]"
          type="text"
          maxlength="80"
          class="field"
          :placeholder="x.placeholder"
        />
        <p v-if="x.hint" class="mt-1 text-xs text-ink-3">{{ x.hint }}</p>
      </div>
    </div>

    <fieldset v-if="f.presets">
      <legend class="label">{{ f.presets.label }}</legend>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="o in f.presets.options"
          :key="o.value"
          class="btn cursor-pointer"
          :class="preset === o.value ? 'btn-active' : 'btn-secondary'"
        >
          <input
            v-model="preset"
            type="radio"
            :name="`tf-${f.presets.key}`"
            :value="o.value"
            class="sr-only"
          />
          {{ o.label }}
        </label>
      </div>
      <p v-if="f.presets.hint" class="mt-2 text-sm text-ink-3">{{ f.presets.hint }}</p>
    </fieldset>

    <div v-if="listFields.length || f.note" class="grid gap-4" :class="listCols">
      <div v-for="x in listFields" :key="x.key">
        <label :for="`tf-${x.key}`" class="label">{{ x.label }}</label>
        <textarea
          :id="`tf-${x.key}`"
          v-model="values[x.key]"
          rows="8"
          class="field font-mono text-sm"
          spellcheck="false"
          :aria-describedby="`tf-${x.key}-hint`"
        />
        <p :id="`tf-${x.key}-hint`" class="mt-1 text-xs text-ink-3">
          {{ x.hint ?? fill(m.oneLine, { n: x.max ?? 50 }) }}
        </p>
      </div>
      <p
        v-if="f.note"
        class="flex items-start gap-3 self-start rounded-md border border-rule bg-paper p-4 text-sm leading-relaxed text-ink-2"
      >
        <IconInfo class="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
        {{ f.note }}
      </p>
    </div>

    <label class="flex items-start gap-3">
      <input v-model="sample" type="checkbox" class="mt-1 size-4 accent-brand-600" />
      <span>
        <span class="font-semibold">{{ f.sample.label }}</span>
        <span class="block text-sm text-ink-3">{{ f.sample.hint }}</span>
      </span>
    </label>

    <div class="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
      <button id="tf-download" type="submit" class="btn btn-primary" :disabled="busy">
        <IconDownload aria-hidden="true" />
        {{ busy ? m.building : m.download }}
      </button>
    </div>
    <p v-if="status" role="status" class="text-sm font-medium text-brand-700 dark:text-brand-300">
      {{ status }}
    </p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
  </form>
</template>
