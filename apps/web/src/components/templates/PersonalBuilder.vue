<script setup lang="ts">
/**
 * Form pengaturan template Keuangan Pribadi. File .xlsx dibuat di browser saat tombol unduh
 * diklik; kode pembuatnya dimuat terpisah (dynamic import) agar halaman tetap ringan.
 */
import { computed, ref, watch } from 'vue';
import IconDownload from '~icons/lucide/download';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { CURRENCIES, type Currency } from '../../lib/templates/currencies';
import {
  type ExpenseCat,
  PERSONAL_LIMITS,
  PERSONAL_PRESETS,
  PERSONAL_WALLETS,
  type PersonalPresetId,
} from '../../lib/templates/personal-presets';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as Messages<'personalBuilder'>;
const msg = props.m;

const locale = pageLocale();
const PRESET_IDS = Object.keys(PERSONAL_PRESETS.id) as PersonalPresetId[];
const thisYear = new Date().getFullYear();
const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

const name = ref('');
const year = ref(thisYear);
const currency = ref<Currency>(locale === 'id' ? 'IDR' : 'USD');
const preset = ref<PersonalPresetId>('lajang');
const wallets = ref(PERSONAL_WALLETS[locale].join('\n'));
const income = ref(PERSONAL_PRESETS[locale].lajang.income.join('\n'));
const expense = ref(PERSONAL_PRESETS[locale].lajang.expense.map((e) => e[0]).join('\n'));
const sample = ref(false);
const busy = ref(false);
const status = ref('');
const error = ref('');

watch(preset, (p) => {
  income.value = PERSONAL_PRESETS[locale][p].income.join('\n');
  expense.value = PERSONAL_PRESETS[locale][p].expense.map((e) => e[0]).join('\n');
});

const lines = (s: string, max: number) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
const counts = computed(() => ({
  w: lines(wallets.value, PERSONAL_LIMITS.wallets).length,
  i: lines(income.value, PERSONAL_LIMITS.income).length,
  e: lines(expense.value, PERSONAL_LIMITS.expense).length,
}));

const fields = [
  { id: 'per-wallets', model: wallets, label: m.wallets, max: PERSONAL_LIMITS.wallets },
  { id: 'per-income', model: income, label: m.income, max: PERSONAL_LIMITS.income },
  { id: 'per-expense', model: expense, label: m.expense, max: PERSONAL_LIMITS.expense },
];

/** Kategori pengeluaran: kelompok 50/30/20 dan anggaran diambil dari preset bila namanya cocok. */
function expenseCats(): ExpenseCat[] {
  const known = new Map(
    PRESET_IDS.flatMap((p) => PERSONAL_PRESETS[locale][p].expense).map((e) => [
      e[0].toLowerCase(),
      e,
    ]),
  );
  return lines(expense.value, PERSONAL_LIMITS.expense).map((n) => {
    const e =
      PERSONAL_PRESETS[locale][preset.value].expense.find((x) => x[0] === n) ??
      known.get(n.toLowerCase());
    return [n, e?.[1] ?? 'N', e?.[2] ?? 0];
  });
}

function fileName(): string {
  const base = locale === 'id' ? 'Keuangan-Pribadi' : 'Personal-Finance';
  const who = name.value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${[base, who, year.value].filter(Boolean).join('-')}.xlsx`;
}

async function download() {
  busy.value = true;
  status.value = '';
  error.value = '';
  try {
    const { buildPersonalWorkbook } = await import('../../lib/templates/keuangan-pribadi');
    const wb = buildPersonalWorkbook({
      locale,
      name: name.value,
      year: year.value,
      currency: currency.value,
      wallets: lines(wallets.value, PERSONAL_LIMITS.wallets),
      incomeCats: lines(income.value, PERSONAL_LIMITS.income),
      expenseCats: expenseCats(),
      preset: preset.value,
      sample: sample.value,
    });
    const file = fileName();
    downloadBlob(wb.toBlob(), file);
    status.value = fill(m.done, { file });
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
        <label for="per-name" class="label">{{ m.name }}</label>
        <input
          id="per-name"
          v-model="name"
          type="text"
          maxlength="80"
          autocomplete="name"
          class="field"
          :placeholder="m.namePh"
        />
      </div>
      <div>
        <label for="per-year" class="label">{{ m.year }}</label>
        <select id="per-year" v-model.number="year" class="field">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div>
        <label for="per-currency" class="label">{{ m.currency }}</label>
        <select id="per-currency" v-model="currency" class="field">
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
          class="btn cursor-pointer"
          :class="preset === p ? 'btn-active' : 'btn-secondary'"
        >
          <input v-model="preset" type="radio" name="per-preset" :value="p" class="sr-only" />
          {{ msg[`preset.${p}`] }}
        </label>
      </div>
      <p class="mt-2 text-sm text-ink-3">{{ m.presetHint }}</p>
    </fieldset>

    <div class="grid gap-4 md:grid-cols-3">
      <div v-for="f in fields" :key="f.id">
        <label :for="f.id" class="label">{{ f.label }}</label>
        <textarea
          :id="f.id"
          v-model="f.model.value"
          rows="9"
          class="field font-mono text-sm"
          spellcheck="false"
          :aria-describedby="`${f.id}-hint`"
        />
        <p :id="`${f.id}-hint`" class="mt-1 text-xs text-ink-3">
          {{ fill(m.oneLine, { n: f.max }) }}
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
      <button id="per-download" type="submit" class="btn btn-primary" :disabled="busy">
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
