<script setup lang="ts">
/** Tombol salin ke clipboard dengan umpan balik singkat. */
import { ref } from 'vue';
import IconCheck from '~icons/lucide/check';
import IconCopy from '~icons/lucide/copy';

const props = withDefaults(
  defineProps<{ text: string; label?: string; copiedLabel?: string; disabled?: boolean }>(),
  { label: 'Salin', copiedLabel: 'Tersalin', disabled: false },
);

const copied = ref(false);
let timer: number | undefined;

async function copy() {
  await navigator.clipboard.writeText(props.text);
  copied.value = true;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <button type="button" class="btn btn-secondary" :disabled="disabled || !text" @click="copy">
    <IconCheck v-if="copied" aria-hidden="true" />
    <IconCopy v-else aria-hidden="true" />
    <span aria-live="polite">{{ copied ? copiedLabel : label }}</span>
  </button>
</template>
