<script setup lang="ts">
/**
 * Form pengaturan template Inventaris & Gudang. File .xlsx dibuat di browser saat tombol unduh
 * diklik; kode pembuatnya dimuat terpisah (dynamic import) agar halaman tetap ringan.
 */
import { computed, ref, watch } from 'vue';
import IconDownload from '~icons/lucide/download';
import type { Messages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import { CURRENCIES, type Currency } from '../../lib/templates/currencies';
import {
  INVENTORY_LIMITS,
  INVENTORY_PRESETS,
  type InventoryPresetId,
} from '../../lib/templates/inventory-presets';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as Messages<'inventoryBuilder'>;
const msg = props.m;

const locale = pageLocale();
const PRESET_IDS = Object.keys(INVENTORY_PRESETS.id) as InventoryPresetId[];
const thisYear = new Date().getFullYear();
const years = [thisYear - 2, thisYear - 1, thisYear, thisYear + 1, thisYear + 2];

const business = ref('');
const year = ref(thisYear);
const currency = ref<Currency>(locale === 'id' ? 'IDR' : 'USD');
const preset = ref<InventoryPresetId>('umum');
const warehouses = ref(INVENTORY_PRESETS[locale].umum.warehouses.join('\n'));
const categories = ref(INVENTORY_PRESETS[locale].umum.categories.join('\n'));
const units = ref(INVENTORY_PRESETS[locale].umum.units.join('\n'));
const sample = ref(false);
const busy = ref(false);
const status = ref('');
const error = ref('');

watch(preset, (p) => {
  const x = INVENTORY_PRESETS[locale][p];
  warehouses.value = x.warehouses.join('\n');
  categories.value = x.categories.join('\n');
  units.value = x.units.join('\n');
});

const lines = (s: string, max: number) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
const counts = computed(() => ({
  w: lines(warehouses.value, INVENTORY_LIMITS.warehouses).length,
  c: lines(categories.value, INVENTORY_LIMITS.categories).length,
  u: lines(units.value, INVENTORY_LIMITS.units).length,
}));

const fields = [
  {
    id: 'inv-warehouses',
    model: warehouses,
    label: m.warehouses,
    max: INVENTORY_LIMITS.warehouses,
  },
  {
    id: 'inv-categories',
    model: categories,
    label: m.categories,
    max: INVENTORY_LIMITS.categories,
  },
  { id: 'inv-units', model: units, label: m.units, max: INVENTORY_LIMITS.units },
];

function fileName(): string {
  const base = locale === 'id' ? 'Inventaris-Gudang' : 'Inventory-Warehouse';
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
    const { buildInventoryWorkbook } = await import('../../lib/templates/inventaris-gudang');
    const wb = buildInventoryWorkbook({
      locale,
      business: business.value,
      year: year.value,
      currency: currency.value,
      warehouses: lines(warehouses.value, INVENTORY_LIMITS.warehouses),
      categories: lines(categories.value, INVENTORY_LIMITS.categories),
      units: lines(units.value, INVENTORY_LIMITS.units),
      preset: preset.value,
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
        <label for="inv-business" class="label">{{ m.business }}</label>
        <input
          id="inv-business"
          v-model="business"
          type="text"
          maxlength="80"
          autocomplete="organization"
          class="field"
          :placeholder="m.businessPh"
        />
      </div>
      <div>
        <label for="inv-year" class="label">{{ m.year }}</label>
        <select id="inv-year" v-model.number="year" class="field">
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div>
        <label for="inv-currency" class="label">{{ m.currency }}</label>
        <select id="inv-currency" v-model="currency" class="field">
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
          <input v-model="preset" type="radio" name="inv-preset" :value="p" class="sr-only" />
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
          rows="8"
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
      <button id="inv-download" type="submit" class="btn btn-primary" :disabled="busy">
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
