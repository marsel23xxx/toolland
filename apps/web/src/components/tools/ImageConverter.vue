<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Messages } from '../../i18n';
import { useImageBatch } from '../../lib/image/batch';
import type { OutputFormat } from '../../lib/image/format';
import type { ImageJob } from '../../lib/image/types';
import type { DropzoneMessages } from '../ui/Dropzone.vue';
import FormatPicker from '../ui/FormatPicker.vue';
import ImageBatchShell from '../ui/ImageBatchShell.vue';

const props = defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'convert'>;
  defaultFormat: OutputFormat;
  accept?: string;
}>();

const DEFAULT_QUALITY: Record<OutputFormat, number> = { jpeg: 85, png: 100, webp: 80, avif: 60 };
const format = ref<OutputFormat | 'same'>(props.defaultFormat);
const quality = ref(DEFAULT_QUALITY[props.defaultFormat]);
watch(format, (f) => {
  if (f !== 'same') quality.value = DEFAULT_QUALITY[f];
});

const batch = useImageBatch();
const job = computed<ImageJob>(() => ({ format: format.value, quality: quality.value }));
const lastJob = ref('');
const dirty = computed(() => batch.items.length > 0 && JSON.stringify(job.value) !== lastJob.value);

function add(files: File[]) {
  batch.add(files, job.value);
  lastJob.value = JSON.stringify(job.value);
}
function apply() {
  batch.rerun(job.value);
  lastJob.value = JSON.stringify(job.value);
}
</script>

<template>
  <ImageBatchShell
    :batch="batch"
    :m="m"
    :dropzone="dropzone"
    :donate="donate"
    :accept="accept"
    @files="add"
    @prefetch="batch.pool.warmup(format === 'same' ? 'jpeg' : format)"
  >
    <FormatPicker
      v-model:format="format"
      v-model:quality="quality"
      :label="m.format"
      :quality-label="m.quality"
    >
      <button
        v-if="dirty"
        type="button"
        class="btn btn-primary"
        :disabled="batch.busy"
        @click="apply"
      >
        {{ m.apply }}
      </button>
    </FormatPicker>
    <p v-if="format === 'png'" class="text-sm text-slate-600 dark:text-slate-400">
      {{ t.losslessHint }}
    </p>
  </ImageBatchShell>
</template>
