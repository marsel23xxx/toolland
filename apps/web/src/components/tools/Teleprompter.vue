<script setup lang="ts">
/**
 * Teleprompter: naskah bergulir otomatis untuk rekam video, live, atau presentasi.
 * Kecepatan, ukuran huruf, lebar, perataan, cermin (untuk kaca teleprompter), garis baca, dan
 * hitung mundur bisa diatur. Kontrol keyboard: Spasi main/jeda, ↑/↓ kecepatan, ←/→ mundur/maju,
 * R ulang dari awal, F layar penuh. Gaya dinamis diset lewat CSSOM agar lolos CSP.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Messages } from '../../i18n';
import { fill } from '../../lib/format';
import { downloadBlob } from '../../lib/download';
import { formatTime } from '../../lib/media/ffmpeg';
import type { PrompterVideoOptions } from '../../lib/prompter-video';
import { TEXT_ACCEPT } from '../../lib/text-extract';
import ProgressBar from '../ui/ProgressBar.vue';

const props = defineProps<{ m: Messages<'prompter'> & Messages<'common'> }>();
const m = props.m;

// --- Pengaturan (tersimpan) --------------------------------------------------------------------
const STORE = 'toolland-teleprompter';
const settings = reactive({
  speed: 5,
  size: 56,
  width: 80,
  align: 'center' as 'left' | 'center',
  mirror: false,
  flip: false,
  guide: true,
  countdown: true,
  theme: 'dark' as 'dark' | 'light',
});
const script = ref('');
const loaded = ref(false);

onMounted(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '{}') as {
      settings?: Partial<typeof settings>;
      script?: string;
    };
    Object.assign(settings, raw.settings ?? {});
    script.value = raw.script ?? '';
  } catch {
    // Penyimpanan tidak tersedia.
  }
  if (!script.value) script.value = m.sample;
  loaded.value = true;
});
let saveTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [settings, script],
  () => {
    if (!loaded.value) return;
    clearTimeout(saveTimer);
    clearTimeout(estimateTimer);
    abort?.abort();
    if (video.value) URL.revokeObjectURL(video.value.url);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({ settings, script: script.value }));
      } catch {
        // Abaikan.
      }
    }, 400);
  },
  { deep: true },
);

// --- Unggah naskah -----------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement>();
const fileErr = ref('');
async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  fileErr.value = '';
  try {
    const { extractText } = await import('../../lib/text-extract');
    script.value = await extractText(file);
    reset();
  } catch {
    fileErr.value = m.fileErr;
  }
}

const words = computed(() => (script.value.match(/[\p{L}\p{N}]+/gu) ?? []).length);
/** Perkiraan durasi bicara dengan tempo santai 130 kata per menit. */
const speakMin = computed(() => Math.max(1, Math.round(words.value / 130)));

// --- Panggung ----------------------------------------------------------------------------------
const stageWrap = ref<HTMLDivElement>();
const stage = ref<HTMLDivElement>();
const content = ref<HTMLDivElement>();
const guideBand = ref<HTMLDivElement>();
const playing = ref(false);
const counting = ref(0);
const fullscreen = ref(false);
const y = ref(0);
const maxY = ref(1);
let raf = 0;
let last = 0;
let countTimer: ReturnType<typeof setInterval> | undefined;

/** Piksel per detik: sebanding dengan ukuran huruf agar tempo baris tetap terasa sama. */
const pxPerSec = computed(() => settings.speed * settings.size * 0.11);

function measure() {
  const st = stage.value;
  const ct = content.value;
  if (!st || !ct) return;
  // Konten diberi ruang setengah tinggi panggung di atas dan bawah, jadi baris pertama mulai
  // di garis baca dan baris terakhir bisa naik sampai garis baca.
  // Dikurangi setengah tinggi baris agar baris pertama tepat di tengah garis baca.
  ct.style.paddingTop = `${Math.max(0, st.clientHeight * 0.4 - settings.size * 0.75)}px`;
  ct.style.paddingBottom = `${st.clientHeight * 0.6}px`;
  maxY.value = Math.max(1, ct.scrollHeight - st.clientHeight);
  if (y.value > maxY.value) y.value = maxY.value;
  apply();
}

