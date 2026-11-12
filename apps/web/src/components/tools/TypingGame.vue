<script setup lang="ts">
/**
 * "Laskar Kata": game mengetik luar angkasa. Pesawat musuh turun membawa kata; ketik hurufnya
 * untuk menembak, selesaikan kata untuk menghancurkan. Logika di lib/typing-game.ts, gambar di
 * lib/typing-game-render.ts, suara di lib/typing-sound.ts. Komponen ini hanya mengurus loop,
 * masukan, HUD, dan layar awal/jeda/hasil. Skor tertinggi disimpan di localStorage.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { fill, pageLocale } from '../../lib/format';
import type { TypingLang } from '../../lib/typing';
import { MAX_EMP, SHIELDS, TypingGame, type GameEvent } from '../../lib/typing-game';
import { GameRenderer } from '../../lib/typing-game-render';
import { reportDate, reportSite, type ReportData } from '../../lib/typing-report';
import { GameSound } from '../../lib/typing-sound';
import { WORD_LISTS } from '../../lib/typing-words';
import TypingChart from './TypingChart.vue';
import TypingExport from './TypingExport.vue';

const props = defineProps<{ m: Record<string, string>; fullscreen?: boolean }>();
const m = props.m as ToolMessages<'typing'>;

// --- Simpanan: bahasa, suara, skor tertinggi, riwayat ---------------------------------------
const STORE = 'toolland-typing-game';
interface Run {
  t: number;
  score: number;
  wave: number;
  wpm: number;
}
interface Store {
  lang?: TypingLang;
  muted?: boolean;
  best?: Partial<Record<TypingLang, number>>;
  runs?: Partial<Record<TypingLang, Run[]>>;
}
const store = reactive<Store>({});
try {
  Object.assign(store, JSON.parse(localStorage.getItem(STORE) ?? '{}') as Store);
} catch {
  // Penyimpanan tidak tersedia: tetap bisa main tanpa rekor.
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(store));
  } catch {
    // Mode privat atau kuota penuh: abaikan.
  }
}
const lang = ref<TypingLang>(
  store.lang === 'en' || store.lang === 'id' ? store.lang : pageLocale(),
);
const muted = ref(!!store.muted);
function setLang(l: TypingLang) {
  lang.value = l;
  store.lang = l;
  save();
}
function toggleSound() {
  muted.value = !muted.value;
  sound.muted = muted.value;
  store.muted = muted.value;
  save();
}

// --- Keadaan --------------------------------------------------------------------------------
type Phase = 'menu' | 'play' | 'paused' | 'over';
const phase = ref<Phase>('menu');
const canvasEl = ref<HTMLCanvasElement>();
const wrapEl = ref<HTMLDivElement>();
/** Kotak pembungkus arena; dalam layar penuh arena diskalakan agar muat di kotak ini. */
const boxEl = ref<HTMLDivElement>();
const inputEl = ref<HTMLInputElement>();
const wide = ref(true);
let game: TypingGame | null = null;
let renderer: GameRenderer | null = null;
const sound = new GameSound();
sound.muted = muted.value;

const hud = reactive({
  score: 0,
  wave: 0,
  shields: SHIELDS,
  emps: 1,
  mult: 1,
  combo: 0,
  wpm: 0,
  acc: 100,
});
const targets = ref<string[]>([]);
const banner = ref<{ title: string; sub: string } | null>(null);
let bannerTimer: number | undefined;
const result = ref<ReturnType<TypingGame['summary']>>();
const newBest = ref(false);
const best = computed(() => store.best?.[lang.value] ?? 0);

/** Ukuran dunia: lebar untuk desktop, tegak untuk layar sempit. */
const dims = () => (wide.value ? { W: 960, H: 600 } : { W: 540, H: 720 });

// --- Loop -----------------------------------------------------------------------------------
let raf = 0;
let last = 0;
let hudAcc = 0;

function frame(now: number) {
  const dt = last ? Math.min(50, now - last) : 16;
  last = now;
  if (game && phase.value === 'play') game.update(dt);
  if (game && game.events.length) {
    const evs = game.events;
    game.events = [];
    renderer?.consume(evs, game);
    for (const e of evs) handleEvent(e);
  }
  renderer?.draw(game, dt, phase.value === 'play' || phase.value === 'menu');
  hudAcc += dt;
  if (hudAcc > 90) {
    hudAcc = 0;
    syncHud();
  }
  raf = requestAnimationFrame(frame);
}

