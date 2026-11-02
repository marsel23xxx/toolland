// @ts-check
import sitemap from '@astrojs/sitemap';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import Icons from 'unplugin-icons/vite';

// Halaman yang tidak masuk sitemap.
const NOINDEX_PAGES = ['/404'];

export default defineConfig({
  site: 'https://julian-marcell.com',
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
      i18n: { defaultLocale: 'id', locales: { id: 'id-ID', en: 'en-US' } },
      filter: (page) => !NOINDEX_PAGES.some((p) => page.replace(/\/$/, '').endsWith(p)),
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
        "connect-src 'self'",
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
  },
});
