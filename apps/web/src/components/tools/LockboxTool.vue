<script setup lang="ts">
/**
 * Kunci File & Teks: data dikunci dengan password jadi kode (untuk di-copy-paste) atau file
 * .toolland (untuk data besar), lalu penerima membukanya di halaman yang sama.
 * Semua terjadi di browser; tidak ada yang dikirim ke server.
 */
import { computed, onMounted, ref, watch } from 'vue';
import IconRefresh from '~icons/lucide/refresh-cw';
import type { ToolMessages } from '../../i18n';
import { downloadBlob } from '../../lib/download';
import { fill, formatBytes } from '../../lib/format';
import {
  codeLength,
  fromCode,
  generatePassword,
  isLocked,
  isWeakPassword,
  lock,
  LockboxError,
  MAX_CODE_LENGTH,
  MAX_FILE_SIZE,
  toCode,
  unlock,
  type Payload,
} from '../../lib/lockbox';
import CopyButton from '../ui/CopyButton.vue';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';

const props = defineProps<{ m: Record<string, string>; dropzone: DropzoneMessages }>();
const m = props.m as ToolMessages<'lockbox'>;

const mode = ref<'lock' | 'unlock'>('lock');
const errorText = (e: unknown) =>
  e instanceof LockboxError ? m[`error.${e.code}`] : m['error.failed'];

// --- Kunci ---
const source = ref<'text' | 'file'>('text');
const text = ref('');
const file = ref<File | null>(null);
const password = ref('');
const locking = ref(false);
const lockError = ref('');
const locked = ref<{ bytes: Uint8Array; name: string } | null>(null);
const showWeak = ref(false);

// Dibuat di browser saja: kalau dibuat saat render server, nilainya berbeda dengan di browser.
onMounted(() => (password.value = generatePassword()));

function regenerate() {
  password.value = generatePassword();
  showWeak.value = false;
}

// Hasil lama tidak berlaku lagi begitu isi atau password berubah.
watch([source, text, file, password], () => {
  locked.value = null;
  lockError.value = '';
});

const weak = computed(() => showWeak.value && !!password.value && isWeakPassword(password.value));

const code = computed(() => {
  if (!locked.value || codeLength(locked.value.bytes.length) > MAX_CODE_LENGTH) return '';
  return toCode(locked.value.bytes);
});
const lockedChars = computed(() =>
  locked.value
    ? codeLength(locked.value.bytes.length).toLocaleString(document.documentElement.lang)
    : '0',
);

async function runLock() {
  lockError.value = '';
  let payload: Payload;
  let name: string;
  if (source.value === 'text') {
    if (!text.value) return (lockError.value = m['error.empty']);
    payload = { type: 'text', text: text.value };
    name = m.textFileName;
  } else {
    if (!file.value) return (lockError.value = m['error.empty']);
    const f = file.value;
    payload = {
      type: 'file',
      name: f.name,
      mime: f.type,
      data: new Uint8Array(await f.arrayBuffer()),
    };
    name = f.name;
  }
  if (!password.value) return (lockError.value = m['error.noPassword']);
  locking.value = true;
  try {
    locked.value = { bytes: await lock(payload, password.value), name: `${name}.toolland` };
  } catch (e) {
    lockError.value = errorText(e);
  } finally {
    locking.value = false;
  }
}

function downloadLocked() {
  if (!locked.value) return;
  const blob = new Blob([locked.value.bytes as Uint8Array<ArrayBuffer>], {
    type: 'application/octet-stream',
  });
  downloadBlob(blob, locked.value.name);
}

// --- Buka ---
const codeIn = ref('');
const lockedFile = ref<{ name: string; bytes: Uint8Array } | null>(null);
const unlockPassword = ref('');
const unlocking = ref(false);
const unlockError = ref('');
const opened = ref<Payload | null>(null);

watch([codeIn, lockedFile, unlockPassword], () => {
  opened.value = null;
  unlockError.value = '';
});

async function pickLocked(files: File[]) {
  const f = files[0];
  if (!f) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (!isLocked(bytes)) {
    lockedFile.value = null;
    unlockError.value = m['error.format'];
    return;
  }
  lockedFile.value = { name: f.name, bytes };
  codeIn.value = '';
}

async function runUnlock() {
  unlockError.value = '';
  let bytes: Uint8Array | null;
  if (codeIn.value.trim()) {
    bytes = fromCode(codeIn.value);
    if (!bytes) return (unlockError.value = m['error.format']);
  } else if (lockedFile.value) {
    bytes = lockedFile.value.bytes;
  } else {
    return (unlockError.value = m['error.noCode']);
  }
  if (!unlockPassword.value) return (unlockError.value = m['error.noPassword']);
  unlocking.value = true;
  try {
    opened.value = await unlock(bytes, unlockPassword.value);
  } catch (e) {
    unlockError.value = errorText(e);
  } finally {
    unlocking.value = false;
  }
}

