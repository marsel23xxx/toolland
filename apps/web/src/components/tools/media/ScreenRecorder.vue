<script setup lang="ts">
/**
 * Rekam layar, jendela, atau tab langsung dari browser, dengan suara layar dan/atau mikrofon.
 * Semua di perangkat pengguna; hasil MP4 (Chrome/Edge/Safari) atau WebM (Firefox).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import IconCircle from '~icons/lucide/circle';
import IconPause from '~icons/lucide/pause';
import IconPlay from '~icons/lucide/play';
import IconSquare from '~icons/lucide/square';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import { formatTime } from '../../../lib/media/ffmpeg';
import {
  extForType,
  finalizeRecording,
  mixAudio,
  pickRecType,
  REC_BITRATE,
  recordingFileName,
  screenRecordSupported,
  type RecQuality,
} from '../../../lib/media/screen-record';
import { fileName } from '../../../lib/names';
import { useFileResults } from '../../../lib/results';
import FileResults from '../../ui/FileResults.vue';

const props = defineProps<{
  t: Messages<'recorder'>;
  files: Messages<'files'>;
  donate: Messages<'donate'>;
}>();

type State = 'idle' | 'starting' | 'countdown' | 'recording' | 'paused' | 'processing';

const supported = ref(true);
const state = ref<State>('idle');
const systemAudio = ref(true);
const mic = ref(false);
const countdownOn = ref(true);
const quality = ref<RecQuality>('high');
const countdown = ref(0);
const elapsed = ref(0);
const error = ref('');
const notice = ref('');
const results = useFileResults();
const preview = computed(() => results.items.value[0]);
const isWebm = computed(() => preview.value?.name.endsWith('.webm'));

let display: MediaStream | null = null;
let micStream: MediaStream | null = null;
let closeMix = () => {};
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
/** Waktu rekam terkumpul sebelum jeda terakhir, dan awal segmen yang sedang berjalan. */
let banked = 0;
let segStart = 0;
let aborted = false;

onMounted(() => (supported.value = screenRecordSupported()));

const busy = computed(() => state.value !== 'idle');

function tick() {
  elapsed.value =
    banked + (state.value === 'recording' ? (performance.now() - segStart) / 1000 : 0);
}

function stopTracks() {
  display?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  closeMix();
  closeMix = () => {};
  display = micStream = null;
}

async function start() {
  error.value = '';
  notice.value = '';
  aborted = false;
  state.value = 'starting';
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: systemAudio.value,
    });
  } catch (e) {
    state.value = 'idle';
    // Pengguna menekan Batal di dialog pilih layar: bukan kesalahan.
    if ((e as Error).name !== 'NotAllowedError' && (e as Error).name !== 'AbortError')
      error.value = props.t['error.start'];
    return;
  }
  if (mic.value) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      notice.value = props.t['error.mic'];
    }
  }
  const audio = [...display.getAudioTracks(), ...(micStream?.getAudioTracks() ?? [])];
  if (systemAudio.value && !display.getAudioTracks().length) notice.value ||= props.t.noSystemAudio;
  const mixed = mixAudio(audio);
  closeMix = mixed.close;
  const stream = new MediaStream([
    ...display.getVideoTracks(),
    ...(mixed.track ? [mixed.track] : []),
  ]);
  // Tombol "Berhenti berbagi" milik browser juga menghentikan rekaman.
  display.getVideoTracks()[0]?.addEventListener('ended', stop);

  const type = pickRecType((x) => MediaRecorder.isTypeSupported(x), !!mixed.track);
  recorder = new MediaRecorder(stream, {
    ...(type ? { mimeType: type } : {}),
    videoBitsPerSecond: REC_BITRATE[quality.value],
    audioBitsPerSecond: 128_000,
  });
  chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => void finish();
  // Rekaman gagal di tengah jalan (encoder browser error): simpan yang sudah terekam.
  recorder.onerror = () => void finish();

  if (countdownOn.value) {
    state.value = 'countdown';
    for (countdown.value = 3; countdown.value > 0; countdown.value--) {
      await new Promise((r) => setTimeout(r, 1000));
      if (aborted) return;
    }
  }
  if (aborted || !recorder) return;
  // Potongan per detik: data tidak hilang semua bila tab ditutup paksa, dan memori lebih rata.
  recorder.start(1000);
  banked = 0;
  segStart = performance.now();
  elapsed.value = 0;
  state.value = 'recording';
  timer = setInterval(tick, 250);
}

function togglePause() {
  if (!recorder) return;
  try {
    if (state.value === 'recording') {
      recorder.pause();
      banked += (performance.now() - segStart) / 1000;
      state.value = 'paused';
    } else if (state.value === 'paused') {
      recorder.resume();
      segStart = performance.now();
      state.value = 'recording';
    }
  } catch {
    // Perekam browser sudah berhenti sendiri: selesaikan dengan data yang ada.
    void finish();
    return;
  }
  tick();
}

function stop() {
  if (state.value === 'countdown' || state.value === 'starting') {
    // Dihentikan sebelum mulai merekam: buang semuanya.
    aborted = true;
    recorder = null;
    stopTracks();
    state.value = 'idle';
    return;
  }
  if (!recorder) return;
  tick();
  if (recorder.state !== 'inactive') recorder.stop();
  // Pengaman: bila browser tidak pernah mengirim event stop, selesaikan sendiri.
  const r = recorder;
  setTimeout(() => {
    if (recorder === r) void finish();
  }, 4000);
}

