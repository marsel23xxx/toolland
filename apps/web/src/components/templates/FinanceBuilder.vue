<script setup lang="ts">
/**
 * Form pengaturan template Keuangan UMKM. File .xlsx dibuat di browser saat tombol unduh diklik;
 * kode pembuatnya dimuat terpisah (dynamic import) agar halaman tetap ringan.
 */
import { computed, ref, watch } from 'vue';
import IconDownload from '~icons/lucide/download';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { CURRENCIES, type Currency } from '../../lib/templates/currencies';
import {
  FINANCE_DEFAULT_ACCOUNTS,
  FINANCE_LIMITS,
  FINANCE_PRESETS,
  type FinancePresetId,
} from '../../lib/templates/finance-presets';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as Messages<'financeBuilder'>;
const msg = props.m;

const locale = pageLocale();
const PRESET_IDS = Object.keys(FINANCE_PRESETS.id) as FinancePresetId[];
const thisYear = new Date().getFullYear();
const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

const business = ref('');
const year = ref(thisYear);
const currency = ref<Currency>(locale === 'id' ? 'IDR' : 'USD');
const preset = ref<FinancePresetId>('umum');
const accounts = ref(FINANCE_DEFAULT_ACCOUNTS[locale].join('\n'));
const income = ref(FINANCE_PRESETS[locale].umum.income.join('\n'));
const expense = ref(FINANCE_PRESETS[locale].umum.expense.join('\n'));
const sample = ref(false);
const busy = ref(false);
const status = ref('');
const error = ref('');

watch(preset, (p) => {
  income.value = FINANCE_PRESETS[locale][p].income.join('\n');
  expense.value = FINANCE_PRESETS[locale][p].expense.join('\n');
});

const lines = (s: string, max: number) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
const counts = computed(() => ({
  a: lines(accounts.value, FINANCE_LIMITS.accounts).length,
  i: lines(income.value, FINANCE_LIMITS.income).length,
  e: lines(expense.value, FINANCE_LIMITS.expense).length,
}));

function fileName(): string {
  const base = locale === 'id' ? 'Keuangan-UMKM' : 'Small-Business-Finance';
  const name = business.value
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
    const { buildFinanceWorkbook } = await import('../../lib/templates/keuangan-umkm');
    const wb = buildFinanceWorkbook({
      locale,
      business: business.value,
      year: year.value,
      currency: currency.value,
      accounts: lines(accounts.value, FINANCE_LIMITS.accounts),
      incomeCats: lines(income.value, FINANCE_LIMITS.income),
      expenseCats: lines(expense.value, FINANCE_LIMITS.expense),
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

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="sm:col-span-2">
        <label for="fin-business" class="label">{{ m.business }}</label>
        <input
          id="fin-business"
          v-model="business"
          type="text"
          maxlength="80"
          autocomplete="organization"
          class="field"
          :placeholder="m.businessPh"
        />
      </div>
      <div>
        <label for="fin-year" class="label">{{ m.year }}</label>
        <select id="fin-year" v-model.number="year" class="field">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div>
        <label for="fin-currency" class="label">{{ m.currency }}</label>
        <select id="fin-currency" v-model="currency" class="field">
          <option v-for="(c, code) in CURRENCIES" :key="code" :value="code">
            {{ code }} ({{ c.symbol }})
          </option>
        </select>
      </div>
    </div>

    <fieldset>
      <legend class="label">{{ m.preset }}</legend>
      <div class="flex flex-wrap gap-2">
        <label
          v-for="p in PRESET_IDS"
          :key="p"
          class="btn cursor-pointer has-checked:btn-active"
          :class="preset === p ? 'btn-active' : 'btn-secondary'"
        >
          <input v-model="preset" type="radio" name="fin-preset" :value="p" class="sr-only" />
          {{ msg[`preset.${p}`] }}
        </label>
      </div>
      <p class="mt-2 text-sm text-ink-3">{{ m.presetHint }}</p>
    </fieldset>

    <div class="grid gap-4 md:grid-cols-3">
      <div>
        <label for="fin-accounts" class="label">{{ m.accounts }}</label>
        <textarea
          id="fin-accounts"
          v-model="accounts"
          rows="9"
          class="field font-mono text-sm"
          spellcheck="false"
          aria-describedby="fin-accounts-hint"
        />
        <p id="fin-accounts-hint" class="mt-1 text-xs text-ink-3">
          {{ fill(m.oneLine, { n: FINANCE_LIMITS.accounts }) }}
        </p>
      </div>
      <div>
        <label for="fin-income" class="label">{{ m.income }}</label>
        <textarea
          id="fin-income"
          v-model="income"
          rows="9"
          class="field font-mono text-sm"
          spellcheck="false"
          aria-describedby="fin-income-hint"
        />
        <p id="fin-income-hint" class="mt-1 text-xs text-ink-3">
          {{ fill(m.oneLine, { n: FINANCE_LIMITS.income }) }}
        </p>
      </div>
      <div>
        <label for="fin-expense" class="label">{{ m.expense }}</label>
        <textarea
          id="fin-expense"
          v-model="expense"
          rows="9"
          class="field font-mono text-sm"
          spellcheck="false"
          aria-describedby="fin-expense-hint"
        />
        <p id="fin-expense-hint" class="mt-1 text-xs text-ink-3">
          {{ fill(m.oneLine, { n: FINANCE_LIMITS.expense }) }}
        </p>
      </div>
    </div>

    <label class="flex items-start gap-3">
      <input v-model="sample" type="checkbox" class="mt-1 size-4 accent-brand-600" />
      <span>
        <span class="font-semibold">{{ m.sample }}</span>
        <span class="block text-sm text-ink-3">{{ m.sampleHint }}</span>
      </span>
    </label>

    <div class="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
      <button id="fin-download" type="submit" class="btn btn-primary" :disabled="busy">
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
