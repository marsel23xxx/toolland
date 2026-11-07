/**
 * Kunci teks atau file dengan password, sepenuhnya di browser (Web Crypto).
 *
 * Format biner (dipakai untuk kode maupun file .toolland):
 *   "TLK" | versi (1) | flag (1) | iterasi PBKDF2 (u32 BE) | salt (16) | iv (12) | ciphertext
 * Kunci: PBKDF2-SHA256 dari password, lalu AES-256-GCM. Header ikut diautentikasi (AAD),
 * jadi kode yang diubah sedikit pun gagal dibuka.
 * Isi sebelum dienkripsi: panjang meta (u16 BE) | meta JSON | data. Bila flag bit 0 aktif,
 * isi itu dikompres deflate-raw dulu (dipakai hanya bila hasilnya lebih kecil).
 */

const MAGIC = [0x54, 0x4c, 0x4b]; // "TLK"
const VERSION = 1;
const HEADER = 3 + 1 + 1 + 4 + 16 + 12;
const FLAG_COMPRESSED = 1;
/** Rekomendasi OWASP untuk PBKDF2-SHA256. */
export const ITERATIONS = 600_000;
/** Awalan kode teks, supaya mudah dikenali saat ditempel. */
export const CODE_PREFIX = 'TOOLLAND1.';
/** Batas panjang kode: di bawah batas satu pesan WhatsApp (65.536 karakter). */
export const MAX_CODE_LENGTH = 60_000;
/** Batas ukuran file yang dikunci, supaya memori HP tidak habis. */
export const MAX_FILE_SIZE = 200 * 1024 * 1024;
/** Kompresi hanya dicoba untuk isi sampai ukuran ini (file besar biasanya sudah terkompres). */
const COMPRESS_LIMIT = 8 * 1024 * 1024;

export type Payload =
  { type: 'text'; text: string } | { type: 'file'; name: string; mime: string; data: Uint8Array };

export class LockboxError extends Error {
  constructor(public code: 'format' | 'version' | 'password') {
    super(code);
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey(
    'raw',
    enc.encode(password.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const src = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(data);
      c.close();
    },
  });
  const out = src.pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function pack(p: Payload): Uint8Array {
  const meta = enc.encode(
    JSON.stringify(p.type === 'text' ? { t: 'text' } : { t: 'file', n: p.name, m: p.mime }),
  );
  const data = p.type === 'text' ? enc.encode(p.text) : p.data;
  const out = new Uint8Array(2 + meta.length + data.length);
  new DataView(out.buffer).setUint16(0, meta.length);
  out.set(meta, 2);
  out.set(data, 2 + meta.length);
  return out;
}

function unpack(bytes: Uint8Array): Payload {
  if (bytes.length < 2) throw new LockboxError('format');
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint16(0);
  if (2 + len > bytes.length) throw new LockboxError('format');
  let meta: { t?: string; n?: string; m?: string };
  try {
    meta = JSON.parse(dec.decode(bytes.subarray(2, 2 + len)));
  } catch {
    throw new LockboxError('format');
  }
  const data = bytes.subarray(2 + len);
  if (meta.t === 'text') return { type: 'text', text: dec.decode(data) };
  if (meta.t === 'file')
    return {
      type: 'file',
      // Nama dari pengirim: buang path supaya unduhan tidak bisa menunjuk folder lain.
      name:
        String(meta.n ?? 'file')
          .split(/[\\/]/)
          .pop() || 'file',
      mime: String(meta.m ?? '') || 'application/octet-stream',
      data,
    };
  throw new LockboxError('format');
}

/** Kunci isi dengan password. Hasilnya byte biner (lihat format di atas). */
export async function lock(payload: Payload, password: string, iterations = ITERATIONS) {
  let body = pack(payload);
  let flags = 0;
  if (body.length <= COMPRESS_LIMIT && typeof CompressionStream !== 'undefined') {
    const small = await pipe(body, new CompressionStream('deflate-raw'));
    if (small.length < body.length) {
      body = small;
      flags |= FLAG_COMPRESSED;
    }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new Uint8Array(HEADER);
  header.set(MAGIC, 0);
  header[3] = VERSION;
  header[4] = flags;
  new DataView(header.buffer).setUint32(5, iterations);
  header.set(salt, 9);
  header.set(iv, 25);
  const key = await deriveKey(password, salt, iterations);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: header },
      key,
      body as BufferSource,
    ),
  );
  const out = new Uint8Array(HEADER + cipher.length);
  out.set(header);
  out.set(cipher, HEADER);
  return out;
}

