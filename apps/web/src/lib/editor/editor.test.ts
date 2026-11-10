import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crc32, matchFiles, openAyu, sanitizeProject, saveAyu, unzipStore, zipStore } from './ayu';
import {
  type MediaItem,
  type Project,
  clampClip,
  clipAt,
  clipFor,
  moveClip,
  newProject,
  outputSize,
  splitAt,
  textLayout,
  totalDuration,
  transitionAt,
  transitionHalf,
  clipFades,
  wrapText,
} from './project';
import { buildExportArgs } from './render';

const video = (id: string, duration: number, name = `${id}.mp4`): MediaItem => ({
  id,
  kind: 'video',
  name,
  size: 1000 + duration,
  duration,
  width: 1920,
  height: 1080,
  lastModified: 0,
});
const image = (id: string): MediaItem => ({ ...video(id, 0, `${id}.jpg`), kind: 'image' });

function sample(): Project {
  const p = newProject('Uji');
  p.media = [video('a', 10), image('b'), { ...video('m', 120, 'lagu.mp3'), kind: 'audio' }];
  p.clips = [{ ...clipFor(p.media[0]), in: 2, out: 8 }, clipFor(p.media[1])];
  p.texts = [
    {
      id: 't1',
      text: 'Halo',
      start: 1,
      end: 4,
      position: 'bottom',
      size: 'm',
      color: '#ffffff',
      box: false,
      x: 0.5,
      y: 0.5,
    },
  ];
  p.music = { mediaId: 'm', offset: 5, volume: 0.5, fadeOut: true };
  return p;
}

describe('timeline', () => {
  it('ukuran keluaran genap per rasio', () => {
    expect(outputSize('16:9', '720')).toEqual({ w: 1280, h: 720 });
    expect(outputSize('9:16', '1080')).toEqual({ w: 1080, h: 1920 });
    expect(outputSize('4:5', '720')).toEqual({ w: 720, h: 900 });
    expect(outputSize('16:9', '480')).toEqual({ w: 854, h: 480 });
  });

  it('durasi total dan klip di waktu tertentu', () => {
    const p = sample();
    expect(totalDuration(p)).toBe(9); // 6 detik video + 3 detik gambar
    expect(clipAt(p, 0)?.local).toBe(2);
    expect(clipAt(p, 5.5)).toMatchObject({ index: 0, local: 7.5 });
    expect(clipAt(p, 7)).toMatchObject({ index: 1, local: 1 });
    expect(clipAt(p, 99)?.index).toBe(1);
  });

  it('potong klip di playhead dan pindah urutan', () => {
    const p = splitAt(sample(), 3);
    expect(p.clips).toHaveLength(3);
    expect(p.clips[0]).toMatchObject({ in: 2, out: 5 });
    expect(p.clips[1]).toMatchObject({ in: 5, out: 8 });
    expect(totalDuration(p)).toBe(9);
    // Terlalu dekat tepi klip: tidak dipotong.
    expect(splitAt(sample(), 0.05).clips).toHaveLength(2);
    const moved = moveClip(p, 2, 0);
    expect(moved.clips[0].mediaId).toBe('b');
  });

  it('titik masuk/keluar dirapikan', () => {
    const m = video('a', 10);
    expect(clampClip({ ...clipFor(m), in: -3, out: 50 }, m)).toMatchObject({ in: 0, out: 10 });
    expect(clampClip({ ...clipFor(m), in: 9.95, out: 9.96 }, m).out - 9.8).toBeGreaterThanOrEqual(
      0,
    );
  });

  it('transisi dibagi dua di batas klip dan dibatasi panjang klip', () => {
    const p = sample();
    p.clips[0] = { ...p.clips[0], trans: 'white', transDur: 1 };
    expect(transitionHalf(p, 0)).toBe(0.5);
    expect(transitionHalf(p, 1)).toBe(0); // klip terakhir tidak punya transisi keluar
    expect(clipFades(p, 1)).toMatchObject({ in: 0.5, inColor: 'white', out: 0 });
    expect(transitionAt(p, 6)).toEqual({ alpha: 1, color: 'white' }); // tepat di batas
    expect(transitionAt(p, 5.75).alpha).toBeCloseTo(0.5);
    expect(transitionAt(p, 3).alpha).toBe(0);
    p.clips[0].transDur = 20;
    expect(transitionHalf(p, 0)).toBe(1.5); // separuh gambar 3 detik
  });

  it('posisi teks bebas memakai titik tengah relatif', () => {
    const L = textLayout({ size: 'm', position: 'custom', x: 0.25, y: 0.8 }, 1280, 720);
    expect(L).toMatchObject({ x: 320, y: 576, baseline: 'middle' });
    expect(textLayout({ size: 'm', position: 'top' }, 1280, 720).x).toBe(640);
  });

  it('teks dibungkus per kata', () => {
    const lines = wrapText('satu dua tiga empat', 9, (s) => s.length);
    expect(lines).toEqual(['satu dua', 'tiga', 'empat']);
  });
});

