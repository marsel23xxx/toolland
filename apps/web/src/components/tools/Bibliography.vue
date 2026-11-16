<script setup lang="ts">
/**
 * Daftar Pustaka: cari DOI/ISBN/URL atau isi manual, lalu daftar diformat otomatis ke APA 7,
 * IEEE, Harvard, atau Chicago. Salin sebagai teks berformat, unduh Word, BibTeX, atau RIS.
 * Daftar disimpan di browser; hanya DOI/ISBN yang dikirim ke Crossref/Google Books/Open Library.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ToolMessages } from '../../i18n';
import { downloadBlob, downloadText } from '../../lib/download';
import { pageLocale, type Locale } from '../../lib/format';
import { entries, toBibtex, toDocx, toHtml, toPlain, toRis } from '../../lib/thesis/cite/export';
import {
  formatRef,
  inText,
  ordered,
  STYLES,
  type Lang,
  type Style,
} from '../../lib/thesis/cite/format';
import {
  detectInput,
  fromUrl,
  LookupFailed,
  lookupDoi,
  lookupIsbn,
} from '../../lib/thesis/cite/lookup';
import {
  emptyRef,
  newId,
  normalizeDoi,
  normalizeIsbn,
  normalizePages,
  parsePeople,
  peopleText,
  REF_TYPES,
  sortKey,
  type Ref,
  type RefType,
} from '../../lib/thesis/cite/model';

// Bahasa dari halaman (prop) supaya render server dan browser sama.
const props = defineProps<{ m: Record<string, string>; locale?: Locale }>();
const m = props.m as ToolMessages<'biblio'>;

// --- Penyimpanan ---------------------------------------------------------------------------------
const STORE = 'toolland-bibliography';
const style = ref<Style>('apa');
const lang = ref<Lang>(props.locale ?? pageLocale());
const refs = ref<Ref[]>([]);
onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as {
      style?: Style;
      lang?: Lang;
      refs?: Ref[];
    } | null;
    if (saved?.refs) refs.value = saved.refs.map((r) => ({ ...emptyRef(r.type), ...r }));
    if (saved?.style && STYLES.includes(saved.style)) style.value = saved.style;
    if (saved?.lang === 'id' || saved?.lang === 'en') lang.value = saved.lang;
  } catch {
    // Data rusak atau penyimpanan ditolak.
  }
});
watch(
  [refs, style, lang],
  () => {
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({ style: style.value, lang: lang.value, refs: refs.value }),
      );
    } catch {
      // Abaikan.
    }
  },
  { deep: true },
);

// --- Pencarian -----------------------------------------------------------------------------------
const query = ref('');
const busy = ref(false);
const lookupMsg = ref('');
const kind = computed(() => detectInput(query.value));

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function search() {
  const k = kind.value;
  lookupMsg.value = '';
  if (!k) {
    lookupMsg.value = m.errInvalid;
    return;
  }
  if (k === 'url') {
    openForm(fromUrl(query.value, today()));
    lookupMsg.value = m.urlNote;
    return;
  }
  busy.value = true;
  try {
    const r = k === 'doi' ? await lookupDoi(query.value) : await lookupIsbn(query.value);
    openForm(r);
    lookupMsg.value = m.found;
  } catch (e) {
    const code = e instanceof LookupFailed ? e.code : 'network';
    lookupMsg.value =
      code === 'notfound' ? m.errNotFound : code === 'invalid' ? m.errInvalid : m.errNetwork;
    if (code !== 'invalid') {
      // Buka form kosong berisi DOI/ISBN supaya bisa dilanjutkan manual.
      const r = emptyRef(k === 'doi' ? 'journal' : 'book');
      if (k === 'doi') r.doi = normalizeDoi(query.value) ?? '';
      else r.isbn = normalizeIsbn(query.value) ?? '';
      openForm(r);
    }
  } finally {
    busy.value = false;
  }
}

// --- Form ----------------------------------------------------------------------------------------
const draft = ref<Ref | null>(null);
const authorsText = ref('');
const editorsText = ref('');
const editing = ref(false);
const formEl = ref<HTMLElement>();

function openForm(r: Ref, isEdit = false) {
  draft.value = { ...r };
  authorsText.value = peopleText(r.authors);
  editorsText.value = peopleText(r.editors);
  editing.value = isEdit;
  void nextTick(() => formEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
function newManual(type: RefType = 'journal') {
  const r = emptyRef(type);
  if (type === 'web') r.accessed = today();
  openForm(r);
}

const current = computed<Ref | null>(() =>
  draft.value
    ? {
        ...draft.value,
        authors: parsePeople(authorsText.value),
        editors: parsePeople(editorsText.value),
        pages: normalizePages(draft.value.pages),
        doi: normalizeDoi(draft.value.doi) ?? draft.value.doi.trim(),
      }
    : null,
);
const preview = computed(() =>
  current.value ? formatRef(current.value, style.value, lang.value) : [],
);
const canSave = computed(() => !!current.value?.title.trim());

function save() {
  const r = current.value;
  if (!r || !canSave.value) return;
  const i = refs.value.findIndex((x) => x.id === r.id);
  if (i >= 0) refs.value.splice(i, 1, r);
  else refs.value.push({ ...r, id: r.id || newId() });
  draft.value = null;
  query.value = '';
  lookupMsg.value = '';
}
function cancel() {
  draft.value = null;
}
function remove(id: string) {
  refs.value = refs.value.filter((r) => r.id !== id);
}
function move(id: string, dir: -1 | 1) {
  const i = refs.value.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= refs.value.length) return;
  const list = refs.value.slice();
  [list[i], list[j]] = [list[j], list[i]];
  refs.value = list;
}
function clearAll() {
  if (confirm(m.confirmClear)) refs.value = [];
}

/** Kolom yang tampil untuk tiap jenis sumber. */
const FIELDS: Record<RefType, (keyof Ref)[]> = {
  journal: ['container', 'volume', 'issue', 'pages', 'doi', 'url'],
  book: ['edition', 'place', 'publisher', 'isbn', 'doi', 'url'],
  chapter: ['container', 'pages', 'edition', 'place', 'publisher', 'doi', 'url'],
  web: ['container', 'date', 'url', 'accessed'],
  thesis: ['institution', 'place', 'url'],
};
const fieldLabel = (f: keyof Ref, t: RefType) =>
  f === 'container' ? m[`container_${t}` as 'container_journal'] : m[`f_${f}` as 'f_volume'];
