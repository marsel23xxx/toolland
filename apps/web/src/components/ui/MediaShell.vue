<script setup lang="ts">
/** Kerangka tools media: pilih file (maks 1 GB), pratinjau, status ffmpeg, progres, batal, dan hasil. */
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { Messages } from '../../i18n';
import { fill, formatBytes } from '../../lib/format';
import {
  formatTime,
  lowMemoryWarning,
  MAX_MEDIA_BYTES,
  type useFfmpeg,
} from '../../lib/media/ffmpeg';
import type { FileResult } from '../../lib/results';
import Dropzone, { type DropzoneMessages } from './Dropzone.vue';
import FileResults from './FileResults.vue';
import ProgressBar from './ProgressBar.vue';

const props = withDefaults(
  defineProps<{
    m: Messages<'media'>;
    files: Messages<'files'>;
    dropzone: DropzoneMessages;
    donate: Messages<'donate'>;
    ff: ReturnType<typeof useFfmpeg>;
    results: FileResult[];
    accept: string;
    error?: string;
    thumbnails?: boolean;
  }>(),
  { error: '', thumbnails: false },
);
const emit = defineEmits<{ removeResult: [id: number]; change: [file: File | null] }>();

const file = shallowRef<File | null>(null);
const url = ref('');
const duration = ref(0);
const currentTime = ref(0);
const isVideo = computed(
  () =>
    !!file.value &&
    (file.value.type.startsWith('video/') ||
      /\.(mp4|mov|mkv|webm|avi|m4v|3gp)$/i.test(file.value.name)),
);

function pick(list: File[]) {
  release();
  file.value = list[0] ?? null;
  if (file.value) url.value = URL.createObjectURL(file.value);
  emit('change', file.value);
}

function release() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = '';
  duration.value = 0;
  currentTime.value = 0;
}

function onMeta(e: Event) {
  const d = (e.target as HTMLMediaElement).duration;
  duration.value = Number.isFinite(d) ? d : 0;
}

const percent = computed(() => Math.round(props.ff.progress.value ?? 0));
onBeforeUnmount(release);
defineExpose({ file, duration, currentTime });
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      v-if="!file"
      :messages="dropzone"
      :accept="accept"
      :multiple="false"
      :max-size="MAX_MEDIA_BYTES"
      @files="pick"
      @prefetch="ff.load().catch(() => {})"
    />

    <template v-else>
      <div class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 truncate text-sm">
            <span class="font-semibold">{{ file.name }}</span>
            <span class="text-slate-600 dark:text-slate-400">
              · {{ formatBytes(file.size)
              }}<template v-if="duration">
                · {{ fill(m.duration, { time: formatTime(duration) }) }}</template
              >
            </span>
          </p>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="ff.running.value"
            @click="pick([])"
          >
            {{ m.change }}
          </button>
        </div>
        <video
          v-if="isVideo"
          :src="url"
          controls
          preload="metadata"
          class="max-h-80 w-full rounded-lg bg-black"
          @loadedmetadata="onMeta"
          @timeupdate="currentTime = ($event.target as HTMLMediaElement).currentTime"
        />
        <audio
          v-else
          :src="url"
          controls
          preload="metadata"
          class="w-full"
          @loadedmetadata="onMeta"
          @timeupdate="currentTime = ($event.target as HTMLMediaElement).currentTime"
        />
        <p v-if="lowMemoryWarning(file.size)" class="text-sm text-amber-700 dark:text-amber-400">
          {{ m.lowMemory }}
        </p>
      </div>

      <slot :duration="duration" :current-time="currentTime" />

      <ProgressBar v-if="ff.loading.value" :label="m.loadingEngine" />
      <div v-else-if="ff.running.value" class="flex items-center gap-3">
        <ProgressBar
          class="flex-1"
          :label="fill(m.processing, { percent })"
          :value="ff.progress.value ?? undefined"
        />
        <button type="button" class="btn btn-secondary" @click="ff.cancel()">{{ m.cancel }}</button>
      </div>
      <p
        v-if="ff.multiThread.value && !ff.running.value"
        class="text-xs text-slate-600 dark:text-slate-400"
      >
        {{ m.mt }}
      </p>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <FileResults
      :items="results"
      :m="files"
      :donate="donate"
      :thumbnails="thumbnails"
      @remove="(id) => emit('removeResult', id)"
    />
  </div>
</template>
