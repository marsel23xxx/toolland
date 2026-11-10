import { describe, expect, it } from 'vitest';
import { sanitizeProject } from './ayu';
import {
  atempoChain,
  colorFilter,
  colorSvg,
  colorTransform,
  fadeGain,
  geometryAt,
  geometryCss,
  geometryFilter,
  orientFilter,
} from './look';
import { CLIP_DEFAULTS, type MediaItem, clipAt, clipFor, clipLength, newProject } from './project';
import { buildExportArgs } from './render';
import { trimClip } from './timeline';

const video: MediaItem = {
  id: 'v',
  kind: 'video',
  name: 'v.mp4',
  size: 1,
  duration: 20,
  width: 1920,
  height: 1080,
  lastModified: 0,
};
const image: MediaItem = { ...video, id: 'i', kind: 'image', duration: 0, name: 'i.jpg' };
const base = { ...CLIP_DEFAULTS };

describe('warna', () => {
  it('bawaan tidak mengubah apa pun', () => {
    expect(colorTransform(base).identity).toBe(true);
    expect(colorFilter(base)).toBe('');
  });

  it('rumus pratinjau dan ekspor sama', () => {
    const c = { ...base, brightness: 1.2, contrast: 1.3, saturation: 0.5 };
    const t = colorTransform(c);
    expect(t.slope).toBeCloseTo(1.56);
    expect(t.intercept).toBeCloseTo(1.2 * 0.5 * -0.3);
    const f = colorFilter(c);
    expect(f).toMatch(/^colorchannelmixer=rr=0\.6065:rg=0\.3575:rb=0\.036:/);
    expect(f).toContain("lutrgb=r='clip(val*1.56+-45.9\\,0\\,255)'");
    const svg = colorSvg(c);
    expect(svg.matrix.split(' ')).toHaveLength(20);
    expect(svg.matrix.startsWith('0.6065 0.3575 0.036 0 0')).toBe(true);
    expect(svg.slope).toBeCloseTo(t.slope);
  });

  it('preset hitam-putih menghapus warna', () => {
    const t = colorTransform({ ...base, preset: 'bw' });
    // Ketiga baris matriks sama = keluaran abu-abu.
    expect(t.m.slice(0, 3)).toEqual(t.m.slice(3, 6));
  });
});

describe('geometri dan kecepatan', () => {
  it('Ken Burns zoom masuk dari 1 ke 1,25', () => {
    expect(geometryAt({ ...base, kenBurns: 'in' }, 0).z).toBe(1);
    expect(geometryAt({ ...base, kenBurns: 'in' }, 1).z).toBeCloseTo(1.25);
    expect(geometryAt({ ...base, kenBurns: 'left' }, 0.5)).toMatchObject({ px: 0 });
    expect(geometryCss({ z: 2, px: 1, py: 0 })).toBe('translate(-50%, 0%) scale(2)');
    expect(geometryFilter(base, 1280, 720, 30, 90)).toBe('');
    const zp = geometryFilter({ ...base, kenBurns: 'in' }, 1280, 720, 30, 91);
    expect(zp).toContain("z='1*(1+0.25*min(in/90\\,1))'");
    expect(zp).toContain(':d=1:s=1280x720:fps=30');
  });

  it('putar dan balik', () => {
    expect(orientFilter({ rotate: 90, flipH: true, flipV: false })).toBe('transpose=1,hflip');
    expect(orientFilter({ rotate: 180, flipH: false, flipV: false })).toBe('hflip,vflip');
    expect(orientFilter({ rotate: 0, flipH: false, flipV: false })).toBe('');
  });

  it('atempo dirantai untuk kecepatan di luar 0,5-2', () => {
    expect(atempoChain(1)).toBe('');
    expect(atempoChain(4)).toBe('atempo=2,atempo=2');
    expect(atempoChain(0.25)).toBe('atempo=0.5,atempo=0.5');
    expect(atempoChain(1.5)).toBe('atempo=1.5');
  });

  it('kecepatan mengubah panjang klip, posisi sumber, dan potongan', () => {
    const c = { ...clipFor(video), in: 2, out: 10, speed: 2 };
    expect(clipLength(c)).toBe(4);
    expect(clipAt({ clips: [c] }, 1)?.local).toBe(4);
    expect(trimClip(c, video, 'out', -1).out).toBe(8);
  });

  it('fade audio klip', () => {
    const c = { ...base, fadeIn: 1, fadeOut: 2 };
    expect(fadeGain(c, 0.5, 10)).toBe(0.5);
    expect(fadeGain(c, 5, 10)).toBe(1);
    expect(fadeGain(c, 9, 10)).toBe(0.5);
  });
});

describe('ekspor dengan pengaturan klip', () => {
  const input = {
    paths: new Map([
      ['v', '/edin/v.mp4'],
      ['i', '/edin/i.jpg'],
    ]),
    withAudio: new Set(['v']),
    textPaths: [],
    out: '/edtxt/hasil.mp4',
  };

  it('kecepatan, putar, warna, latar blur, Ken Burns, fps, dan warna latar', () => {
    const p = newProject();
    p.settings = { ...p.settings, fps: 24, bg: '#224488' };
    p.media = [video, image];
    p.clips = [
      {
        ...clipFor(video),
        in: 2,
        out: 10,
        speed: 2,
        rotate: 90,
        fit: 'blur',
        preset: 'bw',
        fadeIn: 0.5,
      },
      { ...clipFor(image), kenBurns: 'in' },
    ];
    const args = buildExportArgs(p, input);
    const s = args.join(' ');
    expect(s).toContain('-ss 2 -t 8 -i /edin/v.mp4');
    expect(s).toContain('-loop 1 -framerate 24 -t 3 -i /edin/i.jpg');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[0:v]transpose=1,split[ka0][kb0]');
    expect(graph).toContain('boxblur=20:2[kg0]');
    expect(graph).toContain('[g0]setsar=1,setpts=(PTS-STARTPTS)/2,fps=24,colorchannelmixer=');
    expect(graph).toContain('trim=duration=4,setpts=PTS-STARTPTS[v0]');
    expect(graph).toContain(
      'atrim=duration=8,asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atempo=2,apad,atrim=duration=4,volume=1,afade=t=in:st=0:d=0.5[a0]',
    );
    expect(graph).toContain('pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x224488');
    expect(graph).toContain('zoompan=');
    expect(args.slice(args.indexOf('-r'), args.indexOf('-r') + 2)).toEqual(['-r', '24']);
  });

  it('proyek versi 1 dibuka dengan nilai bawaan baru', () => {
    const p = sanitizeProject({
      settings: { aspect: '9:16' },
      media: [video],
      clips: [{ id: 'c', mediaId: 'v', in: 0, out: 5, fit: 'fill' }],
    });
    expect(p.settings).toMatchObject({ bg: '#000000', fps: 30 });
    expect(p.clips[0]).toMatchObject({ ...CLIP_DEFAULTS, fit: 'fill', in: 0, out: 5 });
  });
});
