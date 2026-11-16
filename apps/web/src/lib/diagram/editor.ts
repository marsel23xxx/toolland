/**
 * Mesin Editor Diagram di atas maxGraph: kanvas tanpa batas (geser dan zoom), grid, garis bantu,
 * konektor siku dengan titik sambung, undo/redo, clipboard, pintasan keyboard, simpan otomatis
 * (lewat callback), impor/ekspor .drawio, dan ekspor SVG/PNG. Komponen Vue hanya memanggil API
 * di kelas ini.
 */
import {
  type Cell,
  type CellState,
  type CellStyle,
  Client,
  Clipboard,
  CircleLayout,
  CompactTreeLayout,
  ConnectionConstraint,
  type ConnectionHandler,
  type EventObject,
  FastOrganicLayout,
  Geometry,
  getDefaultPlugins,
  gestureUtils,
  Graph,
  HierarchicalLayout,
  ImageExport,
  InternalEvent,
  KeyHandler,
  ModelXmlSerializer,
  Outline,
  type PanningHandler,
  Point,
  Rectangle,
  RubberBandHandler,
  type SelectionHandler,
  SvgCanvas2D,
  UndoManager,
} from '@maxgraph/core';
import { VENDOR } from '../vendor';
import { installCspSafeDom } from './csp-dom';
import { modelOptions, modelToXml, readDrawio, toDrawioFile } from './drawio';
import type { LibItem } from './library';
import { WIRE_STYLE } from './library-tech';
import { registerStencils } from './stencils';
import { isWireShape } from './stencils-tech';

export const INK = '#1f2937';
export const DEFAULT_VERTEX: CellStyle = {
  fillColor: '#ffffff',
  strokeColor: INK,
  fontColor: '#111827',
  fontSize: 12,
  fontFamily: 'Helvetica',
  strokeWidth: 1,
};
export const DEFAULT_EDGE: CellStyle = {
  edgeStyle: 'orthogonalEdgeStyle',
  rounded: true,
  strokeColor: INK,
  fontColor: '#111827',
  fontSize: 11,
  fontFamily: 'Helvetica',
  endArrow: 'classic',
  labelBackgroundColor: '#ffffff',
  strokeWidth: 1,
};

/** Titik sambung bawaan untuk shape tanpa stencil: 4 sisi + 4 titik seperempat. */
const DEFAULT_POINTS: [number, number][] = [
  [0.5, 0],
  [0.5, 1],
  [0, 0.5],
  [1, 0.5],
  [0.25, 0],
  [0.75, 0],
  [0.25, 1],
  [0.75, 1],
  [0, 0.25],
  [0, 0.75],
  [1, 0.25],
  [1, 0.75],
];

export interface EditorEvents {
  /** Seleksi berubah. */
  select?: (cells: Cell[]) => void;
  /** Isi diagram berubah (untuk simpan otomatis). */
  change?: () => void;
  /** Zoom berubah (skala 1 = 100%). */
  zoom?: (scale: number) => void;
  /** Status undo/redo berubah. */
  history?: (canUndo: boolean, canRedo: boolean) => void;
}

