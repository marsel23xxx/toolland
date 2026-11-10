/**
 * Format file proyek editor video Toolland: .ayu
 *
 * - Ringan: teks JSON (UTF-8) berisi susunan proyek saja. Saat dibuka, video aslinya dipilih ulang
 *   dan dicocokkan lewat nama dan ukuran file.
 * - Beserta video: arsip ZIP tanpa kompresi (metode "store") berisi project.json dan folder
 *   media/. Video tidak disalin ke memori: Blob hasil hanya merujuk ke File aslinya, dan saat
 *   dibuka file diambil sebagai potongan (slice) dari arsip.
 *
 * Keduanya memakai ekstensi .ayu; jenisnya dikenali dari byte pertama ("{" atau "PK").
 */
import {
  type Aspect,
  type Clip,
  type MediaItem,
  type Music,
  type Project,
  type Quality,
  type TextLayer,
  newProject,
  type Overlay,
  type AudioItem,
} from './project';
import { FONT_IDS } from './textfx';

export const AYU_FORMAT = 'toolland-ayu';
/**
 * Versi 2: kecepatan, fade audio, putar/balik, zoom, warna, Ken Burns, latar, fps.
 * Versi 3: font, rata, garis tepi, bayangan, kotak, animasi teks; rentang, fade, ducking musik.
 * Versi 4: transisi bertumpuk (crossfade, sapu, geser, lingkaran).
 * Versi 5: jalur overlay (video/foto, stiker, bentuk).
 * Versi 6: jalur audio tambahan dan narasi rekaman.
 */
export const AYU_VERSION = 6;
export const AYU_MIME = 'application/x-toolland-ayu';
/** Arsip ZIP tanpa ZIP64: total di bawah 4 GB. */
export const MAX_BUNDLE_BYTES = 4 * 1024 ** 3 - 64 * 1024 ** 2;

interface AyuJson {
  format: typeof AYU_FORMAT;
  version: number;
  savedAt: string;
  bundled: boolean;
  project: Project;
}

export function projectJson(p: Project, bundled: boolean): string {
  const doc: AyuJson = {
    format: AYU_FORMAT,
    version: AYU_VERSION,
    savedAt: new Date().toISOString(),
    bundled,
    project: p,
  };
  return JSON.stringify(doc, null, 1);
}

// ---------- Validasi isi proyek dari file ----------

