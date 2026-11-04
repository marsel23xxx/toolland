<script setup lang="ts">
/**
 * Potong gambar dengan cropperjs (rasio bebas atau tetap), atau buat pas foto 2x3/3x4/4x6 cm (300 DPI).
 * Kotak dipilih di pratinjau, lalu dipotong dari file ASLI di worker agar kualitas tetap penuh.
 */
import { fileName } from '../../lib/names';
import type Cropper from 'cropperjs';
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';
import type { Messages } from '../../i18n';
import { useImageBatch } from '../../lib/image/batch';
import { IMAGE_ACCEPT, sniffFormat, type OutputFormat } from '../../lib/image/format';
import { clampRect, cmToPx, type Rect } from '../../lib/image/geometry';
import type { ImageJob } from '../../lib/image/types';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';
import FormatPicker from '../ui/FormatPicker.vue';
import ProgressBar from '../ui/ProgressBar.vue';

const ResultCard = defineAsyncComponent(() => import('../ui/ResultCard.vue'));
const DonateCard = defineAsyncComponent(() => import('../ui/DonateCard.vue'));

const props = defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
  t: Messages<'crop'>;
  mode: 'crop' | 'pasfoto';
}>();

const RATIOS = [
  { label: '', value: NaN },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];
const PASFOTO = [
  { label: '2×3 cm', w: 2, h: 3 },
  { label: '3×4 cm', w: 3, h: 4 },
  { label: '4×6 cm', w: 4, h: 6 },
];

const ratioIndex = ref(props.mode === 'pasfoto' ? 0 : 0);
const pasfotoIndex = ref(1);
const format = ref<OutputFormat | 'same'>('same');
const quality = ref(92);

const ratio = computed(() => {
  if (props.mode === 'pasfoto') {
    const p = PASFOTO[pasfotoIndex.value];
    return p.w / p.h;
  }
  return RATIOS[ratioIndex.value].value;
});

const source = shallowRef<File | null>(null);
const previewUrl = ref('');
const preparing = ref(false);
const host = ref<HTMLDivElement>();
let cropper: Cropper | null = null;
const batch = useImageBatch({
  suffix: fileName(props.mode === 'pasfoto' ? 'passport' : 'cropped'),
});
const downloads = ref(0);

async function load(files: File[]) {
  const file = files[0];
  if (!file) return;
  reset();
  source.value = file;
  preparing.value = true;
  try {
    // HEIC tidak bisa ditampilkan <img> di kebanyakan browser: buat pratinjau JPG dulu di worker.
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    let preview: Blob = file;
    if (sniffFormat(head) === 'heic') {
      const r = await batch.pool.run((api) => api.process(file, { format: 'jpeg', quality: 90 }));
      preview = new Blob([r.buffer], { type: 'image/jpeg' });
      source.value = new File([preview], file.name.replace(/\.[^.]+$/, '.jpg'), {
        type: 'image/jpeg',
      });
    }
    previewUrl.value = URL.createObjectURL(preview);
    await nextTick();
    await mountCropper();
  } finally {
    preparing.value = false;
  }
}

async function mountCropper() {
  const { default: CropperClass } = await import('cropperjs');
  const img = new Image();
  img.src = previewUrl.value;
  img.alt = '';
  await img.decode();
  cropper = new CropperClass(img, {
    container: host.value!,
    template:
      '<cropper-canvas background>' +
      '<cropper-image></cropper-image>' +
      '<cropper-shade></cropper-shade>' +
      '<cropper-selection movable resizable outlined>' +
      '<cropper-grid role="grid" bordered covered></cropper-grid>' +
      '<cropper-crosshair centered></cropper-crosshair>' +
      '<cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>' +
      '<cropper-handle action="n-resize"></cropper-handle><cropper-handle action="e-resize"></cropper-handle>' +
      '<cropper-handle action="s-resize"></cropper-handle><cropper-handle action="w-resize"></cropper-handle>' +
      '<cropper-handle action="ne-resize"></cropper-handle><cropper-handle action="nw-resize"></cropper-handle>' +
      '<cropper-handle action="se-resize"></cropper-handle><cropper-handle action="sw-resize"></cropper-handle>' +
      '</cropper-selection></cropper-canvas>',
  });
  const canvas = cropper.getCropperCanvas()!;
  canvas.style.height = '100%';
  canvas.setAttribute('aria-label', props.t.canvas);
  await cropper.getCropperImage()!.$ready();
  const selection = cropper.getCropperSelection()!;
  // Kotak tidak boleh keluar dari gambar.
  selection.addEventListener('change', (e) => {
    const d = (e as CustomEvent<Rect>).detail;
    const b = imageBox();
    if (!b) return;
    const eps = 0.5;
    if (
      d.x < b.x - eps ||
      d.y < b.y - eps ||
      d.x + d.width > b.x + b.width + eps ||
      d.y + d.height > b.y + b.height + eps
    ) {
      e.preventDefault();
    }
  });
  fitSelection();
}