export interface PageSettings {
  grid: boolean;
  gridSize: number;
  background: string;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface LayerInfo {
  cell: Cell;
  name: string;
  visible: boolean;
  locked: boolean;
  active: boolean;
  count: number;
}

export type LayoutKind = 'vertical' | 'horizontal' | 'tree' | 'circle' | 'organic';

/** Akar pohon: shape tanpa garis masuk (atau shape pertama bila semuanya punya). */
function treeRoots(parent: Cell): Cell[] {
  const kids = parent.children ?? [];
  const vertices = kids.filter((c) => c.isVertex());
  const targets = new Set(
    kids
      .filter((c) => c.isEdge() && c.getTerminal(true) !== c.getTerminal(false))
      .map((e) => e.getTerminal(false)),
  );
  const roots = vertices.filter((v) => !targets.has(v));
  return roots.length ? roots : vertices.slice(0, 1);
}

/** Teks polos dari label (HTML dibuang). */
export function labelText(value: unknown): string {
  return String(value ?? '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;

/** Gaya bawaan, grup tanpa bingkai, titik sambung, dan kunci layer: dipakai editor dan render offscreen. */
export function configureGraph(graph: Graph): void {
  graph.setHtmlLabels(true);
  const styles = graph.getStylesheet();
  Object.assign(styles.getDefaultVertexStyle(), DEFAULT_VERTEX);
  Object.assign(styles.getDefaultEdgeStyle(), DEFAULT_EDGE);
  styles.putCellStyle('text', { fillColor: 'none', strokeColor: 'none', whiteSpace: 'wrap' });
  styles.putCellStyle('group', { fillColor: 'none', strokeColor: 'none', pointerEvents: false });

  // Grup tanpa bingkai (seperti format .drawio: style "group").
  graph.createGroupCell = () => {
    const g = new (graph.getDataModel().getRoot()!.constructor as typeof Cell)('', new Geometry(), {
      baseStyleNames: ['group'],
    });
    g.setVertex(true);
    g.setConnectable(false);
    return g;
  };

  // Titik sambung: dari stencil bila ada, selain itu 12 titik bawaan.
  const baseConstraints = graph.getAllConnectionConstraints.bind(graph);
  graph.getAllConnectionConstraints = (terminal: CellState | null, source: boolean) => {
    const own = baseConstraints(terminal, source);
    if (own?.length) return own;
    if (!terminal || !terminal.cell.isVertex()) return null;
    const names = terminal.cell.getStyle()?.baseStyleNames ?? [];
    if (names.includes('text') || names.includes('group')) return null;
    return DEFAULT_POINTS.map(([x, y]) => new ConnectionConstraint(new Point(x, y), true));
  };

  // Layer terkunci (style locked=1 pada layer, seperti .drawio): isinya tidak bisa dipilih/diubah.
  const baseLocked = graph.isCellLocked.bind(graph);
  graph.isCellLocked = (cell: Cell) => baseLocked(cell) || inLockedLayer(cell);
  const baseSelectable = graph.isCellSelectable.bind(graph);
  graph.isCellSelectable = (cell: Cell) => baseSelectable(cell) && !inLockedLayer(cell);
}

/** Sel berada di layer yang terkunci. */
function inLockedLayer(cell: Cell | null): boolean {
  for (let c = cell; c; c = c.getParent()) {
    const p = c.getParent();
    if (p && !p.getParent()) return isLocked(c);
  }
  return false;
}
const isLocked = (layer: Cell) => {
  const v = (layer.getStyle() as Record<string, unknown> | null)?.locked;
  return v === 1 || v === true || v === '1';
};

export class DiagramEditor {
  readonly graph: Graph;
  readonly undo = new UndoManager(200);
  private keys: KeyHandler;
  private settings: PageSettings = { grid: true, gridSize: 10, background: '#ffffff' };
  private spaceDown = false;
  private disposers: (() => void)[] = [];

  constructor(
    readonly container: HTMLElement,
    private on: EditorEvents = {},
  ) {
    installCspSafeDom();
    registerStencils();
    // Gambar kecil bawaan maxGraph (titik sambung point.gif) disalin oleh scripts/vendor.mjs.
    Client.setImageBasePath(`${VENDOR.maxgraph}images`);
    InternalEvent.disableContextMenu(container);
    const graph = new Graph(container, undefined, [...getDefaultPlugins(), RubberBandHandler]);
    this.graph = graph;

    graph.setConnectable(true);
    graph.setAllowDanglingEdges(true);
    graph.setDisconnectOnMove(false);
    graph.setPanning(true);
    graph.setTooltips(false);
    graph.setGridSize(this.settings.gridSize);
    graph.setGridEnabled(true);
    graph.setDropEnabled(true);
    graph.setSplitEnabled(false);
    graph.options.foldingEnabled = false;
    graph.centerZoom = false;
    graph.setAllowLoops(true);

    configureGraph(graph);

    const panning = graph.getPlugin<PanningHandler>('PanningHandler');
    if (panning) {
      panning.useLeftButtonForPanning = false;
      panning.usePopupTrigger = false;
      panning.isPanningTrigger = (me) => {
        const evt = me.getEvent();
        return this.spaceDown || evt.button === 1 || evt.button === 2;
      };
    }
    const sel = graph.getPlugin<SelectionHandler>('SelectionHandler');
    if (sel) sel.guidesEnabled = true;
    const conn = graph.getPlugin<ConnectionHandler>('ConnectionHandler');
    if (conn) {
      conn.createTarget = false;
      conn.select = true;
      // maxGraph 0.25 memanggil insertEdge dengan id '' (bukan null), sehingga model tidak
      // membuatkan id dan garis pertama ber-id kosong. Paksa null supaya id dibuat otomatis.
      const insertEdge = conn.insertEdge.bind(conn);
      // Garis yang ditarik dari pin komponen elektronika/gerbang logika menjadi kabel.
      conn.insertEdge = (parent, id, value, source, target, style) => {
        const wire =
          isWireShape(source?.getStyle()?.shape) || isWireShape(target?.getStyle()?.shape);
        const s = wire ? { ...(style ?? {}), ...WIRE_STYLE } : style;
        return insertEdge(parent, (id || null) as string, value, source, target, s);
      };
    }

    // Undo/redo.
    const record = (_s: unknown, evt: EventObject) => {
      this.undo.undoableEditHappened(evt.getProperty('edit'));
      this.emitHistory();
    };
    graph.getDataModel().addListener(InternalEvent.UNDO, record);
    graph.getView().addListener(InternalEvent.UNDO, record);
    this.undo.addListener(InternalEvent.UNDO, () => this.emitHistory());
    this.undo.addListener(InternalEvent.REDO, () => this.emitHistory());

    graph.getDataModel().addListener(InternalEvent.CHANGE, () => this.on.change?.());
    graph
      .getSelectionModel()
      .addListener(InternalEvent.CHANGE, () => this.on.select?.(graph.getSelectionCells()));
    const viewChanged = () => {
      this.paintGrid();
      this.on.zoom?.(graph.getView().scale);
    };
    graph.getView().addListener(InternalEvent.SCALE, viewChanged);
    graph.getView().addListener(InternalEvent.TRANSLATE, viewChanged);
    graph.getView().addListener(InternalEvent.SCALE_AND_TRANSLATE, viewChanged);

    this.keys = new KeyHandler(graph, container);
    this.bindKeys();
    this.bindWheel();
    this.bindSpace();
    container.tabIndex = 0;
    const focus = () => {
      if (!graph.isEditing()) container.focus({ preventScroll: true });
    };
    container.addEventListener('pointerdown', focus);
    this.disposers.push(() => container.removeEventListener('pointerdown', focus));

    graph.getView().setTranslate(40, 40);
    this.applySettings();
  }

  // --- Tampilan ---------------------------------------------------------------------------------

  private paintGrid() {
    const { grid, gridSize, background } = this.settings;
    const c = this.container;
    c.style.backgroundColor = background === 'none' ? '#ffffff' : background;
    if (!grid) {
      c.style.backgroundImage = 'none';
      return;
    }
    const view = this.graph.getView();
    const step = gridSize * view.scale;
    // Grid halus terlalu rapat saat zoom kecil: tampilkan tiap 4 sel.
    const size = step < 6 ? step * 4 : step;
    const ox = (view.translate.x * view.scale) % size;
    const oy = (view.translate.y * view.scale) % size;
    const line = 'rgba(31,41,55,0.08)';
    c.style.backgroundImage = `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`;
    c.style.backgroundSize = `${size}px ${size}px`;
    c.style.backgroundPosition = `${ox}px ${oy}px`;
  }

  getSettings(): PageSettings {
    return { ...this.settings };
  }

  setSettings(s: Partial<PageSettings>) {
    this.settings = { ...this.settings, ...s };
    this.applySettings();
    this.on.change?.();
  }

  private applySettings() {
    this.graph.setGridSize(this.settings.gridSize);
    this.graph.setGridEnabled(this.settings.grid);
    this.paintGrid();
  }

  // --- Navigasi ---------------------------------------------------------------------------------

  private bindWheel() {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const view = this.graph.getView();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
        const rect = this.container.getBoundingClientRect();
        this.zoomAt(view.scale * factor, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        const mul = e.deltaMode === 1 ? 16 : 1;
        view.setTranslate(
          view.translate.x - (dx * mul) / view.scale,
          view.translate.y - (dy * mul) / view.scale,
        );
      }
    };
    this.container.addEventListener('wheel', onWheel, { passive: false });
    this.disposers.push(() => this.container.removeEventListener('wheel', onWheel));
  }

  private bindSpace() {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !this.graph.isEditing() && e.target === this.container) {
        e.preventDefault();
        this.spaceDown = true;
        this.container.style.cursor = 'grab';
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.container.style.cursor = '';
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.disposers.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    });
  }

