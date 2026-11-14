/**
 * Kunci dan buka kunci PDF dengan qpdf (WASM). Bagian murni: argumen qpdf dan membaca keluaran
 * `--show-encryption`. Enkripsi selalu AES-256, standar sejak Acrobat X dan didukung semua
 * pembaca PDF modern.
 */

export interface LockOptions {
  /** Password untuk membuka PDF. */
  password: string;
  noPrint: boolean;
  noCopy: boolean;
  noModify: boolean;
}

export function hasRestrictions(o: Pick<LockOptions, 'noPrint' | 'noCopy' | 'noModify'>): boolean {
  return o.noPrint || o.noCopy || o.noModify;
}

/** Password pemilik acak (dipakai bila ada pembatasan izin). */
export function randomOwnerPassword(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Tanpa pembatasan, password pemilik = password buka (pemilik PDF tetap punya akses penuh). Dengan
 * pembatasan, password pemilik harus berbeda; kalau sama, siapa pun yang tahu password buka
 * otomatis jadi pemilik dan pembatasannya tidak berlaku.
 */
export function lockArgs(o: LockOptions, owner: string, input: string, out: string): string[] {
  const restricted = hasRestrictions(o);
  return [
    '--encrypt',
    `--user-password=${o.password}`,
    `--owner-password=${restricted ? owner : o.password}`,
    '--bits=256',
    ...(o.noPrint ? ['--print=none'] : []),
    // Ekstrak untuk aksesibilitas (pembaca layar) tetap diizinkan.
    ...(o.noCopy ? ['--extract=n'] : []),
    ...(o.noModify ? ['--modify=none', '--annotate=n', '--form=n', '--assemble=n'] : []),
    '--',
    input,
    out,
  ];
}

export function unlockArgs(password: string, input: string, out: string): string[] {
  return [...(password ? [`--password=${password}`] : []), '--decrypt', input, out];
}

export type LockState =
  | { kind: 'none' }
  /** Bisa dibuka tanpa password, tapi ada izin yang dilarang. */
  | { kind: 'restricted'; print: boolean; copy: boolean; modify: boolean }
  /** Butuh password untuk dibuka. */
  | { kind: 'password' };

/** Baca baris keluaran `qpdf --show-encryption` (dijalankan tanpa password). */
export function parseEncryption(lines: string[]): LockState {
  const text = lines.join('\n');
  if (/invalid password/i.test(text)) return { kind: 'password' };
  if (/File is not encrypted/i.test(text) || !/^R = \d/m.test(text)) return { kind: 'none' };
  const no = (label: string) => new RegExp(`^${label}: not allowed`, 'mi').test(text);
  return {
    kind: 'restricted',
    print: no('print high resolution') || no('print low resolution'),
    copy: no('extract for any purpose'),
    modify: no('modify anything') || no('modify other'),
  };
}
