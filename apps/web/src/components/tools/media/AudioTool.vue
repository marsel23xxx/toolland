<script setup lang="ts">
/** Potong audio (stream copy, cepat) atau ekstrak audio dari video (MP3, M4A, WAV). */
import { fileName } from '../../../lib/names';
import { ref, watch } from 'vue';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import { extOf, useFfmpeg } from '../../../lib/media/ffmpeg';
import { useFileResults, withSuffix } from '../../../lib/results';
import type { DropzoneMessages } from '../../ui/Dropzone.vue';
import MediaShell from '../../ui/MediaShell.vue';

const props = defineProps<{
  m: Messages<'media'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'audio'>;
  mode: 'cut' | 'extract';
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const start = ref(0);
const end = ref(0);
const format = ref<'mp3' | 'm4a' | 'wav'>('mp3');
const error = ref('');

// Saat durasi diketahui, rentang awal = seluruh file.
watch(
  () => shell.value?.duration,
  (d) => {
    if (d) end.value = Math.round(d * 10) / 10;
  },
);

const CODEC = {
  mp3: { args: ['-c:a', 'libmp3lame', '-b:a', '192k'], mime: 'audio/mpeg' },
  m4a: { args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
  wav: { args: ['-c:a', 'pcm_s16le'], mime: 'audio/wav' },
} as const;

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
};

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  try {
    let blob: Blob;
    let name: string;
    if (props.mode === 'cut') {
      if (end.value <= start.value) {
        error.value = props.m['error.range'];
        return;
      }
      // Wadah sama dengan aslinya; video (mis. mp4) diambil audionya saja ke m4a.
      const inExt = extOf(file.name);
      const ext = AUDIO_MIME[inExt] ? inExt : 'm4a';
      const out = `potongan.${ext}`;
      blob = await ff.run(
        file,
        (input) => [
          '-ss',
          String(start.value),
          '-i',
          input,
          '-t',
          String(end.value - start.value),
          '-map',
          '0:a:0',
          '-c',
          'copy',
          `/out/${out}`,
        ],
        out,
        AUDIO_MIME[ext] ?? 'audio/mp4',
      );
      name = withSuffix(file.name, fileName('clip'), `.${ext}`);
    } else {
      const c = CODEC[format.value];
      const out = `audio.${format.value}`;
      blob = await ff.run(
        file,
        (input) => ['-i', input, '-vn', '-map', '0:a:0', ...c.args, `/out/${out}`],
        out,
        c.mime,
      );
      name = withSuffix(file.name, '', `.${format.value}`);
    }
    results.clear();
    results.add(name, blob, formatBytes(blob.size));
  } catch (e) {
    error.value =
      props.m[`error.${(e as Error).message}` as keyof Messages<'media'>] ??
      props.m['error.failed'];
  }
}
</script>

<template>
  <MediaShell
    ref="shell"
    v-bind="{ m, files, dropzone, donate }"
    :ff="ff"
    :results="results.items.value"
    :accept="mode === 'cut' ? 'audio/*,video/*,.m4a,.flac,.opus' : 'video/*,.mkv,.mov'"
    :error="error"
    @remove-result="results.remove"
    @change="results.clear()"
  >
    <template #default="{ currentTime }">
      <div v-if="mode === 'cut'" class="flex flex-wrap items-end gap-3">
        <div>
          <label for="au-start" class="label">{{ m.start }}</label>
          <input
            id="au-start"
            v-model.number="start"
            type="number"
            min="0"
            step="0.1"
            class="field w-28"
          />
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          @click="start = Math.round(currentTime * 10) / 10"
        >
          {{ m.useCurrent }}
        </button>
        <div>
          <label for="au-end" class="label">{{ m.end }}</label>
          <input
            id="au-end"
            v-model.number="end"
            type="number"
            min="0"
            step="0.1"
            class="field w-28"
          />
        </div>
        <button
          type="button"
          class="btn btn-secondary"
          @click="end = Math.round(currentTime * 10) / 10"
        >
          {{ m.useCurrent }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="ff.running.value || ff.loading.value"
          @click="run"
        >
          {{ t.cutRun }}
        </button>
      </div>
      <div v-else class="flex flex-wrap items-end gap-3">
        <div>
          <label for="au-fmt" class="label">{{ t.format }}</label>
          <select id="au-fmt" v-model="format" class="field w-auto">
            <option value="mp3">{{ t.mp3 }}</option>
            <option value="m4a">{{ t.m4a }}</option>
            <option value="wav">{{ t.wav }}</option>
          </select>
        </div>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="ff.running.value || ff.loading.value"
          @click="run"
        >
          {{ t.extractRun }}
        </button>
      </div>
      <p v-if="mode === 'cut'" class="text-sm text-slate-600 dark:text-slate-400">
        {{ t.cutHint }}
      </p>
    </template>
  </MediaShell>
</template>
