export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cara mengubah ukuran:
 * - scale: persentase dari ukuran asli
 * - box + inside: muat di dalam kotak, rasio tetap (salah satu sisi bisa lebih kecil)
 * - box + cover: isi kotak penuh, kelebihan dipotong di tengah
 * - box + contain: isi kotak penuh, sisa diberi warna latar
 * - box + stretch: paksa ke ukuran kotak
 * Bila hanya width atau height yang diisi, sisi lain mengikuti rasio.
 */
export type ResizeSpec =
  | { kind: 'scale'; percent: number }
  | {
      kind: 'box';
      width?: number;
      height?: number;
      fit: 'inside' | 'cover' | 'contain' | 'stretch';
      /** Boleh memperbesar gambar kecil? Default false untuk inside. */
      enlarge?: boolean;
    };

export interface ResizePlan {
  /** Bagian sumber yang dipakai (untuk cover). */
  crop: Rect;
  /** Ukuran hasil skala dari bagian sumber. */
  scaledWidth: number;
  scaledHeight: number;
  /** Ukuran kanvas akhir (lebih besar dari hasil skala untuk contain). */
  canvasWidth: number;
  canvasHeight: number;
  offsetX: number;
  offsetY: number;
}

const r = (n: number) => Math.max(1, Math.round(n));

export function planResize(srcW: number, srcH: number, spec: ResizeSpec): ResizePlan {
  const full: Rect = { x: 0, y: 0, width: srcW, height: srcH };
  const simple = (w: number, h: number): ResizePlan => ({
    crop: full,
    scaledWidth: w,
    scaledHeight: h,
    canvasWidth: w,
    canvasHeight: h,
    offsetX: 0,
    offsetY: 0,
  });

  if (spec.kind === 'scale') {
    const f = spec.percent / 100;
    return simple(r(srcW * f), r(srcH * f));
  }

  const ratio = srcW / srcH;
  let boxW = spec.width;
  let boxH = spec.height;
  if (!boxW && !boxH) return simple(srcW, srcH);
  if (!boxW) boxW = r(boxH! * ratio);
  if (!boxH) boxH = r(boxW / ratio);

  switch (spec.fit) {
    case 'stretch':
      return simple(boxW, boxH);
    case 'inside': {
      let f = Math.min(boxW / srcW, boxH / srcH);
      if (!spec.enlarge) f = Math.min(f, 1);
      return simple(r(srcW * f), r(srcH * f));
    }
    case 'cover': {
      const target = boxW / boxH;
      let crop = full;
      if (ratio > target) {
        const w = srcH * target;
        crop = { x: Math.round((srcW - w) / 2), y: 0, width: r(w), height: srcH };
      } else if (ratio < target) {
        const h = srcW / target;
        crop = { x: 0, y: Math.round((srcH - h) / 2), width: srcW, height: r(h) };
      }
      return { ...simple(boxW, boxH), crop };
    }
    case 'contain': {
      const f = Math.min(boxW / srcW, boxH / srcH);
      const w = r(srcW * f);
      const h = r(srcH * f);
      return {
        crop: full,
        scaledWidth: w,
        scaledHeight: h,
        canvasWidth: boxW,
        canvasHeight: boxH,
        offsetX: Math.floor((boxW - w) / 2),
        offsetY: Math.floor((boxH - h) / 2),
      };
    }
  }
}

/** Batasi kotak potong agar tetap di dalam gambar dan berukuran bulat. */
export function clampRect(rect: Rect, w: number, h: number): Rect {
  const x = Math.min(Math.max(0, Math.round(rect.x)), w - 1);
  const y = Math.min(Math.max(0, Math.round(rect.y)), h - 1);
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(rect.width), w - x)),
    height: Math.max(1, Math.min(Math.round(rect.height), h - y)),
  };
}

/** Ukuran piksel dari ukuran cetak (cm) pada DPI tertentu, misalnya pas foto 3x4 cm pada 300 DPI. */
export function cmToPx(cm: number, dpi = 300): number {
  return Math.round((cm / 2.54) * dpi);
}
