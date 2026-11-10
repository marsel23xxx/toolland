<script setup lang="ts">
/** Memutar satu audio tambahan (narasi/efek suara) selaras dengan jam utama pratinjau. */
import { computed, ref, watch } from 'vue';
import type { AudioItem } from '../../../../lib/editor/project';

const props = defineProps<{
  item: AudioItem;
  time: number;
  playing: boolean;
  url?: string;
  muted: boolean;
}>();

const el = ref<HTMLAudioElement>();
const len = computed(() => Math.max(0, props.item.out - props.item.in));
const off = computed(() => props.time - props.item.start);
const inRange = computed(() => off.value >= 0 && off.value < len.value);
const local = computed(() => props.item.in + Math.min(len.value, Math.max(0, off.value)));

function gain(): number {
  const a = props.item;
  let g = 1;
  if (a.fadeIn > 0) g = Math.min(g, off.value / a.fadeIn);
  if (a.fadeOut > 0) g = Math.min(g, (len.value - off.value) / a.fadeOut);
  return Math.max(0, Math.min(1, g));
}

function sync() {
  const a = el.value;
  if (!a || !props.url) return;
  if (a.dataset.src !== props.url) {
    a.dataset.src = props.url;
    a.src = props.url;
  }
  a.volume = Math.max(0, Math.min(1, props.item.volume * gain()));
  a.muted = props.muted;
  const drift = Math.abs(a.currentTime - local.value);
  if (props.playing && inRange.value) {
    if (drift > 0.25) a.currentTime = local.value;
    if (a.paused) a.play().catch(() => {});
  } else {
    if (!a.paused) a.pause();
    if (drift > 0.05) a.currentTime = local.value;
  }
}
watch(
  () => [local.value, props.playing, inRange.value, props.url, props.muted, props.item.volume],
  sync,
);
</script>

<template>
  <audio ref="el" preload="auto" @loadeddata="sync"></audio>
</template>
