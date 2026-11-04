/** Kotak halaman PDF (CropBox) dalam satuan point. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const norm = (r: number) => (((Math.round(r / 90) * 90) % 360) + 360) % 360;

/** Ukuran halaman seperti terlihat di layar (lebar/tinggi tertukar bila diputar 90/270°). */
export function visualSize(box: Box, rotation: number): { width: number; height: number } {
  const r = norm(rotation);
  return r === 90 || r === 270
    ? { width: box.height, height: box.width }
    : { width: box.width, height: box.height };
}

/**
 * Ubah titik "seperti terlihat" (origin kiri bawah halaman yang tampil) ke koordinat PDF asli.
 * Gambar/teks yang digambar di titik ini dengan rotate = rotasi halaman akan tampil tegak.
 */
export function visualToUser(
  box: Box,
  rotation: number,
  vx: number,
  vy: number,
): { x: number; y: number } {
  const W = box.width;
  const H = box.height;
  let x: number;
  let y: number;
  switch (norm(rotation)) {
    case 90:
      x = W - vy;
      y = vx;
      break;
    case 180:
      x = W - vx;
      y = H - vy;
      break;
    case 270:
      x = vy;
      y = H - vx;
      break;
    default:
      x = vx;
      y = vy;
  }
  return { x: x + box.x, y: y + box.y };
}

export { norm as normalizeRotation };

export type NumberPosition =
  'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';

/** Titik awal teks (baseline kiri) dalam koordinat terlihat untuk posisi nomor halaman. */
export function numberAnchor(
  size: { width: number; height: number },
  position: NumberPosition,
  textWidth: number,
  fontSize: number,
  margin: number,
): { x: number; y: number } {
  const [v, h] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
  const x =
    h === 'left'
      ? margin
      : h === 'right'
        ? size.width - margin - textWidth
        : (size.width - textWidth) / 2;
  const y = v === 'bottom' ? margin : size.height - margin - fontSize * 0.75;
  return { x, y };
}