  /** Zoom ke skala `s` dengan titik layar (x, y) tetap di tempat. */
  zoomAt(s: number, x: number, y: number) {
    const view = this.graph.getView();
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    const gx = x / view.scale - view.translate.x;
    const gy = y / view.scale - view.translate.y;
    view.scaleAndTranslate(scale, x / scale - gx, y / scale - gy);
  }

  zoom(factor: number) {
    const r = this.container.getBoundingClientRect();
    this.zoomAt(this.graph.getView().scale * factor, r.width / 2, r.height / 2);
  }

  zoomTo(scale: number) {
    const r = this.container.getBoundingClientRect();
    this.zoomAt(scale, r.width / 2, r.height / 2);
  }

  /** Tampilkan seluruh diagram (maksimal 100%). */
  fit(margin = 40) {
    const view = this.graph.getView();
    const b = this.graph.getGraphBounds();
    const r = this.container.getBoundingClientRect();
    if (!b.width || !b.height) {
      view.scaleAndTranslate(1, 40, 40);
      return;
    }
    const gw = b.width / view.scale;
    const gh = b.height / view.scale;
    const gx = b.x / view.scale - view.translate.x;
    const gy = b.y / view.scale - view.translate.y;
    const s = Math.min(1, (r.width - margin * 2) / gw, (r.height - margin * 2) / gh);
    const scale = Math.max(MIN_SCALE, s);
    view.scaleAndTranslate(
      scale,
      (r.width / scale - gw) / 2 - gx,
      (r.height / scale - gh) / 2 - gy,
    );
  }

  // --- Menambah shape ---------------------------------------------------------------------------

  /** Titik tengah layar dalam koordinat diagram. */
  private viewCenter(): Point {
    const view = this.graph.getView();
    const r = this.container.getBoundingClientRect();
    return new Point(
      r.width / 2 / view.scale - view.translate.x,
      r.height / 2 / view.scale - view.translate.y,
    );
  }

  private snap(n: number) {
    return this.graph.snap(n);
  }

  /** Masukkan item pustaka di (x, y) koordinat diagram (pojok kiri atas), atau di tengah layar. */
  insert(item: LibItem, x?: number, y?: number): Cell {
    const graph = this.graph;
    const parent = graph.getDefaultParent();
    let cell!: Cell;
    const c = this.viewCenter();
    graph.batchUpdate(() => {
      if (item.kind === 'vertex') {
        const px = this.snap(x ?? c.x - item.w / 2);
        const py = this.snap(y ?? c.y - item.h / 2);
        cell = graph.insertVertex({
          parent,
          value: item.value ?? '',
          position: [px, py],
          size: [item.w, item.h],
          style: { ...item.style },
        });
      } else {
        const px = this.snap(x ?? c.x - item.w / 2);
        const py = this.snap(y ?? c.y);
        const geo = new Geometry(0, 0, 0, 0);
        geo.setTerminalPoint(new Point(px, py), true);
        geo.setTerminalPoint(new Point(px + item.w, py), false);
        geo.relative = true;
        cell = graph.insertEdge({
          parent,
          value: '',
          source: null,
          target: null,
          style: { ...item.style },
        });
        graph.getDataModel().setGeometry(cell, geo);
      }
    });
    graph.setSelectionCell(cell);
    return cell;
  }