const num = (v: unknown, d = 0, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const str = (v: unknown, d = '', max = 300) => (typeof v === 'string' ? v.slice(0, max) : d);
const pick = <T extends string | number>(v: unknown, allowed: readonly T[], d: T): T =>
  allowed.includes(v as T) ? (v as T) : d;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const ANIMS = ['none', 'fade', 'up', 'left'] as const;

/** Ambil proyek dari objek apa pun dengan aman: nilai aneh diganti bawaan, entri rusak dibuang. */
export function sanitizeProject(raw: unknown): Project {
  const o = (raw ?? {}) as Record<string, unknown>;
  const p = newProject(str(o.name, '', 120));
  const s = (o.settings ?? {}) as Record<string, unknown>;
  p.settings = {
    aspect: pick<Aspect>(s.aspect, ['16:9', '9:16', '1:1', '4:5'], '16:9'),
    quality: pick<Quality>(s.quality, ['480', '720', '1080'], '720'),
    fade: s.fade === true,
    bg: /^#[0-9a-f]{6}$/i.test(str(s.bg)) ? (s.bg as string) : '#000000',
    fps: pick(s.fps, [24, 30, 60] as const, 30),
  };
  p.media = arr(o.media)
    .map((m) => m as Record<string, unknown>)
    .filter((m) => typeof m.id === 'string' && typeof m.name === 'string')
    .slice(0, 300)
    .map<MediaItem>((m) => ({
      id: str(m.id, '', 40),
      kind: pick(m.kind, ['video', 'image', 'audio'] as const, 'video'),
      name: str(m.name, '', 255),
      size: num(m.size, 0, 0),
      duration: num(m.duration, 0, 0, 86400),
      width: num(m.width, 0, 0, 20000),
      height: num(m.height, 0, 0, 20000),
      lastModified: num(m.lastModified, 0, 0),
      ...(m.recorded === true ? { recorded: true } : {}),
      ...(m.proxy === true ? { proxy: true } : {}),
    }));
  const ids = new Set(p.media.map((m) => m.id));
  p.clips = arr(o.clips)
    .map((c) => c as Record<string, unknown>)
    .filter((c) => typeof c.mediaId === 'string' && ids.has(c.mediaId))
    .slice(0, 100)
    .map<Clip>((c) => {
      const inn = num(c.in, 0, 0, 86400);
      return {
        id: str(c.id, '', 40) || `c${Math.random().toString(36).slice(2, 8)}`,
        mediaId: c.mediaId as string,
        in: inn,
        out: num(c.out, inn + 1, inn + 0.05, 86400),
        volume: num(c.volume, 1, 0, 2),
        fit: pick(c.fit, ['fit', 'fill', 'blur'] as const, 'fit'),
        trans: pick(
          c.trans,
          ['none', 'black', 'white', 'cross', 'wipe', 'slide', 'circle'] as const,
          'none',
        ),
        transDur: num(c.transDur, 0.8, 0.2, 3),
        speed: num(c.speed, 1, 0.25, 4),
        fadeIn: num(c.fadeIn, 0, 0, 5),
        fadeOut: num(c.fadeOut, 0, 0, 5),
        rotate: pick(c.rotate, [0, 90, 180, 270] as const, 0),
        flipH: c.flipH === true,
        flipV: c.flipV === true,
        zoom: num(c.zoom, 1, 1, 3),
        panX: num(c.panX, 0, -1, 1),
        panY: num(c.panY, 0, -1, 1),
        brightness: num(c.brightness, 1, 0.5, 1.5),
        contrast: num(c.contrast, 1, 0.5, 1.5),
        saturation: num(c.saturation, 1, 0, 2),
        preset: pick(
          c.preset,
          ['none', 'warm', 'cool', 'bw', 'vintage', 'vivid', 'fade'] as const,
          'none',
        ),
        kenBurns: pick(c.kenBurns, ['none', 'in', 'out', 'left', 'right'] as const, 'none'),
      };
    });
  p.texts = arr(o.texts)
    .map((t) => t as Record<string, unknown>)
    .slice(0, 30)
    .map<TextLayer>((t) => {
      const start = num(t.start, 0, 0, 86400);
      return {
        id: str(t.id, '', 40) || `t${Math.random().toString(36).slice(2, 8)}`,
        text: str(t.text, '', 200),
        start,
        end: num(t.end, start + 3, start + 0.1, 86400),
        position: pick(t.position, ['top', 'center', 'bottom', 'custom'] as const, 'bottom'),
        size: pick(t.size, ['s', 'm', 'l'] as const, 'm'),
        color: /^#[0-9a-f]{6}$/i.test(str(t.color)) ? (t.color as string) : '#ffffff',
        box: t.box === true,
        x: num(t.x, 0.5, 0, 1),
        y: num(t.y, 0.5, 0, 1),
        font: pick(t.font, FONT_IDS, 'jakarta'),
        align: pick(t.align, ['left', 'center', 'right'] as const, 'center'),
        // Proyek lama: teks tanpa kotak selalu bergaris tepi.
        stroke: typeof t.stroke === 'boolean' ? t.stroke : t.box !== true,
        shadow: t.shadow === true,
        boxColor: /^#[0-9a-f]{6}$/i.test(str(t.boxColor)) ? (t.boxColor as string) : '#000000',
        boxOpacity: num(t.boxOpacity, 0.6, 0, 1),
        animIn: pick(t.animIn, ANIMS, 'none'),
        animOut: pick(t.animOut, ANIMS, 'none'),
        animDur: num(t.animDur, 0.4, 0.1, 2),
      };
    });
  p.overlays = arr(o.overlays)
    .map((v) => v as Record<string, unknown>)
    .slice(0, 20)
    .map<Overlay | null>((v) => {
      const kind = pick(v.kind, ['media', 'emoji', 'shape'] as const, 'shape');
      const mediaId = str(v.mediaId, '', 40);
      if (kind === 'media' && !ids.has(mediaId)) return null;
      const inn = num(v.in, 0, 0, 86400);
      return {
        id: str(v.id, '', 40) || `o${Math.random().toString(36).slice(2, 8)}`,
        kind,
        mediaId: kind === 'media' ? mediaId : '',
        char: str(v.char, '', 16),
        shape: pick(v.shape, ['rect', 'round', 'circle'] as const, 'rect'),
        fill: /^#[0-9a-f]{6}$/i.test(str(v.fill)) ? (v.fill as string) : '#ffd23f',
        start: num(v.start, 0, 0, 86400),
        in: inn,
        out: num(v.out, inn + 3, inn + 0.05, 86400),
        x: num(v.x, 0.5, -0.5, 1.5),
        y: num(v.y, 0.5, -0.5, 1.5),
        w: num(v.w, 0.3, 0.02, 2),
        ratio: num(v.ratio, 1, 0.05, 20),
        rotate: num(v.rotate, 0, -360, 360),
        opacity: num(v.opacity, 1, 0, 1),
        volume: num(v.volume, 0, 0, 2),
        fadeIn: num(v.fadeIn, 0, 0, 10),
        fadeOut: num(v.fadeOut, 0, 0, 10),
      };
    })
    .filter((v): v is Overlay => v !== null);
  p.audios = arr(o.audios)
    .map((a) => a as Record<string, unknown>)
    .filter((a) => typeof a.mediaId === 'string' && ids.has(a.mediaId))
    .slice(0, 20)
    .map<AudioItem>((a) => {
      const inn = num(a.in, 0, 0, 86400);
      return {
        id: str(a.id, '', 40) || `a${Math.random().toString(36).slice(2, 8)}`,
        mediaId: a.mediaId as string,
        start: num(a.start, 0, 0, 86400),
        in: inn,
        out: num(a.out, inn + 1, inn + 0.05, 86400),
        volume: num(a.volume, 1, 0, 2),
        fadeIn: num(a.fadeIn, 0, 0, 10),
        fadeOut: num(a.fadeOut, 0, 0, 10),
      };
    });
  const m = o.music as Record<string, unknown> | null | undefined;
  p.music =
    m && typeof m.mediaId === 'string' && ids.has(m.mediaId)
      ? ({
          mediaId: m.mediaId,
          offset: num(m.offset, 0, 0, 86400),
          volume: num(m.volume, 0.6, 0, 2),
          start: num(m.start, 0, 0, 86400),
          end: m.end === null || m.end === undefined ? null : num(m.end, 0, 0, 86400),
          fadeIn: num(m.fadeIn, 0, 0, 10),
          // Versi 1-2 menyimpan fadeOut sebagai true/false (2 detik).
          fadeOut: typeof m.fadeOut === 'boolean' ? (m.fadeOut ? 2 : 0) : num(m.fadeOut, 2, 0, 10),
          duck: m.duck === true,
        } satisfies Music)
      : null;
  return p;
}

// ---------- CRC-32 ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

/** CRC-32 sebuah Blob dibaca bertahap (tidak dimuat utuh ke memori). */
async function crcOfBlob(blob: Blob, onBytes: (n: number) => void): Promise<number> {
  // Dibaca per potongan 16 MB: memori tetap kecil walau videonya 1 GB.
  const step = 16 * 1024 ** 2;
  let crc = 0;
  for (let o = 0; o < blob.size; o += step) {
    const chunk = new Uint8Array(await blob.slice(o, o + step).arrayBuffer());
    crc = crc32(chunk, crc);
    onBytes(chunk.length);
  }
  return crc;
}

// ---------- ZIP (store) ----------

const enc = new TextEncoder();

function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

/**
 * Arsip ZIP tanpa kompresi. Isi file tidak disalin: Blob hasil berisi header kecil dan Blob asli.
 * onProgress menerima 0..1 selama menghitung CRC.
 */
export async function zipStore(
  entries: { path: string; data: Blob }[],
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const total = entries.reduce((s, e) => s + e.data.size, 0);
  if (total > MAX_BUNDLE_BYTES) throw new Error('too-large');
  let done = 0;
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  const [time, date] = dosTime(new Date());
  for (const e of entries) {
    const name = enc.encode(e.path) as Uint8Array<ArrayBuffer>;
    const crc = await crcOfBlob(e.data, (n) => {
      done += n;
      onProgress?.(total ? done / total : 1);
    });
    const size = e.data.size;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versi minimal
    local.setUint16(6, 0x0800, true); // nama UTF-8
    local.setUint16(8, 0, true); // store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, e.data);
    const cd = new DataView(new ArrayBuffer(46 + name.length));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    new Uint8Array(cd.buffer).set(name, 46);
    central.push(new Uint8Array(cd.buffer));
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: AYU_MIME });
}

