<script setup lang="ts">
/**
 * Tes kecepatan mengetik bergaya game: kata acak (ID/EN), caret dan baris yang mengalir, HUD
 * langsung (KPM, akurasi, combo), lalu layar hasil dengan nilai huruf, grafik KPM per detik,
 * rekor pribadi, dan riwayat. Semua berjalan di browser; hasil disimpan di localStorage.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill, pageLocale } from '../../lib/format';
import {
  TIME_OPTIONS,
  WORD_OPTIONS,
  pickWords,
  prefixCorrect,
  netWpm,
  summarize,
  type Keystroke,
  type Summary,
  type TypingLang,
  type TypingMode,
} from '../../lib/typing';
import { WORD_LISTS } from '../../lib/typing-words';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'typing'>;

// --- Pengaturan (tersimpan) -----------------------------------------------------------------
const STORE = 'toolland-typing';
const mode = ref<TypingMode>('time');
const timeSec = ref<(typeof TIME_OPTIONS)[number]>(30);
const wordCount = ref<(typeof WORD_OPTIONS)[number]>(25);
const lang = ref<TypingLang>(pageLocale());

interface Run {
  t: number;
  wpm: number;
  accuracy: number;
  grade: string;
}
interface Store {
  settings?: { mode: TypingMode; timeSec: number; wordCount: number; lang: TypingLang };
  /** Rekor dan riwayat per kombinasi pengaturan, kunci misalnya "time-30-id". */
  pb?: Record<string, number>;
  runs?: Record<string, Run[]>;
}
const store = reactive<Store>({});
try {
  Object.assign(store, JSON.parse(localStorage.getItem(STORE) ?? '{}') as Store);
  const s = store.settings;
  if (s) {
    if (s.mode === 'words') mode.value = 'words';
    const t = TIME_OPTIONS.find((x) => x === s.timeSec);
    if (t) timeSec.value = t;
    const n = WORD_OPTIONS.find((x) => x === s.wordCount);
    if (n) wordCount.value = n;
    if (s.lang === 'en' || s.lang === 'id') lang.value = s.lang;
  }
} catch {
  // Penyimpanan tidak tersedia: tetap jalan tanpa rekor.
}
function save() {
  store.settings = {
    mode: mode.value,
    timeSec: timeSec.value,
    wordCount: wordCount.value,
    lang: lang.value,
  };
  try {
    localStorage.setItem(STORE, JSON.stringify(store));
  } catch {
    // Mode privat atau kuota penuh: abaikan.
  }
}
const settingsKey = computed(
  () => `${mode.value}-${mode.value === 'time' ? timeSec.value : wordCount.value}-${lang.value}`,
);

// --- Jalannya tes ---------------------------------------------------------------------------
const phase = ref<'idle' | 'run' | 'done'>('idle');
const words = ref<string[]>([]);
const wi = ref(0);
const typed = ref('');
const wrongWords = ref<Set<number>>(new Set());
let keys: Keystroke[] = [];
let correctChars = 0;
const keyCount = ref(0);
const okCount = ref(0);
const combo = ref(0);
const maxCombo = ref(0);
const comboPulse = ref(0);
const shakeOn = ref(false);
let shakeTimer: number | undefined;
const nowMs = ref(0);
const focused = ref(false);
const pausedAt = ref(0);
let startAt = 0;
let raf = 0;

const inputEl = ref<HTMLInputElement>();
const progressEl = ref<HTMLDivElement>();
const wordsBox = ref<HTMLDivElement>();
const wordsInner = ref<HTMLDivElement>();
const caret = ref({ x: 0, y: 0, h: 36, shift: 0 });

const result = ref<Summary>();
const newBest = ref(false);
const prevBest = ref(0);

function newWords() {
  const n = mode.value === 'words' ? wordCount.value : 80;
  words.value = pickWords(WORD_LISTS[lang.value], n);
}
function reset() {
  cancelAnimationFrame(raf);
  phase.value = 'idle';
  wi.value = 0;
  typed.value = '';
  wrongWords.value = new Set();
  keys = [];
  correctChars = 0;
  keyCount.value = 0;
  okCount.value = 0;
  combo.value = 0;
  maxCombo.value = 0;
  nowMs.value = 0;
  pausedAt.value = 0;
  result.value = undefined;
  newBest.value = false;
  newWords();
  void nextTick(measureCaret);
}
watch([mode, timeSec, wordCount, lang], () => {
  save();
  reset();
});

