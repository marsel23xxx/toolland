<script setup lang="ts">
/**
 * Tabel Statistik: r product moment, t, F, dan chi-square. Cari satu nilai (dengan perbandingan
 * nilai hitung dan nilai p), lihat tabel lengkap untuk rentang df tertentu, lalu salin atau unduh
 * sebagai Excel/PDF untuk lampiran skripsi. Semua dihitung di browser.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, LOCALE_TAGS, pageLocale } from '../../lib/format';
import {
  buildTable,
  cellText,
  clampRange,
  critical,
  F_ALPHA,
  F_COLS,
  KINDS,
  lookupValid,
  MAX_DF,
  MAX_ROWS,
  pValue,
  significant,
  toPdf,
  toTsv,
  toXlsx,
  TWO_TAIL,
  CHI_ALPHA,
  type Kind,
  type Lookup,
} from '../../lib/thesis/stat-tables';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'stat'>;

const tag = LOCALE_TAGS[pageLocale()];
const num = (x: number, d: number) =>
  x.toLocaleString(tag, { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtAlpha = (x: number) => x.toLocaleString(tag, { maximumFractionDigits: 4 });

const kind = ref<Kind>('r');
const STAT: Record<Kind, string> = { r: 'r', t: 't', f: 'F', chi: 'χ²' };
const ALPHAS: Record<Kind, number[]> = {
  r: [0.1, 0.05, 0.025, 0.01, 0.005, 0.001],
  t: [0.1, 0.05, 0.025, 0.01, 0.005, 0.001],
  f: F_ALPHA,
  chi: [0.1, 0.05, 0.025, 0.01, 0.005, 0.001],
};

// --- Cari nilai ----------------------------------------------------------------------------------
const n = ref<number | ''>(30);
const df = ref<number | ''>(28);
const df1 = ref<number | ''>(2);
const df2 = ref<number | ''>(30);
const alpha = ref(0.05);
const tails = ref<1 | 2>(2);
const stat = ref<number | ''>('');

const query = computed<Lookup>(() => ({
  kind: kind.value,
  df: kind.value === 'r' ? Number(n.value) - 2 : Number(df.value),
  df1: Number(df1.value),
  df2: Number(df2.value),
  alpha: alpha.value,
  tails: tails.value,
}));
const valid = computed(() => lookupValid(query.value));
const value = computed(() => (valid.value ? critical(query.value) : null));
const digits = computed(() => (kind.value === 'chi' && value.value! < 1 ? 5 : 4));

const found = computed(() => {
  if (value.value === null) return '';
  const q = query.value;
  return fill(m[`found_${q.kind}`], {
    n: Number(n.value),
    df: q.df,
    df1: q.df1,
    df2: q.df2,
    a: fmtAlpha(q.alpha),
    tails: q.tails === 1 ? m.tails1 : m.tails2,
    v: num(value.value, digits.value),
  });
});

const hasStat = computed(() => stat.value !== '' && Number.isFinite(Number(stat.value)));
const decision = computed(() => {
  if (value.value === null || !hasStat.value) return null;
  const q = query.value;
  const s = Number(stat.value);
  if ((q.kind === 'f' || q.kind === 'chi') && s < 0) return { ok: false, text: m.negative };
  if (q.kind === 'r' && Math.abs(s) > 1) return { ok: false, text: m.rRange };
  const yes = significant(q, s);
  const p = pValue(q, s);
  const pText = p < 0.001 ? `< ${num(0.001, 3)}` : num(p, p < 0.01 ? 4 : 3);
  const shown = q.kind === 'r' || q.kind === 't' ? Math.abs(s) : s;
  let text = fill(yes ? m.decideYes : m.decideNo, {
    stat: STAT[q.kind],
    s: shown.toLocaleString(tag, { maximumFractionDigits: 4 }),
    v: num(value.value, digits.value),
    p: pText,
  });
  if (q.kind === 'r') text += ` ${yes ? m.validYes : m.validNo}`;
  return { ok: yes, text };
});

function chooseKind(k: Kind) {
  kind.value = k;
  if (!ALPHAS[k].includes(alpha.value)) alpha.value = 0.05;
  stat.value = '';
  try {
    history.replaceState(null, '', `#${k}`);
  } catch {
    // Abaikan.
  }
}

// --- Tabel lengkap -------------------------------------------------------------------------------
const from = ref<number | ''>(1);
const to = ref<number | ''>(100);
const fAlpha = ref(0.05);

function labels(k: Kind, a: number) {
  const A = fmtAlpha(a);
  return {
    title: fill(m[`title_${k}`], { a: A }),
    note: fill(m[`note_${k}`], { a: A }),
    df: m.colDf,
    n: m.colN,
    oneTail: m.oneTail,
    twoTail: m.twoTail,
    df1: m.colDf1,
    df2: m.colDf2,
    alpha: m.colAlpha,
  };
}
const range = computed(() => clampRange(Number(from.value), Number(to.value)));
const table = computed(() =>
  buildTable(
    kind.value,
    range.value[0],
    range.value[1],
    fAlpha.value,
    labels(kind.value, fAlpha.value),
    fmtAlpha,
  ),
);
const rangeNote = computed(() => {
  const [a, b] = range.value;
  return Number(from.value) !== a || Number(to.value) !== b
    ? fill(m.rangeClamped, { a, b, max: MAX_ROWS, maxDf: MAX_DF })
    : '';
});

/** Baris dan kolom yang disorot sesuai pencarian. */
const hiRow = computed(() => (kind.value === 'f' ? query.value.df2 : query.value.df));
const hiCol = computed(() => {
  const q = query.value;
  if (q.kind === 'f') return q.alpha === fAlpha.value && q.df1 <= F_COLS ? q.df1 : -1;
  if (q.kind === 'chi') {
    const i = CHI_ALPHA.indexOf(q.alpha);
    return i < 0 ? -1 : i + 1;
  }
  const two = q.tails === 1 ? q.alpha * 2 : q.alpha;
  const i = TWO_TAIL.findIndex((x) => Math.abs(x - two) < 1e-12);
  return i < 0 ? -1 : i + table.value.intCols;
});

