import type { PDFDocumentProxy } from 'pdfjs-dist';
import { VENDOR } from '../vendor';

let lib: Promise<typeof import('pdfjs-dist')> | undefined;

/** pdf.js dimuat hanya saat dibutuhkan (ukurannya besar). */
export function pdfjs() {
  lib ??= (async () => {
    const [m, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    m.GlobalWorkerOptions.workerSrc = worker.default;
    return m;
  })();
  return lib;
}

const tasks = new WeakMap<PDFDocumentProxy, { destroy(): Promise<void> }>();

/** Buka PDF untuk dirender. Data disalin karena pdf.js memindahkan buffer ke worker-nya. */
export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const m = await pdfjs();
  const task = m.getDocument({
    data: new Uint8Array(data.slice(0)),
    cMapUrl: `${VENDOR.pdfjs}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${VENDOR.pdfjs}standard_fonts/`,
    wasmUrl: `${VENDOR.pdfjs}wasm/`,
    iccUrl: `${VENDOR.pdfjs}iccs/`,
  });
  const doc = await task.promise;
  tasks.set(doc, task);
  return doc;
}

/** Tutup dokumen dan lepaskan memorinya. */
export async function closePdf(doc: PDFDocumentProxy): Promise<void> {
  await tasks.get(doc)?.destroy();
}

/** Render satu halaman (mulai dari 1) ke canvas. scale 1 = 72 DPI. */
export async function renderPage(
  doc: PDFDocumentProxy,
  n: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality),
  );
}
