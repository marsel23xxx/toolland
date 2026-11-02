export const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];
export type HashResult = Record<Algorithm, string>;

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** Hash teks UTF-8: SHA lewat Web Crypto API, MD5 lewat hash-wasm (Web Crypto tidak punya MD5). */
export async function hashText(text: string): Promise<HashResult> {
  const data = new TextEncoder().encode(text);
  const { md5 } = await import('hash-wasm');
  const [m, ...sha] = await Promise.all([
    md5(data),
    ...(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const).map(async (a) =>
      toHex(await crypto.subtle.digest(a, data)),
    ),
  ]);
  return { MD5: m, 'SHA-1': sha[0], 'SHA-256': sha[1], 'SHA-384': sha[2], 'SHA-512': sha[3] };
}

/** Algoritma yang hasilnya sama dengan hash yang ditempel pengguna (tanpa beda besar/kecil). */
export function findMatch(result: HashResult, candidate: string): Algorithm | undefined {
  const c = candidate.trim().toLowerCase();
  if (!c) return undefined;
  return ALGORITHMS.find((a) => result[a] === c);
}
