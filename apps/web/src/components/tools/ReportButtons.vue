<script setup lang="ts">
/** Tombol simpan kartu hasil (tes mengetik, tes IQ) sebagai gambar PNG atau PDF. */
import { ref } from 'vue';
import { downloadBlob } from '../../lib/download';

const props = defineProps<{
  png: () => Promise<Blob>;
  pdf: () => Promise<Blob>;
  /** Awalan nama file; tanggal dan jam ditambahkan otomatis. */
  file: string;
  m: Record<string, string>;
}>();

const busy = ref<'' | 'png' | 'pdf'>('');
const error = ref('');

const pad = (n: number) => String(n).padStart(2, '0');

async function save(kind: 'png' | 'pdf') {
  if (busy.value) return;
  busy.value = kind;
  error.value = '';
  try {
    const blob = await (kind === 'png' ? props.png() : props.pdf());
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    downloadBlob(blob, `${props.file}-${stamp}.${kind}`);
  } catch {
    error.value = props.m.reportError;
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class="btn" :disabled="!!busy" data-save="png" @click="save('png')">
      🖼 {{ busy === 'png' ? m.reportBusy : m.savePng }}
    </button>
    <button type="button" class="btn" :disabled="!!busy" data-save="pdf" @click="save('pdf')">
      📄 {{ busy === 'pdf' ? m.reportBusy : m.savePdf }}
    </button>
    <p v-if="error" class="text-sm text-secang dark:text-[#e98a98]" role="alert">{{ error }}</p>
  </div>
</template>
