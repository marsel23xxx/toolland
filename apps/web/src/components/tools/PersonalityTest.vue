<script setup lang="ts">
/**
 * Tes kepribadian (Big Five, 16 tipe, DISC, minat karier) dengan satu alur: pembuka, soal satu
 * per satu, lalu hasil. Teks tes disiapkan halaman .astro sesuai bahasa. Jawaban dan progres
 * hanya disimpan di localStorage browser ini, supaya tes panjang bisa dilanjutkan.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill, pageLocale } from '../../lib/format';
import type { DiscAnswer, Profile } from '../../lib/personality/core';
import {
  isComplete,
  profileOf,
  questionCount,
  type Answers,
  type PersonalityTest,
} from '../../lib/personality';
import {
  personalityPdf,
  personalityPng,
  type PersonalityReport,
} from '../../lib/personality/report';
import { reportDate, reportSite } from '../../lib/typing-report';
import ReportButtons from './ReportButtons.vue';

const props = defineProps<{ test: PersonalityTest; m: Record<string, string> }>();
const m = props.m as ToolMessages<'persona'>;
const test = props.test;
const total = questionCount(test);
const isDisc = test.type === 'disc';

// --- Penyimpanan ---------------------------------------------------------------------------
const STORE = `toolland-persona-${test.meta.id}`;
interface Saved {
  answers?: Answers;
  idx?: number;
  last?: { t: number; short: string; answers: Answers };
}
const saved = ref<Saved>({});

/** Salinan polos (structuredClone tidak bisa menyalin proxy reaktif Vue). */
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function blank(): Answers {
  return isDisc
    ? Array.from({ length: total }, () => ({ most: null, least: null }))
    : Array.from({ length: total }, () => null);
}
function validAnswers(a: unknown): a is Answers {
  return Array.isArray(a) && a.length === total;
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved;
    saved.value = {
      answers: validAnswers(raw.answers) ? raw.answers : undefined,
      idx: typeof raw.idx === 'number' ? raw.idx : 0,
      last: raw.last && validAnswers(raw.last.answers) ? raw.last : undefined,
    };
  } catch {
    // Penyimpanan tidak tersedia atau rusak.
  }
}
function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify(saved.value));
  } catch {
    // Abaikan.
  }
}

// --- Status --------------------------------------------------------------------------------
type Phase = 'intro' | 'test' | 'done';
const phase = ref<Phase>('intro');
const answers = ref<Answers>(blank());
const idx = ref(0);
const profile = ref<Profile>();
const rootEl = ref<HTMLDivElement>();
let advance: ReturnType<typeof setTimeout> | undefined;

const answered = computed(() =>
  isDisc
    ? (answers.value as DiscAnswer[]).filter((a) => a.most != null && a.least != null).length
    : (answers.value as (number | null)[]).filter((a) => a != null).length,
);
const progress = computed(() => Math.round((answered.value / total) * 100));
const resumable = computed(() => {
  const a = saved.value.answers;
  if (!a) return 0;
  return isDisc
    ? (a as DiscAnswer[]).filter((x) => x?.most != null && x?.least != null).length
    : (a as (number | null)[]).filter((x) => x != null).length;
});

function scrollTop() {
  void nextTick(() => {
    const el = rootEl.value;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
  });
}

function begin(resume: boolean) {
  clearTimeout(advance);
  if (resume && saved.value.answers) {
    answers.value = clone(saved.value.answers);
    idx.value = Math.min(total - 1, saved.value.idx ?? 0);
  } else {
    answers.value = blank();
    idx.value = 0;
  }
  profile.value = undefined;
  phase.value = 'test';
  saveProgress();
  scrollTop();
}

function saveProgress() {
  saved.value.answers = clone(answers.value);
  saved.value.idx = idx.value;
  persist();
}

function go(i: number) {
  clearTimeout(advance);
  idx.value = Math.max(0, Math.min(total - 1, i));
  saveProgress();
}

function nextOrFinish() {
  // Lompat ke pernyataan berikutnya yang belum dijawab; selesai kalau semua sudah terjawab.
  if (isComplete(test, answers.value)) return finish();
  const a = answers.value;
  const open = (i: number) =>
    isDisc
      ? (a as DiscAnswer[])[i].most == null || (a as DiscAnswer[])[i].least == null
      : (a as (number | null)[])[i] == null;
  let n = idx.value + 1;
  while (n < total && !open(n)) n++;
  if (n >= total) n = (a as unknown[]).findIndex((_, i) => open(i));
  go(n < 0 ? idx.value : n);
}

