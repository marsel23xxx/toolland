<script setup lang="ts">
/**
 * Kalkulator Sampel: hitung ukuran sampel skripsi dengan Slovin, Lemeshow, Cochran, dan
 * Krejcie-Morgan, lengkap dengan langkah perhitungan yang bisa disalin dan alokasi per strata.
 */
import { computed, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill, LOCALE_TAGS, pageLocale, type Locale } from '../../lib/format';
import {
  allocate,
  CHI2,
  CONFIDENCE,
  sampleSizes,
  steps,
  withDropout,
  Z,
  type Confidence,
  type MethodId,
  type SampleInput,
} from '../../lib/thesis/sample';

// Bahasa dari halaman (prop) supaya format angka sama saat render server dan di browser.
const props = defineProps<{ m: Record<string, string>; locale?: Locale }>();
const m = props.m as ToolMessages<'sample'>;

const tag = LOCALE_TAGS[props.locale ?? pageLocale()];
const num = (x: number, digits = 0) => x.toLocaleString(tag, { maximumFractionDigits: digits });

const known = ref(true);
const population = ref<number | ''>(100);
const confidence = ref<Confidence>(95);
const error = ref<number | ''>(5);
const proportion = ref<number | ''>(50);
const dropout = ref<number | ''>(0);
const picked = ref<MethodId>('slovin');

const input = computed<SampleInput>(() => ({
  population: known.value ? Number(population.value) : null,
  confidence: confidence.value,
  error: Number(error.value),
  proportion: Number(proportion.value),
}));
const results = computed(() => sampleSizes(input.value));
const chosen = computed(
  () => results.value.find((r) => r.id === picked.value) ?? results.value[0] ?? null,
);
const drop = computed(() => Number(dropout.value) || 0);
const finalN = computed(() => (chosen.value ? withDropout(chosen.value.n, drop.value) : 0));

function legend(id: MethodId) {
  const c = confidence.value;
  return fill(m[`legend_${id}`], { c, z: num(Z[c], 3), x: num(CHI2[c], 3) });
}
const stepLines = computed(() => (chosen.value ? steps(chosen.value.id, input.value, num) : []));

const copied = ref(false);
async function copySteps() {
  const r = chosen.value;
  if (!r) return;
  const lines = [
    m[`method_${r.id}`],
    ...stepLines.value,
    '',
    `${m.legendLabel}: ${legend(r.id)}`,
    fill(m.conclusion, { n: num(r.n) }),
  ];
  if (drop.value > 0)
    lines.push(fill(m.conclusionDropout, { n: num(finalN.value), d: num(drop.value, 1) }));
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard ditolak: biarkan pengguna menyalin manual dari layar.
  }
}

// --- Strata ---------------------------------------------------------------------------------
const strata = ref<{ name: string; size: number | '' }[]>([]);
function addStratum() {
  strata.value.push({ name: '', size: '' });
}
const strataTotal = computed(() =>
  strata.value.reduce((a, s) => a + (Number(s.size) > 0 ? Math.floor(Number(s.size)) : 0), 0),
);
const allocation = computed(() =>
  allocate(
    strata.value.map((s) => ({ name: s.name, size: Number(s.size) })),
    finalN.value,
  ),
);
const strataMismatch = computed(
  () =>
    known.value &&
    strataTotal.value > 0 &&
    strataTotal.value !== Number(population.value) &&
    strata.value.every((s) => Number(s.size) > 0),
);
function useStrataTotal() {
  known.value = true;
  population.value = strataTotal.value;
}
</script>