/** Daftar isi ZIP (metode store) sebagai potongan Blob, tanpa membaca isi file. */
export async function unzipStore(blob: Blob): Promise<Map<string, Blob>> {
  const tailSize = Math.min(blob.size, 65_557);
  const tail = new DataView(await blob.slice(blob.size - tailSize).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--)
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('invalid');
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await blob.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const out = new Map<string, Blob>();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('invalid');
    const method = cd.getUint16(p + 10, true);
    const size = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const localOffset = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (method !== 0) continue;
    const lh = new DataView(await blob.slice(localOffset, localOffset + 30).arrayBuffer());
    const start = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    out.set(name, blob.slice(start, start + size));
  }
  return out;
}

// ---------- Simpan & buka ----------

/** Simpan proyek. bundled = sertakan file media (hanya yang tersedia di files). */
export async function saveAyu(
  p: Project,
  files: Map<string, File>,
  bundled: boolean,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const json = projectJson(p, bundled);
  if (!bundled) return new Blob([json], { type: AYU_MIME });
  const entries: { path: string; data: Blob }[] = [
    { path: 'project.json', data: new Blob([json], { type: 'application/json' }) },
  ];
  for (const m of p.media) {
    const f = files.get(m.id);
    if (f) entries.push({ path: `media/${m.id}`, data: f });
  }
  return zipStore(entries, onProgress);
}

