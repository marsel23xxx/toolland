import { describe, expect, it } from 'vitest';
import { numberAnchor, visualSize, visualToUser } from './geometry';
import { parseRanges } from './ranges';

describe('parseRanges', () => {
  it('rentang, satuan, dan rentang terbuka', () => {
    expect(parseRanges('1-3, 5, 8-', 10)).toEqual([[1, 2, 3], [5], [8, 9, 10]]);
    expect(parseRanges(' -2 ', 5)).toEqual([[1, 2]]);
  });
  it('menolak input salah', () => {
    expect(() => parseRanges('0', 5)).toThrow('0');
    expect(() => parseRanges('3-1', 5)).toThrow('3-1');
    expect(() => parseRanges('1-9', 5)).toThrow('1-9');
    expect(() => parseRanges('a', 5)).toThrow('a');
    expect(() => parseRanges(' , ', 5)).toThrow();
  });
});

describe('geometri halaman berotasi', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 };
  it('ukuran terlihat', () => {
    expect(visualSize(box, 0)).toEqual({ width: 600, height: 800 });
    expect(visualSize(box, 90)).toEqual({ width: 800, height: 600 });
    expect(visualSize(box, -90)).toEqual({ width: 800, height: 600 });
  });
  it('titik kiri bawah terlihat dipetakan ke sudut yang benar', () => {
    expect(visualToUser(box, 0, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(visualToUser(box, 90, 0, 0)).toEqual({ x: 600, y: 0 });
    expect(visualToUser(box, 180, 0, 0)).toEqual({ x: 600, y: 800 });
    expect(visualToUser(box, 270, 0, 0)).toEqual({ x: 0, y: 800 });
  });
  it('memperhitungkan origin CropBox', () => {
    expect(visualToUser({ x: 10, y: 20, width: 100, height: 100 }, 0, 5, 5)).toEqual({
      x: 15,
      y: 25,
    });
  });
  it('posisi nomor halaman', () => {
    const size = { width: 600, height: 800 };
    expect(numberAnchor(size, 'bottom-center', 20, 12, 30)).toEqual({ x: 290, y: 30 });
    expect(numberAnchor(size, 'top-right', 20, 12, 30)).toEqual({ x: 550, y: 761 });
  });
});
