<script setup lang="ts">
import { fileName } from '../../lib/names';
import { computed, ref } from 'vue';
import type { Messages } from '../../i18n';
import { useImageBatch } from '../../lib/image/batch';
import type { OutputFormat } from '../../lib/image/format';
import type { ImageJob } from '../../lib/image/types';
import type { DropzoneMessages } from '../ui/Dropzone.vue';
import FormatPicker from '../ui/FormatPicker.vue';
import ImageBatchShell from '../ui/ImageBatchShell.vue';

defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'compress'>;
}>();

const format = ref<OutputFormat | 'same'>('same');
const quality = ref(75);
const maxSide = ref(0);
const SIDES = [0, 3840, 2560, 1920, 1280, 1024];

const batch = useImageBatch({ suffix: fileName('small') });
const job = computed<ImageJob>(() => ({
  format: format.value,
  quality: quality.value,
  keepIfLarger: true,
  resize: maxSide.value
    ? { kind: 'box', width: maxSide.value, height: maxSide.value, fit: 'inside' }
    : undefined,
}));
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
    :zip-name="`${fileName('zipSmallImages')}.zip`"
    @files="add"
    @prefetch="batch.pool.warmup(format === 'same' ? 'jpeg' : format)"
  >
    <FormatPicker
      v-model:format="format"
      v-model:quality="quality"
      :label="m.format"
      :quality-label="m.quality"
      :same-label="m.sameFormat"
      :formats="['jpeg', 'webp', 'avif']"
    >
      <div>
        <label for="cmp-side" class="label">{{ t.maxSide }}</label>
        <select id="cmp-side" v-model.number="maxSide" class="field w-auto">
          <option v-for="s in SIDES" :key="s" :value="s">{{ s ? `${s} px` : t.noLimit }}</option>
        </select>
      </div>
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
    <p class="text-sm text-slate-600 dark:text-slate-400">{{ t.hint }}</p>
  </ImageBatchShell>
</template>
