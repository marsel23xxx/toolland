import { describe, expect, it } from 'vitest';
import { getLocale, pagePath } from './index';

const u = (p: string) => new URL(p, 'https://julian-marcell.com');

describe('pagePath dan getLocale', () => {
  it('membuang .html dan index dari path build', () => {
    expect(pagePath(u('/index.html'))).toBe('/');
    expect(pagePath(u('/en.html'))).toBe('/en');
    expect(pagePath(u('/tools/kompres-gambar.html'))).toBe('/tools/kompres-gambar');
    expect(pagePath(u('/en/tools/compress-image'))).toBe('/en/tools/compress-image');
  });
  it('mengenali halaman bahasa Inggris, termasuk beranda /en.html', () => {
    expect(getLocale(u('/en.html'))).toBe('en');
    expect(getLocale(u('/en/support.html'))).toBe('en');
    expect(getLocale(u('/index.html'))).toBe('id');
    expect(getLocale(u('/enkripsi'))).toBe('id');
  });
});
