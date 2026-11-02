/// <reference lib="webworker" />
/**
 * Worker gambar: decode -> potong -> resize -> encode, semua di luar UI thread.
 * Codec WASM (jsquash, libheif) di-import dinamis sehingga hanya codec yang dipakai yang diunduh.
 * Satu worker dipakai ulang untuk banyak file (batch).
 */
import { expose, transfer } from 'comlink';
import { sameAsInput, sniffFormat, type InputFormat, type OutputFormat } from '../lib/image/format';
import { clampRect, planResize, type Rect } from '../lib/image/geometry';
import type { ImageErrorCode, ImageJob, ImageResult } from '../lib/image/types';

class ImageError extends Error {
  constructor(public code: ImageErrorCode) {
    super(code);
  }
}

// ---------- decode ----------

let heifLib:
  | Promise<
      Awaited<ReturnType<typeof import('libheif-js/libheif-wasm/libheif-bundle.mjs').default>>
    >
  | undefined;

async function decodeHeic(buf: ArrayBuffer): Promise<ImageData> {
  heifLib ??= import('libheif-js/libheif-wasm/libheif-bundle.mjs').then((m) => m.default());
  const lib = await heifLib;
  const images = new lib.HeifDecoder().decode(new Uint8Array(buf));
  if (!images.length) throw new ImageError('decode');
  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  const data = await new Promise<Uint8ClampedArray<ArrayBuffer>>((resolve, reject) =>
    image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (out) =>
      out ? resolve(out.data) : reject(new ImageError('decode')),
    ),
  );
  images.forEach((i) => i.free?.());
  return new ImageData(data, width, height);
}

/** Decode bawaan browser (cepat, ikut orientasi EXIF). */
async function decodeNative(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function decode(file: Blob, format: InputFormat): Promise<ImageData> {
  try {
    return await decodeNative(file);
  } catch (e) {
    if (e instanceof RangeError) throw new ImageError('memory');
    // Browser tidak bisa membaca format ini: pakai decoder WASM.
    const buf = await file.arrayBuffer();
    try {
      if (format === 'heic') return await decodeHeic(buf);
      if (format === 'avif') return must(await (await import('@jsquash/avif')).decode(buf));
      if (format === 'webp') return await (await import('@jsquash/webp')).decode(buf);
      if (format === 'jpeg') return await (await import('@jsquash/jpeg')).decode(buf);
      if (format === 'png') return await (await import('@jsquash/png')).decode(buf);
    } catch (err) {
      if (err instanceof ImageError) throw err;
      throw new ImageError(err instanceof RangeError ? 'memory' : 'decode');
    }
    throw new ImageError('unsupported');
  }
}

function must<T>(v: T | null | undefined): T {
  if (v == null) throw new ImageError('decode');
  return v;
}

// ---------- olah piksel ----------

function crop(img: ImageData, rect: Rect): ImageData {
  const r = clampRect(rect, img.width, img.height);
  if (r.x === 0 && r.y === 0 && r.width === img.width && r.height === img.height) return img;
  const out = new ImageData(r.width, r.height);
  const rowBytes = r.width * 4;
  for (let y = 0; y < r.height; y++) {
    const start = ((r.y + y) * img.width + r.x) * 4;
    out.data.set(img.data.subarray(start, start + rowBytes), y * rowBytes);
  }
  return out;
}

async function scale(img: ImageData, width: number, height: number): Promise<ImageData> {
  if (img.width === width && img.height === height) return img;
  const { default: resize } = await import('@jsquash/resize');
  return resize(img, {
    width,
    height,
    method: 'lanczos3',
    fitMethod: 'stretch',
    premultiply: true,
    linearRGB: true,
  });
}

/** Tempel gambar di atas warna latar (untuk JPG tanpa transparansi, atau ruang kosong contain). */
function compose(
  img: ImageData,
  canvasW: number,
  canvasH: number,
  x: number,
  y: number,
  background?: string,
): ImageData {
  if (!background && canvasW === img.width && canvasH === img.height) return img;
  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
  const layer = new OffscreenCanvas(img.width, img.height);
  layer.getContext('2d')!.putImageData(img, 0, 0);
  ctx.drawImage(layer, x, y);
  return ctx.getImageData(0, 0, canvasW, canvasH);
}

function hasAlpha(img: ImageData): boolean {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return true;
  return false;
}

// ---------- encode ----------

async function encode(img: ImageData, format: OutputFormat, job: ImageJob): Promise<ArrayBuffer> {
  const q = Math.min(100, Math.max(1, Math.round(job.quality)));
  switch (format) {
    case 'jpeg':
      return (await import('@jsquash/jpeg')).encode(img, {
        quality: q,
        progressive: true,
        optimize_coding: true,
      });
    case 'png':
      return (await import('@jsquash/oxipng')).optimise(img, {
        level: 2,
        interlace: false,
        optimiseAlpha: true,
      });
    case 'webp':
      return (await import('@jsquash/webp')).encode(
        img,
        job.lossless ? { lossless: 1, quality: 100 } : { quality: q, method: 4 },
      );
    case 'avif': {
      // Kecepatan 6 untuk gambar kecil; gambar besar memakai 8 agar tetap wajar di HP.
      const speed = img.width * img.height > 4_000_000 ? 8 : 6;
      return (await import('@jsquash/avif')).encode(img, { quality: q, speed });
    }
  }
}

// ---------- API ----------

const api = {
  async process(file: File, job: ImageJob): Promise<ImageResult> {
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const input = sniffFormat(head);
    if (input === 'unknown' && !file.type.startsWith('image/')) throw new ImageError('unsupported');
    const format = job.format === 'same' ? sameAsInput(input) : job.format;

    try {
      let img = await decode(file, input);
      if (job.crop) img = crop(img, job.crop);
      if (job.resize) {
        const plan = planResize(img.width, img.height, job.resize);
        img = crop(img, plan.crop);
        img = await scale(img, plan.scaledWidth, plan.scaledHeight);
        img = compose(
          img,
          plan.canvasWidth,
          plan.canvasHeight,
          plan.offsetX,
          plan.offsetY,
          plan.canvasWidth !== plan.scaledWidth || plan.canvasHeight !== plan.scaledHeight
            ? (job.background ?? '#ffffff')
            : undefined,
        );
      }
      if (format === 'jpeg' && hasAlpha(img))
        img = compose(img, img.width, img.height, 0, 0, job.background ?? '#ffffff');

      let buffer = await encode(img, format, job);
      let unchanged = false;
      if (
        job.keepIfLarger &&
        format === input &&
        !job.resize &&
        !job.crop &&
        buffer.byteLength >= file.size
      ) {
        buffer = await file.arrayBuffer();
        unchanged = true;
      }
      const result: ImageResult = {
        buffer,
        format,
        width: img.width,
        height: img.height,
        unchanged,
      };
      return transfer(result, [buffer]);
    } catch (e) {
      if (e instanceof ImageError) throw e;
      if (e instanceof RangeError || /memory/i.test(String(e))) throw new ImageError('memory');
      throw new ImageError('encode');
    }
  },

  /** Unduh dan kompilasi codec lebih awal (saat kursor di atas dropzone). */
  async warmup(format: OutputFormat): Promise<void> {
    const tiny = new ImageData(1, 1);
    await encode(tiny, format, { format, quality: 50 }).catch(() => {});
  },
};

export type ImageWorkerApi = typeof api;
expose(api);
