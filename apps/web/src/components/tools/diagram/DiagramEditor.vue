<script setup lang="ts">
/**
 * Editor Diagram: toolbar, panel shape (kiri), kanvas maxGraph, dan panel format (kanan).
 * Bisa layar penuh. Diagram disimpan otomatis di browser dan bisa dibuka/disimpan sebagai
 * .drawio, atau diekspor ke PNG dan SVG. Logika kanvas ada di lib/diagram/editor.ts.
 */
import '@maxgraph/core/css/common.css';
import type { Cell, CellStyle } from '@maxgraph/core';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import IconAlignB from '~icons/lucide/align-end-horizontal';
import IconAlignC from '~icons/lucide/align-center-vertical';
import IconAlignL from '~icons/lucide/align-start-vertical';
import IconAlignM from '~icons/lucide/align-center-horizontal';
import IconAlignR from '~icons/lucide/align-end-vertical';
import IconAlignT from '~icons/lucide/align-start-horizontal';
import IconBold from '~icons/lucide/bold';
import IconFront from '~icons/lucide/bring-to-front';
import IconChevron from '~icons/lucide/chevron-down';
import IconCopy from '~icons/lucide/copy';
import IconDistH from '~icons/lucide/align-horizontal-distribute-center';
import IconDistV from '~icons/lucide/align-vertical-distribute-center';
import IconDownload from '~icons/lucide/download';
import IconExpand from '~icons/lucide/expand';
import IconFit from '~icons/lucide/scan';
import IconNew from '~icons/lucide/file-plus';
import IconGroup from '~icons/lucide/group';
import IconItalic from '~icons/lucide/italic';
import IconOpen from '~icons/lucide/folder-open';
import IconPanelL from '~icons/lucide/panel-left';
import IconPanelR from '~icons/lucide/panel-right';
import IconRedo from '~icons/lucide/redo-2';
import IconSave from '~icons/lucide/save';
import IconSearch from '~icons/lucide/search';
import IconBack from '~icons/lucide/send-to-back';
import IconShrink from '~icons/lucide/shrink';
import IconTextC from '~icons/lucide/align-center';
import IconTextL from '~icons/lucide/align-left';
import IconTextR from '~icons/lucide/align-right';
import IconTrash from '~icons/lucide/trash-2';
import IconUnderline from '~icons/lucide/underline';
import IconUndo from '~icons/lucide/undo-2';
import IconUngroup from '~icons/lucide/ungroup';
import IconZoomIn from '~icons/lucide/zoom-in';
import IconZoomOut from '~icons/lucide/zoom-out';
import type { ToolMessages } from '../../../i18n';
import { downloadBlob, downloadText } from '../../../lib/download';
import { pageLocale } from '../../../lib/format';
import { DrawioError } from '../../../lib/diagram/drawio';
import { DiagramEditor, libraryPreviews } from '../../../lib/diagram/editor';
import { LIBRARY, searchLibrary, type LibItem } from '../../../lib/diagram/library';

const props = defineProps<{ m: Record<string, string> }>();
const m = props.m as ToolMessages<'diagram'>;
const lang = pageLocale();

// --- Editor ----------------------------------------------------------------------------------------
const canvasEl = ref<HTMLDivElement>();
const root = ref<HTMLDivElement>();
const editor = shallowRef<DiagramEditor | null>(null);
const selection = shallowRef<Cell[]>([]);
const style = ref<CellStyle | null>(null);
const scale = ref(1);
const canUndo = ref(false);
const canRedo = ref(false);
const empty = ref(true);
const page = reactive({ grid: true, gridSize: 10, background: '#ffffff' });
const title = ref(m.untitled);
const status = ref('');

const STORE = 'toolland-diagram';
/** Sedang memulihkan diagram tersimpan: perubahan model tidak perlu disimpan ulang. */
let restoring = false;
let saveTimer: number | undefined;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveNow, 600);
}
function saveNow() {
  const ed = editor.value;
  if (!ed) return;
  try {
    localStorage.setItem(STORE, JSON.stringify({ title: title.value, xml: ed.toModelXml() }));
    status.value = m.saved;
  } catch {
    status.value = m.saveFailed;
  }
}
watch(title, () => {
  // Judul yang diisi saat memulihkan diagram tidak perlu memicu simpan ulang.
  if (!restoring) scheduleSave();
});

function refreshStyle() {
  const ed = editor.value;
  if (!ed) return;
  selection.value = ed.selection();
  style.value = ed.selectionStyle();
  empty.value = ed.isEmpty();
}

