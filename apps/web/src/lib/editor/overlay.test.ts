import { describe, expect, it } from 'vitest';
import { sanitizeProject } from './ayu';
import {
  MUSIC_DEFAULTS,
  OVERLAY_DEFAULTS,
  type MediaItem,
  type Overlay,
  clipFor,
  newProject,
  overlayAlpha,
  overlayPixels,
  pruneMedia,
} from './project';
import { buildExportArgs } from './render';
import { snapTargets } from './timeline';

const video: MediaItem = {
  id: 'v',
  kind: 'video',
  name: 'v.mp4',
  size: 1,
  duration: 10,
  width: 1920,
  height: 1080,
  lastModified: 0,
};
const image: MediaItem = { ...video, id: 'i', kind: 'image', duration: 0, name: 'i.jpg' };
const song: MediaItem = { ...video, id: 'm', kind: 'audio', duration: 60, name: 'lagu.mp3' };

const pip: Overlay = {
  ...OVERLAY_DEFAULTS,
  id: 'a',
  kind: 'media',
  mediaId: 'v',
  start: 1,
  in: 2,
  out: 5,
  x: 0.75,
  y: 0.25,
  w: 0.3,
  ratio: 0.5625,
  volume: 0.8,
  fadeIn: 0.5,
};
const star: Overlay = {
  ...OVERLAY_DEFAULTS,
  id: 'b',
  kind: 'emoji',
  char: '⭐',
  start: 0,
  in: 0,
  out: 2,
  w: 0.1,
  rotate: 15,
  opacity: 0.5,
};

describe('overlay', () => {
  it('kepekatan dan ukuran piksel', () => {
    expect(overlayAlpha(pip, 0.5)).toBe(0);
    expect(overlayAlpha(pip, 1.25)).toBeCloseTo(0.5);
    expect(overlayAlpha(pip, 3)).toBe(1);
    expect(overlayAlpha(pip, 4)).toBe(0); // berakhir di 1 + 3 detik
    expect(overlayAlpha(star, 1)).toBe(0.5);
    expect(overlayPixels(pip, 1280)).toEqual({ pw: 384, ph: 216 });
  });

  it('ekspor: video PiP dengan audio, stiker berputar, campuran audio', () => {
    const p = newProject();
    p.media = [video, image, song];
    p.clips = [{ ...clipFor(image), out: 6 }];
    p.overlays = [pip, star];
    p.music = { ...MUSIC_DEFAULTS, mediaId: 'm' };
    const args = buildExportArgs(p, {
      paths: new Map([
        ['v', '/v.mp4'],
        ['i', '/i.jpg'],
        ['m', '/m.mp3'],
      ]),
      withAudio: new Set(['v']),
      textPaths: [],
      overlayPaths: ['', '/o1.png'],
      out: '/o.mp4',
    });
    const s = args.join(' ');
    expect(s).toContain('-ss 2 -t 3 -i /v.mp4');
    expect(s).toContain('-loop 1 -framerate 30 -t 2 -i /o1.png');
    const g = args[args.indexOf('-filter_complex') + 1];
    expect(g).toContain(
      '[1:v]scale=384:216,setsar=1,fps=30,format=rgba,fade=t=in:st=0:d=0.5:alpha=1,setpts=PTS-STARTPTS+1/TB[ov0]',
    );
    expect(g).toContain(
      "[vc][ov0]overlay=x=0.75*W-w/2:y=0.25*H-h/2:eof_action=pass:enable='between(t,1,4)'[o0]",
    );
    expect(g).toContain('colorchannelmixer=aa=0.5,rotate=15*PI/180:c=none');
    expect(g).toContain('volume=0.8,adelay=delays=1000:all=1,apad,atrim=duration=6[oa0]');
    expect(g).toContain(
      '[ac][oa0][mus]amix=inputs=3:duration=first:dropout_transition=0,volume=3[am]',
    );
  });

  it('simpan/buka, media terpakai, dan magnet', () => {
    const p = sanitizeProject({
      media: [video],
      clips: [{ id: 'c', mediaId: 'v', in: 0, out: 5 }],
      overlays: [pip, star, { ...pip, id: 'x', mediaId: 'hilang' }],
    });
    expect(p.overlays.map((o) => o.id)).toEqual(['a', 'b']);
    expect(p.overlays[1]).toMatchObject({ char: '⭐', rotate: 15, opacity: 0.5 });
    const q = newProject();
    q.media = [video, image];
    q.clips = [clipFor(image)];
    q.overlays = [pip];
    expect(pruneMedia(q).media.map((m) => m.id)).toEqual(['v', 'i']);
    expect(snapTargets(q, { playhead: 9 })).toEqual(expect.arrayContaining([1, 4]));
  });
});