function syncHud() {
  if (!game) return;
  hud.score = game.score;
  hud.wave = game.wave;
  hud.shields = game.shields;
  hud.emps = game.emps;
  hud.mult = game.multiplier;
  hud.combo = game.combo;
  const ok = game.keys.reduce((a, k) => a + (k.ok ? 1 : 0), 0);
  hud.acc = game.keys.length ? Math.round((ok / game.keys.length) * 100) : 100;
  hud.wpm = game.keys.length > 5 ? game.wpm : 0;
  targets.value = game.enemies
    .filter((e) => !e.doomed && e.y > -20)
    .sort((a, b) => b.y - a.y)
    .map((e) => e.word.slice(e.typed));
}

function handleEvent(e: GameEvent) {
  sound.play(e);
  if (e.type === 'wave') {
    showBanner(fill(m.waveN, { n: e.wave }), e.boss ? m.bossIncoming : m.waveReady);
  } else if (e.type === 'bossWord') {
    showBanner(m.bossHit, fill(m.bossLeft, { n: e.left }), 1100);
  } else if (e.type === 'gameover') {
    finish();
  }
}

function showBanner(title: string, sub: string, ms = 2000) {
  banner.value = { title, sub };
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => (banner.value = null), ms);
}

// --- Alur permainan -------------------------------------------------------------------------
/** Arena lebar untuk layar mendatar, tegak untuk layar sempit atau HP berdiri. */
function chooseWide() {
  const box = boxEl.value;
  if (!box) return true;
  if (props.fullscreen) return box.clientWidth >= box.clientHeight * 0.9;
  return box.clientWidth >= 640;
}

function layout() {
  const wrap = wrapEl.value;
  const box = boxEl.value;
  const canvas = canvasEl.value;
  if (!wrap || !box || !canvas) return;
  if (!game) wide.value = chooseWide();
  const { W, H } = game ? { W: game.W, H: game.H } : dims();
  // Layar penuh: skalakan arena sebesar mungkin tanpa mengubah proporsi. Ukuran diset lewat
  // CSSOM (bukan atribut style) agar lolos CSP.
  let cssW: number;
  if (props.fullscreen) {
    cssW = Math.max(200, Math.min(box.clientWidth, (box.clientHeight * W) / H));
    wrap.style.width = `${cssW}px`;
    wrap.style.height = `${(cssW * H) / W}px`;
  } else {
    wrap.style.width = '';
    wrap.style.height = '';
    cssW = wrap.clientWidth;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!renderer) renderer = new GameRenderer(canvas, W, H);
  renderer.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.resize(W, H, cssW, dpr);
}

// Masuk/keluar layar penuh: susun ulang arena; keluar (misalnya lewat Esc) sekaligus menjeda.
watch(
  () => props.fullscreen,
  (fs) => {
    if (!fs) pause();
    void nextTick(() => {
      layout();
      if (phase.value === 'play') inputEl.value?.focus();
    });
  },
);

function start() {
  wide.value = chooseWide();
  game = new TypingGame({ ...dims(), words: WORD_LISTS[lang.value] });
  result.value = undefined;
  newBest.value = false;
  banner.value = null;
  phase.value = 'play';
  void nextTick(() => {
    layout();
    game?.start();
    inputEl.value?.focus();
  });
}

function finish() {
  if (!game) return;
  phase.value = 'over';
  const sum = game.summary();
  result.value = sum;
  syncHud();
  newBest.value = sum.score > best.value && sum.score > 0;
  if (newBest.value) store.best = { ...store.best, [lang.value]: sum.score };
  const runs = store.runs?.[lang.value] ?? [];
  runs.push({ t: Date.now(), score: sum.score, wave: sum.wave, wpm: sum.wpm });
  store.runs = { ...store.runs, [lang.value]: runs.slice(-20) };
  save();
  banner.value = null;
}

function pause() {
  if (phase.value === 'play') phase.value = 'paused';
}
function resume() {
  if (phase.value !== 'paused') return;
  phase.value = 'play';
  last = 0;
  inputEl.value?.focus();
}
function quit() {
  game?.quit();
}

