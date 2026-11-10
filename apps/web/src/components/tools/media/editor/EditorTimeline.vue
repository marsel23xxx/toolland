<script setup lang="ts">
/**
 * Timeline editor video: penggaris waktu, jalur klip (lebar sesuai durasi, bisa digeser untuk
 * mengubah urutan), jalur teks, jalur musik, dan playhead. Klik di penggaris = pindah waktu.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { formatTime } from '../../../../lib/media/ffmpeg';
import {
  type Project,
  clipLength,
  clipStarts,
  mediaOf,
  totalDuration,
} from '../../../../lib/editor/project';

const props = defineProps<{
  project: Project;
  time: number;
  selectedClip: string;
  selectedText: string;
  thumbs: Map<string, string>;
  missing: Set<string>;
  labels: { clips: string; texts: string; music: string; zoom: string; dragHint: string };
}>();
const emit = defineEmits<{
  seek: [t: number];
  selectClip: [id: string];
  selectText: [id: string];
  move: [from: number, to: number];
}>();

const scroller = ref<HTMLDivElement>();
const width = ref(800);
const zoom = ref(1);
const total = computed(() => Math.max(1, totalDuration(props.project)));
/** Piksel per detik: muat seluruh timeline di layar pada zoom 1. */
const pps = computed(() => Math.max(6, (width.value - 24) / total.value) * zoom.value);
const starts = computed(() => clipStarts(props.project));
const px = (t: number) => `${Math.round(t * pps.value)}px`;

const ticks = computed(() => {
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s * pps.value >= 70) ?? 600;
  const out: number[] = [];
  for (let t = 0; t <= total.value + 0.001; t += step) out.push(t);
  return out;
});

function seekFrom(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  const x = e.clientX - el.getBoundingClientRect().left;
  emit('seek', Math.max(0, Math.min(totalDuration(props.project), x / pps.value)));
}

// Geser klip untuk mengubah urutan (drag and drop HTML).
let dragFrom = -1;
const dropAt = ref(-1);
function onDragStart(i: number, e: DragEvent) {
  dragFrom = i;
  e.dataTransfer?.setData('text/plain', String(i));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}
function onDrop(i: number) {
  if (dragFrom >= 0 && dragFrom !== i) emit('move', dragFrom, i);
  dragFrom = -1;
  dropAt.value = -1;
}

let ro: ResizeObserver | undefined;
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = e.contentRect.width));
  if (scroller.value) ro.observe(scroller.value);
});
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <div class="rounded-md border border-rule bg-paper-2">
    <div
      class="flex items-center justify-between gap-3 border-b border-rule px-3 py-1.5 text-xs text-ink-3"
    >
      <span>{{ labels.dragHint }}</span>
      <label class="flex items-center gap-2">
        {{ labels.zoom }}
        <input
          v-model.number="zoom"
          type="range"
          min="1"
          max="8"
          step="0.5"
          class="w-28 accent-brand-600"
        />
      </label>
    </div>
    <div ref="scroller" class="relative overflow-x-auto px-3 pb-3">
      <div class="relative" :style="{ width: `${Math.round(total * pps) + 2}px` }">
        <!-- Penggaris waktu -->
        <div class="relative h-6 cursor-pointer select-none" data-ruler @click="seekFrom">
          <span
            v-for="t in ticks"
            :key="t"
            class="absolute top-1 border-l border-rule pl-1 font-mono text-[10px] text-ink-3"
            :style="{ left: px(t) }"
          >
            {{ formatTime(t) }}
          </span>
        </div>
        <!-- Klip -->
        <p class="sr-only">{{ labels.clips }}</p>
        <div class="flex h-16" data-track="clips">
          <button
            v-for="(c, i) in project.clips"
            :key="c.id"
            type="button"
            draggable="true"
            class="group relative h-full shrink-0 overflow-hidden rounded border-2 bg-ink/80 bg-cover bg-center text-left text-[10px] text-white"
            :class="[
              c.id === selectedClip
                ? 'border-brand-500 ring-2 ring-brand-500/40'
                : 'border-paper-2',
              dropAt === i ? 'outline outline-2 outline-offset-1 outline-kunyit' : '',
              missing.has(c.mediaId) ? 'bg-secang/70' : '',
            ]"
            :style="{
              width: px(clipLength(c)),
              backgroundImage: thumbs.get(c.mediaId) ? `url(${thumbs.get(c.mediaId)})` : undefined,
            }"
            :title="mediaOf(project, c.mediaId)?.name"
            :data-clip="c.id"
            @click="(emit('selectClip', c.id), emit('seek', starts[i] + 0.001))"
            @dragstart="onDragStart(i, $event)"
            @dragover.prevent="dropAt = i"
            @dragleave="dropAt = -1"
            @drop.prevent="onDrop(i)"
          >
            <span
              v-if="c.trans !== 'none' && i < project.clips.length - 1"
              class="absolute top-0.5 right-0.5 rounded px-1 text-[10px] leading-4 font-bold"
              :class="c.trans === 'white' ? 'bg-white text-ink' : 'bg-black text-white'"
              :title="c.trans"
              data-trans-mark
            >
              ⇢
            </span>
            <span class="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5">
              {{ formatTime(clipLength(c)) }} · {{ mediaOf(project, c.mediaId)?.name }}
            </span>
          </button>
        </div>
        <!-- Teks -->
        <div class="relative mt-1 h-6" data-track="texts">
          <span class="sr-only">{{ labels.texts }}</span>
          <button
            v-for="t in project.texts"
            :key="t.id"
            type="button"
            class="absolute top-0 h-full truncate rounded border px-1 text-left text-[10px]"
            :class="
              t.id === selectedText
                ? 'border-nila bg-nila text-white'
                : 'border-nila/40 bg-nila/15 text-nila dark:text-[#94aee6]'
            "
            :style="{ left: px(t.start), width: px(Math.max(0.3, t.end - t.start)) }"
            @click="(emit('selectText', t.id), emit('seek', t.start))"
          >
            T · {{ t.text || '…' }}
          </button>
        </div>
        <!-- Musik -->
        <div class="relative mt-1 h-5" data-track="music">
          <span
            v-if="project.music"
            class="absolute inset-y-0 left-0 truncate rounded border border-daun/40 bg-daun/15 px-1 text-[10px] leading-5 text-daun dark:text-[#93c584]"
            :style="{ width: px(totalDuration(project)) }"
          >
            ♪ {{ labels.music }} · {{ mediaOf(project, project.music.mediaId)?.name }}
          </span>
        </div>
        <!-- Playhead -->
        <div
          class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-secang"
          :style="{ left: px(time) }"
        >
          <span class="absolute -top-0.5 -left-1.5 size-3.5 rotate-45 bg-secang"></span>
        </div>
      </div>
    </div>
  </div>
</template>
