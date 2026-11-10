import { describe, expect, it } from 'vitest';
import {
  type MediaItem,
  clipAt,
  clipFor,
  clipStarts,
  newProject,
  overlapAt,
  totalDuration,
  transitionOverlap,
  voicedSpans,
} from './project';
import { buildExportArgs } from './render';

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

function sample() {
  const p = newProject();
  p.media = [video, image];
  p.clips = [
    { ...clipFor(video), out: 4, trans: 'cross' as const, transDur: 1 },
    { ...clipFor(image), trans: 'black' as const },
    { ...clipFor(video), out: 3, trans: 'wipe' as const, transDur: 5 },
    clipFor(image),
  ];
  return p;
}

describe('transisi bertumpuk', () => {
  it('klip berikutnya maju dan durasi total berkurang', () => {
    const p = sample();
    expect(transitionOverlap(p, 0)).toBe(1);
    expect(transitionOverlap(p, 1)).toBe(0); // pudar lewat hitam tidak bertumpuk
    expect(transitionOverlap(p, 2)).toBe(1.5); // dibatasi separuh klip 3 detik
    expect(clipStarts(p)).toEqual([0, 3, 6, 7.5]);
    expect(totalDuration(p)).toBe(10.5);
  });

  it('kemajuan transisi dan klip aktif', () => {
    const p = sample();
    expect(overlapAt(p, 3.5)).toEqual({ out: 0, in: 1, progress: 0.5, kind: 'cross' });
    expect(overlapAt(p, 4.2)).toBeNull();
    expect(clipAt(p, 3.5)?.index).toBe(1);
    expect(clipAt(p, 2.9)?.index).toBe(0);
    expect(overlapAt(p, 8.25)?.progress).toBeCloseTo(0.5);
  });

  it('rentang suara memakai waktu mulai baru', () => {
    expect(voicedSpans(sample())).toEqual([
      [0, 4],
      [6, 9],
    ]);
  });

  it('ekspor: concat per kelompok lalu xfade dan acrossfade', () => {
    const args = buildExportArgs(sample(), {
      paths: new Map([
        ['v', '/v.mp4'],
        ['i', '/i.jpg'],
      ]),
      withAudio: new Set(['v']),
      textPaths: [],
      out: '/o.mp4',
    });
    const g = args[args.indexOf('-filter_complex') + 1];
    expect(g).toContain('[v0][a0]concat=n=1:v=1:a=1[gv0][ga0]');
    expect(g).toContain('[v1][a1][v2][a2]concat=n=2:v=1:a=1[gv1][ga1]');
    expect(g).toContain('xfade=transition=fade:duration=1:offset=3[xv1]');
    expect(g).toContain('[ga0][ga1]acrossfade=d=1:c1=tri:c2=tri[xa1]');
    expect(g).toContain('xfade=transition=wipeleft:duration=1.5:offset=7.5[vc]');
    expect(args.slice(-3, -1)).toEqual(['-t', '10.5']);
  });

  it('tanpa transisi bertumpuk tetap satu concat', () => {
    const p = sample();
    p.clips = p.clips.map((c) => ({ ...c, trans: 'none' as const }));
    const args = buildExportArgs(p, {
      paths: new Map([
        ['v', '/v.mp4'],
        ['i', '/i.jpg'],
      ]),
      withAudio: new Set(),
      textPaths: [],
      out: '/o.mp4',
    });
    const g = args[args.indexOf('-filter_complex') + 1];
    expect(g).toContain('concat=n=4:v=1:a=1[vc][ac]');
    expect(g).not.toContain('xfade');
  });
});
