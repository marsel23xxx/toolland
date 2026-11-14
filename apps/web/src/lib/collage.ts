/**
 * Kolase foto: tata letak, ukuran kanvas, potongan "cover" dengan zoom/geser, dan penggambaran.
 * Pratinjau dan hasil unduhan memakai `drawCollage` yang sama, jadi hasilnya persis seperti layar.
 * Koordinat tata letak dalam pecahan 0-1 dari kanvas (tanpa jarak antarfoto).
 */

export interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  id: string;
  cells: Cell[];
}

export const MIN_PHOTOS = 2;
export const MAX_PHOTOS = 9;

export const RATIOS = {
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '3:4': [1080, 1440],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
} as const;
export type Ratio = keyof typeof RATIOS;

/** Bagi n foto ke beberapa baris serata mungkin; baris yang lebih penuh di bawah. */
export function balancedRows(n: number): number[] {
  const rows = Math.max(1, Math.round(Math.sqrt(n)));
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i >= rows - extra ? 1 : 0));
}

/** Baris-baris (counts[i] foto di baris i) di dalam area. */
function rows(counts: number[], area: Cell = { x: 0, y: 0, w: 1, h: 1 }): Cell[] {
  const h = area.h / counts.length;
  return counts.flatMap((c, r) =>
    Array.from({ length: c }, (_, i) => ({
      x: area.x + (i * area.w) / c,
      y: area.y + r * h,
      w: area.w / c,
      h,
    })),
  );
}

/** Kolom-kolom: sama seperti rows tapi ditransposisi. */
function cols(counts: number[], area: Cell = { x: 0, y: 0, w: 1, h: 1 }): Cell[] {
  return rows(counts, { x: area.y, y: area.x, w: area.h, h: area.w }).map((c) => ({
    x: c.y,
    y: c.x,
    w: c.h,
    h: c.w,
  }));
}

