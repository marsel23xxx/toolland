import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { VENDOR } from '../vendor';

export type MediaErrorCode = 'memory' | 'unsupported' | 'failed' | 'cancelled';

/** Batas file media (PRD): 1 GB di semua perangkat. */
export const MAX_MEDIA_BYTES = 1024 ** 3;

/** Peringatan (bukan blokir) untuk file besar di perangkat dengan RAM kecil. */
export function lowMemoryWarning(size: number): boolean {
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return !!mem && mem <= 4 && size > 500 * 1024 ** 2;
}

/** Detik ke "m:ss" atau "h:mm:ss". */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Ekstensi file, misalnya "lagu.MP3" -> "mp3". */
export function extOf(name: string): string {
  return /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
}

/**
 * ffmpeg.wasm untuk satu komponen: dimuat saat pertama dipakai, file input di-mount lewat WORKERFS
 * (dibaca bertahap, tidak disalin utuh ke memori), dan bisa dibatalkan.
 */
export function useFfmpeg() {
  const progress = ref<number | null>(null);
  const loading = ref(false);
  const running = ref(false);
  const multiThread = ref(false);
  const ffmpeg = shallowRef<FFmpeg | null>(null);
  let loadPromise: Promise<FFmpeg> | null = null;
  let lastLog: string[] = [];

  function load(): Promise<FFmpeg> {
    loadPromise ??= (async () => {
      loading.value = true;
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const ff = new FFmpeg();
        ff.on('progress', ({ progress: p }) => {
          if (running.value && p >= 0 && p <= 1) progress.value = p * 100;
        });
        ff.on('log', ({ message }) => {
          lastLog.push(message);
          if (lastLog.length > 50) lastLog = lastLog.slice(-50);
        });
        // Multi-thread butuh SharedArrayBuffer (halaman dengan header COOP/COEP).
        const mt = globalThis.crossOriginIsolated === true;
        const base = new URL(mt ? VENDOR.ffmpegCoreMt : VENDOR.ffmpegCore, location.href).href;
        await ff.load({
          coreURL: `${base}ffmpeg-core.js`,
          wasmURL: `${base}ffmpeg-core.wasm`,
          ...(mt ? { workerURL: `${base}ffmpeg-core.worker.js` } : {}),
        });
        multiThread.value = mt;
        ffmpeg.value = ff;
        return ff;
      } catch (e) {
        loadPromise = null;
        throw e;
      } finally {
        loading.value = false;
      }
    })();
    return loadPromise;
  }

  /**
   * Jalankan ffmpeg. args menerima path input (di folder mount) dan mengembalikan argumen.
   * Hasil dibaca dari /out/<outName>.
   */
  async function run(
    file: File,
    args: (input: string) => string[],
    outName: string,
    mime: string,
  ): Promise<Blob> {
    const ff = await load();
    running.value = true;
    progress.value = 0;
    lastLog = [];
    const { FFFSType } = await import('@ffmpeg/ffmpeg');
    const inDir = '/in';
    const out = `/out/${outName}`;
    try {
      await ff.createDir(inDir).catch(() => {});
      await ff.createDir('/out').catch(() => {});
      await ff.mount(FFFSType.WORKERFS, { files: [file] }, inDir);
      const code = await ff.exec(args(`${inDir}/${file.name}`));
      if (code !== 0) throw new Error(classify(lastLog.join('\n')));
      const data = (await ff.readFile(out)) as Uint8Array;
      await ff.deleteFile(out).catch(() => {});
      return new Blob([data as Uint8Array<ArrayBuffer>], { type: mime });
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (['memory', 'unsupported', 'failed', 'cancelled'].includes(msg)) throw e;
      throw new Error(classify(`${msg}\n${lastLog.join('\n')}`), { cause: e });
    } finally {
      await ff.unmount(inDir).catch(() => {});
      running.value = false;
      progress.value = null;
    }
  }

  function classify(log: string): MediaErrorCode {
    if (
      /out of memory|memory access out of bounds|Cannot enlarge memory|RangeError|Array buffer allocation failed/i.test(
        log,
      )
    )
      return 'memory';
    if (
      /Invalid data found|could not find codec|does not contain any stream|Unknown input format|matches no streams/i.test(
        log,
      )
    )
      return 'unsupported';
    return 'failed';
  }

  /** Batalkan proses: worker ffmpeg dihentikan dan dimuat ulang saat dipakai lagi. */
  function cancel() {
    ffmpeg.value?.terminate();
    ffmpeg.value = null;
    loadPromise = null;
    running.value = false;
    progress.value = null;
  }

  onBeforeUnmount(() => ffmpeg.value?.terminate());
  return { progress, loading, running, multiThread, load, run, cancel };
}