const wrap = ref<HTMLElement>();
async function showInTable() {
  const q = query.value;
  if (!valid.value) return;
  if (q.kind === 'f' && F_ALPHA.includes(q.alpha)) fAlpha.value = q.alpha;
  const row = hiRow.value;
  if (row < range.value[0] || row > range.value[1]) {
    const start = Math.max(1, row - 10);
    from.value = start;
    to.value = Math.max(start + 99, row);
  }
  await nextTick();
  const el = wrap.value?.querySelector<HTMLElement>('[data-st-hi]');
  if (el && wrap.value) {
    wrap.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
    wrap.value.scrollTop = el.offsetTop - wrap.value.clientHeight / 2;
  }
}

const copied = ref(false);
async function copyTable() {
  try {
    await navigator.clipboard.writeText(toTsv(table.value, num));
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    // Clipboard ditolak.
  }
}
const fileBase = computed(() => {
  const [a, b] = range.value;
  const suffix = kind.value === 'f' ? `-${String(fAlpha.value).replace('.', '')}` : '';
  return `tabel-${kind.value}${suffix}-df-${a}-${b}`;
});
function downloadXlsx() {
  downloadBlob(toXlsx(table.value, m[`tab_${kind.value}`]), `${fileBase.value}.xlsx`);
}
const pdfBusy = ref(false);
async function downloadPdf() {
  pdfBusy.value = true;
  try {
    const bytes = await toPdf(table.value, num, (p, total) => fill(m.pageOf, { p, total }));
    downloadBlob(
      new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      `${fileBase.value}.pdf`,
    );
  } finally {
    pdfBusy.value = false;
  }
}