/** Apakah byte ini hasil `lock` (cek cepat tanpa password). */
export function isLocked(bytes: Uint8Array): boolean {
  return bytes.length > HEADER && MAGIC.every((b, i) => bytes[i] === b);
}

/** Buka hasil `lock`. Melempar LockboxError('password') bila password salah atau isi rusak. */
export async function unlock(bytes: Uint8Array, password: string): Promise<Payload> {
  if (!isLocked(bytes)) throw new LockboxError('format');
  if (bytes[3] !== VERSION) throw new LockboxError('version');
  const header = bytes.subarray(0, HEADER);
  const flags = bytes[4];
  const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(5);
  // Batasi supaya kode buatan orang lain tidak bisa membuat browser macet berjam-jam.
  if (iterations < 1000 || iterations > 10_000_000) throw new LockboxError('format');
  const key = await deriveKey(password, bytes.slice(9, 25), iterations);
  let body: Uint8Array;
  try {
    body = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.slice(25, 37), additionalData: header.slice() },
        key,
        bytes.subarray(HEADER) as BufferSource,
      ),
    );
  } catch {
    throw new LockboxError('password');
  }
  if (flags & FLAG_COMPRESSED) body = await pipe(body, new DecompressionStream('deflate-raw'));
  return unpack(body);
}

// --- Kode teks (base64url) ---

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Byte terkunci menjadi kode yang bisa di-copy-paste. */
export function toCode(bytes: Uint8Array): string {
  return CODE_PREFIX + toBase64Url(bytes);
}

/** Panjang kode untuk byte sebanyak n, tanpa membuatnya. */
export function codeLength(n: number): number {
  return CODE_PREFIX.length + Math.ceil((n * 4) / 3);
}

/**
 * Kode yang ditempel kembali menjadi byte. Spasi dan baris baru (sering ditambahkan aplikasi
 * chat) diabaikan. Mengembalikan null bila bukan kode Toolland.
 */
export function fromCode(code: string): Uint8Array | null {
  const clean = code.replace(/\s+/g, '');
  if (!clean.startsWith(CODE_PREFIX)) return null;
  const b64 = clean.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*$/.test(b64)) return null;
  try {
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return isLocked(out) ? out : null;
  } catch {
    return null;
  }
}

// --- Password ---

const CONSONANTS = 'bdgjklmnprstwz'; // 14 huruf yang mudah dieja di telepon
const VOWELS = 'aiueo';

function randomInt(max: number): number {
  // Tolak sampel di ujung supaya distribusinya rata.
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

/**
 * Password acak yang mudah dibaca dan didiktekan, misalnya "kodu-meja-ritu-bale-27".
 * Empat kata KVKV (masing-masing 70² kemungkinan) plus dua angka: sekitar 55 bit.
 */
export function generatePassword(): string {
  const word = () =>
    Array.from({ length: 2 }, () => CONSONANTS[randomInt(14)] + VOWELS[randomInt(5)]).join('');
  const words = Array.from({ length: 4 }, word);
  return [...words, String(randomInt(90) + 10)].join('-');
}

/** Peringatan sederhana untuk password yang diketik sendiri. */
export function isWeakPassword(pw: string): boolean {
  if (pw.length < 10) return true;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return pw.length < 14 && kinds < 3;
}
