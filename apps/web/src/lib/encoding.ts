/** Base64 untuk teks UTF-8 (emoji dan huruf non-Latin aman). */
export function base64Encode(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

/** Decode Base64 (standar atau URL-safe, dengan/tanpa padding) ke teks UTF-8. Melempar error bila tidak valid. */
export function base64Decode(input: string): string {
  let b64 = input.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) {
    throw new Error('invalid-base64');
  }
  b64 = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export type UrlMode = 'component' | 'full';

export function urlEncode(text: string, mode: UrlMode = 'component'): string {
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text);
}

/** Decode URL; "+" dianggap spasi seperti pada query string form. Melempar error bila tidak valid. */
export function urlDecode(text: string, plusAsSpace = true): string {
  return decodeURIComponent(plusAsSpace ? text.replace(/\+/g, ' ') : text);
}