  /** Jadikan elemen panel bisa diseret ke kanvas. */
  makeDraggable(el: HTMLElement, item: LibItem, preview: HTMLElement): void {
    gestureUtils.makeDraggable(
      el,
      this.graph,
      (_g, _evt, _target, x, y) => {
        // x, y adalah posisi kursor dalam koordinat diagram: jadikan titik tengah shape.
        const px = (x ?? 0) - item.w / 2;
        const py = (y ?? 0) - (item.kind === 'vertex' ? item.h / 2 : 0);
        this.insert(item, px, py);
      },
      preview,
      0,
      0,
      true,
      true,
      false,
    );
  }

  // --- Format -----------------------------------------------------------------------------------

  selection(): Cell[] {
    return this.graph.getSelectionCells();
  }

  /** Gaya efektif sel pertama yang dipilih (sudah digabung dengan gaya bawaan). */
  selectionStyle(): CellStyle | null {
    const cell = this.selection()[0];
    if (!cell) return null;
    return { ...this.graph.getCellStyle(cell) } as CellStyle;
  }

  setStyle<K extends keyof CellStyle>(
    key: K,
    value: CellStyle[K] | null,
    cells = this.selection(),
  ) {
    if (!cells.length) return;
    this.graph.setCellStyles(key as never, value as never, cells);
  }

  /** Nyalakan/matikan bit fontStyle (1 tebal, 2 miring, 4 garis bawah). */
  toggleFontFlag(flag: 1 | 2 | 4) {
    const cells = this.selection();
    if (!cells.length) return;
    const current = Number(this.graph.getCellStyle(cells[0]).fontStyle ?? 0);
    const next = current & flag ? current & ~flag : current | flag;
    this.setStyle('fontStyle', next, cells);
  }

  // --- Susun ------------------------------------------------------------------------------------

  align(where: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    const cells = this.selection().filter((c) => c.isVertex());
    if (cells.length > 1) this.graph.alignCells(where, cells);
  }

  distribute(horizontal: boolean) {
    const cells = this.selection().filter((c) => c.isVertex() && c.getGeometry());
    if (cells.length < 3) return;
    const geo = (c: Cell) => c.getGeometry()!;
    const sorted = cells
      .slice()
      .sort((a, b) => (horizontal ? geo(a).x - geo(b).x : geo(a).y - geo(b).y));
    const first = geo(sorted[0]);
    const last = geo(sorted[sorted.length - 1]);
    const total = sorted.reduce((s, c) => s + (horizontal ? geo(c).width : geo(c).height), 0);
    const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
    const gap = (span - total) / (sorted.length - 1);
    const model = this.graph.getDataModel();
    this.graph.batchUpdate(() => {
      let pos = horizontal ? first.x : first.y;
      for (const c of sorted) {
        const g = geo(c).clone();
        if (horizontal) g.x = pos;
        else g.y = pos;
        pos += (horizontal ? g.width : g.height) + gap;
        model.setGeometry(c, g);
      }
    });
  }

  toFront() {
    this.graph.orderCells(false);
  }

  toBack() {
    this.graph.orderCells(true);
  }

  group() {
    const cells = this.selection();
    if (cells.length < 2) return;
    const g = this.graph.groupCells(null as unknown as Cell, 0, cells);
    this.graph.setSelectionCell(g);
  }

  ungroup() {
    const cells = this.selection();
    if (cells.length) this.graph.setSelectionCells(this.graph.ungroupCells(cells));
  }

  // --- Edit -------------------------------------------------------------------------------------

  remove() {
    if (this.graph.isEditing()) return;
    this.graph.removeCells(this.selection(), true);
  }

  copy() {
    if (this.selection().length) Clipboard.copy(this.graph, this.selection());
  }

  cut() {
    if (this.selection().length) Clipboard.cut(this.graph, this.selection());
  }

  paste() {
    if (!Clipboard.isEmpty()) Clipboard.paste(this.graph);
  }

  duplicate() {
    const cells = this.selection();
    if (!cells.length) return;
    const s = this.settings.gridSize * 2;
    const copies = this.graph.moveCells(cells, s, s, true);
    this.graph.setSelectionCells(copies);
  }

  selectAll() {
    this.graph.selectAll();
  }

  nudge(dx: number, dy: number) {
    const cells = this.selection();
    if (cells.length && !this.graph.isEditing()) this.graph.moveCells(cells, dx, dy);
  }

  doUndo() {
    if (this.graph.isEditing()) this.graph.stopEditing(false);
    this.undo.undo();
  }

  doRedo() {
    this.undo.redo();
  }

  private emitHistory() {
    this.on.history?.(this.undo.canUndo(), this.undo.canRedo());
  }

