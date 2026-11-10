/**
 * Salinan ringan khusus pratinjau (proxy): video yang tidak bisa diputar browser (misalnya HEVC
 * dari iPhone di Chrome/Firefox) atau terlalu berat (4K) diubah ke H.264 540p dengan ffmpeg.wasm.
 * Ekspor tetap memakai file asli, jadi kualitas hasil tidak turun.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { MediaItem } from './project';

/** Tinggi maksimal salinan pratinjau. */
export const PROXY_HEIGHT = 540;

/** Argumen ffmpeg pembuat salinan (fungsi murni, dites terpisah). */
export function proxyArgs(input: string, out: string): string[] {
  return [
    '-hide_banner',
    '-y',
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=-2:'min(${PROXY_HEIGHT},ih)':flags=fast_bilinear,format=yuv420p`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    '30',
    '-g',
    '30',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    '-movflags',
    '+faststart',
    out,
  ];
}

/** Video besar (sisi pendek di atas 1080 piksel) disarankan memakai pratinjau ringan. */
export function suggestProxy(m: Pick<MediaItem, 'kind' | 'width' | 'height'>): boolean {
  return m.kind === 'video' && Math.min(m.width, m.height) > 1080;
}

/** Detik dari teks "HH:MM:SS.ss" di log ffmpeg. */
export function logSeconds(s: string): number {
  const m = /(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/**
 * Buat salinan pratinjau. withThreadLimit dipanggil oleh pemanggil (lihat render.limitThreads)
 * agar kumpulan thread ffmpeg.wasm tidak habis.
 */
export async function makeProxy(
  ff: FFmpeg,
  file: File,
  id: string,
  limit: (args: string[]) => string[],
  onProgress: (p: number) => void,
): Promise<File> {
  const { FFFSType } = await import('@ffmpeg/ffmpeg');
  const ext = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? 'bin';
  const name = `px-${id}.${ext}`;
  const dir = '/pxin';
  const out = `/pxout-${id}.mp4`;
  let duration = 0;
  const onLog = ({ message }: { message: string }) => {
    const d = /Duration: (\d+:\d+:\d+(?:\.\d+)?)/.exec(message);
    if (d) duration = logSeconds(d[1]);
    const t = /time=(\d+:\d+:\d+(?:\.\d+)?)/.exec(message);
    if (t && duration > 0) onProgress(Math.min(1, logSeconds(t[1]) / duration));
  };
  await ff.createDir(dir).catch(() => {});
  await ff.mount(FFFSType.WORKERFS, { files: [new File([file], name, { type: file.type })] }, dir);
  ff.on('log', onLog);
  try {
    const code = await ff.exec(limit(proxyArgs(`${dir}/${name}`, out)));
    if (code !== 0) throw new Error('unsupported');
    const data = (await ff.readFile(out)) as Uint8Array;
    return new File([data as Uint8Array<ArrayBuffer>], `${file.name}.pratinjau.mp4`, {
      type: 'video/mp4',
    });
  } finally {
    ff.off('log', onLog);
    await ff.deleteFile(out).catch(() => {});
    await ff.unmount(dir).catch(() => {});
  }
}
