<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Messages } from '../../i18n';
import { fill, formatBytes } from '../../lib/format';
import CopyButton from '../ui/CopyButton.vue';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';

const props = defineProps<{
  m: Messages<'image'>;
  dropzone: DropzoneMessages;
  t: Messages<'base64img'> & Messages<'common'>;
}>();

type Output = 'dataUrl' | 'raw' | 'css' | 'html';
interface Item {
  id: number;
  name: string;
  size: number;
  dataUrl: string;
  url: string;
}
const output = ref<Output>('dataUrl');
const items = ref<Item[]>([]);
let nextId = 0;
const PREVIEW_LIMIT = 200_000;

function read(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function add(files: File[]) {
  for (const f of files) {
    items.value.push({
      id: nextId++,
      name: f.name,
      size: f.size,
      dataUrl: await read(f),
      url: URL.createObjectURL(f),
    });
  }
}

function remove(id: number) {
  const item = items.value.find((i) => i.id === id);
  if (item) URL.revokeObjectURL(item.url);
  items.value = items.value.filter((i) => i.id !== id);
}

function format(item: Item): string {
  switch (output.value) {
    case 'raw':
      return item.dataUrl.slice(item.dataUrl.indexOf(',') + 1);
    case 'css':
      return `background-image: url("${item.dataUrl}");`;
    case 'html':
      return `<img src="${item.dataUrl}" alt="${item.name.replace(/"/g, '&quot;')}" />`;
    default:
      return item.dataUrl;
  }
}

const rendered = computed(() =>
  items.value.map((i) => {
    const text = format(i);
    return {
      ...i,
      text,
      preview: text.length > PREVIEW_LIMIT ? text.slice(0, PREVIEW_LIMIT) + '…' : text,
    };
  }),
);
const labels = computed<Record<Output, string>>(() => ({
  dataUrl: props.t.dataUrl,
  raw: props.t.raw,
  css: props.t.css,
  html: props.t.html,
}));
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="dropzone" accept="image/*" :max-size="10 * 1024 * 1024" @files="add" />

    <fieldset>
      <legend class="label">{{ t.output }}</legend>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="o in ['dataUrl', 'raw', 'css', 'html'] as const"
          :key="o"
          type="button"
          class="btn btn-secondary"
          :class="{ 'btn-active': output === o }"
          :aria-pressed="output === o"
          @click="output = o"
        >
          {{ labels[o] }}
        </button>
      </div>
    </fieldset>

    <ul class="space-y-3">
      <li v-for="item in rendered" :key="item.id" class="card space-y-2">
        <div class="flex items-center gap-3">
          <img :src="item.url" alt="" class="size-12 shrink-0 rounded object-cover" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ item.name }}</p>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              {{ formatBytes(item.size) }} →
              {{ fill(t.sizeNote, { size: formatBytes(item.text.length) }) }}
            </p>
          </div>
          <CopyButton :text="item.text" :label="t.copy" :copied-label="t.copied" />
          <button type="button" class="btn btn-secondary" @click="remove(item.id)">
            {{ t.clear }}
          </button>
        </div>
        <textarea
          :value="item.preview"
          readonly
          class="field h-28 font-mono text-xs break-all"
          :aria-label="item.name"
          spellcheck="false"
        />
        <p
          v-if="item.preview.length < item.text.length"
          class="text-xs text-slate-600 dark:text-slate-400"
        >
          {{ t.truncated }}
        </p>
      </li>
    </ul>
  </div>
</template>
