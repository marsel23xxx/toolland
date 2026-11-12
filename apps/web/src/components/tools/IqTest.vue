<script setup lang="ts">
/**
 * Tes IQ: 30 soal acak (matriks gambar, deret angka, pilih yang berbeda) dalam 20 menit.
 * Soal dibangkitkan dari seed acak setiap kali tes dimulai, jadi tidak bisa dihafal, dan tidak
 * ada umpan balik benar/salah sampai tes selesai. Hasil: perkiraan IQ, persentil, skor per jenis
 * dan tingkat, serta kartu PNG/PDF. Kunci jawaban sengaja tidak ditampilkan agar tidak disebarkan.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill, pageLocale } from '../../lib/format';
import {
  IQ_MAX,
  IQ_MIN,
  TEST_MS,
  buildTest,
  makeRng,
  matrixQuestion,
  oddQuestion,
  scoreTest,
  type IqResult,
  type Kind,
  type Question,
} from '../../lib/iq';
import { iqReportPdf, iqReportPng, type IqReportData } from '../../lib/iq-report';
import { reportDate, reportSite } from '../../lib/typing-report';
import IqFigure from './IqFigure.vue';
import ReportButtons from './ReportButtons.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'iq'>;

// --- Penyimpanan riwayat ---------------------------------------------------------------------
const STORE = 'toolland-iq';
interface Run {
  t: number;
  iq: number;
  correct: number;
}
const store = reactive<{ runs: Run[] }>({ runs: [] });
function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as { runs?: Run[] };
    if (Array.isArray(raw.runs)) store.runs = raw.runs.slice(-20);
  } catch {
    // Penyimpanan tidak tersedia atau rusak.
  }
}
function saveStore() {
  try {
    localStorage.setItem(STORE, JSON.stringify(store));
  } catch {
    // Abaikan.
  }
}

// --- Contoh gambar di layar pembuka (seed tetap agar SSR dan klien sama) -----------------------
const sampleMatrix = matrixQuestion(makeRng(11), 1).cells[4];
const sampleOdd = oddQuestion(makeRng(5), 3).options[0];

// --- Status tes --------------------------------------------------------------------------------
type Phase = 'intro' | 'test' | 'done';
const phase = ref<Phase>('intro');
const questions = ref<Question[]>([]);
const answers = ref<(number | null)[]>([]);
const idx = ref(0);
const startedAt = ref(0);
const now = ref(0);
const usedMs = ref(0);
const timedOut = ref(false);
const confirming = ref(false);
const result = ref<IqResult>();
const rootEl = ref<HTMLDivElement>();
let timer: ReturnType<typeof setInterval> | undefined;
let advance: ReturnType<typeof setTimeout> | undefined;

const q = computed(() => questions.value[idx.value]);
const remaining = computed(() => Math.max(0, TEST_MS - (now.value - startedAt.value)));
const answeredCount = computed(() => answers.value.filter((a) => a !== null).length);
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function clock(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function scrollTop() {
  void nextTick(() => {
    const el = rootEl.value;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  });
}

function start() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  questions.value = buildTest(seed);
  answers.value = questions.value.map(() => null);
  idx.value = 0;
  timedOut.value = false;
  confirming.value = false;
  result.value = undefined;
  startedAt.value = Date.now();
  now.value = startedAt.value;
  phase.value = 'test';
  clearInterval(timer);
  timer = setInterval(() => {
    now.value = Date.now();
    if (remaining.value <= 0) {
      timedOut.value = true;
      finish();
    }
  }, 250);
  scrollTop();
}

function go(i: number) {
  clearTimeout(advance);
  confirming.value = false;
  idx.value = Math.max(0, Math.min(questions.value.length - 1, i));
}

function choose(i: number) {
  if (phase.value !== 'test') return;
  answers.value[idx.value] = i;
  confirming.value = false;
  clearTimeout(advance);
  // Lanjut otomatis ke soal kosong berikutnya; jawaban masih bisa diganti lewat navigasi.
  if (idx.value < questions.value.length - 1) advance = setTimeout(() => go(idx.value + 1), 280);
}

function requestFinish() {
  if (answeredCount.value < questions.value.length && !confirming.value) {
    confirming.value = true;
    return;
  }
  finish();
}

function finish() {
  if (phase.value !== 'test') return;
  clearInterval(timer);
  clearTimeout(advance);
  usedMs.value = Math.min(TEST_MS, Date.now() - startedAt.value);
  result.value = scoreTest(questions.value, answers.value);
  store.runs = [
    ...store.runs,
    { t: Date.now(), iq: result.value.iq, correct: result.value.correct },
  ].slice(-20);
  saveStore();
  phase.value = 'done';
  scrollTop();
}

function onKey(e: KeyboardEvent) {
  if (phase.value !== 'test' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const n = q.value?.options.length ?? 0;
  const k = e.key.toLowerCase();
  const digit = Number(k);
  if (digit >= 1 && digit <= n) choose(digit - 1);
  else if (k.length === 1 && k >= 'a' && k <= 'f' && k.charCodeAt(0) - 97 < n)
    choose(k.charCodeAt(0) - 97);
  else if (e.key === 'ArrowRight') go(idx.value + 1);
  else if (e.key === 'ArrowLeft') go(idx.value - 1);
  else return;
  e.preventDefault();
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (phase.value === 'test') e.preventDefault();
}

onMounted(() => {
  loadStore();
  window.addEventListener('keydown', onKey);
  window.addEventListener('beforeunload', onBeforeUnload);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(advance);
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('beforeunload', onBeforeUnload);
});

// --- Teks --------------------------------------------------------------------------------------
const KIND_LABEL = computed<Record<Kind, string>>(() => ({
  matrix: m.kindMatrix,
  series: m.kindSeries,
  odd: m.kindOdd,
}));
const PROMPT = computed<Record<Kind, string>>(() => ({
  matrix: m.promptMatrix,
  series: m.promptSeries,
  odd: m.promptOdd,
}));
const BAND = computed(() => (result.value ? m[`band_${result.value.band}` as 'band_avg'] : ''));

const percentileText = computed(() =>
  result.value
    ? fill(m.percentile, {
        n: result.value.percentile.toLocaleString(pageLocale() === 'id' ? 'id-ID' : 'en-US', {
          maximumFractionDigits: 1,
        }),
      })
    : '',
);

// --- Kurva normal di layar hasil --------------------------------------------------------------
const CURVE = { w: 560, h: 180, lo: 55, hi: 145, top: 28, bottom: 146 };
const cx = (v: number) => 16 + ((v - CURVE.lo) / (CURVE.hi - CURVE.lo)) * (CURVE.w - 32);
const cy = (v: number) =>
  CURVE.bottom - Math.exp(-(((v - 100) / 15) ** 2) / 2) * (CURVE.bottom - CURVE.top);
function curvePath(to: number, closed: boolean) {
  const pts: string[] = [];
  for (let v = CURVE.lo; v <= to; v += 1) pts.push(`${cx(v).toFixed(1)} ${cy(v).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  return closed
    ? `${line} L${cx(to).toFixed(1)} ${CURVE.bottom} L${cx(CURVE.lo).toFixed(1)} ${CURVE.bottom} Z`
    : line;
}
const curve = computed(() => {
  const iq = result.value?.iq ?? 100;
  return {
    full: curvePath(CURVE.hi, false),
    area: curvePath(Math.min(CURVE.hi, iq), true),
    x: cx(iq),
  };
});

const history = computed(() => store.runs.slice(-10));

// --- Kartu PNG/PDF -----------------------------------------------------------------------------
function buildReport(): IqReportData {
  const r = result.value!;
  return {
    title: m.reportTitle,
    subtitle: [
      fill(m.reportMeta, { n: r.total, min: TEST_MS / 60000 }),
      reportDate(pageLocale()),
    ].join(' · '),
    iqLabel: m.iqEstimate,
    iq: r.iq,
    band: BAND.value,
    percentile: percentileText.value,
    stats: [
      { label: m.correct, value: `${r.correct}/${r.total}` },
      { label: m.timeUsed, value: clock(usedMs.value) },
      ...(['matrix', 'series', 'odd'] as Kind[]).map((k) => ({
        label: KIND_LABEL.value[k],
        value: `${r.byKind[k].correct}/${r.byKind[k].total}`,
      })),
    ],
    levels: r.byLevel.map((l, i) => ({ label: fill(m.levelN, { n: i + 1 }), ...l })),
    levelsTitle: m.byLevel,
    curveTitle: m.curveTitle,
    disclaimer: m.disclaimer,
    footer: fill(m.reportFooter, { site: reportSite() }),
  };
}
</script>

<template>
  <div ref="rootEl" class="scroll-mt-20 space-y-5">
    <!-- Pembuka -->
    <section v-if="phase === 'intro'" class="space-y-5" data-iq-intro>
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="card flex items-center gap-3">
          <div class="size-14 shrink-0 rounded border border-rule bg-paper p-1 text-ink">
            <IqFigure :fig="sampleMatrix" />
          </div>
          <div>
            <p class="font-semibold">{{ m.kindMatrix }}</p>
            <p class="text-xs text-ink-3">{{ m.kindMatrixDesc }}</p>
          </div>
        </div>
        <div class="card flex items-center gap-3">
          <div
            class="grid size-14 shrink-0 place-items-center rounded border border-rule bg-paper font-display text-lg tabular-nums"
          >
            2·4·8
          </div>
          <div>
            <p class="font-semibold">{{ m.kindSeries }}</p>
            <p class="text-xs text-ink-3">{{ m.kindSeriesDesc }}</p>
          </div>
        </div>
        <div class="card flex items-center gap-3">
          <div class="size-14 shrink-0 rounded border border-rule bg-paper p-1 text-ink">
            <IqFigure :fig="sampleOdd" />
          </div>
          <div>
            <p class="font-semibold">{{ m.kindOdd }}</p>
            <p class="text-xs text-ink-3">{{ m.kindOddDesc }}</p>
          </div>
        </div>
      </div>
      <ul class="list-disc space-y-1 pl-5 text-sm text-ink-2">
        <li>{{ m.rule1 }}</li>
        <li>{{ m.rule2 }}</li>
        <li>{{ m.rule3 }}</li>
        <li>{{ m.rule4 }}</li>
      </ul>
      <p class="rounded-md border border-rule bg-paper-2 p-3 text-xs text-ink-3">
        {{ m.disclaimer }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn btn-primary" data-iq-start @click="start">
          {{ m.start }}
        </button>
        <p v-if="store.runs.length" class="text-sm text-ink-3 tabular-nums">
          {{ fill(m.lastResult, { n: store.runs[store.runs.length - 1].iq }) }}
        </p>
      </div>
    </section>

    <!-- Tes -->
    <section v-else-if="phase === 'test' && q" class="space-y-4" data-iq-test>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm font-semibold" data-iq-progress>
          {{ fill(m.questionN, { n: idx + 1, total: questions.length }) }}
          <span class="ml-2 font-normal text-ink-3"
            >{{ KIND_LABEL[q.kind] }} · {{ fill(m.levelN, { n: q.level }) }}</span
          >
        </p>
        <p
          class="rounded-full border px-3 py-1 font-mono text-sm tabular-nums"
          :class="
            remaining < 120000
              ? 'border-secang text-secang dark:border-[#e98a98] dark:text-[#e98a98]'
              : 'border-rule text-ink-2'
          "
          role="timer"
          :aria-label="m.timeLeft"
          data-iq-timer
        >
          ⏱ {{ clock(remaining) }}
        </p>
      </div>

      <!-- Navigasi soal -->
      <nav class="flex flex-wrap gap-1" :aria-label="m.navLabel">
        <button
          v-for="(_, i) in questions"
          :key="i"
          type="button"
          class="size-7 rounded text-xs font-semibold tabular-nums transition-colors"
          :class="[
            answers[i] !== null
              ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink'
              : 'bg-paper-2 text-ink-3 hover:text-ink',
            i === idx ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : '',
          ]"
          :aria-current="i === idx ? 'step' : undefined"
          :aria-label="fill(m.questionN, { n: i + 1, total: questions.length })"
          @click="go(i)"
        >
          {{ i + 1 }}
        </button>
      </nav>

      <div class="rounded-md border border-ink bg-paper-2 p-4 sm:p-6">
        <h2 class="mb-4 font-display text-xl">{{ PROMPT[q.kind] }}</h2>

        <!-- Matriks -->
        <div
          v-if="q.kind === 'matrix'"
          class="mx-auto grid max-w-xs grid-cols-3 gap-1.5"
          data-iq-matrix
        >
          <div
            v-for="(c, i) in q.cells"
            :key="i"
            class="aspect-square rounded border border-rule bg-paper p-1 text-ink"
          >
            <IqFigure :fig="c" />
          </div>
          <div
            class="grid aspect-square place-items-center rounded border-2 border-dashed border-brand-600 font-display text-4xl text-brand-700 dark:border-brand-400 dark:text-brand-300"
          >
            ?
          </div>
        </div>

        <!-- Deret -->
        <div
          v-else-if="q.kind === 'series'"
          class="flex flex-wrap items-center justify-center gap-2"
          data-iq-series
        >
          <span
            v-for="(t, i) in q.terms"
            :key="i"
            class="min-w-12 rounded border border-rule bg-paper px-3 py-2 text-center font-display text-2xl tabular-nums"
          >
            {{ t }}
          </span>
          <span
            class="min-w-12 rounded border-2 border-dashed border-brand-600 px-3 py-2 text-center font-display text-2xl text-brand-700 dark:border-brand-400 dark:text-brand-300"
          >
            ?
          </span>
        </div>

        <!-- Pilihan -->
        <div
          class="mt-6 grid gap-2"
          :class="
            q.kind === 'matrix'
              ? 'grid-cols-3 sm:grid-cols-6'
              : q.kind === 'odd'
                ? 'grid-cols-3 sm:grid-cols-5'
                : 'grid-cols-2 sm:grid-cols-5'
          "
          role="radiogroup"
          :aria-label="m.options"
          data-iq-options
        >
          <button
            v-for="(o, i) in q.options"
            :key="`${idx}-${i}`"
            type="button"
            role="radio"
            :aria-checked="answers[idx] === i"
            class="relative rounded-md border-2 bg-paper p-1.5 text-ink transition-colors"
            :class="
              answers[idx] === i
                ? 'border-brand-600 bg-brand-600/10 dark:border-brand-400'
                : 'border-rule hover:border-ink-3'
            "
            :data-iq-option="i"
            @click="choose(i)"
          >
            <span class="absolute top-1 left-1.5 text-[11px] font-bold text-ink-3">{{
              LETTERS[i]
            }}</span>
            <span
              v-if="typeof o === 'number'"
              class="block py-3 text-center font-display text-2xl tabular-nums"
              >{{ o }}</span
            >
            <span v-else class="block aspect-square"><IqFigure :fig="o" /></span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn" :disabled="idx === 0" @click="go(idx - 1)">
          ← {{ m.prev }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="idx === questions.length - 1"
          data-iq-next
          @click="go(idx + 1)"
        >
          {{ answers[idx] === null ? m.skip : m.next }} →
        </button>
        <span class="flex-1" />
        <button type="button" class="btn btn-primary" data-iq-finish @click="requestFinish">
          {{ m.finish }}
        </button>
      </div>
      <p
        v-if="confirming"
        class="rounded-md border border-secang/40 bg-secang/5 p-3 text-sm"
        role="alert"
        data-iq-confirm
      >
        {{ fill(m.confirmFinish, { n: questions.length - answeredCount }) }}
        <button
          type="button"
          class="ml-2 font-semibold underline"
          data-iq-confirm-yes
          @click="finish"
        >
          {{ m.finishNow }}
        </button>
      </p>
      <p class="text-xs text-ink-3">{{ m.keysHint }}</p>
    </section>

    <!-- Hasil -->
    <section
      v-else-if="phase === 'done' && result"
      class="space-y-5"
      data-iq-result
      :aria-label="m.resultTitle"
    >
      <p v-if="timedOut" class="rounded-md border border-rule bg-paper-2 p-3 text-sm">
        ⏱ {{ m.timeUp }}
      </p>
      <div class="grid gap-4 md:grid-cols-[auto_1fr]">
        <div
          class="flex flex-col items-center justify-center rounded-md border border-ink bg-paper-2 p-6 text-center md:px-10"
        >
          <p class="text-xs font-semibold tracking-wider text-ink-3 uppercase">
            {{ m.iqEstimate }}
          </p>
          <p
            class="font-display text-7xl leading-none text-brand-700 tabular-nums dark:text-brand-300"
            data-iq-score
          >
            {{ result.iq }}
          </p>
          <p class="mt-2 text-lg font-bold" data-iq-band>{{ BAND }}</p>
          <p class="mt-1 max-w-56 text-sm text-ink-2">{{ percentileText }}</p>
        </div>
        <figure class="rounded-md border border-rule bg-paper-2 p-4">
          <figcaption class="mb-1 text-xs font-semibold text-ink-2">{{ m.curveTitle }}</figcaption>
          <svg
            :viewBox="`0 0 ${CURVE.w} ${CURVE.h}`"
            class="h-auto w-full"
            role="img"
            :aria-label="percentileText"
          >
            <path :d="curve.area" class="fill-brand-600/25 dark:fill-brand-400/25" />
            <path :d="curve.full" fill="none" class="stroke-ink-2" stroke-width="2" />
            <line
              :x1="16"
              :x2="CURVE.w - 16"
              :y1="CURVE.bottom"
              :y2="CURVE.bottom"
              class="stroke-rule"
              stroke-width="1.5"
            />
            <text
              v-for="v in [70, 85, 100, 115, 130, 145]"
              :key="v"
              :x="cx(v)"
              :y="CURVE.bottom + 20"
              text-anchor="middle"
              class="fill-ink-3 text-[12px] tabular-nums"
            >
              {{ v }}
            </text>
            <line
              :x1="curve.x"
              :x2="curve.x"
              :y1="CURVE.top - 4"
              :y2="CURVE.bottom"
              class="stroke-brand-600 dark:stroke-brand-400"
              stroke-width="2.5"
              stroke-dasharray="5 4"
            />
            <rect
              :x="curve.x - 22"
              :y="CURVE.top - 26"
              width="44"
              height="22"
              rx="5"
              class="fill-brand-600 dark:fill-brand-400"
            />
            <text
              :x="curve.x"
              :y="CURVE.top - 10"
              text-anchor="middle"
              class="fill-white text-[13px] font-bold dark:fill-ink"
            >
              {{ result.iq }}
            </text>
          </svg>
          <p class="text-[11px] text-ink-3">{{ fill(m.range, { min: IQ_MIN, max: IQ_MAX }) }}</p>
        </figure>
      </div>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div class="card text-center">
          <p class="text-2xl font-bold tabular-nums" data-iq-correct>
            {{ result.correct }}/{{ result.total }}
          </p>
          <p class="text-xs text-ink-3">{{ m.correct }}</p>
        </div>
        <div class="card text-center">
          <p class="text-2xl font-bold tabular-nums">{{ clock(usedMs) }}</p>
          <p class="text-xs text-ink-3">{{ m.timeUsed }}</p>
        </div>
        <div v-for="k in ['matrix', 'series', 'odd'] as const" :key="k" class="card text-center">
          <p class="text-2xl font-bold tabular-nums">
            {{ result.byKind[k].correct }}/{{ result.byKind[k].total }}
          </p>
          <p class="text-xs text-ink-3">{{ KIND_LABEL[k] }}</p>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <figure class="rounded-md border border-rule bg-paper-2 p-4">
          <figcaption class="mb-3 text-xs font-semibold text-ink-2">{{ m.byLevel }}</figcaption>
          <svg viewBox="0 0 300 130" class="h-auto w-full" role="img" :aria-label="m.byLevel">
            <g v-for="(l, i) in result.byLevel" :key="i">
              <rect :x="14 + i * 58" y="14" width="40" height="90" rx="4" class="fill-ink/5" />
              <rect
                :x="14 + i * 58"
                :y="14 + 90 * (1 - (l.total ? l.correct / l.total : 0))"
                width="40"
                :height="90 * (l.total ? l.correct / l.total : 0)"
                rx="4"
                :class="
                  l.correct * 2 >= l.total ? 'fill-daun' : 'fill-brand-600 dark:fill-brand-400'
                "
              />
              <text
                :x="34 + i * 58"
                y="10"
                text-anchor="middle"
                class="fill-ink text-[11px] font-bold tabular-nums"
              >
                {{ l.correct }}/{{ l.total }}
              </text>
              <text :x="34 + i * 58" y="122" text-anchor="middle" class="fill-ink-3 text-[11px]">
                {{ fill(m.levelN, { n: i + 1 }) }}
              </text>
            </g>
          </svg>
        </figure>
        <div class="space-y-3 rounded-md border border-rule bg-paper-2 p-4 text-sm">
          <p class="text-ink-2">{{ m.disclaimer }}</p>
          <div v-if="history.length > 1">
            <p class="text-xs font-semibold tracking-wider text-ink-3 uppercase">{{ m.history }}</p>
            <p class="mt-1 flex flex-wrap gap-1.5 tabular-nums">
              <span
                v-for="(r, i) in history"
                :key="r.t"
                class="rounded px-2 py-0.5 text-xs"
                :class="
                  i === history.length - 1
                    ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink'
                    : 'bg-paper text-ink-2'
                "
              >
                {{ r.iq }}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-primary" data-iq-again @click="start">
          {{ m.again }}
        </button>
        <ReportButtons
          :png="() => iqReportPng(buildReport())"
          :pdf="() => iqReportPdf(buildReport())"
          :file="m.reportFile"
          :m="m"
        />
      </div>
    </section>
  </div>
</template>
