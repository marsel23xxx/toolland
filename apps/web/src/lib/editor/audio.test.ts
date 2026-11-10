import { describe, expect, it } from 'vitest';
import { sanitizeProject } from './ayu';
import {
  MUSIC_DEFAULTS,
  type AudioItem,
  type MediaItem,
  clipFor,
  newProject,
  voicedSpans,
} from './project';
import { buildExportArgs } from './render';

const image: MediaItem = {
  id: 'i',
  kind: 'image',
  name: 'i.jpg',
  size: 1,
  duration: 0,
  width: 1920,
  height: 1080,
  lastModified: 0,
};
const voice: MediaItem = {
  ...image,
  id: 'n',
  kind: 'audio',
  name: 'narasi-1.webm',
  duration: 4,
  recorded: true,
};
const song: MediaItem = { ...image, id: 'm', kind: 'audio', name: 'lagu.mp3', duration: 60 };
const narration: AudioItem = {
  id: 'a',
  mediaId: 'n',
  start: 2,
  in: 0.5,
  out: 3.5,
  volume: 1.2,
  fadeIn: 0,
  fadeOut: 0.5,
};

describe('audio tambahan', () => {
  it('ekspor: potongan, volume, fade, jeda, dicampur dengan musik', () => {
    const p = newProject();
    p.media = [image, voice, song];
    p.clips = [{ ...clipFor(image), out: 8 }];
    p.audios = [narration];
    p.music = { ...MUSIC_DEFAULTS, mediaId: 'm', duck: true };
    const args = buildExportArgs(p, {
      paths: new Map([
        ['i', '/i.jpg'],
        ['n', '/n.webm'],
        ['m', '/m.mp3'],
      ]),
      withAudio: new Set(),
      textPaths: [],
      out: '/o.mp4',
    });
    expect(args.join(' ')).toContain('-ss 0.5 -t 3 -i /n.webm');
    const g = args[args.indexOf('-filter_complex') + 1];
    expect(g).toContain(
      'volume=1.2,afade=t=out:st=2.5:d=0.5,adelay=delays=2000:all=1,apad,atrim=duration=8[xa0x]',
    );
    // Musik mengecil selama narasi (detik 2-5).
    expect(g).toContain('(t+0-2)/0.3');
    expect(g).toContain(
      '[ac][xa0x][mus]amix=inputs=3:duration=first:dropout_transition=0,volume=3[am]',
    );
  });

  it('narasi ikut membuat musik mengecil', () => {
    const p = newProject();
    p.media = [image, voice];
    p.clips = [{ ...clipFor(image), out: 8 }];
    p.audios = [narration, { ...narration, id: 'b', start: 4.5 }];
    expect(voicedSpans(p)).toEqual([[2, 7.5]]);
  });

  it('simpan/buka: audio dan tanda rekaman', () => {
    const p = sanitizeProject({
      media: [image, voice],
      clips: [{ id: 'c', mediaId: 'i', in: 0, out: 5 }],
      audios: [narration, { ...narration, id: 'x', mediaId: 'hilang' }],
    });
    expect(p.audios.map((a) => a.id)).toEqual(['a']);
    expect(p.media.find((m) => m.id === 'n')?.recorded).toBe(true);
    expect(p.media.find((m) => m.id === 'i')?.recorded).toBeUndefined();
  });
});
