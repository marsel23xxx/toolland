export type QrLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrSettings {
  text: string;
  size: number;
  level: QrLevel;
  fg: string;
  bg: string;
  margin: number;
}

/** Nilai awal. Dipakai saat build (gambar awal di HTML) dan di komponen, jadi harus sama. */
export const QR_DEFAULTS: QrSettings = {
  text: 'https://julian-marcell.com',
  size: 512,
  level: 'M',
  fg: '#000000',
  bg: '#ffffff',
  margin: 2,
};

export function qrOptions(s: QrSettings) {
  return {
    errorCorrectionLevel: s.level,
    margin: s.margin,
    width: s.size,
    color: { dark: s.fg, light: s.bg },
  };
}