function chooseLikert(v: number) {
  if (phase.value !== 'test' || isDisc) return;
  (answers.value as (number | null)[])[idx.value] = v;
  saveProgress();
  clearTimeout(advance);
  advance = setTimeout(nextOrFinish, 220);
}

function chooseDisc(kind: 'most' | 'least', i: number) {
  if (phase.value !== 'test' || !isDisc) return;
  const a = (answers.value as DiscAnswer[])[idx.value];
  a[kind] = a[kind] === i ? null : i;
  // Satu kata tidak bisa sekaligus paling sesuai dan paling tidak sesuai.
  const other = kind === 'most' ? 'least' : 'most';
  if (a[other] === i) a[other] = null;
  saveProgress();
  clearTimeout(advance);
  if (a.most != null && a.least != null) advance = setTimeout(nextOrFinish, 350);
}

function finish() {
  clearTimeout(advance);
  profile.value = profileOf(test, answers.value);
  saved.value = {
    last: { t: Date.now(), short: profile.value.short, answers: clone(answers.value) },
  };
  persist();
  phase.value = 'done';
  scrollTop();
}

function showLast() {
  const last = saved.value.last;
  if (!last) return;
  answers.value = clone(last.answers);
  profile.value = profileOf(test, answers.value);
  phase.value = 'done';
  scrollTop();
}

