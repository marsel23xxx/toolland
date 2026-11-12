/**
 * Rekam layar di browser: getDisplayMedia (+ mikrofon) -> MediaRecorder -> file MP4/WebM.
 * Tidak ada yang dikirim ke server. Bagian murni (pilih format, nama file) dipisah agar bisa dites.
 */

export type RecQuality = 'standard' | 'high' | 'max';

/** Bitrate video MediaRecorder. 5 Mbps cukup tajam untuk teks di layar 1080p. */
export const REC_BITRATE: Record<RecQuality, number> = {
  standard: 2_500_000,
  high: 5_000_000,
  max: 8_000_000,
};

/**
 * MP4 (H.264) diutamakan karena bisa diputar dan diunggah di mana saja; Chrome/Edge baru dan
 * Safari mendukungnya. Firefox hanya bisa WebM.
 */
export const REC_TYPES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickRecType(isSupported: (t: string) => boolean): string {
  return REC_TYPES.find((t) => isSupported(t)) ?? '';
}

export function extForType(type: string): 'mp4' | 'webm' {
  return type.startsWith('video/mp4') ? 'mp4' : 'webm';
}

/** "rekaman-layar-2026-11-12-2105.mp4" (waktu lokal). */
export function recordingFileName(base: string, date: Date, ext: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  return `${base}-${d}-${p(date.getHours())}${p(date.getMinutes())}.${ext}`;
}

export function screenRecordSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Gabungkan suara layar dan mikrofon menjadi satu trek. MediaRecorder hanya merekam satu trek
 * audio, jadi dua sumber dicampur lewat Web Audio. Kembalikan trek dan fungsi untuk menutupnya.
 */
export function mixAudio(tracks: MediaStreamTrack[]): {
  track: MediaStreamTrack | null;
  close: () => void;
} {
  if (tracks.length <= 1) return { track: tracks[0] ?? null, close: () => {} };
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  for (const t of tracks) ctx.createMediaStreamSource(new MediaStream([t])).connect(dest);
  return { track: dest.stream.getAudioTracks()[0], close: () => void ctx.close() };
}

/** Batas remux: di atas ini file mentah langsung dipakai agar memori tidak terpakai dua kali. */
const MAX_REMUX = 1024 ** 3;

/**
 * Rapikan hasil MediaRecorder tanpa encode ulang. File mentahnya sering tidak mencatat durasi,
 * sehingga di banyak pemutar tidak bisa digeser (seek). Disalin ulang ke MP4/WebM biasa lewat
 * mediabunny; bila gagal, file mentah tetap dipakai.
 */
export async function finalizeRecording(blob: Blob): Promise<Blob> {
  if (blob.size > MAX_REMUX) return blob;
  try {
    const mb = await import('mediabunny');
    const mp4 = extForType(blob.type) === 'mp4';
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS });
    const target = new mb.BufferTarget();
    const output = new mb.Output({
      format: mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(),
      target,
    });
    try {
      const conv = await mb.Conversion.init({ input, output });
      if (!conv.isValid) return blob;
      await conv.execute();
      return target.buffer
        ? new Blob([target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' })
        : blob;
    } finally {
      input[Symbol.dispose]();
    }
  } catch (e) {
    console.warn('[rekam-layar] remux gagal, memakai file mentah', e);
    return blob;
  }
}
