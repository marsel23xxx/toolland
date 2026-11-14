<script setup lang="ts">
/**
 * Kunci PDF (password AES-256 + pembatasan izin) dan Buka Kunci PDF (dengan password yang
 * diketahui pengguna, atau hapus pembatasan izin). qpdf WASM di worker; tidak ada yang diunggah.
 */
import { computed, ref, shallowRef } from 'vue';
import IconEye from '~icons/lucide/eye';
import IconEyeOff from '~icons/lucide/eye-off';
import type { Messages } from '../../../i18n';
import { formatBytes } from '../../../lib/format';
import { fileName } from '../../../lib/names';
import { PDF_ACCEPT } from '../../../lib/pdf/client';
import type { LockState } from '../../../lib/pdf/protect';
import { qpdfErrorCode, qpdfWorker } from '../../../lib/pdf/qpdf-client';
import { useFileResults, withSuffix } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';
import ProgressBar from '../../ui/ProgressBar.vue';

const props = defineProps<{
  mode: 'lock' | 'unlock';
  t: Messages<'pdf'>;
  p: Messages<'protect'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();

const file = shallowRef<File | null>(null);
const state = ref<LockState | null>(null);
const password = ref('');
const confirm = ref('');
const show = ref(false);
const noPrint = ref(false);
const noCopy = ref(false);
const noModify = ref(false);
const busy = ref(false);
const error = ref('');
const results = useFileResults();
let loadId = 0;

async function load(list: File[]) {
  const id = ++loadId;
  file.value = list[0] ?? null;
  state.value = null;
  error.value = '';
  password.value = confirm.value = '';
  results.clear();
  if (!file.value) return;
  busy.value = true;
  try {
    const s = await (await qpdfWorker()).inspect(await file.value.arrayBuffer());
    if (id === loadId) state.value = s;
  } catch (e) {
    if (id === loadId) error.value = props.p[`error.${qpdfErrorCode(e)}`];
  } finally {
    if (id === loadId) busy.value = false;
  }
}

const mismatch = computed(() => !!confirm.value && confirm.value !== password.value);
const weak = computed(() => !!password.value && password.value.length < 8);
const canLock = computed(
  () => !!password.value && password.value === confirm.value && state.value?.kind !== 'password',
);
const restrictedList = computed(() => {
  const s = state.value;
  if (s?.kind !== 'restricted') return '';
  const parts = [s.print && props.p.print, s.copy && props.p.copy, s.modify && props.p.modify];
  return parts.filter(Boolean).join(', ');
});

async function run() {
  if (!file.value || busy.value) return;
  error.value = '';
  busy.value = true;
  results.clear();
  try {
    const w = await qpdfWorker();
    const data = await file.value.arrayBuffer();
    const bytes =
      props.mode === 'lock'
        ? await w.lock(data, {
            password: password.value,
            noPrint: noPrint.value,
            noCopy: noCopy.value,
            noModify: noModify.value,
          })
        : await w.unlock(data, state.value?.kind === 'password' ? password.value : '');
    results.add(
      withSuffix(file.value.name, fileName(props.mode === 'lock' ? 'locked' : 'unlocked'), '.pdf'),
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      formatBytes(bytes.length),
    );
  } catch (e) {
    error.value = props.p[`error.${qpdfErrorCode(e)}`];
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <Dropzone
      v-if="!file"
      :messages="dropzone"
      :accept="PDF_ACCEPT"
      :multiple="false"
      @files="load"
      @prefetch="qpdfWorker()"
    />
    <template v-else>
      <div class="card flex flex-wrap items-center justify-between gap-2 p-3">
        <p class="min-w-0 truncate text-sm">
          <span class="font-semibold">{{ file.name }}</span>
          <span class="text-slate-600 dark:text-slate-400"> · {{ formatBytes(file.size) }}</span>
        </p>
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="load([])">
          {{ t['split.change'] }}
        </button>
      </div>

      <!-- Status kunci file yang dipilih -->
      <p
        v-if="state"
        class="text-sm"
        :class="
          state.kind === 'none' && mode === 'unlock'
            ? 'text-slate-600 dark:text-slate-400'
            : state.kind === 'password' && mode === 'lock'
              ? 'text-amber-700 dark:text-amber-400'
              : ''
        "
        :data-lock-state="state.kind"
      >
        <template v-if="state.kind === 'none'">{{
          mode === 'unlock' ? p.notLocked : p.readyToLock
        }}</template>
        <template v-else-if="state.kind === 'restricted'">{{
          p.restricted.replace('{list}', restrictedList)
        }}</template>
        <template v-else>
          {{ mode === 'unlock' ? p.needsPassword : p.alreadyLocked }}
          <a v-if="mode === 'lock'" :href="p.unlockHref" class="underline">{{ p.unlockLink }}</a>
        </template>
      </p>

      <!-- Password: wajib untuk mengunci; untuk membuka hanya bila PDF butuh password -->
      <form
        v-if="state && (mode === 'lock' ? state.kind !== 'password' : state.kind !== 'none')"
        class="space-y-4"
        @submit.prevent="run"
      >
        <div
          v-if="mode === 'lock' || state.kind === 'password'"
          class="grid max-w-xl gap-3 sm:grid-cols-2"
        >
          <div>
            <label for="pp-pw" class="label">{{
              mode === 'lock' ? p.newPassword : p.password
            }}</label>
            <div class="relative">
              <input
                id="pp-pw"
                v-model="password"
                :type="show ? 'text' : 'password'"
                class="field pr-10"
                :autocomplete="mode === 'lock' ? 'new-password' : 'current-password'"
                spellcheck="false"
                required
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500"
                :aria-label="show ? p.hide : p.show"
                :aria-pressed="show"
                @click="show = !show"
              >
                <component :is="show ? IconEyeOff : IconEye" class="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div v-if="mode === 'lock'">
            <label for="pp-pw2" class="label">{{ p.confirm }}</label>
            <input
              id="pp-pw2"
              v-model="confirm"
              :type="show ? 'text' : 'password'"
              class="field"
              autocomplete="new-password"
              spellcheck="false"
              required
            />
          </div>
        </div>
        <p v-if="mode === 'lock' && mismatch" class="error-text" data-pp-mismatch>
          {{ p.mismatch }}
        </p>
        <p v-else-if="mode === 'lock' && weak" class="text-sm text-amber-700 dark:text-amber-400">
          {{ p.weak }}
        </p>

        <fieldset v-if="mode === 'lock'">
          <legend class="label">{{ p.restrict }}</legend>
          <div class="flex flex-wrap gap-x-6 gap-y-2">
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="noPrint"
                type="checkbox"
                class="size-4 accent-brand-600"
                data-pp-noprint
              />
              {{ p.noPrint }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="noCopy"
                type="checkbox"
                class="size-4 accent-brand-600"
                data-pp-nocopy
              />
              {{ p.noCopy }}
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="noModify" type="checkbox" class="size-4 accent-brand-600" />
              {{ p.noModify }}
            </label>
          </div>
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ p.restrictHint }}</p>
        </fieldset>

        <button
          type="submit"
          class="btn btn-primary"
          :disabled="busy || (mode === 'lock' ? !canLock : state.kind === 'password' && !password)"
          data-pp-run
        >
          {{
            mode === 'lock'
              ? p.lockRun
              : state.kind === 'restricted'
                ? p.removeRestrictions
                : p.unlockRun
          }}
        </button>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ mode === 'lock' ? p.lockNote : p.unlockNote }}
        </p>
      </form>
    </template>

    <p v-if="error" class="error-text" aria-live="polite">{{ error }}</p>
    <ProgressBar v-if="busy" :label="files.processing" />
    <FileResults
      :items="results.items.value"
      :m="files"
      :donate="donate"
      @remove="results.remove"
    />
  </div>
</template>