function onKey(e: KeyboardEvent) {
  if (phase.value !== 'test' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const digit = Number(e.key);
  if (!isDisc && digit >= 1 && digit <= 5) chooseLikert(digit);
  else if (e.key === 'ArrowLeft') go(idx.value - 1);
  else if (e.key === 'ArrowRight' && currentDone.value) go(idx.value + 1);
  else return;
  e.preventDefault();
}

const currentDone = computed(() => {
  const a = answers.value[idx.value];
  return isDisc ? (a as DiscAnswer).most != null && (a as DiscAnswer).least != null : a != null;
});

onMounted(() => {
  load();
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  clearTimeout(advance);
  window.removeEventListener('keydown', onKey);
});

// --- Tampilan soal -------------------------------------------------------------------------
const likert = computed(() => (test.type === 'disc' ? undefined : test.items[idx.value]));
const group = computed(() => (test.type === 'disc' ? test.groups[idx.value] : undefined));
const scale = computed(() => (test.type === 'disc' ? [] : test.scale));
const discNow = computed(() =>
  isDisc ? (answers.value as DiscAnswer[])[idx.value] : { most: null, least: null },
);

// --- Kartu PNG/PDF -------------------------------------------------------------------------
function buildReport(): PersonalityReport {
  return {
    title: test.meta.title,
    subtitle: reportDate(pageLocale()),
    profile: profile.value!,
    disclaimer: test.meta.disclaimer,
    footer: fill(m.reportFooter, { site: reportSite() }),
  };
}
</script>

<template>
  <div ref="rootEl" class="scroll-mt-20 space-y-5" :data-pt="test.meta.id">
    <!-- Pembuka -->
    <section v-if="phase === 'intro'" class="space-y-5" data-pt-intro>
      <div class="flex flex-wrap gap-2 text-sm">
        <span class="rounded-full border border-rule px-3 py-1">
          {{ fill(isDisc ? m.groups : m.questions, { n: total }) }}
        </span>
        <span class="rounded-full border border-rule px-3 py-1">
          {{ fill(m.minutes, { n: test.meta.minutes }) }}
        </span>
        <span class="rounded-full border border-rule px-3 py-1">🔒 {{ m.private }}</span>
      </div>
      <ul class="list-disc space-y-1 pl-5 text-sm text-ink-2">
        <li v-for="line in test.meta.intro" :key="line">{{ line }}</li>
      </ul>
      <p class="rounded-md border border-rule bg-paper-2 p-3 text-xs text-ink-3">
        {{ test.meta.disclaimer }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="resumable > 0">
          <button type="button" class="btn btn-primary" data-pt-resume @click="begin(true)">
            {{ fill(m.resume, { n: resumable, total }) }}
          </button>
          <button type="button" class="btn" data-pt-start @click="begin(false)">
            {{ m.restart }}
          </button>
        </template>
        <button v-else type="button" class="btn btn-primary" data-pt-start @click="begin(false)">
          {{ m.start }}
        </button>
        <p v-if="saved.last" class="text-sm text-ink-3">
          {{ fill(m.lastResult, { short: saved.last.short }) }}
          <button
            type="button"
            class="ml-1 font-semibold text-brand-700 underline dark:text-brand-300"
            data-pt-last
            @click="showLast"
          >
            {{ m.viewLast }}
          </button>
        </p>
      </div>
    </section>

    <!-- Soal -->
    <section v-else-if="phase === 'test'" class="space-y-4" data-pt-test>
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3 text-sm">
          <p class="font-semibold tabular-nums" data-pt-progress>
            {{ fill(m.progress, { n: idx + 1, total }) }}
          </p>
          <p class="text-ink-3 tabular-nums">{{ progress }}%</p>
        </div>
        <div
          class="h-2 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="m.progressLabel"
        >
          <div
            class="h-full rounded-full bg-brand-600 transition-[width] dark:bg-brand-400"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <!-- Likert -->
      <div v-if="likert" class="rounded-md border border-ink bg-paper-2 p-4 sm:p-6" data-pt-q>
        <h2 class="min-h-16 font-display text-xl sm:text-2xl" aria-live="polite">
          {{ likert.text }}
        </h2>
        <div
          class="mt-5 grid gap-2 sm:grid-cols-5"
          role="radiogroup"
          :aria-label="m.answers"
          data-pt-options
        >
          <button
            v-for="(label, i) in scale"
            :key="`${idx}-${i}`"
            type="button"
            role="radio"
            :aria-checked="answers[idx] === i + 1"
            class="flex items-center gap-3 rounded-md border-2 bg-paper px-3 py-2.5 text-left text-sm font-medium transition-colors sm:flex-col sm:gap-1.5 sm:px-2 sm:text-center"
            :class="
              answers[idx] === i + 1
                ? 'border-brand-600 bg-brand-600/10 dark:border-brand-400'
                : 'border-rule hover:border-ink-3'
            "
            :data-pt-option="i + 1"
            @click="chooseLikert(i + 1)"
          >
            <span
              class="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold tabular-nums"
              :class="
                answers[idx] === i + 1
                  ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-ink'
                  : 'border-rule text-ink-3'
              "
              >{{ i + 1 }}</span
            >
            {{ label }}
          </button>
        </div>
      </div>

      <!-- DISC -->
      <div v-else-if="group" class="rounded-md border border-ink bg-paper-2 p-4 sm:p-6" data-pt-q>
        <h2 class="font-display text-xl">{{ m.discPrompt }}</h2>
        <table class="mt-4 w-full text-sm">
          <thead>
            <tr class="text-xs text-ink-3">
              <th class="pb-2 text-left font-semibold">&nbsp;</th>
              <th class="w-24 pb-2 font-semibold sm:w-32">{{ m.most }}</th>
              <th class="w-24 pb-2 font-semibold sm:w-32">{{ m.least }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(w, i) in group.words" :key="`${idx}-${i}`" class="border-t border-rule">
              <td class="py-2.5 pr-2 text-base font-semibold" :data-pt-word="i">{{ w.text }}</td>
              <td class="py-1.5 text-center">
                <button
                  type="button"
                  class="size-10 rounded-full border-2 text-lg font-bold transition-colors"
                  :class="
                    discNow.most === i
                      ? 'border-daun bg-daun text-white'
                      : 'border-rule text-ink-3 hover:border-ink-3'
                  "
                  :aria-pressed="discNow.most === i"
                  :aria-label="`${m.most}: ${w.text}`"
                  :data-pt-most="i"
                  @click="chooseDisc('most', i)"
                >
                  +
                </button>
              </td>
              <td class="py-1.5 text-center">
                <button
                  type="button"
                  class="size-10 rounded-full border-2 text-lg font-bold transition-colors"
                  :class="
                    discNow.least === i
                      ? 'border-secang bg-secang text-white'
                      : 'border-rule text-ink-3 hover:border-ink-3'
                  "
                  :aria-pressed="discNow.least === i"
                  :aria-label="`${m.least}: ${w.text}`"
                  :data-pt-least="i"
                  @click="chooseDisc('least', i)"
                >
                  −
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn" :disabled="idx === 0" data-pt-prev @click="go(idx - 1)">
          ← {{ m.prev }}
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!currentDone || idx === total - 1"
          @click="go(idx + 1)"
        >
          {{ m.next }} →
        </button>
        <span class="flex-1" />
        <button
          v-if="answered === total"
          type="button"
          class="btn btn-primary"
          data-pt-finish
          @click="finish"
        >
          {{ m.seeResult }}
        </button>
      </div>
      <p class="text-xs text-ink-3">{{ isDisc ? m.discHint : m.keysHint }}</p>
    </section>

    <!-- Hasil -->
    <section
      v-else-if="phase === 'done' && profile"
      class="space-y-5"
      data-pt-result
      :aria-label="m.resultLabel"
    >
      <div class="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div class="rounded-md border border-ink bg-paper-2 p-5 sm:p-6">
          <p class="text-xs font-semibold tracking-wider text-ink-3 uppercase">
            {{ profile.eyebrow }}
          </p>
          <p
            v-if="profile.code"
            class="mt-1 font-display text-6xl leading-none text-brand-700 dark:text-brand-300"
            data-pt-code
          >
            {{ profile.code }}
          </p>
          <div v-else-if="profile.chips" class="mt-3 grid grid-cols-5 gap-1.5">
            <div
              v-for="c in profile.chips"
              :key="c.label"
              class="rounded bg-brand-600/10 py-2 text-center dark:bg-brand-400/15"
            >
              <p
                class="font-display text-2xl leading-none text-brand-700 tabular-nums dark:text-brand-300"
              >
                {{ c.value }}
              </p>
              <p class="mt-1 text-xs font-bold text-ink-3">{{ c.label }}</p>
            </div>
          </div>
          <p class="mt-2 text-xl font-bold" data-pt-name>{{ profile.name }}</p>
          <p class="mt-2 text-sm text-ink-2">{{ profile.summary }}</p>
        </div>
        <div class="rounded-md border border-rule bg-paper-2 p-5 sm:p-6">
          <p class="mb-3 text-xs font-semibold text-ink-2">{{ profile.barsTitle }}</p>
          <ul class="space-y-4">
            <li v-for="(b, i) in profile.bars" :key="i" data-pt-bar>
              <template v-if="b.kind === 'uni'">
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span :class="b.strong ? 'font-bold' : 'font-semibold'">{{ b.label }}</span>
                  <span class="font-bold tabular-nums">{{ b.text }}</span>
                </div>
                <div class="relative mt-1.5 h-3 rounded-full bg-ink/10">
                  <div
                    v-if="b.mid"
                    class="absolute inset-y-0"
                    :class="
                      b.strong ? 'bg-brand-600 dark:bg-brand-400' : 'bg-ink-3/70 dark:bg-ink-3'
                    "
                    :style="{
                      left: `${Math.min(50, b.value)}%`,
                      width: `${Math.max(1, Math.abs(b.value - 50))}%`,
                    }"
                  />
                  <div
                    v-else
                    class="h-full rounded-full"
                    :class="
                      b.strong ? 'bg-brand-600 dark:bg-brand-400' : 'bg-ink-3/70 dark:bg-ink-3'
                    "
                    :style="{ width: `${Math.max(4, b.value)}%` }"
                  />
                  <div v-if="b.mid" class="absolute inset-y-[-3px] left-1/2 w-0.5 bg-ink" />
                </div>
              </template>
              <template v-else>
                <div class="flex items-baseline justify-between gap-3 text-sm">
                  <span :class="b.value >= 50 ? 'font-bold' : 'text-ink-3'"
                    >{{ b.left }} <span class="tabular-nums">{{ b.value }}%</span></span
                  >
                  <span class="text-right" :class="b.value < 50 ? 'font-bold' : 'text-ink-3'"
                    ><span class="tabular-nums">{{ 100 - b.value }}%</span> {{ b.right }}</span
                  >
                </div>
                <div class="relative mt-1.5 h-3 rounded-full bg-ink/10">
                  <div
                    class="absolute inset-y-0 bg-brand-600 dark:bg-brand-400"
                    :style="{
                      left: `${Math.min(50, 100 - b.value)}%`,
                      width: `${Math.max(1, Math.abs(b.value - 50))}%`,
                    }"
                  />
                  <div class="absolute inset-y-[-3px] left-1/2 w-0.5 bg-ink" />
                </div>
              </template>
              <p v-if="b.note" class="mt-1 text-xs text-ink-3">{{ b.note }}</p>
            </li>
          </ul>
        </div>
      </div>

      <div
        class="grid gap-4 sm:grid-cols-2"
        :class="profile.sections.length >= 3 ? 'lg:grid-cols-3' : ''"
      >
        <div
          v-for="s in profile.sections"
          :key="s.title"
          class="rounded-md border border-rule bg-paper-2 p-4"
        >
          <h3 class="font-semibold">{{ s.title }}</h3>
          <p v-if="s.text" class="mt-1.5 text-sm text-ink-2">{{ s.text }}</p>
          <ul v-if="s.list" class="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
            <li v-for="item in s.list" :key="item">{{ item }}</li>
          </ul>
        </div>
      </div>

      <p class="rounded-md border border-rule bg-paper-2 p-3 text-xs text-ink-3">
        {{ test.meta.disclaimer }}
      </p>

      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="btn btn-primary" data-pt-again @click="begin(false)">
          {{ m.again }}
        </button>
        <ReportButtons
          :png="() => personalityPng(buildReport())"
          :pdf="() => personalityPdf(buildReport())"
          :file="test.meta.file"
          :m="m"
        />
      </div>
    </section>
  </div>
</template>
