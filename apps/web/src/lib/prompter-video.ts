/**
 * Ekspor teleprompter menjadi video: teks bergulir digambar frame demi frame ke canvas, lalu
 * di-encode menjadi MP4 dengan WebCodecs (lewat mediabunny). Lebih cepat dari durasi videonya
 * karena tidak perlu menunggu waktu nyata, dan tidak ada yang diunggah ke server.
 */

export interface PrompterVideoOptions {
  text: string;
  width: number;
  height: number;
  fps: number;
  /** Ukuran huruf dalam piksel video. */
  fontPx: number;
  /** Lebar area teks, persen dari lebar video. */
  textWidthPct: number;
  align: 'left' | 'center';
  theme: 'dark' | 'light';
  mirror: boolean;
  flip: boolean;
  guide: boolean;
  /** Kecepatan gulir dalam piksel video per detik. */
  pxPerSec: number;
  /** Jeda diam di awal dan akhir (detik). */
  holdStart: number;
  holdEnd: number;
}

export const LINE_HEIGHT = 1.5;
/** Posisi garis baca dari atas (sama dengan tampilan di halaman). */
export const GUIDE_AT = 0.4;
const FONT = "'Plus Jakarta Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const fontOf = (px: number) => `600 ${px}px ${FONT}`;

/**
 * Pecah naskah menjadi baris yang muat di `maxWidth`. Enter di naskah dipertahankan, baris kosong
 * menjadi string kosong. Kata yang lebih panjang dari satu baris dipotong per huruf.
 */
export function wrapLines(
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (measure(next) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      if (measure(word) <= maxWidth) {
        line = word;
        continue;
      }
      // Kata sangat panjang: potong per huruf.
      let piece = '';
      for (const ch of word) {
        if (piece && measure(piece + ch) > maxWidth) {
          out.push(piece);
          piece = ch;
        } else piece += ch;
      }
      line = piece;
    }
    if (line) out.push(line);
  }
  // Buang baris kosong di awal dan akhir naskah.
  while (out.length && !out[0]) out.shift();
  while (out.length && !out[out.length - 1]) out.pop();
  return out;
}

export interface Plan {
  lineH: number;
  /** Jarak gulir total (piksel) dari baris pertama sampai baris terakhir di garis baca. */
  distance: number;
  /** Durasi video (detik) dan jumlah frame. */
  duration: number;
  frames: number;
}

export function planVideo(o: PrompterVideoOptions, lineCount: number): Plan {
  const lineH = o.fontPx * LINE_HEIGHT;
  const distance = Math.max(0, lineCount - 1) * lineH;
  const duration = o.holdStart + distance / Math.max(1, o.pxPerSec) + o.holdEnd;
  return { lineH, distance, duration, frames: Math.max(1, Math.ceil(duration * o.fps)) };
}

/** Posisi gulir (piksel) pada detik ke-t: diam, bergulir rata, lalu diam lagi. */
export function scrollAt(t: number, o: PrompterVideoOptions, plan: Plan): number {
  const moving = Math.max(0, t - o.holdStart);
  return Math.min(plan.distance, moving * o.pxPerSec);
}

const COLORS = {
  dark: { bg: '#0b0b0d', fg: '#f5f1e8' },
  light: { bg: '#ffffff', fg: '#111111' },
};

