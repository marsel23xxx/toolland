import { describe, expect, it } from 'vitest';
import { extForType, mixAudio, pickRecType, recordingFileName } from './screen-record';

describe('pickRecType', () => {
  it('MP4 diutamakan bila didukung (Chrome baru, Safari)', () => {
    expect(pickRecType((t) => t.startsWith('video/mp4') || t.startsWith('video/webm'))).toMatch(
      /^video\/mp4;codecs=avc1/,
    );
  });
  it('Firefox jatuh ke WebM VP9/VP8', () => {
    expect(pickRecType((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
    expect(pickRecType((t) => t === 'video/webm')).toBe('video/webm');
  });
  it('tidak ada yang didukung -> string kosong (pakai bawaan browser)', () => {
    expect(pickRecType(() => false)).toBe('');
  });
});

describe('extForType', () => {
  it('menentukan ekstensi dari MIME', () => {
    expect(extForType('video/mp4;codecs=avc1,mp4a.40.2')).toBe('mp4');
    expect(extForType('video/webm;codecs=vp8,opus')).toBe('webm');
    expect(extForType('')).toBe('webm');
  });
});

describe('recordingFileName', () => {
  it('memakai tanggal dan jam lokal dengan nol di depan', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(recordingFileName('rekaman-layar', d, 'mp4')).toBe('rekaman-layar-2026-01-05-0907.mp4');
  });
});

describe('mixAudio', () => {
  it('nol atau satu trek dipakai langsung tanpa Web Audio', () => {
    expect(mixAudio([]).track).toBeNull();
    const t = { kind: 'audio' } as MediaStreamTrack;
    expect(mixAudio([t]).track).toBe(t);
  });
});
