import { describe, expect, it } from 'vitest';
import {
  balancedRows,
  cellAt,
  cellRect,
  coverPlacement,
  layoutsFor,
  MAX_PHOTOS,
  MIN_PHOTOS,
  panBy,
} from './collage';

const area = (cells: { w: number; h: number }[]) => cells.reduce((s, c) => s + c.w * c.h, 0);

describe('balancedRows', () => {
  it('membagi rata, baris penuh di bawah', () => {
    expect(balancedRows(2)).toEqual([2]);
    expect(balancedRows(3)).toEqual([1, 2]);
    expect(balancedRows(5)).toEqual([2, 3]);
    expect(balancedRows(7)).toEqual([2, 2, 3]);
    expect(balancedRows(9)).toEqual([3, 3, 3]);
  });
});

describe('layoutsFor', () => {
  it('setiap tata letak punya kotak sebanyak foto dan menutup seluruh kanvas tanpa tumpang tindih', () => {
    for (let n = MIN_PHOTOS; n <= MAX_PHOTOS; n++) {
      const list = layoutsFor(n);
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
      for (const l of list) {
        expect(l.cells).toHaveLength(n);
        expect(area(l.cells)).toBeCloseTo(1, 6);
        for (const c of l.cells) {
          expect(c.x).toBeGreaterThanOrEqual(-1e-9);
          expect(c.y).toBeGreaterThanOrEqual(-1e-9);
          expect(c.x + c.w).toBeLessThanOrEqual(1 + 1e-9);
          expect(c.y + c.h).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('bentuk yang sama tidak muncul dua kali (grid 2x2 baris = kolom)', () => {
    expect(layoutsFor(4).map((l) => l.id)).toEqual(['rows', 'feature-left', 'feature-top']);
    expect(layoutsFor(2).map((l) => l.id)).toEqual(['rows', 'cols']);
  });

  it('kotak besar ada di urutan pertama pada tata letak unggulan', () => {
    const f = layoutsFor(4).find((l) => l.id === 'feature-left')!;
    expect(f.cells[0].w * f.cells[0].h).toBeGreaterThan(f.cells[1].w * f.cells[1].h);
  });
});

describe('cellRect', () => {
  it('jarak sama di tepi luar dan antarfoto', () => {
    const [a, b] = layoutsFor(2)[0].cells.map((c) => cellRect(c, 1000, 500, 20));
    expect(a.x).toBe(20);
    expect(a.y).toBe(20);
    expect(b.x - (a.x + a.w)).toBeCloseTo(20);
    expect(1000 - (b.x + b.w)).toBeCloseTo(20);
    expect(a.h).toBeCloseTo(460);
  });
});

describe('coverPlacement dan panBy', () => {
  const cell = { x: 0, y: 0, w: 100, h: 100 };
  it('foto lebar menutup kotak, tengah secara bawaan', () => {
    const p = coverPlacement(200, 100, cell, { zoom: 1, panX: 0, panY: 0 });
    expect(p).toEqual({ x: -50, y: 0, w: 200, h: 100 });
    const left = coverPlacement(200, 100, cell, { zoom: 1, panX: -1, panY: 0 });
    expect(left.x).toBe(0);
  });
  it('zoom memperbesar dari tengah', () => {
    const p = coverPlacement(100, 100, cell, { zoom: 2, panX: 0, panY: 0 });
    expect(p).toEqual({ x: -50, y: -50, w: 200, h: 200 });
  });
  it('geser ke kanan memperlihatkan sisi kiri, dibatasi, dan arah tanpa sisa tetap 0', () => {
    const f = { zoom: 1, panX: 0, panY: 0 };
    const moved = panBy(f, 200, 100, cell, 25, 40);
    expect(moved.panX).toBeCloseTo(-0.5);
    expect(moved.panY).toBe(0);
    expect(panBy(f, 200, 100, cell, 1000, 0).panX).toBe(-1);
  });
});

describe('cellAt', () => {
  it('menemukan kotak di bawah titik', () => {
    const rects = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 12, y: 0, w: 10, h: 10 },
    ];
    expect(cellAt(rects, 5, 5)).toBe(0);
    expect(cellAt(rects, 15, 5)).toBe(1);
    expect(cellAt(rects, 11, 5)).toBe(-1);
  });
});
