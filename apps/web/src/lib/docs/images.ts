/**
 * Olah gambar untuk template dokumen di browser: foto dipotong persegi (JPEG), tanda tangan
 * diperkecil dengan latar transparan tetap (PNG), dan versi foto bulat untuk CV profesional.
 */
import { SAMPLE_PHOTOS, sampleName, samplePhotoUrl } from '../slides/photos';
import type { DocAssets } from './form';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

async function fileUrl(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto: potong persegi dari tengah, maksimal 600 px, JPEG. */
export async function processPhoto(file: File): Promise<string> {
  const img = await fileUrl(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const out = Math.min(600, side);
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  return c.toDataURL('image/jpeg', 0.88);
}

/** Foto bebas (slide): sisi terpanjang maksimal 1600 px, rasio tetap, JPEG. */
export async function processCover(file: File): Promise<string> {
  const img = await fileUrl(file);
  const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Tanda tangan: lebar maksimal 800 px, PNG agar latar transparan tetap. */
export async function processSignature(file: File): Promise<string> {
  const img = await fileUrl(file);
  const s = Math.min(1, 800 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

function dataUrlBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const cache = new Map<string, DocAssets[string]>();

/** Foto contoh bawaan (sample:<nama>) -> aset, dimuat dari folder publik situs ini. */
async function sampleAsset(value: string): Promise<DocAssets[string] | undefined> {
  const name = sampleName(value);
  if (!name) return undefined;
  const hit = cache.get(value);
  if (hit) return hit;
  const res = await fetch(samplePhotoUrl(name));
  if (!res.ok) return undefined;
  const { w, h } = SAMPLE_PHOTOS[name];
  const asset = { data: new Uint8Array(await res.arrayBuffer()), type: 'jpeg' as const, w, h };
  cache.set(value, asset);
  return asset;
}

/** Data URL atau foto contoh -> aset siap pakai. `circle` membuat versi bulat transparan (PNG). */
export async function toAsset(url: string, circle = false): Promise<DocAssets[string] | undefined> {
  if (sampleName(url) && !circle) return sampleAsset(url);
  if (!url.startsWith('data:image/')) return undefined;
  const key = (circle ? 'c:' : '') + url;
  const hit = cache.get(key);
  if (hit) return hit;
  const img = await loadImage(url);
  let asset: DocAssets[string];
  if (circle) {
    const n = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, (img.naturalWidth - n) / 2, (img.naturalHeight - n) / 2, n, n, 0, 0, n, n);
    asset = { data: dataUrlBytes(c.toDataURL('image/png')), type: 'png', w: n, h: n };
  } else {
    asset = {
      data: dataUrlBytes(url),
      type: url.startsWith('data:image/png') ? 'png' : 'jpeg',
      w: img.naturalWidth,
      h: img.naturalHeight,
    };
  }
  if (cache.size > 12) cache.clear();
  cache.set(key, asset);
  return asset;
}
