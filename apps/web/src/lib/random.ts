/** Angka acak aman di [0, max) tanpa bias modulo (rejection sampling). */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError('max');
  const limit = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export interface PasswordOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  /** Buang karakter yang mirip: 0 O o 1 l I | */
  excludeAmbiguous: boolean;
}

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.?/~',
} as const;
const AMBIGUOUS = /[0Oo1lI|]/g;

function activeSets(o: PasswordOptions): string[] {
  return (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => o[k])
    .map((k) => (o.excludeAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
}

/** Password acak; dijamin memuat minimal satu karakter dari setiap jenis yang dipilih. */
export function generatePassword(o: PasswordOptions): string {
  const sets = activeSets(o);
  if (sets.length === 0) throw new Error('no-charset');
  const length = Math.max(o.length, sets.length);
  const all = sets.join('');
  const chars = sets.map((s) => s[secureRandomInt(s.length)]);
  while (chars.length < length) chars.push(all[secureRandomInt(all.length)]);
  // acak urutan (Fisher-Yates) agar karakter wajib tidak selalu di depan
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Perkiraan entropi dalam bit. */
export function passwordEntropy(o: PasswordOptions): number {
  const pool = activeSets(o).join('').length;
  return pool === 0 ? 0 : Math.round(o.length * Math.log2(pool));
}

/** UUID v7 (urut waktu, RFC 9562): 48 bit milidetik + 74 bit acak. */
export function uuidv7(now = Date.now()): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70; // versi 7
  b[8] = (b[8] & 0x3f) | 0x80; // varian RFC
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
