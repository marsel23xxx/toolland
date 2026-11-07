<script setup lang="ts">
/**
 * PDF Editor: ubah tulisan yang sudah ada (klik baris), tambah teks, kotak penutup (whiteout),
 * dan gambar/tanda tangan di atas halaman PDF. Halaman ditampilkan dengan pdf.js, objek berupa lapisan HTML di atasnya, lalu
 * pdf-lib (di worker) menggambar objek ke PDF asli saat disimpan. Semua di browser.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import IconFileUp from '~icons/lucide/file-up';
import IconImage from '~icons/lucide/image-plus';
import IconMove from '~icons/lucide/move';
import IconPointer from '~icons/lucide/mouse-pointer-2';
import IconSquare from '~icons/lucide/square';
import IconTrash from '~icons/lucide/trash-2';
import IconType from '~icons/lucide/type';
import type { Messages } from '../../../i18n';
import { toolPath } from '../../../lib/categories';
import { fill, pageLocale } from '../../../lib/format';
import { fileName } from '../../../lib/names';
import { PDF_ACCEPT, pdfErrorCode, pdfWorker } from '../../../lib/pdf/client';
import { closePdf, openPdf, renderPage } from '../../../lib/pdf/render';
import {
  groupLines,
  pickColors,
  standardFamily,
  toHex,
  type FontFamily,
  type RawTextItem,
  type TextLine,
} from '../../../lib/pdf/textlines';
import { EDIT_LINE_HEIGHT, type EditImage, type EditItem } from '../../../lib/pdf/types';
import { useFileResults, withSuffix } from '../../../lib/results';
import Dropzone, { type DropzoneMessages } from '../../ui/Dropzone.vue';
import FileResults from '../../ui/FileResults.vue';

const props = defineProps<{
  t: Messages<'pdf'>;
  files: Messages<'files'>;
  dropzone: DropzoneMessages;
  donate: Messages<'donate'>;
}>();
const t = props.t;

type Tool = 'select' | 'text' | 'rect' | 'image';
type Item = EditItem & {
  id: number;
  /** Edit tulisan asli: kunci baris yang diganti, dan keadaan awalnya (untuk deteksi perubahan). */
  line?: string;
  orig?: string;
};
type TextItem = Extract<Item, { type: 'text' }>;

interface PageInfo {
  /** Ukuran halaman seperti terlihat, dalam point. */
  w: number;
  h: number;
}

/** Font layar yang ukurannya sama dengan font standar PDF (Arial/Liberation = Helvetica, dst). */
const FONTS: Record<FontFamily, string> = {
  helvetica: "Helvetica, Arial, 'Liberation Sans', 'Nimbus Sans', sans-serif",
  times: "'Times New Roman', Times, 'Liberation Serif', 'Nimbus Roman', serif",
  courier: "'Courier New', Courier, 'Liberation Mono', 'Nimbus Mono PS', monospace",
};
const MIN_BOX = 6;

const file = ref<File | null>(null);
const pages = ref<PageInfo[]>([]);
const items = ref<Item[]>([]);
const images = new Map<string, EditImage & { url: string; ratio: number }>();
const tool = ref<Tool>('select');
const selectedId = ref<number | null>(null);
const pendingImage = ref<string | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const dirty = ref(false);
const results = useFileResults();
const textDefaults = ref({
  size: 14,
  color: '#111111',
  bold: false,
  italic: false,
  font: 'helvetica' as FontFamily,
});
const rectColor = ref('#ffffff');

let doc: PDFDocumentProxy | undefined;
let pdfBytes: ArrayBuffer | undefined;
let nextId = 1;

const signatureHref = toolPath(
  pageLocale(),
  pageLocale() === 'id' ? 'buat-tanda-tangan' : 'signature-maker',
);

const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null);
const selectedText = computed(() =>
  selected.value?.type === 'text' ? (selected.value as TextItem) : null,
);

// ---------- ukuran tampilan ----------

const list = ref<HTMLElement>();
const width = ref(0);
let resize: ResizeObserver | undefined;
const scale = (page: number) => (pages.value[page] ? width.value / pages.value[page].w : 1);

const baselines = new Map<string, number>();

