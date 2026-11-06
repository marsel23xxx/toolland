<script setup lang="ts">
import { fileName } from '../../../lib/names';
import { ref } from 'vue';
import type { Messages } from '../../../i18n';
import { fill, formatBytes } from '../../../lib/format';
import { useFfmpeg } from '../../../lib/media/ffmpeg';
import { useFileResults, withSuffix } from '../../../lib/results';
import type { DropzoneMessages } from '../../ui/Dropzone.vue';
import MediaShell from '../../ui/MediaShell.vue';

const props = defineProps<{
  m: Messages<'media'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'video'>;
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const crf = ref(28);
const height = ref(0);
const error = ref('');

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  try {
    const blob = await ff.run(
      file,
      (input) => [
        '-i',
        input,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        // Hemat memori: lookahead pendek agar video besar dari HP lebih jarang kehabisan memori WebAssembly.
        '-x264-params',
        'rc-lookahead=5',
        '-crf',
        String(crf.value),
        ...(height.value ? ['-vf', `scale=-2:'min(${height.value},ih)'`] : []),
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '/out/hasil.mp4',
      ],
      'hasil.mp4',
      'video/mp4',
    );
    results.clear();
    // Video yang sudah efisien bisa jadi lebih besar setelah dikompres: berikan file aslinya saja.
    if (blob.size >= file.size) {
      results.add(file.name, file, `${formatBytes(file.size)} · ${props.t.unchanged}`);
      return;
    }
    const pct = Math.round((1 - blob.size / file.size) * 100);
    const sizes = { before: formatBytes(file.size), after: formatBytes(blob.size) };
    results.add(
      withSuffix(file.name, fileName('small'), '.mp4'),
      blob,
      fill(props.files.saved, { ...sizes, percent: pct }),
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
    accept="video/*,.mkv,.mov"
    :error="error"
    @remove-result="results.remove"
    @change="results.clear()"
  >
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="vc-q" class="label">{{ t.quality }}</label>
        <select id="vc-q" v-model.number="crf" class="field w-auto">
          <option :value="23">{{ t.qualityHigh }}</option>
          <option :value="28">{{ t.qualityBalanced }}</option>
          <option :value="32">{{ t.qualitySmall }}</option>
        </select>
      </div>
      <div>
        <label for="vc-res" class="label">{{ t.resolution }}</label>
        <select id="vc-res" v-model.number="height" class="field w-auto">
          <option :value="0">{{ t.original }}</option>
          <option :value="1080">1080p</option>
          <option :value="720">720p</option>
          <option :value="480">480p</option>
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
    <p class="text-sm text-slate-600 dark:text-slate-400">{{ t.hint }}</p>
  </MediaShell>
</template>