const fieldType = (f: keyof Ref) => (f === 'date' || f === 'accessed' ? 'date' : 'text');

// --- Daftar --------------------------------------------------------------------------------------
const list = computed(() => ordered(refs.value, style.value, sortKey));
const formatted = computed(() => entries(list.value, style.value, lang.value));

const copied = ref('');
async function copyAll() {
  const html = toHtml(formatted.value);
  const plain = toPlain(formatted.value);
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
    } else await navigator.clipboard.writeText(plain);
    flash('all');
  } catch {
    try {
      await navigator.clipboard.writeText(plain);
      flash('all');
    } catch {
      // Clipboard ditolak.
    }
  }
}
async function copyCite(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text);
    flash(id);
  } catch {
    // Clipboard ditolak.
  }
}
function flash(key: string) {
  copied.value = key;
  setTimeout(() => (copied.value = ''), 1500);
}

function downloadDocx() {
  const bytes = toDocx(formatted.value, lang.value === 'id' ? m.docHeadingId : m.docHeadingEn);
  downloadBlob(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    'daftar-pustaka.docx',
  );
}
const downloadBib = () =>
  downloadText(toBibtex(list.value), 'daftar-pustaka.bib', 'application/x-bibtex');
const downloadRis = () =>
  downloadText(toRis(list.value), 'daftar-pustaka.ris', 'application/x-research-info-systems');
</script>

