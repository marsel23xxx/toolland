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
import IconEye from '~icons/lucide/eye';
import IconEyeOff from '~icons/lucide/eye-off';
import IconImage from '~icons/lucide/image';
import IconLayout from '~icons/lucide/network';
import IconLock from '~icons/lucide/lock';
import IconLockOpen from '~icons/lucide/lock-open';
import IconMap from '~icons/lucide/map';
import IconMore from '~icons/lucide/ellipsis';
import IconPlus from '~icons/lucide/plus';
import IconTable from '~icons/lucide/table';
import IconTemplate from '~icons/lucide/layout-template';
import IconUp from '~icons/lucide/chevron-up';
import IconX from '~icons/lucide/x';
import IconHelp from '~icons/lucide/keyboard';
import type { ToolMessages } from '../../../i18n';
import { downloadBlob, downloadText } from '../../../lib/download';
import { pageLocale } from '../../../lib/format';
import { readDrawio, toDrawioFile } from '../../../lib/diagram/drawio';
import {
  DiagramEditor,
  libraryPreviews,
  rasterize,
  renderModelSvg,
  type LayerInfo,
  type LayoutKind,
} from '../../../lib/diagram/editor';
import { diagramPdf, type PdfPage, type PdfPaper } from '../../../lib/diagram/pdf';
import { TEMPLATES, type DiagramTemplate } from '../../../lib/diagram/templates';
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

// --- Halaman ---------------------------------------------------------------------------------------
interface Page {
  id: string;
  name: string;
  xml: string;
}
const EMPTY_XML =
  '<mxGraphModel grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
const pages = ref<Page[]>([]);
const current = ref(0);
const newId = () => Math.random().toString(36).slice(2, 9);
const pageName = (n: number) => `${m.pageLabel} ${n}`;

/** Simpan isi kanvas ke halaman aktif. */
function syncCurrent() {
  const ed = editor.value;
  const p = pages.value[current.value];
  if (ed && p) p.xml = ed.toModelXml();
}
function saveNow() {
  if (!editor.value) return;
  syncCurrent();
  try {
    localStorage.setItem(
      STORE,
      JSON.stringify({ title: title.value, pages: pages.value, current: current.value }),
    );
    status.value = m.saved;
  } catch {
    status.value = m.saveFailed;
  }
}
watch(title, () => {
  // Judul yang diisi saat memulihkan diagram tidak perlu memicu simpan ulang.
  if (!restoring) scheduleSave();
});

function showPage(i: number) {
  const ed = editor.value;
  const p = pages.value[i];
  if (!ed || !p) return;
  current.value = i;
  ed.loadModelXml(p.xml);
  Object.assign(page, ed.getSettings());
  ed.fit();
  find.matches = [];
  refreshStyle();
}
function switchPage(i: number) {
  if (i === current.value) return;
  syncCurrent();
  showPage(i);
  scheduleSave();
}
function addPage(xml = EMPTY_XML, name?: string) {
  syncCurrent();
  let n = pages.value.length + 1;
  while (pages.value.some((p) => p.name === pageName(n))) n++;
  pages.value.push({ id: newId(), name: name ?? pageName(n), xml });
  showPage(pages.value.length - 1);
  scheduleSave();
}
function duplicatePage(i: number) {
  syncCurrent();
  const p = pages.value[i];
  pages.value.splice(i + 1, 0, { id: newId(), name: `${p.name} ${m.copySuffix}`, xml: p.xml });
  showPage(i + 1);
  scheduleSave();
}
function deletePage(i: number) {
  if (
    pages.value.length < 2 ||
    !confirm(m.confirmDeletePage.replace('{name}', pages.value[i].name))
  )
    return;
  syncCurrent();
  const wasCurrent = i === current.value;
  pages.value.splice(i, 1);
  const next = Math.min(
    i < current.value ? current.value - 1 : current.value,
    pages.value.length - 1,
  );
  // Halaman lain dihapus: kanvas tetap, hanya indeks yang bergeser.
  if (wasCurrent) showPage(next);
  else current.value = next;
  scheduleSave();
}
const renaming = ref(-1);
function renamePage(i: number, name: string) {
  renaming.value = -1;
  const v = name.trim();
  if (v && pages.value[i]) {
    pages.value[i].name = v;
    scheduleSave();
  }
}

function refreshStyle() {
  const ed = editor.value;
  if (!ed) return;
  selection.value = ed.selection();
  style.value = ed.selectionStyle();
  empty.value = ed.isEmpty();
  layerList.value = ed.layers();
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
    contextMenu: (x, y, cell) => openCtx(x, y, cell),
  });
  editor.value = ed;
  try {
    restoring = true;
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as {
      title?: string;
      xml?: string;
      pages?: Page[];
      current?: number;
    } | null;
    // Simpanan versi lama berisi satu halaman (xml).
    const list = saved?.pages?.length
      ? saved.pages
      : saved?.xml
        ? [{ id: newId(), name: pageName(1), xml: saved.xml }]
        : [];
    if (list.length) {
      pages.value = list.map((p) => ({ id: p.id || newId(), name: p.name, xml: p.xml }));
      if (saved?.title) title.value = saved.title;
      showPage(Math.min(Math.max(0, saved?.current ?? 0), list.length - 1));
      status.value = m.restored;
    } else {
      pages.value = [{ id: newId(), name: pageName(1), xml: EMPTY_XML }];
    }
  } catch {
    // Data rusak: mulai kosong.
    pages.value = [{ id: newId(), name: pageName(1), xml: EMPTY_XML }];
  } finally {
    await nextTick();
    restoring = false;
  }
  refreshStyle();
  buildPreviews();
  document.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('keydown', onWindowKey);
  document.addEventListener('pointerdown', closeMenuOutside);
});
onBeforeUnmount(() => {
  window.clearTimeout(saveTimer);
  saveNow();
  editor.value?.destroy();
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('keydown', onWindowKey);
  document.removeEventListener('pointerdown', closeMenuOutside);
  disposeMap?.();
  document.documentElement.classList.remove('overflow-hidden');
});

