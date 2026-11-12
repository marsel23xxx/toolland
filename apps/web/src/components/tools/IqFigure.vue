<script setup lang="ts">
/** Menggambar satu gambar soal tes IQ (data Figure dari lib/iq) sebagai SVG. */
import { computed, useId } from 'vue';
import { SEGMENTS, shapePoints, type Figure } from '../../lib/iq';

const props = defineProps<{ fig: Figure }>();

// ID unik per gambar untuk pola arsir (isian bergaris).
const pid = `iqh-${useId().replace(/[^\w-]/g, '-')}`;

const items = computed(() =>
  props.fig.items.map((it) => ({
    it,
    pts:
      it.shape === 'circle' || it.shape === 'dot'
        ? ''
        : shapePoints(it)
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(' '),
    fill: it.fill === 'solid' ? 'currentColor' : it.fill === 'lines' ? `url(#${pid})` : 'none',
  })),
);
const segs = computed(() => SEGMENTS.filter((_, i) => ((props.fig.segs ?? 0) >> i) & 1));
</script>

<template>
  <svg viewBox="0 0 100 100" class="h-full w-full" aria-hidden="true">
    <defs>
      <pattern
        :id="pid"
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" stroke-width="2.2" />
      </pattern>
    </defs>
    <line
      v-for="(s, i) in segs"
      :key="`s${i}`"
      :x1="s[0]"
      :y1="s[1]"
      :x2="s[2]"
      :y2="s[3]"
      stroke="currentColor"
      stroke-width="4.5"
      stroke-linecap="round"
    />
    <template v-for="(d, i) in items" :key="i">
      <circle
        v-if="d.it.shape === 'circle' || d.it.shape === 'dot'"
        :cx="d.it.x"
        :cy="d.it.y"
        :r="d.it.r"
        :fill="d.fill"
        stroke="currentColor"
        :stroke-width="d.it.shape === 'dot' ? 0 : 3"
      />
      <polygon
        v-else
        :points="d.pts"
        :fill="d.fill"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>