export interface OpenedAyu {
  project: Project;
  /** File media yang ikut di dalam arsip (proyek beserta video). */
  files: Map<string, File>;
  bundled: boolean;
}

export async function openAyu(file: Blob): Promise<OpenedAyu> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  let json: string;
  let archive: Map<string, Blob> | undefined;
  if (isZip) {
    archive = await unzipStore(file);
    const pj = archive.get('project.json');
    if (!pj) throw new Error('invalid');
    json = await pj.text();
  } else {
    if (file.size > 5 * 1024 ** 2) throw new Error('invalid');
    json = await file.text();
  }
  let doc: Partial<AyuJson>;
  try {
    doc = JSON.parse(json) as Partial<AyuJson>;
  } catch {
    throw new Error('invalid');
  }
  if (doc.format !== AYU_FORMAT) throw new Error('invalid');
  if (typeof doc.version === 'number' && doc.version > AYU_VERSION) throw new Error('newer');
  const project = sanitizeProject(doc.project);
  const files = new Map<string, File>();
  if (archive)
    for (const m of project.media) {
      const b = archive.get(`media/${m.id}`);
      if (b)
        files.set(
          m.id,
          new File([b], m.name, { type: mimeFor(m.name), lastModified: m.lastModified }),
        );
    }
  return { project, files, bundled: isZip };
}

/** Cocokkan file pilihan pengguna dengan media yang hilang: nama + ukuran, lalu nama saja. */
export function matchFiles(media: MediaItem[], chosen: File[]): Map<string, File> {
  const out = new Map<string, File>();
  const free = new Set(chosen);
  for (const pass of ['exact', 'name'] as const)
    for (const m of media) {
      if (out.has(m.id)) continue;
      const f = [...free].find((x) => x.name === m.name && (pass === 'name' || x.size === m.size));
      if (f) {
        out.set(m.id, f);
        free.delete(f);
      }
    }
  return out;
}

function mimeFor(name: string): string {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';
  return (
    {
      mp4: 'video/mp4',
      m4v: 'video/mp4',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    }[ext] ?? 'application/octet-stream'
  );
}
