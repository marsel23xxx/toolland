/**
 * Blur latar kamera di browser: MediaPipe Selfie Segmenter (Apache-2.0, model ±250 KB, WASM
 * di-host sendiri di /vendor/mediapipe) memisahkan orang dari latar setiap frame, lalu latar
 * digambar ulang dengan blur dan orang ditempel di atasnya. Hasilnya track video baru dari
 * canvas.captureStream() yang dikirim ke peserta lain; video asli tidak pernah dikirim.
 */
import type { ImageSegmenter } from '@mediapipe/tasks-vision';
import { VENDOR } from '../vendor';

const FPS = 24;
let segmenterP: Promise<ImageSegmenter> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(`${VENDOR.mediapipe}wasm`);
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${VENDOR.mediapipe}selfie_segmenter.tflite`, delegate },
    runningMode: 'VIDEO',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

/** Segmenter dibuat sekali per halaman; GPU dulu, CPU bila WebGL tidak tersedia. */
function segmenter(): Promise<ImageSegmenter> {
  segmenterP ??= create('GPU').catch(() => create('CPU'));
  segmenterP.catch(() => (segmenterP = null));
  return segmenterP;
}

/** Isi kanal alfa ImageData dari masker kepercayaan (0..1) MediaPipe. */
export function maskToAlpha(mask: Float32Array, out: Uint8ClampedArray) {
  for (let i = 0, j = 3; i < mask.length; i++, j += 4) out[j] = mask[i] * 255;
}

export class BackgroundBlur {
  readonly track: MediaStreamTrack;
  private video = document.createElement('video');
  private canvas = document.createElement('canvas');
  private person = document.createElement('canvas');
  private maskCanvas = document.createElement('canvas');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private lastTs = 0;
  private mask: ImageData | null = null;

  private constructor(
    private seg: ImageSegmenter,
    input: MediaStreamTrack,
  ) {
    const { width = 640, height = 480 } = input.getSettings();
    for (const c of [this.canvas, this.person]) {
      c.width = width;
      c.height = height;
    }
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = new MediaStream([input]);
    this.track = this.canvas.captureStream(FPS).getVideoTracks()[0];
  }

  static async start(input: MediaStreamTrack): Promise<BackgroundBlur> {
    const b = new BackgroundBlur(await segmenter(), input);
    await b.video.play();
    b.loop();
    return b;
  }

  private loop = () => {
    if (this.stopped) return;
    try {
      this.frame();
    } catch {
      // Satu frame gagal (misalnya kamera berganti ukuran) tidak menghentikan blur.
    }
    this.timer = setTimeout(this.loop, 1000 / FPS);
  };

  private frame() {
    const v = this.video;
    if (v.readyState < 2 || !v.videoWidth) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      for (const c of [this.canvas, this.person]) {
        c.width = w;
        c.height = h;
      }
    }
    const ts = Math.max(performance.now(), this.lastTs + 1);
    this.lastTs = ts;
    this.seg.segmentForVideo(v, ts, (result) => {
      const m = result.confidenceMasks?.[0];
      if (!m) return;
      if (this.maskCanvas.width !== m.width || this.maskCanvas.height !== m.height) {
        this.maskCanvas.width = m.width;
        this.maskCanvas.height = m.height;
        this.mask = new ImageData(m.width, m.height);
      }
      maskToAlpha(m.getAsFloat32Array(), this.mask!.data);
      this.maskCanvas.getContext('2d')!.putImageData(this.mask!, 0, 0);
    });

    const ctx = this.canvas.getContext('2d')!;
    // Latar: frame yang diblur, sedikit diperbesar agar tepi blur tidak gelap.
    ctx.filter = 'blur(14px)';
    ctx.drawImage(v, -20, -20, w + 40, h + 40);
    ctx.filter = 'none';
    if (!this.mask) return;
    // Orang: masker (tepi dihaluskan) lalu frame asli hanya di bagian masker.
    const p = this.person.getContext('2d')!;
    p.globalCompositeOperation = 'copy';
    p.filter = 'blur(2px)';
    p.drawImage(this.maskCanvas, 0, 0, w, h);
    p.filter = 'none';
    p.globalCompositeOperation = 'source-in';
    p.drawImage(v, 0, 0, w, h);
    p.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.person, 0, 0);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.track.stop();
    this.video.srcObject = null;
  }
}