/** Jarak baseline baris pertama di browser ini, supaya teks di PDF tepat di posisi yang sama. */
function measureBaseline(font: FontFamily, bold: boolean, italic: boolean): number {
  const key = `${font}${bold}${italic}`;
  const known = baselines.get(key);
  if (known) return known;
  const box = document.createElement('div');
  const probe = document.createElement('span');
  box.textContent = 'Hg';
  box.append(probe);
  Object.assign(box.style, {
    position: 'absolute',
    visibility: 'hidden',
    fontFamily: FONTS[font],
    fontSize: '100px',
    lineHeight: String(EDIT_LINE_HEIGHT),
    fontWeight: bold ? '700' : '400',
    fontStyle: italic ? 'italic' : 'normal',
    whiteSpace: 'pre',
  });
  Object.assign(probe.style, { display: 'inline-block', width: '1px', height: '0' });
  document.body.append(box);
  const ratio = (probe.getBoundingClientRect().top - box.getBoundingClientRect().top) / 100;
  box.remove();
  const value = ratio > 0.5 && ratio < 1.2 ? ratio : 0.9;
  baselines.set(key, value);
  return value;
}

// ---------- buka PDF ----------

async function open(list: File[]) {
  const f = list[0];
  if (!f) return;
  await reset();
  loading.value = true;
  error.value = '';
  try {
    pdfBytes = await f.arrayBuffer();
    doc = await openPdf(pdfBytes, true);
    const info: PageInfo[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      info.push({ w: vp.width, h: vp.height });
    }
    pages.value = info;
    file.value = f;
  } catch (e) {
    const name = (e as Error)?.name ?? '';
    error.value = t[`error.${name === 'PasswordException' ? 'encrypted' : pdfErrorCode(e)}`];
    await reset();
  } finally {
    loading.value = false;
  }
}

async function reset() {
  observer?.disconnect();
  rendered.clear();
  holders.clear();
  canvases.clear();
  lines.value = {};
  if (doc) await closePdf(doc);
  doc = undefined;
  pdfBytes = undefined;
  file.value = null;
  pages.value = [];
  items.value = [];
  for (const img of images.values()) URL.revokeObjectURL(img.url);
  images.clear();
  selectedId.value = null;
  pendingImage.value = null;
  tool.value = 'select';
  dirty.value = false;
  results.clear();
}

function changeFile() {
  if (dirty.value && !window.confirm(t['editor.confirmChange'])) return;
  void reset();
}

// ---------- render halaman (hanya yang hampir terlihat) ----------

const holders = new Map<number, HTMLElement>();
const rendered = new Set<number>();
/** Canvas hasil render per halaman, untuk mengambil warna tulisan dan latar. */
const canvases = new Map<number, { canvas: HTMLCanvasElement; scale: number }>();

type EditableLine = TextLine & { font: FontFamily; bold: boolean; italic: boolean };
/** Baris tulisan asli per halaman yang bisa diklik untuk diedit. */
const lines = shallowRef<Record<number, EditableLine[]>>({});
let observer: IntersectionObserver | undefined;

function holderRef(i: number, el: unknown) {
  if (!(el instanceof HTMLElement)) return;
  holders.set(i, el);
  el.dataset.page = String(i);
  observer?.observe(el);
}

async function draw(i: number) {
  if (!doc || rendered.has(i)) return;
  rendered.add(i);
  const current = doc;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const s = Math.min(3, Math.max(1, (width.value * dpr) / pages.value[i].w));
  try {
    const canvas = await renderPage(current, i + 1, s);
    if (current !== doc) return;
    canvas.className = 'absolute inset-0 size-full';
    canvas.setAttribute('aria-hidden', 'true');
    holders.get(i)?.replaceChildren(canvas);
    canvases.set(i, { canvas, scale: s });
    lines.value = { ...lines.value, [i]: await readLines(current, i) };
  } catch {
    rendered.delete(i);
  }
}

/** Baris tulisan asli satu halaman, lengkap dengan font termirip. */
async function readLines(d: PDFDocumentProxy, i: number): Promise<EditableLine[]> {
  try {
    const page = await d.getPage(i + 1);
    const tc = await page.getTextContent();
    const vp = page.getViewport({ scale: 1 });
    const raw = tc.items.filter((it): it is RawTextItem & typeof it => 'str' in it);
    return groupLines(raw, vp.transform, tc.styles).map((l) => {
      // Info font dari pdf.js (tersedia setelah halaman dirender).
      const f = (page.commonObjs.has(l.fontName) ? page.commonObjs.get(l.fontName) : null) as {
        name?: string;
        bold?: boolean;
        italic?: boolean;
        fallbackName?: string;
      } | null;
      const name = f?.name ?? '';
      return {
        ...l,
        font: standardFamily(name, f?.fallbackName ?? tc.styles[l.fontName]?.fontFamily),
        bold: !!f?.bold || /bold|black|heavy|semibold|demi/i.test(name),
        italic: !!f?.italic || /italic|oblique/i.test(name),
      };
    });
  } catch {
    return [];
  }
}