<template>
  <div class="space-y-5">
    <section class="card space-y-4" :aria-label="m.inputHead">
      <h2 class="font-display text-xl">{{ m.inputHead }}</h2>

      <fieldset class="space-y-2">
        <legend class="text-sm font-semibold">{{ m.population }}</legend>
        <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="m.population">
          <button
            v-for="k in [true, false]"
            :key="String(k)"
            type="button"
            role="radio"
            :aria-checked="known === k"
            class="rounded-full border px-3 py-1 text-sm"
            :class="
              known === k
                ? 'border-brand-600 bg-brand-600/10 font-semibold dark:border-brand-400'
                : 'border-rule'
            "
            :data-ss-known="k ? 'yes' : 'no'"
            @click="known = k"
          >
            {{ k ? m.popKnown : m.popUnknown }}
          </button>
        </div>
        <label v-if="known" class="flex max-w-sm items-center justify-between gap-2 text-sm">
          {{ m.populationN }}
          <input
            v-model.number="population"
            type="number"
            min="2"
            step="1"
            inputmode="numeric"
            class="field w-32 py-1.5"
            data-ss-pop
          />
        </label>
        <p v-else class="text-sm text-ink-2">{{ m.unknownHint }}</p>
      </fieldset>

      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex items-center justify-between gap-2 text-sm">
          {{ m.confidence }}
          <select v-model.number="confidence" class="field w-24 py-1.5" data-ss-conf>
            <option v-for="c in CONFIDENCE" :key="c" :value="c">{{ c }}%</option>
          </select>
        </label>
        <label class="flex items-center justify-between gap-2 text-sm">
          {{ m.error }}
          <span class="flex items-center gap-1">
            <input
              v-model.number="error"
              type="number"
              min="0.5"
              max="50"
              step="0.5"
              class="field w-20 py-1.5"
              data-ss-error
            />%
          </span>
        </label>
        <label
          class="flex items-center justify-between gap-2 text-sm"
          :class="known && picked === 'slovin' ? 'opacity-60' : ''"
        >
          {{ m.proportion }}
          <span class="flex items-center gap-1">
            <input
              v-model.number="proportion"
              type="number"
              min="1"
              max="99"
              step="1"
              class="field w-20 py-1.5"
              data-ss-prop
            />%
          </span>
        </label>
        <label class="flex items-center justify-between gap-2 text-sm">
          {{ m.dropout }}
          <span class="flex items-center gap-1">
            <input
              v-model.number="dropout"
              type="number"
              min="0"
              max="50"
              step="1"
              class="field w-20 py-1.5"
              data-ss-dropout
            />%
          </span>
        </label>
      </div>
      <p class="text-xs text-ink-2">{{ m.proportionHint }}</p>
    </section>

    <p
      v-if="!results.length"
      class="rounded border border-rule bg-paper-2 p-3 text-sm"
      data-ss-invalid
    >
      {{ m.invalid }}
    </p>

    <section v-else class="space-y-3" :aria-label="m.resultHead" aria-live="polite">
      <h2 class="font-display text-xl">{{ m.resultHead }}</h2>
      <div class="grid gap-3" :class="results.length > 1 ? 'sm:grid-cols-3' : ''" role="radiogroup">
        <button
          v-for="r in results"
          :key="r.id"
          type="button"
          role="radio"
          :aria-checked="chosen?.id === r.id"
          class="card text-left transition"
          :class="chosen?.id === r.id ? 'ring-2 ring-brand-600 dark:ring-brand-400' : ''"
          :data-ss-result="r.id"
          @click="picked = r.id"
        >
          <span class="block text-sm font-semibold">{{ m[`method_${r.id}`] }}</span>
          <span class="block font-display text-4xl tabular-nums" data-ss-n>{{ num(r.n) }}</span>
          <span class="block text-xs text-ink-2">{{ m[`desc_${r.id}`] }}</span>
        </button>
      </div>
      <p v-if="drop > 0" class="text-sm" data-ss-final>
        {{ fill(m.conclusionDropout, { n: num(finalN), d: num(drop, 1) }) }}
      </p>

      <div v-if="chosen" class="card space-y-2" data-ss-steps>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">
            {{ fill(m.stepsHead, { method: m[`method_${chosen.id}`] }) }}
          </h3>
          <button type="button" class="btn" data-ss-copy @click="copySteps">
            {{ copied ? m.copied : m.copySteps }}
          </button>
        </div>
        <pre class="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">{{
          stepLines.join('\n')
        }}</pre>
        <p class="text-sm text-ink-2">
          <strong>{{ m.legendLabel }}:</strong> {{ legend(chosen.id) }}
        </p>
        <p class="text-sm">{{ fill(m.conclusion, { n: num(chosen.n) }) }}</p>
      </div>
    </section>

    <section class="card space-y-3" :aria-label="m.strataHead" data-ss-strata>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-xl">{{ m.strataHead }}</h2>
        <button type="button" class="btn" data-ss-add @click="addStratum">
          {{ m.addStratum }}
        </button>
      </div>
      <p class="text-sm text-ink-2">{{ m.strataIntro }}</p>
      <table v-if="strata.length" class="w-full text-sm">
        <thead>
          <tr class="border-b border-rule text-left">
            <th class="py-1 font-semibold">{{ m.strataName }}</th>
            <th class="w-28 py-1 font-semibold">{{ m.strataSize }}</th>
            <th class="w-20 py-1 text-right font-semibold">{{ m.strataSample }}</th>
            <th class="w-10">
              <span class="sr-only">{{ m.remove }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, k) in strata" :key="k" class="border-b border-rule" data-ss-row>
            <td class="py-1 pr-2">
              <input
                v-model="s.name"
                class="field py-1"
                :aria-label="m.strataName"
                :placeholder="fill(m.strataPlaceholder, { n: k + 1 })"
              />
            </td>
            <td class="py-1 pr-2">
              <input
                v-model.number="s.size"
                type="number"
                min="0"
                step="1"
                class="field py-1"
                :aria-label="m.strataSize"
              />
            </td>
            <td class="py-1 text-right font-semibold tabular-nums" data-ss-alloc>
              {{ num(allocation[k] ?? 0) }}
            </td>
            <td class="py-1 text-right">
              <button
                type="button"
                class="px-2 text-ink-2 hover:text-red-600"
                :aria-label="m.remove"
                @click="strata.splice(k, 1)"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="py-1 font-semibold">{{ m.strataTotal }}</td>
            <td class="py-1 tabular-nums">{{ num(strataTotal) }}</td>
            <td class="py-1 text-right font-semibold tabular-nums" data-ss-alloc-total>
              {{ num(allocation.reduce((a, b) => a + b, 0)) }}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      <p v-if="strataMismatch" class="flex flex-wrap items-center gap-2 text-sm">
        {{ fill(m.strataMismatch, { t: num(strataTotal), n: num(Number(population)) }) }}
        <button type="button" class="btn" data-ss-use-total @click="useStrataTotal">
          {{ m.useTotal }}
        </button>
      </p>
    </section>
  </div>
</template>
