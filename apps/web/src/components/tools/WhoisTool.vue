<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import IconExternal from '~icons/lucide/external-link';
import IconSearch from '~icons/lucide/search';
import type { ToolMessages } from '../../i18n';
import { fill, LOCALE_TAGS, pageLocale } from '../../lib/format';
import {
  daysUntil,
  lookupWhois,
  STATUS_KEYS,
  toDomain,
  WhoisError,
  type WhoisInfo,
  yearsSince,
} from '../../lib/whois';
import CopyButton from '../ui/CopyButton.vue';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'whois'>;
const msg = props.m;

const input = ref('');
const busy = ref(false);
const error = ref('');
const info = ref<WhoisInfo | null>(null);
/** Domain yang ternyata belum terdaftar. */
const free = ref('');
let ctrl: AbortController | undefined;

async function check() {
  const domain = toDomain(input.value);
  error.value = '';
  if (!domain) {
    error.value = m['error.invalid'];
    return;
  }
  ctrl?.abort();
  ctrl = new AbortController();
  busy.value = true;
  info.value = null;
  free.value = '';
  try {
    const res = await lookupWhois(domain, ctrl.signal);
    if (res.found) info.value = res;
    else free.value = fill(m.notFound, { domain: res.domain });
  } catch (e) {
    if (ctrl.signal.aborted) return;
    const code = e instanceof WhoisError ? e.code : 'upstream';
    error.value = fill(msg[`error.${code}`] ?? m['error.upstream'], { domain });
  } finally {
    busy.value = false;
  }
}

onBeforeUnmount(() => ctrl?.abort());

const locale = pageLocale();
const dateFmt = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
  dateStyle: 'long',
  timeZone: 'UTC',
});
const date = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');

const age = computed(() => {
  const r = info.value?.registered;
  if (!r) return '';
  const years = yearsSince(r);
  return years >= 1 ? fill(m.ageYears, { n: years }) : fill(m.ageDays, { n: -daysUntil(r) });
});

const expiry = computed(() => {
  const e = info.value?.expires;
  if (!e) return null;
  const days = daysUntil(e);
  if (days < 0) return { text: m.expired, warn: true };
  return { text: fill(m.expiresIn, { n: days }), warn: days <= 30 };
});

/** Status registry dalam bahasa biasa, tanpa duplikat (client/server sama artinya). */
const statuses = computed(() => {
  const seen = new Map<string, string[]>();
  for (const raw of info.value?.status ?? []) {
    const key = STATUS_KEYS[raw.toLowerCase()];
    const label = (key && msg[`status.${key}`]) || raw;
    seen.set(label, [...(seen.get(label) ?? []), raw]);
  }
  return [...seen].map(([label, raw]) => ({ label, raw: raw.join(', ') }));
});

const country = (cc: string | null) => {
  if (!cc) return null;
  try {
    return new Intl.DisplayNames([LOCALE_TAGS[locale]], { type: 'region' }).of(cc.toUpperCase());
  } catch {
    return cc;
  }
};

/** Ringkasan teks untuk disalin. */
const summary = computed(() => {
  const i = info.value;
  if (!i) return '';
  const lines = [
    `${m.domain}: ${i.unicode_name ?? i.domain}`,
    `${m.registrar}: ${i.registrar?.name ?? '—'}`,
    `${m.registered}: ${date(i.registered)}`,
    `${m.expires}: ${date(i.expires)}`,
    `${m.updated}: ${date(i.updated)}`,
    `${m.nameservers}: ${i.nameservers.join(', ') || '—'}`,
    `${m.status}: ${i.status.join(', ') || '—'}`,
    `DNSSEC: ${i.dnssec == null ? '—' : i.dnssec ? m.dnssecOn : m.dnssecOff}`,
    `${m.source}: ${i.source}`,
  ];
  return lines.join('\n');
});

const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);
</script>

