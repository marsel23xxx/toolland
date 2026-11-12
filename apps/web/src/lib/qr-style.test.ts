import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  EYE_SHAPES,
  MODULE_SHAPES,
  contrastOk,
  isFinder,
  logoArea,
  qrSvg,
  type Matrix,
  type QrStyle,
} from './qr-style';

function matrix(text: string, level: 'M' | 'H' = 'M'): Matrix {
  const q = QRCode.create(text, { errorCorrectionLevel: level });
  return { size: q.modules.size, get: (r, c) => !!q.modules.get(r, c) };
}

const style: QrStyle = {
  shape: 'square',
  eye: 'square',
  fg: '#000000',
  eyeColor: '#000000',
  bg: '#ffffff',
  margin: 2,
};

describe('isFinder', () => {
  it('mengenali tiga penanda pojok 7×7 dan bukan pojok kanan bawah', () => {
    expect(isFinder(25, 0, 0)).toBe(true);
    expect(isFinder(25, 6, 24)).toBe(true);
    expect(isFinder(25, 24, 6)).toBe(true);
    expect(isFinder(25, 24, 24)).toBe(false);
    expect(isFinder(25, 7, 7)).toBe(false);
  });
});

describe('logoArea', () => {
  it('di tengah, sebanding ukuran logo, dan dibatasi 30%', () => {
    const a = logoArea(33, { href: '', size: 0.2 })!;
    expect(a.from + a.to).toBe(32);
    const big = logoArea(33, { href: '', size: 0.9 })!;
    expect(big.to - big.from + 1).toBeLessThanOrEqual(Math.ceil(33 * 0.3) + 2);
    expect(logoArea(33, null)).toBeNull();
  });
});

describe('qrSvg', () => {
  const m = matrix('https://julian-marcell.com');

  it('semua kombinasi bentuk menghasilkan SVG valid dengan ukuran yang diminta', () => {
    for (const shape of MODULE_SHAPES)
      for (const eye of EYE_SHAPES) {
        const svg = qrSvg(m, { ...style, shape, eye }, 512);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('width="512"');
        expect(svg).toContain(`viewBox="0 0 ${m.size + 4} ${m.size + 4}"`);
        expect(svg).not.toContain('NaN');
      }
  });

  it('logo mengosongkan modul di tengah dan menyisipkan gambar', () => {
    const plain = qrSvg(m, style, 256);
    const withLogo = qrSvg(
      m,
      { ...style, logo: { href: 'data:image/png;base64,AA', size: 0.25 } },
      256,
    );
    const count = (s: string) => (s.match(/h1v1h-1z/g) ?? []).length;
    expect(count(withLogo)).toBeLessThan(count(plain));
    expect(withLogo).toContain('<image href="data:image/png;base64,AA"');
  });

  it('warna dan atribut di-escape', () => {
    const svg = qrSvg(m, { ...style, fg: '"><script>' }, 128);
    expect(svg).not.toContain('<script>');
  });
});

describe('contrastOk', () => {
  it('QR gelap di latar terang aman, terbalik atau pucat tidak aman', () => {
    expect(contrastOk('#000000', '#ffffff')).toBe(true);
    expect(contrastOk('#1d4ed8', '#ffffff')).toBe(true);
    expect(contrastOk('#ffffff', '#000000')).toBe(false);
    expect(contrastOk('#dddddd', '#ffffff')).toBe(false);
  });
});