// --- Pustaka shape -----------------------------------------------------------------------------
const query = ref('');
// Umum dan Flowchart terbuka; pustaka teknik dibuka saat dibutuhkan (atau lewat pencarian).
const open = reactive<Record<string, boolean>>(
  Object.fromEntries(LIBRARY.map((g) => [g.id, g.id === 'general' || g.id === 'flowchart'])),
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

// --- Menu ----------------------------------------------------------------------------------------
/** Menu tarik-turun yang sedang terbuka (hanya satu). */
const menu = ref<string | null>(null);
const toggleMenu = (id: string) => (menu.value = menu.value === id ? null : id);
function closeMenuOutside(e: PointerEvent) {
  const t = e.target as Element | null;
  if (ctx.open && !t?.closest('[data-dg-ctx]')) ctx.open = false;
  if (menu.value && !t?.closest('[data-dg-menu]')) menu.value = null;
}

// --- File --------------------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement>();
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

const hasContent = () => {
  syncCurrent();
  return pages.value.length > 1 || !editor.value?.isEmpty();
};

function newDiagram() {
  const ed = editor.value;
  if (!ed) return;
  if (hasContent() && !confirm(m.confirmNew)) return;
  pages.value = [{ id: newId(), name: pageName(1), xml: EMPTY_XML }];
  title.value = m.untitled;
  showPage(0);
  ed.clear();
  Object.assign(page, { grid: true, gridSize: 10, background: '#ffffff' });
  ed.setSettings({ ...page });
  refreshStyle();
}

async function openFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !editor.value) return;
  if (hasContent() && !confirm(m.confirmOpen)) return;
  try {
    const read = readDrawio(await file.text());
    pages.value = read.map((p) => ({ id: newId(), name: p.name, xml: p.model }));
    title.value = file.name.replace(/\.(drawio|dio|xml)$/i, '') || m.untitled;
    message.value = '';
    showPage(0);
    scheduleSave();
  } catch {
    message.value = m.openError;
  }
}

function saveFile() {
  if (!editor.value) return;
  syncCurrent();
  const file = toDrawioFile(pages.value.map((p) => ({ name: p.name, model: p.xml })));
  downloadText(file, `${slug(title.value)}.drawio`, 'application/xml');
}

const pngScale = ref(2);
const exportSelection = ref(false);
const pdfAll = ref(true);
const pdfPaper = ref<PdfPaper>('fit');
const exporting = ref(false);

async function exportAs(kindOut: 'png' | 'png-t' | 'svg' | 'pdf') {
  menu.value = null;
  const ed = editor.value;
  if (!ed) return;
  if (kindOut === 'pdf') return exportPdf();
  if (ed.isEmpty()) return;
  const sel = ed.selection().length > 0 && exportSelection.value;
  if (kindOut === 'svg') {
    const { svg } = ed.toSvg({ selectionOnly: sel });
    downloadText(svg, `${slug(title.value)}.svg`, 'image/svg+xml');
  } else {
    const blob = await ed.toPng(pngScale.value, kindOut === 'png-t', sel);
    downloadBlob(blob, `${slug(title.value)}.png`);
  }
}

async function exportPdf() {
  const ed = editor.value;
  if (!ed) return;
  exporting.value = true;
  try {
    syncCurrent();
    // Halaman kosong dilewati (kecuali semuanya kosong).
    const filled = pages.value.filter((p) => /(vertex|edge)="1"/.test(p.xml));
    const list = pdfAll.value
      ? filled.length
        ? filled
        : pages.value
      : [pages.value[current.value]];
    const out: PdfPage[] = [];
    for (const p of list) {
      const r = p === pages.value[current.value] ? ed.toSvg() : renderModelSvg(p.xml);
      const png = await rasterize(r.svg, r.width, r.height, 2);
      out.push({ png: new Uint8Array(await png.arrayBuffer()), width: r.width, height: r.height });
    }
    const bytes = await diagramPdf(out, pdfPaper.value, title.value);
    downloadBlob(
      new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
      `${slug(title.value)}.pdf`,
    );
  } finally {
    exporting.value = false;
  }
}

// --- Template --------------------------------------------------------------------------------------
const tplOpen = ref(false);
const tplThumbs = shallowRef(new Map<string, string>());
async function openTemplates() {
  menu.value = null;
  tplOpen.value = true;
  if (tplThumbs.value.size) return;
  await nextTick();
  const map = new Map<string, string>();
  for (const t of TEMPLATES) {
    try {
      map.set(t.id, renderModelSvg(t.build(lang), { border: 8 }).svg);
    } catch {
      // Pratinjau gagal: kartu tetap bisa dipakai.
    }
  }
  tplThumbs.value = map;
}
function useTemplate(t: DiagramTemplate) {
  tplOpen.value = false;
  addPage(t.build(lang), t.name[lang]);
}

