<script setup lang="ts">
/**
 * Cek Format Skripsi: unggah .docx, cek terhadap pedoman kampus (preset + form), lihat masalah
 * per kelompok dengan lokasinya, lalu Rapikan untuk mengunduh .docx yang sudah dibetulkan.
 * Semua proses di browser; file tidak diunggah ke server.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import type { DropzoneMessages } from '../../lib/dropzone-messages';
import { downloadBlob } from '../../lib/download';
import { fill, pageLocale } from '../../lib/format';
import {
  checkDocx,
  type Block,
  type CheckResult,
  type Group,
  type Issue,
} from '../../lib/thesis/check';
import { readDocx } from '../../lib/thesis/docx-read';
import { fixDocx } from '../../lib/thesis/fix';
import {
  cloneRules,
  decodeRules,
  encodeRules,
  FONTS,
  normalizeRules,
  PRESETS,
  type PresetId,
  type ThesisRules,
} from '../../lib/thesis/rules';
import Dropzone from '../ui/Dropzone.vue';

const props = defineProps<{ m: Record<string, string>; dropzone: DropzoneMessages }>();
const m = props.m as ToolMessages<'thesis'>;

// --- Pedoman -------------------------------------------------------------------------------
const STORE = 'toolland-thesis-rules';
const preset = ref<PresetId | 'custom'>('umum');
const rules = ref<ThesisRules>(cloneRules(PRESETS.umum));
const editing = ref(false);
const fromLink = ref(false);
const linkCopied = ref(false);

function presetOf(r: ThesisRules): PresetId | 'custom' {
  const json = JSON.stringify(r);
  return (
    (Object.keys(PRESETS) as PresetId[]).find((k) => JSON.stringify(PRESETS[k]) === json) ??
    'custom'
  );
}
function choosePreset(id: PresetId) {
  rules.value = cloneRules(PRESETS[id]);
}
watch(
  rules,
  (r) => {
    preset.value = presetOf(r);
    try {
      localStorage.setItem(STORE, JSON.stringify(r));
    } catch {
      // Abaikan.
    }
    if (bytes.value) runCheck();
  },
  { deep: true },
);

async function copyLink() {
  const url = `${location.origin}${location.pathname}#p=${encodeRules(normalizeRules(rules.value))}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    history.replaceState(null, '', url);
  }
  linkCopied.value = true;
  setTimeout(() => (linkCopied.value = false), 3000);
}

onMounted(() => {
  const hash = /[#&]p=([\w-]+)/.exec(location.hash)?.[1];
  const shared = hash ? decodeRules(hash) : null;
  if (shared) {
    rules.value = shared;
    fromLink.value = true;
    return;
  }
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) rules.value = normalizeRules(JSON.parse(raw));
  } catch {
    // Abaikan.
  }
});

// --- Dokumen -------------------------------------------------------------------------------
const fileName = ref('');
const bytes = ref<Uint8Array>();
const result = ref<CheckResult>();
const error = ref('');
const busy = ref(false);
const after = ref<CheckResult>();
const fixedName = ref('');
const selected = ref<number | null>(null);
const open = ref<Set<string>>(new Set());

function runCheck() {
  if (!bytes.value) return;
  try {
    result.value = checkDocx(readDocx(bytes.value), rules.value);
    error.value = '';
  } catch {
    result.value = undefined;
    error.value = m.errorDocx;
  }
  after.value = undefined;
}

async function onFiles(files: File[]) {
  const f = files[0];
  if (!f) return;
  error.value = '';
  result.value = undefined;
  after.value = undefined;
  selected.value = null;
  if (/\.doc$/i.test(f.name)) {
    error.value = m.errorDoc;
    return;
  }
  busy.value = true;
  fileName.value = f.name;
  bytes.value = new Uint8Array(await f.arrayBuffer());
  // Beri waktu UI menampilkan status sebelum proses yang berat.
  await new Promise((r) => setTimeout(r, 20));
  runCheck();
  busy.value = false;
}

async function fix() {
  if (!bytes.value) return;
  busy.value = true;
  await new Promise((r) => setTimeout(r, 20));
  try {
    const out = fixDocx(bytes.value, rules.value);
    const name = `${fileName.value.replace(/\.docx$/i, '')}-rapi.docx`;
    downloadBlob(
      new Blob([out.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      name,
    );
    fixedName.value = name;
    after.value = checkDocx(readDocx(out), rules.value);
  } catch {
    error.value = m.errorFix;
  } finally {
    busy.value = false;
  }
}

// --- Tampilan hasil ------------------------------------------------------------------------
const GROUPS: Group[] = ['page', 'pagenum', 'heading', 'body', 'caption'];
const grouped = computed(() =>
  GROUPS.map((g) => ({
    g,
    issues: result.value?.issues.filter((i) => i.group === g) ?? [],
  })).filter((x) => x.issues.length),
);
const autoCount = computed(() => result.value?.issues.filter((i) => i.fix).length ?? 0);
const issueParas = computed(() => new Set(result.value?.issues.flatMap((i) => i.paras) ?? []));

const nf = computed(
  () =>
    new Intl.NumberFormat(pageLocale() === 'en' ? 'en-US' : 'id-ID', { maximumFractionDigits: 2 }),
);
/** Angka diformat sesuai bahasa; teks hanya kalau isinya daftar angka ("11, 13" atau "12 pt"). */
const num = (v: string | number) =>
  typeof v === 'number'
    ? nf.value.format(v)
    : /^[\d.]+(, [\d.]+)*( pt)?$/.test(v)
      ? v.replace(/\d+(\.\d+)?/g, (x) => nf.value.format(Number(x)))
      : v;
