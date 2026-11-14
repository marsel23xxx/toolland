<script setup lang="ts">
/** Satu kotak peserta Rapat Video: video (atau inisial bila kamera mati), nama, dan status. */
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  stream: MediaStream | null;
  name: string;
  /** Kamera atau layar sedang dikirim. */
  video: boolean;
  mic: boolean;
  /** Video sendiri: dibisukan dan dicerminkan (kecuali berbagi layar). */
  self?: boolean;
  mirror?: boolean;
  badge?: string;
  note?: string;
}>();

const el = ref<HTMLVideoElement>();
function attach() {
  if (!el.value) return;
  if (el.value.srcObject !== props.stream) el.value.srcObject = props.stream;
  if (props.stream) void el.value.play().catch(() => undefined);
}
onMounted(attach);
watch(() => props.stream, attach);
// Track baru bisa masuk ke stream yang sama (audio dulu, video menyusul).
watch(
  () => props.video,
  () => attach(),
);

const initials = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
</script>

<template>
  <figure
    class="relative aspect-video overflow-hidden rounded-md border border-rule bg-[#1b1814]"
    data-meet-tile
  >
    <video
      ref="el"
      autoplay
      playsinline
      :muted="self"
      class="size-full object-cover"
      :class="[video ? '' : 'invisible', mirror ? '-scale-x-100' : '']"
    />
    <div v-if="!video" class="absolute inset-0 grid place-items-center">
      <span
        class="grid size-16 place-items-center rounded-full bg-brand-600 font-display text-2xl text-white sm:size-20"
        aria-hidden="true"
        >{{ initials(name) }}</span
      >
    </div>
    <figcaption
      class="absolute bottom-1.5 left-1.5 flex max-w-[calc(100%-0.75rem)] items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-xs text-white"
    >
      <span v-if="!mic" aria-hidden="true">🔇</span>
      <span class="truncate" data-meet-name>{{ name }}</span>
      <span v-if="badge" class="shrink-0 rounded bg-white/20 px-1">{{ badge }}</span>
    </figcaption>
    <p
      v-if="note"
      class="absolute inset-x-2 top-2 rounded bg-black/70 px-2 py-1 text-center text-xs text-white"
    >
      {{ note }}
    </p>
  </figure>
</template>
