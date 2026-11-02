<script setup lang="ts">
/** Pilihan format keluaran dan slider kualitas. */
import { computed } from 'vue';
import { FORMAT_LABEL, LOSSY, OUTPUT_FORMATS, type OutputFormat } from '../../lib/image/format';

const props = defineProps<{
  label: string;
  qualityLabel: string;
  /** Label untuk opsi "sama seperti asli"; tanpa label, opsi ini tidak ditampilkan. */
  sameLabel?: string;
  formats?: readonly OutputFormat[];
}>();
const format = defineModel<OutputFormat | 'same'>('format', { required: true });
const quality = defineModel<number>('quality', { required: true });

const options = computed(() => [
  ...(props.sameLabel ? [{ value: 'same' as const, label: props.sameLabel }] : []),
  ...(props.formats ?? OUTPUT_FORMATS).map((f) => ({ value: f, label: FORMAT_LABEL[f] })),
]);
const showQuality = computed(() => format.value === 'same' || LOSSY[format.value]);
</script>

<template>
  <div class="flex flex-wrap items-end gap-x-6 gap-y-3">
    <fieldset>
      <legend class="label">{{ label }}</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': format === o.value }"
          :aria-pressed="format === o.value"
          @click="format = o.value"
        >
          {{ o.label }}
        </button>
      </div>
    </fieldset>
    <div v-if="showQuality" class="min-w-48 flex-1 sm:max-w-xs">
      <label class="label" :for="`q-${label}`">{{ qualityLabel }}: {{ quality }}</label>
      <input
        :id="`q-${label}`"
        v-model.number="quality"
        type="range"
        min="1"
        max="100"
        class="w-full accent-brand-600"
      />
    </div>
    <slot />
  </div>
</template>
