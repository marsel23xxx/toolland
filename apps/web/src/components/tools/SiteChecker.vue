<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import IconAlert from '~icons/lucide/circle-alert';
import IconCheck from '~icons/lucide/circle-check';
import IconX from '~icons/lucide/circle-x';
import IconExternal from '~icons/lucide/external-link';
import IconInfo from '~icons/lucide/info';
import IconSearch from '~icons/lucide/scan-search';
import type { ToolMessages } from '../../i18n';
import { fill, LOCALE_TAGS, pageLocale } from '../../lib/format';
import {
  type Check,
  type CheckStatus,
  scanSite,
  score,
  securityChecks,
  SiteError,
  type SiteScan,
} from '../../lib/site-check';
import { CATEGORY_ORDER, detectTech } from '../../lib/tech-detect';
import { toDomain } from '../../lib/whois';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'sitecheck'>;
const msg = props.m;

const input = ref('');
const busy = ref(false);
const error = ref('');
const scan = ref<SiteScan | null>(null);
let ctrl: AbortController | undefined;

async function check() {
  const host = toDomain(input.value);
  error.value = '';
  if (!host) {
    error.value = m['error.invalid'];
    return;
  }
  ctrl?.abort();
  ctrl = new AbortController();
  busy.value = true;
  scan.value = null;
  try {
    scan.value = await scanSite(host, ctrl.signal);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    const code = e instanceof SiteError ? e.code : 'upstream';
    error.value = msg[`error.${code}`] ?? m['error.upstream'];
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => ctrl?.abort());

const checks = computed(() => (scan.value ? securityChecks(scan.value) : []));
const result = computed(() => score(checks.value));
const techs = computed(() => (scan.value ? detectTech(scan.value) : []));
const techGroups = computed(() =>
  CATEGORY_ORDER.map((cat) => ({ cat, items: techs.value.filter((t) => t.cat === cat) })).filter(
    (g) => g.items.length,
  ),
);

/** Urutan tampil: masalah dulu, lalu peringatan, aman, dan info. */
const RANK: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, info: 3 };
const sortedChecks = computed(() =>
  [...checks.value].sort((a, b) => RANK[a.status] - RANK[b.status]),
);

const text = (c: Check) => {
  const base = `check.${c.id}.${c.status}`;
  const raw = (c.variant && msg[`${base}.${c.variant}`]) || msg[base] || '';
  return fill(raw, c.data ?? {});
};
const title = (c: Check) => msg[`check.${c.id}`] ?? c.id;
const fix = (c: Check) => (c.status === 'pass' ? '' : (msg[`fix.${c.id}`] ?? ''));

const ICONS = { pass: IconCheck, warn: IconAlert, fail: IconX, info: IconInfo };
const TONE: Record<CheckStatus, string> = {
  pass: 'text-daun dark:text-[#93c584]',
  warn: 'text-kunyit dark:text-[#eab54d]',
  fail: 'text-secang dark:text-[#e98a98]',
  info: 'text-ink-3',
};
const gradeTone = computed(() =>
  ['A', 'B'].includes(result.value.grade)
    ? 'border-daun text-daun dark:text-[#93c584]'
    : result.value.grade === 'F'
      ? 'border-secang text-secang dark:text-[#e98a98]'
      : 'border-kunyit text-kunyit dark:text-[#eab54d]',
);
const counts = computed(() => {
  const c = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const x of checks.value) c[x.status]++;
  return c;
});

const locale = pageLocale();
const dateFmt = new Intl.DateTimeFormat(LOCALE_TAGS[locale], { dateStyle: 'long' });

const cert = computed(() => {
  const t = scan.value?.tls;
  const c = t?.cert;
  if (!t || !c) return null;
  const days =
    c.not_after === null ? null : Math.floor((c.not_after * 1000 - Date.now()) / 86_400_000);
  return {
    subject: c.subject ?? c.sans[0] ?? '—',
    issuer: c.issuer ?? '—',
    until: c.not_after === null ? '—' : dateFmt.format(new Date(c.not_after * 1000)),
    left: days === null ? '' : days < 0 ? m['cert.expired'] : fill(m['cert.daysLeft'], { n: days }),
    warn: days !== null && days <= 14,
    sans: c.sans.slice(0, 8),
    more: Math.max(0, c.sans.length - 8),
    version: t.version ?? '—',
  };
});

