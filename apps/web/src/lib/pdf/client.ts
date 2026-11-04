import type { Remote } from 'comlink';
import type { PdfWorkerApi } from '../../workers/pdf.worker';

let worker: Worker | undefined;
let api: Promise<Remote<PdfWorkerApi>> | undefined;

/** Satu worker PDF per halaman, dibuat saat pertama dibutuhkan lalu dipakai ulang. */
export function pdfWorker(): Promise<Remote<PdfWorkerApi>> {
  if (!api) {
    worker = new Worker(new URL('../../workers/pdf.worker.ts', import.meta.url), {
      type: 'module',
    });
    api = import('comlink').then(({ wrap }) => wrap<PdfWorkerApi>(worker!));
  }
  return api;
}

/** Hentikan proses yang sedang berjalan (tombol batal). */
export function cancelPdfWorker(): void {
  worker?.terminate();
  worker = undefined;
  api = undefined;
}

/** Kode error dari worker (encrypted, invalid, memory) atau 'invalid'. */
export function pdfErrorCode(e: unknown): 'encrypted' | 'invalid' | 'memory' {
  const msg = (e as Error)?.message ?? '';
  return msg === 'encrypted' || msg === 'memory' ? msg : 'invalid';
}

export const PDF_ACCEPT = '.pdf,application/pdf';
