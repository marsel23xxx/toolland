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
  type Overlay,
  type Project,
  type TextLayer,
  DUCK_LEVEL,
  DUCK_RAMP,
  XFADE,
  clipFades,
  clipStarts,
  isOverlap,
  overlayLength,
  overlayPixels,
  transitionOverlap,
  clipLength,
  musicSpan,
  voicedSpans,
  mediaOf,
  outputSize,
  textLayout,
  totalDuration,
  wrapText,
} from './project';
import { atempoChain, colorFilter, geometryFilter, orientFilter } from './look';
import { fontCss, textOverlay } from './textfx';

export interface ExportInput {
  /** Path file media di sistem file ffmpeg, per mediaId. */
  paths: Map<string, string>;
  /** mediaId video yang punya audio. */
  withAudio: Set<string>;
  /** Path PNG teks, sejajar dengan project.texts (kosong = teks dilewati). */
  textPaths: string[];
  /** Path PNG stiker/bentuk, sejajar dengan project.overlays (kosong untuk overlay media). */
  overlayPaths?: string[];
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
  const fps = p.settings.fps || FPS;
  const bg = /^#[0-9a-f]{6}$/i.test(p.settings.bg) ? `0x${p.settings.bg.slice(1)}` : 'black';
  p.clips.forEach((c, k) => {
    const m = mediaOf(p, c.mediaId);
    const path = input.paths.get(c.mediaId);
    if (!m || !path) throw new Error('missing-media');
    const len = clipLength(c);
    const speed = m.kind === 'video' ? c.speed || 1 : 1;
    if (m.kind === 'image')
      args.push('-loop', '1', '-framerate', String(fps), '-t', n(len), '-i', path);
    else args.push('-ss', n(c.in), '-t', n(len * speed), '-i', path);

    // Gambar: putar/balik, lalu masuk bingkai (pas + latar warna, penuhi, atau di atas latar blur).
    const orient = orientFilter(c);
    const pre = orient ? `${orient},` : '';
    let head: string;
    if (c.fit === 'blur') {
      const r = Math.max(4, Math.round(Math.min(w, h) / 36));
      filters.push(`[${idx}:v]${pre}split[ka${k}][kb${k}]`);
      filters.push(
        `[ka${k}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=${r}:2[kg${k}]`,
      );
      filters.push(`[kb${k}]scale=${w}:${h}:force_original_aspect_ratio=decrease[kf${k}]`);
      filters.push(`[kg${k}][kf${k}]overlay=(W-w)/2:(H-h)/2[g${k}]`);
      head = `[g${k}]`;
    } else if (c.fit === 'fill')
      head = `[${idx}:v]${pre}scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},`;
    else
      head = `[${idx}:v]${pre}scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${bg},`;

    const parts = ['setsar=1'];
    if (speed !== 1) parts.push(`setpts=(PTS-STARTPTS)/${n(speed)}`);
    parts.push(`fps=${fps}`);
    const geo = geometryFilter(c, w, h, fps, Math.round(len * fps));
    if (geo) parts.push(geo);
    const color = colorFilter(c);
    if (color) parts.push(color);
    parts.push('format=yuv420p', `trim=duration=${n(len)}`, 'setpts=PTS-STARTPTS');

    // Transisi: pudar ke/dari hitam atau putih di batas klip, audio ikut memudar.
    const f = clipFades(p, k);
    if (f.in) parts.push(`fade=t=in:st=0:d=${n(f.in)}:color=${f.inColor}`);
    if (f.out) parts.push(`fade=t=out:st=${n(len - f.out)}:d=${n(f.out)}:color=${f.outColor}`);
    filters.push(`${head}${parts.join(',')}[v${k}]`);

    if (m.kind === 'video' && input.withAudio.has(c.mediaId) && c.volume > 0) {
      const a = [
        `atrim=duration=${n(len * speed)}`,
        'asetpts=PTS-STARTPTS',
        AFMT,
        atempoChain(speed),
        'apad',
        `atrim=duration=${n(len)}`,
        `volume=${n(c.volume)}`,
      ];
      const fi = Math.min(c.fadeIn, len);
      const fo = Math.min(c.fadeOut, len);
      if (fi > 0) a.push(`afade=t=in:st=0:d=${n(fi)}`);
      if (fo > 0) a.push(`afade=t=out:st=${n(len - fo)}:d=${n(fo)}`);
      if (f.in) a.push(`afade=t=in:st=0:d=${n(f.in)}`);
      if (f.out) a.push(`afade=t=out:st=${n(len - f.out)}:d=${n(f.out)}`);
      filters.push(`[${idx}:a]${a.filter(Boolean).join(',')}[a${k}]`);
    } else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${n(len)},${AFMT}[a${k}]`);
    concatIn.push(`[v${k}][a${k}]`);
    idx++;
  });
  // Klip disambung per kelompok (concat); di batas transisi bertumpuk kelompok digabung dengan
  // xfade (video) dan acrossfade (audio), sehingga durasi berkurang sebesar tumpukan.
  const starts = clipStarts(p);
  const groups: number[][] = [[0]];
  for (let k = 1; k < p.clips.length; k++) {
    if (transitionOverlap(p, k - 1) > 0) groups.push([k]);
    else groups[groups.length - 1].push(k);
  }
  groups.forEach((g, j) => {
    const ins = g.map((k) => concatIn[k]).join('');
    filters.push(`${ins}concat=n=${g.length}:v=1:a=1[gv${j}][ga${j}]`);
  });
  if (groups.length === 1) {
    filters[filters.length - 1] = filters[filters.length - 1].replace('[gv0][ga0]', '[vc][ac]');
  } else {
    let accV = 'gv0';
    let accA = 'ga0';
    for (let j = 1; j < groups.length; j++) {
      const k = groups[j][0];
      const d = transitionOverlap(p, k - 1);
      const kind = p.clips[k - 1].trans;
      const xf = isOverlap(kind) ? XFADE[kind] : 'fade';
      const outV = j === groups.length - 1 ? 'vc' : `xv${j}`;
      const outA = j === groups.length - 1 ? 'ac' : `xa${j}`;
      filters.push(
        `[${accV}]settb=AVTB[xva${j}];[gv${j}]settb=AVTB[xvb${j}];[xva${j}][xvb${j}]xfade=transition=${xf}:duration=${n(d)}:offset=${n(starts[k])}[${outV}]`,
      );
      filters.push(`[${accA}][ga${j}]acrossfade=d=${n(d)}:c1=tri:c2=tri[${outA}]`);
      accV = outV;
      accA = outA;
    }
  }
  let v = 'vc';
  let a = 'ac';
  if (p.settings.fade && total > 1.5) {
    const d = Math.min(0.6, total / 4);
    filters.push(`[${v}]fade=t=in:st=0:d=${n(d)},fade=t=out:st=${n(total - d)}:d=${n(d)}[vf]`);
    filters.push(`[${a}]afade=t=in:st=0:d=${n(d)},afade=t=out:st=${n(total - d)}:d=${n(d)}[af]`);
    v = 'vf';
    a = 'af';
  }
  // Overlay: di atas video utama, di bawah teks. Audio overlay video ikut dicampur.
  const extraAudio: string[] = [];
  p.overlays.forEach((o, j) => {
    const len = overlayLength(o);
    if (len <= 0.01 || o.start >= total) return;
    const end = Math.min(o.start + len, total);
    const m = o.kind === 'media' ? mediaOf(p, o.mediaId) : undefined;
    if (o.kind === 'media') {
      const path = input.paths.get(o.mediaId);
      if (!m || !path) throw new Error('missing-media');
      if (m.kind === 'video') args.push('-ss', n(o.in), '-t', n(end - o.start), '-i', path);
      else args.push('-loop', '1', '-framerate', String(fps), '-t', n(end - o.start), '-i', path);
    } else {
      const path = input.overlayPaths?.[j];
      if (!path) return;
      args.push('-loop', '1', '-framerate', String(fps), '-t', n(end - o.start), '-i', path);
    }
    const { pw, ph } = overlayPixels(o, w);
    const chain = [`scale=${pw}:${ph}`, 'setsar=1', `fps=${fps}`, 'format=rgba'];
    if (o.opacity < 1) chain.push(`colorchannelmixer=aa=${n(o.opacity)}`);
    if (o.rotate) {
      const r = `${n(o.rotate)}*PI/180`;
      chain.push(`rotate=${r}:c=none:ow=rotw(${r}):oh=roth(${r})`);
    }
    const olen = end - o.start;
    if (o.fadeIn > 0) chain.push(`fade=t=in:st=0:d=${n(Math.min(o.fadeIn, olen))}:alpha=1`);
    if (o.fadeOut > 0) {
      const d = Math.min(o.fadeOut, olen);
      chain.push(`fade=t=out:st=${n(olen - d)}:d=${n(d)}:alpha=1`);
    }
    chain.push(`setpts=PTS-STARTPTS+${n(o.start)}/TB`);
    filters.push(`[${idx}:v]${chain.join(',')}[ov${j}]`);
    filters.push(
      `[${v}][ov${j}]overlay=x=${n(o.x)}*W-w/2:y=${n(o.y)}*H-h/2:eof_action=pass:enable='between(t,${n(o.start)},${n(end)})'[o${j}]`,
    );
    v = `o${j}`;
    if (m?.kind === 'video' && o.volume > 0 && input.withAudio.has(m.id)) {
      const a = [
        `atrim=duration=${n(olen)}`,
        'asetpts=PTS-STARTPTS',
        AFMT,
        `volume=${n(o.volume)}`,
      ];
      if (o.start > 0) a.push(`adelay=delays=${Math.round(o.start * 1000)}:all=1`);
      a.push('apad', `atrim=duration=${n(total)}`);
      filters.push(`[${idx}:a]${a.join(',')}[oa${j}]`);
      extraAudio.push(`[oa${j}]`);
    }
    idx++;
  });

  p.texts.forEach((t, j) => {
    const path = input.textPaths[j];
    if (!path || !t.text.trim() || t.start >= total) return;
    // PNG diulang selama teks tampil; animasi = fade alpha + posisi overlay berdasarkan waktu.
    const end = Math.min(t.end, total);
    args.push('-loop', '1', '-framerate', String(fps), '-t', n(end - t.start), '-i', path);
    const o = textOverlay(t, end);
    filters.push(`[${idx}:v]${o.chain}[tx${j}]`);
    filters.push(
      `[${v}][tx${j}]overlay=x=${o.x}:y=${o.y}:eof_action=pass:enable='between(t,${n(t.start)},${n(end)})'[t${j}]`,
    );
    v = `t${j}`;
    idx++;
  });
  // Audio tambahan (narasi, efek suara).
  p.audios.forEach((au, j) => {
    const path = input.paths.get(au.mediaId);
    if (!path) throw new Error('missing-media');
    const len = Math.min(au.out - au.in, total - au.start);
    if (len <= 0.01 || au.volume <= 0) return;
    args.push('-ss', n(au.in), '-t', n(len), '-i', path);
    const c = [`atrim=duration=${n(len)}`, 'asetpts=PTS-STARTPTS', AFMT, `volume=${n(au.volume)}`];
    if (au.fadeIn > 0) c.push(`afade=t=in:st=0:d=${n(Math.min(au.fadeIn, len))}`);
    if (au.fadeOut > 0) {
      const d = Math.min(au.fadeOut, len);
      c.push(`afade=t=out:st=${n(len - d)}:d=${n(d)}`);
    }
    if (au.start > 0) c.push(`adelay=delays=${Math.round(au.start * 1000)}:all=1`);
    c.push('apad', `atrim=duration=${n(total)}`);
    filters.push(`[${idx}:a]${c.join(',')}[xa${j}x]`);
    extraAudio.push(`[xa${j}x]`);
    idx++;
  });

  const music = p.music;
  const musicPath = music ? input.paths.get(music.mediaId) : undefined;
  const span = music ? musicSpan(music, total) : { start: 0, end: 0 };
  if (music && musicPath && music.volume > 0 && span.end - span.start > 0.05) {
    args.push('-stream_loop', '-1', '-ss', n(music.offset), '-i', musicPath);
    const slen = span.end - span.start;
    const m = [
      `atrim=duration=${n(slen)}`,
      'asetpts=PTS-STARTPTS',
      AFMT,
      `volume=${n(music.volume)}`,
    ];
    if (music.duck) {
      // Musik mengecil saat klip bersuara; t di sini dihitung dari awal musik.
      const f = voicedSpans(p, input.withAudio).map(
        ([a, b]) =>
          `(1-${n(1 - DUCK_LEVEL)}*clip(min((t+${n(span.start)}-${n(a)})/${DUCK_RAMP}\\,(${n(b)}-t-${n(span.start)})/${DUCK_RAMP})\\,0\\,1))`,
      );
      if (f.length) m.push(`volume='${f.join('*')}':eval=frame`);
    }
    if (music.fadeIn > 0) m.push(`afade=t=in:st=0:d=${n(Math.min(music.fadeIn, slen))}`);
    if (music.fadeOut > 0) {
      const d = Math.min(music.fadeOut, slen);
      m.push(`afade=t=out:st=${n(slen - d)}:d=${n(d)}`);
    }
    if (span.start > 0) m.push(`adelay=delays=${Math.round(span.start * 1000)}:all=1`);
    m.push('apad', `atrim=duration=${n(total)}`);
    filters.push(`[${idx}:a]${m.join(',')}[mus]`);
    extraAudio.push('[mus]');
    idx++;
  }
  if (extraAudio.length) {
    // Semua input dipanjangkan sampai akhir (apad), jadi amix membagi volume dengan jumlah input
    // secara tetap; volume=N mengembalikan level aslinya.
    const k = extraAudio.length + 1;
    filters.push(
      `[${a}]${extraAudio.join('')}amix=inputs=${k}:duration=first:dropout_transition=0,volume=${k}[am]`,
    );
    a = 'am';
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
    String(fps),
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
  ctx.font = fontCss(t.font, L.font);
  ctx.textBaseline = 'middle';
  const lines = wrapText(t.text, L.maxWidth, (s) => ctx.measureText(s).width);
  const widths = lines.map((l) => ctx.measureText(l).width);
  const blockW = Math.max(0, ...widths);
  const lineH = L.font * 1.25;
  const blockH = lineH * lines.length;
  const top =
    L.baseline === 'top' ? L.y : L.baseline === 'middle' ? L.y - blockH / 2 : L.y - blockH;
  const align = t.align ?? 'center';
  // Baris rata kiri/kanan di dalam blok yang titik tengahnya tetap di L.x.
  const ax = align === 'left' ? L.x - blockW / 2 : align === 'right' ? L.x + blockW / 2 : L.x;
  ctx.textAlign = align;
  // Kepekatan dari luar (animasi pratinjau) tetap dihormati.
  const a0 = ctx.globalAlpha;
  lines.forEach((line, i) => {
    if (!line) return;
    const y = top + lineH * (i + 0.5);
    const tw = widths[i];
    const left = align === 'left' ? ax : align === 'right' ? ax - tw : ax - tw / 2;
    if (t.box) {
      ctx.globalAlpha = a0 * Math.max(0, Math.min(1, t.boxOpacity ?? 0.6));
      ctx.fillStyle = t.boxColor ?? '#000000';
      ctx.fillRect(left - L.pad, y - lineH / 2, tw + L.pad * 2, lineH);
      ctx.globalAlpha = a0;
    }
    ctx.save();
    if (t.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = L.font * 0.18;
      ctx.shadowOffsetY = L.font * 0.06;
    }
    if (t.stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, L.font * 0.12);
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(line, ax, y);
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = t.color;
    ctx.fillText(line, ax, y);
    ctx.restore();
  });
}

/** Gambar stiker emoji atau bentuk memenuhi kanvas w x h. */
export function drawSticker(ctx: CanvasRenderingContext2D, o: Overlay, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  if (o.kind === 'emoji') {
    const size = Math.min(w, h) * 0.86;
    ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.char, w / 2, h / 2 + size * 0.04);
    return;
  }
  ctx.fillStyle = o.fill;
  ctx.beginPath();
  if (o.shape === 'circle') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (o.shape === 'round') ctx.roundRect(0, 0, w, h, Math.min(w, h) * 0.18);
  else ctx.rect(0, 0, w, h);
  ctx.fill();
}

/** PNG stiker/bentuk berukuran pw x ph. */
export async function stickerPng(o: Overlay, pw: number, ph: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('failed');
  drawSticker(ctx, o, pw, ph);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('failed');
  return new Uint8Array(await blob.arrayBuffer());
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
  const used = new Set([
    ...p.clips.map((c) => c.mediaId),
    ...p.overlays.filter((o) => o.kind === 'media').map((o) => o.mediaId),
    ...p.audios.map((a) => a.mediaId),
    ...(p.music ? [p.music.mediaId] : []),
  ]);
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
  const overlayPaths: string[] = [];
  const out = '/edtxt/hasil.mp4';
  const onLog = ({ message }: { message: string }) => {
    const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
    if (m && total > 0)
      onProgress(Math.min(1, (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) / total));
  };
  try {
    const withAudio = new Set<string>();
    for (const c of [...p.clips, ...p.overlays.filter((o) => o.kind === 'media')]) {
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
    for (let j = 0; j < p.overlays.length; j++) {
      const o = p.overlays[j];
      if (o.kind === 'media') {
        overlayPaths.push('');
        continue;
      }
      const { pw, ph } = overlayPixels(o, w);
      const path = `/edtxt/o${j}.png`;
      await ff.writeFile(path, await stickerPng(o, pw, ph));
      overlayPaths.push(path);
    }
    const args = buildExportArgs(p, { paths, withAudio, textPaths, overlayPaths, out });
    ff.on('log', onLog);
    const code = await ff.exec(limitThreads(args));
    if (code !== 0) throw new Error('failed');
    const data = (await ff.readFile(out)) as Uint8Array;
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: 'video/mp4' });
  } finally {
    ff.off('log', onLog);
    for (const path of [...textPaths.filter(Boolean), ...overlayPaths.filter(Boolean), out])
      await ff.deleteFile(path).catch(() => {});
    await ff.unmount('/edin').catch(() => {});
  }
}
