<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Messages } from '../../i18n';
import { useImageBatch } from '../../lib/image/batch';
import type { OutputFormat } from '../../lib/image/format';
import type { ResizeSpec } from '../../lib/image/geometry';
import type { ImageJob } from '../../lib/image/types';
import type { DropzoneMessages } from '../ui/Dropzone.vue';
import FormatPicker from '../ui/FormatPicker.vue';
import ImageBatchShell from '../ui/ImageBatchShell.vue';

defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'resize'>;
}>();

const PRESETS = [
  { name: 'Instagram persegi', w: 1080, h: 1080 },
  { name: 'Instagram potret 4:5', w: 1080, h: 1350 },
  { name: 'Instagram/WhatsApp story', w: 1080, h: 1920 },
  { name: 'Thumbnail YouTube', w: 1280, h: 720 },
  { name: 'Sampul Facebook', w: 820, h: 312 },
  { name: 'Header X (Twitter)', w: 1500, h: 500 },
  { name: 'Banner LinkedIn', w: 1584, h: 396 },
  { name: 'Full HD', w: 1920, h: 1080 },
];

type Mode = 'pixels' | 'percent' | 'preset';
type Fit = 'cover' | 'contain' | 'stretch';
const mode = ref<Mode>('pixels');
const width = ref<number | undefined>(1920);
const height = ref<number | undefined>(undefined);
const keepRatio = ref(true);
const percent = ref(50);
const preset = ref(0);
const fit = ref<Fit>('cover');
const background = ref('#ffffff');
const format = ref<OutputFormat | 'same'>('same');
const quality = ref(85);

const spec = computed<ResizeSpec>(() => {
  if (mode.value === 'percent')
    return { kind: 'scale', percent: Math.min(400, Math.max(1, percent.value || 100)) };
  if (mode.value === 'preset') {
    const p = PRESETS[preset.value];
    return { kind: 'box', width: p.w, height: p.h, fit: fit.value };
  }
  const w = width.value || undefined;
  const h = height.value || undefined;
  if (keepRatio.value || !w || !h)
    return { kind: 'box', width: w, height: h, fit: 'inside', enlarge: true };
  return { kind: 'box', width: w, height: h, fit: fit.value };
});
const showFit = computed(
  () =>
    mode.value === 'preset' ||
    (mode.value === 'pixels' && !keepRatio.value && !!width.value && !!height.value),
);

const batch = useImageBatch({ suffix: '-resize' });
const job = computed<ImageJob>(() => ({
  format: format.value,
  quality: quality.value,
  resize: spec.value,
  background: background.value,
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
    zip-name="gambar-resize.zip"
    @files="add"
    @prefetch="batch.pool.warmup(format === 'same' ? 'jpeg' : format)"
  >
    <div class="space-y-4">
      <fieldset>
        <legend class="label">{{ t.mode }}</legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="o in ['pixels', 'percent', 'preset'] as const"
            :key="o"
            type="button"
            class="btn btn-secondary"
            :class="{ 'btn-active': mode === o }"
            :aria-pressed="mode === o"
            @click="mode = o"
          >
            {{ o === 'pixels' ? t.modePixels : o === 'percent' ? t.modePercent : t.modePreset }}
          </button>
        </div>
      </fieldset>

      <div class="flex flex-wrap items-end gap-3">
        <template v-if="mode === 'pixels'">
          <div>
            <label for="rs-w" class="label">{{ t.width }}</label>
            <input
              id="rs-w"
              v-model.number="width"
              type="number"
              min="1"
              max="20000"
              class="field w-32"
            />
          </div>
          <div>
            <label for="rs-h" class="label">{{ t.height }}</label>
            <input
              id="rs-h"
              v-model.number="height"
              type="number"
              min="1"
              max="20000"
              class="field w-32"
            />
          </div>
          <label class="flex items-center gap-2 py-2 text-sm">
            <input v-model="keepRatio" type="checkbox" class="size-4 accent-brand-600" />
            {{ t.keepRatio }}
          </label>
        </template>
        <div v-else-if="mode === 'percent'">
          <label for="rs-p" class="label">{{ t.percent }}</label>
          <input
            id="rs-p"
            v-model.number="percent"
            type="number"
            min="1"
            max="400"
            class="field w-28"
          />
        </div>
        <div v-else>
          <label for="rs-preset" class="label">{{ t.preset }}</label>
          <select id="rs-preset" v-model.number="preset" class="field w-auto">
            <option v-for="(p, i) in PRESETS" :key="p.name" :value="i">
              {{ p.name }} ({{ p.w }}×{{ p.h }})
            </option>
          </select>
        </div>

        <div v-if="showFit">
          <label for="rs-fit" class="label">{{ t.fit }}</label>
          <select id="rs-fit" v-model="fit" class="field w-auto">
            <option value="cover">{{ t.fitCover }}</option>
            <option value="contain">{{ t.fitContain }}</option>
            <option value="stretch">{{ t.fitStretch }}</option>
          </select>
        </div>
        <div v-if="showFit && fit === 'contain'">
          <label for="rs-bg" class="label">{{ t.background }}</label>
          <input id="rs-bg" v-model="background" type="color" class="field h-10 w-16 p-1" />
        </div>
      </div>

      <FormatPicker
        v-model:format="format"
        v-model:quality="quality"
        :label="m.format"
        :quality-label="m.quality"
        :same-label="m.sameFormat"
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
    </div>
  </ImageBatchShell>
</template>