function apply() {
  const ct = content.value;
  if (!ct) return;
  ct.style.transform = `translate3d(0, ${-y.value}px, 0)`;
}

function styleContent() {
  const ct = content.value;
  if (!ct) return;
  ct.style.fontSize = `${settings.size}px`;
  ct.style.maxWidth = `${settings.width}%`;
  if (guideBand.value) guideBand.value.style.height = `${settings.size * 1.6}px`;
}

function frame(t: number) {
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
  last = t;
  if (playing.value) {
    y.value = Math.min(maxY.value, y.value + pxPerSec.value * dt);
    apply();
    if (y.value >= maxY.value) playing.value = false;
  }
  raf = requestAnimationFrame(frame);
}

function play() {
  if (playing.value || counting.value) return;
  if (y.value >= maxY.value - 1) y.value = 0;
  if (!settings.countdown) {
    playing.value = true;
    return;
  }
  counting.value = 3;
  countTimer = setInterval(() => {
    counting.value--;
    if (counting.value <= 0) {
      clearInterval(countTimer);
      counting.value = 0;
      playing.value = true;
    }
  }, 800);
}
function pause() {
  playing.value = false;
  clearInterval(countTimer);
  counting.value = 0;
}
function toggle() {
  if (playing.value || counting.value) pause();
  else play();
}
function reset() {
  pause();
  y.value = 0;
  apply();
}
function jump(lines: number) {
  y.value = Math.min(maxY.value, Math.max(0, y.value + lines * settings.size * 1.5));
  apply();
}
function speed(d: number) {
  settings.speed = Math.min(20, Math.max(1, settings.speed + d));
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
    return;
  }
  await stageWrap.value?.requestFullscreen?.().catch(() => undefined);
}
function onFsChange() {
  fullscreen.value = document.fullscreenElement === stageWrap.value && !!stageWrap.value;
  void nextTick(measure);
}

/** Gulir manual dengan roda mouse atau geser jari saat dijeda. */
function onWheel(e: WheelEvent) {
  e.preventDefault();
  y.value = Math.min(maxY.value, Math.max(0, y.value + e.deltaY));
  apply();
}
let touchY: number | null = null;
function onTouchStart(e: TouchEvent) {
  touchY = e.touches[0]?.clientY ?? null;
}
function onTouchMove(e: TouchEvent) {
  const cy = e.touches[0]?.clientY;
  if (touchY === null || cy === undefined) return;
  e.preventDefault();
  y.value = Math.min(maxY.value, Math.max(0, y.value + (touchY - cy)));
  touchY = cy;
  apply();
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !fullscreen.value) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key) {
    case ' ':
      toggle();
      break;
    case 'ArrowUp':
      speed(1);
      break;
    case 'ArrowDown':
      speed(-1);
      break;
    case 'ArrowLeft':
      jump(-2);
      break;
    case 'ArrowRight':
      jump(2);
      break;
    case 'r':
    case 'R':
      reset();
      break;
    case 'f':
    case 'F':
      void toggleFullscreen();
      break;
    default:
      return;
  }
  e.preventDefault();
}