// --- Masukan --------------------------------------------------------------------------------
/** Huruf dibaca dari event input agar keyboard virtual di HP juga bekerja. */
function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  const text = el.value;
  el.value = '';
  if (phase.value !== 'play' || !game) return;
  for (const ch of text) game.input(ch);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (phase.value === 'menu' || phase.value === 'over') start();
    else if (phase.value === 'play') game?.emp();
    else if (phase.value === 'paused') resume();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (phase.value === 'play') pause();
    else if (phase.value === 'paused') resume();
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    game?.release();
  } else if (e.key === ' ') {
    e.preventDefault();
  }
}

function focusArena() {
  inputEl.value?.focus();
  if (phase.value === 'paused') resume();
}
function onBlur() {
  pause();
}
function onVisibility() {
  if (document.hidden) pause();
}

// --- Siklus hidup ---------------------------------------------------------------------------
let ro: ResizeObserver | undefined;
onMounted(() => {
  layout();
  raf = requestAnimationFrame(frame);
  if ('ResizeObserver' in window && boxEl.value) {
    ro = new ResizeObserver(() => layout());
    ro.observe(boxEl.value);
  }
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  window.clearTimeout(bannerTimer);
  document.removeEventListener('visibilitychange', onVisibility);
  sound.close();
});

const GRADE_STYLE: Record<string, string> = {
  S: 'bg-daun text-white',
  A: 'bg-nila text-white',
  B: 'bg-kunyit text-white',
  C: 'bg-terakota text-white',
  D: 'bg-secang text-white',
};
/** Data kartu hasil untuk disimpan sebagai gambar atau PDF. */
function buildReport(): ReportData {
  const r = result.value!;
  return {
    title: m.reportTitle,
    subtitle: [
      m.reportGame,
      lang.value === 'id' ? m.langId : m.langEn,
      reportDate(pageLocale()),
    ].join(' · '),
    grade: r.grade,
    gradeNote: gradeNote.value,
    main: [
      { label: m.wpm, value: String(r.wpm) },
      { label: m.accuracy, value: `${r.accuracy}%` },
    ],
    stats: [
      { label: m.score, value: r.score.toLocaleString() },
      { label: m.waveReached, value: String(r.wave) },
      { label: m.destroyed, value: String(r.destroyed) },
      { label: m.raw, value: String(r.raw) },
      { label: m.maxCombo, value: String(r.maxCombo) },
      { label: m.errors, value: String(r.errors), tone: 'bad' },
    ],
    series: r.series,
    raw: r.raw,
    labels: {
      chartTitle: m.chartTitle,
      chartAvg: m.chartAvg,
      errors: m.errors,
      wpm: m.wpm,
      footer: fill(m.reportFooter, { site: reportSite() }),
    },
  };
}

const gradeNote = computed(() => (result.value ? m[`grade${result.value.grade}` as 'gradeS'] : ''));
const chips = 'btn px-3 py-1.5 text-sm';
</script>

