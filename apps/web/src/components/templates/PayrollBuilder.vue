<script setup lang="ts">
/**
 * Form pengaturan template SDM & Penggajian. File .xlsx dibuat di browser saat tombol unduh
 * diklik; kode pembuatnya dimuat terpisah (dynamic import) agar halaman tetap ringan.
 */
import { computed, ref } from 'vue';
import IconDownload from '~icons/lucide/download';
import IconShieldCheck from '~icons/lucide/shield-check';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { JKK_RATES } from '../../lib/templates/payroll-rules';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as Messages<'payrollBuilder'>;
const msg = props.m;

const MAX_DEPT = 20;
const DEFAULT_DEPT = {
  id: ['Operasional', 'Penjualan', 'Keuangan', 'Gudang', 'Administrasi'],
  en: ['Operations', 'Sales', 'Finance', 'Warehouse', 'Administration'],
};

const locale = pageLocale();
const thisYear = new Date().getFullYear();
const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

const company = ref('');
const year = ref(thisYear);
const jkk = ref<number>(JKK_RATES[0]);
const departments = ref(DEFAULT_DEPT[locale].join('\n'));
const sample = ref(false);
const busy = ref(false);
const status = ref('');
const error = ref('');

const lines = (s: string, max: number) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
const counts = computed(() => ({ d: lines(departments.value, MAX_DEPT).length }));

function fileName(): string {
  const base = locale === 'id' ? 'SDM-Penggajian' : 'HR-Payroll';
  const name = company.value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${[base, name, year.value].filter(Boolean).join('-')}.xlsx`;
}

async function download() {
  busy.value = true;
  status.value = '';
  error.value = '';
  try {
    const { buildPayrollWorkbook } = await import('../../lib/templates/sdm-penggajian');
    const wb = buildPayrollWorkbook({
      locale,
      company: company.value,
      year: year.value,
      departments: lines(departments.value, MAX_DEPT),
      jkk: jkk.value,
      sample: sample.value,
    });
    const name = fileName();
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
    <h2 class="font-display text-2xl">{{ m.customize }}</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_1.8fr]">
      <div class="sm:col-span-2 lg:col-span-1">
        <label for="pay-company" class="label">{{ m.company }}</label>
        <input
          id="pay-company"
          v-model="company"
          type="text"
          maxlength="80"
          autocomplete="organization"
          class="field"
          :placeholder="m.companyPh"
        />
      </div>
      <div>
        <label for="pay-year" class="label">{{ m.year }}</label>
        <select id="pay-year" v-model.number="year" class="field">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div>
        <label for="pay-jkk" class="label">{{ m.jkk }}</label>
        <select id="pay-jkk" v-model.number="jkk" class="field">
          <option v-for="r in JKK_RATES" :key="r" :value="r">{{ msg[`jkk.${r}`] }}</option>
        </select>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-[1fr_1.4fr]">
      <div>
        <label for="pay-departments" class="label">{{ m.departments }}</label>
        <textarea
          id="pay-departments"
          v-model="departments"
          rows="6"
          class="field font-mono text-sm"
          spellcheck="false"
          aria-describedby="pay-departments-hint"
        />
        <p id="pay-departments-hint" class="mt-1 text-xs text-ink-3">
          {{ fill(m.oneLine, { n: MAX_DEPT }) }}
        </p>
      </div>
      <p
        class="flex items-start gap-3 self-start rounded-md border border-rule bg-paper p-4 text-sm leading-relaxed text-ink-2"
      >
        <IconShieldCheck class="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
        {{ m.rules }}
      </p>
    </div>

    <label class="flex items-start gap-3">
      <input v-model="sample" type="checkbox" class="mt-1 size-4 accent-brand-600" />
      <span>
        <span class="font-semibold">{{ m.sample }}</span>
        <span class="block text-sm text-ink-3">{{ m.sampleHint }}</span>
      </span>
    </label>

    <div class="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
      <button id="pay-download" type="submit" class="btn btn-primary" :disabled="busy">
        <IconDownload aria-hidden="true" />
        {{ busy ? m.building : m.download }}
      </button>
      <span class="text-sm text-ink-3">{{ fill(m.summary, counts) }}</span>
    </div>
    <p v-if="status" role="status" class="text-sm font-medium text-brand-700 dark:text-brand-300">
      {{ status }}
    </p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
  </form>
</template>
