<script setup lang="ts">
/** Konversi audio (OPUS voice note WhatsApp, M4A, WAV, dll.) ke MP3/M4A/WAV/FLAC/OPUS di browser. */
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import {
  AUDIO_FORMATS,
  AUDIO_MIME,
  audioArgs,
  bitrateOf,
  hasQuality,
  type AudioFormat,
  type AudioQuality,
} from '../../../lib/media/convert';
import { extOf, useFfmpeg } from '../../../lib/media/ffmpeg';
import { fileName } from '../../../lib/names';
import { useFileResults, withSuffix } from '../../../lib/results';
import type { DropzoneMessages } from '../../ui/Dropzone.vue';
import MediaShell from '../../ui/MediaShell.vue';

const props = defineProps<{
  m: Messages<'media'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'audioConv'>;
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const format = ref<AudioFormat>('mp3');
const quality = ref<AudioQuality>('high');
const error = ref('');

const ACCEPT =
  'audio/*,.opus,.ogg,.oga,.m4a,.aac,.amr,.wma,.flac,.wav,.mp3,.aiff,.aif,.caf,.mka,.weba';

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  try {
    const out = `audio.${format.value}`;
    const blob = await ff.run(
      file,
      (input) => audioArgs(input, format.value, quality.value, `/out/${out}`),
      out,
      AUDIO_MIME[format.value],
    );
    results.clear();
    const same = extOf(file.name) === format.value;
    results.add(
      withSuffix(file.name, same ? fileName('converted') : '', `.${format.value}`),
      blob,
      formatBytes(blob.size),
    );
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
    :accept="ACCEPT"
    :error="error"
    @remove-result="results.remove"
    @change="results.clear()"
  >
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="ac-fmt" class="label">{{ t.to }}</label>
        <select id="ac-fmt" v-model="format" class="field w-auto">
          <option v-for="f in AUDIO_FORMATS" :key="f" :value="f">{{ t[`fmt.${f}`] }}</option>
        </select>
      </div>
      <div v-if="hasQuality(format)">
        <label for="ac-q" class="label">{{ t.quality }}</label>
        <select id="ac-q" v-model="quality" class="field w-auto">
          <option v-for="q in ['standard', 'high', 'max'] as const" :key="q" :value="q">
            {{ t[`q.${q}`] }} ({{ bitrateOf(format, q)!.replace('k', ' kbps') }})
          </option>
        </select>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="ff.running.value || ff.loading.value"
        @click="run"
      >
        {{ t.run }}
      </button>
    </div>
    <p class="text-sm text-slate-600 dark:text-slate-400">{{ t[`hint.${format}`] }}</p>
  </MediaShell>
</template>
