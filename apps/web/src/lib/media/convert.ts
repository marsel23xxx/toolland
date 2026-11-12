/**
 * Argumen ffmpeg untuk Konversi Audio dan Konversi Video. Fungsi murni agar bisa dites tanpa
 * ffmpeg.wasm; komponen tinggal memanggil `ff.run(file, (input) => audioArgs(...), ...)`.
 */

export type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'flac' | 'opus';
export type AudioQuality = 'standard' | 'high' | 'max';

export const AUDIO_FORMATS: AudioFormat[] = ['mp3', 'm4a', 'wav', 'flac', 'opus'];

export const AUDIO_MIME: Record<AudioFormat, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  flac: 'audio/flac',
  opus: 'audio/ogg',
};

/** Format tanpa kompresi (WAV) dan lossless (FLAC) tidak punya pilihan kualitas. */
export function hasQuality(format: AudioFormat): boolean {
  return format === 'mp3' || format === 'm4a' || format === 'opus';
}

/** Bitrate per kualitas. Opus jauh lebih efisien, jadi angkanya lebih kecil untuk mutu setara. */
const BITRATE: Record<'mp3' | 'm4a' | 'opus', Record<AudioQuality, string>> = {
  mp3: { standard: '128k', high: '192k', max: '320k' },
  m4a: { standard: '128k', high: '192k', max: '256k' },
  opus: { standard: '64k', high: '96k', max: '160k' },
};

export function bitrateOf(format: AudioFormat, quality: AudioQuality): string | null {
  return hasQuality(format) ? BITRATE[format as 'mp3' | 'm4a' | 'opus'][quality] : null;
}

function audioCodec(format: AudioFormat, quality: AudioQuality): string[] {
  switch (format) {
    case 'mp3':
      return ['-c:a', 'libmp3lame', '-b:a', bitrateOf(format, quality)!];
    case 'm4a':
      return ['-c:a', 'aac', '-b:a', bitrateOf(format, quality)!, '-movflags', '+faststart'];
    case 'opus':
      // Opus hanya menerima 48/24/16/12/8 kHz; biarkan ffmpeg memilih yang terdekat.
      return ['-c:a', 'libopus', '-b:a', bitrateOf(format, quality)!, '-vbr', 'on'];
    case 'wav':
      return ['-c:a', 'pcm_s16le'];
    case 'flac':
      return ['-c:a', 'flac', '-compression_level', '5'];
  }
}

/** Ambil trek audio pertama (sampul album dan video dibuang) lalu encode ke format tujuan. */
export function audioArgs(
  input: string,
  format: AudioFormat,
  quality: AudioQuality,
  out: string,
): string[] {
  return ['-i', input, '-map', '0:a:0', '-vn', ...audioCodec(format, quality), out];
}

export type VideoFormat = 'mp4' | 'webm';

/** Codec hasil deteksi (nama dari mediabunny), null bila tidak terbaca. */
export interface Codecs {
  video: string | null;
  audio: string | null;
}

/**
 * Apakah video cukup disalin tanpa encode ulang. Lebih cepat dan kualitasnya persis asli, tapi hanya
 * untuk codec yang bisa diputar di mana saja dalam wadah tujuan: H.264 untuk MP4, VP8/VP9 untuk
 * WebM. HEVC (video iPhone) sengaja diubah ke H.264 karena banyak laptop dan aplikasi tidak bisa
 * memutarnya.
 */
export function canCopyVideo(format: VideoFormat, codecs: Codecs | null): boolean {
  const v = codecs?.video;
  return format === 'mp4' ? v === 'avc' : v === 'vp8' || v === 'vp9';
}

function canCopyAudio(format: VideoFormat, codecs: Codecs | null): boolean {
  const a = codecs?.audio;
  return format === 'mp4' ? a === 'aac' : a === 'opus' || a === 'vorbis';
}

/** Dimensi genap wajib untuk H.264 4:2:0 dan VP8; video dari layar kadang berukuran ganjil. */
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

export function videoArgs(
  input: string,
  format: VideoFormat,
  codecs: Codecs | null,
  out: string,
): string[] {
  const copyV = canCopyVideo(format, codecs);
  const copyA = canCopyAudio(format, codecs);
  const map = ['-map', '0:v:0', '-map', '0:a:0?'];
  let video: string[];
  let audio: string[];
  if (format === 'mp4') {
    video = copyV
      ? ['-c:v', 'copy']
      : [
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          // Hemat memori WebAssembly, sama seperti Kompres Video.
          '-x264-params',
          'rc-lookahead=5',
          // CRF 20: hampir tidak terlihat bedanya dengan aslinya. Tujuan tool ini ganti format, bukan kompres.
          '-crf',
          '20',
          '-vf',
          EVEN,
          '-pix_fmt',
          'yuv420p',
        ];
    audio = copyA ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '192k'];
    return ['-i', input, ...map, ...video, ...audio, '-movflags', '+faststart', out];
  }
  video = copyV
    ? ['-c:v', 'copy']
    : [
        // VP8 dipilih ketimbang VP9: di ffmpeg.wasm VP9 berkali-kali lebih lambat.
        '-c:v',
        'libvpx',
        '-deadline',
        'realtime',
        '-cpu-used',
        '8',
        '-crf',
        '10',
        '-b:v',
        '4M',
        '-vf',
        EVEN,
        '-pix_fmt',
        'yuv420p',
      ];
  audio = copyA ? ['-c:a', 'copy'] : ['-c:a', 'libopus', '-b:a', '128k'];
  return ['-i', input, ...map, ...video, ...audio, out];
}

/** Baca codec video dan audio dengan mediabunny. Format yang tidak dikenali (AVI, WMV) -> null. */
export async function probeCodecs(file: File): Promise<Codecs | null> {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import('mediabunny');
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const [v, a] = await Promise.all([
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
      ]);
      return { video: v?.codec ?? null, audio: a?.codec ?? null };
    } finally {
      input[Symbol.dispose]();
    }
  } catch {
    return null;
  }
}
