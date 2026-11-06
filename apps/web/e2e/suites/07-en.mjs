import { expect } from '../expect.mjs';

export const tests = [
  {
    name: 'EN: beranda dan pencarian',
    path: '/en',
    async run(h) {
      expect((await h.page.title()).includes('Fast and private'), await h.page.title());
      expect(await h.bodyHas('Merge PDF'), 'kartu tool bahasa Inggris tidak ada');
      await h.type('#tool-search', 'merge');
      const visible = await h.page.$$eval('[data-search]', (els) =>
        els.filter((e) => !e.hidden).map((e) => e.innerText.split('\n')[0]),
      );
      expect(visible.length === 1 && visible[0] === 'Merge PDF', JSON.stringify(visible));
    },
  },
  {
    name: 'EN: kompres gambar, nama file dan teks Inggris',
    path: '/en/tools/compress-image',
    async run(h) {
      await h.upload('foto.jpg');
      const [c] = await h.results(1);
      expect(c.includes('foto-small.jpg') && /\d+% smaller/.test(c), c);
      // format angka Inggris memakai titik desimal
      expect(!/\d,\d KB/.test(c), `format angka bukan Inggris: ${c}`);
      return [c];
    },
  },
  {
    name: 'EN: JSON formatter',
    path: '/en/tools/json-formatter',
    async run(h) {
      await h.page.focus('textarea[aria-label="JSON"]');
      await h.page.waitForSelector('pierce/.cm-content', { timeout: 10000 });
      await h.page.click('pierce/.cm-content');
      await h.page.keyboard.type('{"a":1}');
      await h.sleep(500);
      expect(await h.bodyHas('Valid JSON'), 'pesan valid bahasa Inggris tidak muncul');
    },
  },
  {
    name: 'EN: split PDF, nama file bahasa Inggris',
    path: '/en/tools/split-pdf',
    async run(h) {
      await h.upload('teks.pdf');
      await h.page.waitForSelector('#sp-ranges');
      await h.type('#sp-ranges', '1-2, 4');
      await h.click('Split PDF');
      const cards = await h.results(2);
      expect(
        cards[0].includes('teks-page-1-2.pdf') && cards[1].includes('teks-page-4.pdf'),
        cards.join(' | '),
      );
    },
  },
  {
    name: 'EN: halaman media cross-origin isolated',
    path: '/en/tools/video-to-gif',
    async run(h) {
      expect(
        await h.page.evaluate(() => crossOriginIsolated),
        'COOP/COEP tidak aktif di slug Inggris',
      );
    },
  },
  {
    name: 'ganti bahasa ID ke EN membuka pasangan halaman',
    path: '/tools/hitung-kata',
    async run(h) {
      await Promise.all([h.page.waitForNavigation(), h.page.click('a[hreflang="en-US"]')]);
      const url = new URL(h.page.url());
      expect(url.pathname === '/en/tools/word-counter', url.pathname);
      expect(await h.bodyHas('Word and Character Counter'), 'judul Inggris tidak ada');
      await h.page.waitForFunction(() =>
        [...document.querySelectorAll('astro-island')].every((i) => !i.hasAttribute('ssr')),
      );
      expect(
        (await h.page.$eval('a[hreflang="id-ID"]', (a) => a.getAttribute('href'))) ===
          '/tools/hitung-kata',
        'link balik salah',
      );
    },
  },
];