/** Posisi gambar di dalam kanvas cropper (koordinat kanvas). */
function imageBox(): Rect | null {
  const canvas = cropper?.getCropperCanvas();
  const image = cropper?.getCropperImage();
  if (!canvas || !image) return null;
  const c = canvas.getBoundingClientRect();
  const i = image.getBoundingClientRect();
  return { x: i.left - c.left, y: i.top - c.top, width: i.width, height: i.height };
}

/** Kotak terbesar dengan rasio terpilih (90% gambar), di tengah gambar. */
function fitSelection() {
  const selection = cropper?.getCropperSelection();
  const b = imageBox();
  if (!selection || !b) return;
  const r = ratio.value;
  selection.aspectRatio = Number.isNaN(r) ? NaN : r;
  let w = b.width * 0.9;
  let h = b.height * 0.9;
  if (!Number.isNaN(r)) {
    if (w / h > r) w = h * r;
    else h = w / r;
  }
  selection.$change(
    b.x + (b.width - w) / 2,
    b.y + (b.height - h) / 2,
    w,
    h,
    Number.isNaN(r) ? undefined : r,
    true,
  );
}

watch(ratio, () => fitSelection());

/** Kotak terpilih dalam piksel gambar asli. */
function naturalRect(): Rect | null {
  const selection = cropper?.getCropperSelection();
  const image = cropper?.getCropperImage();
  if (!selection || !image) return null;
  const img = image.$image as HTMLImageElement;
  const i = image.getBoundingClientRect();
  const s = selection.getBoundingClientRect();
  const f = img.naturalWidth / i.width;
  return clampRect(
    { x: (s.left - i.left) * f, y: (s.top - i.top) * f, width: s.width * f, height: s.height * f },
    img.naturalWidth,
    img.naturalHeight,
  );
}

function run() {
  const rect = naturalRect();
  if (!rect || !source.value) return;
  let job: ImageJob;
  if (props.mode === 'pasfoto') {
    const p = PASFOTO[pasfotoIndex.value];
    job = {
      format: 'jpeg',
      quality: 95,
      crop: rect,
      resize: { kind: 'box', width: cmToPx(p.w), height: cmToPx(p.h), fit: 'stretch' },
    };
  } else {
    job = { format: format.value, quality: quality.value, crop: rect };
  }
  batch.clear();
  batch.add([source.value], job);
}

function reset() {
  cropper?.getCropperCanvas()?.remove();
  cropper = null;
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  source.value = null;
  batch.clear();
}

onBeforeUnmount(reset);
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      v-if="!source"
      :messages="dropzone"
      :accept="IMAGE_ACCEPT"
      :multiple="false"
      @files="load"
      @prefetch="batch.pool.warmup('jpeg')"
    />

    <template v-else>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
        <fieldset v-if="mode === 'crop'">
          <legend class="label">{{ t.ratio }}</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(r, i) in RATIOS"
              :key="i"
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn-active': ratioIndex === i }"
              :aria-pressed="ratioIndex === i"
              @click="ratioIndex = i"
            >
              {{ r.label || t.free }}
            </button>
          </div>
        </fieldset>
        <fieldset v-else>
          <legend class="label">{{ t.size }}</legend>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(p, i) in PASFOTO"
              :key="p.label"
              type="button"
              class="btn btn-secondary"
              :class="{ 'btn-active': pasfotoIndex === i }"
              :aria-pressed="pasfotoIndex === i"
              @click="pasfotoIndex = i"
            >
              {{ p.label }}
            </button>
          </div>
        </fieldset>
        <button type="button" class="btn btn-secondary" @click="reset">{{ t.change }}</button>
      </div>

      <p class="text-sm text-slate-600 dark:text-slate-400">
        {{ mode === 'pasfoto' ? t.pasfotoHint : t.hint }}
      </p>
      <ProgressBar v-if="preparing" :label="t.loading" />
      <div
        ref="host"
        class="h-[60vh] max-h-[32rem] min-h-72 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900"
      />

      <FormatPicker
        v-if="mode === 'crop'"
        v-model:format="format"
        v-model:quality="quality"
        :label="m.format"
        :quality-label="m.quality"
        :same-label="m.sameFormat"
      />

      <button
        type="button"
        class="btn btn-primary"
        :disabled="preparing || batch.busy"
        @click="run"
      >
        {{ t.run }}
      </button>

      <DonateCard :m="donate" :trigger="downloads" />
      <ul v-if="batch.items.length" class="space-y-2">
        <ResultCard
          v-for="item in batch.items"
          :key="item.id"
          :item="item"
          :m="m"
          @remove="batch.remove(item.id)"
          @downloaded="downloads++"
        />
      </ul>
    </template>
  </div>
</template>