function tick() {
  if (phase.value !== 'run') return;
  if (!pausedAt.value) {
    nowMs.value = performance.now() - startAt;
    if (mode.value === 'time' && nowMs.value >= timeSec.value * 1000) {
      finish(timeSec.value * 1000);
      return;
    }
  }
  raf = requestAnimationFrame(tick);
}

function start() {
  phase.value = 'run';
  startAt = performance.now();
  nowMs.value = 0;
  raf = requestAnimationFrame(tick);
}

function finish(ms: number) {
  cancelAnimationFrame(raf);
  // Kata terakhir yang baru separuh diketik tetap dihitung huruf benarnya.
  const partial = prefixCorrect(words.value[wi.value] ?? '', typed.value);
  const sum = summarize(keys, correctChars + partial, Math.max(1, ms));
  result.value = sum;
  phase.value = 'done';
  const key = settingsKey.value;
  prevBest.value = store.pb?.[key] ?? 0;
  newBest.value = sum.wpm > prevBest.value && sum.keystrokes >= 20;
  if (newBest.value) {
    store.pb = { ...store.pb, [key]: sum.wpm };
    launchConfetti();
  }
  const runs = store.runs?.[key] ?? [];
  runs.push({ t: Date.now(), wpm: sum.wpm, accuracy: sum.accuracy, grade: sum.grade });
  store.runs = { ...store.runs, [key]: runs.slice(-20) };
  save();
}

function commitWord() {
  const target = words.value[wi.value] ?? '';
  const ok = typed.value === target;
  if (ok) correctChars += target.length + 1;
  else wrongWords.value = new Set(wrongWords.value).add(wi.value);
  wi.value++;
  typed.value = '';
  if (mode.value === 'time' && wi.value > words.value.length - 25)
    words.value = words.value.concat(pickWords(WORD_LISTS[lang.value], 40));
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault();
    reset();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (phase.value !== 'idle') reset();
    return;
  }
  if (phase.value === 'done') return;
  if (e.ctrlKey || e.metaKey || e.altKey) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      typed.value = '';
    }
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    typed.value = typed.value.slice(0, -1);
    maybeFinishLastWord();
    return;
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (phase.value !== 'run' || !typed.value) return;
    const t = performance.now() - startAt;
    const ok = typed.value === words.value[wi.value];
    keys.push({ t, ok });
    record(ok);
    const last = mode.value === 'words' && wi.value === words.value.length - 1;
    commitWord();
    if (last) finish(t);
    return;
  }
  if (e.key.length !== 1) return;
  e.preventDefault();
  if (phase.value === 'idle') start();
  const target = words.value[wi.value] ?? '';
  if (typed.value.length >= target.length + 10) return;
  const ok = typed.value.length < target.length && e.key === target[typed.value.length];
  keys.push({ t: performance.now() - startAt, ok });
  typed.value += e.key;
  record(ok);
  maybeFinishLastWord();
}

/** Mode kata: kata terakhir selesai tanpa perlu spasi (termasuk setelah dikoreksi). */
function maybeFinishLastWord() {
  if (
    phase.value !== 'run' ||
    mode.value !== 'words' ||
    wi.value !== words.value.length - 1 ||
    typed.value !== words.value[wi.value]
  )
    return;
  const t = performance.now() - startAt;
  correctChars += typed.value.length;
  typed.value = '';
  wi.value++;
  finish(t);
}

function record(ok: boolean) {
  keyCount.value++;
  if (ok) {
    okCount.value++;
    combo.value++;
    maxCombo.value = Math.max(maxCombo.value, combo.value);
    if (combo.value % 25 === 0) comboPulse.value++;
  } else {
    combo.value = 0;
    shakeOn.value = false;
    window.clearTimeout(shakeTimer);
    requestAnimationFrame(() => (shakeOn.value = true));
    shakeTimer = window.setTimeout(() => (shakeOn.value = false), 220);
  }
}

/** Tes baru: dipakai tombol Ulangi dan tombol Tab di layar hasil. */
function again() {
  reset();
  void nextTick(() => inputEl.value?.focus());
}
/** Di layar hasil tidak ada input yang menangkap Tab, jadi dengarkan di window. */
function onWindowKeydown(e: KeyboardEvent) {
  if (phase.value === 'done' && (e.key === 'Tab' || e.key === 'Enter')) {
    e.preventDefault();
    again();
  }
}

