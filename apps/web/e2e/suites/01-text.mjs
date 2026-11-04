import { expect } from '../expect.mjs';

export const tests = [
  {
    name: 'beranda: pencarian',
    path: '/',
    async run(h) {
      await h.type('#tool-search', 'pdf gabung');
      const visible = await h.page.$$eval(
        '[data-search]',
        (els) => els.filter((e) => !e.hidden).length,
      );
      expect(visible === 1, `hasil cari "pdf gabung" = ${visible}`);
      await h.type('#tool-search', 'zzzz');
      expect(await h.page.$eval('#no-results', (e) => !e.hidden), 'pesan kosong tidak tampil');
    },
  },
  {
    name: 'hitung kata',
    path: '/tools/hitung-kata',
    async run(h) {
      await h.type('#wc-text', 'Halo dunia! Apa kabar?\n\nBaik.');
      const t = await h.text('dl');
      expect(/Kata 5\b/.test(t) && /Paragraf 2\b/.test(t), t);
    },
  },
  {
    name: 'ubah huruf',
    path: '/tools/ubah-huruf',
    async run(h) {
      await h.type('#cc-text', 'nama pengguna baru');
      await h.click('snake_case');
      expect((await h.value('#cc-text')) === 'nama_pengguna_baru', await h.value('#cc-text'));
    },
  },
  {
    name: 'JSON formatter (CodeMirror di Shadow DOM)',
    path: '/tools/json-formatter',
    async run(h) {
      await h.page.hover('.field');
      await h.page.waitForSelector('pierce/.cm-content', { timeout: 10000 });
      await h.page.click('pierce/.cm-content');
      await h.page.keyboard.type('{"b":1,"a":[1,2]}');
      await h.click('Format');
      await h.sleep(300);
      const doc = await h.page.$eval('pierce/.cm-content', (e) => e.innerText);
      expect(doc.includes('  "b": 1,'), JSON.stringify(doc));
    },
  },
  {
    name: 'hash file di worker',
    path: '/tools/hash-md5-sha',
    async run(h) {
      await h.type('#hs-text', 'abc');
      await h.sleep(500);
      expect(await h.bodyHas('900150983cd24fb0d6963f7d28e17f72'), 'MD5 abc salah');
      await h.click('File');
      await h.upload('foto.webp');
      await h.page.waitForFunction(
        () => document.querySelectorAll('dd').length >= 5 && !document.querySelector('progress'),
        { timeout: 15000 },
      );
    },
  },
  {
    name: 'regex: pola berbahaya dihentikan',
    path: '/tools/regex-tester',
    async run(h) {
      await h.type('#rx-text', 'a'.repeat(32) + '!');
      await h.type('#rx-pattern', '(a+)+$');
      await h.sleep(1600);
      expect(await h.bodyHas('terlalu lama'), 'timeout tidak muncul');
      await h.type('#rx-text', 'x1 y2');
      await h.type('#rx-pattern', '\\d');
      await h.sleep(600);
      expect(await h.bodyHas('2 kecocokan'), 'worker baru tidak jalan');
    },
  },
  {
    name: 'minify CSS (esbuild-wasm)',
    path: '/tools/minify-css-js',
    async run(h) {
      await h.type('#mf-in', 'body {\n  color: #ffffff;\n}');
      await h.click('Minify');
      await h.page.waitForFunction(() => document.querySelector('#mf-out').value.length > 0, {
        timeout: 60000,
      });
      expect((await h.value('#mf-out')) === 'body{color:#fff}', await h.value('#mf-out'));
    },
  },
];