onMounted(async () => {
  await nextTick();
  if (!canvasEl.value) return;
  const ed = new DiagramEditor(canvasEl.value, {
    select: refreshStyle,
    change: () => {
      refreshStyle();
      if (restoring) return;
      status.value = m.saving;
      scheduleSave();
    },
    zoom: (s) => (scale.value = s),
    history: (u, r) => {
      canUndo.value = u;
      canRedo.value = r;
    },
  });
  editor.value = ed;
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as {
      title?: string;
      xml?: string;
    } | null;
    if (saved?.xml) {
      restoring = true;
      ed.loadModelXml(saved.xml);
      if (saved.title) title.value = saved.title;
      Object.assign(page, ed.getSettings());
      ed.fit();
      status.value = m.restored;
    }
  } catch {
    // Data rusak: mulai kosong.
  } finally {
    await nextTick();
    restoring = false;
  }
  refreshStyle();
  buildPreviews();
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('keydown', onWindowKey);
});
onBeforeUnmount(() => {
  window.clearTimeout(saveTimer);
  saveNow();
  editor.value?.destroy();
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('keydown', onWindowKey);
  document.documentElement.classList.remove('overflow-hidden');
});

// --- Pustaka shape -----------------------------------------------------------------------------
const query = ref('');
const open = reactive<Record<string, boolean>>(
  Object.fromEntries(LIBRARY.map((g) => [g.id, true])),
);
const previews = shallowRef(new Map<string, string>());
const found = computed(() => searchLibrary(LIBRARY, query.value));
const itemName = (it: LibItem) => it.name[lang];

function buildPreviews() {
  previews.value = libraryPreviews(LIBRARY.flatMap((g) => g.items));
  void nextTick(bindDrag);
}

/** Pasang seret-ke-kanvas pada tombol pustaka yang baru dirender. */
const bound = new WeakSet<Element>();
function bindDrag() {
  const ed = editor.value;
  if (!ed || !root.value) return;
  for (const el of Array.from(root.value.querySelectorAll<HTMLElement>('[data-dg-item]'))) {
    if (bound.has(el)) continue;
    const item = LIBRARY.flatMap((g) => g.items).find((i) => i.id === el.dataset.dgItem);
    if (!item) continue;
    const ghost = document.createElement('div');
    const s = ed.graph.getView().scale;
    ghost.style.cssText = `width:${item.w * s}px;height:${Math.max(item.h, 2) * s}px;border:1px dashed #9a3412;background:rgba(154,52,18,.06);margin-left:-${(item.w * s) / 2}px;margin-top:-${(Math.max(item.h, 2) * s) / 2}px`;
    ed.makeDraggable(el, item, ghost);
    bound.add(el);
  }
}
watch([query, () => ({ ...open })], () => void nextTick(bindDrag));

function addItem(it: LibItem) {
  editor.value?.insert(it);
  canvasEl.value?.focus({ preventScroll: true });
}

// --- Format ------------------------------------------------------------------------------------
const kind = computed<'none' | 'vertex' | 'edge' | 'mixed'>(() => {
  const s = selection.value;
  if (!s.length) return 'none';
  if (s.every((c) => c.isEdge())) return 'edge';
  if (s.every((c) => c.isVertex())) return 'vertex';
  return 'mixed';
});
const isText = computed(() => {
  const c = selection.value[0];
  return !!c?.getStyle()?.baseStyleNames?.includes('text');
});

function set<K extends keyof CellStyle>(key: K, value: CellStyle[K] | null) {
  editor.value?.setStyle(key, value);
  refreshStyle();
}
const str = (k: keyof CellStyle, fallback = '') => String(style.value?.[k] ?? fallback);
const numOf = (k: keyof CellStyle, fallback: number) => Number(style.value?.[k] ?? fallback);
const flag = (k: keyof CellStyle) => {
  const v = style.value?.[k];
  return v === true || v === 1 || v === '1';
};
const colorOf = (k: keyof CellStyle, fallback: string) => {
  const v = str(k, fallback);
  return /^#[0-9a-f]{6}$/i.test(v)
    ? v
    : /^#[0-9a-f]{3}$/i.test(v)
      ? v.replace(/(\w)/g, '$1$1')
      : fallback;
};
const isNone = (k: keyof CellStyle) => str(k) === 'none';
const fontFlag = (bit: number) => (numOf('fontStyle', 0) & bit) !== 0;

const SWATCHES = [
  '#ffffff',
  '#f3f4f6',
  '#fde68a',
  '#fecaca',
  '#bbf7d0',
  '#bfdbfe',
  '#ddd6fe',
  '#fed7aa',
  '#1f2937',
  '#9a3412',
];
const FONTS = ['Helvetica', 'Arial', 'Verdana', 'Times New Roman', 'Georgia', 'Courier New'];
const ARROWS = ['none', 'classic', 'block', 'open', 'oval', 'diamond'] as const;