function downloadOpened() {
  const o = opened.value;
  if (o?.type !== 'file') return;
  downloadBlob(new Blob([o.data as Uint8Array<ArrayBuffer>], { type: o.mime }), o.name);
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex gap-2" role="group">
      <button
        v-for="opt in ['lock', 'unlock'] as const"
        :key="opt"
        type="button"
        class="btn btn-secondary"
        :class="{ 'btn-active': mode === opt }"
        :aria-pressed="mode === opt"
        :data-tab="opt"
        @click="mode = opt"
      >
        {{ m[opt] }}
      </button>
    </div>

    <!-- Kunci -->
    <div v-if="mode === 'lock'" class="space-y-4">
      <div class="flex gap-2" role="group">
        <button
          v-for="opt in ['text', 'file'] as const"
          :key="opt"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': source === opt }"
          :aria-pressed="source === opt"
          :data-source="opt"
          @click="source = opt"
        >
          {{ m[opt] }}
        </button>
      </div>

      <div v-if="source === 'text'">
        <label for="lb-text" class="label">{{ m.textLabel }}</label>
        <textarea
          id="lb-text"
          v-model="text"
          class="field h-36"
          :placeholder="m.textPlaceholder"
          spellcheck="false"
        />
      </div>
      <div v-else>
        <div v-if="file" class="card flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 truncate text-sm font-semibold">
            {{ file.name }}
            <span class="font-normal text-ink-3">· {{ formatBytes(file.size) }}</span>
          </p>
          <button type="button" class="btn btn-secondary" @click="file = null">
            {{ m.fileChange }}
          </button>
        </div>
        <Dropzone
          v-else
          :messages="dropzone"
          :multiple="false"
          :max-size="MAX_FILE_SIZE"
          @files="(f) => (file = f[0] ?? null)"
        />
      </div>

      <div>
        <label for="lb-pw" class="label">{{ m.password }}</label>
        <div class="flex flex-wrap gap-2">
          <input
            id="lb-pw"
            v-model="password"
            class="field min-w-0 flex-1 font-mono"
            autocomplete="off"
            spellcheck="false"
            @input="showWeak = true"
          />
          <button type="button" class="btn btn-secondary" @click="regenerate">
            <IconRefresh aria-hidden="true" />
            {{ m.regenerate }}
          </button>
          <CopyButton :text="password" :label="m.copy" :copied-label="m.copied" />
        </div>
        <p class="mt-1 text-sm text-ink-3">{{ m.passwordHint }}</p>
        <p v-if="weak" class="mt-1 text-sm font-semibold text-ink">⚠ {{ m.weak }}</p>
      </div>

      <button type="button" class="btn btn-primary" :disabled="locking" @click="runLock">
        {{ locking ? m.locking : m.run }}
      </button>
      <p v-if="lockError" role="alert" class="error-text">{{ lockError }}</p>

      <section v-if="locked" class="card space-y-3" aria-live="polite">
        <template v-if="code">
          <label for="lb-code" class="label">{{ m.code }}</label>
          <textarea
            id="lb-code"
            :value="code"
            readonly
            class="field h-32 font-mono text-xs break-all"
            @focus="($event.target as HTMLTextAreaElement).select()"
          />
          <p class="text-sm text-ink-2">{{ fill(m.codeInfo, { chars: lockedChars }) }}</p>
        </template>
        <p v-else class="text-sm text-ink-2">{{ fill(m.tooLong, { chars: lockedChars }) }}</p>
        <div class="flex flex-wrap gap-2">
          <CopyButton v-if="code" :text="code" :label="m.copy" :copied-label="m.copied" />
          <button
            type="button"
            :class="code ? 'btn btn-secondary' : 'btn btn-primary'"
            @click="downloadLocked"
          >
            {{ m.downloadFile }}
          </button>
        </div>
        <p class="text-sm text-ink-3">
          {{ fill(m.fileReady, { name: locked.name, size: formatBytes(locked.bytes.length) }) }}
        </p>
        <p class="border-l-2 border-ink pl-3 text-sm font-semibold">{{ m.warning }}</p>
      </section>
    </div>

    <!-- Buka -->
    <div v-else class="space-y-4">
      <div>
        <label for="lb-in" class="label">{{ m.codeLabel }}</label>
        <textarea
          id="lb-in"
          v-model="codeIn"
          class="field h-32 font-mono text-xs break-all"
          :placeholder="m.codePlaceholder"
          spellcheck="false"
          @input="lockedFile = null"
        />
      </div>
      <div>
        <p class="label">{{ m.or }}</p>
        <div v-if="lockedFile" class="card flex flex-wrap items-center justify-between gap-2">
          <p class="min-w-0 truncate text-sm font-semibold">
            {{ lockedFile.name }}
            <span class="font-normal text-ink-3">· {{ formatBytes(lockedFile.bytes.length) }}</span>
          </p>
          <button type="button" class="btn btn-secondary" @click="lockedFile = null">
            {{ m.fileChange }}
          </button>
        </div>
        <Dropzone
          v-else
          :messages="{ ...dropzone, hint: m.dropHint }"
          :multiple="false"
          :paste="false"
          @files="pickLocked"
        />
      </div>
      <div>
        <label for="lb-unpw" class="label">{{ m.password }}</label>
        <input
          id="lb-unpw"
          v-model="unlockPassword"
          class="field font-mono"
          autocomplete="off"
          spellcheck="false"
          @keydown.enter="runUnlock"
        />
      </div>
      <button type="button" class="btn btn-primary" :disabled="unlocking" @click="runUnlock">
        {{ unlocking ? m.unlocking : m.unlockRun }}
      </button>
      <p v-if="unlockError" role="alert" class="error-text">{{ unlockError }}</p>

      <section v-if="opened" class="card space-y-3" aria-live="polite">
        <template v-if="opened.type === 'text'">
          <label for="lb-out" class="label">{{ m.resultText }}</label>
          <textarea id="lb-out" :value="opened.text" readonly class="field h-36" />
          <CopyButton :text="opened.text" :label="m.copy" :copied-label="m.copied" />
        </template>
        <template v-else>
          <p class="text-sm font-semibold">
            {{ fill(m.resultFile, { name: opened.name, size: formatBytes(opened.data.length) }) }}
          </p>
          <button type="button" class="btn btn-primary" @click="downloadOpened">
            {{ m.download }}
          </button>
        </template>
      </section>
    </div>
  </div>
</template>
