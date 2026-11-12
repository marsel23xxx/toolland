<script setup lang="ts">
/**
 * Konversi video (MOV, MKV, AVI, WEBM, dll.) ke MP4 atau WebM. Codec dibaca dulu: bila sudah cocok
 * untuk wadah tujuan, video cukup disalin (detik, kualitas asli); bila tidak, di-encode ulang.
 */
import { computed, ref } from 'vue';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import {
  canCopyVideo,
  probeCodecs,
  videoArgs,
  type Codecs,
  type VideoFormat,
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
  t: Messages<'videoConv'>;
}>();

const ff = useFfmpeg();
const results = useFileResults();
const shell = ref<InstanceType<typeof MediaShell>>();
const format = ref<VideoFormat>('mp4');
const codecs = ref<Codecs | null>(null);
const probing = ref(false);
const error = ref('');

const ACCEPT = 'video/*,.mov,.mkv,.avi,.wmv,.flv,.webm,.m4v,.3gp,.mpg,.mpeg,.ts,.mts,.m2ts,.ogv';

let probeId = 0;
async function onChange(file: File | null) {
  results.clear();
  error.value = '';
  codecs.value = null;
  if (!file) return;
  const id = ++probeId;
  probing.value = true;
  const c = await probeCodecs(file);
  if (id !== probeId) return;
  codecs.value = c;
  probing.value = false;
}

/** Nama codec yang mudah dibaca untuk keterangan. */
const NAMES: Record<string, string> = {
  avc: 'H.264',
  hevc: 'HEVC (H.265)',
  vp8: 'VP8',
  vp9: 'VP9',
  av1: 'AV1',
  prores: 'ProRes',
};
const detected = computed(() => {
  const v = codecs.value?.video;
  return v ? (NAMES[v] ?? v.toUpperCase()) : '';
});
const copy = computed(() => canCopyVideo(format.value, codecs.value));

async function run() {
  const file = shell.value?.file;
  if (!file) return;
  error.value = '';
  const ext = format.value;
  // Nama keluaran berbeda dari nama masukan agar "klip.mp4" -> "klip.mp4" tidak menimpa di mount.
  const out = `hasil.${ext}`;
  try {
    const blob = await ff.run(
      file,
      (input) => videoArgs(input, ext, codecs.value, `/out/${out}`),
      out,
      ext === 'mp4' ? 'video/mp4' : 'video/webm',
    );
    results.clear();
    const same = extOf(file.name) === ext;
    results.add(
      withSuffix(file.name, same ? fileName('converted') : '', `.${ext}`),
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
    @change="onChange"
  >
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <label for="vcv-fmt" class="label">{{ t.to }}</label>
        <select id="vcv-fmt" v-model="format" class="field w-auto">
          <option value="mp4">{{ t.mp4 }}</option>
          <option value="webm">{{ t.webm }}</option>
        </select>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="ff.running.value || ff.loading.value || probing"
        @click="run"
      >
        {{ t.run }}
      </button>
    </div>
    <p
      v-if="!probing"
      class="text-sm text-slate-600 dark:text-slate-400"
      :data-vc-mode="copy ? 'copy' : 'encode'"
    >
      <template v-if="detected">{{ t.detected.replace('{codec}', detected) }} </template>
      {{ copy ? t.copy : t.encode }}
    </p>
  </MediaShell>
</template>
