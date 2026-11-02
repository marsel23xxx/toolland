<script setup lang="ts">
/**
 * Tool contoh untuk Fase 0: merangkai Dropzone + ProgressBar dengan progress tiruan.
 * Tidak memproses file sama sekali. Dipakai untuk uji Lighthouse halaman contoh.
 */
import { onBeforeUnmount, ref } from 'vue';
import type { Locale } from '../../lib/format';
import Dropzone, { type DropzoneMessages } from '../ui/Dropzone.vue';
import ProgressBar from '../ui/ProgressBar.vue';

defineProps<{ messages: DropzoneMessages; locale?: Locale }>();

interface Item {
  id: number;
  name: string;
  value: number;
}

const items = ref<Item[]>([]);
const timers = new Set<number>();
let nextId = 0;

function start(files: File[]) {
  for (const file of files) {
    items.value.push({ id: nextId++, name: file.name, value: 0 });
    const entry = items.value[items.value.length - 1];
    const timer = window.setInterval(() => {
      entry.value = Math.min(100, entry.value + 10);
      if (entry.value >= 100) {
        window.clearInterval(timer);
        timers.delete(timer);
      }
    }, 150);
    timers.add(timer);
  }
}

onBeforeUnmount(() => timers.forEach((t) => window.clearInterval(t)));
</script>

<template>
  <div class="space-y-4">
    <Dropzone :messages="messages" :locale="locale" :max-size="15 * 1024 * 1024" @files="start" />
    <ul v-if="items.length" class="space-y-3">
      <li v-for="item in items" :key="item.id">
        <ProgressBar :label="item.name" :value="item.value" />
      </li>
    </ul>
  </div>
</template>