const progress = computed(() => Math.round((y.value / maxY.value) * 100));
const remaining = computed(() => {
  const s = Math.max(0, Math.round((maxY.value - y.value) / pxPerSec.value));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

// --- Unduh sebagai video ----------------------------------------------------------------------
type Shape = 'landscape' | 'portrait' | 'square';
const SHAPES: Record<Shape, [number, number]> = {
  landscape: [1920, 1080],
  portrait: [1080, 1920],
  square: [1080, 1080],
};
const shape = ref<Shape>('landscape');
const exporting = ref(false);
const exportProgress = ref(0);
const exportErr = ref('');
const video = ref<{ url: string; blob: Blob; name: string } | null>(null);
let abort: AbortController | undefined;

function videoOptions(): PrompterVideoOptions {
  const [width, height] = SHAPES[shape.value];
  // Huruf diskalakan dari tampilan 720p ke ukuran video; tempo gulir per baris tetap sama.
  const fontPx = Math.round((settings.size * Math.min(width, height)) / 720);
  return {
    text: script.value,
    width,
    height,
    fps: 30,
    fontPx,
    textWidthPct: settings.width,
    align: settings.align,
    theme: settings.theme,
    mirror: settings.mirror,
    flip: settings.flip,
    guide: settings.guide,
    pxPerSec: settings.speed * fontPx * 0.11,
    holdStart: 1.5,
    holdEnd: 1.5,
  };
}

const estimate = ref(0);
let estimateTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [settings, script, shape],
  () => {
    clearTimeout(estimateTimer);
    estimateTimer = setTimeout(async () => {
      const { estimateDuration } = await import('../../lib/prompter-video');
      estimate.value = estimateDuration(videoOptions());
    }, 300);
  },
  // Tidak immediate: hanya di browser (saat naskah/pengaturan dimuat di onMounted), bukan saat SSR.
  { deep: true },
);
/** Batas durasi agar proses dan file tetap wajar. */
const MAX_VIDEO_SEC = 20 * 60;

async function exportVideo() {
  if (exporting.value || !script.value.trim()) return;
  exportErr.value = '';
  if (estimate.value > MAX_VIDEO_SEC) {
    exportErr.value = m.videoTooLong;
    return;
  }
  pause();
  exporting.value = true;
  exportProgress.value = 0;
  abort = new AbortController();
  try {
    const { renderPrompterVideo } = await import('../../lib/prompter-video');
    const blob = await renderPrompterVideo(
      videoOptions(),
      (p) => (exportProgress.value = p),
      abort.signal,
    );
    if (video.value) URL.revokeObjectURL(video.value.url);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `teleprompter-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.mp4`;
    video.value = { url: URL.createObjectURL(blob), blob, name };
  } catch (e) {
    const err = e as Error;
    if (err.name !== 'AbortError')
      exportErr.value = err.message === 'unsupported' ? m.videoUnsupported : m.videoFailed;
  } finally {
    exporting.value = false;
  }
}
function cancelExport() {
  abort?.abort();
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  styleContent();
  void nextTick(measure);
  raf = requestAnimationFrame(frame);
  window.addEventListener('keydown', onKey);
  document.addEventListener('fullscreenchange', onFsChange);
  if ('ResizeObserver' in window && stage.value) {
    ro = new ResizeObserver(measure);
    ro.observe(stage.value);
  }
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearInterval(countTimer);
  clearTimeout(saveTimer);
  ro?.disconnect();
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('fullscreenchange', onFsChange);
});
watch(
  () => [settings.size, settings.width, settings.align, settings.guide, script.value],
  () =>
    void nextTick(() => {
      styleContent();
      measure();
    }),
);
</script>