watch(file, async (f) => {
  if (!f) return;
  await nextTick();
  width.value = list.value?.clientWidth ?? 0;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) void draw(Number((e.target as HTMLElement).dataset.page));
    },
    { rootMargin: '800px 0px' },
  );
  holders.forEach((el) => observer!.observe(el));
});

onMounted(() => {
  resize = new ResizeObserver(() => {
    if (list.value) width.value = list.value.clientWidth;
  });
  watch(list, (el) => el && resize?.observe(el), { immediate: true });
  window.addEventListener('beforeunload', warnUnsaved);
});

onBeforeUnmount(() => {
  resize?.disconnect();
  window.removeEventListener('beforeunload', warnUnsaved);
  void reset();
});

function warnUnsaved(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault();
}

// ---------- posisi objek di layar ----------

function boxStyle(item: Item) {
  const p = pages.value[item.page];
  const style: Record<string, string> = {
    left: `${(item.x / p.w) * 100}%`,
    top: `${(item.y / p.h) * 100}%`,
  };
  if (item.type === 'text') {
    style.fontSize = `${item.size * scale(item.page)}px`;
  } else {
    style.width = `${(item.w / p.w) * 100}%`;
    style.height = `${(item.h / p.h) * 100}%`;
  }
  if (item.type === 'rect') style.backgroundColor = item.color;
  return style;
}

function textStyle(item: TextItem) {
  return {
    fontFamily: FONTS[item.font],
    color: item.color,
    fontWeight: item.bold ? '700' : '400',
    fontStyle: item.italic ? 'italic' : 'normal',
    lineHeight: String(EDIT_LINE_HEIGHT),
  };
}

function clampItem(item: Item, el?: HTMLElement) {
  const p = pages.value[item.page];
  let w: number;
  let h: number;
  if (item.type === 'text') {
    const s = scale(item.page);
    w = el ? el.offsetWidth / s : 0;
    h = el ? el.offsetHeight / s : item.size * EDIT_LINE_HEIGHT;
  } else {
    item.w = Math.min(Math.max(MIN_BOX, item.w), p.w);
    item.h = Math.min(Math.max(MIN_BOX, item.h), p.h);
    w = item.w;
    h = item.h;
  }
  item.x = Math.min(Math.max(0, item.x), Math.max(0, p.w - w));
  item.y = Math.min(Math.max(0, item.y), Math.max(0, p.h - h));
}

// ---------- tambah objek ----------

function pointOnPage(page: number, e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const s = scale(page);
  return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s };
}

function onPagePointer(page: number, e: PointerEvent) {
  if (e.button !== 0) return;
  if (tool.value === 'select') {
    selectedId.value = null;
    return;
  }
  e.preventDefault();
  const { x, y } = pointOnPage(page, e);
  place(page, x, y);
}

/** Pasang objek alat aktif dengan titik tengah di (x, y). */
function place(page: number, x: number, y: number) {
  let item: Item;
  if (tool.value === 'text') {
    const d = textDefaults.value;
    item = {
      id: nextId++,
      type: 'text',
      page,
      x,
      y: y - d.size * 0.6,
      text: '',
      size: d.size,
      color: d.color,
      bold: d.bold,
      italic: d.italic,
      font: d.font,
      baseline: measureBaseline(d.font, d.bold, d.italic),
    };
  } else if (tool.value === 'rect') {
    item = {
      id: nextId++,
      type: 'rect',
      page,
      x: x - 70,
      y: y - 12,
      w: 140,
      h: 24,
      color: rectColor.value,
    };
  } else {
    const id = pendingImage.value;
    const img = id && images.get(id);
    if (!id || !img) return;
    const w = Math.min(180, pages.value[page].w * 0.4);
    const h = w / img.ratio;
    item = { id: nextId++, type: 'image', page, x: x - w / 2, y: y - h / 2, w, h, image: id };
  }
  clampItem(item);
  items.value.push(item);
  selectedId.value = item.id;
  dirty.value = true;
  tool.value = 'select';
  pendingImage.value = null;
  void nextTick(() => {
    const el =
      item.type === 'text'
        ? editors.get(item.id)
        : list.value?.querySelector<HTMLElement>(`[data-item="${item.id}"] [tabindex]`);
    el?.focus();
  });
}