const JC = (v: string | number) => m[`jc_${v}` as 'jc_left'] ?? String(v);

function message(i: Issue): string {
  const r = rules.value;
  const v: Record<string, string | number> = {};
  for (const [k, x] of Object.entries(i.vals)) v[k] = num(x);
  if (i.code === 'margin')
    Object.assign(v, {
      wtop: num(r.margin.top),
      wbottom: num(r.margin.bottom),
      wleft: num(r.margin.left),
      wright: num(r.margin.right),
    });
  if (i.code === 'pagenumFront')
    Object.assign(v, {
      have: m[`fmt_${i.vals.have}` as 'fmt_decimal'] ?? i.vals.have,
      want: m[`fmt_${r.pageNum.front}` as 'fmt_decimal'],
    });
  if (i.code === 'pagenumPos')
    Object.assign(v, {
      have: m[`at_${i.vals.have}` as 'at_footer-center'] ?? i.vals.have,
      want: m[`pos_${r.pageNum.pos}` as 'pos_bottom-center'],
    });
  if (['align', 'headCenter', 'captionAlign'].includes(i.code)) v.have = JC(i.vals.have);
  const key = i.code === 'captionPos' ? `msg_captionPos_${i.vals.kind}` : `msg_${i.code}`;
  return fill(m[key as 'msg_font'], v);
}

const blockByIndex = computed(() => new Map(result.value?.blocks.map((b) => [b.p.i, b]) ?? []));
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function where(b: Block | undefined): string {
  if (!b) return '';
  if (b.chapter === 0) return m.loc_front;
  if (b.chapter < 0) return m.loc_end;
  return fill(m.loc_chapter, { n: ROMAN[b.chapter] ?? b.chapter });
}
const snippet = (t: string) => {
  const s = t.trim().replace(/\s+/g, ' ');
  return s.length > 70 ? `${s.slice(0, 68)}…` : s;
};
const LIMIT = 30;

function issueKey(i: Issue) {
  return `${i.code}|${JSON.stringify(i.vals)}`;
}
function toggle(i: Issue) {
  const k = issueKey(i);
  const s = new Set(open.value);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  open.value = s;
}
const previewEl = ref<HTMLDivElement>();
function jump(i: number) {
  selected.value = i;
  void nextTick(() => {
    const box = previewEl.value;
    const row = box?.querySelector<HTMLElement>(`[data-tp="${i}"]`);
    if (!box || !row) return;
    // Di layar sempit pratinjau ada di bawah daftar masalah: bawa ke layar dulu.
    const r = box.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight)
      box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    box.scrollTo({ top: row.offsetTop - box.clientHeight / 3, behavior: 'smooth' });
  });
}

const preview = computed(
  () => result.value?.blocks.filter((b) => b.p.text.trim() || b.p.hasDrawing) ?? [],
);
const KIND_CLASS: Partial<Record<Block['kind'], string>> = {
  chapter: 'text-center font-bold',
  chapterTitle: 'text-center font-bold',
  frontTitle: 'text-center font-bold',
  sub: 'font-semibold',
  caption: 'text-center text-xs italic',
  cell: 'pl-4 text-xs text-ink-3',
  other: 'text-xs text-ink-3',
  front: 'text-xs',
  ref: 'text-xs',
  list: 'pl-4',
};

