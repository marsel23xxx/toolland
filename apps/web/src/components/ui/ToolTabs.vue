<script setup lang="ts">
/** Tab sederhana untuk halaman yang menggabungkan beberapa alat. */
import { ref } from 'vue';

const props = defineProps<{ tabs: { id: string; label: string }[]; label: string }>();
const active = ref(props.tabs[0].id);

function onKey(e: KeyboardEvent, i: number) {
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!dir) return;
  e.preventDefault();
  const next = props.tabs[(i + dir + props.tabs.length) % props.tabs.length];
  active.value = next.id;
  (e.currentTarget as HTMLElement).parentElement
    ?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)
    ?.focus();
}
</script>

<template>
  <div class="space-y-5">
    <div role="tablist" :aria-label="label" class="tabs">
      <button
        v-for="(t, i) in tabs"
        :key="t.id"
        type="button"
        role="tab"
        class="tab"
        :data-tab="t.id"
        :aria-selected="active === t.id"
        :tabindex="active === t.id ? 0 : -1"
        @click="active = t.id"
        @keydown="onKey($event, i)"
      >
        {{ t.label }}
      </button>
    </div>
    <div role="tabpanel">
      <slot :active="active" />
    </div>
  </div>
</template>