/** Keadaan teks yang dibandingkan untuk tahu apakah baris asli benar-benar diubah. */
const snapshot = (i: TextItem) =>
  JSON.stringify([i.text, i.x, i.y, i.size, i.color, i.bold, i.italic, i.font]);

/** Klik baris tulisan asli: jadikan teks yang bisa diedit di tempatnya, menutup tulisan lama. */
function editLine(page: number, line: EditableLine, e: PointerEvent) {
  if (e.button !== 0 || (tool.value !== 'select' && tool.value !== 'text')) return;
  e.preventDefault();
  const top = line.baseline - line.above;
  const height = line.above + line.below;
  let bg = '#ffffff';
  let fg = '#000000';
  const c = canvases.get(page);
  if (c) {
    // Warna dari piksel halaman: area tulisan diperbesar 3 pt untuk membaca latarnya.
    const pad = 3;
    const sx = Math.max(0, Math.floor((line.x - pad) * c.scale));
    const sy = Math.max(0, Math.floor((top - pad) * c.scale));
    const sw = Math.min(c.canvas.width - sx, Math.ceil((line.width + pad * 2) * c.scale));
    const sh = Math.min(c.canvas.height - sy, Math.ceil((height + pad * 2) * c.scale));
    if (sw > 2 && sh > 2) {
      const img = c.canvas.getContext('2d')!.getImageData(sx, sy, sw, sh);
      const inner = {
        x: Math.round(line.x * c.scale) - sx,
        y: Math.round(top * c.scale) - sy,
        w: Math.round(line.width * c.scale),
        h: Math.round(height * c.scale),
      };
      const colors = pickColors(img.data, sw, sh, inner);
      bg = toHex(colors.bg);
      fg = toHex(colors.fg);
    }
  }
  const size = Math.round(line.size * 10) / 10;
  const item: TextItem = {
    id: nextId++,
    type: 'text',
    page,
    x: line.x,
    y: line.baseline - measureBaseline(line.font, line.bold, line.italic) * size,
    text: line.text,
    size,
    color: fg,
    bold: line.bold,
    italic: line.italic,
    font: line.font,
    baseline: measureBaseline(line.font, line.bold, line.italic),
    cover: { x: line.x - 1, y: top - 1, w: line.width + 2, h: height + 2, color: bg },
    line: line.key,
  };
  item.orig = snapshot(item);
  items.value.push(item);
  selectedId.value = item.id;
  tool.value = 'select';
  const { clientX, clientY } = e;
  void nextTick(() => {
    const el = editors.get(item.id);
    if (!el) return;
    el.focus();
    placeCaret(el, clientX, clientY);
  });
}

