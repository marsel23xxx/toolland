<script setup lang="ts">
/** Tombol simpan hasil tes mengetik sebagai gambar PNG atau PDF. */
import { ref } from 'vue';
import { downloadBlob } from '../../lib/download';
import { reportPdf, reportPng, type ReportData } from '../../lib/typing-report';

const props = defineProps<{ build: () => ReportData; m: Record<string, string> }>();

const busy = ref<'' | 'png' | 'pdf'>('');
const error = ref('');

async function save(kind: 'png' | 'pdf') {
  if (busy.value) return;
  busy.value = kind;
  error.value = '';
  try {
    const data = props.build();
    const blob = kind === 'png' ? await reportPng(data) : await reportPdf(data);
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    downloadBlob(blob, `${props.m.reportFile}-${stamp}.${kind}`);
  } catch {
    error.value = props.m.reportError;
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class="btn" :disabled="!!busy" data-ty-save="png" @click="save('png')">
      🖼 {{ busy === 'png' ? m.reportBusy : m.savePng }}
    </button>
    <button type="button" class="btn" :disabled="!!busy" data-ty-save="pdf" @click="save('pdf')">
      📄 {{ busy === 'pdf' ? m.reportBusy : m.savePdf }}
    </button>
    <p v-if="error" class="text-sm text-secang dark:text-[#e98a98]" role="alert">{{ error }}</p>
  </div>
</template>
