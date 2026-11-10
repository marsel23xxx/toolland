import { describe, expect, it } from 'vitest';
import { sanitizeProject } from './ayu';
import {
  MUSIC_DEFAULTS,
  TEXT_DEFAULTS,
  type MediaItem,
  clipFor,
  duckGain,
  musicFadeGain,
  musicSpan,
  newProject,
  voicedSpans,
} from './project';
import { buildExportArgs } from './render';
import { SLIDE, fontCss, textAnimAt, textOverlay } from './textfx';

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
const text = { ...TEXT_DEFAULTS, id: 't', text: 'Halo', start: 2, end: 6 };

describe('teks', () => {
  it('font canvas sesuai pilihan', () => {
    expect(fontCss('bebas', 40)).toBe('400 40px "Bebas Neue", system-ui, sans-serif');
    expect(fontCss('jakarta', 20)).toContain('800 20px "Plus Jakarta Sans Variable"');
  });

  it('animasi masuk naik dan keluar pudar', () => {
    const t = { ...text, animIn: 'up' as const, animOut: 'fade' as const, animDur: 0.5 };
    expect(textAnimAt(t, 2)).toEqual({ alpha: 0, dx: 0, dy: SLIDE });
    expect(textAnimAt(t, 2.25).alpha).toBeCloseTo(0.5);
    expect(textAnimAt(t, 4)).toEqual({ alpha: 1, dx: 0, dy: 0 });
    expect(textAnimAt(t, 5.75).alpha).toBeCloseTo(0.5);
    expect(textAnimAt({ ...text }, 3)).toEqual({ alpha: 1, dx: 0, dy: 0 });
  });

  it('filter ffmpeg animasi teks', () => {
    const o = textOverlay({ ...text, animIn: 'left', animOut: 'fade', animDur: 0.5 }, 6);
    expect(o.chain).toBe(
      'format=rgba,fade=t=in:st=0:d=0.5:alpha=1,fade=t=out:st=3.5:d=0.5:alpha=1,setpts=PTS-STARTPTS+2/TB',
    );
    expect(o.x).toBe("'W*(0-0.06*(1-clip((t-2)/0.5\\,0\\,1)))'");
    expect(o.y).toBe('0');
    expect(textOverlay(text, 6)).toMatchObject({ x: '0', y: '0' });
  });
});

describe('musik', () => {
  it('rentang, fade, dan ducking', () => {
    expect(musicSpan({ start: 2, end: null }, 10)).toEqual({ start: 2, end: 10 });
    expect(musicSpan({ start: 2, end: 50 }, 10)).toEqual({ start: 2, end: 10 });
    expect(musicFadeGain({ fadeIn: 2, fadeOut: 0 }, { start: 2, end: 10 }, 3)).toBe(0.5);
    const p = newProject();
    p.media = [video, image];
    p.clips = [clipFor(image), { ...clipFor(video), out: 4 }, clipFor(image)];
    expect(voicedSpans(p)).toEqual([[3, 7]]);
    expect(voicedSpans(p, new Set())).toEqual([]);
    const spans = voicedSpans(p);
    expect(duckGain(spans, 1)).toBe(1);
    expect(duckGain(spans, 5)).toBeCloseTo(0.3);
    expect(duckGain(spans, 3.15)).toBeCloseTo(0.65);
  });

  it('ekspor musik: bagian, fade, ducking, jeda awal', () => {
    const p = newProject();
    p.media = [video, image, song];
    p.clips = [clipFor(image), { ...clipFor(video), out: 4 }];
    p.music = {
      ...MUSIC_DEFAULTS,
      mediaId: 'm',
      start: 1,
      end: 6,
      fadeIn: 1,
      fadeOut: 1,
      duck: true,
    };
    const args = buildExportArgs(p, {
      paths: new Map([
        ['v', '/v.mp4'],
        ['i', '/i.jpg'],
        ['m', '/m.mp3'],
      ]),
      withAudio: new Set(['v']),
      textPaths: [],
      out: '/o.mp4',
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('atrim=duration=5,asetpts=PTS-STARTPTS');
    expect(graph).toContain(
      "volume='(1-0.7*clip(min((t+1-3)/0.3\\,(7-t-1)/0.3)\\,0\\,1))':eval=frame",
    );
    expect(graph).toContain(
      'afade=t=in:st=0:d=1,afade=t=out:st=4:d=1,adelay=delays=1000:all=1,apad,atrim=duration=7[mus]',
    );
  });

  it('teks dengan animasi memakai PNG berulang', () => {
    const p = newProject();
    p.media = [image];
    p.clips = [clipFor(image)];
    p.texts = [{ ...text, start: 0.5, end: 2.5, animIn: 'fade' }];
    const args = buildExportArgs(p, {
      paths: new Map([['i', '/i.jpg']]),
      withAudio: new Set(),
      textPaths: ['/t0.png'],
      out: '/o.mp4',
    });
    expect(args.join(' ')).toContain('-loop 1 -framerate 30 -t 2 -i /t0.png');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain(
      '[1:v]format=rgba,fade=t=in:st=0:d=0.4:alpha=1,setpts=PTS-STARTPTS+0.5/TB[tx0]',
    );
    expect(graph).toContain("overlay=x=0:y=0:eof_action=pass:enable='between(t,0.5,2.5)'[t0]");
  });

  it('proyek lama: fadeOut true/false dan teks tanpa kotak bergaris tepi', () => {
    const p = sanitizeProject({
      media: [video, song],
      clips: [{ id: 'c', mediaId: 'v', in: 0, out: 5 }],
      texts: [{ id: 't', text: 'a', start: 0, end: 1, box: true }],
      music: { mediaId: 'm', offset: 3, volume: 0.5, fadeOut: true },
    });
    expect(p.music).toMatchObject({ fadeOut: 2, start: 0, end: null, duck: false, fadeIn: 0 });
    expect(p.texts[0]).toMatchObject({
      stroke: false,
      font: 'jakarta',
      animIn: 'none',
      boxOpacity: 0.6,
    });
  });
});