  private bindKeys() {
    const k = this.keys;
    const g = this.settings;
    const step = (shift: boolean) => (shift ? g.gridSize : 1);
    k.bindKey(46, () => this.remove());
    k.bindKey(8, () => this.remove());
    k.bindKey(37, (e: KeyboardEvent) => this.nudge(-step(e.shiftKey), 0));
    k.bindKey(38, (e: KeyboardEvent) => this.nudge(0, -step(e.shiftKey)));
    k.bindKey(39, (e: KeyboardEvent) => this.nudge(step(e.shiftKey), 0));
    k.bindKey(40, (e: KeyboardEvent) => this.nudge(0, step(e.shiftKey)));
    k.bindShiftKey(37, () => this.nudge(-g.gridSize, 0));
    k.bindShiftKey(38, () => this.nudge(0, -g.gridSize));
    k.bindShiftKey(39, () => this.nudge(g.gridSize, 0));
    k.bindShiftKey(40, () => this.nudge(0, g.gridSize));
    k.bindKey(113, () => this.editSelected()); // F2
    k.bindControlKey(65, () => this.selectAll());
    k.bindControlKey(67, () => this.copy());
    k.bindControlKey(88, () => this.cut());
    k.bindControlKey(86, () => this.paste());
    k.bindControlKey(68, () => this.duplicate());
    k.bindControlKey(90, () => this.doUndo());
    k.bindControlKey(89, () => this.doRedo());
    k.bindControlShiftKey(90, () => this.doRedo());
    k.bindControlKey(71, () => this.group());
    k.bindControlShiftKey(85, () => this.ungroup());
    k.bindControlKey(48, () => this.zoomTo(1));
    k.bindControlShiftKey(72, () => this.fit());
    // Escape ditangani khusus oleh KeyHandler (membatalkan aksi), jadi kosongkan seleksi di sini.
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !this.graph.isEditing() && e.target === this.container)
        this.graph.clearSelection();
    };
    this.container.addEventListener('keydown', esc);
    this.disposers.push(() => this.container.removeEventListener('keydown', esc));
    // Ctrl+D, Ctrl+G, dan lainnya juga punya fungsi bawaan browser: cegah.
    const block = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && /^[adgsyz0]$/i.test(e.key) && e.target === this.container)
        e.preventDefault();
    };
    this.container.addEventListener('keydown', block);
    this.disposers.push(() => this.container.removeEventListener('keydown', block));
  }

  editSelected() {
    const cell = this.selection()[0];
    if (cell) this.graph.startEditingAtCell(cell);
  }

  // --- Layer ------------------------------------------------------------------------------------

  /** Daftar layer dari bawah ke atas. */
  layers(): LayerInfo[] {
    const root = this.graph.getDataModel().getRoot();
    const active = this.graph.getDefaultParent();
    return (root?.children ?? []).map((c, i) => ({
      cell: c,
      name: String(c.getValue() || `Layer ${i + 1}`),
      visible: c.isVisible(),
      locked: isLocked(c),
      active: c === active,
      count: c.getChildCount(),
    }));
  }

  addLayer(name: string): Cell {
    const model = this.graph.getDataModel();
    const layer = new (model.getRoot()!.constructor as typeof Cell)(name);
    model.add(model.getRoot(), layer);
    this.graph.setDefaultParent(layer);
    return layer;
  }

  removeLayer(layer: Cell) {
    const model = this.graph.getDataModel();
    const root = model.getRoot();
    if (!root || root.getChildCount() < 2) return;
    this.graph.batchUpdate(() => model.remove(layer));
    this.graph.setDefaultParent(root.getChildAt(root.getChildCount() - 1));
  }

  renameLayer(layer: Cell, name: string) {
    this.graph.getDataModel().setValue(layer, name);
  }

  setLayerVisible(layer: Cell, visible: boolean) {
    this.graph.getDataModel().setVisible(layer, visible);
  }

  setLayerLocked(layer: Cell, locked: boolean) {
    const style = { ...(layer.getStyle() ?? {}) } as Record<string, unknown>;
    if (locked) style.locked = 1;
    else delete style.locked;
    this.graph.getDataModel().setStyle(layer, style as CellStyle);
    if (locked) this.graph.removeSelectionCells(this.selection().filter((c) => inLockedLayer(c)));
  }

  setActiveLayer(layer: Cell) {
    this.graph.setDefaultParent(layer);
    this.graph.clearSelection();
  }

  /** Pindahkan shape terpilih ke layer lain (posisi tetap). */
  moveSelectionToLayer(layer: Cell) {
    const cells = this.selection().filter((c) => c.getParent() !== layer);
    if (cells.length) this.graph.moveCells(cells, 0, 0, false, layer);
  }

  // --- Tata letak otomatis ------------------------------------------------------------------------

  layout(kind: LayoutKind) {
    const graph = this.graph;
    const parent = graph.getDefaultParent();
    const sel = this.selection().filter((c) => c.isVertex());
    graph.batchUpdate(() => {
      if (kind === 'vertical' || kind === 'horizontal') {
        const l = new HierarchicalLayout(graph, kind === 'vertical' ? 'north' : 'west');
        l.intraCellSpacing = 40;
        l.interRankCellSpacing = 70;
        l.execute(parent, sel.length ? sel : undefined);
      } else if (kind === 'tree') {
        const roots = sel.length ? sel : treeRoots(parent);
        const l = new CompactTreeLayout(graph, false);
        l.levelDistance = 40;
        l.nodeDistance = 30;
        l.edgeRouting = false;
        for (const r of roots) l.execute(parent, r);
      } else if (kind === 'circle') {
        new CircleLayout(graph).execute(parent);
      } else {
        const l = new FastOrganicLayout(graph);
        l.forceConstant = 120;
        l.execute(parent);
      }
      // Titik belok dari algoritma layout bentrok dengan garis siku: biarkan garis dirutekan ulang.
      const model = graph.getDataModel();
      for (const c of parent.children ?? []) {
        const g = c.isEdge() ? c.getGeometry() : null;
        if (g?.points?.length) {
          const ng = g.clone();
          ng.points = [];
          model.setGeometry(c, ng);
        }
      }
    });
    this.fit();
  }

  // --- Cari dan ganti -----------------------------------------------------------------------------

  /** Sel di layer aktif dan layer lain yang labelnya memuat `query` (tanpa membedakan huruf besar). */
  find(query: string): Cell[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Cell[] = [];
    const walk = (c: Cell) => {
      for (const k of c.children ?? []) {
        if ((k.isVertex() || k.isEdge()) && labelText(k.getValue()).toLowerCase().includes(q))
          out.push(k);
        walk(k);
      }
    };
    const root = this.graph.getDataModel().getRoot();
    if (root) for (const layer of root.children ?? []) if (layer.isVisible()) walk(layer);
    return out;
  }

  /** Pilih sel dan geser tampilan supaya sel berada di tengah. */
  focusCell(cell: Cell) {
    const graph = this.graph;
    graph.setSelectionCell(cell);
    const st = graph.getView().getState(cell);
    if (!st) return;
    const view = graph.getView();
    const r = this.container.getBoundingClientRect();
    const cx = (st.x + st.width / 2) / view.scale - view.translate.x;
    const cy = (st.y + st.height / 2) / view.scale - view.translate.y;
    view.setTranslate(r.width / 2 / view.scale - cx, r.height / 2 / view.scale - cy);
  }

  /** Ganti teks di semua label yang cocok; mengembalikan jumlah sel yang berubah. */
  replaceAll(query: string, replacement: string): number {
    const cells = this.find(query);
    if (!cells.length) return 0;
    const re = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const model = this.graph.getDataModel();
    this.graph.batchUpdate(() => {
      for (const c of cells) {
        const v = String(c.getValue() ?? '');
        // Ganti hanya di luar tag HTML.
        const next = v.replace(
          /(^|>)([^<]*)/g,
          (_m, a: string, txt: string) => a + txt.replace(re, replacement),
        );
        model.setValue(c, next);
      }
    });
    return cells.length;
  }

  // --- Sisipkan ------------------------------------------------------------------------------------

  insertImage(src: string, width: number, height: number): Cell {
    const c = this.viewCenter();
    let cell!: Cell;
    this.graph.batchUpdate(() => {
      cell = this.graph.insertVertex({
        parent: this.graph.getDefaultParent(),
        value: '',
        position: [this.snap(c.x - width / 2), this.snap(c.y - height / 2)],
        size: [width, height],
        style: {
          shape: 'image',
          image: src,
          imageAspect: true,
          verticalLabelPosition: 'bottom',
          verticalAlign: 'top',
          strokeColor: 'none',
          fillColor: 'none',
        },
      });
    });
    this.graph.setSelectionCell(cell);
    return cell;
  }

  /** Tabel sebagai label HTML (bisa diedit langsung, kompatibel .drawio). */
  insertTable(rows: number, cols: number, header = true): Cell {
    const cell = (r: number, c: number) => {
      const tag = header && r === 0 ? 'th' : 'td';
      const txt = header && r === 0 ? `Kolom ${c + 1}` : '';
      return `<${tag} style="border:1px solid #1f2937;padding:4px 6px;${tag === 'th' ? 'background:#f3f4f6;' : ''}">${txt || '&nbsp;'}</${tag}>`;
    };
    const html = `<table style="width:100%;height:100%;border-collapse:collapse;">${Array.from(
      { length: rows },
      (_, r) => `<tr>${Array.from({ length: cols }, (_, c) => cell(r, c)).join('')}</tr>`,
    ).join('')}</table>`;
    const w = Math.max(160, cols * 90);
    const h = Math.max(60, rows * 28);
    const c = this.viewCenter();
    let out!: Cell;
    this.graph.batchUpdate(() => {
      out = this.graph.insertVertex({
        parent: this.graph.getDefaultParent(),
        value: html,
        position: [this.snap(c.x - w / 2), this.snap(c.y - h / 2)],
        size: [w, h],
        style: {
          overflow: 'fill',
          fillColor: '#ffffff',
          strokeColor: 'none',
          verticalAlign: 'top',
          align: 'left',
        },
      });
    });
    this.graph.setSelectionCell(out);
    return out;
  }

  // --- Minimap ---------------------------------------------------------------------------------------

  /** Pasang minimap di elemen `el`; kembalikan fungsi pembersih. */
  outline(el: HTMLElement): () => void {
    const o = new Outline(this.graph, el);
    return () => o.destroy();
  }

  // --- Simpan dan muat ---------------------------------------------------------------------------

  /** XML mxGraphModel (format .drawio) dari diagram saat ini. */
  toModelXml(): string {
    return modelToXml(this.graph.getDataModel(), this.settings);
  }

  toFile(name = 'Halaman-1'): string {
    return toDrawioFile([{ name, model: this.toModelXml() }]);
  }

  /** Muat XML mxGraphModel; riwayat undo dikosongkan. */
  loadModelXml(xml: string) {
    const graph = this.graph;
    const opts = modelOptions(xml);
    graph.getDataModel().clear();
    new ModelXmlSerializer(graph.getDataModel()).import(xml);
    fixDataImages(graph);
    this.settings = {
      grid: opts.grid ?? true,
      gridSize: opts.gridSize ?? 10,
      background: opts.background ?? '#ffffff',
    };
    this.applySettings();
    this.undo.clear();
    this.emitHistory();
  }

  /** Muat isi file .drawio (halaman pertama). */
  loadFile(text: string): string[] {
    const pages = readDrawio(text);
    this.loadModelXml(pages[0].model);
    this.fit();
    return pages.map((p) => p.name);
  }

  clear() {
    this.graph.getDataModel().clear();
    this.undo.clear();
    this.emitHistory();
    this.graph.getView().scaleAndTranslate(1, 40, 40);
  }

  isEmpty(): boolean {
    const layer = this.graph.getDefaultParent();
    return !layer.getChildCount();
  }

  // --- Ekspor gambar ----------------------------------------------------------------------------

  /** SVG mandiri dari seluruh diagram (atau sel terpilih saja). */
  toSvg(opts: { border?: number; background?: boolean; selectionOnly?: boolean } = {}) {
    const cells = opts.selectionOnly && this.selection().length ? this.selection() : null;
    return exportSvg(this.graph, opts.background === false ? 'none' : this.settings.background, {
      border: opts.border,
      cells,
    });
  }

  /** PNG dari SVG di atas, digambar ke canvas dengan skala tertentu. */
  async toPng(scale = 2, transparent = false, selectionOnly = false): Promise<Blob> {
    const { svg, width, height } = this.toSvg({ background: !transparent, selectionOnly });
    return rasterize(svg, width, height, scale);
  }

  destroy() {
    for (const d of this.disposers) d();
    this.keys.onDestroy();
    this.graph.destroy();
  }
}