onMounted(() => {
  const h = location.hash.slice(1);
  if ((KINDS as string[]).includes(h)) chooseKind(h as Kind);
});
watch(kind, () => {
  from.value = 1;
  to.value = 100;
});
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap gap-2" role="tablist" :aria-label="m.kindLabel">
      <button
        v-for="k in KINDS"
        :key="k"
        type="button"
        role="tab"
        :aria-selected="kind === k"
        class="rounded-full border px-4 py-1.5 text-sm"
        :class="
          kind === k
            ? 'border-brand-600 bg-brand-600/10 font-semibold dark:border-brand-400'
            : 'border-rule'
        "
        :data-st-kind="k"
        @click="chooseKind(k)"
      >
        {{ m[`tab_${k}`] }}
      </button>
    </div>

    <section class="card space-y-4" :aria-label="m.lookupHead" data-st-lookup>
      <h2 class="font-display text-xl">{{ m.lookupHead }}</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <label v-if="kind === 'r'" class="flex items-center justify-between gap-2 text-sm">
          {{ m.inputN }}
          <input
            v-model.number="n"
            type="number"
            min="3"
            step="1"
            inputmode="numeric"
            class="field w-28 py-1.5"
            data-st-n
          />
        </label>
        <label v-else-if="kind !== 'f'" class="flex items-center justify-between gap-2 text-sm">
          {{ m.inputDf }}
          <input
            v-model.number="df"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            class="field w-28 py-1.5"
            data-st-df
          />
        </label>
        <template v-else>
          <label class="flex items-center justify-between gap-2 text-sm">
            {{ m.inputDf1 }}
            <input
              v-model.number="df1"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="field w-28 py-1.5"
              data-st-df1
            />
          </label>
          <label class="flex items-center justify-between gap-2 text-sm">
            {{ m.inputDf2 }}
            <input
              v-model.number="df2"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              class="field w-28 py-1.5"
              data-st-df2
            />
          </label>
        </template>
        <label class="flex items-center justify-between gap-2 text-sm">
          {{ m.inputAlpha }}
          <select v-model.number="alpha" class="field w-36 py-1.5" data-st-alpha>
            <option v-for="a in ALPHAS[kind]" :key="a" :value="a">
              {{ fmtAlpha(a) }} ({{ fmtAlpha(a * 100) }}%)
            </option>
          </select>
        </label>
        <div
          v-if="kind === 'r' || kind === 't'"
          class="flex items-center justify-between gap-2 text-sm"
          role="radiogroup"
          :aria-label="m.inputTails"
        >
          {{ m.inputTails }}
          <span class="flex gap-1">
            <button
              v-for="tl in [2, 1] as const"
              :key="tl"
              type="button"
              role="radio"
              :aria-checked="tails === tl"
              class="rounded-full border px-3 py-1"
              :class="
                tails === tl
                  ? 'border-brand-600 bg-brand-600/10 font-semibold dark:border-brand-400'
                  : 'border-rule'
              "
              :data-st-tails="tl"
              @click="tails = tl"
            >
              {{ tl === 1 ? m.tails1 : m.tails2 }}
            </button>
          </span>
        </div>
        <label class="flex items-center justify-between gap-2 text-sm">
          {{ fill(m.inputStat, { stat: STAT[kind] }) }}
          <input
            v-model.number="stat"
            type="number"
            step="any"
            inputmode="decimal"
            class="field w-28 py-1.5"
            :placeholder="m.optional"
            data-st-stat
          />
        </label>
      </div>
      <p class="text-xs text-ink-2">{{ m[`hint_${kind}`] }}</p>

      <div v-if="value !== null" class="space-y-2 border-t border-rule pt-3" aria-live="polite">
        <p class="flex flex-wrap items-baseline gap-3">
          <span class="text-sm font-semibold">{{ fill(m.critLabel, { stat: STAT[kind] }) }}</span>
          <span class="font-display text-4xl tabular-nums" data-st-value>{{
            num(value, digits)
          }}</span>
        </p>
        <p class="text-sm" data-st-found>{{ found }}</p>
        <p
          v-if="decision"
          class="rounded border p-2 text-sm"
          :class="
            decision.ok
              ? 'border-green-700/40 bg-green-700/10'
              : 'border-amber-700/40 bg-amber-700/10'
          "
          data-st-decision
        >
          {{ decision.text }}
        </p>
        <button type="button" class="btn" data-st-show @click="showInTable">
          {{ m.showInTable }}
        </button>
      </div>
      <p v-else class="rounded border border-rule bg-paper-2 p-2 text-sm" data-st-invalid>
        {{ m.invalid }}
      </p>
    </section>

    <section class="card space-y-3" :aria-label="table.title" data-st-table>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-xl">{{ table.title }}</h2>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" data-st-copy @click="copyTable">
            {{ copied ? m.copied : m.copyTable }}
          </button>
          <button type="button" class="btn" data-st-xlsx @click="downloadXlsx">
            {{ m.downloadXlsx }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="pdfBusy"
            data-st-pdf
            @click="downloadPdf"
          >
            {{ m.downloadPdf }}
          </button>
        </div>
      </div>
      <p class="text-sm text-ink-2">{{ table.note }}</p>
      <div class="flex flex-wrap items-center gap-3 text-sm">
        <label class="flex items-center gap-2">
          {{ kind === 'f' ? m.colDf2 : m.colDf }} {{ m.from }}
          <input
            v-model.number="from"
            type="number"
            min="1"
            :max="MAX_DF"
            class="field w-24 py-1"
            data-st-from
          />
        </label>
        <label class="flex items-center gap-2">
          {{ m.to }}
          <input
            v-model.number="to"
            type="number"
            min="1"
            :max="MAX_DF"
            class="field w-24 py-1"
            data-st-to
          />
        </label>
        <label v-if="kind === 'f'" class="flex items-center gap-2">
          α
          <select v-model.number="fAlpha" class="field w-24 py-1" data-st-falpha>
            <option v-for="a in F_ALPHA" :key="a" :value="a">{{ fmtAlpha(a) }}</option>
          </select>
        </label>
      </div>
      <p v-if="rangeNote" class="text-xs text-ink-2">{{ rangeNote }}</p>

      <div
        ref="wrap"
        class="max-h-[70vh] overflow-auto rounded border border-rule"
        tabindex="0"
        :aria-label="table.title"
      >
        <table class="w-full border-collapse text-sm tabular-nums" data-st-grid>
          <thead class="sticky top-0 z-10 bg-paper-2">
            <tr v-for="(row, k) in table.head" :key="k">
              <th
                v-for="(c, j) in row"
                :key="j"
                :colspan="c.span"
                class="whitespace-nowrap px-2 py-1 text-center font-semibold"
                :class="k === table.head.length - 1 ? 'border-b border-rule' : ''"
              >
                {{ c.text }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in table.rows"
              :key="row[0]"
              class="odd:bg-transparent even:bg-paper-2/60"
              :class="row[0] === hiRow ? '!bg-brand-600/15' : ''"
              :data-st-hi="row[0] === hiRow ? '' : undefined"
              :data-st-row="row[0]"
            >
              <td
                v-for="(v, c) in row"
                :key="c"
                class="whitespace-nowrap px-2 py-0.5"
                :class="[
                  c < table.intCols ? 'text-center font-semibold' : 'text-right',
                  row[0] === hiRow && c === hiCol
                    ? 'rounded bg-brand-600 font-bold text-white'
                    : '',
                ]"
              >
                {{ cellText(table, c, v, num) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