/** Gambar satu frame: latar, teks, garis baca, dan pudar di atas/bawah. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  o: PrompterVideoOptions,
  lines: string[],
  plan: Plan,
  y: number,
) {
  const { width: W, height: H } = o;
  const c = COLORS[o.theme];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  // Cermin dan balik atas-bawah: seluruh isi frame ikut dibalik, sama seperti di halaman.
  ctx.setTransform(o.mirror ? -1 : 1, 0, 0, o.flip ? -1 : 1, o.mirror ? W : 0, o.flip ? H : 0);

  const gY = H * GUIDE_AT;
  if (o.guide) {
    ctx.fillStyle = 'rgba(234, 181, 77, 0.10)';
    ctx.fillRect(0, gY - plan.lineH * 0.55, W, plan.lineH * 1.1);
    ctx.fillStyle = 'rgba(234, 181, 77, 0.7)';
    const t = Math.max(2, H / 360);
    ctx.fillRect(0, gY - plan.lineH * 0.55 - t, W, t);
    ctx.fillRect(0, gY + plan.lineH * 0.55, W, t);
  }

  const boxW = (W * o.textWidthPct) / 100;
  const left = (W - boxW) / 2;
  ctx.font = fontOf(o.fontPx);
  ctx.fillStyle = c.fg;
  ctx.textBaseline = 'middle';
  ctx.textAlign = o.align === 'center' ? 'center' : 'left';
  const x = o.align === 'center' ? W / 2 : left;
  const first = Math.max(0, Math.floor((y - gY) / plan.lineH) - 1);
  for (let i = first; i < lines.length; i++) {
    const cy = gY + i * plan.lineH - y;
    if (cy > H + plan.lineH) break;
    if (cy < -plan.lineH || !lines[i]) continue;
    ctx.fillText(lines[i], x, cy);
  }

  // Pudar di tepi atas dan bawah.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fade = H * 0.12;
  for (const [y0, y1] of [
    [0, fade],
    [H, H - fade],
  ]) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c.bg);
    g.addColorStop(1, `${c.bg}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y1), W, fade);
  }
}

export class VideoUnsupportedError extends Error {
  constructor() {
    super('unsupported');
  }
}

/** Siapkan canvas dan baris teks sesuai opsi (huruf web dimuat dulu agar ukuran tepat). */
export async function prepare(o: PrompterVideoOptions) {
  if ('fonts' in document) await document.fonts.load(fontOf(o.fontPx)).catch(() => undefined);
  const canvas = document.createElement('canvas');
  canvas.width = o.width;
  canvas.height = o.height;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.font = fontOf(o.fontPx);
  const lines = wrapLines(
    o.text,
    (s) => ctx.measureText(s).width,
    (o.width * o.textWidthPct) / 100 - o.fontPx,
  );
  return { canvas, ctx, lines, plan: planVideo(o, lines.length) };
}

/**
 * Render dan encode video MP4. `onProgress` menerima 0-1. Batalkan dengan AbortSignal.
 * Melempar VideoUnsupportedError bila browser tidak mendukung encode video (WebCodecs).
 */
export async function renderPrompterVideo(
  o: PrompterVideoOptions,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') throw new VideoUnsupportedError();
  const mb = await import('mediabunny');
  let codec: 'avc' | 'vp9' | 'av1' | undefined;
  for (const c of ['avc', 'vp9', 'av1'] as const) {
    if (await mb.canEncodeVideo(c, { width: o.width, height: o.height, frameRate: o.fps })) {
      codec = c;
      break;
    }
  }
  if (!codec) throw new VideoUnsupportedError();

  const { canvas, ctx, lines, plan } = await prepare(o);
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const source = new mb.CanvasSource(canvas, { codec, quality: mb.QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: o.fps });
  await output.start();
  try {
    for (let f = 0; f < plan.frames; f++) {
      if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
      const t = f / o.fps;
      drawFrame(ctx, o, lines, plan, scrollAt(t, o, plan));
      await source.add(t, 1 / o.fps);
      if (f % 10 === 0) onProgress?.(f / plan.frames);
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  onProgress?.(1);
  const buf = (output.target as InstanceType<typeof mb.BufferTarget>).buffer!;
  return new Blob([buf], { type: 'video/mp4' });
}

/** Perkiraan durasi video (detik) tanpa merender, untuk ditampilkan sebelum ekspor. */
export function estimateDuration(o: PrompterVideoOptions): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  ctx.font = fontOf(o.fontPx);
  const lines = wrapLines(
    o.text,
    (s) => ctx.measureText(s).width,
    (o.width * o.textWidthPct) / 100 - o.fontPx,
  );
  return planVideo(o, lines.length).duration;
}
