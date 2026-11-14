/// <reference lib="webworker" />
/**
 * qpdf (WASM) untuk Kunci PDF dan Buka Kunci PDF. Setiap operasi memakai instance baru: program
 * Emscripten berhenti (exit) setelah main selesai, jadi satu instance hanya untuk satu perintah.
 * File wasm di-host sendiri di /vendor/qpdf/ dan di-cache browser.
 */
import createQpdf from '@neslinesli93/qpdf-wasm';
import { expose, transfer } from 'comlink';
import { VENDOR } from '../lib/vendor';
import {
  lockArgs,
  parseEncryption,
  randomOwnerPassword,
  unlockArgs,
  type LockOptions,
  type LockState,
} from '../lib/pdf/protect';

export type QpdfErrorCode = 'password' | 'invalid' | 'memory';

/** Bagian API Emscripten yang dipakai (tipe bawaan paket tidak mencantumkan writeFile). */
interface QpdfInstance {
  callMain(args: string[]): number;
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
}

const IN = '/in.pdf';
const OUT = '/out.pdf';

/**
 * Jalankan satu perintah qpdf. Modul ini menulis ke console.log/console.error yang diikat saat
 * instance dibuat, jadi console dialihkan sebentar untuk menangkap keluarannya.
 */
async function qpdf(
  data: ArrayBuffer,
  args: string[],
): Promise<{ code: number; lines: string[]; out: Uint8Array | null }> {
  const lines: string[] = [];
  const { log, error } = console;
  console.log = console.error = (...a: unknown[]) => lines.push(a.join(' '));
  try {
    const q = (await createQpdf({
      locateFile: () => new URL(`${VENDOR.qpdf}qpdf.wasm`, self.location.href).href,
    })) as unknown as QpdfInstance;
    q.FS.writeFile(IN, new Uint8Array(data));
    let code: number;
    try {
      code = q.callMain(args);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (typeof status !== 'number') throw e;
      code = status;
    }
    let out: Uint8Array | null = null;
    try {
      out = q.FS.readFile(OUT);
    } catch {
      out = null;
    }
    return { code, lines, out };
  } catch (e) {
    if (e instanceof RangeError || /memory/i.test(String(e)))
      throw new Error('memory', { cause: e });
    throw e;
  } finally {
    console.log = log;
    console.error = error;
  }
}

function fail(lines: string[]): never {
  const text = lines.join('\n');
  if (/invalid password/i.test(text)) throw new Error('password');
  if (/out of memory|bad_alloc/i.test(text)) throw new Error('memory', { cause: e });
  console.warn('[qpdf]', text.split('\n').slice(-5).join('\n'));
  throw new Error('invalid');
}

const api = {
  /** Status kunci PDF tanpa password. */
  async inspect(data: ArrayBuffer): Promise<LockState> {
    const r = await qpdf(data, ['--show-encryption', IN]);
    const state = parseEncryption(r.lines);
    // Kode 2 tanpa pesan password = file rusak / bukan PDF.
    if (r.code === 2 && state.kind !== 'password') fail(r.lines);
    return state;
  },

  async lock(data: ArrayBuffer, o: LockOptions): Promise<Uint8Array> {
    const r = await qpdf(data, lockArgs(o, randomOwnerPassword(), IN, OUT));
    // Kode 3 = berhasil dengan peringatan.
    if ((r.code !== 0 && r.code !== 3) || !r.out) fail(r.lines);
    return transfer(r.out, [r.out.buffer as ArrayBuffer]);
  },

  async unlock(data: ArrayBuffer, password: string): Promise<Uint8Array> {
    const r = await qpdf(data, unlockArgs(password, IN, OUT));
    if ((r.code !== 0 && r.code !== 3) || !r.out) fail(r.lines);
    return transfer(r.out, [r.out.buffer as ArrayBuffer]);
  },
};

expose(api);
export type QpdfWorkerApi = typeof api;
