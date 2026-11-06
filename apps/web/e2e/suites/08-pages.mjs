// Uji asap semua halaman di sitemap (ID dan EN): tanpa error console/CSP, bahasa dan judul benar,
// canonical tanpa .html, pasangan hreflang ada, dan semua link internal tidak 404.
import fs from 'node:fs';
import path from 'node:path';
import { expect } from '../expect.mjs';

const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../dist');
const SITE = 'https://julian-marcell.com';
const urls = [
  ...fs.readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
].map((m) => m[1].replace(SITE, '') || '/');

// Link yang sudah dicek, dipakai bersama semua halaman agar tidak diminta berulang.
const checked = new Map();

export const tests = [
  {
    name: 'halaman 404 untuk alamat yang tidak ada',
    path: '/tools/tidak-ada',
    async run(h) {
      const status = await h.page.evaluate(async () => (await fetch(location.href)).status);
      expect(status === 404, `status ${status}`);
      expect(await h.bodyHas('tidak ditemukan'), 'isi halaman 404 tidak tampil');
      // Respons 404 memang diharapkan; browser mencatatnya sebagai error.
      h.problems.length = 0;
    },
  },
  ...urls.map((p) => ({
    name: `halaman ${p}`,
    path: p,
    async run(h) {
      const info = await h.page.evaluate(() => ({
        lang: document.documentElement.lang,
        title: document.title,
        h1: document.querySelector('h1')?.innerText.trim() ?? '',
        canonical: document.querySelector('link[rel=canonical]')?.href ?? '',
        alternates: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => [
          l.hreflang,
          l.href,
        ]),
        links: [
          ...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))),
        ],
        islands: document.querySelectorAll('astro-island').length,
      }));
      const en = p === '/en' || p.startsWith('/en/');
      expect(info.lang === (en ? 'en' : 'id'), `lang ${info.lang}`);
      expect(
        info.title.length > 10 && info.h1.length > 2,
        `judul/h1 kosong: ${info.title} | ${info.h1}`,
      );
      expect(info.canonical === SITE + p, `canonical ${info.canonical}`);
      // Halaman tool punya pasangan bahasa lain.
      if (p.includes('/tools/')) {
        const langs = info.alternates.map(([l]) => l);
        expect(
          langs.includes('id-ID') && langs.includes('en-US'),
          `hreflang ${JSON.stringify(langs)}`,
        );
      }
      // Semua alternate dan link internal harus bisa dibuka.
      const base = new URL(h.page.url()).origin;
      const targets = [
        ...info.alternates.map(([, href]) => href.replace(SITE, '')),
        ...info.links.filter((l) => l.startsWith('/') && !l.startsWith('//')),
      ].map((l) => l.split('#')[0] || '/');
      const broken = [];
      for (const t of new Set(targets)) {
        if (!checked.has(t)) {
          const status = await h.page.evaluate(
            async (u) => (await fetch(u, { method: 'HEAD', redirect: 'manual' })).status,
            base + t,
          );
          checked.set(t, status);
        }
        if (checked.get(t) !== 200) broken.push(`${t} → ${checked.get(t)}`);
      }
      expect(!broken.length, `link rusak: ${broken.join(', ')}`);
      return p.includes('/tools/') && !info.islands ? ['catatan: tanpa island'] : [];
    },
  })),
];
