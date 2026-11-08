<script setup lang="ts">
/**
 * Cari Subdomain: data dari log Certificate Transparency, diambil langsung oleh browser
 * pengguna (bukan server Toolland). Dibatasi 10 pencarian per jam per orang.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import IconDownload from '~icons/lucide/download';
import IconSearch from '~icons/lucide/search';
import type { ToolMessages } from '../../i18n';
import { downloadText } from '../../lib/download';
import { fill, LOCALE_TAGS, pageLocale } from '../../lib/format';
import {
  findSubdomains,
  SEARCH_LIMIT,
  SearchLimiter,
  searchDomain,
  SubdomainError,
  type SubdomainResult,
} from '../../lib/subdomains';
import { toDomain } from '../../lib/whois';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'subdomain'>;
const msg = props.m;

const SHOW_FIRST = 300;

const input = ref('');
const busy = ref(false);
const error = ref('');
const result = ref<SubdomainResult | null>(null);
const filter = ref('');
const showAll = ref(false);

// Jatah dihitung di browser saja; sebelum halaman aktif, anggap penuh.
let limiter: SearchLimiter | undefined;
const remaining = ref(SEARCH_LIMIT);
const waitMin = ref(0);
let ctrl: AbortController | undefined;
let tick: number | undefined;
/** Domain yang sudah dicari di halaman ini tidak memakai jatah lagi. */
const cache = new Map<string, SubdomainResult>();

function refreshQuota() {
  if (!limiter) return;
  remaining.value = limiter.remaining();
  waitMin.value = Math.ceil(limiter.waitMs() / 60_000);
}

onMounted(() => {
  limiter = new SearchLimiter();
  refreshQuota();
  tick = window.setInterval(refreshQuota, 30_000);
});
onBeforeUnmount(() => {
  ctrl?.abort();
  window.clearInterval(tick);
});

async function search() {
  error.value = '';
  const host = toDomain(input.value);
  if (!host) {
    error.value = m['error.invalid'];
    return;
  }
  const domain = searchDomain(host);
  const hit = cache.get(domain);
  if (hit) {
    show(hit);
    return;
  }
  if (!limiter?.take()) {
    refreshQuota();
    error.value = fill(m['error.limit'], { limit: SEARCH_LIMIT, min: waitMin.value });
    return;
  }
  refreshQuota();
  ctrl?.abort();
  ctrl = new AbortController();
  busy.value = true;
  result.value = null;
  try {
    const res = await findSubdomains(domain, ctrl.signal);
    cache.set(domain, res);
    show(res);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    const code = e instanceof SubdomainError ? e.code : 'upstream';
    error.value = msg[`error.${code}`] ?? m['error.upstream'];
  } finally {
    busy.value = false;
  }
}

function show(res: SubdomainResult) {
  result.value = res;
  filter.value = '';
  showAll.value = false;
}

const filtered = computed(() => {
  const list = result.value?.subdomains ?? [];
  const q = filter.value.trim().toLowerCase();
  return q ? list.filter((s) => s.name.includes(q)) : list;
});
const visible = computed(() =>
  showAll.value ? filtered.value : filtered.value.slice(0, SHOW_FIRST),
);

const locale = pageLocale();
const num = (n: number) => n.toLocaleString(LOCALE_TAGS[locale]);
const dateFmt = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
  dateStyle: 'medium',
  timeZone: 'UTC',
});
const now = Date.now();
const certNote = (iso: string | null) => {
  if (!iso) return '';
  const d = dateFmt.format(new Date(iso));
  return Date.parse(iso) > now ? fill(m.validUntil, { date: d }) : fill(m.expiredOn, { date: d });
};

const sourceName = computed(() =>
  result.value?.source === 'certspotter' ? 'Certspotter (SSLMate)' : 'crt.sh (Sectigo)',
);

const names = computed(() => filtered.value.map((s) => s.name).join('\n'));

function downloadTxt() {
  if (!result.value) return;
  downloadText(`${names.value}\n`, `subdomain-${result.value.domain}.txt`);
}

function downloadCsv() {
  if (!result.value) return;
  const rows = filtered.value.map((s) => `${s.name},${s.lastSeen ?? ''}`);
  downloadText(
    [`subdomain,${m.csvLastCert}`, ...rows].join('\n') + '\n',
    `subdomain-${result.value.domain}.csv`,
    'text/csv',
  );
}
</script>

<template>
  <div class="space-y-4">
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="search">
      <label for="sub-domain" class="sr-only">{{ m.label }}</label>
      <input
        id="sub-domain"
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
        aria-describedby="sub-hint"
      />
      <button type="submit" class="btn btn-primary shrink-0" :disabled="busy || !input.trim()">
        <IconSearch aria-hidden="true" />
        {{ busy ? m.searching : m.search }}
      </button>
    </form>
    <p id="sub-hint" class="text-sm text-ink-3">
      {{ m.hint }}
      <span id="sub-quota" class="block">{{
        fill(m.quota, { n: remaining, limit: SEARCH_LIMIT })
      }}</span>
    </p>

    <p v-if="busy" role="status" class="text-sm text-ink-2">{{ m.searchingLong }}</p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>

    <section v-if="result" class="card space-y-4" :aria-label="m.result">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="eyebrow">{{ m.result }}</p>
          <h2 id="sub-count" class="font-display text-2xl break-all">
            {{ fill(m.found, { n: num(result.subdomains.length), domain: result.domain }) }}
          </h2>
          <p class="mt-1 text-xs text-ink-3">
            {{ fill(m.source, { source: sourceName }) }}
            <template v-if="result.source === 'certspotter'"> · {{ m.sourceFallback }}</template>
          </p>
        </div>
      </div>

      <p v-if="!result.subdomains.length" class="text-sm text-ink-2">{{ m.empty }}</p>
      <template v-else>
        <div class="flex flex-wrap items-center gap-2">
          <label for="sub-filter" class="sr-only">{{ m.filter }}</label>
          <input
            id="sub-filter"
            v-model="filter"
            type="search"
            autocomplete="off"
            spellcheck="false"
            class="field min-w-0 flex-1 font-mono sm:max-w-xs"
            :placeholder="m.filter"
          />
          <CopyButton :text="names" :label="m.copy" :copied-label="m.copied" />
          <button type="button" class="btn btn-secondary" @click="downloadTxt">
            <IconDownload aria-hidden="true" />TXT
          </button>
          <button type="button" class="btn btn-secondary" @click="downloadCsv">
            <IconDownload aria-hidden="true" />CSV
          </button>
        </div>
        <p v-if="filter.trim()" class="text-sm text-ink-3">
          {{ fill(m.filtered, { n: num(filtered.length) }) }}
        </p>

        <ul id="sub-list" class="divide-y divide-rule border-t border-rule">
          <li
            v-for="s in visible"
            :key="s.name"
            class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2"
          >
            <span class="min-w-0 font-mono text-sm break-all">{{ s.name }}</span>
            <span v-if="s.lastSeen" class="text-xs text-ink-3">{{ certNote(s.lastSeen) }}</span>
          </li>
        </ul>
        <button
          v-if="!showAll && filtered.length > SHOW_FIRST"
          type="button"
          class="btn btn-secondary"
          @click="showAll = true"
        >
          {{ fill(m.showAll, { n: num(filtered.length) }) }}
        </button>
      </template>
    </section>
  </div>
</template>
