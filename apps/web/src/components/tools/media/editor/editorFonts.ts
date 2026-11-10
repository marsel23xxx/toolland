/**
 * Muat font teks editor video (hanya saat editor dibuka). File woff2 disalin ke /_astro saat
 * build, jadi tetap dari domain sendiri (aman CSP, tanpa Google Fonts).
 */
import bebas from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import caveat from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url';
import montserrat from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2?url';
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url';
import playfair from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import { FONTS } from '../../../../lib/editor/textfx';
import type { FontId } from '../../../../lib/editor/project';

const FILES: Partial<Record<FontId, string>> = { bebas, caveat, montserrat, pacifico, playfair };

let loading: Promise<void> | null = null;

/** Daftarkan dan muat semua font editor sekali per halaman. */
export function loadEditorFonts(): Promise<void> {
  loading ??= Promise.all(
    (Object.entries(FILES) as [FontId, string][]).map(async ([id, url]) => {
      const f = FONTS[id];
      const face = new FontFace(f.family, `url(${url}) format('woff2')`, {
        weight: String(f.weight),
        display: 'swap',
      });
      document.fonts.add(face);
      await face.load().catch(() => {});
    }),
  ).then(() => undefined);
  return loading;
}
