import { describe, expect, it } from 'vitest';
import { numberAnchor, visualSize, visualToUser } from './geometry';
import { parseRanges } from './ranges';
import { groupLines, pickColors, standardFamily, toHex } from './textlines';

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

describe('baris tulisan PDF (edit teks)', () => {
  const vp = [1, 0, 0, -1, 0, 842]; // halaman A4 tanpa rotasi
  const item = (str: string, x: number, y: number, width: number, size = 12, fontName = 'f1') => ({
    str,
    transform: [size, 0, 0, size, x, y],
    width,
    fontName,
  });

  it('menggabungkan potongan berdekatan dan memisah kolom berjauhan', () => {
    const lines = groupLines(
      [
        item('Contoh', 60, 740, 43.2),
        item(' ', 103.2, 740, 7.2),
        item('Courier', 110.4, 740, 50),
        item('Nama', 60, 600, 30, 11),
        item(' ', 90, 600, 110, 11),
        item(': nilai', 200, 600, 30, 11),
        item('vertikal', 300, 300, 40),
      ].map((i) => (i.str === 'vertikal' ? { ...i, transform: [0, 12, -12, 0, 300, 300] } : i)),
      vp,
      { f1: { ascent: 0.7, descent: -0.2 } },
    );
    expect(lines.map((l) => l.text)).toEqual(['Contoh Courier', 'Nama', ': nilai']);
    const [a] = lines;
    expect(a.x).toBe(60);
    expect(a.baseline).toBe(842 - 740);
    expect(a.width).toBeCloseTo(100.4);
    expect(a.above).toBeCloseTo(8.4);
  });

  it('memilih font standar termirip', () => {
    expect(standardFamily('ABCDEF+TimesNewRomanPS-BoldMT', 'serif')).toBe('times');
    expect(standardFamily('Arial-BoldMT', 'sans-serif')).toBe('helvetica');
    expect(standardFamily('CourierNewPSMT', undefined)).toBe('courier');
    expect(standardFamily('Calibri', 'serif')).toBe('helvetica');
    expect(standardFamily('Unknown', 'serif')).toBe('times');
  });

  it('mengambil warna latar dan warna tulisan dari piksel', () => {
    const w = 12;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const ink = x >= 3 && x < 9 && y >= 2 && y < 6 && (x + y) % 2 === 0;
        const soft = x >= 3 && x < 9 && y >= 2 && y < 6 && !ink && x % 3 === 0;
        const c = ink ? [20, 40, 120] : soft ? [130, 140, 160] : [240, 240, 200];
        data.set([...c, 255], i);
      }
    const { bg, fg } = pickColors(data, w, h, { x: 3, y: 2, w: 6, h: 4 });
    expect(toHex(bg)).toBe('#f0f0c8');
    expect(toHex(fg)).toBe('#142878');
  });
});
