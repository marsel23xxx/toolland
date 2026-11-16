<script setup lang="ts">
/**
 * Uji Validitas & Reliabilitas: tempel data kuesioner dari Excel/SPSS, lihat r hitung vs r tabel
 * per item dan Cronbach's alpha per variabel, salin kalimat interpretasi, atau unduh Excel.
 * Data tidak dikirim ke mana pun.
 */
import { computed, onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { downloadBlob, pickTextFile } from '../../lib/download';
import { fill, LOCALE_TAGS, pageLocale } from '../../lib/format';
import {
  analyze,
  groupItems,
  parseData,
  sampleData,
  tablesToXlsx,
  type ValidityMethod,
  type VariableResult,
} from '../../lib/thesis/validity';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'validity'>;

const tag = LOCALE_TAGS[pageLocale()];
const num = (x: number, d: number) =>
  x.toLocaleString(tag, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtR = (x: number | null) => (x === null ? '–' : num(x, 3));
const fmtP = (p: number | null) =>
  p === null ? '–' : p < 0.001 ? `< ${num(0.001, 3)}` : num(p, 3);

const STORE = 'toolland-validity-data';
const text = ref('');
onMounted(() => {
  try {
    text.value = localStorage.getItem(STORE) ?? '';
  } catch {
    // Abaikan.
  }
});
let saveTimer: number | undefined;
watch(text, (t) => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      if (t.length < 500_000) localStorage.setItem(STORE, t);
    } catch {
      // Penyimpanan penuh atau ditolak.
    }
  }, 400);
});

const alpha = ref(0.05);
const tails = ref<1 | 2>(2);
const method = ref<ValidityMethod>('pearson');
const threshold = ref(0.6);
const grouped = ref(true);

const data = computed(() => parseData(text.value));
const groups = computed(() => groupItems(data.value.headers));
const results = computed<VariableResult[]>(() => {
  const d = data.value;
  const opts = {
    alpha: alpha.value,
    tails: tails.value,
    method: method.value,
    threshold: threshold.value,
  };
  const sets =
    grouped.value && groups.value
      ? groups.value.map((g) => ({ name: g.name, cols: g.cols }))
      : [{ name: '', cols: d.headers.map((_, i) => i) }];
  return sets
    .map((s) =>
      analyze(
        s.name,
        s.cols.map((c) => d.headers[c]),
        d.rows.map((r) => s.cols.map((c) => r[c])),
        opts,
      ),
    )
    .filter((x): x is VariableResult => x !== null);
});

const info = computed(() => {
  const d = data.value;
  if (!text.value.trim()) return '';
  const parts = [fill(m.parsed, { n: d.rows.length, k: d.headers.length })];
  if (d.skipped.length) parts.push(fill(m.skipped, { cols: d.skipped.join(', ') }));
  if (d.dropped.length)
    parts.push(
      fill(m.dropped, {
        n: d.dropped.length,
        rows: d.dropped.slice(0, 8).join(', ') + (d.dropped.length > 8 ? ', …' : ''),
      }),
    );
  return parts.join(' ');
});
const problem = computed(() => {
  if (!text.value.trim()) return '';
  const d = data.value;
  if (d.headers.length < 2) return m.needItems;
  if (d.rows.length < 3) return m.needRows;
  return '';
});

async function openFile() {
  const f = await pickTextFile('.csv,.tsv,.txt,text/csv,text/plain');
  if (f) text.value = f.text;
}

// --- Teks hasil ----------------------------------------------------------------------------------
const pct = (a: number) => num(a * 100, 0);
const thText = computed(() => num(threshold.value, 2));
const rLabel = computed(() => (method.value === 'pearson' ? m.colR : m.colRCorrected));

function interpretation(v: VariableResult): string {
  const k = v.items.length;
  const varText = v.name ? fill(m.onVariable, { name: v.name }) : '';
  const out = [
    fill(m.interpValid, {
      k,
      v: varText,
      n: v.n,
      a: pct(alpha.value),
      tails: tails.value === 1 ? m.tails1 : m.tails2,
      df: v.df,
      rt: num(v.rTable, 3),
    }),
  ];
  const invalid = v.items.filter((x) => !x.valid);
  if (!invalid.length) out.push(m.interpAllValid);
  else
    out.push(
      fill(m.interpSomeInvalid, {
        valid: v.validCount,
        list: invalid
          .map((x) => (x.rUsed === null ? x.name : `${x.name} (r = ${fmtR(x.rUsed)})`))
          .join(', '),
      }),
    );
  const useValid = v.alphaValid !== null;
  const a = useValid ? v.alphaValid : v.alpha;
  if (a !== null)
    out.push(
      fill(v.reliable ? m.interpReliable : m.interpUnreliable, {
        scope: useValid ? fill(m.scopeValid, { n: v.validCount }) : fill(m.scopeAll, { n: k }),
        alpha: num(a, 3),
        th: thText.value,
      }),
    );
  return out.join(' ');
}