const summary = computed(() => {
  const r = rules.value;
  return fill(m.summary, {
    paper: r.paper,
    top: num(r.margin.top),
    bottom: num(r.margin.bottom),
    left: num(r.margin.left),
    right: num(r.margin.right),
    font: r.font,
    size: num(r.size),
    line: num(r.line),
  });
});
</script>

<template>
  <div class="space-y-5">
    <!-- Pedoman -->
    <section class="card space-y-3" data-tf-rules :aria-label="m.rulesTitle">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-display text-xl">{{ m.rulesTitle }}</h2>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn" data-tf-edit @click="editing = !editing">
            {{ editing ? m.done : m.edit }}
          </button>
          <button type="button" class="btn" data-tf-share @click="copyLink">
            {{ linkCopied ? m.shared : m.share }}
          </button>
        </div>
      </div>
      <p v-if="fromLink" class="rounded border border-rule bg-paper-2 p-2 text-sm">
        {{ m.fromLink }}
      </p>
      <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="m.preset">
        <button
          v-for="id in Object.keys(PRESETS) as PresetId[]"
          :key="id"
          type="button"
          role="radio"
          :aria-checked="preset === id"
          class="rounded-full border px-3 py-1 text-sm"
          :class="
            preset === id
              ? 'border-brand-600 bg-brand-600/10 font-semibold dark:border-brand-400'
              : 'border-rule'
          "
          :data-tf-preset="id"
          @click="choosePreset(id)"
        >
          {{ m[`preset_${id}` as 'preset_umum'] }}
        </button>
        <span
          v-if="preset === 'custom'"
          class="rounded-full border border-brand-600 bg-brand-600/10 px-3 py-1 text-sm font-semibold dark:border-brand-400"
          >{{ m.preset_custom }}</span
        >
      </div>
      <p class="text-sm text-ink-2" data-tf-summary>{{ summary }}</p>

      <div v-if="editing" class="grid gap-4 border-t border-rule pt-3 md:grid-cols-2" data-tf-form>
        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold">{{ m.pageHead }}</legend>
          <label class="flex items-center justify-between gap-2 text-sm"
            >{{ m.paper }}
            <select v-model="rules.paper" class="field w-28 py-1.5">
              <option value="A4">A4</option>
              <option value="F4">F4 / Folio</option>
              <option value="Letter">Letter</option>
            </select>
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="k in ['top', 'bottom', 'left', 'right'] as const"
              :key="k"
              class="flex items-center justify-between gap-2 text-sm"
              >{{ m[`margin_${k}`] }}
              <input
                v-model.number="rules.margin[k]"
                type="number"
                min="0.5"
                max="8"
                step="0.1"
                class="field w-20 py-1.5"
                :data-tf-margin="k"
              />
            </label>
          </div>
        </fieldset>
        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold">{{ m.bodyHead }}</legend>
          <label class="flex items-center justify-between gap-2 text-sm"
            >{{ m.font }}
            <input
              v-model.trim="rules.font"
              list="tf-fonts"
              class="field w-52 py-1.5"
              data-tf-font
            />
            <datalist id="tf-fonts">
              <option v-for="f in FONTS" :key="f" :value="f" />
            </datalist>
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center justify-between gap-2 text-sm"
              >{{ m.size }}
              <input
                v-model.number="rules.size"
                type="number"
                min="8"
                max="20"
                step="0.5"
                class="field w-20 py-1.5"
              />
            </label>
            <label class="flex items-center justify-between gap-2 text-sm"
              >{{ m.line }}
              <select v-model.number="rules.line" class="field w-20 py-1.5" data-tf-line>
                <option v-for="v in [1, 1.15, 1.5, 2]" :key="v" :value="v">{{ num(v) }}</option>
              </select>
            </label>
            <label class="flex items-center justify-between gap-2 text-sm"
              >{{ m.indent }}
              <input
                v-model.number="rules.indent"
                type="number"
                min="0"
                max="5"
                step="0.05"
                class="field w-20 py-1.5"
              />
            </label>
            <label class="flex items-center justify-between gap-2 text-sm"
              >{{ m.after }}
              <input
                v-model.number="rules.after"
                type="number"
                min="0"
                max="30"
                step="1"
                class="field w-20 py-1.5"
              />
            </label>
          </div>
          <label class="flex items-center gap-2 text-sm"
            ><input v-model="rules.justify" type="checkbox" /> {{ m.justify }}</label
          >
        </fieldset>
        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold">{{ m.chapterHead }}</legend>
          <label class="flex items-center justify-between gap-2 text-sm"
            >{{ m.size }}
            <input
              v-model.number="rules.chapter.size"
              type="number"
              min="8"
              max="24"
              step="1"
              class="field w-20 py-1.5"
            />
          </label>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <label
              v-for="k in ['bold', 'caps', 'center', 'newPage'] as const"
              :key="k"
              class="flex items-center gap-2"
              ><input v-model="rules.chapter[k]" type="checkbox" /> {{ m[`ch_${k}`] }}</label
            >
          </div>
          <p class="text-sm font-semibold">{{ m.subHead }}</p>
          <div class="flex flex-wrap items-center gap-4">
            <label class="flex items-center justify-between gap-2 text-sm"
              >{{ m.size }}
              <input
                v-model.number="rules.sub.size"
                type="number"
                min="8"
                max="20"
                step="1"
                class="field w-20 py-1.5"
              />
            </label>
            <label class="flex items-center gap-2 text-sm"
              ><input v-model="rules.sub.bold" type="checkbox" /> {{ m.ch_bold }}</label
            >
          </div>
          <label class="flex items-center gap-2 text-sm"
            ><input v-model="rules.caption.center" type="checkbox" /> {{ m.captionCenter }}</label
          >
        </fieldset>
        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold">{{ m.pagenumHead }}</legend>
          <label class="flex items-center justify-between gap-2 text-sm"
            >{{ m.front }}
            <select v-model="rules.pageNum.front" class="field w-32 py-1.5">
              <option value="lowerRoman">{{ m.fmt_lowerRoman }}</option>
              <option value="upperRoman">{{ m.fmt_upperRoman }}</option>
            </select>
          </label>
          <label class="flex items-center justify-between gap-2 text-sm"
            >{{ m.pos }}
            <select v-model="rules.pageNum.pos" class="field w-44 py-1.5" data-tf-pos>
              <option
                v-for="p in ['bottom-center', 'bottom-right', 'top-right'] as const"
                :key="p"
                :value="p"
              >
                {{ m[`pos_${p}`] }}
              </option>
            </select>
          </label>
          <p class="text-xs text-ink-3">{{ m.mainNote }}</p>
        </fieldset>
      </div>
    </section>

    <!-- Unggah -->
    <Dropzone
      :messages="dropzone"
      accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      :multiple="false"
      :max-size="80 * 1024 * 1024"
      @files="onFiles"
    />
    <p class="text-xs text-ink-3">{{ m.hint }}</p>
    <p v-if="busy" class="text-sm" role="status">{{ m.working }}</p>
    <p v-if="error" class="error-text" role="alert" data-tf-error>{{ error }}</p>

    <!-- Hasil -->
    <section v-if="result" class="space-y-4" data-tf-result :aria-label="m.resultTitle">
      <div class="rounded-md border border-ink bg-paper-2 p-4">
        <p class="font-semibold break-all">{{ fileName }}</p>
        <p class="mt-1 text-sm text-ink-2" data-tf-detected>
          <template v-if="result.chapters.length">
            {{
              fill(m.detected, {
                chapters: result.chapters.join(', '),
                n: result.bodyCount,
              })
            }}{{ result.hasRefs ? m.detectedRefs : '' }}
          </template>
          <template v-else>{{ m.noChapter }}</template>
        </p>
        <p v-if="result.issues.length" class="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="font-display text-3xl text-secang dark:text-[#e98a98]" data-tf-count>{{
            result.issues.length
          }}</span>
          <span class="text-sm">{{ m.issuesFound }}</span>
          <span class="text-sm text-ink-3">{{ fill(m.autoCount, { n: autoCount }) }}</span>
        </p>
        <p v-else class="mt-3 font-semibold text-daun" data-tf-clean>✓ {{ m.allGood }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="busy || !autoCount"
            data-tf-fix
            @click="fix"
          >
            {{ m.fix }}
          </button>
        </div>
      </div>

      <div
        v-if="after"
        class="rounded-md border border-daun/50 bg-daun/5 p-4 text-sm"
        role="status"
        data-tf-after
      >
        <p class="font-semibold">{{ fill(m.fixed, { name: fixedName }) }}</p>
        <p v-if="after.issues.length" class="mt-1">
          {{ fill(m.afterFix, { n: after.issues.length }) }}
        </p>
        <ul v-if="after.issues.length" class="mt-1 list-disc pl-5">
          <li v-for="i in after.issues" :key="issueKey(i)">{{ message(i) }}</li>
        </ul>
        <p v-else class="mt-1">{{ m.afterClean }}</p>
        <p class="mt-2 font-semibold">{{ m.tipsTitle }}</p>
        <ul class="list-disc pl-5 text-ink-2">
          <li>{{ m.tip1 }}</li>
          <li>{{ m.tip2 }}</li>
          <li>{{ m.tip3 }}</li>
        </ul>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div class="space-y-4">
          <section v-for="grp in grouped" :key="grp.g" class="space-y-2" :data-tf-group="grp.g">
            <h3 class="font-semibold">{{ m[`group_${grp.g}`] }}</h3>
            <ul class="space-y-2">
              <li
                v-for="i in grp.issues"
                :key="issueKey(i)"
                class="rounded-md border border-rule bg-paper-2 p-3"
                :data-tf-issue="i.code"
              >
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <p class="min-w-0 flex-1 text-sm">{{ message(i) }}</p>
                  <span
                    class="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                    :class="
                      i.fix
                        ? 'bg-daun/15 text-daun'
                        : 'bg-secang/10 text-secang dark:text-[#e98a98]'
                    "
                    >{{ i.fix ? m.badgeAuto : m.badgeManual }}</span
                  >
                </div>
                <button
                  v-if="i.paras.length"
                  type="button"
                  class="mt-1 text-xs font-semibold text-brand-700 underline dark:text-brand-300"
                  :aria-expanded="open.has(issueKey(i))"
                  @click="toggle(i)"
                >
                  {{ fill(m.locations, { n: i.paras.length }) }}
                </button>
                <p v-else-if="i.sections.length" class="mt-1 text-xs text-ink-3">
                  {{
                    i.sections.length === result.sections
                      ? m.wholeDoc
                      : fill(m.sectionsN, { n: i.sections.map((x) => x + 1).join(', ') })
                  }}
                </p>
                <ul v-if="open.has(issueKey(i))" class="mt-2 space-y-1">
                  <li v-for="pi in i.paras.slice(0, LIMIT)" :key="pi">
                    <button
                      type="button"
                      class="w-full rounded px-2 py-1 text-left text-xs hover:bg-paper"
                      :class="selected === pi ? 'bg-brand-600/10' : ''"
                      @click="jump(pi)"
                    >
                      <span class="font-semibold">{{ where(blockByIndex.get(pi)) }}</span>
                      · “{{ snippet(blockByIndex.get(pi)?.p.text ?? '') }}”
                    </button>
                  </li>
                  <li v-if="i.paras.length > LIMIT" class="px-2 text-xs text-ink-3">
                    {{ fill(m.more, { n: i.paras.length - LIMIT }) }}
                  </li>
                </ul>
              </li>
            </ul>
          </section>
        </div>

        <aside class="space-y-2 self-start lg:sticky lg:top-20">
          <h3 class="font-semibold">{{ m.preview }}</h3>
          <p class="text-xs text-ink-3">{{ m.previewHint }}</p>
          <div
            ref="previewEl"
            class="relative max-h-[34rem] overflow-y-auto rounded-md border border-rule bg-paper p-3 font-serif"
            data-tf-preview
          >
            <p
              v-for="b in preview"
              :key="b.p.i"
              :data-tp="b.p.i"
              class="border-l-2 py-0.5 pl-2 text-sm break-words"
              :class="[
                KIND_CLASS[b.kind] ?? '',
                issueParas.has(b.p.i) ? 'border-secang' : 'border-transparent',
                selected === b.p.i ? 'bg-brand-600/15' : '',
              ]"
            >
              <template v-if="b.p.text.trim()">{{ snippet(b.p.text) }}</template>
              <template v-else>🖼</template>
            </p>
          </div>
        </aside>
      </div>
    </section>

    <p class="text-xs text-ink-3">🔒 {{ m.privacy }}</p>
  </div>
</template>
