/// <reference lib="webworker" />
/**
 * Worker PDF (pdf-lib): semua operasi berat berjalan di luar UI thread.
 * Hasil dikirim kembali sebagai Transferable (tanpa salinan).
 */
import { expose, transfer } from 'comlink';
import {
  degrees,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { normalizeRotation, numberAnchor, visualSize, visualToUser } from '../lib/pdf/geometry';
import {
  COMPRESS_PRESETS,
  type CompressLevel,
  type CompressResult,
  type ImagePageInput,
  type ImagesToPdfOptions,
  type PageNumberOptions,
  type PdfErrorCode,
  type WatermarkOptions,
} from '../lib/pdf/types';

class PdfError extends Error {
  constructor(public code: PdfErrorCode) {
    super(code);
  }
}

async function load(buf: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buf, { updateMetadata: false });
  } catch (e) {
    const name = (e as Error).name ?? '';
    if (/Encrypted/i.test(name) || /encrypted/i.test((e as Error).message))
      throw new PdfError('encrypted');
    if (e instanceof RangeError) throw new PdfError('memory');
    throw new PdfError('invalid');
  }
}

async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

const out = (bytes: Uint8Array) => transfer(bytes, [bytes.buffer]);

function hexColor(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16) || 0;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Helvetica hanya mendukung WinAnsi; karakter lain diganti "?" agar tidak error. */
function safeText(font: PDFFont, text: string): string {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return '?';
      }
    })
    .join('');
}

function pageFrame(page: PDFPage) {
  const box = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  return { box, rotation, size: visualSize(box, rotation) };
}

// ---------- kompres gambar JPEG di dalam PDF ----------

async function recompressJpeg(
  bytes: Uint8Array,
  gray: boolean,
  quality: number,
  maxSide: number,
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
    );
  } catch {
    return null; // JPEG yang tidak bisa dibaca browser dibiarkan apa adanya
  }
  const f = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * f));
  const height = Math.max(1, Math.round(bitmap.height * f));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const { encode } = await import('@jsquash/jpeg');
  const data = new Uint8Array(
    await encode(ctx.getImageData(0, 0, width, height), {
      quality,
      progressive: true,
      optimize_coding: true,
      ...(gray ? { color_space: 1 } : {}),
    }),
  );
  return { data, width, height };
}

// ---------- API ----------