export interface SvgResult {
  svg: string;
  width: number;
  height: number;
}

/** Gambar graph (atau sel tertentu) ke SVG mandiri dengan bingkai `border` piksel. */
export function exportSvg(
  graph: Graph,
  background: string,
  opts: { border?: number; cells?: Cell[] | null } = {},
): SvgResult {
  const view = graph.getView();
  const border = opts.border ?? 16;
  const cells = opts.cells?.length ? opts.cells : null;
  const vs = view.scale;
  let bounds: Rectangle | null = cells ? graph.getBoundingBox(cells) : graph.getGraphBounds();
  if (!bounds || !bounds.width) bounds = new Rectangle(0, 0, 1, 1);
  const w = Math.ceil(bounds.width / vs + border * 2);
  const h = Math.ceil(bounds.height / vs + border * 2);

  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('xmlns', SVG_NS);
  root.setAttribute('width', String(w));
  root.setAttribute('height', String(h));
  root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  if (background && background !== 'none') {
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', background);
    root.appendChild(bg);
  }
  const group = document.createElementNS(SVG_NS, 'g');
  root.appendChild(group);
  const canvas = new SvgCanvas2D(group, false);
  canvas.translate(Math.floor(border - bounds.x / vs), Math.floor(border - bounds.y / vs));
  canvas.scale(1 / vs);
  const exp = new ImageExport();
  if (cells) {
    for (const c of cells) {
      const st = view.getState(c);
      if (st) exp.visitStatesRecursive(st, canvas, (s, cv) => exp.drawCellState(s, cv));
    }
  } else {
    const st = view.getState(graph.getDataModel().getRoot()!);
    if (st) exp.drawState(st, canvas);
  }
  return { svg: new XMLSerializer().serializeToString(root), width: w, height: h };
}

