<script setup lang="ts">
/** Unduh semua hasil sekaligus sebagai ZIP (fflate), dibuat di browser. */
import { ref } from 'vue';
import IconDownload from '~icons/lucide/download';
import { downloadBlob } from '../../lib/download';
import { zipFiles } from '../../lib/zip';

const props = defineProps<{
  files: { name: string; blob: Blob }[];
  label: string;
  busyLabel: string;
  zipName?: string;
}>();
const emit = defineEmits<{ downloaded: [] }>();
const zipping = ref(false);

async function download() {
  zipping.value = true;
  try {
    downloadBlob(await zipFiles(props.files), props.zipName ?? 'toolland.zip');
    emit('downloaded');
  } finally {
    zipping.value = false;
  }
}
</script>

<template>
  <button
    type="button"
    class="btn btn-primary"
    :disabled="zipping || files.length < 2"
    @click="download"
  >
    <IconDownload aria-hidden="true" />
    {{ zipping ? busyLabel : label }}
  </button>
</template>
