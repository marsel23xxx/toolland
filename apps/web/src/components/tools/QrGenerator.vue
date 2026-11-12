<script setup lang="ts">
/**
 * Pembuat QR code dengan gaya: bentuk titik, bentuk penanda pojok ("mata"), warna, dan logo di
 * tengah. Setiap desain langsung dipindai ulang dengan jsQR di dua ukuran; unduhan hanya aktif
 * bila QR terbaca dan isinya sama persis, supaya QR yang dibagikan tidak percuma.
 */
import { computed, onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { debounce, downloadBlob } from '../../lib/download';
import { QR_DEFAULTS, type QrLevel } from '../../lib/qr';
import {
  EYE_SHAPES,
  MAX_LOGO,
  MODULE_SHAPES,
  contrastOk,
  qrSvg,
  type EyeShape,
  type ModuleShape,
} from '../../lib/qr-style';

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
const eyeColor = ref(QR_DEFAULTS.fg);
const margin = ref(QR_DEFAULTS.margin);
const shape = ref<ModuleShape>('square');
const eye = ref<EyeShape>('square');
const logo = ref<string | null>(null);
const logoSize = ref(0.22);
const logoErr = ref('');

const preview = ref(props.initial ?? '');
const error = ref('');
type Check = 'idle' | 'checking' | 'ok' | 'bad' | 'contrast';
const check = ref<Check>(props.initial ? 'ok' : 'idle');
let svgText = '';
let pngCanvas: HTMLCanvasElement | null = null;
let version = 0;

/** Logo butuh koreksi error maksimal agar bagian yang tertutup bisa dipulihkan. */
const effectiveLevel = computed<QrLevel>(() => (logo.value ? 'H' : level.value));

interface Preset {
  id: 'classic' | 'rounded' | 'dots' | 'heart' | 'star' | 'elegant';
  shape: ModuleShape;
  eye: EyeShape;
  fg: string;
  eyeColor: string;
}
const PRESETS: Preset[] = [
  { id: 'classic', shape: 'square', eye: 'square', fg: '#000000', eyeColor: '#000000' },
  { id: 'rounded', shape: 'rounded', eye: 'rounded', fg: '#1e3a8a', eyeColor: '#1e3a8a' },
  { id: 'dots', shape: 'dots', eye: 'circle', fg: '#0f766e', eyeColor: '#134e4a' },
  { id: 'heart', shape: 'heart', eye: 'rounded', fg: '#be123c', eyeColor: '#9f1239' },
  { id: 'star', shape: 'star', eye: 'leaf', fg: '#6d28d9', eyeColor: '#4c1d95' },
  { id: 'elegant', shape: 'diamond', eye: 'leaf', fg: '#1b1814', eyeColor: '#983c09' },
];
function applyPreset(p: Preset) {
  shape.value = p.shape;
  eye.value = p.eye;
  fg.value = p.fg;
  eyeColor.value = p.eyeColor;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** Baca QR dari canvas dengan jsQR (tanpa mencoba warna terbalik, seperti kebanyakan HP). */
async function readable(canvas: HTMLCanvasElement, expected: string): Promise<boolean> {
  const { default: jsQR } = await import('jsqr');
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' })?.data === expected;
}

function drawTo(img: HTMLImageElement, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = px;
  c.height = px;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg.value;
  ctx.fillRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  return c;
}

async function render() {
  const v = ++version;
  error.value = '';
  if (!text.value) {
    preview.value = '';
    check.value = 'idle';
    return;
  }
  check.value = 'checking';
  try {
    const QRCode = await import('qrcode');
    const q = QRCode.create(text.value, { errorCorrectionLevel: effectiveLevel.value });
    const mod = q.modules;
    const matrix = {
      size: mod.size,
      get: (r: number, c: number) => !!mod.get(r, c),
      isFunction: (r: number, c: number) => !!mod.reservedBit[r * mod.size + c],
    };
    const svg = qrSvg(
      matrix,
      {
        shape: shape.value,
        eye: eye.value,
        fg: fg.value,
        eyeColor: eyeColor.value,
        bg: bg.value,
        margin: Math.min(10, Math.max(0, Number(margin.value) || 0)),
        logo: logo.value ? { href: logo.value, size: logoSize.value } : null,
      },
      size.value,
    );
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = await loadImage(url);
    if (v !== version) return;
    svgText = svg;
    preview.value = url;
    pngCanvas = drawTo(img, size.value);
    if (!contrastOk(fg.value, bg.value) || !contrastOk(eyeColor.value, bg.value)) {
      check.value = 'contrast';
      return;
    }
    // Dua ukuran: ukuran unduhan dan versi kecil (seperti QR yang dicetak kecil atau difoto jauh).
    const ok =
      (await readable(pngCanvas, text.value)) && (await readable(drawTo(img, 300), text.value));
    if (v === version) check.value = ok ? 'ok' : 'bad';
  } catch {
    if (v !== version) return;
    preview.value = '';
    check.value = 'idle';
    error.value = m.tooLong;
  }
}

onMounted(() => void render());
watch(text, debounce(render, 200));
watch([size, level, fg, bg, eyeColor, margin, shape, eye, logo], () => void render());
watch(logoSize, debounce(render, 120));

async function onLogo(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  logoErr.value = '';
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // Kecilkan ke maksimal 512 px agar SVG tetap ringan; transparansi dipertahankan (PNG).
    const k = Math.min(1, 512 / Math.max(img.naturalWidth || 512, img.naturalHeight || 512));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || 512) * k));
    c.height = Math.max(1, Math.round((img.naturalHeight || 512) * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    logo.value = c.toDataURL('image/png');
  } catch {
    logoErr.value = m.logoError;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const canDownload = computed(() => check.value === 'ok' && !!preview.value);

function downloadPng() {
  pngCanvas?.toBlob((b) => b && downloadBlob(b, 'qr-code.png'), 'image/png');
}
function downloadSvg() {
  downloadBlob(new Blob([svgText], { type: 'image/svg+xml' }), 'qr-code.svg');
}

/** Ikon kecil untuk tombol bentuk (path dalam kotak 0-10). */
const SHAPE_ICON: Record<ModuleShape, string> = {
  square: 'M1 1h3v3H1zM6 1h3v3H6zM1 6h3v3H1z',
  rounded:
    'M2.5 1h4A2.5 2.5 0 0 1 9 3.5v0A2.5 2.5 0 0 1 6.5 6h-4A1.5 1.5 0 0 1 1 4.5v-2A1.5 1.5 0 0 1 2.5 1zM2.5 6.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z',
  dots: 'M1 2.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M6 2.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M1 7.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0',
  diamond: 'M2.5 1L4 2.5L2.5 4L1 2.5zM7.5 1L9 2.5L7.5 4L6 2.5zM2.5 6L4 7.5L2.5 9L1 7.5z',
  heart: 'M5 9C2 7 .5 5.5 .8 3.5C1.1 1.6 3.6 1.2 5 3C6.4 1.2 8.9 1.6 9.2 3.5C9.5 5.5 8 7 5 9z',
  star: 'M5 .6L6.2 3.6L9.4 3.8L6.9 5.8L7.8 9L5 7.2L2.2 9L3.1 5.8L.6 3.8L3.8 3.6z',
};
const EYE_ICON: Record<EyeShape, string> = {
  square: 'M1 1h8v8H1zM2.5 2.5v5h5v-5zM3.8 3.8h2.4v2.4H3.8z',
  rounded:
    'M3 1h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zM3.5 2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1zM4.4 3.8h1.2a.6.6 0 0 1 .6.6v1.2a.6.6 0 0 1-.6.6H4.4a.6.6 0 0 1-.6-.6V4.4a.6.6 0 0 1 .6-.6z',
  circle:
    'M1 5a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM2.5 5a2.5 2.5 0 1 1 5 0a2.5 2.5 0 1 1-5 0zM3.8 5a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0z',
  leaf: 'M4.5 1H9v4.5A3.5 3.5 0 0 1 5.5 9H1V4.5A3.5 3.5 0 0 1 4.5 1zM4.5 2.5a2 2 0 0 0-2 2v3h3a2 2 0 0 0 2-2v-3zM4.6 3.8h1.6v1.4a1 1 0 0 1-1 1H3.8V4.6a.8.8 0 0 1 .8-.8z',
};
</script>

<template>
  <div class="grid gap-6 md:grid-cols-[1fr_auto]">
    <div class="space-y-4">
      <div>
        <label for="qr-text" class="label">{{ m.content }}</label>
        <textarea
          id="qr-text"
          v-model="text"
          class="field h-24"
          :placeholder="m.placeholder"
          maxlength="2900"
        />
      </div>

      <!-- Gaya cepat -->
      <div>
        <p class="label">{{ m.presets }}</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="p in PRESETS"
            :key="p.id"
            type="button"
            class="btn btn-secondary"
            :class="{ 'btn-active': shape === p.shape && eye === p.eye && fg === p.fg }"
            :data-qr-preset="p.id"
            @click="applyPreset(p)"
          >
            {{ m[`preset_${p.id}`] }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend class="label">{{ m.shape }}</legend>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in MODULE_SHAPES"
              :key="s"
              type="button"
              class="btn btn-secondary px-2.5"
              :class="{ 'btn-active': shape === s }"
              :aria-pressed="shape === s"
              :title="m[`shape_${s}`]"
              :data-qr-shape="s"
              @click="shape = s"
            >
              <svg viewBox="0 0 10 10" class="size-5" aria-hidden="true">
                <path :d="SHAPE_ICON[s]" fill="currentColor" fill-rule="evenodd" />
              </svg>
              <span class="sr-only">{{ m[`shape_${s}`] }}</span>
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend class="label">{{ m.eye }}</legend>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="e in EYE_SHAPES"
              :key="e"
              type="button"
              class="btn btn-secondary px-2.5"
              :class="{ 'btn-active': eye === e }"
              :aria-pressed="eye === e"
              :title="m[`eye_${e}`]"
              :data-qr-eye="e"
              @click="eye = e"
            >
              <svg viewBox="0 0 10 10" class="size-5" aria-hidden="true">
                <path :d="EYE_ICON[e]" fill="currentColor" fill-rule="evenodd" />
              </svg>
              <span class="sr-only">{{ m[`eye_${e}`] }}</span>
            </button>
          </div>
        </fieldset>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="qr-fg" class="label">{{ m.foreground }}</label>
          <input id="qr-fg" v-model="fg" type="color" class="field h-10 p-1" />
        </div>
        <div>
          <label for="qr-eye" class="label">{{ m.eyeColor }}</label>
          <input id="qr-eye" v-model="eyeColor" type="color" class="field h-10 p-1" />
        </div>
        <div>
          <label for="qr-bg" class="label">{{ m.background }}</label>
          <input id="qr-bg" v-model="bg" type="color" class="field h-10 p-1" />
        </div>
      </div>

      <!-- Logo -->
      <div class="rounded-md border border-rule bg-paper-2 p-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium">{{ m.logo }}</span>
          <label class="btn btn-secondary cursor-pointer px-2.5 py-1 text-xs">
            🖼 {{ logo ? m.logoChange : m.logoAdd }}
            <input type="file" accept="image/*" class="sr-only" data-qr-logo @change="onLogo" />
          </label>
          <button
            v-if="logo"
            type="button"
            class="btn btn-secondary px-2.5 py-1 text-xs"
            @click="logo = null"
          >
            ✕ {{ m.logoRemove }}
          </button>
        </div>
        <label v-if="logo" class="mt-2 block text-sm">
          <span class="flex justify-between"
            ><span>{{ m.logoSize }}</span
            ><b class="tabular-nums">{{ Math.round(logoSize * 100) }}%</b></span
          >
          <input
            v-model.number="logoSize"
            type="range"
            min="0.12"
            :max="MAX_LOGO"
            step="0.01"
            class="w-full"
            data-qr-logo-size
          />
        </label>
        <p class="mt-1 text-xs text-ink-3">{{ logo ? m.logoNote : m.logoHint }}</p>
        <p v-if="logoErr" class="error-text mt-1">{{ logoErr }}</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label for="qr-size" class="label">{{ m.size }}</label>
          <select id="qr-size" v-model.number="size" class="field">
            <option v-for="s in [256, 512, 1024, 2048]" :key="s" :value="s">{{ s }} px</option>
          </select>
        </div>
        <div>
          <label for="qr-level" class="label">{{ m.errorLevel }}</label>
          <select
            id="qr-level"
            :value="effectiveLevel"
            class="field"
            :disabled="!!logo"
            @change="level = ($event.target as HTMLSelectElement).value as QrLevel"
          >
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
      </div>
    </div>

    <div class="flex flex-col items-center gap-3 md:w-72">
      <div class="card flex size-64 items-center justify-center bg-white p-2 dark:bg-white">
        <img v-if="preview" :src="preview" :alt="m.preview" class="size-full object-contain" />
        <p v-else class="px-4 text-center text-sm text-slate-600">{{ error || m.empty }}</p>
      </div>
      <p
        v-if="preview"
        class="w-full rounded-md px-3 py-2 text-center text-sm font-semibold"
        :class="{
          'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300': check === 'ok',
          'bg-paper-2 text-ink-3': check === 'checking',
          'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300':
            check === 'bad' || check === 'contrast',
        }"
        role="status"
        :data-qr-check="check"
      >
        {{
          check === 'ok'
            ? `✓ ${m.checkOk}`
            : check === 'checking'
              ? m.checking
              : check === 'contrast'
                ? `✕ ${m.checkContrast}`
                : `✕ ${m.checkBad}`
        }}
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canDownload"
          data-qr-png
          @click="downloadPng"
        >
          {{ m.downloadPng }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!canDownload"
          data-qr-svg
          @click="downloadSvg"
        >
          {{ m.downloadSvg }}
        </button>
      </div>
      <p v-if="check === 'bad' || check === 'contrast'" class="text-center text-xs text-ink-3">
        {{ m.downloadLocked }}
      </p>
    </div>
  </div>
</template>
