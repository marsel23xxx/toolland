<script setup lang="ts">
/** Ekstrak audio dari video ke MP3, M4A, atau WAV (ffmpeg.wasm di browser). */
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import { useFfmpeg } from '../../../lib/media/ffmpeg';
import { useFileResults, withSuffix } from '../../../lib/results';
import type { DropzoneMessages } from '../../ui/Dropzone.vue';
import MediaShell from '../../ui/MediaShell.vue';

const props = defineProps<{
  m: Messages<'media'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'audio'>;
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const format = ref<'mp3' | 'm4a' | 'wav'>('mp3');
const error = ref('');

const CODEC = {
  mp3: { args: ['-c:a', 'libmp3lame', '-b:a', '192k'], mime: 'audio/mpeg' },
  m4a: { args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
  wav: { args: ['-c:a', 'pcm_s16le'], mime: 'audio/wav' },
} as const;

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  try {
    const c = CODEC[format.value];
    const out = `audio.${format.value}`;
    const blob = await ff.run(
      file,
      (input) => ['-i', input, '-vn', '-map', '0:a:0', ...c.args, `/out/${out}`],
      out,
      c.mime,
    );
    results.clear();
    results.add(withSuffix(file.name, '', `.${format.value}`), blob, formatBytes(blob.size));
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
    :accept="'video/*,.mkv,.mov'"
    :error="error"
    @remove-result="results.remove"
    @change="results.clear()"
  >
    <div class="flex flex-wrap items-end gap-3">
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
  </MediaShell>
</template>
