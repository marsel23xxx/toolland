/** Orientasi EXIF JPEG (1-8), atau 1 bila tidak ada. Hanya membaca header, tidak decode gambar. */
export function jpegOrientation(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let off = 2;
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off);
    const size = v.getUint16(off + 2);
    if (marker === 0xffe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      const little = v.getUint16(tiff) === 0x4949;
      const u16 = (p: number) => v.getUint16(p, little);
      const u32 = (p: number) => v.getUint32(p, little);
      const ifd = tiff + u32(tiff + 4);
      if (ifd + 2 > v.byteLength) return 1;
      const count = u16(ifd);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > v.byteLength) return 1;
        if (u16(entry) === 0x0112) return u16(entry + 8) || 1;
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1;
    off += 2 + size;
  }
  return 1;
}
