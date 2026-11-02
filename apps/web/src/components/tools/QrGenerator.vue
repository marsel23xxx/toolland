<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce, downloadBlob } from '../../lib/download';
import { QR_DEFAULTS, qrOptions, type QrLevel } from '../../lib/qr';

const props = defineProps<{
  m: Record<string, string>;
  /** Gambar QR awal yang dibuat saat build, agar langsung tampil tanpa menunggu JavaScript. */
  initial?: string;
}>();
const m = props.m as ToolMessages<'qr'>;

const text = ref(QR_DEFAULTS.text);
const size = ref(QR_DEFAULTS.size);
const level = ref<QrLevel>(QR_DEFAULTS.level);
const fg = ref(QR_DEFAULTS.fg);
const bg = ref(QR_DEFAULTS.bg);
const margin = ref(QR_DEFAULTS.margin);
const dataUrl = ref(props.initial ?? '');
const error = ref('');

const options = () =>
  qrOptions({
    text: text.value,
    size: size.value,
    level: level.value,
    fg: fg.value,
    bg: bg.value,
    margin: margin.value,
  });

async function render() {
  error.value = '';
  if (!text.value) {
    dataUrl.value = '';
    return;
  }
  try {
    const QRCode = await import('qrcode');
    dataUrl.value = await QRCode.toDataURL(text.value, options());
  } catch {
    dataUrl.value = '';
    error.value = m.tooLong;
  }
}

onMounted(() => {
  if (!props.initial) void render();
});
watch(text, debounce(render, 150));
watch([size, level, fg, bg, margin], render);

function downloadPng() {
  // Data URL -> Blob tanpa fetch() (fetch ke data: diblokir CSP connect-src).
  const [head, b64] = dataUrl.value.split(',');
  const type = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  downloadBlob(new Blob([bytes], { type }), 'qr-code.png');
}

async function downloadSvg() {
  const QRCode = await import('qrcode');
  const svg = await QRCode.toString(text.value, { ...options(), type: 'svg' });
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
}
</script>

<template>
  <div class="grid gap-6 md:grid-cols-[1fr_auto]">
    <div class="space-y-3">
      <div>
        <label for="qr-text" class="label">{{ m.content }}</label>
        <textarea
          id="qr-text"
          v-model="text"
          class="field h-28"
          :placeholder="m.placeholder"
          maxlength="2900"
        />
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label for="qr-size" class="label">{{ m.size }}</label>
          <select id="qr-size" v-model.number="size" class="field">
            <option v-for="s in [256, 512, 1024, 2048]" :key="s" :value="s">{{ s }} px</option>
          </select>
        </div>
        <div>
          <label for="qr-level" class="label">{{ m.errorLevel }}</label>
          <select id="qr-level" v-model="level" class="field">
            <option v-for="l in ['L', 'M', 'Q', 'H'] as const" :key="l" :value="l">
              {{ m[`level.${l}`] }}
            </option>
          </select>
        </div>
        <div>
          <label for="qr-margin" class="label">{{ m.margin }}</label>
          <input
            id="qr-margin"
            v-model.number="margin"
            type="number"
            min="0"
            max="10"
            class="field"
          />
        </div>
        <div>
          <label for="qr-fg" class="label">{{ m.foreground }}</label>
          <input id="qr-fg" v-model="fg" type="color" class="field h-10 p-1" />
        </div>
        <div>
          <label for="qr-bg" class="label">{{ m.background }}</label>
          <input id="qr-bg" v-model="bg" type="color" class="field h-10 p-1" />
        </div>
      </div>
    </div>

    <div class="flex flex-col items-center gap-3">
      <div class="card flex size-64 items-center justify-center bg-white p-2 dark:bg-white">
        <img
          v-if="dataUrl"
          :src="dataUrl"
          :alt="m.preview"
          class="size-full object-contain [image-rendering:pixelated]"
        />
        <p v-else class="px-4 text-center text-sm text-slate-600">{{ error || m.empty }}</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-primary" :disabled="!dataUrl" @click="downloadPng">
          {{ m.downloadPng }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="!dataUrl" @click="downloadSvg">
          {{ m.downloadSvg }}
        </button>
      </div>
    </div>
  </div>
</template>
