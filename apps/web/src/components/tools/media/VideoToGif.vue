<script setup lang="ts">
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
  t: Messages<'gif'>;
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const start = ref(0);
const length = ref(5);
const fps = ref(12);
const width = ref(480);
const error = ref('');

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  try {
    const blob = await ff.run(
      file,
      (input) => [
        '-ss',
        String(start.value),
        '-t',
        String(Math.min(60, Math.max(0.5, length.value))),
        '-i',
        input,
        '-vf',
        `fps=${fps.value},scale=${width.value}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`,
        '-loop',
        '0',
        '/out/hasil.gif',
      ],
      'hasil.gif',
      'image/gif',
    );
    results.clear();
    results.add(withSuffix(file.name, '', '.gif'), blob, formatBytes(blob.size));
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
    thumbnails
    @remove-result="results.remove"
    @change="results.clear()"
  >
    <template #default="{ currentTime }">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="gif-start" class="label">{{ m.start }}</label>
          <input
            id="gif-start"
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
          <label for="gif-len" class="label">{{ m.length }}</label>
          <input
            id="gif-len"
            v-model.number="length"
            type="number"
            min="0.5"
            max="60"
            step="0.5"
            class="field w-24"
          />
        </div>
        <div>
          <label for="gif-fps" class="label">{{ t.fps }}</label>
          <select id="gif-fps" v-model.number="fps" class="field w-auto">
            <option v-for="f in [8, 10, 12, 15, 20, 25]" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div>
          <label for="gif-w" class="label">{{ t.width }}</label>
          <select id="gif-w" v-model.number="width" class="field w-auto">
            <option v-for="w in [240, 320, 480, 640, 800]" :key="w" :value="w">{{ w }}</option>
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
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ t.maxHint }}</p>
    </template>
  </MediaShell>
</template>
