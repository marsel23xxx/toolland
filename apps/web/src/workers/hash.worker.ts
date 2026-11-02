/// <reference lib="webworker" />
/**
 * Hash file di Web Worker agar UI tetap responsif.
 * File dibaca bertahap (File.slice) sehingga file besar tidak dimuat utuh ke memori.
 */
import { expose } from 'comlink';
import { createMD5, createSHA1, createSHA256, createSHA384, createSHA512 } from 'hash-wasm';
import { ALGORITHMS, type HashResult } from '../lib/hash';

const CHUNK = 4 * 1024 * 1024;

const api = {
  async hashFile(file: File, onProgress: (bytes: number) => void): Promise<HashResult> {
    const hashers = await Promise.all([
      createMD5(),
      createSHA1(),
      createSHA256(),
      createSHA384(),
      createSHA512(),
    ]);
    hashers.forEach((h) => h.init());
    for (let offset = 0; offset < file.size; offset += CHUNK) {
      const chunk = new Uint8Array(await file.slice(offset, offset + CHUNK).arrayBuffer());
      for (const h of hashers) h.update(chunk);
      onProgress(Math.min(offset + CHUNK, file.size));
    }
    return Object.fromEntries(
      ALGORITHMS.map((a, i) => [a, hashers[i].digest('hex')]),
    ) as HashResult;
  },
};

export type HashWorker = typeof api;
expose(api);