// --- Sisipkan --------------------------------------------------------------------------------------
const imageInput = ref<HTMLInputElement>();
const tblRows = ref(3);
const tblCols = ref(3);
const IMG_MAX = 1200;
async function onImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  menu.value = null;
  if (!file || !editor.value) return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Gambar besar diperkecil supaya diagram (dan simpanan browser) tetap ringan.
    const k = Math.min(1, IMG_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const data = /png|gif|webp|svg/.test(file.type)
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.85);
    const shown = Math.min(1, 320 / Math.max(w, h));
    editor.value.insertImage(data, Math.round(w * shown), Math.round(h * shown));
  } catch {
    message.value = m.imageError;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function insertTable() {
  menu.value = null;
  const r = Math.min(20, Math.max(1, Math.floor(tblRows.value) || 3));
  const c = Math.min(10, Math.max(1, Math.floor(tblCols.value) || 3));
  editor.value?.insertTable(r, c);
}

// --- Tata letak --------------------------------------------------------------------------------------
const LAYOUTS: LayoutKind[] = ['vertical', 'horizontal', 'tree', 'circle', 'organic'];
function doLayout(k: LayoutKind) {
  menu.value = null;
  editor.value?.layout(k);
}

// --- Cari dan ganti ----------------------------------------------------------------------------------
const find = reactive({ open: false, q: '', r: '', i: 0, matches: [] as Cell[], note: '' });
const findInput = ref<HTMLInputElement>();
function openFind() {
  find.open = true;
  void nextTick(() => findInput.value?.select());
}
function runFind() {
  const ed = editor.value;
  find.note = '';
  find.matches = ed ? ed.find(find.q) : [];
  find.i = 0;
  if (find.matches.length) ed?.focusCell(find.matches[0]);
}
function stepFind(d: number) {
  const n = find.matches.length;
  if (!n) return;
  find.i = (find.i + d + n) % n;
  editor.value?.focusCell(find.matches[find.i]);
}
function replaceAll() {
  const ed = editor.value;
  if (!ed || !find.q.trim()) return;
  const n = ed.replaceAll(find.q, find.r);
  find.note = m.replaced.replace('{n}', String(n));
  find.matches = ed.find(find.q);
  find.i = 0;
}

// --- Minimap -----------------------------------------------------------------------------------------
const showMap = ref(false);
const mapEl = ref<HTMLDivElement>();
let disposeMap: (() => void) | undefined;
watch(showMap, async (on) => {
  disposeMap?.();
  disposeMap = undefined;
  if (!on) return;
  await nextTick();
  if (mapEl.value && editor.value) disposeMap = editor.value.outline(mapEl.value);
});

// --- Layer -------------------------------------------------------------------------------------------
const layerList = shallowRef<LayerInfo[]>([]);
const renamingLayer = ref<Cell | null>(null);
function layerAction(fn: (ed: DiagramEditor) => void) {
  const ed = editor.value;
  if (!ed) return;
  fn(ed);
  refreshStyle();
}
function addLayer() {
  layerAction((ed) => ed.addLayer(`Layer ${layerList.value.length + 1}`));
}
function deleteLayer(l: LayerInfo) {
  if (layerList.value.length < 2) return;
  if (l.count && !confirm(m.confirmDeleteLayer.replace('{name}', l.name))) return;
  layerAction((ed) => ed.removeLayer(l.cell));
}
function renameLayer(l: LayerInfo, name: string) {
  renamingLayer.value = null;
  if (name.trim()) layerAction((ed) => ed.renameLayer(l.cell, name.trim()));
}

// --- Menu klik kanan / tekan lama ------------------------------------------------------------------
const ctx = reactive({ open: false, x: 0, y: 0, onCell: false, group: false, paste: false });
const ctxEl = ref<HTMLDivElement>();
function openCtx(x: number, y: number, cell: Cell | null) {
  menu.value = null;
  refreshStyle();
  ctx.onCell = !!cell;
  ctx.group = !!cell && cell.getChildCount() > 0 && !cell.isEdge();
  ctx.paste = !!editor.value?.canPaste();
  // Jaga menu tetap di dalam layar.
  ctx.x = Math.min(x, window.innerWidth - 220);
  ctx.y = Math.min(y, window.innerHeight - 320);
  ctx.open = true;
  void nextTick(() => ctxEl.value?.querySelector<HTMLButtonElement>('button')?.focus());
}
function ctxRun(fn: (ed: DiagramEditor) => void) {
  ctx.open = false;
  const ed = editor.value;
  if (!ed) return;
  fn(ed);
  canvasEl.value?.focus({ preventScroll: true });
  refreshStyle();
}

// --- Panel pintasan -------------------------------------------------------------------------------------
const helpOpen = ref(false);
const SHORTCUTS: [string, string][] = [
  ['Ctrl + Z / Ctrl + Y', 'sc_undo'],
  ['Ctrl + C / X / V', 'sc_clipboard'],
  ['Ctrl + D', 'sc_duplicate'],
  ['Delete / Backspace', 'sc_delete'],
  ['Ctrl + A', 'sc_selectAll'],
  ['Ctrl + G / Ctrl + Shift + U', 'sc_group'],
  ['F2 / Enter', 'sc_edit'],
  ['Tab / Shift + Tab', 'sc_tab'],
  ['← ↑ → ↓ (+ Shift)', 'sc_nudge'],
  ['Esc', 'sc_escape'],
  ['Ctrl + gulir', 'sc_zoom'],
  ['Spasi + seret', 'sc_pan'],
  ['Ctrl + 0', 'sc_zoomReset'],
  ['Ctrl + Shift + H', 'sc_fit'],
  ['Ctrl + F', 'sc_find'],
  ['Ctrl + S', 'sc_save'],
  ['?', 'sc_help'],
];

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
  const inside = root.value?.contains(document.activeElement) || full.value;
  if (e.key === 'Escape' && (ctx.open || helpOpen.value || tplOpen.value)) {
    ctx.open = false;
    helpOpen.value = false;
    tplOpen.value = false;
    return;
  }
  const typing =
    /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as Element)?.tagName ?? '') ||
    (e.target as HTMLElement)?.isContentEditable;
  if (e.key === '?' && inside && !typing && !editor.value?.graph.isEditing()) {
    e.preventDefault();
    helpOpen.value = true;
    return;
  }
  if (e.key === 'Escape' && find.open && inside) {
    find.open = false;
    return;
  }
  if (e.key === 'Escape' && full.value && !document.fullscreenElement) full.value = false;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && inside) {
    e.preventDefault();
    openFind();
  }
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
    class="relative flex flex-col overflow-hidden rounded-md border border-rule bg-paper text-ink"
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
        :aria-label="m.panelShapes"
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
      <button
        type="button"
        class="dg-btn"
        :title="m.new"
        :aria-label="m.new"
        data-dg-new
        @click="newDiagram"
      >
        <IconNew aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="m.open"
        :aria-label="m.open"
        data-dg-open
        @click="fileInput?.click()"
      >
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
        :aria-label="`${m.save} (Ctrl+S)`"
        data-dg-save
        @click="saveFile"
      >
        <IconSave aria-hidden="true" />
      </button>
      <div class="relative" data-dg-menu>
        <button
          type="button"
          class="dg-btn gap-1 px-2"
          :aria-expanded="menu === 'export'"
          data-dg-export
          @click="toggleMenu('export')"
        >
          <IconDownload aria-hidden="true" /><span class="hidden sm:inline">{{ m.export }}</span
          ><IconChevron class="size-3" aria-hidden="true" />
        </button>
        <div
          v-if="menu === 'export'"
          class="absolute left-0 top-full z-30 mt-1 w-64 space-y-2 rounded border border-rule bg-paper p-2 shadow-lg"
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
          <div class="space-y-1 border-t border-rule pt-2">
            <button
              type="button"
              class="dg-menu"
              :disabled="exporting"
              data-dg-export-pdf
              @click="exportAs('pdf')"
            >
              PDF
            </button>
            <label class="flex items-center gap-2 px-2 text-xs">
              <input v-model="pdfAll" type="checkbox" /> {{ m.pdfAllPages }}
            </label>
            <label class="flex items-center justify-between gap-2 px-2 text-xs">
              {{ m.pdfPaper }}
              <select v-model="pdfPaper" class="field w-28 py-0.5 text-xs">
                <option value="fit">{{ m.paperFit }}</option>
                <option value="a4">A4</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <button type="button" class="dg-btn gap-1 px-2" data-dg-templates @click="openTemplates">
        <IconTemplate aria-hidden="true" /><span class="hidden 2xl:inline">{{ m.templates }}</span>
      </button>
      <div class="relative" data-dg-menu>
        <button
          type="button"
          class="dg-btn gap-1 px-2"
          :aria-expanded="menu === 'insert'"
          data-dg-insert
          @click="toggleMenu('insert')"
        >
          <IconPlus aria-hidden="true" /><span class="hidden 2xl:inline">{{ m.insert }}</span
          ><IconChevron class="size-3" aria-hidden="true" />
        </button>
        <div
          v-if="menu === 'insert'"
          class="absolute left-0 top-full z-30 mt-1 w-60 space-y-2 rounded border border-rule bg-paper p-2 shadow-lg"
        >
          <button
            type="button"
            class="dg-menu flex items-center gap-2"
            data-dg-insert-image
            @click="imageInput?.click()"
          >
            <IconImage class="size-4" aria-hidden="true" />{{ m.insertImage }}
          </button>
          <div class="space-y-2 border-t border-rule px-2 pt-2 text-xs">
            <p class="flex items-center gap-2 font-semibold">
              <IconTable class="size-4" aria-hidden="true" />{{ m.insertTable }}
            </p>
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1"
                >{{ m.rows }}
                <input
                  v-model.number="tblRows"
                  type="number"
                  min="1"
                  max="20"
                  class="field w-14 py-0.5"
                  data-dg-tbl-rows
                />
              </label>
              <label class="flex items-center gap-1"
                >{{ m.cols }}
                <input
                  v-model.number="tblCols"
                  type="number"
                  min="1"
                  max="10"
                  class="field w-14 py-0.5"
                  data-dg-tbl-cols
                />
              </label>
            </div>
            <button
              type="button"
              class="btn w-full py-1 text-xs"
              data-dg-insert-table
              @click="insertTable"
            >
              {{ m.insertTableBtn }}
            </button>
          </div>
        </div>
      </div>
      <input
        ref="imageInput"
        type="file"
        accept="image/*"
        class="hidden"
        data-dg-image-file
        @change="onImage"
      />
      <div class="relative" data-dg-menu>
        <button
          type="button"
          class="dg-btn gap-1 px-2"
          :aria-expanded="menu === 'layout'"
          data-dg-layout
          @click="toggleMenu('layout')"
        >
          <IconLayout aria-hidden="true" /><span class="hidden 2xl:inline">{{ m.layoutMenu }}</span
          ><IconChevron class="size-3" aria-hidden="true" />
        </button>
        <div
          v-if="menu === 'layout'"
          class="absolute left-0 top-full z-30 mt-1 w-60 rounded border border-rule bg-paper p-2 shadow-lg"
        >
          <button
            v-for="k in LAYOUTS"
            :key="k"
            type="button"
            class="dg-menu"
            :data-dg-layout-kind="k"
            @click="doLayout(k)"
          >
            {{ m[`layout_${k}`] }}
          </button>
          <p class="px-2 pt-1 text-xs text-ink-2">{{ m.layoutHint }}</p>
        </div>
      </div>
      <button
        type="button"
        class="dg-btn"
        :title="`${m.find} (Ctrl+F)`"
        :aria-label="`${m.find} (Ctrl+F)`"
        data-dg-find
        @click="openFind"
      >
        <IconSearch aria-hidden="true" />
      </button>
      <span class="dg-sep" />
      <button
        type="button"
        class="dg-btn"
        :title="`${m.undo} (Ctrl+Z)`"
        :aria-label="`${m.undo} (Ctrl+Z)`"
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
        :aria-label="`${m.redo} (Ctrl+Y)`"
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
        :aria-label="`${m.delete} (Delete)`"
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
        :aria-label="m.toFront"
        :disabled="!selection.length"
        @click="ed().toFront()"
      >
        <IconFront aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn hidden sm:inline-flex"
        :title="m.toBack"
        :aria-label="m.toBack"
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
        :aria-label="m.zoomOut"
        data-dg-zoom-out
        @click="ed().zoom(1 / 1.2)"
      >
        <IconZoomOut aria-hidden="true" />
      </button>
      <button
        type="button"
        class="min-w-12 rounded px-1 py-1 text-xs tabular-nums hover:bg-rule/40"
        :title="m.zoomReset"
        :aria-label="m.zoomReset"
        data-dg-zoom
        @click="ed().zoomTo(1)"
      >
        {{ zoomText }}
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="m.zoomIn"
        :aria-label="m.zoomIn"
        data-dg-zoom-in
        @click="ed().zoom(1.2)"
      >
        <IconZoomIn aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="`${m.fit} (Ctrl+Shift+H)`"
        :aria-label="`${m.fit} (Ctrl+Shift+H)`"
        data-dg-fit
        @click="ed().fit()"
      >
        <IconFit aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn hidden sm:inline-flex"
        :title="m.minimap"
        :aria-label="m.minimap"
        :aria-pressed="showMap"
        data-dg-minimap
        @click="showMap = !showMap"
      >
        <IconMap aria-hidden="true" />
      </button>
      <button
        type="button"
        class="dg-btn hidden sm:inline-flex"
        :title="`${m.shortcuts} (?)`"
        :aria-label="`${m.shortcuts} (?)`"
        data-dg-help
        @click="helpOpen = true"
      >
        <IconHelp aria-hidden="true" />
      </button>
      <span class="flex-1" />
      <span
        class="hidden max-w-40 truncate text-xs text-ink-2 2xl:inline"
        aria-live="polite"
        data-dg-status
        >{{ status }}</span
      >
      <button type="button" class="dg-btn gap-1 px-2" data-dg-full @click="toggleFull">
        <component :is="full ? IconShrink : IconExpand" aria-hidden="true" />
        <span class="hidden xl:inline">{{ full ? m.exitFullscreen : m.fullscreen }}</span>
      </button>
      <button
        type="button"
        class="dg-btn"
        :title="m.panelFormat"
        :aria-label="m.panelFormat"
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
            <div class="grid grid-cols-3 gap-1">
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
                <span class="dg-icon pointer-events-none" v-html="previews.get(it.id) ?? ''" />
                <span class="dg-label pointer-events-none">{{ itemName(it) }}</span>
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
              <div v-show="open[g.id]" class="grid grid-cols-3 gap-1 pt-1">
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
                  <span class="dg-icon pointer-events-none" v-html="previews.get(it.id) ?? ''" />
                  <span class="dg-label pointer-events-none">{{ itemName(it) }}</span>
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
        <!-- Cari dan ganti -->
        <div
          v-if="find.open"
          class="absolute right-2 top-2 z-20 w-80 max-w-[calc(100%-1rem)] space-y-2 rounded border border-rule bg-paper p-2 text-sm shadow-lg"
          data-dg-findbar
        >
          <div class="flex items-center gap-1">
            <input
              ref="findInput"
              v-model="find.q"
              class="field min-w-0 flex-1 py-1"
              :placeholder="m.findPlaceholder"
              :aria-label="m.find"
              data-dg-find-input
              @input="runFind"
              @keydown.enter.prevent="stepFind($event.shiftKey ? -1 : 1)"
            />
            <span
              class="w-14 shrink-0 text-center text-xs tabular-nums text-ink-2"
              data-dg-find-count
              >{{
                find.q.trim()
                  ? find.matches.length
                    ? m.findCount
                        .replace('{i}', String(find.i + 1))
                        .replace('{n}', String(find.matches.length))
                    : m.findNone
                  : ''
              }}</span
            >
            <button
              type="button"
              class="dg-btn"
              :title="m.prev"
              :aria-label="m.prev"
              :disabled="!find.matches.length"
              @click="stepFind(-1)"
            >
              <IconUp aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.next"
              :aria-label="m.next"
              :disabled="!find.matches.length"
              data-dg-find-next
              @click="stepFind(1)"
            >
              <IconChevron aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.close"
              :aria-label="m.close"
              @click="find.open = false"
            >
              <IconX aria-hidden="true" />
            </button>
          </div>
          <div class="flex items-center gap-1">
            <input
              v-model="find.r"
              class="field min-w-0 flex-1 py-1"
              :placeholder="m.replacePlaceholder"
              :aria-label="m.replacePlaceholder"
              data-dg-replace-input
            />
            <button
              type="button"
              class="btn py-1 text-xs"
              :disabled="!find.matches.length"
              data-dg-replace-all
              @click="replaceAll"
            >
              {{ m.replaceAll }}
            </button>
          </div>
          <p v-if="find.note" class="text-xs text-ink-2" data-dg-find-note>{{ find.note }}</p>
        </div>
        <!-- Minimap -->
        <div
          v-show="showMap"
          ref="mapEl"
          class="absolute bottom-2 right-2 z-10 h-36 w-52 overflow-hidden rounded border border-rule bg-white shadow-md"
          :aria-label="m.minimap"
          data-dg-map
        />
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
          <div class="mt-4 flex items-center justify-between">
            <h3 class="dg-h mb-0">{{ m.layersHead }}</h3>
            <button
              type="button"
              class="dg-btn"
              :title="m.addLayer"
              :aria-label="m.addLayer"
              data-dg-add-layer
              @click="addLayer"
            >
              <IconPlus aria-hidden="true" />
            </button>
          </div>
          <ul class="mt-1 space-y-1" data-dg-layers>
            <li
              v-for="l in [...layerList].reverse()"
              :key="l.cell.getId() ?? l.name"
              class="flex items-center gap-1 rounded border px-1 py-0.5"
              :class="l.active ? 'border-brand-600 bg-brand-600/10' : 'border-rule'"
              data-dg-layer
            >
              <button
                type="button"
                class="dg-btn"
                :title="l.visible ? m.hideLayer : m.showLayer"
                :aria-label="l.visible ? m.hideLayer : m.showLayer"
                :aria-pressed="!l.visible"
                @click="layerAction((e) => e.setLayerVisible(l.cell, !l.visible))"
              >
                <component :is="l.visible ? IconEye : IconEyeOff" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="dg-btn"
                :title="l.locked ? m.unlockLayer : m.lockLayer"
                :aria-label="l.locked ? m.unlockLayer : m.lockLayer"
                :aria-pressed="l.locked"
                data-dg-lock-layer
                @click="layerAction((e) => e.setLayerLocked(l.cell, !l.locked))"
              >
                <component :is="l.locked ? IconLock : IconLockOpen" aria-hidden="true" />
              </button>
              <input
                v-if="renamingLayer === l.cell"
                class="field min-w-0 flex-1 py-0.5 text-xs"
                :value="l.name"
                @keydown.enter="renameLayer(l, ($event.target as HTMLInputElement).value)"
                @blur="renameLayer(l, ($event.target as HTMLInputElement).value)"
              />
              <button
                v-else
                type="button"
                class="min-w-0 flex-1 truncate text-left text-xs"
                :title="m.activeLayer"
                :aria-label="m.activeLayer"
                @click="layerAction((e) => e.setActiveLayer(l.cell))"
                @dblclick="renamingLayer = l.cell"
              >
                {{ l.name }} <span class="text-ink-2">({{ l.count }})</span>
              </button>
              <button
                v-if="layerList.length > 1"
                type="button"
                class="dg-btn"
                :title="m.deleteLayer"
                @click="deleteLayer(l)"
              >
                <IconTrash aria-hidden="true" />
              </button>
            </li>
          </ul>
          <p class="mt-1 text-xs text-ink-2">{{ m.layersHint }}</p>
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
              :aria-label="m.bold"
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
              :aria-label="m.italic"
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
              :aria-label="m.underline"
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
              :aria-label="m.alignLeft"
              @click="set('align', 'left')"
            >
              <IconTextL aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="str('align', 'center') === 'center'"
              :title="m.alignCenter"
              :aria-label="m.alignCenter"
              @click="set('align', 'center')"
            >
              <IconTextC aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :aria-pressed="str('align', 'center') === 'right'"
              :title="m.alignRight"
              :aria-label="m.alignRight"
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

          <label v-if="layerList.length > 1" class="dg-row mt-4">
            <span>{{ m.moveToLayer }}</span>
            <select
              class="field w-36 py-1"
              :value="selection[0]?.getParent()?.getId() ?? ''"
              data-dg-move-layer
              @change="
                (e) => {
                  const id = (e.target as HTMLSelectElement).value;
                  const l = layerList.find((x) => x.cell.getId() === id);
                  if (l) layerAction((ed) => ed.moveSelectionToLayer(l.cell));
                }
              "
            >
              <option
                v-for="l in layerList"
                :key="l.cell.getId() ?? l.name"
                :value="l.cell.getId() ?? ''"
              >
                {{ l.name }}
              </option>
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
              :aria-label="m.alignL"
              data-dg-align-left
              @click="ed().align('left')"
            >
              <IconAlignL aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.alignC"
              :aria-label="m.alignC"
              @click="ed().align('center')"
            >
              <IconAlignC aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.alignR"
              :aria-label="m.alignR"
              @click="ed().align('right')"
            >
              <IconAlignR aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.alignT"
              :aria-label="m.alignT"
              @click="ed().align('top')"
            >
              <IconAlignT aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.alignM"
              :aria-label="m.alignM"
              @click="ed().align('middle')"
            >
              <IconAlignM aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.alignB"
              :aria-label="m.alignB"
              @click="ed().align('bottom')"
            >
              <IconAlignB aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.distH"
              :aria-label="m.distH"
              :disabled="selection.length < 3"
              @click="ed().distribute(true)"
            >
              <IconDistH aria-hidden="true" />
            </button>
            <button
              type="button"
              class="dg-btn"
              :title="m.distV"
              :aria-label="m.distV"
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

    <!-- Tab halaman -->
    <div
      class="flex items-center gap-1 overflow-x-auto border-t border-rule bg-paper-2 px-2 py-1 text-xs"
      data-dg-pages
    >
      <div
        v-for="(p, i) in pages"
        :key="p.id"
        class="relative flex shrink-0 items-center rounded"
        :class="i === current ? 'bg-paper font-semibold shadow-sm' : 'hover:bg-rule/30'"
        data-dg-menu
      >
        <input
          v-if="renaming === i"
          class="field w-28 py-0.5 text-xs"
          :value="p.name"
          data-dg-page-rename
          @keydown.enter="renamePage(i, ($event.target as HTMLInputElement).value)"
          @blur="renamePage(i, ($event.target as HTMLInputElement).value)"
        />
        <button
          v-else
          type="button"
          class="px-2 py-1"
          :aria-current="i === current ? 'page' : undefined"
          data-dg-page
          @click="switchPage(i)"
          @dblclick="renaming = i"
        >
          {{ p.name }}
        </button>
        <button
          v-if="i === current"
          type="button"
          class="px-1 py-1 text-ink-2 hover:text-ink"
          :aria-label="m.pageMenu"
          data-dg-page-menu
          @click="toggleMenu(`page-${i}`)"
        >
          <IconMore class="size-3.5" aria-hidden="true" />
        </button>
        <div
          v-if="menu === `page-${i}`"
          class="absolute bottom-full left-0 z-30 mb-1 w-40 rounded border border-rule bg-paper p-1 shadow-lg"
        >
          <button type="button" class="dg-menu" @click="((menu = null), (renaming = i))">
            {{ m.renamePage }}
          </button>
          <button
            type="button"
            class="dg-menu"
            data-dg-page-dup
            @click="((menu = null), duplicatePage(i))"
          >
            {{ m.duplicatePage }}
          </button>
          <button
            type="button"
            class="dg-menu"
            :disabled="pages.length < 2"
            data-dg-page-del
            @click="((menu = null), deletePage(i))"
          >
            {{ m.deletePage }}
          </button>
        </div>
      </div>
      <button
        type="button"
        class="dg-btn shrink-0"
        :title="m.addPage"
        :aria-label="m.addPage"
        data-dg-add-page
        @click="addPage()"
      >
        <IconPlus aria-hidden="true" />
      </button>
    </div>

    <!-- Menu klik kanan -->
    <div
      v-if="ctx.open"
      ref="ctxEl"
      class="fixed z-50 w-52 rounded border border-rule bg-paper p-1 text-sm shadow-xl"
      :style="{ left: `${ctx.x}px`, top: `${ctx.y}px` }"
      role="menu"
      data-dg-ctx
    >
      <template v-if="ctx.onCell">
        <button
          v-if="selection.length === 1"
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          data-dg-ctx-edit
          @click="ctxRun((e) => e.editSelected())"
        >
          {{ m.ctxEdit }}<kbd>F2</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.cut())"
        >
          {{ m.ctxCut }}<kbd>Ctrl+X</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          data-dg-ctx-copy
          @click="ctxRun((e) => e.copy())"
        >
          {{ m.ctxCopy }}<kbd>Ctrl+C</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          data-dg-ctx-duplicate
          @click="ctxRun((e) => e.duplicate())"
        >
          {{ m.duplicate }}<kbd>Ctrl+D</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          data-dg-ctx-delete
          @click="ctxRun((e) => e.remove())"
        >
          {{ m.delete }}<kbd>Del</kbd>
        </button>
        <hr class="my-1 border-rule" />
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.toFront())"
        >
          {{ m.toFront }}
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.toBack())"
        >
          {{ m.toBack }}
        </button>
        <button
          v-if="selection.length > 1"
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.group())"
        >
          {{ m.group }}<kbd>Ctrl+G</kbd>
        </button>
        <button
          v-if="ctx.group"
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.ungroup())"
        >
          {{ m.ungroup }}
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          :disabled="!ctx.paste"
          data-dg-ctx-paste
          @click="ctxRun((e) => e.paste())"
        >
          {{ m.ctxPaste }}<kbd>Ctrl+V</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          data-dg-ctx-selectall
          @click="ctxRun((e) => e.selectAll())"
        >
          {{ m.ctxSelectAll }}<kbd>Ctrl+A</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="ctxRun((e) => e.fit())"
        >
          {{ m.fit }}
        </button>
        <hr class="my-1 border-rule" />
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="((ctx.open = false), openTemplates())"
        >
          {{ m.templates }}…
        </button>
        <button
          type="button"
          role="menuitem"
          class="dg-menu dg-ctx"
          @click="((ctx.open = false), addPage())"
        >
          {{ m.addPage }}
        </button>
      </template>
    </div>

    <!-- Dialog pintasan -->
    <div
      v-if="helpOpen"
      class="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4"
      data-dg-help-dialog
      @click.self="helpOpen = false"
    >
      <div
        class="max-h-full w-full max-w-lg overflow-y-auto rounded-md bg-paper p-4 shadow-xl"
        role="dialog"
        :aria-label="m.shortcuts"
      >
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-lg">{{ m.shortcuts }}</h2>
          <button
            type="button"
            class="dg-btn"
            :title="m.close"
            :aria-label="m.close"
            @click="helpOpen = false"
          >
            <IconX aria-hidden="true" />
          </button>
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <template v-for="[k, label] in SHORTCUTS" :key="k">
            <dt>
              <kbd class="rounded border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-xs">{{
                k
              }}</kbd>
            </dt>
            <dd class="text-ink-2">{{ m[label as 'sc_undo'] }}</dd>
          </template>
        </dl>
        <p class="mt-3 text-xs text-ink-2">{{ m.touchHint }}</p>
      </div>
    </div>

    <!-- Dialog template -->
    <div
      v-if="tplOpen"
      class="absolute inset-0 z-40 grid place-items-center bg-black/40 p-4"
      data-dg-tpl-dialog
      @click.self="tplOpen = false"
    >
      <div
        class="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-md bg-paper shadow-xl"
        role="dialog"
        :aria-label="m.templatesHead"
      >
        <div class="flex items-center justify-between border-b border-rule px-4 py-2">
          <div>
            <h2 class="font-display text-lg">{{ m.templatesHead }}</h2>
            <p class="text-xs text-ink-2">{{ m.templatesIntro }}</p>
          </div>
          <button
            type="button"
            class="dg-btn"
            :title="m.close"
            :aria-label="m.close"
            @click="tplOpen = false"
          >
            <IconX aria-hidden="true" />
          </button>
        </div>
        <div class="grid grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="t in TEMPLATES"
            :key="t.id"
            type="button"
            class="group overflow-hidden rounded border border-rule text-left hover:border-brand-600"
            :data-dg-tpl="t.id"
            @click="useTemplate(t)"
          >
            <span class="dg-thumb grid h-36 place-items-center overflow-hidden bg-white p-2">
              <!-- eslint-disable-next-line vue/no-v-html -- SVG dibuat sendiri dari template -->
              <span class="contents" v-html="tplThumbs.get(t.id) ?? ''" />
            </span>
            <span class="block border-t border-rule px-3 py-2">
              <span class="block text-sm font-semibold group-hover:text-brand-700">{{
                t.name[lang]
              }}</span>
              <span class="block text-xs text-ink-2">{{ t.desc[lang] }}</span>
            </span>
          </button>
        </div>
      </div>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0.15rem;
  padding: 0.3rem 0 0.25rem;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  cursor: grab;
}
.dg-icon {
  display: grid;
  place-items: center;
  height: 36px;
}
.dg-label {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  width: 100%;
  font-size: 0.65rem;
  line-height: 1.2;
  text-align: center;
  color: var(--ink-2);
  letter-spacing: -0.01em;
}
/* Mode gelap: tinta gelap pratinjau (garis, panah, teks, simbol) dibuat putih supaya terlihat. */
@media (prefers-color-scheme: dark) {
  .dg-icon :deep([stroke='#1f2937']),
  .dg-icon :deep([stroke='#111827']) {
    stroke: #ffffff;
  }
  .dg-icon :deep([fill='#1f2937']),
  .dg-icon :deep([fill='#111827']) {
    fill: #ffffff;
  }
  /* Isi putih dikosongkan agar detail di dalam shape (garis tabung, silang, pin) tidak tertutup. */
  .dg-icon :deep([fill='#ffffff']) {
    fill: transparent;
  }
}
.dg-item:hover {
  border-color: color-mix(in srgb, currentColor 20%, transparent);
  background: color-mix(in srgb, currentColor 5%, transparent);
}
.dg-ctx {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dg-ctx:disabled {
  opacity: 0.4;
}
.dg-ctx kbd {
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
  opacity: 0.55;
}
.dg-thumb :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
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
