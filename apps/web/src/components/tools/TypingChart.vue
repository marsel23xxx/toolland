<script setup lang="ts">
/**
 * Grafik KPM per detik untuk hasil tes mengetik dan game: garis KPM, garis rata-rata (KPM kotor),
 * tanda silang di detik yang ada salah ketik, tooltip saat disorot, dan tabel untuk pembaca layar.
 */
import { computed, ref } from 'vue';
import { fill } from '../../lib/format';
import type { SecondPoint } from '../../lib/typing';

const props = defineProps<{ series: SecondPoint[]; raw: number; m: Record<string, string> }>();

const CW = 560;
const CH = 170;
const PAD = { l: 36, r: 10, t: 12, b: 24 };
const hover = ref(-1);

const chart = computed(() => {
  const s = props.series;
  if (!s.length) return undefined;
  const w = CW - PAD.l - PAD.r;
  const h = CH - PAD.t - PAD.b;
  const maxY = Math.max(10, Math.ceil(Math.max(...s.map((p) => p.wpm)) / 20) * 20);
  const x = (i: number) => PAD.l + (s.length === 1 ? w / 2 : (i / (s.length - 1)) * w);
  const y = (v: number) => PAD.t + h - (v / maxY) * h;
  const pts = s.map((p, i) => ({ ...p, x: x(i), y: y(p.wpm) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${PAD.t + h} L${pts[0].x.toFixed(1)} ${PAD.t + h} Z`;
  const step = Math.max(1, Math.ceil(s.length / 7));
  return {
    pts,
    line,
    area,
    avgY: y(Math.min(maxY, props.raw)),
    grid: [0, maxY / 2, maxY].map((v) => ({ v, y: y(v) })),
    ticks: pts.filter((_, i) => i % step === 0 || i === s.length - 1),
    bottom: PAD.t + h,
  };
});
</script>

<template>
  <figure v-if="chart" class="rounded-md border border-rule bg-paper-2 p-4">
    <figcaption class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
      <span class="font-semibold">{{ m.chartTitle }}</span>
      <span class="inline-flex items-center gap-1.5"
        ><span class="h-0.5 w-5 rounded bg-brand-600 dark:bg-brand-400" />{{ m.wpm }}</span
      >
      <span class="inline-flex items-center gap-1.5"
        ><span class="w-5 border-t-2 border-dashed border-ink-3" />{{ m.chartAvg }}</span
      >
      <span class="inline-flex items-center gap-1 text-secang dark:text-[#e98a98]"
        ><span aria-hidden="true">✕</span>{{ m.errors }}</span
      >
    </figcaption>
    <div class="relative">
      <svg
        :viewBox="`0 0 ${CW} ${CH}`"
        class="h-auto w-full"
        role="img"
        :aria-label="m.chartTitle"
        @pointerleave="hover = -1"
      >
        <line
          v-for="g in chart.grid"
          :key="g.v"
          :x1="PAD.l"
          :x2="CW - PAD.r"
          :y1="g.y"
          :y2="g.y"
          class="stroke-rule"
          stroke-width="1"
        />
        <text
          v-for="g in chart.grid"
          :key="`t${g.v}`"
          :x="PAD.l - 6"
          :y="g.y + 3"
          text-anchor="end"
          class="fill-ink-3 text-[10px] tabular-nums"
        >
          {{ g.v }}
        </text>
        <text
          v-for="p in chart.ticks"
          :key="`x${p.sec}`"
          :x="p.x"
          :y="CH - 8"
          text-anchor="middle"
          class="fill-ink-3 text-[10px] tabular-nums"
        >
          {{ p.sec }}s
        </text>
        <path :d="chart.area" class="fill-brand-600/10 dark:fill-brand-400/10" />
        <line
          :x1="PAD.l"
          :x2="CW - PAD.r"
          :y1="chart.avgY"
          :y2="chart.avgY"
          class="stroke-ink-3"
          stroke-width="1.5"
          stroke-dasharray="5 4"
        />
        <path
          :d="chart.line"
          fill="none"
          class="stroke-brand-600 dark:stroke-brand-400"
          stroke-width="2.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <g
          v-for="p in chart.pts.filter((q) => q.errors > 0)"
          :key="`e${p.sec}`"
          class="stroke-secang dark:stroke-[#e98a98]"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y - 4" :y2="p.y + 4" />
          <line :x1="p.x - 4" :x2="p.x + 4" :y1="p.y + 4" :y2="p.y - 4" />
        </g>
        <circle
          v-if="hover >= 0 && chart.pts[hover]"
          :cx="chart.pts[hover].x"
          :cy="chart.pts[hover].y"
          r="5"
          class="fill-paper-2 stroke-brand-600 dark:stroke-brand-400"
          stroke-width="2.5"
        />
        <rect
          v-for="(p, i) in chart.pts"
          :key="`h${p.sec}`"
          :x="p.x - (CW - PAD.l - PAD.r) / chart.pts.length / 2"
          :y="PAD.t"
          :width="(CW - PAD.l - PAD.r) / chart.pts.length"
          :height="chart.bottom - PAD.t"
          fill="transparent"
          @pointerenter="hover = i"
        />
      </svg>
      <div
        v-if="hover >= 0 && chart.pts[hover]"
        class="pointer-events-none absolute -translate-x-1/2 rounded border border-rule bg-paper px-2 py-1 text-xs whitespace-nowrap shadow-sm tabular-nums"
        :style="{ left: `${(chart.pts[hover].x / CW) * 100}%`, top: '0px' }"
      >
        {{ fill(m.chartSecond, { n: chart.pts[hover].sec }) }} · {{ chart.pts[hover].wpm }}
        {{ m.wpm
        }}<template v-if="chart.pts[hover].errors"> · {{ chart.pts[hover].errors }} ✕</template>
      </div>
    </div>
    <table class="sr-only">
      <caption>
        {{
          m.chartTitle
        }}
      </caption>
      <thead>
        <tr>
          <th>{{ m.chartSecondHead }}</th>
          <th>{{ m.wpm }}</th>
          <th>{{ m.errors }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in series" :key="p.sec">
          <td>{{ p.sec }}</td>
          <td>{{ p.wpm }}</td>
          <td>{{ p.errors }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