/** Taruh kursor ketik di titik yang diklik. */
function placeCaret(el: HTMLElement, x: number, y: number) {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offset = 0;
  const pos = d.caretPositionFromPoint?.(x, y);
  if (pos) {
    node = pos.offsetNode;
    offset = pos.offset;
  } else {
    const r = document.caretRangeFromPoint?.(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  const range = document.createRange();
  if (node && el.contains(node)) {
    range.setStart(node, offset);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Baris asli yang sedang diedit tidak lagi bisa diklik (sudah ada kotak teksnya). */
const editingLines = computed(() => new Set(items.value.map((i) => i.line).filter(Boolean)));

function lineStyle(page: number, l: EditableLine) {
  const p = pages.value[page];
  return {
    left: `${(l.x / p.w) * 100}%`,
    top: `${((l.baseline - l.above) / p.h) * 100}%`,
    width: `${(l.width / p.w) * 100}%`,
    height: `${((l.above + l.below) / p.h) * 100}%`,
  };
}

function coverStyle(item: TextItem) {
  const p = pages.value[item.page];
  const c = item.cover!;
  return {
    left: `${(c.x / p.w) * 100}%`,
    top: `${(c.y / p.h) * 100}%`,
    width: `${(c.w / p.w) * 100}%`,
    height: `${(c.h / p.h) * 100}%`,
    backgroundColor: c.color,
  };
}

/** Lewat keyboard: pasang di tengah halaman yang sedang terlihat. */
function placeOnVisiblePage() {
  let page = 0;
  let best = -1;
  holders.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    if (visible > best) {
      best = visible;
      page = i;
    }
  });
  const p = pages.value[page];
  if (p) place(page, p.w / 2, p.h / 3);
}

// ---------- gambar / tanda tangan ----------

const imageInput = ref<HTMLInputElement>();

async function pickImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  try {
    const bitmap = await createImageBitmap(f);
    const ratio = bitmap.width / bitmap.height;
    let bytes: ArrayBuffer;
    let kind: EditImage['kind'];
    if (f.type === 'image/png' || f.type === 'image/jpeg') {
      bytes = await f.arrayBuffer();
      kind = f.type === 'image/png' ? 'png' : 'jpeg';
      bitmap.close();
    } else {
      // WebP dan lainnya diubah ke PNG (transparansi tetap).
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      bitmap.close();
      bytes = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
      kind = 'png';
    }
    const id = `img${nextId++}`;
    images.set(id, { bytes, kind, ratio, url: URL.createObjectURL(f) });
    pendingImage.value = id;
    tool.value = 'image';
    error.value = '';
    if (viaKeyboard) placeOnVisiblePage();
  } catch {
    error.value = t['editor.imageError'];
  }
}

let viaKeyboard = false;

function chooseTool(next: Tool, e: MouseEvent) {
  // detail 0 = tombol ditekan lewat keyboard (Enter/Spasi), bukan klik.
  viaKeyboard = e.detail === 0;
  if (next === 'image') {
    imageInput.value?.click();
    return;
  }
  tool.value = next;
  pendingImage.value = null;
  if (viaKeyboard && next !== 'select') placeOnVisiblePage();
}

// ---------- teks ----------

const editors = new Map<number, HTMLElement>();

function editorRef(item: TextItem, el: unknown) {
  if (!(el instanceof HTMLElement)) {
    editors.delete(item.id);
    return;
  }
  editors.set(item.id, el);
  // Isi diatur sekali saja; setelah itu browser yang mengelola (kursor tidak melompat).
  if (!el.dataset.ready) {
    el.textContent = item.text;
    el.dataset.ready = '1';
  }
}

function onTextInput(item: TextItem, e: Event) {
  item.text = (e.target as HTMLElement).innerText.replace(/\n$/, '');
  dirty.value = true;
}

/** Teks baru yang kosong dihapus; baris asli yang tidak diubah dikembalikan seperti semula. */
function cleanup(id: number | null) {
  const item = items.value.find((i) => i.id === id);
  if (item?.type !== 'text') return;
  // Baris asli yang dikosongkan tetap disimpan: artinya tulisan itu dihapus.
  if (item.line ? snapshot(item) === item.orig : !item.text.trim()) remove(item.id, false);
}

function onTextBlur(item: TextItem, e: FocusEvent) {
  // Pindah ke toolbar (ganti font, ukuran, ...) bukan berarti selesai mengedit.
  const to = e.relatedTarget as HTMLElement | null;
  if (to?.closest('[role=toolbar]')) return;
  cleanup(item.id);
}

watch(selectedId, (_now, before) => cleanup(before));

// ---------- geser dan ubah ukuran ----------

interface Drag {
  item: Item;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
  el: HTMLElement;
}
let drag: Drag | null = null;

function startDrag(item: Item, mode: Drag['mode'], e: PointerEvent) {
  if (e.button !== 0 || tool.value !== 'select') return;
  e.preventDefault();
  e.stopPropagation();
  selectedId.value = item.id;
  const el = (e.currentTarget as HTMLElement).closest('[data-item]') as HTMLElement;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  const box = item.type === 'text' ? { w: 0, h: 0 } : { w: item.w, h: item.h };
  drag = {
    item,
    mode,
    startX: e.clientX,
    startY: e.clientY,
    orig: { x: item.x, y: item.y, ...box },
    el,
  };
}

function onDrag(e: PointerEvent) {
  if (!drag) return;
  const s = scale(drag.item.page);
  const dx = (e.clientX - drag.startX) / s;
  const dy = (e.clientY - drag.startY) / s;
  const { item, orig } = drag;
  if (drag.mode === 'move') {
    item.x = orig.x + dx;
    item.y = orig.y + dy;
  } else if (item.type === 'image') {
    // Gambar: rasio tetap.
    const w = Math.max(MIN_BOX, orig.w + dx);
    item.w = w;
    item.h = (w * orig.h) / orig.w;
  } else if (item.type === 'rect') {
    item.w = orig.w + dx;
    item.h = orig.h + dy;
  }
  clampItem(item, drag.el);
  dirty.value = true;
}

function endDrag() {
  drag = null;
}

function onItemKey(item: Item, e: KeyboardEvent) {
  if (e.target !== e.currentTarget) return; // sedang mengetik di dalam teks
  const step = e.shiftKey ? 10 : 1;
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  if (moves[e.key]) {
    e.preventDefault();
    item.x += moves[e.key][0];
    item.y += moves[e.key][1];
    clampItem(item, (e.currentTarget as HTMLElement).closest('[data-item]') as HTMLElement);
    dirty.value = true;
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    remove(item.id);
  }
}

function remove(id: number, changed = true) {
  items.value = items.value.filter((i) => i.id !== id);
  if (selectedId.value === id) selectedId.value = null;
  if (changed) dirty.value = true;
}

// ---------- pengaturan objek terpilih ----------

const textSize = computed({
  get: () => selectedText.value?.size ?? textDefaults.value.size,
  set: (v: number) => {
    const n = Number.isFinite(v) ? Math.min(144, Math.max(4, v)) : 14;
    if (selectedText.value) {
      // Ukuran berubah dari baseline, jadi tulisan tidak melompat ke atas/bawah.
      const it = selectedText.value;
      const base = it.y + it.baseline * it.size;
      it.size = n;
      it.y = base - it.baseline * n;
    }
    textDefaults.value.size = n;
    dirty.value = true;
  },
});
const textColor = computed({
  get: () => selectedText.value?.color ?? textDefaults.value.color,
  set: (v: string) => {
    if (selectedText.value) selectedText.value.color = v;
    textDefaults.value.color = v;
    dirty.value = true;
  },
});
/** Ganti gaya teks terpilih (atau gaya teks baru), baseline diukur ulang agar posisi tetap. */
function setTextStyle(patch: Partial<Pick<TextItem, 'bold' | 'italic' | 'font'>>) {
  const it = selectedText.value;
  if (it) {
    // Baseline tetap di tempat yang sama walau font berganti.
    const base = it.y + it.baseline * it.size;
    Object.assign(it, patch);
    it.baseline = measureBaseline(it.font, it.bold, it.italic);
    it.y = base - it.baseline * it.size;
    dirty.value = true;
  }
  Object.assign(textDefaults.value, patch);
}
const textBold = computed({
  get: () => selectedText.value?.bold ?? textDefaults.value.bold,
  set: (v: boolean) => setTextStyle({ bold: v }),
});
const textItalic = computed({
  get: () => selectedText.value?.italic ?? textDefaults.value.italic,
  set: (v: boolean) => setTextStyle({ italic: v }),
});
const textFont = computed({
  get: () => selectedText.value?.font ?? textDefaults.value.font,
  set: (v: FontFamily) => setTextStyle({ font: v }),
});
const FONT_OPTIONS = computed(() => [
  { value: 'helvetica' as const, label: t['editor.fontSans'] },
  { value: 'times' as const, label: t['editor.fontSerif'] },
  { value: 'courier' as const, label: t['editor.fontMono'] },
]);
const boxColor = computed({
  get: () => (selected.value?.type === 'rect' ? selected.value.color : rectColor.value),
  set: (v: string) => {
    if (selected.value?.type === 'rect') selected.value.color = v;
    rectColor.value = v;
  },
});
const showTextOptions = computed(() => tool.value === 'text' || !!selectedText.value);
const showRectOptions = computed(() => tool.value === 'rect' || selected.value?.type === 'rect');

const hint = computed(() => {
  if (tool.value === 'text') return t['editor.hintText'];
  if (tool.value === 'rect') return t['editor.hintRect'];
  if (tool.value === 'image') return t['editor.hintImage'];
  return items.value.length ? t['editor.hintSelect'] : t['editor.hintStart'];
});

// ---------- simpan ----------

async function save() {
  if (!pdfBytes || !file.value) return;
  saving.value = true;
  error.value = '';
  try {
    const out: EditItem[] = [];
    const used: Record<string, EditImage> = {};
    for (const item of items.value) {
      if (item.type === 'text') {
        if (item.line ? snapshot(item) === item.orig : !item.text.trim()) continue;
      }
      // Salinan polos (tanpa proxy Vue) agar bisa dikirim ke worker; data layar tidak ikut.
      const plain = JSON.parse(JSON.stringify(item)) as Partial<Item>;
      delete plain.id;
      delete plain.line;
      delete plain.orig;
      out.push(plain as EditItem);
      if (item.type === 'image') {
        const img = images.get(item.image)!;
        used[item.image] = { bytes: img.bytes, kind: img.kind };
      }
    }
    const api = await pdfWorker();
    const bytes = await api.edit(pdfBytes, out, used);
    results.clear();
    results.add(
      withSuffix(file.value.name, fileName('edited'), '.pdf'),
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
      fill(t['editor.objects'], { n: out.length }),
    );
    dirty.value = false;
  } catch (e) {
    error.value = t[`error.${pdfErrorCode(e)}`];
  } finally {
    saving.value = false;
  }
}

const toolButtons = computed(() => [
  { id: 'select' as const, icon: IconPointer, label: t['editor.select'] },
  { id: 'text' as const, icon: IconType, label: t['editor.text'] },
  { id: 'rect' as const, icon: IconSquare, label: t['editor.whiteout'] },
  { id: 'image' as const, icon: IconImage, label: t['editor.image'] },
]);
</script>

<template>
  <div class="space-y-4">
    <template v-if="!file">
      <Dropzone
        :messages="dropzone"
        :accept="PDF_ACCEPT"
        :multiple="false"
        :disabled="loading"
        @files="open"
        @prefetch="pdfWorker()"
      />
      <p v-if="loading" role="status" class="text-sm text-ink-2">{{ t['editor.opening'] }}</p>
    </template>

    <template v-else>
      <div
        class="sticky top-0 z-20 -mx-1 space-y-2 border-b border-rule bg-paper-2 px-1 py-2"
        role="toolbar"
        :aria-label="t['editor.tools']"
      >
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="b in toolButtons"
            :key="b.id"
            type="button"
            class="btn btn-secondary max-sm:px-2.5"
            :class="{ 'btn-active': tool === b.id }"
            :aria-pressed="tool === b.id"
            :title="b.label"
            @click="chooseTool(b.id, $event)"
          >
            <component :is="b.icon" aria-hidden="true" />
            <!-- Di HP hanya ikon; label tetap dibaca pembaca layar. -->
            <span class="max-sm:sr-only">{{ b.label }}</span>
          </button>
          <input
            ref="imageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="pickImage"
          />
          <span class="grow" />
          <button
            type="button"
            class="btn btn-secondary max-sm:px-2.5"
            :title="t['editor.change']"
            @click="changeFile"
          >
            <IconFileUp aria-hidden="true" />
            <span class="max-sm:sr-only">{{ t['editor.change'] }}</span>
          </button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
            {{ saving ? t['editor.saving'] : t['editor.save'] }}
          </button>
        </div>

        <div
          v-if="showTextOptions || showRectOptions || selected"
          class="flex flex-wrap items-center gap-3 text-sm"
        >
          <template v-if="showTextOptions">
            <label class="flex items-center gap-1.5">
              {{ t['editor.font'] }}
              <select v-model="textFont" class="field w-auto py-1">
                <option v-for="o in FONT_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </label>
            <label class="flex items-center gap-1.5">
              {{ t['editor.size'] }}
              <input
                v-model.number="textSize"
                type="number"
                min="4"
                max="144"
                class="field w-20 py-1"
              />
            </label>
            <label class="flex items-center gap-1.5">
              {{ t['editor.color'] }}
              <input v-model="textColor" type="color" class="h-8 w-10 cursor-pointer" />
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="textBold" type="checkbox" class="size-4 accent-brand-600" />
              {{ t['editor.bold'] }}
            </label>
            <label class="flex items-center gap-1.5">
              <input v-model="textItalic" type="checkbox" class="size-4 accent-brand-600" />
              {{ t['editor.italic'] }}
            </label>
          </template>
          <label v-if="showRectOptions" class="flex items-center gap-1.5">
            {{ t['editor.boxColor'] }}
            <input v-model="boxColor" type="color" class="h-8 w-10 cursor-pointer" />
          </label>
          <button
            v-if="selected"
            type="button"
            class="btn btn-secondary py-1"
            @click="remove(selected.id)"
          >
            <IconTrash aria-hidden="true" />
            {{ t['editor.delete'] }}
          </button>
        </div>
        <p
          class="text-xs text-ink-3"
          :class="{ 'max-sm:sr-only': tool === 'select' }"
          aria-live="polite"
        >
          {{ hint }}
        </p>
      </div>

      <p v-if="error" role="alert" class="error-text">{{ error }}</p>

      <FileResults
        :items="results.items.value"
        :m="files"
        :donate="donate"
        @remove="results.remove"
      />

      <p class="text-xs text-ink-3">
        {{ t['editor.signatureTip'] }}
        <a :href="signatureHref" class="underline">{{ t['editor.signatureLink'] }}</a>
      </p>

      <div ref="list" class="mx-auto max-w-3xl space-y-4">
        <section
          v-for="(p, i) in pages"
          :key="i"
          class="relative overflow-hidden border border-rule bg-white shadow-sm"
          :style="{ aspectRatio: `${p.w} / ${p.h}` }"
          :aria-label="fill(t['editor.page'], { n: i + 1, total: pages.length })"
        >
          <div :ref="(el) => holderRef(i, el)" class="absolute inset-0" />
          <div
            class="absolute inset-0"
            :class="tool === 'select' ? '' : 'cursor-crosshair touch-none'"
            @pointerdown.self="onPagePointer(i, $event)"
          >
            <template v-for="l in lines[i] ?? []" :key="l.key">
              <div
                v-if="!editingLines.has(l.key)"
                class="absolute cursor-text hover:bg-brand-600/10 hover:outline-1 hover:outline-brand-600/60 hover:outline-dashed"
                :class="tool === 'select' || tool === 'text' ? '' : 'pointer-events-none'"
                data-line
                :data-text="l.text"
                :style="lineStyle(i, l)"
                @pointerdown="editLine(i, l, $event)"
              />
            </template>
            <template v-for="item in items" :key="`c${item.id}`">
              <div
                v-if="item.page === i && item.type === 'text' && item.cover"
                class="pointer-events-none absolute"
                :style="coverStyle(item as TextItem)"
              />
            </template>
            <template v-for="item in items" :key="item.id">
              <div
                v-if="item.page === i"
                :data-item="item.id"
                class="absolute"
                :class="[
                  item.type === 'text' ? 'whitespace-pre' : 'touch-none',
                  item.type !== 'text' && tool === 'select' ? 'cursor-move' : '',
                  selectedId === item.id
                    ? 'outline-2 outline-offset-1 outline-brand-600 outline-dashed'
                    : item.type === 'rect'
                      ? 'outline-1 outline-ink-3/50 outline-dotted hover:outline-ink-3'
                      : 'hover:outline-1 hover:outline-ink-3 hover:outline-dashed',
                ]"
                :style="boxStyle(item)"
              >
                <template v-if="item.type === 'text'">
                  <button
                    v-if="selectedId === item.id"
                    type="button"
                    class="absolute -top-7 -left-1 flex size-6 cursor-move touch-none items-center justify-center rounded-sm border border-rule bg-paper-2 text-ink"
                    :aria-label="t['editor.move']"
                    @pointerdown="startDrag(item, 'move', $event)"
                    @pointermove="onDrag"
                    @pointerup="endDrag"
                    @pointercancel="endDrag"
                    @keydown="onItemKey(item, $event)"
                  >
                    <IconMove class="size-3.5" aria-hidden="true" />
                  </button>
                  <div
                    :ref="(el) => editorRef(item as TextItem, el)"
                    contenteditable="plaintext-only"
                    role="textbox"
                    aria-multiline="true"
                    :aria-label="t['editor.textLabel']"
                    :data-placeholder="t['editor.textPlaceholder']"
                    class="min-w-4 outline-none empty:focus:before:text-ink-3 empty:focus:before:content-[attr(data-placeholder)]"
                    :style="textStyle(item as TextItem)"
                    @focus="selectedId = item.id"
                    @input="onTextInput(item as TextItem, $event)"
                    @blur="onTextBlur(item as TextItem, $event)"
                  />
                </template>
                <div
                  v-else
                  class="size-full"
                  tabindex="0"
                  role="img"
                  :aria-label="item.type === 'rect' ? t['editor.whiteout'] : t['editor.image']"
                  @pointerdown="startDrag(item, 'move', $event)"
                  @pointermove="onDrag"
                  @pointerup="endDrag"
                  @pointercancel="endDrag"
                  @focus="selectedId = item.id"
                  @keydown="onItemKey(item, $event)"
                >
                  <img
                    v-if="item.type === 'image'"
                    :src="images.get(item.image)?.url"
                    alt=""
                    draggable="false"
                    class="pointer-events-none size-full select-none"
                  />
                </div>
                <span
                  v-if="item.type !== 'text' && selectedId === item.id"
                  class="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize touch-none rounded-full border-2 border-paper-2 bg-brand-600"
                  aria-hidden="true"
                  @pointerdown="startDrag(item, 'resize', $event)"
                  @pointermove="onDrag"
                  @pointerup="endDrag"
                  @pointercancel="endDrag"
                />
              </div>
            </template>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
