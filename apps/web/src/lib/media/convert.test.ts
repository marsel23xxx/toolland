import { describe, expect, it } from 'vitest';
import {
  AUDIO_FORMATS,
  audioArgs,
  bitrateOf,
  canCopyVideo,
  hasQuality,
  videoArgs,
} from './convert';

const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('audioArgs', () => {
  it('mengambil trek audio pertama tanpa video/sampul untuk semua format', () => {
    for (const f of AUDIO_FORMATS) {
      const a = audioArgs('/in/a.opus', f, 'high', `/out/a.${f}`);
      expect(a.slice(0, 2)).toEqual(['-i', '/in/a.opus']);
      expect(after(a, '-map')).toBe('0:a:0');
      expect(a).toContain('-vn');
      expect(a.at(-1)).toBe(`/out/a.${f}`);
    }
  });

  it('memakai encoder dan bitrate yang sesuai', () => {
    expect(after(audioArgs('i', 'mp3', 'max', 'o'), '-c:a')).toBe('libmp3lame');
    expect(after(audioArgs('i', 'mp3', 'max', 'o'), '-b:a')).toBe('320k');
    expect(after(audioArgs('i', 'opus', 'standard', 'o'), '-c:a')).toBe('libopus');
    expect(after(audioArgs('i', 'm4a', 'high', 'o'), '-c:a')).toBe('aac');
    expect(after(audioArgs('i', 'flac', 'high', 'o'), '-c:a')).toBe('flac');
    expect(audioArgs('i', 'wav', 'max', 'o')).not.toContain('-b:a');
  });

  it('WAV dan FLAC tanpa pilihan kualitas', () => {
    expect(hasQuality('wav')).toBe(false);
    expect(hasQuality('flac')).toBe(false);
    expect(bitrateOf('flac', 'max')).toBeNull();
    expect(bitrateOf('opus', 'standard')).toBe('64k');
  });
});

describe('videoArgs', () => {
  it('H.264 + AAC ke MP4 cukup disalin (cepat, kualitas asli)', () => {
    const a = videoArgs('i', 'mp4', { video: 'avc', audio: 'aac' }, 'o.mp4');
    expect(after(a, '-c:v')).toBe('copy');
    expect(after(a, '-c:a')).toBe('copy');
    expect(a).not.toContain('-vf');
  });

  it('HEVC (iPhone) dan codec tak dikenal diubah ke H.264 berdimensi genap', () => {
    for (const codecs of [{ video: 'hevc', audio: 'aac' }, null]) {
      const a = videoArgs('i', 'mp4', codecs, 'o.mp4');
      expect(after(a, '-c:v')).toBe('libx264');
      expect(after(a, '-vf')).toContain('trunc(iw/2)*2');
      expect(after(a, '-pix_fmt')).toBe('yuv420p');
    }
    expect(canCopyVideo('mp4', { video: 'hevc', audio: null })).toBe(false);
  });

  it('audio selain AAC di MP4 diubah ke AAC; audio opsional', () => {
    const a = videoArgs('i', 'mp4', { video: 'avc', audio: 'pcm-s16' }, 'o');
    expect(after(a, '-c:a')).toBe('aac');
    expect(a).toContain('0:a:0?');
  });

  it('WebM: VP8/VP9 disalin, lainnya di-encode VP8 + Opus', () => {
    const copy = videoArgs('i', 'webm', { video: 'vp9', audio: 'opus' }, 'o');
    expect(after(copy, '-c:v')).toBe('copy');
    expect(after(copy, '-c:a')).toBe('copy');
    const enc = videoArgs('i', 'webm', { video: 'avc', audio: 'aac' }, 'o');
    expect(after(enc, '-c:v')).toBe('libvpx');
    expect(after(enc, '-c:a')).toBe('libopus');
    expect(enc).not.toContain('-movflags');
  });
});
