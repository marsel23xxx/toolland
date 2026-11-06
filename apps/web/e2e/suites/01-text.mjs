import jsQR from 'jsqr';
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
  {
    name: 'bandingkan teks: per baris dan per kata',
    path: '/tools/bandingkan-teks',
    async run(h) {
      await h.type('#df-a', 'satu\ndua\ntiga');
      await h.type('#df-b', 'satu\nDUA\ntiga\nempat');
      await h.sleep(300);
      let t = await h.text('main');
      expect(/2 ditambah · 1 dihapus/.test(t), t.slice(0, 400));
      await h.click('Kata');
      await h.sleep(300);
      const ins = await h.page.$$eval('ins', (e) => e.map((x) => x.textContent.trim()));
      expect(ins.includes('DUA'), JSON.stringify(ins));
      await h.type('#df-b', 'satu\ndua\ntiga');
      await h.sleep(300);
      t = await h.text('main');
      expect(t.includes('Kedua teks sama persis.'), 'teks identik tidak dikenali');
    },
  },
  {
    name: 'JSON ke CSV dan sebaliknya',
    path: '/tools/json-ke-csv',
    async run(h) {
      await h.type(
        '#jc-in',
        '[{"nama":"Ani","kota":"Bandung"},{"nama":"Budi, Jr","kota":"Medan"}]',
      );
      await h.page.waitForFunction(
        () => document.querySelector('#jc-out').value.includes('Medan'),
        {
          timeout: 5000,
        },
      );
      const csv = await h.value('#jc-out');
      expect(
        csv.trim() === 'nama,kota\nAni,Bandung\n"Budi, Jr",Medan'.replace(/\\n/g, '\n'),
        JSON.stringify(csv),
      );
      await h.click('⇄');
      await h.page.waitForFunction(() => document.querySelector('#jc-out').value.startsWith('['), {
        timeout: 5000,
      });
      const back = JSON.parse(await h.value('#jc-out'));
      expect(back[1].nama === 'Budi, Jr' && back.length === 2, JSON.stringify(back));
      await h.type('#jc-in', '[{"a":');
      await h.click('JSON ke CSV');
      await h.sleep(300);
      expect(await h.bodyHas('JSON tidak valid'), 'pesan JSON tidak valid tidak tampil');
    },
  },
  {
    name: 'CSV ke JSON: nomor HP dan angka panjang tidak berubah',
    path: '/tools/json-ke-csv',
    async run(h) {
      await h.click('CSV ke JSON');
      await h.type('#jc-in', 'nama,hp,nik,umur\nAni,081234567890,3201234567890123456,20');
      await h.page.waitForFunction(() => document.querySelector('#jc-out').value.includes('Ani'), {
        timeout: 5000,
      });
      const [row] = JSON.parse(await h.value('#jc-out'));
      expect(
        row.hp === '081234567890' && row.nik === '3201234567890123456' && row.umur === 20,
        JSON.stringify(row),
      );
    },
  },
  {
    name: 'QR code terbaca kembali (jsQR) dan unduh SVG',
    path: '/tools/buat-qr-code',
    async run(h) {
      const url = 'https://julian-marcell.com/tools/gabung-pdf?uji=1';
      await h.type('#qr-text', url);
      await h.page.waitForSelector('img[src^="data:image/png"]');
      await h.sleep(300);
      const img = await h.page.$eval('img[src^="data:image/png"]', async (el) => {
        await el.decode();
        const c = document.createElement('canvas');
        c.width = el.naturalWidth;
        c.height = el.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(el, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        return { w: c.width, h: c.height, data: Array.from(d.data) };
      });
      const code = jsQR(Uint8ClampedArray.from(img.data), img.w, img.h);
      expect(code?.data === url, `isi QR: ${code?.data}`);
      await h.click('Unduh SVG');
      const fs = await import('node:fs');
      let files = [];
      for (let i = 0; i < 100 && !files.some((f) => f.endsWith('.svg')); i++) {
        await h.sleep(100);
        files = fs.readdirSync(h.downloads);
      }
      const svg = files.find((f) => f.endsWith('.svg'));
      expect(svg, `SVG tidak terunduh: ${files}`);
      const body = fs.readFileSync(`${h.downloads}/${svg}`, 'utf8');
      expect(body.startsWith('<svg') || body.includes('<svg'), body.slice(0, 80));
      return [`${img.w}×${img.h}, isi terbaca: ${code.data}`];
    },
  },
];