async function finish() {
  // Bisa dipanggil dari onstop, onerror, atau pengaman; cukup sekali per rekaman.
  if (!recorder) return;
  clearInterval(timer);
  const type = recorder?.mimeType || 'video/webm';
  recorder = null;
  stopTracks();
  const raw = new Blob(chunks, { type });
  chunks = [];
  if (!raw.size) {
    state.value = 'idle';
    error.value = props.t['error.empty'];
    return;
  }
  state.value = 'processing';
  const blob = await finalizeRecording(raw);
  const ext = extForType(type);
  results.clear();
  results.add(
    recordingFileName(fileName('screenRecording'), new Date(), ext),
    blob,
    `${formatTime(elapsed.value)} · ${formatBytes(blob.size)}`,
  );
  state.value = 'idle';
}

/** Jangan sampai rekaman hilang karena tab tertutup tanpa sengaja. */
function beforeUnload(e: BeforeUnloadEvent) {
  if (state.value === 'recording' || state.value === 'paused') e.preventDefault();
}
onMounted(() => addEventListener('beforeunload', beforeUnload));
onBeforeUnmount(() => {
  removeEventListener('beforeunload', beforeUnload);
  clearInterval(timer);
  aborted = true;
  if (recorder && recorder.state !== 'inactive') {
    recorder.onstop = null;
    recorder.onerror = null;
    recorder.stop();
  }
  stopTracks();
});
</script>

<template>
  <div class="space-y-4">
    <p v-if="!supported" class="card text-sm" data-rec-unsupported>{{ t.unsupported }}</p>

    <template v-else>
      <div v-if="!busy" class="card space-y-4" data-rec-setup>
        <div class="flex flex-wrap gap-x-6 gap-y-2">
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="systemAudio"
              type="checkbox"
              class="size-4 accent-brand-600"
              data-rec-system
            />
            {{ t.systemAudio }}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="mic" type="checkbox" class="size-4 accent-brand-600" data-rec-mic />
            {{ t.mic }}
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="countdownOn"
              type="checkbox"
              class="size-4 accent-brand-600"
              data-rec-countdown
            />
            {{ t.countdown }}
          </label>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label for="rec-q" class="label">{{ t.quality }}</label>
            <select id="rec-q" v-model="quality" class="field w-auto">
              <option value="standard">{{ t['q.standard'] }}</option>
              <option value="high">{{ t['q.high'] }}</option>
              <option value="max">{{ t['q.max'] }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-primary" data-rec-start @click="start">
            <IconCircle class="size-4 fill-current" aria-hidden="true" />
            {{ preview ? t.again : t.start }}
          </button>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ t.hint }}</p>
      </div>

      <div
        v-else
        class="card flex flex-wrap items-center gap-4"
        data-rec-live
        :data-rec-state="state"
      >
        <template v-if="state === 'starting'">
          <p class="text-sm">{{ t.choose }}</p>
        </template>
        <template v-else-if="state === 'countdown'">
          <p class="font-display text-5xl leading-none tabular-nums" aria-live="assertive">
            {{ countdown }}
          </p>
          <p class="text-sm">{{ t.getReady }}</p>
        </template>
        <template v-else-if="state === 'processing'">
          <p class="text-sm" aria-live="polite">{{ t.processing }}</p>
        </template>
        <template v-else>
          <span
            class="size-3 rounded-full"
            :class="state === 'recording' ? 'animate-pulse bg-red-600' : 'bg-slate-400'"
            aria-hidden="true"
          />
          <p class="font-display text-3xl leading-none tabular-nums" data-rec-time>
            {{ formatTime(elapsed) }}
          </p>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ state === 'paused' ? t.paused : t.recording }}
          </p>
        </template>
        <div v-if="state !== 'processing'" class="ml-auto flex gap-2">
          <button
            v-if="state === 'recording' || state === 'paused'"
            type="button"
            class="btn btn-secondary"
            data-rec-pause
            @click="togglePause"
          >
            <component
              :is="state === 'paused' ? IconPlay : IconPause"
              class="size-4"
              aria-hidden="true"
            />
            {{ state === 'paused' ? t.resume : t.pause }}
          </button>
          <button type="button" class="btn btn-primary" data-rec-stop @click="stop">
            <IconSquare class="size-4 fill-current" aria-hidden="true" />
            {{ state === 'recording' || state === 'paused' ? t.stop : t.cancel }}
          </button>
        </div>
      </div>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <p v-if="notice" class="text-sm text-amber-700 dark:text-amber-400" aria-live="polite">
      {{ notice }}
    </p>

    <template v-if="preview && !busy">
      <video
        :src="preview.url"
        controls
        preload="metadata"
        class="max-h-[28rem] w-full rounded-lg bg-black"
        data-rec-preview
      />
      <p v-if="isWebm" class="text-sm text-slate-600 dark:text-slate-400">
        {{ t.webmHint }}
        <a :href="t.convertHref" class="underline">{{ t.convertLink }}</a>
      </p>
    </template>
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
    <p v-if="preview && !busy" class="text-xs text-slate-600 dark:text-slate-400">
      {{ t.privacy }}
    </p>
  </div>
</template>
