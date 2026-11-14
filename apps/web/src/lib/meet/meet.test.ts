import { describe, expect, it } from 'vitest';
import { maskToAlpha } from './blur';
import { mediaConstraints } from './media';
import { videoBitrate } from './mesh';
import { newRoomId, parseRoom, ROOM_RE, signalUrl } from './signal';

describe('ID room', () => {
  it('acak, berformat xxx-xxxx-xxx, dan lolos validasi server', () => {
    const ids = new Set(Array.from({ length: 200 }, newRoomId));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/);
      expect(ROOM_RE.test(id)).toBe(true);
    }
  });

  it('membaca link lengkap, hash, atau kode saja', () => {
    expect(parseRoom('https://julian-marcell.com/tools/rapat-online#r=abc-defg-hij')).toBe(
      'abc-defg-hij',
    );
    expect(parseRoom('  ABC-DEFG-HIJ ')).toBe('abc-defg-hij');
    expect(parseRoom('#r=abc-defg-hij')).toBe('abc-defg-hij');
    expect(parseRoom('pendek')).toBeNull();
    expect(parseRoom('https://contoh.com/halaman')).toBeNull();
  });

  it('URL signaling mengikuti protokol halaman', () => {
    expect(signalUrl({ protocol: 'https:', host: 'julian-marcell.com' } as Location)).toBe(
      'wss://julian-marcell.com/api/tools/v1/meet',
    );
    expect(signalUrl({ protocol: 'http:', host: 'localhost:4321' } as Location)).toBe(
      'ws://localhost:4321/api/tools/v1/meet',
    );
  });
});

describe('media', () => {
  it('bitrate video turun saat peserta bertambah', () => {
    expect([1, 2, 3].map(videoBitrate)).toEqual([1_500_000, 900_000, 600_000]);
  });

  it('masker kepercayaan menjadi kanal alfa', () => {
    const out = new Uint8ClampedArray(12).fill(7);
    maskToAlpha(new Float32Array([0, 0.5, 1]), out);
    expect([out[3], out[7], out[11]]).toEqual([0, 128, 255]);
    expect(out[0]).toBe(7);
  });

  it('perangkat yang dipilih dipakai persis, bawaan memakai kamera depan', () => {
    expect(mediaConstraints('', '').video).toMatchObject({ facingMode: 'user' });
    expect(mediaConstraints('cam1', 'mic1')).toMatchObject({
      video: { deviceId: { exact: 'cam1' } },
      audio: { deviceId: { exact: 'mic1' }, echoCancellation: true },
    });
  });
});