<template>
  <div class="space-y-4">
    <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="check">
      <label for="whois-domain" class="sr-only">{{ m.label }}</label>
      <input
        id="whois-domain"
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
        aria-describedby="whois-hint"
      />
      <button type="submit" class="btn btn-primary shrink-0" :disabled="busy || !input.trim()">
        <IconSearch aria-hidden="true" />
        {{ busy ? m.checking : m.check }}
      </button>
    </form>
    <p id="whois-hint" class="text-sm text-ink-3">{{ m.hint }}</p>

    <p v-if="busy" role="status" class="text-sm text-ink-2">{{ m.checking }}</p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
    <p v-if="free" id="whois-free" role="status" class="card text-sm">{{ free }}</p>

    <section v-if="info" class="card space-y-4" :aria-label="m.result">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="eyebrow">{{ m.domain }}</p>
          <h2 class="font-display text-2xl break-all">{{ info.unicode_name ?? info.domain }}</h2>
          <p v-if="info.unicode_name" class="font-mono text-xs text-ink-3">{{ info.domain }}</p>
        </div>
        <CopyButton :text="summary" :label="m.copy" :copied-label="m.copied" />
      </div>

      <dl class="divide-y divide-rule border-t border-rule text-sm">
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.registrar }}</dt>
          <dd class="min-w-0 break-words">
            <template v-if="info.registrar?.name">
              <a
                v-if="safeUrl(info.registrar.url)"
                :href="safeUrl(info.registrar.url)!"
                rel="noopener nofollow"
                target="_blank"
                class="underline"
                >{{ info.registrar.name }}</a
              >
              <span v-else>{{ info.registrar.name }}</span>
            </template>
            <span v-else>—</span>
          </dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.registered }}</dt>
          <dd>
            {{ date(info.registered) }}
            <span v-if="age" class="text-ink-3">· {{ age }}</span>
          </dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.expires }}</dt>
          <dd>
            {{ date(info.expires) }}
            <span
              v-if="expiry"
              :class="expiry.warn ? 'font-semibold text-secang dark:text-[#e98a98]' : 'text-ink-3'"
              >· {{ expiry.text }}</span
            >
          </dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.updated }}</dt>
          <dd>{{ date(info.updated) }}</dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.nameservers }}</dt>
          <dd>
            <ul v-if="info.nameservers.length" class="font-mono text-xs leading-6">
              <li v-for="ns in info.nameservers" :key="ns" class="break-all">{{ ns }}</li>
            </ul>
            <span v-else>—</span>
          </dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.status }}</dt>
          <dd>
            <ul v-if="statuses.length" class="flex flex-wrap gap-1.5">
              <li
                v-for="s in statuses"
                :key="s.label"
                :title="s.raw"
                class="rounded-sm border border-rule px-2 py-0.5 text-xs"
              >
                {{ s.label }}
              </li>
            </ul>
            <span v-else>—</span>
          </dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">DNSSEC</dt>
          <dd>{{ info.dnssec == null ? '—' : info.dnssec ? m.dnssecOn : m.dnssecOff }}</dd>
        </div>
        <div class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]">
          <dt class="font-semibold">{{ m.owner }}</dt>
          <dd class="break-words">
            <template v-if="info.registrant">
              {{
                [info.registrant.organization, country(info.registrant.country)]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </template>
            <span v-else class="text-ink-3">{{ m.ownerHidden }}</span>
          </dd>
        </div>
        <div
          v-if="info.registrar?.abuse_email || info.registrar?.abuse_phone"
          class="grid gap-1 py-2.5 sm:grid-cols-[11rem_1fr]"
        >
          <dt class="font-semibold">{{ m.abuse }}</dt>
          <dd class="break-all">
            {{
              [info.registrar.abuse_email, info.registrar.abuse_phone].filter(Boolean).join(' · ')
            }}
          </dd>
        </div>
      </dl>

      <p class="text-xs text-ink-3">
        {{ m.source }}:
        <a :href="info.source" rel="noopener nofollow" target="_blank" class="break-all underline">
          {{ info.source }}<IconExternal class="ml-0.5 inline size-3" aria-hidden="true" />
        </a>
      </p>
    </section>
  </div>
</template>
