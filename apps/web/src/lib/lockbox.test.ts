import { describe, expect, it } from 'vitest';
import {
  codeLength,
  fromCode,
  generatePassword,
  isLocked,
  isWeakPassword,
  lock,
  LockboxError,
  toCode,
  unlock,
} from './lockbox';

// Iterasi kecil supaya tes cepat; formatnya tetap sama.
const IT = 2000;

describe('lockbox', () => {
  it('teks: kunci lalu buka lewat kode', async () => {
    const bytes = await lock({ type: 'text', text: 'Rahasia 🤫 baris\nkedua' }, 'kodu-meja', IT);
    const code = toCode(bytes);
    expect(code.startsWith('TOOLLAND1.')).toBe(true);
    expect(code.length).toBe(codeLength(bytes.length));
    // Aplikasi chat sering memotong kode jadi beberapa baris.
    const pasted = code.replace(/(.{40})/g, '$1\n ');
    const back = await unlock(fromCode(pasted)!, 'kodu-meja');
    expect(back).toEqual({ type: 'text', text: 'Rahasia 🤫 baris\nkedua' });
  });

  it('file: nama, tipe, dan isi kembali utuh; nama berbahaya dibersihkan', async () => {
    const data = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
    const bytes = await lock(
      { type: 'file', name: '../../rahasia.bin', mime: 'application/x-test', data },
      'pw',
      IT,
    );
    expect(isLocked(bytes)).toBe(true);
    const back = await unlock(bytes, 'pw');
    expect(back.type).toBe('file');
    if (back.type !== 'file') return;
    expect(back.name).toBe('rahasia.bin');
    expect(back.mime).toBe('application/x-test');
    expect([...back.data]).toEqual([...data]);
  });

  it('teks berulang dikompres sehingga kodenya pendek', async () => {
    const bytes = await lock({ type: 'text', text: 'halo '.repeat(2000) }, 'pw', IT);
    expect(bytes.length).toBeLessThan(500);
  });

  it('password salah atau kode diubah: gagal dengan pesan password', async () => {
    const bytes = await lock({ type: 'text', text: 'isi' }, 'benar', IT);
    await expect(unlock(bytes, 'salah')).rejects.toEqual(new LockboxError('password'));
    const tampered = bytes.slice();
    tampered[4] ^= 1; // flag di header ikut diautentikasi
    await expect(unlock(tampered, 'benar')).rejects.toEqual(new LockboxError('password'));
    const tail = bytes.slice();
    tail[tail.length - 1] ^= 1;
    await expect(unlock(tail, 'benar')).rejects.toEqual(new LockboxError('password'));
  });

  it('dua kali kunci dengan isi sama menghasilkan kode berbeda (salt dan iv acak)', async () => {
    const a = toCode(await lock({ type: 'text', text: 'x' }, 'pw', IT));
    const b = toCode(await lock({ type: 'text', text: 'x' }, 'pw', IT));
    expect(a).not.toBe(b);
  });

  it('menolak teks yang bukan kode Toolland', () => {
    expect(fromCode('halo')).toBeNull();
    expect(fromCode('TOOLLAND1.***')).toBeNull();
    expect(fromCode('TOOLLAND1.aGFsbw')).toBeNull(); // base64 valid tapi bukan format kita
  });

  it('password otomatis: pola mudah dibaca dan selalu berbeda', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword();
      expect(pw).toMatch(/^([bdgjklmnprstwz][aiueo]){2}(-([bdgjklmnprstwz][aiueo]){2}){3}-\d\d$/);
      seen.add(pw);
    }
    expect(seen.size).toBe(200);
  });

  it('peringatan password lemah', () => {
    expect(isWeakPassword('rahasia')).toBe(true);
    expect(isWeakPassword('rahasia123')).toBe(true);
    expect(isWeakPassword('Rahasia-123')).toBe(false);
    expect(isWeakPassword('kodu-meja-ritu-bale-27')).toBe(false);
  });
});
