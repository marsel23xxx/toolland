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
      await h.page.focus('textarea[aria-label="JSON"]');
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
    name: 'Base64: tab URL encode',
    path: '/tools/base64-encode-decode',
    async run(h) {
      await h.type('#b64-in', 'Halo 😀');
      expect((await h.value('#b64-out')) === 'SGFsbyDwn5iA', await h.value('#b64-out'));
      await h.page.click('[data-tab="url"]');
      await h.page.waitForSelector('#url-in');
      await h.type('#url-in', 'a b&c');
      expect((await h.value('#url-out')) === 'a%20b%26c', await h.value('#url-out'));
    },
  },
];