// Posisi dan ukuran (satu shape).
const geo = computed(() => {
  const c = selection.value[0];
  if (selection.value.length !== 1 || !c?.isVertex()) return null;
  const g = c.getGeometry();
  return g ? { x: g.x, y: g.y, w: g.width, h: g.height } : null;
});
function setGeo(field: 'x' | 'y' | 'w' | 'h', value: number) {
  const ed = editor.value;
  const c = selection.value[0];
  const g0 = c?.getGeometry();
  if (!ed || !c || !g0 || !Number.isFinite(value)) return;
  const g = g0.clone();
  if (field === 'x') g.x = value;
  if (field === 'y') g.y = value;
  if (field === 'w') g.width = Math.max(1, value);
  if (field === 'h') g.height = Math.max(1, value);
  ed.graph.getDataModel().setGeometry(c, g);
  refreshStyle();
}

function setPage<K extends keyof typeof page>(k: K, v: (typeof page)[K]) {
  page[k] = v;
  editor.value?.setSettings({ [k]: v });
}

// --- File --------------------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement>();
const exportOpen = ref(false);
const message = ref('');

function slug(s: string) {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'diagram'
  );
}

function newDiagram() {
  const ed = editor.value;
  if (!ed) return;
  if (!ed.isEmpty() && !confirm(m.confirmNew)) return;
  ed.clear();
  title.value = m.untitled;
  Object.assign(page, { grid: true, gridSize: 10, background: '#ffffff' });
  ed.setSettings({ ...page });
  refreshStyle();
}

async function openFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  const ed = editor.value;
  if (!file || !ed) return;
  if (!ed.isEmpty() && !confirm(m.confirmOpen)) return;
  try {
    const pages = ed.loadFile(await file.text());
    title.value = file.name.replace(/\.(drawio|dio|xml)$/i, '') || m.untitled;
    Object.assign(page, ed.getSettings());
    message.value = pages.length > 1 ? m.multiPage.replace('{n}', String(pages.length)) : '';
    refreshStyle();
    scheduleSave();
  } catch (err) {
    message.value = err instanceof DrawioError ? m.openError : m.openError;
  }
}

function saveFile() {
  const ed = editor.value;
  if (!ed) return;
  downloadText(ed.toFile(title.value), `${slug(title.value)}.drawio`, 'application/xml');
}

async function exportAs(kindOut: 'png' | 'png-t' | 'svg') {
  exportOpen.value = false;
  const ed = editor.value;
  if (!ed || ed.isEmpty()) return;
  const sel = ed.selection().length > 0 && exportSelection.value;
  if (kindOut === 'svg') {
    const { svg } = ed.toSvg({ selectionOnly: sel });
    downloadText(svg, `${slug(title.value)}.svg`, 'image/svg+xml');
  } else {
    const blob = await ed.toPng(pngScale.value, kindOut === 'png-t', sel);
    downloadBlob(blob, `${slug(title.value)}.png`);
  }
}
const pngScale = ref(2);
const exportSelection = ref(false);

// --- Layar penuh dan panel -----------------------------------------------------------------------
const full = ref(false);
const showLeft = ref(true);
const showRight = ref(true);
onMounted(() => {
  if (window.matchMedia('(max-width: 1023px)').matches) {
    showLeft.value = false;
    showRight.value = false;
  }
});
async function toggleFull() {
  if (full.value) {
    full.value = false;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  } else {
    full.value = true;
    await root.value?.requestFullscreen?.().catch(() => {});
  }
  await nextTick();
  editor.value?.graph.sizeDidChange();
}
function onFullscreenChange() {
  if (!document.fullscreenElement && full.value) full.value = false;
}
function onWindowKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && full.value && !document.fullscreenElement) full.value = false;
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === 's' &&
    root.value?.contains(document.activeElement)
  ) {
    e.preventDefault();
    saveFile();
  }
}
watch(full, (f) => document.documentElement.classList.toggle('overflow-hidden', f));

const zoomText = computed(() => `${Math.round(scale.value * 100)}%`);
const ed = () => editor.value!;
</script>