function onFocus() {
  focused.value = true;
  if (phase.value === 'run' && pausedAt.value) {
    startAt += performance.now() - pausedAt.value;
    pausedAt.value = 0;
  }
}
function onBlur() {
  focused.value = false;
  if (phase.value === 'run') pausedAt.value = performance.now();
}

// --- Caret dan gulir baris ------------------------------------------------------------------
function measureCaret() {
  const box = wordsBox.value;
  const cur = box?.querySelector<HTMLElement>('[data-cur]');
  if (!box || !cur) return;
  const chars = cur.querySelectorAll<HTMLElement>('[data-ch]');
  const i = Math.min(typed.value.length, chars.length);
  let x = cur.offsetLeft;
  if (chars.length) {
    const c = chars[Math.min(i, chars.length - 1)];
    x = i >= chars.length ? c.offsetLeft + c.offsetWidth : c.offsetLeft;
  }
  const h = cur.offsetHeight;
  // Baris aktif dijaga di baris kedua: baris yang sudah lewat digeser ke atas.
  // Transform diset lewat CSSOM, bukan atribut style, agar lolos CSP (style-src-attr).
  const shift = Math.max(0, cur.offsetTop - h);
  caret.value = { x, y: cur.offsetTop - shift, h, shift };
  if (wordsInner.value) wordsInner.value.style.transform = shift ? `translateY(-${shift}px)` : '';
}
watch([typed, wi, phase, focused], () => void nextTick(measureCaret));
onMounted(() => {
  reset();
  window.addEventListener('resize', measureCaret);
  window.addEventListener('keydown', onWindowKeydown);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', measureCaret);
  window.removeEventListener('keydown', onWindowKeydown);
});

// --- Tampilan langsung ----------------------------------------------------------------------
const elapsed = computed(() => Math.max(1, nowMs.value));
const liveWpm = computed(() =>
  netWpm(correctChars + prefixCorrect(words.value[wi.value] ?? '', typed.value), elapsed.value),
);
const liveAcc = computed(() =>
  keyCount.value ? Math.round((okCount.value / keyCount.value) * 100) : 100,
);
const timeLeft = computed(() => Math.max(0, Math.ceil(timeSec.value - nowMs.value / 1000)));
const progress = computed(() =>
  mode.value === 'time'
    ? Math.min(1, nowMs.value / (timeSec.value * 1000))
    : Math.min(1, wi.value / wordCount.value),
);
// Lebar bilah progres diset lewat CSSOM, bukan atribut style, agar lolos CSP.
watch([progress, phase], () => {
  if (progressEl.value) progressEl.value.style.width = `${progress.value * 100}%`;
});

function charClass(w: string, i: number, ci: number): string {
  if (i === wi.value)
    return ci < typed.value.length ? (typed.value[ci] === w[ci] ? 'ty-ok' : 'ty-bad') : 'ty-dim';
  if (i < wi.value) return wrongWords.value.has(i) ? 'ty-bad' : 'ty-ok';
  return 'ty-dim';
}