<template>
  <div class="space-y-5">
    <section class="card space-y-3" :aria-label="m.styleHead">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="m.styleHead">
          <button
            v-for="s in STYLES"
            :key="s"
            type="button"
            role="radio"
            :aria-checked="style === s"
            class="rounded-full border px-4 py-1.5 text-sm"
            :class="
              style === s
                ? 'border-brand-600 bg-brand-600/10 font-semibold dark:border-brand-400'
                : 'border-rule'
            "
            :data-bib-style="s"
            @click="style = s"
          >
            {{ m[`style_${s}`] }}
          </button>
        </div>
        <label class="flex items-center gap-2 text-sm">
          {{ m.lang }}
          <select v-model="lang" class="field w-32 py-1" data-bib-lang>
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <p class="text-xs text-ink-2">{{ m[`styleNote_${style}`] }}</p>
    </section>

    <section class="card space-y-3" :aria-label="m.searchHead">
      <h2 class="font-display text-xl">{{ m.searchHead }}</h2>
      <form class="flex flex-wrap gap-2" @submit.prevent="search">
        <label for="bib-q" class="sr-only">{{ m.searchHead }}</label>
        <input
          id="bib-q"
          v-model="query"
          class="field min-w-0 flex-1"
          :placeholder="m.searchPlaceholder"
          autocomplete="off"
          data-bib-query
        />
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="busy || !query.trim()"
          data-bib-search
        >
          {{ busy ? m.searching : m.search }}
        </button>
      </form>
      <p class="text-xs text-ink-2">{{ m.searchHint }}</p>
      <p v-if="lookupMsg" class="text-sm" data-bib-msg aria-live="polite">{{ lookupMsg }}</p>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-ink-2">{{ m.manual }}</span>
        <button
          v-for="t in REF_TYPES"
          :key="t"
          type="button"
          class="rounded-full border border-rule px-3 py-1"
          :data-bib-new="t"
          @click="newManual(t)"
        >
          {{ m[`type_${t}`] }}
        </button>
      </div>
    </section>

    <section
      v-if="draft && current"
      ref="formEl"
      class="card space-y-3 ring-2 ring-brand-600/40"
      :aria-label="editing ? m.editHead : m.addHead"
      data-bib-form
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-xl">{{ editing ? m.editHead : m.addHead }}</h2>
        <label class="flex items-center gap-2 text-sm">
          {{ m.type }}
          <select v-model="draft.type" class="field w-44 py-1" data-bib-type>
            <option v-for="t in REF_TYPES" :key="t" :value="t">{{ m[`type_${t}`] }}</option>
          </select>
        </label>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <label class="space-y-1 text-sm md:row-span-2">
          <span class="block font-semibold">{{ m.f_authors }}</span>
          <textarea
            v-model="authorsText"
            class="field h-28"
            :placeholder="m.authorsPlaceholder"
            data-bib-authors
          />
          <span class="block text-xs text-ink-2">{{ m.authorsHint }}</span>
        </label>
        <label class="space-y-1 text-sm">
          <span class="block font-semibold">{{ m.f_title }}</span>
          <input v-model="draft.title" class="field" data-bib-title />
        </label>
        <label class="space-y-1 text-sm">
          <span class="block font-semibold">{{ m.f_year }}</span>
          <input
            v-model="draft.year"
            class="field w-32"
            inputmode="numeric"
            maxlength="9"
            data-bib-year
          />
        </label>
        <label v-if="draft.type === 'thesis'" class="space-y-1 text-sm">
          <span class="block font-semibold">{{ m.f_thesisKind }}</span>
          <select v-model="draft.thesisKind" class="field" data-bib-thesis-kind>
            <option value="skripsi">{{ m.kind_skripsi }}</option>
            <option value="tesis">{{ m.kind_tesis }}</option>
            <option value="disertasi">{{ m.kind_disertasi }}</option>
          </select>
        </label>
        <label v-if="draft.type === 'chapter'" class="space-y-1 text-sm">
          <span class="block font-semibold">{{ m.f_editors }}</span>
          <textarea v-model="editorsText" class="field h-20" :placeholder="m.authorsPlaceholder" />
        </label>
        <label v-for="f in FIELDS[draft.type]" :key="f" class="space-y-1 text-sm">
          <span class="block font-semibold">{{ fieldLabel(f, draft.type) }}</span>
          <input
            v-model="draft[f] as string"
            :type="fieldType(f)"
            class="field"
            :data-bib-field="f"
          />
        </label>
      </div>
      <div class="rounded border border-rule bg-paper-2 p-3">
        <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-2">{{ m.preview }}</p>
        <p class="font-serif text-sm leading-relaxed" data-bib-preview>
          <template v-for="(r, k) in preview" :key="k"
            ><i v-if="r.i">{{ r.text }}</i
            ><template v-else>{{ r.text }}</template></template
          >
        </p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn" @click="cancel">{{ m.cancel }}</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!canSave"
          data-bib-save
          @click="save"
        >
          {{ editing ? m.saveEdit : m.add }}
        </button>
      </div>
    </section>

    <section class="card space-y-3" :aria-label="m.listHead" data-bib-list>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-xl">
          {{ m.listHead }} <span class="text-base text-ink-2">({{ refs.length }})</span>
        </h2>
        <div v-if="refs.length" class="flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" data-bib-copy @click="copyAll">
            {{ copied === 'all' ? m.copied : m.copyAll }}
          </button>
          <button type="button" class="btn" data-bib-docx @click="downloadDocx">Word</button>
          <button type="button" class="btn" data-bib-bib @click="downloadBib">BibTeX</button>
          <button type="button" class="btn" data-bib-ris @click="downloadRis">RIS</button>
          <button type="button" class="btn" data-bib-clear @click="clearAll">
            {{ m.clearAll }}
          </button>
        </div>
      </div>
      <p v-if="!refs.length" class="text-sm text-ink-2">{{ m.empty }}</p>
      <p v-else class="text-xs text-ink-2">
        {{ style === 'ieee' ? m.orderIeee : m.orderAlpha }}
      </p>
      <ol class="space-y-3">
        <li
          v-for="(e, k) in formatted"
          :key="e.ref.id"
          class="rounded border border-rule p-3"
          data-bib-entry
        >
          <p class="pl-8 -indent-8 font-serif text-sm leading-relaxed" data-bib-text>
            <span v-if="e.n" class="mr-1">[{{ e.n }}]</span
            ><template v-for="(r, j) in e.runs" :key="j"
              ><i v-if="r.i">{{ r.text }}</i
              ><template v-else>{{ r.text }}</template></template
            >
          </p>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              class="rounded border border-rule px-2 py-0.5"
              :title="m.copyCite"
              data-bib-cite
              @click="copyCite(inText(e.ref, style, lang, e.n), e.ref.id)"
            >
              {{ m.inText }}: <strong>{{ inText(e.ref, style, lang, e.n) }}</strong>
              <span v-if="copied === e.ref.id" class="ml-1">✓</span>
            </button>
            <span class="flex-1" />
            <template v-if="style === 'ieee'">
              <button
                type="button"
                class="rounded border border-rule px-2 py-0.5"
                :disabled="k === 0"
                :aria-label="m.moveUp"
                @click="move(e.ref.id, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="rounded border border-rule px-2 py-0.5"
                :disabled="k === formatted.length - 1"
                :aria-label="m.moveDown"
                @click="move(e.ref.id, 1)"
              >
                ↓
              </button>
            </template>
            <button
              type="button"
              class="rounded border border-rule px-2 py-0.5"
              data-bib-edit
              @click="openForm(e.ref, true)"
            >
              {{ m.edit }}
            </button>
            <button
              type="button"
              class="rounded border border-rule px-2 py-0.5 hover:text-red-700"
              data-bib-remove
              @click="remove(e.ref.id)"
            >
              {{ m.remove }}
            </button>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