const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

const summary = computed(() => {
  const s = scan.value;
  if (!s) return '';
  const lines = [
    `${m.result}: ${s.host}`,
    `${m.finalUrl}: ${s.final_url} (HTTP ${s.status})`,
    `${m.grade}: ${result.value.grade} (${result.value.score}/100)`,
    '',
    `${m.security}:`,
    ...sortedChecks.value.map((c) => `- [${msg[`status.${c.status}`]}] ${title(c)}: ${text(c)}`),
    '',
    `${m.tech}: ${techs.value.map((t) => (t.version ? `${t.name} ${t.version}` : t.name)).join(', ') || '—'}`,
  ];
  return lines.join('\n');
});
</script>

<template>
  <div class="space-y-4">
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="check">
      <label for="sc-host" class="sr-only">{{ m.label }}</label>
      <input
        id="sc-host"
        v-model="input"
        type="text"
        inputmode="url"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        maxlength="300"
        class="field font-mono"
        :placeholder="m.placeholder"
        :aria-invalid="!!error"
        aria-describedby="sc-hint"
      />
      <button type="submit" class="btn btn-primary shrink-0" :disabled="busy || !input.trim()">
        <IconSearch aria-hidden="true" />
        {{ m.check }}
      </button>
    </form>
    <p id="sc-hint" class="text-sm text-ink-3">{{ m.hint }}</p>

    <p v-if="busy" role="status" class="text-sm text-ink-2">{{ m.checking }}</p>
    <p v-if="error" id="sc-error" role="alert" class="error-text">{{ error }}</p>

    <section v-if="scan" class="space-y-4" :aria-label="m.result">
      <div class="card flex flex-wrap items-start justify-between gap-4">
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="grid size-16 shrink-0 place-items-center border-2 font-display text-4xl"
            :class="gradeTone"
            data-sc-grade
            :aria-label="`${m.grade}: ${result.grade}`"
          >
            {{ result.grade }}
          </div>
          <div class="min-w-0">
            <p class="eyebrow">{{ m.grade }} · {{ result.score }}/100</p>
            <h2 class="font-display text-2xl break-all">{{ scan.host }}</h2>
            <p class="text-xs text-ink-3">
              <span class="text-secang dark:text-[#e98a98]">✕ {{ counts.fail }}</span> ·
              <span class="text-kunyit dark:text-[#eab54d]">! {{ counts.warn }}</span> ·
              <span class="text-daun dark:text-[#93c584]">✓ {{ counts.pass }}</span>
            </p>
          </div>
        </div>
        <CopyButton :text="summary" :label="m.copy" :copied-label="m.copied" />
        <dl class="grid w-full gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
          <dt class="font-semibold">{{ m.finalUrl }}</dt>
          <dd class="min-w-0 break-all">
            <a
              :href="safeUrl(scan.final_url)"
              rel="noopener nofollow noreferrer"
              target="_blank"
              class="underline"
              >{{ scan.final_url }}<IconExternal class="ml-0.5 inline size-3" aria-hidden="true"
            /></a>
          </dd>
          <dt class="font-semibold">{{ m.statusCode }}</dt>
          <dd>{{ scan.status }}</dd>
          <template v-if="scan.ip">
            <dt class="font-semibold">{{ m.ip }}</dt>
            <dd class="font-mono text-xs leading-5">{{ scan.ip }}</dd>
          </template>
        </dl>
      </div>

      <div class="card space-y-2">
        <h3 class="font-display text-xl">{{ m.security }}</h3>
        <ul class="divide-y divide-rule border-t border-rule" data-sc-checks>
          <li
            v-for="c in sortedChecks"
            :key="c.id"
            class="flex gap-3 py-2.5 text-sm"
            :data-check="c.id"
            :data-status="c.status"
          >
            <component
              :is="ICONS[c.status]"
              class="mt-0.5 size-4 shrink-0"
              :class="TONE[c.status]"
              :aria-label="msg[`status.${c.status}`]"
              role="img"
            />
            <div class="min-w-0 space-y-0.5">
              <p class="font-semibold">{{ title(c) }}</p>
              <p class="break-words text-ink-2">{{ text(c) }}</p>
              <p v-if="fix(c)" class="break-words text-xs text-ink-3">
                <span class="font-semibold">{{ m.fixLabel }}:</span> {{ fix(c) }}
              </p>
            </div>
          </li>
        </ul>
      </div>

      <div v-if="cert" class="card space-y-2">
        <h3 class="font-display text-xl">{{ m.certificate }}</h3>
        <dl class="divide-y divide-rule border-t border-rule text-sm">
          <div class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
            <dt class="font-semibold">{{ m['cert.subject'] }}</dt>
            <dd class="break-all">{{ cert.subject }}</dd>
          </div>
          <div class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
            <dt class="font-semibold">{{ m['cert.issuer'] }}</dt>
            <dd class="break-words">{{ cert.issuer }}</dd>
          </div>
          <div class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
            <dt class="font-semibold">{{ m['cert.validUntil'] }}</dt>
            <dd>
              {{ cert.until }}
              <span
                v-if="cert.left"
                :class="cert.warn ? 'font-semibold text-secang dark:text-[#e98a98]' : 'text-ink-3'"
                >· {{ cert.left }}</span
              >
            </dd>
          </div>
          <div class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
            <dt class="font-semibold">{{ m.tlsVersion }}</dt>
            <dd>{{ cert.version }}</dd>
          </div>
          <div v-if="cert.sans.length" class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]">
            <dt class="font-semibold">{{ m['cert.covers'] }}</dt>
            <dd class="font-mono text-xs leading-6">
              <span v-for="s in cert.sans" :key="s" class="mr-3 inline-block break-all">{{
                s
              }}</span>
              <span v-if="cert.more" class="text-ink-3">{{
                fill(m['cert.more'], { n: cert.more })
              }}</span>
            </dd>
          </div>
        </dl>
      </div>

      <div class="card space-y-3" data-sc-tech>
        <h3 class="font-display text-xl">{{ m.tech }}</h3>
        <dl v-if="techGroups.length" class="divide-y divide-rule border-t border-rule text-sm">
          <div
            v-for="g in techGroups"
            :key="g.cat"
            class="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]"
          >
            <dt class="font-semibold">{{ msg[`cat.${g.cat}`] }}</dt>
            <dd>
              <ul class="flex flex-wrap gap-1.5">
                <li
                  v-for="t in g.items"
                  :key="t.name"
                  class="rounded-sm border border-rule px-2 py-0.5 text-xs"
                >
                  {{ t.name }}<span v-if="t.version" class="ml-1 text-ink-3"> {{ t.version }}</span>
                </li>
              </ul>
            </dd>
          </div>
        </dl>
        <p v-else class="text-sm text-ink-2">{{ m.techNone }}</p>
        <p class="text-xs text-ink-3">{{ m.techNote }}</p>
      </div>

      <details v-if="scan.redirects.length" class="card text-sm">
        <summary class="cursor-pointer font-semibold">
          {{ m.redirects }} ({{ scan.redirects.length }})
        </summary>
        <ol class="mt-2 space-y-1 font-mono text-xs">
          <li v-for="(r, i) in scan.redirects" :key="i" class="break-all">
            <span class="text-ink-3">{{ r.status }}</span> {{ r.url }}
          </li>
          <li class="break-all">
            <span class="text-ink-3">{{ scan.status }}</span> {{ scan.final_url }}
          </li>
        </ol>
      </details>

      <details class="card text-sm">
        <summary class="cursor-pointer font-semibold">
          {{ m.headers }} ({{ scan.headers.length }})
        </summary>
        <dl class="mt-2 grid gap-x-3 gap-y-1 font-mono text-xs sm:grid-cols-[minmax(0,14rem)_1fr]">
          <template v-for="([k, v], i) in scan.headers" :key="i">
            <dt class="break-all font-semibold">{{ k }}</dt>
            <dd class="break-all text-ink-2">{{ v }}</dd>
          </template>
        </dl>
      </details>

      <p class="text-xs text-ink-3">{{ m.note }}</p>
    </section>
  </div>
</template>