/** SVG → PNG. Dimuat sebagai data: URL, bukan blob: — Chrome menandai canvas "tercemar" bila SVG
 * berisi foreignObject (label HTML) dimuat dari blob:, sehingga toBlob gagal. */
export async function rasterize(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
  );
}

/** Render XML mxGraphModel (halaman lain, template) ke SVG di graph tersembunyi. */
export function renderModelSvg(
  xml: string,
  opts: { border?: number; transparent?: boolean } = {},
): SvgResult {
  installCspSafeDom();
  registerStencils();
  const host = document.createElement('div');
  host.style.cssText =
    'position:absolute;left:-10000px;top:0;width:800px;height:600px;overflow:hidden;';
  document.body.appendChild(host);
  const graph = new Graph(host);
  try {
    configureGraph(graph);
    new ModelXmlSerializer(graph.getDataModel()).import(xml);
    fixDataImages(graph);
    const bg = opts.transparent ? 'none' : (modelOptions(xml).background ?? '#ffffff');
    return exportSvg(graph, bg, { border: opts.border });
  } finally {
    graph.destroy();
    host.remove();
  }
}

/** .drawio menyimpan gambar sebagai "data:image/png,BASE64" (tanpa ;base64 karena ; memisah style). */
function fixDataImages(graph: Graph) {
  const model = graph.getDataModel();
  const walk = (c: Cell) => {
    const img = c.getStyle()?.image;
    if (typeof img === 'string' && /^data:image\/[\w.+-]+,/.test(img) && !img.includes(';base64,'))
      model.setStyle(c, {
        ...c.getStyle(),
        image: img.replace(/^(data:image\/[\w.+-]+),/, '$1;base64,'),
      });
    for (const k of c.children ?? []) walk(k);
  };
  const root = model.getRoot();
  if (root) walk(root);
}

