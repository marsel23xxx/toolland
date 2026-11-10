/**
 * Ekspor proyek editor video menjadi MP4 dengan ffmpeg.wasm.
 *
 * Satu perintah ffmpeg dengan filter_complex: setiap klip dipotong, diskalakan ke ukuran keluaran
 * (fit = bingkai hitam, fill = dipotong), audionya diseragamkan (klip tanpa audio diberi hening),
 * lalu semua klip disambung (concat). Teks digambar ke PNG transparan seukuran video dengan canvas,
 * lalu ditumpuk (overlay) pada rentang waktunya. Musik latar dicampur di akhir.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { FFMPEG_THREADS } from '../media/ffmpeg';
import {
  FPS,
  type Project,
  type TextLayer,
  clipFades,
  clipLength,
  mediaOf,
  outputSize,
  textLayout,
  totalDuration,
  wrapText,
} from './project';

export interface ExportInput {
  /** Path file media di sistem file ffmpeg, per mediaId. */
  paths: Map<string, string>;
  /** mediaId video yang punya audio. */
  withAudio: Set<string>;
  /** Path PNG teks, sejajar dengan project.texts (kosong = teks dilewati). */
  textPaths: string[];
  out: string;
}

const n = (x: number) => String(Math.round(x * 1000) / 1000);
const AFMT = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';

/** Susun argumen ffmpeg untuk ekspor (fungsi murni, dites terpisah). */
export function buildExportArgs(p: Project, input: ExportInput): string[] {
  const { w, h } = outputSize(p.settings.aspect, p.settings.quality);
  const total = totalDuration(p);
  const args: string[] = ['-hide_banner', '-y'];
  const filters: string[] = [];
  let idx = 0;
  const concatIn: string[] = [];
  p.clips.forEach((c, k) => {
    const m = mediaOf(p, c.mediaId);
    const path = input.paths.get(c.mediaId);
    if (!m || !path) throw new Error('missing-media');
    const len = clipLength(c);
    if (m.kind === 'image')
      args.push('-loop', '1', '-framerate', String(FPS), '-t', n(len), '-i', path);
    else args.push('-ss', n(c.in), '-t', n(len), '-i', path);
    const scale =
      c.fit === 'fill'
        ? `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`
        : `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
    // Transisi: pudar ke/dari hitam atau putih di batas klip, audio ikut memudar.
    const f = clipFades(p, k);
    let vfade = '';
    let afade = '';
    if (f.in) {
      vfade += `,fade=t=in:st=0:d=${n(f.in)}:color=${f.inColor}`;
      afade += `,afade=t=in:st=0:d=${n(f.in)}`;
    }
    if (f.out) {
      vfade += `,fade=t=out:st=${n(len - f.out)}:d=${n(f.out)}:color=${f.outColor}`;
      afade += `,afade=t=out:st=${n(len - f.out)}:d=${n(f.out)}`;
    }
    filters.push(
      `[${idx}:v]${scale},setsar=1,fps=${FPS},format=yuv420p,trim=duration=${n(len)},setpts=PTS-STARTPTS${vfade}[v${k}]`,
    );
    if (m.kind === 'video' && input.withAudio.has(c.mediaId) && c.volume > 0)
      filters.push(
        `[${idx}:a]atrim=duration=${n(len)},asetpts=PTS-STARTPTS,${AFMT},volume=${n(c.volume)}${afade}[a${k}]`,
      );
    else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${n(len)},${AFMT}[a${k}]`);
    concatIn.push(`[v${k}][a${k}]`);
    idx++;
  });
  filters.push(`${concatIn.join('')}concat=n=${p.clips.length}:v=1:a=1[vc][ac]`);
  let v = 'vc';
  let a = 'ac';
  if (p.settings.fade && total > 1.5) {
    const d = Math.min(0.6, total / 4);
    filters.push(`[${v}]fade=t=in:st=0:d=${n(d)},fade=t=out:st=${n(total - d)}:d=${n(d)}[vf]`);
    filters.push(`[${a}]afade=t=in:st=0:d=${n(d)},afade=t=out:st=${n(total - d)}:d=${n(d)}[af]`);
    v = 'vf';
    a = 'af';
  }
  p.texts.forEach((t, j) => {
    const path = input.textPaths[j];
    if (!path || !t.text.trim() || t.start >= total) return;
    args.push('-i', path);
    filters.push(
      `[${v}][${idx}:v]overlay=0:0:enable='between(t,${n(t.start)},${n(Math.min(t.end, total))})'[t${j}]`,
    );
    v = `t${j}`;
    idx++;
  });
  const music = p.music;
  const musicPath = music ? input.paths.get(music.mediaId) : undefined;
  if (music && musicPath && music.volume > 0) {
    args.push('-stream_loop', '-1', '-ss', n(music.offset), '-i', musicPath);
    const fade = music.fadeOut && total > 3 ? `,afade=t=out:st=${n(total - 2)}:d=2` : '';
    filters.push(
      `[${idx}:a]atrim=duration=${n(total)},asetpts=PTS-STARTPTS,${AFMT},volume=${n(music.volume)}${fade}[mus]`,
    );
    // amix membagi volume dengan jumlah input; volume=2 mengembalikan level aslinya.
    filters.push(`[${a}][mus]amix=inputs=2:duration=first:dropout_transition=0,volume=2[am]`);
    a = 'am';
    idx++;
  }
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    `[${v}]`,
    '-map',
    `[${a}]`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-t',
    n(total),
    input.out,
  );
  return args;
}