<template>
  <div
    ref="root"
    class="flex flex-col overflow-hidden rounded-md border border-rule bg-paper text-ink"
    :class="
      full ? 'fixed inset-0 z-50 rounded-none border-0' : 'h-[calc(100vh-7rem)] min-h-[560px]'
    "
    data-dg-root
  >
    <!-- Toolbar -->
    <div
      class="flex flex-wrap items-center gap-1 border-b border-rule bg-paper-2 px-2 py-1.5 text-sm"
    >
      <button
        type="button"
        class="dg-btn"
        :title="m.panelShapes"
        :aria-pressed="showLeft"
        @click="showLeft = !showLeft"
      >
        <IconPanelL aria-hidden="true" />
      </button>
      <input
        v-model="title"
        class="w-40 rounded border border-transparent bg-transparent px-1.5 py-0.5 font-semibold hover:border-rule focus:border-brand-600 focus:outline-none sm:w-56"
        :aria-label="m.titleLabel"
        data-dg-title
      />
      <span class="dg-sep" />
      <button type="button" class="dg-btn" :title="m.new" data-dg-new @click="newDiagram">
        <IconNew aria-hidden="true" />
      </button>
      <button type="button" class="dg-btn" :title="m.open" data-dg-open @click="fileInput?.click()">
        <IconOpen aria-hidden="true" />
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".drawio,.dio,.xml,application/xml,text/xml"
        class="hidden"
        data-dg-file
        @change="openFile"
      />
      <button
        type="button"
        class="dg-btn"
        :title="`${m.save} (Ctrl+S)`"
        data-dg-save
        @click="saveFile"
      >
        <IconSave aria-hidden="true" />
      </button>
      <div class="relative">
        <button
          type="button"
          class="dg-btn gap-1 px-2"
          :aria-expanded="exportOpen"
          data-dg-export
          @click="exportOpen = !exportOpen"
        >
          <IconDownload aria-hidden="true" /><span class="hidden sm:inline">{{ m.export }}</span
          ><IconChevron class="size-3" aria-hidden="true" />
        </button>
        <div
          v-if="exportOpen"
          class="absolute left-0 top-full z-20 mt-1 w-60 space-y-2 rounded border border-rule bg-paper p-2 shadow-lg"
          data-dg-export-menu
        >
          <button type="button" class="dg-menu" data-dg-export-png @click="exportAs('png')">
            PNG
          </button>
          <button type="button" class="dg-menu" data-dg-export-pngt @click="exportAs('png-t')">
            {{ m.pngTransparent }}
          </button>
          <button type="button" class="dg-menu" data-dg-export-svg @click="exportAs('svg')">
            SVG
          </button>
          <label class="flex items-center justify-between gap-2 px-2 text-xs">
            {{ m.pngScale }}
            <select v-model.number="pngScale" class="field w-20 py-0.5 text-xs">
              <option :value="1">1×</option>
              <option :value="2">2×</option>
              <option :value="3">3×</option>
              <option :value="4">4×</option>
            </select>
          </label>
          <label class="flex items-center gap-2 px-2 text-xs">
            <input v-model="exportSelection" type="checkbox" /> {{ m.exportSelection }}
          </label>
        </div>
      </div>
      <span class="dg-sep" />
      <button
        type="button"
        class="dg-btn"
        :title="`${m.undo} (Ctrl+Z)`"
        :disabled="!canUndo"
        data-dg-undo
        @click="ed().doUndo()"
      >
        <IconUndo aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="`${m.redo} (Ctrl+Y)`"
        :disabled="!canRedo"
        data-dg-redo
        @click="ed().doRedo()"
      >
        <IconRedo aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="`${m.delete} (Delete)`"
        :disabled="!selection.length"
        data-dg-delete
        @click="ed().remove()"
      >
        <IconTrash aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn hidden sm:inline-flex"
        :title="m.toFront"
        :disabled="!selection.length"
        @click="ed().toFront()"
      >
        <IconFront aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn hidden sm:inline-flex"
        :title="m.toBack"
        :disabled="!selection.length"
        @click="ed().toBack()"
      >
        <IconBack aria-hidden="true" />
      </button>
      <span class="dg-sep" />
      <button
        type="button"
        class="dg-btn"
        :title="m.zoomOut"
        data-dg-zoom-out
        @click="ed().zoom(1 / 1.2)"
      >
        <IconZoomOut aria-hidden="true" />
      </button>
      <button
        type="button"
        class="min-w-12 rounded px-1 py-1 text-xs tabular-nums hover:bg-rule/40"
        :title="m.zoomReset"
        data-dg-zoom
        @click="ed().zoomTo(1)"
      >
        {{ zoomText }}
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="m.zoomIn"
        data-dg-zoom-in
        @click="ed().zoom(1.2)"
      >
        <IconZoomIn aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="`${m.fit} (Ctrl+Shift+H)`"
        data-dg-fit
        @click="ed().fit()"
      >
        <IconFit aria-hidden="true" />
      </button>
      <span class="flex-1" />
      <span class="hidden text-xs text-ink-2 md:inline" aria-live="polite" data-dg-status>{{
        status
      }}</span>
      <button type="button" class="dg-btn gap-1 px-2" data-dg-full @click="toggleFull">
        <component :is="full ? IconShrink : IconExpand" aria-hidden="true" />
        <span class="hidden sm:inline">{{ full ? m.exitFullscreen : m.fullscreen }}</span>
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="m.panelFormat"
        :aria-pressed="showRight"
        @click="showRight = !showRight"
      >
        <IconPanelR aria-hidden="true" />
      </button>
    </div>
    <p
      v-if="message"
      class="border-b border-rule bg-amber-700/10 px-3 py-1 text-xs"
      data-dg-message
    >
      {{ message }}
      <button type="button" class="ml-2 underline" @click="message = ''">{{ m.dismiss }}</button>
    </p>

    <div class="relative flex min-h-0 flex-1">
      <!-- Panel shape -->
      <aside
        v-show="showLeft"
        class="absolute inset-y-0 left-0 z-10 flex w-64 shrink-0 flex-col border-r border-rule bg-paper shadow-lg lg:static lg:shadow-none"
        :aria-label="m.panelShapes"
        data-dg-library
      >
        <div class="relative border-b border-rule p-2">
          <IconSearch
            class="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-2"
            aria-hidden="true"
          />
          <input
            v-model="query"
            class="field py-1.5 pl-8 text-sm"
            :placeholder="m.searchShapes"
            :aria-label="m.searchShapes"
            data-dg-search
          />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2 text-sm">
          <template v-if="query.trim()">
            <p v-if="!found.length" class="px-1 text-xs text-ink-2">{{ m.noShapes }}</p>
            <div class="grid grid-cols-4 gap-1">
              <button
                v-for="it in found"
                :key="it.id"
                type="button"
                class="dg-item"
                :title="itemName(it)"
                :aria-label="itemName(it)"
                :data-dg-item="it.id"
                @click="addItem(it)"
              >
                <!-- eslint-disable-next-line vue/no-v-html -- SVG dibuat sendiri dari pustaka shape -->
                <span class="pointer-events-none" v-html="previews.get(it.id) ?? ''" />
              </button>
            </div>
          </template>
          <template v-else>
            <section v-for="g in LIBRARY" :key="g.id" class="mb-2">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded px-1 py-1 text-xs font-semibold uppercase tracking-wide text-ink-2 hover:bg-rule/30"
                :aria-expanded="open[g.id]"
                @click="open[g.id] = !open[g.id]"
              >
                {{ g.name[lang] }}
                <IconChevron
                  class="size-3 transition"
                  :class="open[g.id] ? '' : '-rotate-90'"
                  aria-hidden="true"
                />
              </button>
              <div v-show="open[g.id]" class="grid grid-cols-4 gap-1 pt-1">
                <button
                  v-for="it in g.items"
                  :key="it.id"
                  type="button"
                  class="dg-item"
                  :title="itemName(it)"
                  :aria-label="itemName(it)"
                  :data-dg-item="it.id"
                  @click="addItem(it)"
                >
                  <!-- eslint-disable-next-line vue/no-v-html -- SVG dibuat sendiri dari pustaka shape -->
                  <span class="pointer-events-none" v-html="previews.get(it.id) ?? ''" />
                </button>
              </div>
            </section>
            <p class="mt-3 rounded border border-dashed border-rule p-2 text-xs text-ink-2">
              {{ m.moreSoon }}
            </p>
          </template>
        </div>
      </aside>

      <!-- Kanvas -->
      <div class="relative min-w-0 flex-1">
        <div
          ref="canvasEl"
          class="dg-canvas absolute inset-0 overflow-hidden outline-none"
          :aria-label="m.canvas"
          role="application"
          data-dg-canvas
        />
        <div
          v-if="empty"
          class="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center"
          data-dg-empty
        >
          <div
            class="max-w-sm space-y-1 rounded-md bg-paper/80 p-4 text-sm text-ink-2 backdrop-blur-sm"
          >
            <p class="font-display text-lg text-ink">{{ m.emptyTitle }}</p>
            <p>{{ m.emptyBody }}</p>
          </div>
        </div>
      </div>

      <!-- Panel format -->
      <aside
        v-show="showRight"
        class="absolute inset-y-0 right-0 z-10 w-72 shrink-0 overflow-y-auto border-l border-rule bg-paper p-3 text-sm shadow-lg lg:static lg:shadow-none"
        :aria-label="m.panelFormat"
        data-dg-format
      >
        <!-- Tanpa seleksi: pengaturan halaman -->
        <template v-if="kind === 'none'">
          <h3 class="dg-h">{{ m.pageHead }}</h3>
          <label class="dg-row"
            ><span>{{ m.grid }}</span
            ><input
              type="checkbox"
              :checked="page.grid"
              data-dg-grid
              @change="setPage('grid', ($event.target as HTMLInputElement).checked)"
          /></label>
          <label class="dg-row"
            ><span>{{ m.gridSize }}</span>
            <input
              type="number"
              min="5"
              max="100"
              step="5"
              class="field w-20 py-1"
              :value="page.gridSize"
              @change="
                setPage(
                  'gridSize',
                  Math.max(5, Number(($event.target as HTMLInputElement).value) || 10),
                )
              "
            />
          </label>
          <label class="dg-row"
            ><span>{{ m.background }}</span>
            <input
              type="color"
              class="h-7 w-10 cursor-pointer rounded border border-rule"
              :value="page.background === 'none' ? '#ffffff' : page.background"
              data-dg-bg
              @input="setPage('background', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <h3 class="dg-h mt-4">{{ m.tipsHead }}</h3>
          <ul class="space-y-1 text-xs text-ink-2">
            <li
              v-for="k in [
                'tipDrag',
                'tipConnect',
                'tipEdit',
                'tipPan',
                'tipZoom',
                'tipSelect',
                'tipKeys',
              ]"
              :key="k"
            >
              {{ m[k as 'tipDrag'] }}
            </li>
          </ul>
        </template>

        <template v-else>
          <p class="mb-2 text-xs text-ink-2" data-dg-selcount>
            {{ m.selected.replace('{n}', String(selection.length)) }}
          </p>

          <!-- Gaya shape -->
          <template v-if="kind !== 'edge' && !isText">
            <h3 class="dg-h">{{ m.styleHead }}</h3>
            <div class="mb-2 flex flex-wrap gap-1">
              <button
                v-for="c in SWATCHES"
                :key="c"
                type="button"
                class="size-6 rounded border border-rule"
                :style="{ background: c }"
                :title="c"
                :aria-label="`${m.fill} ${c}`"
                @click="set('fillColor', c)"
              />
            </div>
            <div class="dg-row">
              <span>{{ m.fill }}</span>
              <span class="flex items-center gap-2">
                <label class="flex items-center gap-1 text-xs"
                  ><input
                    type="checkbox"
                    :checked="isNone('fillColor')"
                    @change="
                      set(
                        'fillColor',
                        ($event.target as HTMLInputElement).checked ? 'none' : '#ffffff',
                      )
                    "
                  />{{ m.none }}</label
                >
                <input
                  type="color"
                  class="h-7 w-10 cursor-pointer rounded border border-rule"
                  :value="colorOf('fillColor', '#ffffff')"
                  :disabled="isNone('fillColor')"
                  data-dg-fill
                  @input="set('fillColor', ($event.target as HTMLInputElement).value)"
                />
              </span>
            </div>
          </template>
          <h3 v-if="kind === 'edge'" class="dg-h">{{ m.lineHead }}</h3>
          <template v-if="!isText">
            <div class="dg-row">
              <span>{{ kind === 'edge' ? m.lineColor : m.stroke }}</span>
              <span class="flex items-center gap-2">
                <label v-if="kind !== 'edge'" class="flex items-center gap-1 text-xs"
                  ><input
                    type="checkbox"
                    :checked="isNone('strokeColor')"
                    @change="
                      set(
                        'strokeColor',
                        ($event.target as HTMLInputElement).checked ? 'none' : '#1f2937',
                      )
                    "
                  />{{ m.none }}</label
                >
                <input
                  type="color"
                  class="h-7 w-10 cursor-pointer rounded border border-rule"
                  :value="colorOf('strokeColor', '#1f2937')"
                  :disabled="isNone('strokeColor')"
                  data-dg-stroke
                  @input="set('strokeColor', ($event.target as HTMLInputElement).value)"
                />
              </span>
            </div>
            <label class="dg-row"
              ><span>{{ m.strokeWidth }}</span>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                class="field w-20 py-1"
                :value="numOf('strokeWidth', 1)"
                data-dg-stroke-width
                @change="set('strokeWidth', Number(($event.target as HTMLInputElement).value))"
              />
            </label>
            <label class="dg-row"
              ><span>{{ m.dashed }}</span
              ><input
                type="checkbox"
                :checked="flag('dashed')"
                data-dg-dashed
                @change="set('dashed', ($event.target as HTMLInputElement).checked)"
            /></label>
          </template>
          <template v-if="kind === 'vertex' && !isText">
            <label class="dg-row"
              ><span>{{ m.rounded }}</span
              ><input
                type="checkbox"
                :checked="flag('rounded')"
                @change="set('rounded', ($event.target as HTMLInputElement).checked)"
            /></label>
            <label class="dg-row"
              ><span>{{ m.shadow }}</span
              ><input
                type="checkbox"
                :checked="flag('shadow')"
                @change="set('shadow', ($event.target as HTMLInputElement).checked)"
            /></label>
          </template>
          <label v-if="!isText" class="dg-row"
            ><span>{{ m.opacity }}</span>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              class="w-28"
              :value="numOf('opacity', 100)"
              @change="set('opacity', Number(($event.target as HTMLInputElement).value))"
            />
          </label>

          <!-- Garis -->
          <template v-if="kind === 'edge'">
            <label class="dg-row"
              ><span>{{ m.edgeStyle }}</span>
              <select
                class="field w-32 py-1"
                :value="
                  flag('curved')
                    ? 'curved'
                    : str('edgeStyle', 'orthogonalEdgeStyle') === 'none'
                      ? 'straight'
                      : 'orthogonal'
                "
                data-dg-edge-style
                @change="
                  (e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    set('curved', v === 'curved');
                    set('edgeStyle', v === 'orthogonal' ? 'orthogonalEdgeStyle' : 'none');
                  }
                "
              >
                <option value="orthogonal">{{ m.edgeOrthogonal }}</option>
                <option value="straight">{{ m.edgeStraight }}</option>
                <option value="curved">{{ m.edgeCurved }}</option>
              </select>
            </label>
            <label class="dg-row"
              ><span>{{ m.startArrow }}</span>
              <select
                class="field w-32 py-1"
                :value="str('startArrow', 'none')"
                @change="set('startArrow', ($event.target as HTMLSelectElement).value as never)"
              >
                <option v-for="a in ARROWS" :key="a" :value="a">{{ m[`arrow_${a}`] }}</option>
              </select>
            </label>
            <label class="dg-row"
              ><span>{{ m.endArrow }}</span>
              <select
                class="field w-32 py-1"
                :value="str('endArrow', 'classic')"
                data-dg-end-arrow
                @change="set('endArrow', ($event.target as HTMLSelectElement).value as never)"
              >
                <option v-for="a in ARROWS" :key="a" :value="a">{{ m[`arrow_${a}`] }}</option>
              </select>
            </label>
          </template>

          <!-- Teks -->
          <h3 class="dg-h mt-4">{{ m.textHead }}</h3>
          <div class="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="fontFlag(1)"
              :title="m.bold"
              data-dg-bold
              @click="
                ed().toggleFontFlag(1);
                refreshStyle();
              "
            >
              <IconBold aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="fontFlag(2)"
              :title="m.italic"
              @click="
                ed().toggleFontFlag(2);
                refreshStyle();
              "
            >
              <IconItalic aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="fontFlag(4)"
              :title="m.underline"
              @click="
                ed().toggleFontFlag(4);
                refreshStyle();
              "
            >
              <IconUnderline aria-hidden="true" />
            </button>
            <span class="dg-sep" />
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="str('align', 'center') === 'left'"
              :title="m.alignLeft"
              @click="set('align', 'left')"
            >
              <IconTextL aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="str('align', 'center') === 'center'"
              :title="m.alignCenter"
              @click="set('align', 'center')"
            >
              <IconTextC aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="str('align', 'center') === 'right'"
              :title="m.alignRight"
              @click="set('align', 'right')"
            >
              <IconTextR aria-hidden="true" />
            </button>
          </div>
          <label class="dg-row"
            ><span>{{ m.fontSize }}</span>
            <input
              type="number"
              min="6"
              max="96"
              class="field w-20 py-1"
              :value="numOf('fontSize', 12)"
              data-dg-font-size
              @change="set('fontSize', Number(($event.target as HTMLInputElement).value))"
            />
          </label>
          <label class="dg-row"
            ><span>{{ m.fontColor }}</span>
            <input
              type="color"
              class="h-7 w-10 cursor-pointer rounded border border-rule"
              :value="colorOf('fontColor', '#111827')"
              @input="set('fontColor', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="dg-row"
            ><span>{{ m.fontFamily }}</span>
            <select
              class="field w-36 py-1"
              :value="str('fontFamily', 'Helvetica')"
              @change="set('fontFamily', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="f in FONTS" :key="f" :value="f">{{ f }}</option>
            </select>
          </label>
          <label v-if="kind !== 'edge'" class="dg-row"
            ><span>{{ m.verticalAlign }}</span>
            <select
              class="field w-32 py-1"
              :value="str('verticalAlign', 'middle')"
              @change="set('verticalAlign', ($event.target as HTMLSelectElement).value as never)"
            >
              <option value="top">{{ m.vTop }}</option>
              <option value="middle">{{ m.vMiddle }}</option>
              <option value="bottom">{{ m.vBottom }}</option>
            </select>
          </label>

          <!-- Susun -->
          <h3 class="dg-h mt-4">{{ m.arrangeHead }}</h3>
          <div v-if="geo" class="mb-2 grid grid-cols-2 gap-2" data-dg-geo>
            <label
              v-for="f in ['x', 'y', 'w', 'h'] as const"
              :key="f"
              class="flex items-center gap-1 text-xs"
            >
              <span class="w-4 uppercase text-ink-2">{{
                f === 'w' ? 'L' : f === 'h' ? 'T' : f
              }}</span>
              <input
                type="number"
                class="field py-1"
                :value="Math.round(geo[f])"
                :data-dg-geo-field="f"
                @change="setGeo(f, Number(($event.target as HTMLInputElement).value))"
              />
            </label>
          </div>
          <div v-if="selection.length > 1" class="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              class="dg-btn"
              :title="m.alignL"
              data-dg-align-left
              @click="ed().align('left')"
            >
              <IconAlignL aria-hidden="true" />
            </button>
            <button type="button" class="dg-btn" :title="m.alignC" @click="ed().align('center')">
              <IconAlignC aria-hidden="true" />
            </button>
            <button type="button" class="dg-btn" :title="m.alignR" @click="ed().align('right')">
              <IconAlignR aria-hidden="true" />
            </button>
            <button type="button" class="dg-btn" :title="m.alignT" @click="ed().align('top')">
              <IconAlignT aria-hidden="true" />
            </button>
            <button type="button" class="dg-btn" :title="m.alignM" @click="ed().align('middle')">
              <IconAlignM aria-hidden="true" />
            </button>
            <button type="button" class="dg-btn" :title="m.alignB" @click="ed().align('bottom')">
              <IconAlignB aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.distH"
              :disabled="selection.length < 3"
              @click="ed().distribute(true)"
            >
              <IconDistH aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.distV"
              :disabled="selection.length < 3"
              @click="ed().distribute(false)"
            >
              <IconDistV aria-hidden="true" />
            </button>
          </div>
          <div class="flex flex-wrap gap-1">
            <button type="button" class="dg-btn gap-1 px-2 text-xs" @click="ed().toFront()">
              <IconFront aria-hidden="true" />{{ m.toFront }}
            </button>
            <button type="button" class="dg-btn gap-1 px-2 text-xs" @click="ed().toBack()">
              <IconBack aria-hidden="true" />{{ m.toBack }}
            </button>
            <button type="button" class="dg-btn gap-1 px-2 text-xs" @click="ed().duplicate()">
              <IconCopy aria-hidden="true" />{{ m.duplicate }}
            </button>
            <button
              v-if="selection.length > 1"
              type="button"
              class="dg-btn gap-1 px-2 text-xs"
              data-dg-group
              @click="ed().group()"
            >
              <IconGroup aria-hidden="true" />{{ m.group }}
            </button>
            <button
              v-if="selection.length === 1 && selection[0].getChildCount() > 0"
              type="button"
              class="dg-btn gap-1 px-2 text-xs"
              data-dg-ungroup
              @click="ed().ungroup()"
            >
              <IconUngroup aria-hidden="true" />{{ m.ungroup }}
            </button>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.dg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 0.25rem;
}
.dg-btn:hover:not(:disabled) {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.dg-btn:disabled {
  opacity: 0.35;
}
.dg-btn[aria-pressed='true'] {
  background: color-mix(in srgb, var(--color-brand-600, #9a3412) 15%, transparent);
}
.dg-btn :deep(svg) {
  width: 1.05rem;
  height: 1.05rem;
}
.dg-sep {
  width: 1px;
  height: 1.25rem;
  margin: 0 0.25rem;
  background: currentColor;
  opacity: 0.15;
}
.dg-menu {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.35rem 0.5rem;
  border-radius: 0.25rem;
}
.dg-menu:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.dg-item {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  cursor: grab;
}
.dg-item:hover {
  border-color: color-mix(in srgb, currentColor 20%, transparent);
  background: color-mix(in srgb, currentColor 5%, transparent);
}
.dg-h {
  margin-bottom: 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.7;
}
.dg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
/* Kanvas selalu terang supaya warna diagram sama dengan hasil ekspor. */
.dg-canvas {
  color-scheme: light;
  color: #111827;
}
.dg-canvas :deep(div.mxRubberband) {
  border-color: #9a3412;
  background: rgba(154, 52, 18, 0.12);
}
.dg-canvas :deep(.mxCellEditor) {
  outline: none;
}
</style>