/** Pilihan tata letak untuk n foto, tanpa duplikat. Yang pertama = bawaan. */
export function layoutsFor(n: number): Layout[] {
  const k = Math.min(MAX_PHOTOS, Math.max(1, n));
  const br = balancedRows(k);
  const list: Layout[] = [
    { id: 'rows', cells: rows(br) },
    { id: 'rows-flip', cells: rows([...br].reverse()) },
    { id: 'cols', cells: cols(br) },
  ];
  if (k >= 3) {
    const rest = k - 1;
    const big = k <= 4 ? 0.6 : 0.5;
    list.push({
      id: 'feature-left',
      cells: [
        { x: 0, y: 0, w: big, h: 1 },
        ...cols(balancedRows(rest), { x: big, y: 0, w: 1 - big, h: 1 }).sort(byRowThenCol),
      ],
    });
    list.push({
      id: 'feature-top',
      cells: [
        { x: 0, y: 0, w: 1, h: big },
        ...rows(rest <= 4 ? [rest] : balancedRows(rest), { x: 0, y: big, w: 1, h: 1 - big }),
      ],
    });
  }
  const seen = new Set<string>();
  return list.filter((l) => {
    // Bentuk sama dengan urutan kotak berbeda (misalnya grid 2x2 baris vs kolom) dianggap sama.
    const key = JSON.stringify(
      l.cells.map((c) => [c.x, c.y, c.w, c.h].map((v) => +v.toFixed(4)).join()).sort(),
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function byRowThenCol(a: Cell, b: Cell) {
  return a.y - b.y || a.x - b.x;
}

/**
 * Kotak dalam piksel. `gap` = jarak antarfoto dan tepi kanvas (px). Tepi luar mendapat jarak
 * penuh, tepi dalam setengah dari tiap sisi, jadi semua jarak sama besar.
 */
export function cellRect(c: Cell, W: number, H: number, gap: number): Cell {
  const e = 1e-6;
  const left = c.x < e ? gap : gap / 2;
  const top = c.y < e ? gap : gap / 2;
  const right = c.x + c.w > 1 - e ? gap : gap / 2;
  const bottom = c.y + c.h > 1 - e ? gap : gap / 2;
  return {
    x: c.x * W + left,
    y: c.y * H + top,
    w: Math.max(1, c.w * W - left - right),
    h: Math.max(1, c.h * H - top - bottom),
  };
}

export interface Framing {
  /** 1 = pas menutup kotak; lebih besar = diperbesar. */
  zoom: number;
  /** Posisi geser -1 (kiri/atas) sampai 1 (kanan/bawah), 0 = tengah. */
  panX: number;
  panY: number;
}

export const MAX_ZOOM = 4;

/** Ukuran dan posisi gambar agar menutupi kotak (seperti object-fit: cover) dengan zoom/geser. */
export function coverPlacement(iw: number, ih: number, cell: Cell, f: Framing): Cell {
  const scale = Math.max(cell.w / iw, cell.h / ih) * clamp(f.zoom, 1, MAX_ZOOM);
  const w = iw * scale;
  const h = ih * scale;
  return {
    x: cell.x - ((w - cell.w) * (clamp(f.panX, -1, 1) + 1)) / 2,
    y: cell.y - ((h - cell.h) * (clamp(f.panY, -1, 1) + 1)) / 2,
    w,
    h,
  };
}

/**
 * Geser gambar sejauh (dx, dy) piksel layar. Mengembalikan pan baru; bila gambar tidak punya
 * sisa di satu arah (sudah pas), pan arah itu tetap 0.
 */
export function panBy(
  f: Framing,
  iw: number,
  ih: number,
  cell: Cell,
  dx: number,
  dy: number,
): Pick<Framing, 'panX' | 'panY'> {
  const p = coverPlacement(iw, ih, cell, { ...f, panX: 0, panY: 0 });
  const slackX = p.w - cell.w;
  const slackY = p.h - cell.h;
  return {
    panX: slackX > 0.5 ? clamp(f.panX - (2 * dx) / slackX, -1, 1) : 0,
    panY: slackY > 0.5 ? clamp(f.panY - (2 * dy) / slackY, -1, 1) : 0,
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Indeks kotak di bawah titik (px), atau -1. */
export function cellAt(rects: Cell[], x: number, y: number): number {
  return rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

export interface CollagePhoto {
  image: CanvasImageSource;
  width: number;
  height: number;
  framing: Framing;
}

export interface CollageStyle {
  layout: Layout;
  /** Jarak antarfoto dalam piksel pada lebar 1080 (diskalakan ke ukuran kanvas). */
  gap: number;
  /** Radius sudut dalam piksel pada lebar 1080. */
  radius: number;
  background: string;
}

/** Skala dari satuan desain (sisi pendek 1080) ke piksel kanvas. */
export const unit = (W: number, H: number) => Math.min(W, H) / 1080;

export function collageRects(style: CollageStyle, W: number, H: number): Cell[] {
  const g = style.gap * unit(W, H);
  return style.layout.cells.map((c) => cellRect(c, W, H, g));
}

/** Gambar kolase utuh pada kanvas berukuran W × H. */
export function drawCollage(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  W: number,
  H: number,
  style: CollageStyle,
  photos: (CollagePhoto | null)[],
): void {
  ctx.save();
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  const r = style.radius * unit(W, H);
  collageRects(style, W, H).forEach((cell, i) => {
    const p = photos[i];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cell.x, cell.y, cell.w, cell.h, Math.min(r, cell.w / 2, cell.h / 2));
    ctx.clip();
    if (p) {
      const d = coverPlacement(p.width, p.height, cell, p.framing);
      ctx.drawImage(p.image, d.x, d.y, d.w, d.h);
    } else {
      ctx.fillStyle = 'rgba(128,128,128,0.25)';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
    ctx.restore();
  });
  ctx.restore();
}