/**
 * Batasi thread untuk banyak input. Setiap input (klip, PNG teks, musik) punya decoder sendiri;
 * tanpa batas masing-masing membuat thread sebanyak core dan kumpulan thread ffmpeg.wasm habis
 * (proses macet). Decoder cukup 1 thread; encoder dan filter memakai FFMPEG_THREADS.
 */
export function limitThreads(args: string[]): string[] {
  const out: string[] = [];
  for (const a of args) {
    if (a === '-i') out.push('-threads', '1');
    out.push(a);
  }
  const output = out.pop()!;
  return [
    '-filter_threads',
    FFMPEG_THREADS,
    '-filter_complex_threads',
    FFMPEG_THREADS,
    ...out,
    '-threads',
    FFMPEG_THREADS,
    output,
  ];
}

/** Font teks: sama dengan font situs agar pratinjau dan hasil terlihat sama. */
export const TEXT_FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';

/** Gambar satu lapisan teks ke konteks canvas berukuran w x h. */
export function drawText(ctx: CanvasRenderingContext2D, t: TextLayer, w: number, h: number): void {
  const L = textLayout(t, w, h);
  ctx.font = `800 ${L.font}px ${TEXT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(t.text, L.maxWidth, (s) => ctx.measureText(s).width);
  const lineH = L.font * 1.2;
  const blockH = lineH * lines.length;
  const top =
    L.baseline === 'top' ? L.y : L.baseline === 'middle' ? L.y - blockH / 2 : L.y - blockH;
  lines.forEach((line, i) => {
    const y = top + lineH * (i + 0.5);
    if (t.box && line) {
      const tw = ctx.measureText(line).width;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(L.x - tw / 2 - L.pad, y - lineH / 2, tw + L.pad * 2, lineH);
    }
    if (!t.box) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, L.font * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(line, L.x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(line, L.x, y);
  });
}

/** PNG transparan seukuran video berisi satu lapisan teks. */
export async function textPng(t: TextLayer, w: number, h: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('failed');
  await document.fonts?.ready;
  drawText(ctx, t, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('failed');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Apakah file video punya stream audio (dibaca dari log ffmpeg -i). */
export async function probeAudio(ff: FFmpeg, path: string): Promise<boolean> {
  const lines: string[] = [];
  const onLog = ({ message }: { message: string }) => lines.push(message);
  ff.on('log', onLog);
  try {
    await ff.exec(['-hide_banner', '-i', path]);
  } catch {
    // ffmpeg -i tanpa keluaran selalu "gagal"; yang dibutuhkan hanya lognya.
  } finally {
    ff.off('log', onLog);
  }
  return lines.some((l) => /Stream #\d+:\d+.*: Audio:/.test(l));
}

/**
 * Jalankan ekspor. files = File media per mediaId. onProgress menerima 0..1 dari waktu yang
 * dilaporkan ffmpeg dibanding durasi total.
 */
export async function exportVideo(
  ff: FFmpeg,
  p: Project,
  files: Map<string, File>,
  onProgress: (p: number) => void,
): Promise<Blob> {
  const { FFFSType } = await import('@ffmpeg/ffmpeg');
  const { w, h } = outputSize(p.settings.aspect, p.settings.quality);
  const total = totalDuration(p);
  const used = new Set([...p.clips.map((c) => c.mediaId), ...(p.music ? [p.music.mediaId] : [])]);
  // Nama file di sistem file ffmpeg memakai ID media agar tidak bentrok (File baru ini hanya
  // merujuk ke data yang sama, tidak menyalin isinya).
  const mounted: File[] = [];
  const paths = new Map<string, string>();
  for (const id of used) {
    const f = files.get(id);
    if (!f) throw new Error('missing-media');
    const ext = /\.([^.]+)$/.exec(f.name)?.[1]?.toLowerCase() ?? 'bin';
    const name = `${id}.${ext}`;
    mounted.push(new File([f], name, { type: f.type }));
    paths.set(id, `/edin/${name}`);
  }
  await ff.createDir('/edin').catch(() => {});
  await ff.createDir('/edtxt').catch(() => {});
  await ff.mount(FFFSType.WORKERFS, { files: mounted }, '/edin');
  const textPaths: string[] = [];
  const out = '/edtxt/hasil.mp4';
  const onLog = ({ message }: { message: string }) => {
    const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
    if (m && total > 0)
      onProgress(Math.min(1, (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / total));
  };
  try {
    const withAudio = new Set<string>();
    for (const c of p.clips) {
      const m = mediaOf(p, c.mediaId);
      if (m?.kind === 'video' && !withAudio.has(m.id) && (await probeAudio(ff, paths.get(m.id)!)))
        withAudio.add(m.id);
    }
    for (let j = 0; j < p.texts.length; j++) {
      const t = p.texts[j];
      if (!t.text.trim()) {
        textPaths.push('');
        continue;
      }
      const path = `/edtxt/t${j}.png`;
      await ff.writeFile(path, await textPng(t, w, h));
      textPaths.push(path);
    }
    const args = buildExportArgs(p, { paths, withAudio, textPaths, out });
    ff.on('log', onLog);
    const code = await ff.exec(limitThreads(args));
    if (code !== 0) throw new Error('failed');
    const data = (await ff.readFile(out)) as Uint8Array;
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });
  } finally {
    ff.off('log', onLog);
    for (const path of [...textPaths.filter(Boolean), out])
      await ff.deleteFile(path).catch(() => {});
    await ff.unmount('/edin').catch(() => {});
  }
}
