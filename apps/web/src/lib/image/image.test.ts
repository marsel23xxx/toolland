import { describe, expect, it } from 'vitest';
import { outputName, sniffFormat } from './format';
import { clampRect, cmToPx, planResize } from './geometry';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)),
  );

describe('sniffFormat', () => {
  it('mengenali format dari magic bytes', () => {
    expect(sniffFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(sniffFormat(bytes([0x89], 'PNG', [13, 10, 26, 10]))).toBe('png');
    expect(sniffFormat(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
    expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypheic', [0, 0, 0, 0], 'mif1heic'))).toBe('heic');
    expect(sniffFormat(bytes([0, 0, 0, 28], 'ftypavif', [0, 0, 0, 0], 'avifmif1miaf'))).toBe(
      'avif',
    );
    expect(sniffFormat(bytes([0, 0, 0, 24], 'ftypmif1', [0, 0, 0, 0], 'mif1avif'))).toBe('avif');
    expect(sniffFormat(bytes('hello world!'))).toBe('unknown');
  });
});

describe('outputName', () => {
  it('mengganti ekstensi', () => {
    expect(outputName('IMG_0001.HEIC', 'jpeg')).toBe('IMG_0001.jpg');
    expect(outputName('foto.liburan.png', 'webp', '-kecil')).toBe('foto.liburan-kecil.webp');
    expect(outputName('tanpa-ekstensi', 'avif')).toBe('tanpa-ekstensi.avif');
  });
});

describe('planResize', () => {
  it('skala persen', () => {
    expect(planResize(4000, 3000, { kind: 'scale', percent: 50 })).toMatchObject({
      canvasWidth: 2000,
      canvasHeight: 1500,
    });
  });
  it('inside tidak memperbesar gambar kecil', () => {
    expect(
      planResize(800, 600, { kind: 'box', width: 1920, height: 1920, fit: 'inside' }),
    ).toMatchObject({
      canvasWidth: 800,
      canvasHeight: 600,
    });
    expect(
      planResize(4000, 3000, { kind: 'box', width: 1920, height: 1920, fit: 'inside' }),
    ).toMatchObject({
      canvasWidth: 1920,
      canvasHeight: 1440,
    });
  });
  it('hanya lebar diisi, tinggi mengikuti rasio', () => {
    expect(planResize(4000, 3000, { kind: 'box', width: 1000, fit: 'stretch' })).toMatchObject({
      canvasWidth: 1000,
      canvasHeight: 750,
    });
  });
  it('cover memotong bagian tengah', () => {
    const p = planResize(4000, 3000, { kind: 'box', width: 1080, height: 1080, fit: 'cover' });
    expect(p.crop).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
    expect(p).toMatchObject({ canvasWidth: 1080, canvasHeight: 1080 });
  });
  it('contain memberi ruang di sisi', () => {
    const p = planResize(4000, 2000, { kind: 'box', width: 1000, height: 1000, fit: 'contain' });
    expect(p).toMatchObject({
      scaledWidth: 1000,
      scaledHeight: 500,
      offsetX: 0,
      offsetY: 250,
      canvasHeight: 1000,
    });
  });
});

describe('clampRect dan cmToPx', () => {
  it('membatasi kotak di dalam gambar', () => {
    expect(clampRect({ x: -5, y: 10.4, width: 200, height: 50 }, 100, 100)).toEqual({
      x: 0,
      y: 10,
      width: 100,
      height: 50,
    });
  });
  it('pas foto 3x4 dan 4x6 pada 300 DPI', () => {
    expect([cmToPx(3), cmToPx(4), cmToPx(6)]).toEqual([354, 472, 709]);
  });
});