const copiedKey = ref('');
async function copy(textOut: string, key: string) {
  try {
    await navigator.clipboard.writeText(textOut);
    copiedKey.value = key;
    setTimeout(() => (copiedKey.value = ''), 1500);
  } catch {
    // Clipboard ditolak.
  }
}

function validityRows(v: VariableResult) {
  return v.items.map((x, i) => [
    i + 1,
    x.name,
    x.rUsed,
    v.rTable,
    x.p,
    x.valid ? m.valid : m.invalid,
    x.alphaIfDeleted,
  ]);
}
const validityHead = computed(() => [
  m.colNo,
  m.colItem,
  rLabel.value,
  m.colRTable,
  m.colSig,
  m.colResult,
  m.colAlphaDeleted,
]);

function tsv(v: VariableResult) {
  const rows = validityRows(v).map((r) =>
    r
      .map((c, i) =>
        typeof c === 'number' ? (i === 0 ? String(c) : i === 4 ? fmtP(c) : fmtR(c)) : (c ?? '–'),
      )
      .join('\t'),
  );
  const head = v.name ? [`${m.variable}: ${v.name}`] : [];
  const rel = [
    '',
    `${m.alphaLabel}\t${v.alpha === null ? '–' : num(v.alpha, 3)}\t${fill(m.nItems, { n: v.items.length })}`,
  ];
  if (v.alphaValid !== null)
    rel.push(
      `${m.alphaValidLabel}\t${num(v.alphaValid, 3)}\t${fill(m.nItems, { n: v.validCount })}`,
    );
  return [...head, validityHead.value.join('\t'), ...rows, ...rel].join('\n');
}

function downloadXlsx() {
  const multi = results.value.length > 1;
  const validity = {
    name: m.sheetValidity,
    head: [...(multi ? [m.variable] : []), ...validityHead.value],
    rows: results.value.flatMap((v) =>
      validityRows(v).map((r) => [...(multi ? [v.name] : []), ...r]),
    ),
    numFmt: Object.fromEntries([2, 3, 4, 6].map((c) => [c + (multi ? 1 : 0), '0.000'])),
  };
  const reliability = {
    name: m.sheetReliability,
    head: [
      ...(multi ? [m.variable] : []),
      m.colItems,
      m.alphaLabel,
      m.colValidItems,
      m.alphaValidLabel,
      m.colThreshold,
      m.colResult,
    ],
    rows: results.value.map((v) => [
      ...(multi ? [v.name] : []),
      v.items.length,
      v.alpha,
      v.validCount,
      v.alphaValid,
      threshold.value,
      v.reliable ? m.reliable : m.unreliable,
    ]),
    numFmt: Object.fromEntries([1, 3, 4].map((c) => [c + (multi ? 1 : 0), '0.000'])),
  };
  const summary = {
    name: m.sheetInterp,
    head: [m.sheetInterp],
    rows: results.value.map((v) => [interpretation(v)]),
  };
  downloadBlob(
    tablesToXlsx(m.title, [validity, reliability, summary]),
    'uji-validitas-reliabilitas.xlsx',
  );
}
</script>

