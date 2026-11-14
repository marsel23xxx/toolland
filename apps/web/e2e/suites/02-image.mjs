import fs from 'node:fs';
import { expect } from '../expect.mjs';

/** Buat File PNG di halaman lalu kirim lewat event paste atau drop (seperti pengguna sungguhan). */
async function sendFile(h, how, name = 'tempel.png', type = 'image/png') {
  await h.page.evaluate(
    async (how, name, type) => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#a8461f';
      ctx.fillRect(0, 0, 320, 200);
      const blob =
        type === 'image/png'
          ? await new Promise((r) => c.toBlob(r, 'image/png'))
          : new Blob(['bukan gambar'], { type });
      const dt = new DataTransfer();
      dt.items.add(new File([blob], name, { type }));
      if (how === 'paste') {
        window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
      } else {
        const zone = document.querySelector('input[type=file]').parentElement;
        for (const t of ['dragenter', 'dragover', 'drop'])
          zone.dispatchEvent(
            new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }),
          );
      }
    },
    how,
    name,
    type,
  );
}

export const tests = [
  {
    name: 'kolase foto: tata letak, tukar posisi, zoom, latar, unduh PNG',
    path: '/tools/kolase-foto',
    async run(h) {
      const { page } = h;
      await h.upload('foto.jpg', 'kecil.jpg', 'foto.webp');
      await page.waitForSelector('[data-cl-canvas]');
      const names = () => page.$$eval('[data-cl-photos] img', (els) => els.map((e) => e.alt));
      expect((await names()).length === 3, 'jumlah foto salah');
      // Tambah foto ke-4 lalu buang lagi: tata letak menyesuaikan jumlah foto.
      await (await page.$('[data-cl-add]')).uploadFile(h.fixture('foto.avif'));
      await page.waitForFunction(
        () => document.querySelectorAll('[data-cl-photos] img').length === 4,
      );
      const xs = await page.$$('[data-cl-remove]');
      await xs[xs.length - 1].click();
      await page.waitForFunction(
        () => document.querySelectorAll('[data-cl-photos] img').length === 3,
      );
      await page.click('[data-cl-ratio="1:1"]');
      await page.click('[data-cl-layout="feature-left"]');
      // Seret foto 1 (kotak besar kiri) ke kotak 2 (kanan atas): posisinya ditukar.
      const before = await names();
      const cv = await (await page.$('[data-cl-canvas]')).boundingBox();
      await page.mouse.move(cv.x + cv.width * 0.3, cv.y + cv.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(cv.x + cv.width * 0.8, cv.y + cv.height * 0.25, { steps: 12 });
      await page.mouse.up();
      const after = await names();
      expect(after[0] === before[1] && after[1] === before[0], `tidak tertukar: ${after}`);
      // Kotak terpilih punya kontrol zoom.
      await page.waitForSelector('[data-cl-zoom]');
      await h.type('#cl-zoom', '2');
      // Latar merah dan jarak lebar, unduh PNG.
      await h.type('#cl-gap', '40');
      await page.$eval('[data-cl-bg]', (el) => {
        el.value = '#ff0000';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.select('#cl-fmt', 'png');
      await page.click('[data-cl-save]');
      await h.results(1);
      const png = await h.download('kolase-foto.png');
      const px = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const at = (x, y) => [...ctx.getImageData(x, y, 1, 1).data.slice(0, 3)];
        return { w: c.width, h: c.height, corner: at(10, 10), cell: at(300, 540) };
      }, png.toString('base64'));
      expect(px.w === 1080 && px.h === 1080, `ukuran ${px.w}x${px.h}`);
      expect(JSON.stringify(px.corner) === '[255,0,0]', `latar ${px.corner}`);
      expect(JSON.stringify(px.cell) !== '[255,0,0]', 'foto tidak tergambar');
    },
  },
  {
    name: 'JPG ke WebP, batch 6 file + ZIP',
    path: '/tools/jpg-ke-webp',
    async run(h) {
      const t0 = Date.now();
      await h.upload(...[1, 2, 3, 4, 5, 6].map((i) => `batch-${i}.jpg`));
      const cards = await h.results(6);
      expect(
        cards.every((c) => /\.webp 1600×1200/.test(c)),
        cards[0],
      );
      await h.click('Unduh semua (ZIP)');
      return [`6 × 1600×1200 dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`, cards[0]];
    },
  },
  {
    name: 'PNG transparan ke JPG',
    path: '/tools/png-ke-jpg',
    async run(h) {
      await h.upload('transparan.png');
      const [c] = await h.results(1);
      expect(c.includes('transparan.jpg 400×300'), c);
    },
  },
  {
    name: 'AVIF ke JPG',
    path: '/tools/avif-ke-jpg',
    async run(h) {
      await h.upload('foto.avif');
      const [c] = await h.results(1);
      expect(c.includes('foto.jpg 800×600'), c);
    },
  },
  {
    name: 'kompres gambar dengan batas sisi',
    path: '/tools/kompres-gambar',
    async run(h) {
      await h.page.select('#cmp-side', '1024');
      await h.upload('foto.jpg');
      const [c] = await h.results(1);
      expect(c.includes('1024×768'), c);
      return [c];
    },
  },
  {
    name: 'gambar ke Base64 (tab di halaman Base64)',
    path: '/tools/base64-encode-decode',
    async run(h) {
      await h.page.click('[data-tab="image"]');
      await h.page.waitForSelector('input[type=file]');
      await h.upload('transparan.png');
      await h.page.waitForSelector('li.card textarea');
      const v = await h.page.$eval('li.card textarea', (e) => e.value);
      expect(v.startsWith('data:image/png;base64,iVBOR'), v.slice(0, 40));
    },
  },
  ...[
    [
      'JPG ke AVIF',
      '/tools/jpg-ke-avif',
      'foto.jpg',
      'foto.avif',
      (b) => b.subarray(4, 12).toString('latin1') === 'ftypavif',
    ],
    [
      'PNG ke WebP (transparan)',
      '/tools/png-ke-webp',
      'transparan.png',
      'transparan.webp',
      (b) => b.subarray(8, 12).toString('latin1') === 'WEBP',
    ],
    [
      'WebP ke JPG',
      '/tools/webp-ke-jpg',
      'foto.webp',
      'foto.jpg',
      (b) => b[0] === 0xff && b[1] === 0xd8,
    ],
    [
      'WebP ke PNG',
      '/tools/webp-ke-png',
      'foto.webp',
      'foto.png',
      (b) => b.subarray(1, 4).toString('latin1') === 'PNG',
    ],
    [
      'HEIC ke JPG (libheif)',
      '/tools/heic-ke-jpg',
      'contoh.heic',
      'contoh.jpg',
      (b) => b[0] === 0xff && b[1] === 0xd8,
    ],
  ].map(([name, path, input, output, check]) => ({
    name: `${name}: isi file hasil valid`,
    path,
    async run(h) {
      if (!fs.existsSync(h.fixture(input))) return [`dilewati: ${input} tidak tersedia (offline)`];
      await h.upload(input);
      const [c] = await h.results(1, 90000);
      expect(c.includes(output), c);
      const buf = await h.download(output);
      expect(
        check(buf),
        `${output} bukan format yang benar (${buf.subarray(0, 12).toString('hex')})`,
      );
      return [c];
    },
  })),
  {
    name: 'kotak upload: tempel (Ctrl+V) dan tarik-lepas',
    path: '/tools/kompres-gambar',
    async run(h) {
      await sendFile(h, 'paste', 'tempel.png');
      await h.results(1);
      await sendFile(h, 'drop', 'tarik.png');
      const cards = await h.results(2);
      expect(
        cards.some((c) => c.includes('tempel')) && cards.some((c) => c.includes('tarik')),
        cards.join(' | '),
      );
    },
  },
  {
    name: 'kotak upload menolak file yang bukan gambar',
    path: '/tools/kompres-gambar',
    async run(h) {
      await sendFile(h, 'drop', 'catatan.txt', 'text/plain');
      await h.sleep(300);
      const t = await h.text('main');
      expect(t.includes('catatan.txt'), `penolakan tidak tampil: ${t.slice(0, 300)}`);
      const cards = await h.page.$$('li.card button[aria-label^="Hapus"]');
      expect(cards.length === 0, 'file teks ikut diproses');
    },
  },
];
