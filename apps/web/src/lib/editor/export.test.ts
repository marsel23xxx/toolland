import { describe, expect, it } from 'vitest';
import { type MediaItem, clipFor, newProject } from './project';
import { buildExportArgs, exportRange } from './render';

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
const input = {
  paths: new Map([['i', '/i.jpg']]),
  withAudio: new Set<string>(),
  textPaths: [],
  out: '/o',
};
function sample() {
  const p = newProject();
  p.media = [image];
  p.clips = [{ ...clipFor(image), out: 60 }];
  return p;
}
const graph = (a: string[]) => a[a.indexOf('-filter_complex') + 1];

describe('opsi ekspor', () => {
  it('rentang dirapikan dan GIF dibatasi 30 detik', () => {
    expect(exportRange({ format: 'mp4', quality: 'balanced', range: null }, 60)).toEqual({
      start: 0,
      end: 60,
    });
    expect(
      exportRange({ format: 'mp4', quality: 'balanced', range: { start: 50, end: 90 } }, 60),
    ).toEqual({ start: 50, end: 60 });
    expect(exportRange({ format: 'gif', quality: 'balanced', range: null }, 60)).toEqual({
      start: 0,
      end: 30,
    });
  });

  it('MP4 sebagian dengan kualitas tinggi', () => {
    const a = buildExportArgs(sample(), input, {
      format: 'mp4',
      quality: 'high',
      range: { start: 10, end: 25 },
    });
    expect(graph(a)).toContain('[vc]trim=start=10:end=25,setpts=PTS-STARTPTS[vr]');
    expect(graph(a)).toContain('[ac]atrim=start=10:end=25,asetpts=PTS-STARTPTS[ar]');
    expect(a.join(' ')).toContain('-map [vr] -map [ar] -c:v libx264 -preset veryfast -crf 18');
    expect(a.slice(-3, -1)).toEqual(['-t', '15']);
  });

  it('MP3 hanya audio, GIF dengan palet', () => {
    const mp3 = buildExportArgs(sample(), input, { format: 'mp3', quality: 'small', range: null });
    expect(graph(mp3)).toContain('[vc]nullsink');
    expect(mp3.join(' ')).toContain('-map [ac] -c:a libmp3lame -b:a 192k -t 60');
    const gif = buildExportArgs(sample(), input, { format: 'gif', quality: 'small', range: null });
    expect(graph(gif)).toContain('palettegen=stats_mode=diff');
    expect(graph(gif)).toContain('[vc]trim=start=0:end=30');
    expect(graph(gif)).toContain('[ar]anullsink');
    expect(gif.join(' ')).toContain('-map [gif] -loop 0 -t 30');
  });
});
