/// <reference lib="webworker" />
/**
 * Regex dijalankan di Worker: bila pola berbahaya membuat proses macet,
 * halaman tetap responsif dan worker dihentikan dari luar setelah timeout.
 */
import { runRegex, type RegexResult } from '../lib/regex';

export interface RegexRequest {
  id: number;
  pattern: string;
  flags: string;
  text: string;
  replacement?: string;
}

export type RegexResponse =
  { id: number; ok: true; result: RegexResult } | { id: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<RegexRequest>) => {
  const { id, pattern, flags, text, replacement } = e.data;
  let response: RegexResponse;
  try {
    response = { id, ok: true, result: runRegex(pattern, flags, text, replacement) };
  } catch (err) {
    response = { id, ok: false, error: (err as Error).message };
  }
  self.postMessage(response);
};