<template>
  <div :class="fullscreen ? 'flex h-full min-h-0 flex-col' : 'space-y-4'">
    <!-- Arena -->
    <div ref="boxEl" :class="fullscreen ? 'flex min-h-0 flex-1 items-center justify-center' : ''">
      <div
        ref="wrapEl"
        class="relative overflow-hidden rounded-md border border-ink bg-[#070a17] select-none"
        :class="fullscreen ? 'shrink-0' : wide ? 'aspect-[960/600]' : 'aspect-[540/720]'"
        data-ty-game
        @mousedown.prevent="focusArena"
      >
        <canvas ref="canvasEl" class="block h-full w-full" role="img" :aria-label="m.gameArea" />
        <input
          ref="inputEl"
          class="absolute top-0 left-0 h-px w-px opacity-0"
          autocapitalize="off"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          :aria-label="m.inputLabel"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        />
        <ul class="sr-only" aria-hidden="true" data-ty-targets>
          <li v-for="(w, i) in targets" :key="i" :data-word="w">{{ w }}</li>
        </ul>

        <!-- HUD -->
        <div
          v-if="phase === 'play' || phase === 'paused'"
          class="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 text-[#f3eee4] sm:p-4"
        >
          <div>
            <p class="font-display text-3xl leading-none tabular-nums sm:text-4xl" data-ty-score>
              {{ hud.score.toLocaleString() }}
            </p>
            <p class="mt-1 text-xs tabular-nums opacity-80">
              <span
                v-if="hud.mult > 1"
                class="mr-2 rounded bg-[#eab54d] px-1.5 py-0.5 font-bold text-[#1b1814]"
                >×{{ hud.mult }}</span
              >
              <span>{{ hud.wpm }} {{ m.wpm }} · {{ hud.acc }}%</span>
            </p>
          </div>
          <p class="text-center text-xs tracking-[0.2em] uppercase opacity-80" data-ty-wave>
            {{ fill(m.waveN, { n: hud.wave }) }}
          </p>
          <div class="flex flex-col items-end gap-1.5">
            <p class="flex gap-1" :aria-label="m.shields">
              <span
                v-for="i in SHIELDS"
                :key="i"
                class="h-2.5 w-6 rounded-sm"
                :class="i <= hud.shields ? 'bg-[#8fd3ff]' : 'bg-white/15'"
              />
            </p>
            <p class="flex items-center gap-1 text-[10px] tracking-wider uppercase opacity-80">
              EMP
              <span
                v-for="i in MAX_EMP"
                :key="i"
                class="size-2 rounded-full"
                :class="i <= hud.emps ? 'bg-[#eab54d]' : 'bg-white/15'"
              />
            </p>
            <button
              v-if="phase === 'play'"
              type="button"
              class="pointer-events-auto rounded border border-white/25 px-2 py-0.5 text-xs hover:bg-white/10"
              data-ty-pause
              @mousedown.stop
              @click="pause"
            >
              {{ m.pause }} (Esc)
            </button>
          </div>
        </div>

        <!-- Spanduk gelombang -->
        <Transition name="ty-banner">
          <div
            v-if="banner && phase === 'play'"
            class="pointer-events-none absolute inset-x-0 top-1/3 text-center text-[#f3eee4]"
          >
            <p class="font-display text-4xl tracking-tight sm:text-6xl" data-ty-banner>
              {{ banner.title }}
            </p>
            <p class="mt-2 text-sm tracking-[0.25em] text-[#eab54d] uppercase">{{ banner.sub }}</p>
          </div>
        </Transition>

        <!-- Layar awal -->
        <div
          v-if="phase === 'menu'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#070a17]/55 p-5 text-center text-[#f3eee4]"
        >
          <div>
            <p class="text-xs tracking-[0.35em] text-[#eab54d] uppercase">{{ m.gameKicker }}</p>
            <h2 class="mt-2 font-display text-5xl tracking-tight sm:text-7xl">{{ m.gameTitle }}</h2>
            <p class="mx-auto mt-3 max-w-md text-sm opacity-85">{{ m.gameTagline }}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-2" @mousedown.stop>
            <button
              type="button"
              :class="[
                chips,
                lang === 'id'
                  ? 'border-[#eab54d] bg-[#eab54d] text-[#1b1814]'
                  : 'border-white/30 text-[#f3eee4] hover:border-white',
              ]"
              data-ty-lang="id"
              @click="setLang('id')"
            >
              {{ m.langId }}
            </button>
            <button
              type="button"
              :class="[
                chips,
                lang === 'en'
                  ? 'border-[#eab54d] bg-[#eab54d] text-[#1b1814]'
                  : 'border-white/30 text-[#f3eee4] hover:border-white',
              ]"
              data-ty-lang="en"
              @click="setLang('en')"
            >
              {{ m.langEn }}
            </button>
            <button
              type="button"
              :class="[chips, 'border-white/30 text-[#f3eee4] hover:border-white']"
              :aria-pressed="!muted"
              @click="toggleSound"
            >
              {{ muted ? '🔇' : '🔊' }} {{ m.sound }}
            </button>
          </div>
          <ul class="grid max-w-lg gap-1 text-left text-xs opacity-85 sm:grid-cols-2 sm:gap-x-6">
            <li>⌨ {{ m.howType }}</li>
            <li>⚡ {{ m.howEmp }}</li>
            <li>⌫ {{ m.howRelease }}</li>
            <li>⏸ {{ m.howPause }}</li>
          </ul>
          <button
            type="button"
            class="btn border-[#eab54d] bg-[#eab54d] px-6 py-2.5 text-base text-[#1b1814] hover:bg-[#f3c565]"
            data-ty-start
            @mousedown.stop
            @click="start"
          >
            {{ m.start }}
          </button>
          <p v-if="best" class="text-xs tabular-nums opacity-70">
            {{ fill(m.bestScore, { n: best.toLocaleString() }) }}
          </p>
        </div>

        <!-- Jeda -->
        <div
          v-if="phase === 'paused'"
          class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#070a17]/70 text-[#f3eee4]"
          data-ty-paused
        >
          <p class="font-display text-5xl">{{ m.paused }}</p>
          <div class="flex gap-2" @mousedown.stop>
            <button
              type="button"
              class="btn border-[#eab54d] bg-[#eab54d] text-[#1b1814]"
              @click="resume"
            >
              {{ m.resume }}
            </button>
            <button
              type="button"
              class="btn border-white/30 text-[#f3eee4] hover:border-white"
              data-ty-quit
              @click="quit"
            >
              {{ m.quit }}
            </button>
          </div>
        </div>

        <!-- Game selesai -->
        <div
          v-if="phase === 'over' && result"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070a17]/70 text-center text-[#f3eee4]"
        >
          <p class="text-xs tracking-[0.35em] text-[#eab54d] uppercase">{{ m.gameOver }}</p>
          <p class="font-display text-6xl tabular-nums sm:text-7xl">
            {{ result.score.toLocaleString() }}
          </p>
          <p
            v-if="newBest"
            class="rounded-full bg-[#eab54d] px-3 py-1 text-xs font-bold text-[#1b1814]"
            data-ty-highscore
          >
            🏆 {{ m.newHigh }}
          </p>
          <p v-else-if="best" class="text-xs tabular-nums opacity-75">
            {{ fill(m.bestScore, { n: best.toLocaleString() }) }}
          </p>
          <button
            type="button"
            class="btn mt-2 border-[#eab54d] bg-[#eab54d] text-[#1b1814]"
            data-ty-again
            @mousedown.stop
            @click="start"
          >
            {{ m.playAgain }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="!fullscreen" class="text-xs text-ink-3">{{ m.gameHint }}</p>

    <!-- Hasil rinci -->
    <section
      v-if="phase === 'over' && result && !fullscreen"
      class="space-y-4"
      data-ty-result
      :aria-label="m.resultTitle"
    >
      <div class="grid gap-4 sm:grid-cols-[auto_1fr]">
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
          <p class="text-sm text-ink-2 sm:max-w-40 sm:text-center">{{ gradeNote }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div class="card text-center">
            <p
              class="font-display text-4xl leading-none tabular-nums text-brand-700 dark:text-brand-300"
              data-ty-wpm
            >
              {{ result.wpm }}
            </p>
            <p class="mt-1 text-xs tracking-wider text-ink-3 uppercase">{{ m.wpm }}</p>
          </div>
          <div class="card text-center">
            <p class="font-display text-4xl leading-none tabular-nums" data-ty-acc>
              {{ result.accuracy }}%
            </p>
            <p class="mt-1 text-xs tracking-wider text-ink-3 uppercase">{{ m.accuracy }}</p>
          </div>
          <div class="card text-center">
            <p class="font-display text-4xl leading-none tabular-nums" data-ty-wavereached>
              {{ result.wave }}
            </p>
            <p class="mt-1 text-xs tracking-wider text-ink-3 uppercase">{{ m.waveReached }}</p>
          </div>
          <div class="card text-center">
            <p class="text-xl font-bold tabular-nums" data-ty-destroyed>{{ result.destroyed }}</p>
            <p class="text-xs text-ink-3">{{ m.destroyed }}</p>
          </div>
          <div class="card text-center">
            <p class="text-xl font-bold tabular-nums">⚡ {{ result.maxCombo }}</p>
            <p class="text-xs text-ink-3">{{ m.maxCombo }}</p>
          </div>
          <div class="card text-center">
            <p class="text-xl font-bold tabular-nums text-secang dark:text-[#e98a98]">
              {{ result.errors }}
            </p>
            <p class="text-xs text-ink-3">{{ m.errors }}</p>
          </div>
        </div>
      </div>
      <TypingChart :series="result.series" :raw="result.raw" :m="m" />
      <TypingExport :build="buildReport" :m="m" />
    </section>
  </div>
</template>

<style scoped>
.ty-banner-enter-active {
  animation: ty-banner-in 0.45s cubic-bezier(0.2, 1.2, 0.4, 1);
}
.ty-banner-leave-active {
  transition: opacity 0.3s;
}
.ty-banner-leave-to {
  opacity: 0;
}
@keyframes ty-banner-in {
  0% {
    transform: scale(1.25);
    opacity: 0;
    letter-spacing: 0.2em;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ty-banner-enter-active {
    animation: none;
  }
}
</style>
