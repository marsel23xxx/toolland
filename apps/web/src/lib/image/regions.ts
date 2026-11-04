import type { Rect } from './geometry';

/** Rasio irisan terhadap gabungan dua kotak (0-1). */
export function iou(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

/** Buang kotak yang tumpang tindih (non-maximum suppression); kotak dengan skor tertinggi dipertahankan. */
export function mergeDetections(
  boxes: (Rect & { score: number })[],
  threshold = 0.3,
): (Rect & { score: number })[] {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const kept: (Rect & { score: number })[] = [];
  for (const box of sorted) {
    // juga buang kotak yang sebagian besar berada di dalam kotak lain (deteksi ganda dari potongan)
    const inside = (a: Rect, b: Rect) => {
      const x1 = Math.max(a.x, b.x);
      const y1 = Math.max(a.y, b.y);
      const x2 = Math.min(a.x + a.width, b.x + b.width);
      const y2 = Math.min(a.y + a.height, b.y + b.height);
      return (Math.max(0, x2 - x1) * Math.max(0, y2 - y1)) / (a.width * a.height);
    };
    if (kept.every((k) => iou(k, box) < threshold && inside(box, k) < 0.6)) kept.push(box);
  }
  return kept;
}

/** Potongan bertumpuk (grid n×n dengan tumpang tindih 15%) untuk mendeteksi wajah kecil. */
export function tiles(width: number, height: number, n: number): Rect[] {
  if (n <= 1) return [{ x: 0, y: 0, width, height }];
  const tw = Math.ceil((width / n) * 1.3);
  const th = Math.ceil((height / n) * 1.3);
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = Math.min(
        Math.max(0, Math.round((width / n) * j - (tw - width / n) / 2)),
        width - tw,
      );
      const y = Math.min(
        Math.max(0, Math.round((height / n) * i - (th - height / n) / 2)),
        height - th,
      );
      out.push({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(tw, width),
        height: Math.min(th, height),
      });
    }
  }
  return out;
}

/** Perbesar kotak di sekitar pusatnya (agar dahi, dagu, dan rambut ikut tertutup), tetap di dalam gambar. */
export function expand(r: Rect, factor: number, width: number, height: number): Rect {
  const w = r.width * factor;
  const h = r.height * factor;
  const x = Math.max(0, r.x + r.width / 2 - w / 2);
  const y = Math.max(0, r.y + r.height / 2 - h / 2);
  return { x, y, width: Math.min(w, width - x), height: Math.min(h, height - y) };
}