// --- Grafik hasil ---------------------------------------------------------------------------
const CW = 560;
const CH = 170;
const PAD = { l: 36, r: 10, t: 12, b: 24 };
const hover = ref(-1);
const chart = computed(() => {
  const s = result.value?.series ?? [];
  if (!s.length) return undefined;
  const w = CW - PAD.l - PAD.r;
  const h = CH - PAD.t - PAD.b;
  const maxY = Math.max(10, Math.ceil(Math.max(...s.map((p) => p.wpm)) / 20) * 20);
  const x = (i: number) => PAD.l + (s.length === 1 ? w / 2 : (i / (s.length - 1)) * w);
  const y = (v: number) => PAD.t + h - (v / maxY) * h;
  const pts = s.map((p, i) => ({ ...p, x: x(i), y: y(p.wpm) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${PAD.t + h} L${pts[0].x.toFixed(1)} ${PAD.t + h} Z`;
  const step = Math.max(1, Math.ceil(s.length / 7));
  return {
    pts,
    line,
    area,
    maxY,
    avgY: y(Math.min(maxY, result.value!.raw)),
    grid: [0, maxY / 2, maxY].map((v) => ({ v, y: y(v) })),
    ticks: pts.filter((_, i) => i % step === 0 || i === s.length - 1),
    bottom: PAD.t + h,
  };
});

// --- Nilai, riwayat, confetti ---------------------------------------------------------------
const GRADE_STYLE: Record<string, string> = {
  S: 'bg-daun text-white',
  A: 'bg-nila text-white',
  B: 'bg-kunyit text-white',
  C: 'bg-terakota text-white',
  D: 'bg-secang text-white',
};
const gradeNote = computed(() => (result.value ? m[`grade${result.value.grade}` as 'gradeS'] : ''));
const best = computed(() => store.pb?.[settingsKey.value] ?? 0);
const history = computed(() => (store.runs?.[settingsKey.value] ?? []).slice(-10));

const confettiEl = ref<HTMLCanvasElement>();
function launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  void nextTick(() => {
    const c = confettiEl.value;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const colors = ['#8f5e0a', '#9a4322', '#32566b', '#3e5d46', '#eab54d'];
    const parts = Array.from({ length: 90 }, () => ({
      x: Math.random() * c.width,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 1.6 + Math.random() * 2.6,
      s: 4 + Math.random() * 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    const draw = (t: number) => {
      const dt = t - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - dt / 1600);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      }
      if (dt < 1600) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    requestAnimationFrame(draw);
  });
}

const chips = 'btn px-3 py-1.5 text-sm';
</script>

<template>
  <div class="space-y-4">
    <!-- Pengaturan -->
    <div v-if="phase !== 'run'" class="flex flex-wrap items-center gap-x-5 gap-y-3">
      <div role="group" :aria-label="m.mode" class="flex gap-1.5">
        <button
          type="button"
          :class="[chips, mode === 'time' ? 'btn-active' : 'btn-secondary']"
          data-ty-mode="time"
          @click="mode = 'time'"
        >
          {{ m.modeTime }}
        </button>
        <button
          type="button"
          :class="[chips, mode === 'words' ? 'btn-active' : 'btn-secondary']"
          data-ty-mode="words"
          @click="mode = 'words'"
        >
          {{ m.modeWords }}
        </button>
      </div>
      <div v-if="mode === 'time'" role="group" :aria-label="m.modeTime" class="flex gap-1.5">
        <button
          v-for="t in TIME_OPTIONS"
          :key="t"
          type="button"
          :class="[chips, 'tabular-nums', timeSec === t ? 'btn-active' : 'btn-secondary']"
          :data-ty-time="t"
          @click="timeSec = t"
        >
          {{ fill(m.seconds, { n: t }) }}
        </button>
      </div>
      <div v-else role="group" :aria-label="m.modeWords" class="flex gap-1.5">
        <button
          v-for="n in WORD_OPTIONS"
          :key="n"
          type="button"
          :class="[chips, 'tabular-nums', wordCount === n ? 'btn-active' : 'btn-secondary']"
          :data-ty-count="n"
          @click="wordCount = n"
        >
          {{ n }}
        </button>
      </div>
      <div role="group" :aria-label="m.lang" class="flex gap-1.5">
        <button
          type="button"
          :class="[chips, lang === 'id' ? 'btn-active' : 'btn-secondary']"
          data-ty-lang="id"
          @click="lang = 'id'"
        >
          {{ m.langId }}
        </button>
        <button
          type="button"
          :class="[chips, lang === 'en' ? 'btn-active' : 'btn-secondary']"
          data-ty-lang="en"
          @click="lang = 'en'"
        >
          {{ m.langEn }}
        </button>
      </div>
    </div>

    <!-- Arena ketik -->
    <div
      v-if="phase !== 'done'"
      class="relative cursor-text overflow-hidden rounded-md border border-ink bg-paper-2 px-5 pt-4 pb-5 select-none sm:px-7"
      data-ty-area
      @mousedown.prevent="inputEl?.focus()"
    >
      <input
        ref="inputEl"
        class="absolute h-px w-px opacity-0"
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :aria-label="m.inputLabel"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <!-- HUD -->
      <div class="mb-3 flex h-12 items-end justify-between gap-4">
        <div class="flex items-end gap-5">
          <p
            class="font-display text-4xl leading-none tabular-nums text-brand-700 dark:text-brand-300"
            data-ty-clock
          >
            <template v-if="mode === 'time'">{{ phase === 'run' ? timeLeft : timeSec }}</template>
            <template v-else
              >{{ wi }}<span class="text-xl text-ink-3">/{{ wordCount }}</span></template
            >
          </p>
          <p v-if="phase === 'run'" class="text-sm leading-5 text-ink-2">
            <span class="block font-semibold tabular-nums">{{ liveWpm }} {{ m.wpm }}</span>
            <span class="block text-xs text-ink-3 tabular-nums"
              >{{ liveAcc }}% · {{ m.accuracy.toLowerCase() }}</span
            >
          </p>
        </div>
        <Transition name="ty-pop">
          <p
            v-if="combo >= 10"
            :key="comboPulse"
            class="ty-combo rounded-full bg-brand-600 px-3 py-1 font-display text-lg leading-none text-white tabular-nums dark:bg-brand-400 dark:text-ink"
            data-ty-combo
          >
            ⚡ {{ combo }} <span class="text-xs tracking-widest uppercase">combo</span>
          </p>
        </Transition>
      </div>

      <!-- Kata -->
      <div
        ref="wordsBox"
        class="relative h-[7.5rem] overflow-hidden font-mono text-[1.65rem] leading-10"
        :class="{ 'ty-shake': shakeOn }"
      >
        <div
          ref="wordsInner"
          class="flex flex-wrap gap-x-[0.6em] transition-transform duration-150"
          aria-hidden="true"
        >
          <span
            v-for="(w, i) in words"
            :key="i"
            v-memo="[w, i === wi, i < wi, wrongWords.has(i), i === wi ? typed : '']"
            :data-cur="i === wi ? '' : undefined"
            :data-word="i >= wi ? w : undefined"
            class="whitespace-nowrap"
            :class="
              i < wi && wrongWords.has(i)
                ? 'underline decoration-secang/60 decoration-2 underline-offset-4'
                : ''
            "
          >
            <span v-for="(c, ci) in w.split('')" :key="ci" data-ch :class="charClass(w, i, ci)">{{
              c
            }}</span>
            <span v-if="i === wi && typed.length > w.length" class="ty-bad opacity-70">{{
              typed.slice(w.length)
            }}</span>
          </span>
        </div>
        <!-- Caret -->
        <div
          v-if="focused"
          class="pointer-events-none absolute w-[3px] rounded-full bg-brand-600 transition-all duration-75 dark:bg-brand-400"
          :class="{ 'ty-blink': phase !== 'run' }"
          :style="{ left: `${caret.x}px`, top: `${caret.y + 4}px`, height: `${caret.h - 8}px` }"
        />
        <!-- Ajakan fokus -->
        <div
          v-if="!focused"
          class="absolute inset-0 grid place-items-center bg-paper-2/70 backdrop-blur-[2px]"
        >
          <p class="rounded-md border border-rule bg-paper px-4 py-2 text-sm text-ink-2">
            {{ phase === 'run' ? m.paused : m.focusHint }}
          </p>
        </div>
      </div>

      <!-- Progres -->
      <div class="absolute inset-x-0 bottom-0 h-1 bg-paper">
        <div
          ref="progressEl"
          class="h-full w-0 bg-brand-600 transition-[width] duration-200 dark:bg-brand-400"
        />
      </div>
    </div>
    <p v-if="phase !== 'done'" class="text-xs text-ink-3">{{ m.hintKeys }}</p>

    <!-- Hasil -->
    <section
      v-if="phase === 'done' && result"
      class="relative space-y-5"
      data-ty-result
      :aria-label="m.resultTitle"
    >
      <canvas
        ref="confettiEl"
        class="pointer-events-none absolute inset-0 z-10 h-full w-full"
        aria-hidden="true"
      />
      <div class="grid gap-4 sm:grid-cols-[auto_1fr]">
        <!-- Nilai -->
        <div
          class="flex items-center gap-4 rounded-md border border-ink bg-paper-2 p-4 sm:flex-col sm:justify-center sm:px-8"
        >
          <p
            class="grid size-24 place-items-center rounded-md font-display text-6xl"
            :class="GRADE_STYLE[result.grade]"
            data-ty-grade
          >
            {{ result.grade }}
          </p>
          <div class="sm:text-center">
            <p class="text-sm text-ink-2">{{ gradeNote }}</p>
            <p
              v-if="newBest"
              class="mt-1 inline-block rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-brand-400 dark:text-ink"
              data-ty-best
            >
              🏆 {{ m.newBest }}
            </p>
            <p v-else-if="best" class="mt-1 text-xs text-ink-3 tabular-nums">
              {{ fill(m.best, { n: best }) }}
            </p>
          </div>
        </div>
        <!-- Angka -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div class="card flex flex-col justify-center text-center">
            <p
              class="font-display text-5xl leading-none tabular-nums text-brand-700 dark:text-brand-300"
              data-ty-wpm
            >
              {{ result.wpm }}
            </p>
            <p class="mt-1 text-xs tracking-wider text-ink-3 uppercase">{{ m.wpm }}</p>
          </div>
          <div class="card flex flex-col justify-center text-center">
            <p class="font-display text-5xl leading-none tabular-nums" data-ty-acc>
              {{ result.accuracy }}<span class="text-2xl">%</span>
            </p>
            <p class="mt-1 text-xs tracking-wider text-ink-3 uppercase">{{ m.accuracy }}</p>
          </div>
          <div class="card grid grid-cols-2 items-center gap-y-1 text-center sm:grid-cols-1">
            <p class="text-xl font-bold tabular-nums">{{ result.raw }}</p>
            <p class="text-xs text-ink-3">{{ m.raw }}</p>
          </div>
          <div class="card grid grid-cols-2 items-center gap-y-1 text-center sm:grid-cols-1">
            <p class="text-xl font-bold tabular-nums">{{ result.consistency }}%</p>
            <p class="text-xs text-ink-3">{{ m.consistency }}</p>
          </div>
          <div class="card grid grid-cols-2 items-center gap-y-1 text-center sm:grid-cols-1">
            <p class="text-xl font-bold tabular-nums text-secang dark:text-[#e98a98]">
              {{ result.errors }}
            </p>
            <p class="text-xs text-ink-3">{{ m.errors }}</p>
          </div>
          <div class="card grid grid-cols-2 items-center gap-y-1 text-center sm:grid-cols-1">
            <p class="text-xl font-bold tabular-nums">⚡ {{ maxCombo }}</p>
            <p class="text-xs text-ink-3">{{ m.maxCombo }}</p>
          </div>
        </div>
      </div>

      <!-- Grafik -->
      <figure v-if="chart" class="rounded-md border border-rule bg-paper-2 p-4">
        <figcaption class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span class="font-semibold">{{ m.chartTitle }}</span>
          <span class="inline-flex items-center gap-1.5"
            ><span class="h-0.5 w-5 rounded bg-brand-600 dark:bg-brand-400" />{{ m.wpm }}</span
          >
          <span class="inline-flex items-center gap-1.5"
            ><span class="w-5 border-t-2 border-dashed border-ink-3" />{{ m.chartAvg }}</span
          >
          <span class="inline-flex items-center gap-1 text-secang dark:text-[#e98a98]"
            ><span aria-hidden="true">✕</span>{{ m.errors }}</span
          >
        </figcaption>
        <div class="relative">
          <svg
            :viewBox="`0 0 ${CW} ${CH}`"
            class="h-auto w-full"
            role="img"
            :aria-label="m.chartTitle"
            @pointerleave="hover = -1"
          >
            <line
              v-for="g in chart.grid"
              :key="g.v"
              :x1="PAD.l"
              :x2="CW - PAD.r"
              :y1="g.y"
              :y2="g.y"
              class="stroke-rule"
              stroke-width="1"
            />
            <text
              v-for="g in chart.grid"
              :key="`t${g.v}`"
              :x="PAD.l - 6"
              :y="g.y + 3"
              text-anchor="end"
              class="fill-ink-3 text-[10px] tabular-nums"
            >
              {{ g.v }}
            </text>
            <text
              v-for="p in chart.ticks"
              :key="`x${p.sec}`"
              :x="p.x"
              :y="CH - 8"
              text-anchor="middle"
              class="fill-ink-3 text-[10px] tabular-nums"
            >
              {{ p.sec }}s
            </text>
            <path :d="chart.area" class="fill-brand-600/10 dark:fill-brand-400/10" />
            <line
              :x1="PAD.l"
              :x2="CW - PAD.r"
              :y1="chart.avgY"
              :y2="chart.avgY"
              class="stroke-ink-3"
              stroke-width="1.5"
              stroke-dasharray="5 4"
            />
            <path
              :d="chart.line"
              fill="none"
              class="stroke-brand-600 dark:stroke-brand-400"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
            <g
              v-for="p in chart.pts.filter((q) => q.errors > 0)"
              :key="`e${p.sec}`"
              class="stroke-secang dark:stroke-[#e98a98]"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y - 4" :y2="p.y + 4" />
              <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y + 4" :y2="p.y - 4" />
            </g>
            <circle
              v-if="hover >= 0 && chart.pts[hover]"
              :cx="chart.pts[hover].x"
              :cy="chart.pts[hover].y"
              r="5"
              class="fill-paper-2 stroke-brand-600 dark:stroke-brand-400"
              stroke-width="2.5"
            />
            <rect
              v-for="(p, i) in chart.pts"
              :key="`h${p.sec}`"
              :x="p.x - (CW - PAD.l - PAD.r) / chart.pts.length / 2"
              :y="PAD.t"
              :width="(CW - PAD.l - PAD.r) / chart.pts.length"
              :height="chart.bottom - PAD.t"
              fill="transparent"
              @pointerenter="hover = i"
            />
          </svg>
          <div
            v-if="hover >= 0 && chart.pts[hover]"
            class="pointer-events-none absolute -translate-x-1/2 rounded border border-rule bg-paper px-2 py-1 text-xs whitespace-nowrap shadow-sm tabular-nums"
            :style="{ left: `${(chart.pts[hover].x / CW) * 100}%`, top: '0px' }"
          >
            {{ fill(m.chartSecond, { n: chart.pts[hover].sec }) }} · {{ chart.pts[hover].wpm }}
            {{ m.wpm
            }}<template v-if="chart.pts[hover].errors"> · {{ chart.pts[hover].errors }} ✕</template>
          </div>
        </div>
        <table class="sr-only">
          <caption>
            {{
              m.chartTitle
            }}
          </caption>
          <thead>
            <tr>
              <th>{{ m.chartSecondHead }}</th>
              <th>{{ m.wpm }}</th>
              <th>{{ m.errors }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in result.series" :key="p.sec">
              <td>{{ p.sec }}</td>
              <td>{{ p.wpm }}</td>
              <td>{{ p.errors }}</td>
            </tr>
          </tbody>
        </table>
      </figure>

      <!-- Riwayat -->
      <div
        v-if="history.length > 1"
        class="flex items-end justify-between gap-6 rounded-md border border-rule bg-paper-2 p-4"
      >
        <div>
          <p class="text-xs tracking-wider text-ink-3 uppercase">{{ m.history }}</p>
          <p class="mt-1 text-sm text-ink-2 tabular-nums">
            {{ fill(m.attempts, { n: (store.runs?.[settingsKey] ?? []).length }) }} ·
            {{ fill(m.best, { n: best }) }}
          </p>
        </div>
        <div class="flex h-12 items-end gap-1" role="img" :aria-label="m.history">
          <div
            v-for="(r, i) in history"
            :key="r.t"
            class="w-3 rounded-t-sm"
            :class="
              i === history.length - 1
                ? 'bg-brand-600 dark:bg-brand-400'
                : 'bg-brand-600/35 dark:bg-brand-400/35'
            "
            :style="{
              height: `${Math.max(8, (r.wpm / Math.max(...history.map((x) => x.wpm), 1)) * 100)}%`,
            }"
            :title="`${r.wpm} ${m.wpm} · ${r.accuracy}%`"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" data-ty-again @click="again">
          {{ m.again }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ty-ok {
  color: var(--color-ink);
}
.ty-bad {
  color: var(--secang);
}
@media (prefers-color-scheme: dark) {
  .ty-bad {
    color: var(--secang-light);
  }
}
.ty-dim {
  color: var(--color-ink-3);
}
.ty-blink {
  animation: ty-blink 1.1s step-end infinite;
}
@keyframes ty-blink {
  50% {
    opacity: 0;
  }
}
.ty-shake {
  animation: ty-shake 0.18s linear;
}
@keyframes ty-shake {
  25% {
    transform: translateX(-3px);
  }
  75% {
    transform: translateX(3px);
  }
}
.ty-combo {
  animation: ty-pop-in 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.ty-pop-enter-active {
  animation: ty-pop-in 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);
}
.ty-pop-leave-active {
  transition: opacity 0.15s;
}
.ty-pop-leave-to {
  opacity: 0;
}
@keyframes ty-pop-in {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ty-shake,
  .ty-combo,
  .ty-pop-enter-active {
    animation: none;
  }
}
</style>
