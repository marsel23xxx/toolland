// @ts-check
import fs from 'node:fs';
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import Icons from 'unplugin-icons/vite';

// Halaman yang tidak masuk sitemap.
const NOINDEX_PAGES = ['/404'];

/**
 * Pasangan halaman Indonesia <-> Inggris untuk hreflang di sitemap. Slug berbeda per bahasa,
 * jadi dibaca dari field idSlug di konten Inggris (src/content/tools/en/*.md).
 */
function languagePairs() {
  const dir = new URL('./src/content/tools/en/', import.meta.url);
  const pairs = [
    ['/', '/en'],
    ['/dukung', '/en/support'],
    ['/kebijakan-privasi', '/en/privacy'],
  ];
  for (const file of fs.readdirSync(dir)) {
    const idSlug = /^idSlug: '(.+)'$/m.exec(fs.readFileSync(new URL(file, dir), 'utf8'))?.[1];
    if (idSlug) pairs.push([`/tools/${idSlug}`, `/en/tools/${file.replace(/\.md$/, '')}`]);
  }
  const map = new Map();
  for (const [id, en] of pairs) {
    const links = [
      { lang: 'id-ID', url: `${SITE}${id === '/' ? '/' : id}` },
      { lang: 'en-US', url: `${SITE}${en}` },
    ];
    map.set(id, links);
    map.set(en, links);
  }
  return map;
}
const SITE = 'https://julian-marcell.com';
const PAIRS = languagePairs();

export default defineConfig({
  site: SITE,
  output: 'static',
  // URL tanpa garis miring di akhir: /tools/jpg-ke-webp
  trailingSlash: 'never',
  build: { format: 'file' },

  // Indonesia di root (/), Inggris di /en/
  i18n: {
    defaultLocale: 'id',
    locales: ['id', 'en'],
    routing: { prefixDefaultLocale: false },
  },

  // Shiki memakai style inline yang bentrok dengan CSP; Prism memakai class.
  markdown: { syntaxHighlight: 'prism' },

  integrations: [
    vue(),
    sitemap({
      filter: (page) => !NOINDEX_PAGES.some((p) => page.replace(/\/$/, '').endsWith(p)),
      serialize(item) {
        const path = new URL(item.url).pathname.replace(/(.)\/$/, '$1');
        const links = PAIRS.get(path);
        return links ? { ...item, links } : item;
      },
    }),
  ],

  security: {
    // CSP ketat lewat <meta>, hash script/style inline dihitung otomatis oleh Astro.
    // frame-ancestors tidak bisa lewat <meta>, jadi diatur sebagai header di Nginx.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "font-src 'self'",
        // Cari Subdomain: browser mengambil data langsung dari log sertifikat publik.
        "connect-src 'self' https://crt.sh https://api.certspotter.com",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },

  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'vue3' })],
    // Saat pnpm dev: /api diteruskan ke API Rust lokal (cargo run -p toolland-api).
    server: { proxy: { '/api': 'http://127.0.0.1:8082' } },
    // Worker sebagai ES module agar codec WASM bisa di-import dinamis di dalamnya.
    worker: { format: 'es' },
    // Codec WASM memuat file .wasm lewat new URL(..., import.meta.url); jangan di-pre-bundle.
    optimizeDeps: {
      exclude: [
        '@jsquash/avif',
        '@jsquash/jpeg',
        '@jsquash/oxipng',
        '@jsquash/png',
        '@jsquash/resize',
        '@jsquash/webp',
        'libheif-js',
        'esbuild-wasm',
        'pdfjs-dist',
        '@ffmpeg/ffmpeg',
        '@ffmpeg/util',
        '@imgly/background-removal',
        'onnxruntime-web',
      ],
    },
  },
});
