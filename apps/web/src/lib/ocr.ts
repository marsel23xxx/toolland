/**
 * OCR (gambar ke teks) di browser dengan tesseract.js. Worker, core WASM, dan data bahasa
 * di-host sendiri di /vendor/tesseract (lihat scripts/vendor.mjs), jadi tidak ada request ke CDN
 * dan gambar tidak pernah meninggalkan perangkat. Satu worker dipakai ulang untuk semua gambar.
 */
import type { Worker as TessWorker } from 'tesseract.js';
import { VENDOR } from './vendor';

export type OcrLang = 'ind' | 'eng' | 'ind+eng';

export interface OcrWord {
  text: string;
  /** Keyakinan 0-100. */
  conf: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  text: string;
  /** Rata-rata keyakinan seluruh halaman (0-100). */
  confidence: number;
  words: OcrWord[];
}

export type OcrStage = 'load' | 'lang' | 'read';
export type OcrProgress = (stage: OcrStage, value: number) => void;

let worker: Promise<TessWorker> | undefined;
let loadedLang: OcrLang | undefined;
let progress: OcrProgress | undefined;

function stageOf(status: string): OcrStage {
  if (status.includes('recogniz')) return 'read';
  if (status.includes('language') || status.includes('initializ')) return 'lang';
  return 'load';
}

async function getWorker(lang: OcrLang): Promise<TessWorker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      const w = await createWorker(lang, OEM.LSTM_ONLY, {
        workerPath: `${VENDOR.tesseract}worker.min.js`,
        corePath: `${VENDOR.tesseract}core`,
        langPath: `${VENDOR.tesseract}lang`,
        workerBlobURL: false,
        logger: (m) => progress?.(stageOf(m.status), m.progress),
      });
      loadedLang = lang;
      return w;
    })();
    // Gagal memuat: izinkan coba lagi pada panggilan berikutnya.
    worker.catch(() => (worker = undefined));
  }
  const w = await worker;
  if (loadedLang !== lang) {
    await w.reinitialize(lang);
    loadedLang = lang;
  }
  return w;
}

/** Kecilkan gambar yang terlalu besar agar OCR tidak lambat atau kehabisan memori. */
export const MAX_SIDE = 4000;

/**
 * Baca teks dari gambar (canvas sudah diputar sesuai pilihan pengguna).
 * `onProgress` dipanggil dengan tahap dan nilai 0-1.
 */
export async function recognize(
  image: HTMLCanvasElement,
  lang: OcrLang,
  onProgress?: OcrProgress,
): Promise<OcrResult> {
  progress = onProgress;
  try {
    const w = await getWorker(lang);
    const { data } = await w.recognize(image, { rotateAuto: true }, { text: true, blocks: true });
    const words: OcrWord[] = [];
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs)
        for (const l of p.lines)
          for (const wd of l.words) words.push({ text: wd.text, conf: wd.confidence, ...wd.bbox });
    return { text: tidy(data.text), confidence: Math.round(data.confidence), words };
  } finally {
    progress = undefined;
  }
}

/** Rapikan hasil OCR: hapus spasi di ujung baris dan baris kosong berlebih. */
export function tidy(text: string): string {
  return text
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Muat gambar ke canvas, putar (kelipatan 90°), dan kecilkan bila sisi terpanjang > MAX_SIDE. */
export async function imageToCanvas(file: Blob, rotation = 0): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const turn = ((rotation % 360) + 360) % 360;
  const canvas = document.createElement('canvas');
  canvas.width = turn % 180 ? h : w;
  canvas.height = turn % 180 ? w : h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close();
  return canvas;
}

/** Putar canvas yang sudah ada (untuk halaman PDF). */
export function rotateCanvas(src: HTMLCanvasElement, rotation: number): HTMLCanvasElement {
  const turn = ((rotation % 360) + 360) % 360;
  if (!turn) return src;
  const c = document.createElement('canvas');
  c.width = turn % 180 ? src.height : src.width;
  c.height = turn % 180 ? src.width : src.height;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/** Hentikan worker (misalnya saat komponen dilepas) untuk membebaskan memori. */
export async function stopOcr() {
  const w = worker;
  worker = undefined;
  loadedLang = undefined;
  if (w) await (await w).terminate();
}