describe('format .ayu', () => {
  it('CRC-32 sesuai standar', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('ZIP store bisa dibaca pustaka lain dan oleh unzipStore', async () => {
    const zip = await zipStore([
      { path: 'project.json', data: new Blob(['{"a":1}']) },
      { path: 'media/x', data: new Blob([new Uint8Array([1, 2, 3, 4])]) },
    ]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const files = unzipSync(bytes);
    expect(strFromU8(files['project.json'])).toBe('{"a":1}');
    expect([...files['media/x']]).toEqual([1, 2, 3, 4]);
    const back = await unzipStore(zip);
    expect([...new Uint8Array(await back.get('media/x')!.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('simpan ringan lalu buka kembali', async () => {
    const p = sample();
    const blob = await saveAyu(p, new Map(), false);
    const opened = await openAyu(blob);
    expect(opened.bundled).toBe(false);
    expect(opened.project.clips).toHaveLength(2);
    expect(opened.project.texts[0].text).toBe('Halo');
    expect(opened.files.size).toBe(0);
  });

  it('simpan beserta video lalu buka kembali', async () => {
    const p = sample();
    const files = new Map([
      ['a', new File([new Uint8Array(500).fill(7)], 'a.mp4')],
      ['b', new File([new Uint8Array(10).fill(3)], 'b.jpg')],
    ]);
    const blob = await saveAyu(p, files, true);
    const opened = await openAyu(blob);
    expect(opened.bundled).toBe(true);
    expect(opened.files.get('a')?.size).toBe(500);
    expect(opened.files.get('a')?.name).toBe('a.mp4');
    expect(new Uint8Array(await opened.files.get('b')!.arrayBuffer())[0]).toBe(3);
  });

  it('file bukan proyek ditolak, nilai aneh dirapikan', async () => {
    await expect(openAyu(new Blob(['halo']))).rejects.toThrow('invalid');
    await expect(openAyu(new Blob(['{"format":"lain"}']))).rejects.toThrow('invalid');
    const p = sanitizeProject({
      settings: { aspect: 'x', quality: 9 },
      media: [{ id: 'a', name: 'a.mp4', kind: 'video', duration: 5 }],
      clips: [{ mediaId: 'a', in: -1, out: 3, volume: 99 }, { mediaId: 'hilang' }],
      texts: [{ text: 'x'.repeat(500), color: 'merah' }],
    });
    expect(p.settings).toMatchObject({ aspect: '16:9', quality: '720' });
    expect(p.clips).toHaveLength(1);
    expect(p.clips[0]).toMatchObject({ in: 0, volume: 2 });
    expect(p.texts[0].text).toHaveLength(200);
    expect(p.texts[0].color).toBe('#ffffff');
  });

  it('mencocokkan file pilihan dengan media proyek', () => {
    const media = [video('a', 5, 'liburan.mp4'), video('b', 5, 'pantai.mp4')];
    const chosen = [
      new File([new Uint8Array(3)], 'pantai.mp4'),
      new File([new Uint8Array(media[0].size)], 'liburan.mp4'),
    ];
    const m = matchFiles(media, chosen);
    expect(m.get('a')?.name).toBe('liburan.mp4');
    expect(m.get('b')?.name).toBe('pantai.mp4');
  });
});

describe('perintah ffmpeg', () => {
  const input = {
    paths: new Map([
      ['a', '/edin/a.mp4'],
      ['b', '/edin/b.jpg'],
      ['m', '/edin/m.mp3'],
    ]),
    withAudio: new Set(['a']),
    textPaths: ['/edtxt/t0.png'],
    out: '/edtxt/hasil.mp4',
  };

  it('klip, teks, musik, dan keluaran MP4', () => {
    const args = buildExportArgs(sample(), input);
    const s = args.join(' ');
    expect(s).toContain('-ss 2 -t 6 -i /edin/a.mp4');
    expect(s).toContain('-loop 1 -framerate 30 -t 3 -i /edin/b.jpg');
    expect(s).toContain('-stream_loop -1 -ss 5 -i /edin/m.mp3');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720');
    expect(graph).toContain('[0:a]atrim=duration=6');
    expect(graph).toContain('anullsrc=r=48000:cl=stereo,atrim=duration=3'); // gambar tanpa audio
    expect(graph).toContain('concat=n=2:v=1:a=1[vc][ac]');
    expect(graph).toContain("overlay=0:0:enable='between(t,1,4)'");
    expect(graph).toContain('afade=t=out:st=7:d=2');
    expect(args.at(-1)).toBe('/edtxt/hasil.mp4');
    expect(args.slice(-3, -1)).toEqual(['-t', '9']);
  });

  it('fill memotong, fade awal-akhir, klip bisu tidak memakai audionya', () => {
    const p = sample();
    p.clips[0] = { ...p.clips[0], fit: 'fill', volume: 0 };
    p.settings = { ...p.settings, aspect: '9:16', quality: '720', fade: true };
    p.music = null;
    const graph = buildExportArgs(p, input).join(' ');
    expect(graph).toContain('force_original_aspect_ratio=increase,crop=720:1280');
    expect(graph).toContain('fade=t=in:st=0');
    expect(graph).not.toContain('[0:a]');
    expect(graph).not.toContain('amix');
  });

  it('transisi memudarkan video dan audio di batas klip', () => {
    const p = sample();
    p.clips[0] = { ...p.clips[0], trans: 'black', transDur: 1 };
    const graph = buildExportArgs(p, input)[
      buildExportArgs(p, input).indexOf('-filter_complex') + 1
    ];
    expect(graph).toContain('fade=t=out:st=5.5:d=0.5:color=black[v0]');
    expect(graph).toContain('afade=t=out:st=5.5:d=0.5[a0]');
    expect(graph).toContain('fade=t=in:st=0:d=0.5:color=black[v1]');
  });

  it('media yang filenya hilang menghentikan ekspor', () => {
    expect(() => buildExportArgs(sample(), { ...input, paths: new Map() })).toThrow(
      'missing-media',
    );
  });
});
