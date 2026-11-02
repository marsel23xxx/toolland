<script setup lang="ts">
/**
 * Area pilih file: drag and drop, klik/keyboard (input file asli), dan paste dari clipboard.
 * File divalidasi (tipe dan ukuran) lalu dikirim lewat event `files`.
 * Event `prefetch` dipancarkan sekali saat kursor/fokus masuk, untuk mulai memuat WASM.
 */
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import IconUpload from '~icons/lucide/upload';
import { fill, formatBytes, type Locale } from '../../lib/format';

export interface DropzoneMessages {
  title: string;
  hint: string;
  /** Template dengan {size}. */
  maxSize: string;
  /** Template dengan {name}. */
  errorType: string;
  /** Template dengan {name} dan {size}. */
  errorSize: string;
}

const props = withDefaults(
  defineProps<{
    messages: DropzoneMessages;
    /** Sama seperti atribut accept di input file, misalnya "image/*,.heic". */
    accept?: string;
    multiple?: boolean;
    /** Batas ukuran per file dalam byte. */
    maxSize?: number;
    /** Terima file dari Ctrl+V di mana saja pada halaman. */
    paste?: boolean;
    disabled?: boolean;
    locale?: Locale;
  }>(),
  { accept: '', multiple: true, maxSize: undefined, paste: true, disabled: false, locale: 'id' },
);

const emit = defineEmits<{
  files: [files: File[]];
  rejected: [errors: string[]];
  prefetch: [];
}>();

const id = useId();
const input = ref<HTMLInputElement>();
const dragging = ref(false);
const errors = ref<string[]>([]);
let dragDepth = 0;
let prefetched = false;

function matchesAccept(file: File): boolean {
  if (!props.accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return props.accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
}

function handle(list: FileList | File[] | null | undefined) {
  if (props.disabled || !list) return;
  let files = Array.from(list);
  if (files.length === 0) return;
  if (!props.multiple) files = files.slice(0, 1);

  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!matchesAccept(file)) {
      rejected.push(fill(props.messages.errorType, { name: file.name }));
    } else if (props.maxSize !== undefined && file.size > props.maxSize) {
      rejected.push(
        fill(props.messages.errorSize, {
          name: file.name,
          size: formatBytes(props.maxSize, props.locale),
        }),
      );
    } else {
      accepted.push(file);
    }
  }

  errors.value = rejected;
  if (rejected.length) emit('rejected', rejected);
  if (accepted.length) emit('files', accepted);
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  handle(target.files);
  target.value = ''; // agar file yang sama bisa dipilih lagi
}

function onDragEnter() {
  dragDepth++;
  dragging.value = true;
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dragging.value = false;
}

function onDrop(event: DragEvent) {
  dragDepth = 0;
  dragging.value = false;
  handle(event.dataTransfer?.files);
}

function onPaste(event: ClipboardEvent) {
  if (!props.paste || props.disabled) return;
  const files = event.clipboardData?.files;
  if (files && files.length > 0) {
    event.preventDefault();
    handle(files);
  }
}

function onIntent() {
  if (prefetched) return;
  prefetched = true;
  emit('prefetch');
}

onMounted(() => window.addEventListener('paste', onPaste));
onBeforeUnmount(() => window.removeEventListener('paste', onPaste));

defineExpose({ open: () => input.value?.click() });
</script>

<template>
  <div>
    <div
      class="relative rounded-2xl border-2 border-dashed transition-colors focus-within:border-brand-600 dark:focus-within:border-brand-400"
      :class="[
        dragging
          ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30'
          : 'border-slate-300 bg-slate-50 hover:border-brand-500 dark:border-slate-700 dark:bg-slate-900',
        disabled ? 'pointer-events-none opacity-60' : '',
      ]"
      data-testid="dropzone"
      @pointerenter="onIntent"
      @focusin="onIntent"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <input
        :id="id"
        ref="input"
        type="file"
        class="peer sr-only"
        :accept="accept || undefined"
        :multiple="multiple"
        :disabled="disabled"
        :aria-describedby="`${id}-hint`"
        @change="onChange"
      />
      <label
        :for="id"
        class="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 px-4 py-8 text-center"
      >
        <IconUpload class="size-8 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <span class="text-base font-semibold">{{ messages.title }}</span>
        <span :id="`${id}-hint`" class="text-sm text-slate-600 dark:text-slate-400">
          {{ messages.hint }}
          <template v-if="maxSize !== undefined">
            · {{ fill(messages.maxSize, { size: formatBytes(maxSize, locale) }) }}
          </template>
        </span>
      </label>
    </div>

    <ul
      v-if="errors.length"
      class="mt-3 space-y-1 text-sm text-red-700 dark:text-red-400"
      aria-live="polite"
      data-testid="dropzone-errors"
    >
      <li v-for="error in errors" :key="error">{{ error }}</li>
    </ul>
  </div>
</template>
