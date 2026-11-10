<script setup lang="ts">
/** Bagian panel yang bisa dilipat (details/summary asli, aksesibel tanpa JavaScript tambahan). */
withDefaults(defineProps<{ title: string; open?: boolean }>(), { open: true });
</script>

<template>
  <details class="group border-t border-rule pt-2 first:border-t-0 first:pt-0" :open="open">
    <summary
      class="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold tracking-wide text-ink-2 uppercase select-none hover:text-ink"
    >
      {{ title }}
      <span class="text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true"
        >▾</span
      >
    </summary>
    <div class="space-y-3 pt-2 pb-1">
      <slot />
    </div>
  </details>
</template>
