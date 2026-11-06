/** Kirim file ke API Toolland (/api/tools/v1). Dipakai hanya untuk tools berbadge "Diproses di server". */

export type ServerErrorCode =
  | 'too_large'
  | 'unsupported'
  | 'busy'
  | 'timeout'
  | 'rate_limit'
  | 'failed'
  | 'no_text'
  | 'offline'
  | 'cancelled';

/** Batas file ke server (PRD: 15 MB). */
export const SERVER_MAX_BYTES = 15 * 1024 * 1024;

export interface ServerResult {
  blob: Blob;
  /** Kompres PDF: server mengembalikan file asli karena hasil tidak lebih kecil. */
  unchanged: boolean;
}

const BY_STATUS: Record<number, ServerErrorCode> = {
  413: 'too_large',
  415: 'unsupported',
  429: 'rate_limit',
  503: 'busy',
  504: 'timeout',
};

export class ServerError extends Error {
  constructor(public code: ServerErrorCode) {
    super(code);
  }
}

/**
 * Upload satu file (multipart) dengan progres upload. XHR dipakai karena fetch belum
 * melaporkan progres upload di semua browser.
 */
export function postFile(
  endpoint: string,
  file: File,
  fields: Record<string, string>,
  onUpload: (percent: number) => void,
): { promise: Promise<ServerResult>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<ServerResult>((resolve, reject) => {
    xhr.open('POST', `/api/tools/v1${endpoint}`);
    xhr.responseType = 'blob';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUpload((e.loaded / e.total) * 100);
    };
    xhr.onload = async () => {
      if (xhr.status === 200) {
        resolve({
          blob: xhr.response as Blob,
          unchanged: xhr.getResponseHeader('x-toolland-unchanged') === '1',
        });
        return;
      }
      let code: ServerErrorCode = BY_STATUS[xhr.status] ?? 'failed';
      try {
        const body = JSON.parse(await (xhr.response as Blob).text()) as { error?: string };
        if (
          body.error === 'too_large' ||
          body.error === 'unsupported' ||
          body.error === 'busy' ||
          body.error === 'timeout' ||
          body.error === 'no_text'
        )
          code = body.error;
      } catch {
        /* bukan JSON (misalnya 429 dari rate limiter) */
      }
      reject(new ServerError(code));
    };
    xhr.onerror = () => reject(new ServerError('offline'));
    xhr.onabort = () => reject(new ServerError('cancelled'));
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    form.append('file', file, file.name);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export function errorCode(e: unknown): ServerErrorCode {
  return e instanceof ServerError ? e.code : 'failed';
}