/** Gambar ujung garis untuk ikon panel; `ang` = arah garis menuju ujung (radian). */
function iconMarker(
  type: string | undefined,
  filled: boolean,
  x: number,
  y: number,
  ang: number,
): string {
  if (!type || type === 'none') return '';
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const at = (back: number, side: number) =>
    `${(x - ux * back - uy * side).toFixed(1)} ${(y - uy * back + ux * side).toFixed(1)}`;
  const fill = filled ? INK : '#ffffff';
  const st = `stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"`;
  switch (type) {
    case 'open':
      return `<path d="M${at(8, 4.5)} L${x} ${y} L${at(8, -4.5)}" fill="none" ${st}/>`;
    case 'diamond':
      return `<path d="M${x} ${y} L${at(6, 4)} L${at(12, 0)} L${at(6, -4)} Z" fill="${fill}" ${st}/>`;
    case 'ERmandOne':
      return `<path d="M${at(5, 5)} L${at(5, -5)} M${at(9, 5)} L${at(9, -5)}" ${st}/>`;
    case 'ERone':
      return `<path d="M${at(6, 5)} L${at(6, -5)}" ${st}/>`;
    case 'ERmany':
      return `<path d="M${at(8, 0)} L${at(0, 5)} M${at(8, 0)} L${at(0, -5)}" ${st}/>`;
    case 'ERoneToMany':
      return `<path d="M${at(8, 0)} L${at(0, 5)} M${at(8, 0)} L${at(0, -5)} M${at(11, 5)} L${at(11, -5)}" ${st}/>`;
    case 'ERzeroToMany':
      return `<path d="M${at(8, 0)} L${at(0, 5)} M${at(8, 0)} L${at(0, -5)}" ${st}/><circle cx="${(x - ux * 12).toFixed(1)}" cy="${(y - uy * 12).toFixed(1)}" r="3" fill="#ffffff" ${st}/>`;
    default:
      // classic, block: segitiga (berisi atau kosong).
      return `<path d="M${x} ${y} L${at(9, 4.5)} L${at(9, -4.5)} Z" fill="${type === 'block' && !filled ? '#ffffff' : INK}" ${st}/>`;
  }
}

/** Ikon garis/panah untuk panel (digambar langsung, cukup sederhana). */
function edgeIcon(it: LibItem, size: number): string {
  const m = 5;
  const s = it.style;
  const dash = s.dashed ? ' stroke-dasharray="4 3"' : '';
  const d = s.curved
    ? `M${m} ${size - m} C${size * 0.45} ${size - m} ${size * 0.55} ${m} ${size - m} ${m}`
    : `M${m} ${size - m} L${size - m} ${m}`;
  const angEnd = s.curved ? 0 : -Math.PI / 4;
  const angStart = s.curved ? Math.PI : (3 * Math.PI) / 4;
  const endType = s.endArrow ?? 'classic';
  const end = iconMarker(String(endType), s.endFill !== false, size - m, m, angEnd);
  const start = iconMarker(
    s.startArrow ? String(s.startArrow) : undefined,
    s.startFill !== false,
    m,
    size - m,
    angStart,
  );
  return `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${d}" fill="none" stroke="${INK}" stroke-width="1.5"${dash}/>${end}${start}</svg>`;
}

/** Pratinjau SVG kecil untuk item pustaka; shape digambar oleh maxGraph supaya sama dengan hasilnya. */
export function libraryPreviews(items: LibItem[], size = 36): Map<string, string> {
  installCspSafeDom();
  registerStencils();
  const out = new Map<string, string>();
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:400px;';
  document.body.appendChild(host);
  const graph = new Graph(host);
  Object.assign(graph.getStylesheet().getDefaultVertexStyle(), DEFAULT_VERTEX);
  graph.getStylesheet().putCellStyle('text', { fillColor: 'none', strokeColor: 'none' });
  const parent = graph.getDefaultParent();
  const exp = new ImageExport();
  const pad = 3;
  for (const it of items) {
    if (it.kind === 'edge') {
      out.set(it.id, edgeIcon(it, size));
      continue;
    }
    if (it.id === 'text') {
      out.set(
        it.id,
        `<svg xmlns="${SVG_NS}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><text x="50%" y="62%" text-anchor="middle" font-family="Helvetica" font-size="14" font-weight="bold" fill="${INK}">Aa</text></svg>`,
      );
      continue;
    }
    // Simbol sangat kecil (titik sambungan) tidak diperbesar berlebihan.
    const k = Math.min((size - pad * 2) / it.w, (size - pad * 2) / it.h, 1.6);
    let cell: Cell | null = null;
    graph.batchUpdate(() => {
      cell = graph.insertVertex({
        parent,
        value: '',
        position: [0, 0],
        size: [it.w, it.h],
        style: { ...it.style, shadow: false },
      });
    });
    const state = cell ? graph.getView().getState(cell) : null;
    if (state) {
      const root = document.createElementNS(SVG_NS, 'svg');
      root.setAttribute('xmlns', SVG_NS);
      root.setAttribute('width', String(size));
      root.setAttribute('height', String(size));
      root.setAttribute('viewBox', `0 0 ${size} ${size}`);
      const g = document.createElementNS(SVG_NS, 'g');
      root.appendChild(g);
      const canvas = new SvgCanvas2D(g, false);
      const view = graph.getView();
      canvas.translate(
        (size - it.w * k) / 2 / k - view.translate.x,
        (size - it.h * k) / 2 / k - view.translate.y,
      );
      canvas.scale(k);
      exp.drawState(state, canvas);
      out.set(it.id, new XMLSerializer().serializeToString(root));
    }
    if (cell) graph.removeCells([cell], true);
  }
  graph.destroy();
  host.remove();
  return out;
}
