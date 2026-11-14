import { describe, expect, it } from 'vitest';
import { lockArgs, parseEncryption, randomOwnerPassword, unlockArgs } from './protect';

const base = { password: 'rahasia', noPrint: false, noCopy: false, noModify: false };

describe('lockArgs', () => {
  it('AES-256, password pemilik = password buka bila tanpa pembatasan', () => {
    const a = lockArgs(base, 'acak', '/in.pdf', '/out.pdf');
    expect(a).toContain('--bits=256');
    expect(a).toContain('--user-password=rahasia');
    expect(a).toContain('--owner-password=rahasia');
    expect(a.slice(-3)).toEqual(['--', '/in.pdf', '/out.pdf']);
    expect(a.some((x) => x.startsWith('--print'))).toBe(false);
  });

  it('pembatasan memakai password pemilik berbeda dan flag yang sesuai', () => {
    const a = lockArgs({ ...base, noPrint: true, noCopy: true }, 'acak', 'i', 'o');
    expect(a).toContain('--owner-password=acak');
    expect(a).toContain('--print=none');
    expect(a).toContain('--extract=n');
    expect(a).not.toContain('--modify=none');
    expect(lockArgs({ ...base, noModify: true }, 'x', 'i', 'o')).toContain('--modify=none');
  });

  it('password berisi spasi/tanda tetap satu argumen', () => {
    const a = lockArgs({ ...base, password: 'a b=c "d"' }, 'x', 'i', 'o');
    expect(a).toContain('--user-password=a b=c "d"');
  });
});

describe('unlockArgs', () => {
  it('dengan dan tanpa password', () => {
    expect(unlockArgs('pw', 'i', 'o')).toEqual(['--password=pw', '--decrypt', 'i', 'o']);
    expect(unlockArgs('', 'i', 'o')).toEqual(['--decrypt', 'i', 'o']);
  });
});

describe('parseEncryption (keluaran asli qpdf 12)', () => {
  it('tidak terenkripsi', () => {
    expect(parseEncryption(['File is not encrypted'])).toEqual({ kind: 'none' });
  });
  it('butuh password', () => {
    expect(parseEncryption(['qpdf: /in/a.pdf: invalid password'])).toEqual({ kind: 'password' });
  });
  it('hanya dibatasi izin', () => {
    const lines = [
      'R = 6',
      'P = -3392',
      'User password = ',
      'extract for accessibility: allowed',
      'extract for any purpose: not allowed',
      'print low resolution: allowed',
      'print high resolution: not allowed',
      'modify document assembly: allowed',
      'modify anything: allowed',
    ];
    expect(parseEncryption(lines)).toEqual({
      kind: 'restricted',
      print: true,
      copy: true,
      modify: false,
    });
  });
});

describe('randomOwnerPassword', () => {
  it('48 karakter heksadesimal dan berbeda setiap kali', () => {
    const a = randomOwnerPassword();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(randomOwnerPassword()).not.toBe(a);
  });
});
