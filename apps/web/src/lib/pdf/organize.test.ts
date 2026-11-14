import { describe, expect, it } from 'vitest';
import {
  duplicatePage,
  initialPages,
  isChanged,
  movePage,
  removePage,
  reversePages,
  rotateAll,
  rotateOne,
} from './organize';

const idx = (items: { index: number }[]) => items.map((p) => p.index);

describe('atur halaman PDF', () => {
  it('awal: urut tanpa putaran, belum berubah', () => {
    const p = initialPages(3);
    expect(idx(p)).toEqual([0, 1, 2]);
    expect(isChanged(p, 3)).toBe(false);
  });

  it('putar satu dan semua halaman, berputar balik ke 0', () => {
    let p = initialPages(2);
    p = rotateOne(p, 1, 90);
    expect(p.map((x) => x.rotate)).toEqual([0, 90]);
    p = rotateAll(p, -90);
    expect(p.map((x) => x.rotate)).toEqual([270, 0]);
    p = rotateOne(rotateOne(rotateOne(p, 0, 90), 1, -90), 1, 90);
    expect(p.map((x) => x.rotate)).toEqual([0, 0]);
    expect(isChanged(p, 2)).toBe(false);
  });

  it('pindah ke depan, ke belakang, dan batas', () => {
    const p = initialPages(4);
    expect(idx(movePage(p, 0, 2))).toEqual([1, 2, 0, 3]);
    expect(idx(movePage(p, 3, 0))).toEqual([3, 0, 1, 2]);
    expect(idx(movePage(p, 1, 99))).toEqual([0, 2, 3, 1]);
    expect(movePage(p, 2, 2)).toBe(p);
  });

  it('hapus, duplikat (id baru), dan balik urutan', () => {
    const p = initialPages(3);
    const d = duplicatePage(p, 1);
    expect(idx(d)).toEqual([0, 1, 1, 2]);
    expect(new Set(d.map((x) => x.id)).size).toBe(4);
    expect(idx(removePage(d, 0))).toEqual([1, 1, 2]);
    expect(idx(reversePages(p))).toEqual([2, 1, 0]);
    expect(isChanged(removePage(p, 2), 3)).toBe(true);
  });
});
