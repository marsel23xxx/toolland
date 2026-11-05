import { describe, expect, it } from 'vitest';
import { outputName, sniffFormat } from './format';
import { clampRect, planResize } from './geometry';

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

describe('clampRect', () => {
  it('membatasi kotak di dalam gambar', () => {
    expect(clampRect({ x: -5, y: 10.4, width: 200, height: 50 }, 100, 100)).toEqual({
      x: 0,
      y: 10,
      width: 100,
      height: 50,
    });
  });
});

describe('jpegOrientation', async () => {
  const { jpegOrientation } = await import('./exif');
  /** JPEG minimal: SOI + APP1 Exif dengan satu tag Orientation. */
  function jpegWithOrientation(o: number, little: boolean) {
    const b = new Uint8Array(40);
    const v = new DataView(b.buffer);
    v.setUint16(0, 0xffd8);
    v.setUint16(2, 0xffe1);
    v.setUint16(4, 34);
    v.setUint32(6, 0x45786966); // "Exif"
    const t = 12;
    v.setUint16(t, little ? 0x4949 : 0x4d4d);
    v.setUint16(t + 2, 42, little);
    v.setUint32(t + 4, 8, little);
    v.setUint16(t + 8, 1, little);
    v.setUint16(t + 10, 0x0112, little);
    v.setUint16(t + 12, 3, little);
    v.setUint32(t + 14, 1, little);
    v.setUint16(t + 18, o, little);
    return b.buffer;
  }
  it('membaca orientasi little dan big endian', () => {
    expect(jpegOrientation(jpegWithOrientation(6, true))).toBe(6);
    expect(jpegOrientation(jpegWithOrientation(3, false))).toBe(3);
  });
  it('tanpa EXIF atau bukan JPEG = 1', () => {
    expect(jpegOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2]).buffer)).toBe(1);
    expect(jpegOrientation(new Uint8Array([1, 2, 3]).buffer)).toBe(1);
  });
});