const api = {
  async pageCount(buf: ArrayBuffer): Promise<number> {
    return (await load(buf)).getPageCount();
  },

  async merge(bufs: ArrayBuffer[]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (const buf of bufs) {
      const src = await load(buf);
      const pages = await doc.copyPages(src, src.getPageIndices());
      pages.forEach((p) => doc.addPage(p));
    }
    return out(await save(doc));
  },

  /** groups: daftar grup halaman (mulai dari 1); setiap grup menjadi satu file. */
  async split(buf: ArrayBuffer, groups: number[][]): Promise<Uint8Array[]> {
    const src = await load(buf);
    const results: Uint8Array[] = [];
    for (const group of groups) {
      const doc = await PDFDocument.create();
      const pages = await doc.copyPages(
        src,
        group.map((n) => n - 1),
      );
      pages.forEach((p) => doc.addPage(p));
      results.push(await save(doc));
    }
    return transfer(
      results,
      results.map((r) => r.buffer as ArrayBuffer),
    );
  },

  async imagesToPdf(images: ImagePageInput[], o: ImagesToPdfOptions): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
    for (const img of images) {
      const embedded =
        img.kind === 'png' ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
      const landscapeImage = embedded.width > embedded.height;
      let pageW: number;
      let pageH: number;
      if (o.pageSize === 'fit') {
        pageW = embedded.width + o.margin * 2;
        pageH = embedded.height + o.margin * 2;
      } else {
        const [w, h] = SIZES[o.pageSize];
        const landscape =
          o.orientation === 'landscape' || (o.orientation === 'auto' && landscapeImage);
        [pageW, pageH] = landscape ? [h, w] : [w, h];
      }
      const page = doc.addPage([pageW, pageH]);
      const boxW = pageW - o.margin * 2;
      const boxH = pageH - o.margin * 2;
      const f = Math.min(boxW / embedded.width, boxH / embedded.height);
      const w = embedded.width * f;
      const h = embedded.height * f;
      page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    }
    return out(await save(doc));
  },

  async watermark(buf: ArrayBuffer, o: WatermarkOptions): Promise<Uint8Array> {
    const doc = await load(buf);
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = safeText(font, o.text);
    const color = hexColor(o.color);
    const textW = font.widthOfTextAtSize(text, o.fontSize);
    const capH = o.fontSize * 0.7;
    const rad = (o.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (const page of doc.getPages()) {
      const { box, rotation, size } = pageFrame(page);
      // titik pusat teks (dalam koordinat terlihat) -> titik awal teks setelah diputar
      const drawAt = (cx: number, cy: number) => {
        const vx = cx - (textW / 2) * cos + (capH / 2) * sin;
        const vy = cy - (textW / 2) * sin - (capH / 2) * cos;
        const p = visualToUser(box, rotation, vx, vy);
        page.drawText(text, {
          x: p.x,
          y: p.y,
          size: o.fontSize,
          font,
          color,
          opacity: o.opacity,
          rotate: degrees(o.rotation + rotation),
        });
      };
      if (o.mode === 'center') {
        drawAt(size.width / 2, size.height / 2);
      } else {
        const stepX = textW * Math.abs(cos) + capH * Math.abs(sin) + o.fontSize * 3;
        const stepY = textW * Math.abs(sin) + capH * Math.abs(cos) + o.fontSize * 3;
        for (let y = stepY / 2; y < size.height + stepY; y += stepY) {
          for (let x = stepX / 2; x < size.width + stepX; x += stepX) drawAt(x, y);
        }
      }
    }
    return out(await save(doc));
  },

  async pageNumbers(buf: ArrayBuffer, o: PageNumberOptions): Promise<Uint8Array> {
    const doc = await load(buf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const numbered = o.skipFirst ? pages.length - 1 : pages.length;
    const total = numbered + o.start - 1;
    pages.forEach((page, i) => {
      if (o.skipFirst && i === 0) return;
      const n = o.start + (o.skipFirst ? i - 1 : i);
      const text = safeText(
        font,
        o.template.replace('{n}', String(n)).replace('{total}', String(total)),
      );
      const { box, rotation, size } = pageFrame(page);
      const w = font.widthOfTextAtSize(text, o.fontSize);
      const margin = Math.max(18, Math.min(size.width, size.height) * 0.04);
      const a = numberAnchor(size, o.position, w, o.fontSize, margin);
      const p = visualToUser(box, rotation, a.x, a.y);
      page.drawText(text, {
        x: p.x,
        y: p.y,
        size: o.fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
        rotate: degrees(rotation),
      });
    });
    return out(await save(doc));
  },

  /** PDF satu halaman seukuran tanda tangan (lebar dalam point), latar transparan. */
  async signaturePdf(png: ArrayBuffer, width: number): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(png);
    const height = (width * image.height) / image.width;
    doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    return out(await save(doc));
  },

  async compress(buf: ArrayBuffer, level: CompressLevel): Promise<CompressResult> {
    const { quality, maxSide } = COMPRESS_PRESETS[level];
    const doc = await load(buf);
    let imagesTotal = 0;
    let imagesRecompressed = 0;
    const name = (s: string) => PDFName.of(s);

    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      if (dict.get(name('Subtype')) !== name('Image')) continue;
      imagesTotal++;
      const filter = dict.get(name('Filter'));
      const isJpeg =
        filter === name('DCTDecode') ||
        (filter instanceof PDFArray && filter.size() === 1 && filter.get(0) === name('DCTDecode'));
      if (!isJpeg || dict.get(name('ImageMask')) || dict.get(name('Mask'))) continue;

      const gray = dict.get(name('ColorSpace')) === name('DeviceGray');
      const result = await recompressJpeg(obj.contents, gray, quality, maxSide);
      if (!result || result.data.byteLength >= obj.contents.byteLength * 0.95) continue;

      dict.set(name('Width'), PDFNumber.of(result.width));
      dict.set(name('Height'), PDFNumber.of(result.height));
      dict.set(name('ColorSpace'), name(gray ? 'DeviceGray' : 'DeviceRGB'));
      dict.set(name('BitsPerComponent'), PDFNumber.of(8));
      dict.set(name('Filter'), name('DCTDecode'));
      dict.delete(name('Decode'));
      dict.delete(name('DecodeParms'));
      doc.context.assign(ref, PDFRawStream.of(dict, result.data));
      imagesRecompressed++;
    }

    let bytes = await save(doc);
    let unchanged = false;
    if (bytes.byteLength >= buf.byteLength) {
      bytes = new Uint8Array(buf.slice(0));
      unchanged = true;
    }
    return transfer({ bytes, imagesTotal, imagesRecompressed, unchanged }, [
      bytes.buffer as ArrayBuffer,
    ]);
  },
};

export type PdfWorkerApi = typeof api;
expose(api);