<template>
  <div class="space-y-5">
    <section class="card space-y-3" :aria-label="m.dataHead">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-xl">{{ m.dataHead }}</h2>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" data-vt-file @click="openFile">
            {{ m.openCsv }}
          </button>
          <button type="button" class="btn" data-vt-sample @click="text = sampleData()">
            {{ m.sample }}
          </button>
          <button type="button" class="btn" :disabled="!text" @click="text = ''">
            {{ m.clear }}
          </button>
        </div>
      </div>
      <p class="text-sm text-ink-2">{{ m.dataIntro }}</p>
      <label for="vt-data" class="sr-only">{{ m.dataHead }}</label>
      <textarea
        id="vt-data"
        v-model="text"
        class="field h-48 font-mono text-xs"
        spellcheck="false"
        wrap="off"
        :placeholder="m.placeholder"
        data-vt-data
      />
      <p v-if="info" class="text-sm" data-vt-info>{{ info }}</p>
      <p
        v-if="problem"
        class="rounded border border-amber-700/40 bg-amber-700/10 p-2 text-sm"
        data-vt-problem
      >
        {{ problem }}
      </p>
    </section>

    <section class="card grid gap-3 sm:grid-cols-2" :aria-label="m.settingsHead">
      <label class="flex items-center justify-between gap-2 text-sm">
        {{ m.alpha }}
        <select v-model.number="alpha" class="field w-28 py-1.5" data-vt-alpha>
          <option :value="0.05">5%</option>
          <option :value="0.01">1%</option>
        </select>
      </label>
      <label class="flex items-center justify-between gap-2 text-sm">
        {{ m.tails }}
        <select v-model.number="tails" class="field w-28 py-1.5" data-vt-tails>
          <option :value="2">{{ m.tails2 }}</option>
          <option :value="1">{{ m.tails1 }}</option>
        </select>
      </label>
      <label class="flex items-center justify-between gap-2 text-sm">
        {{ m.method }}
        <select v-model="method" class="field w-52 py-1.5" data-vt-method>
          <option value="pearson">{{ m.methodPearson }}</option>
          <option value="corrected">{{ m.methodCorrected }}</option>
        </select>
      </label>
      <label class="flex items-center justify-between gap-2 text-sm">
        {{ m.threshold }}
        <select v-model.number="threshold" class="field w-28 py-1.5" data-vt-threshold>
          <option :value="0.6">{{ num(0.6, 2) }}</option>
          <option :value="0.7">{{ num(0.7, 2) }}</option>
        </select>
      </label>
      <label v-if="groups" class="flex items-center gap-2 text-sm sm:col-span-2">
        <input v-model="grouped" type="checkbox" data-vt-grouped />
        {{ fill(m.groupBy, { names: groups.map((g) => g.name).join(', ') }) }}
      </label>
      <p class="text-xs text-ink-2 sm:col-span-2">{{ m.settingsHint }}</p>
    </section>

    <template v-if="results.length && !problem">
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn btn-primary" data-vt-xlsx @click="downloadXlsx">
          {{ m.downloadXlsx }}
        </button>
      </div>

      <section
        v-for="v in results"
        :key="v.name"
        class="card space-y-3"
        :aria-label="v.name || m.allItems"
        data-vt-result
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-display text-xl">
            {{ v.name ? `${m.variable} ${v.name}` : m.allItems }}
          </h2>
          <button type="button" class="btn" data-vt-copy-table @click="copy(tsv(v), `t-${v.name}`)">
            {{ copiedKey === `t-${v.name}` ? m.copied : m.copyTable }}
          </button>
        </div>
        <dl class="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div class="rounded border border-rule px-2 py-1.5">
            <dt class="text-xs text-ink-2">{{ m.respondents }}</dt>
            <dd class="font-semibold tabular-nums">{{ v.n }} (df = {{ v.df }})</dd>
          </div>
          <div class="rounded border border-rule px-2 py-1.5">
            <dt class="text-xs text-ink-2">{{ m.colRTable }}</dt>
            <dd class="font-semibold tabular-nums" data-vt-rtable>{{ num(v.rTable, 3) }}</dd>
          </div>
          <div class="rounded border border-rule px-2 py-1.5">
            <dt class="text-xs text-ink-2">{{ m.validItems }}</dt>
            <dd class="font-semibold tabular-nums" data-vt-valid-count>
              {{ v.validCount }} / {{ v.items.length }}
            </dd>
          </div>
          <div
            class="rounded border px-2 py-1.5"
            :class="
              v.reliable
                ? 'border-green-700/40 bg-green-700/10'
                : 'border-amber-700/40 bg-amber-700/10'
            "
          >
            <dt class="text-xs text-ink-2">{{ m.alphaLabel }}</dt>
            <dd class="font-semibold tabular-nums" data-vt-alpha-value>
              {{ v.alpha === null ? '–' : num(v.alphaValid ?? v.alpha, 3) }}
              · {{ v.reliable ? m.reliable : m.unreliable }}
            </dd>
          </div>
        </dl>

        <div class="overflow-x-auto">
          <table class="w-full text-sm tabular-nums">
            <thead>
              <tr class="border-b border-rule text-left">
                <th
                  v-for="(h, i) in validityHead"
                  :key="h"
                  class="whitespace-nowrap px-2 py-1 font-semibold"
                  :class="i >= 2 && i !== 5 ? 'text-right' : ''"
                >
                  {{ h }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(x, i) in v.items"
                :key="x.name"
                class="border-b border-rule"
                :class="x.valid ? '' : 'bg-amber-700/10'"
                :data-vt-item="x.name"
              >
                <td class="whitespace-nowrap px-2 py-1">{{ i + 1 }}</td>
                <td class="whitespace-nowrap px-2 py-1 font-semibold">{{ x.name }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-right">{{ fmtR(x.rUsed) }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-right">{{ num(v.rTable, 3) }}</td>
                <td class="whitespace-nowrap px-2 py-1 text-right">{{ fmtP(x.p) }}</td>
                <td class="whitespace-nowrap px-2 py-1" data-vt-verdict>
                  {{ x.valid ? m.valid : m.invalid }}
                </td>
                <td class="whitespace-nowrap px-2 py-1 text-right">{{ fmtR(x.alphaIfDeleted) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="v.alphaValid !== null" class="text-sm text-ink-2">
          {{
            fill(m.alphaBoth, {
              all: v.alpha === null ? '–' : num(v.alpha, 3),
              k: v.items.length,
              valid: num(v.alphaValid, 3),
              n: v.validCount,
            })
          }}
        </p>

        <div class="space-y-2 rounded border border-rule bg-paper-2 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold">{{ m.interpHead }}</h3>
            <button
              type="button"
              class="btn"
              data-vt-copy-interp
              @click="copy(interpretation(v), `i-${v.name}`)"
            >
              {{ copiedKey === `i-${v.name}` ? m.copied : m.copyInterp }}
            </button>
          </div>
          <p class="text-sm leading-relaxed" data-vt-interp>{{ interpretation(v) }}</p>
        </div>
      </section>
    </template>
  </div>
</template>