<template>
  <div class="space-y-4">
    <!-- Naskah -->
    <div>
      <div class="mb-1 flex flex-wrap items-end justify-between gap-2">
        <label for="tp-script" class="label mb-0">{{ m.script }}</label>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-ink-3 tabular-nums">{{
            fill(m.stats, { n: words, min: speakMin })
          }}</span>
          <button
            type="button"
            class="btn btn-secondary px-2.5 py-1 text-xs"
            @click="fileInput?.click()"
          >
            📄 {{ m.upload }}
          </button>
          <input
            ref="fileInput"
            type="file"
            class="sr-only"
            tabindex="-1"
            :accept="TEXT_ACCEPT"
            data-tp-file
            @change="onPick"
          />
        </div>
      </div>
      <textarea
        id="tp-script"
        v-model="script"
        class="field h-36 text-sm"
        :placeholder="m.placeholder"
        data-tp-script
      />
      <p v-if="fileErr" class="error-text mt-1">{{ fileErr }}</p>
    </div>

    <!-- Pengaturan -->
    <div class="grid gap-x-6 gap-y-3 rounded-md border border-rule bg-paper-2 p-4 sm:grid-cols-3">
      <label class="block text-sm">
        <span class="flex justify-between"
          ><span>{{ m.speed }}</span
          ><b class="tabular-nums" data-tp-speed>{{ settings.speed }}</b></span
        >
        <input v-model.number="settings.speed" type="range" min="1" max="20" class="w-full" />
      </label>
      <label class="block text-sm">
        <span class="flex justify-between"
          ><span>{{ m.size }}</span
          ><b class="tabular-nums">{{ settings.size }}px</b></span
        >
        <input
          v-model.number="settings.size"
          type="range"
          min="24"
          max="140"
          step="2"
          class="w-full"
        />
      </label>
      <label class="block text-sm">
        <span class="flex justify-between"
          ><span>{{ m.width }}</span
          ><b class="tabular-nums">{{ settings.width }}%</b></span
        >
        <input
          v-model.number="settings.width"
          type="range"
          min="40"
          max="100"
          step="5"
          class="w-full"
        />
      </label>
      <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm sm:col-span-3">
        <label class="flex items-center gap-1.5"
          ><input v-model="settings.mirror" type="checkbox" class="size-4" data-tp-mirror />{{
            m.mirror
          }}</label
        >
        <label class="flex items-center gap-1.5"
          ><input v-model="settings.flip" type="checkbox" class="size-4" />{{ m.flip }}</label
        >
        <label class="flex items-center gap-1.5"
          ><input v-model="settings.guide" type="checkbox" class="size-4" />{{ m.guide }}</label
        >
        <label class="flex items-center gap-1.5"
          ><input v-model="settings.countdown" type="checkbox" class="size-4" />{{
            m.countdown
          }}</label
        >
        <span class="flex items-center gap-1.5">
          <span>{{ m.align }}</span>
          <button
            v-for="a in ['left', 'center'] as const"
            :key="a"
            type="button"
            class="btn btn-secondary px-2 py-0.5 text-xs"
            :class="{ 'btn-active': settings.align === a }"
            :aria-pressed="settings.align === a"
            @click="settings.align = a"
          >
            {{ a === 'left' ? m.alignLeft : m.alignCenter }}
          </button>
        </span>
        <span class="flex items-center gap-1.5">
          <span>{{ m.theme }}</span>
          <button
            v-for="th in ['dark', 'light'] as const"
            :key="th"
            type="button"
            class="btn btn-secondary px-2 py-0.5 text-xs"
            :class="{ 'btn-active': settings.theme === th }"
            :aria-pressed="settings.theme === th"
            @click="settings.theme = th"
          >
            {{ th === 'dark' ? m.themeDark : m.themeLight }}
          </button>
        </span>
      </div>
    </div>

    <!-- Panggung -->
    <div
      ref="stageWrap"
      class="relative overflow-hidden rounded-md border border-ink select-none"
      :class="[
        settings.theme === 'dark' ? 'bg-[#0b0b0d] text-[#f5f1e8]' : 'bg-white text-[#111]',
        fullscreen ? 'rounded-none border-0' : '',
      ]"
      data-tp-stage
    >
      <div
        ref="stage"
        class="relative cursor-pointer overflow-hidden"
        :class="fullscreen ? 'h-screen' : 'h-[60vh] min-h-80'"
        role="region"
        :aria-label="m.stage"
        @click="toggle"
        @wheel="onWheel"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
      >
        <div
          :class="[settings.mirror ? '-scale-x-100' : '', settings.flip ? '-scale-y-100' : '']"
          class="h-full"
        >
          <div
            ref="content"
            class="mx-auto px-6 leading-[1.5] font-semibold break-words whitespace-pre-wrap will-change-transform"
            :class="settings.align === 'center' ? 'text-center' : 'text-left'"
            data-tp-content
          >
            {{ script }}
          </div>
        </div>
        <!-- Garis baca -->
        <div
          v-if="settings.guide"
          class="pointer-events-none absolute inset-x-0 -translate-y-1/2"
          :class="settings.flip ? 'top-[60%]' : 'top-[40%]'"
          aria-hidden="true"
        >
          <div ref="guideBand" class="border-y-2 border-[#eab54d]/70 bg-[#eab54d]/10" />
          <span class="absolute top-1/2 left-1 -translate-y-1/2 text-2xl text-[#eab54d]">▶</span>
        </div>
        <!-- Pudar atas & bawah -->
        <div
          class="pointer-events-none absolute inset-x-0 top-0 h-16"
          :class="
            settings.theme === 'dark'
              ? 'bg-linear-to-b from-[#0b0b0d]'
              : 'bg-linear-to-b from-white'
          "
        />
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          :class="
            settings.theme === 'dark'
              ? 'bg-linear-to-t from-[#0b0b0d]'
              : 'bg-linear-to-t from-white'
          "
        />
        <div
          v-if="counting"
          class="absolute inset-0 grid place-items-center bg-black/40 font-display text-[9rem] leading-none text-white"
          data-tp-countdown
        >
          {{ counting }}
        </div>
      </div>

      <!-- Kontrol -->
      <div
        class="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-sm"
        :class="[
          settings.theme === 'dark'
            ? 'border-white/15 bg-[#151518]'
            : 'border-black/10 bg-[#f4f4f4]',
          fullscreen
            ? 'absolute inset-x-0 bottom-0 opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100'
            : '',
        ]"
      >
        <button
          type="button"
          class="rounded bg-[#eab54d] px-3 py-1.5 font-bold text-[#1b1814]"
          data-tp-play
          @click="toggle"
        >
          {{ playing || counting ? `❚❚ ${m.pause}` : `▶ ${m.play}` }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1.5 hover:bg-white/10"
          :title="m.restart"
          @click="reset"
        >
          ⟲ {{ m.restart }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1.5 hover:bg-white/10"
          :aria-label="m.slower"
          @click="speed(-1)"
        >
          −
        </button>
        <span class="tabular-nums">{{ fill(m.speedN, { n: settings.speed }) }}</span>
        <button
          type="button"
          class="rounded px-2 py-1.5 hover:bg-white/10"
          :aria-label="m.faster"
          @click="speed(1)"
        >
          +
        </button>
        <span class="ml-auto tabular-nums opacity-75" data-tp-progress>
          {{ progress }}% · {{ fill(m.left, { t: remaining }) }}
        </span>
        <button
          type="button"
          class="rounded px-2 py-1.5 hover:bg-white/10"
          data-tp-fullscreen
          @click="toggleFullscreen"
        >
          {{ fullscreen ? `🗗 ${m.exitFullscreen}` : `⛶ ${m.fullscreen}` }}
        </button>
      </div>
    </div>
    <p class="text-xs text-ink-3">{{ m.keys }}</p>

    <!-- Unduh sebagai video -->
    <section class="space-y-3 rounded-md border border-rule bg-paper-2 p-4" data-tp-video>
      <div>
        <h2 class="font-display text-lg">🎬 {{ m.videoTitle }}</h2>
        <p class="text-sm text-ink-2">{{ m.videoDesc }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">{{ m.videoShape }}</span>
        <button
          v-for="sh in ['landscape', 'portrait', 'square'] as const"
          :key="sh"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': shape === sh }"
          :aria-pressed="shape === sh"
          :disabled="exporting"
          :data-tp-shape="sh"
          @click="shape = sh"
        >
          {{ m[`shape_${sh}`] }}
        </button>
      </div>
      <p class="text-xs text-ink-3 tabular-nums" data-tp-estimate>
        {{
          fill(m.videoInfo, { w: SHAPES[shape][0], h: SHAPES[shape][1], t: formatTime(estimate) })
        }}
      </p>
      <div v-if="exporting" class="space-y-2">
        <ProgressBar :label="m.videoBusy" :value="exportProgress * 100" />
        <button type="button" class="btn btn-secondary" @click="cancelExport">
          {{ m.cancel }}
        </button>
      </div>
      <button
        v-else
        type="button"
        class="btn btn-primary"
        :disabled="!script.trim()"
        data-tp-export
        @click="exportVideo"
      >
        {{ m.videoMake }}
      </button>
      <p v-if="exportErr" class="error-text" role="alert">{{ exportErr }}</p>
      <div v-if="video && !exporting" class="space-y-2" data-tp-result>
        <video
          :src="video.url"
          controls
          playsinline
          class="max-h-96 w-auto max-w-full rounded border border-rule bg-black"
        />
        <button
          type="button"
          class="btn btn-primary"
          data-tp-download
          @click="downloadBlob(video.blob, video.name)"
        >
          ⬇ {{ fill(m.videoDownload, { size: (video.blob.size / 1048576).toFixed(1) }) }}
        </button>
      </div>
    </section>
  </div>
</template>
