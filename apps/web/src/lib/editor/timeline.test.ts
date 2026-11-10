import { describe, expect, it } from 'vitest';
import { type MediaItem, TEXT_DEFAULTS, clipFor, newProject } from './project';
import {
  computePeaks,
  nearestFrame,
  peaksRange,
  previewStarts,
  reorderTarget,
  snap,
  snapTargets,
  textLanes,
  trimClip,
  waveformPath,
} from './timeline';

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
const image: MediaItem = { ...video, id: 'i', kind: 'image', duration: 0 };

describe('interaksi timeline', () => {
  it('magnet menempel ke target terdekat di dalam ambang', () => {
    expect(snap(4.95, [0, 5, 10], 0.1)).toEqual({ value: 5, hit: 5 });
    expect(snap(4.5, [0, 5, 10], 0.1)).toEqual({ value: 4.5, hit: null });
    expect(snap(5.04, [5, 5.1], 0.2).value).toBe(5);
  });

  it('target magnet: playhead, batas klip, dan teks', () => {
    const p = newProject();
    p.clips = [{ ...clipFor(video), out: 4 }, clipFor(image)];
    p.texts = [
      {
        id: 't',
        text: 'a',
        start: 1,
        end: 2,
        ...TEXT_DEFAULTS,
        x: 0.5,
        y: 0.5,
      },
    ];
    expect(snapTargets(p, { playhead: 3 }).sort()).toEqual([0, 1, 2, 3, 4, 7]);
    expect(snapTargets(p, { playhead: 3, excludeClipEdges: [1], excludeText: 't' })).toEqual([
      3, 0, 7,
    ]);
    expect(snapTargets(p, { playhead: 3, clipEdgesUntil: 1 })).toEqual([3, 0, 4, 1, 2]);
  });

  it('tarik ujung klip video dan gambar', () => {
    const c = { ...clipFor(video), in: 2, out: 8 };
    expect(trimClip(c, video, 'in', 1.5)).toMatchObject({ in: 3.5, out: 8 });
    expect(trimClip(c, video, 'in', -5)).toMatchObject({ in: 0 });
    expect(trimClip(c, video, 'in', 10).in).toBeCloseTo(7.8);
    expect(trimClip(c, video, 'out', 5)).toMatchObject({ out: 10 });
    const g = clipFor(image);
    expect(trimClip(g, image, 'out', 2)).toMatchObject({ in: 0, out: 5 });
    expect(trimClip(g, image, 'in', 1)).toMatchObject({ in: 0, out: 2 });
    expect(trimClip(g, image, 'in', 9).out).toBe(0.2);
  });

  it('posisi tujuan saat menggeser klip', () => {
    const lengths = [2, 4, 2];
    expect(reorderTarget(lengths, 0, 0.5)).toBe(0);
    expect(reorderTarget(lengths, 0, 2.5)).toBe(1); // melewati tengah klip kedua (di 2)
    expect(reorderTarget(lengths, 0, 7)).toBe(2);
    expect(reorderTarget(lengths, 2, 0.5)).toBe(0);
    expect(previewStarts(lengths, 0, 2)).toEqual([6, 0, 4]);
    expect(previewStarts(lengths, -1, -1)).toEqual([0, 2, 6]);
  });

  it('teks yang bertumpuk dibagi ke beberapa lajur', () => {
    const { lane, count } = textLanes([
      { id: 'a', start: 0, end: 3 },
      { id: 'b', start: 1, end: 2 },
      { id: 'c', start: 3, end: 4 },
    ]);
    expect(count).toBe(2);
    expect([lane.get('a'), lane.get('b'), lane.get('c')]).toEqual([0, 1, 0]);
  });

  it('gelombang suara diringkas dan diambil per rentang', () => {
    const ch = new Float32Array(1000);
    for (let i = 500; i < 1000; i++) ch[i] = 0.5;
    const peaks = computePeaks([ch], 10);
    expect(Array.from(peaks)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
    expect(peaksRange(peaks, 10, 4, 6, 2)).toEqual([0, 1]);
    // Musik berulang: detik 12 = detik 2.
    expect(peaksRange(peaks, 10, 12, 13, 1, true)).toEqual([0]);
    expect(waveformPath([0, 1], 10, 10)).toMatch(/^M0,5 L/);
    expect(nearestFrame([{ t: 0 }, { t: 2 }, { t: 4 }], 2.9)?.t).toBe(2);
  });
});
