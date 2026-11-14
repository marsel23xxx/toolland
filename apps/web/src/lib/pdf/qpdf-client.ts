import type { Remote } from 'comlink';
import type { QpdfErrorCode, QpdfWorkerApi } from '../../workers/qpdf.worker';

let api: Promise<Remote<QpdfWorkerApi>> | undefined;

/** Worker qpdf, dibuat saat pertama dibutuhkan lalu dipakai ulang. */
export function qpdfWorker(): Promise<Remote<QpdfWorkerApi>> {
  api ??= import('comlink').then(({ wrap }) =>
    wrap<QpdfWorkerApi>(
      new Worker(new URL('../../workers/qpdf.worker.ts', import.meta.url), { type: 'module' }),
    ),
  );
  return api;
}

export function qpdfErrorCode(e: unknown): QpdfErrorCode {
  const msg = (e as Error)?.message ?? '';
  return msg === 'password' || msg === 'memory' ? msg : 'invalid';
}
