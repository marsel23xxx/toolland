import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { expect } from '../expect.mjs';

const pagesOf = async (buf) => (await PDFDocument.load(buf)).getPageCount();

export const tests = [
  {
    name: 'gabung PDF',
    path: '/tools/gabung-pdf',
    async run(h) {
      await h.upload('teks.pdf', 'foto.pdf');
      await h.page.waitForFunction(() => document.body.innerText.includes('6 halaman'), {
        timeout: 15000,
      });
      await h.click('Gabung PDF');
      await h.results(1);
      const out = await h.download('gabungan.pdf');
      expect((await pagesOf(out)) === 6, 'jumlah halaman gabungan salah');
    },
  },
  {
    name: 'PDF rusak memberi pesan jelas',
    path: '/tools/gabung-pdf',
    async run(h) {
      await h.upload('bukan.pdf');
      await h.page.waitForFunction(() => document.body.innerText.includes('bukan PDF yang valid'), {
        timeout: 15000,
      });
    },
  },
  {
    name: 'pisah PDF per rentang',
    path: '/tools/pisah-pdf',
    async run(h) {
      await h.upload('teks.pdf');
      await h.page.waitForSelector('#sp-ranges');
      await h.type('#sp-ranges', '1-2, 4');
      await h.click('Pisah PDF');
      const cards = await h.results(2);
      expect(
        cards[0].includes('teks-hal-1-2.pdf') && cards[1].includes('teks-hal-4.pdf'),
        cards.join(' | '),
      );
      const out = await h.download('teks-hal-1-2.pdf');
      expect((await pagesOf(out)) === 2, 'halaman hasil pisah salah');
      await h.type('#sp-ranges', '9');
      await h.click('Pisah PDF');
      expect(await h.bodyHas('Rentang tidak valid'), 'validasi rentang tidak muncul');
    },
  },
  {
    name: 'kompres PDF berisi foto',
    path: '/tools/kompres-pdf',
    async run(h) {
      await h.page.select('#pc-level', 'high');
      await h.upload('foto.pdf');
      const [c] = await h.results(1);
      expect(/hemat \d+%/.test(c) && c.includes('1 dari 1 gambar'), c);
      const out = await h.download('foto-kecil.pdf');
      expect((await pagesOf(out)) === 2, 'PDF hasil kompres rusak');
      return [c];
    },
  },
  {
    name: 'PDF ke JPG (pdf.js)',
    path: '/tools/pdf-ke-jpg',
    async run(h) {
      await h.upload('teks.pdf');
      const cards = await h.results(4, 30000);
      expect(cards.length === 4 && cards[0].includes('teks-hal-1.jpg'), cards.join(' | '));
    },
  },
  {
    name: 'JPG ke PDF (foto berotasi EXIF)',
    path: '/tools/jpg-ke-pdf',
    async run(h) {
      await h.upload('putar-90.jpg', 'foto.webp');
      await h.click('Buat PDF');
      await h.results(1);
      const doc = await PDFDocument.load(await h.download('gambar.pdf'));
      const [w, h1] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
      // putar-90.jpg aslinya lanskap 800x600; setelah rotasi EXIF menjadi potret, jadi halaman A4 potret
      expect(doc.getPageCount() === 2 && w < h1, `halaman ${doc.getPageCount()}, ${w}x${h1}`);
    },
  },
  {
    name: 'watermark PDF',
    path: '/tools/watermark-pdf',
    async run(h) {
      await h.upload('teks.pdf');
      await h.click('Tambahkan watermark');
      await h.results(1);
      const out = await h.download('teks-watermark.pdf');
      expect(
        out.toString('latin1').includes('RAHASIA') || (await pagesOf(out)) === 4,
        'watermark tidak tersimpan',
      );
    },
  },
  {
    name: 'nomor halaman PDF (halaman berotasi)',
    path: '/tools/nomor-halaman-pdf',
    async run(h) {
      await h.upload('teks.pdf');
      await h.page.select('#pn-fmt', 'Halaman {n} dari {total}');
      await h.click('Tambahkan nomor halaman');
      await h.results(1);
      const out = await h.download('teks-bernomor.pdf');
      expect((await pagesOf(out)) === 4, 'jumlah halaman berubah');
    },
  },
  {
    name: 'tanda tangan PDF: gores miring dirapikan, lalu ditempel',
    path: '/tools/tanda-tangan-pdf',
    async run(h) {
      await h.upload('teks.pdf');
      await h.page.waitForSelector('canvas[aria-label]', { timeout: 20000 });
      await h.page.waitForFunction(
        () => document.querySelectorAll('[data-page] img').length === 4,
        { timeout: 20000 },
      );
      const pad = await h.page.$('canvas[aria-label]');
      const box = await pad.boundingBox();
      // Goresan mouse yang miring ±20° dan bergetar, seperti ttd pakai mouse.
      await h.page.mouse.move(box.x + 30, box.y + 140);
      await h.page.mouse.down();
      for (let i = 0; i < 40; i++)
        await h.page.mouse.move(
          box.x + 30 + i * 9,
          box.y + 140 - i * 3.3 + Math.sin(i * 1.3) * 10 + (i % 2 ? 2 : -2),
        );
      await h.page.mouse.up();
      const ratio = () =>
        h.page.$eval('img[data-signature]', async (img) => {
          await img.decode();
          return img.naturalWidth / img.naturalHeight;
        });
      await h.page.waitForSelector('img[data-signature]');
      const tidy = await ratio();
      await h.page.click('input[type=checkbox]');
      await h.page.waitForFunction(
        (r) => {
          const img = document.querySelector('img[data-signature]');
          return img?.complete && Math.abs(img.naturalWidth / img.naturalHeight - r) > 0.01;
        },
        {},
        tidy,
      );
      const raw = await ratio();
      // Versi rapi diluruskan, jadi lebih memanjang ke samping daripada goresan aslinya.
      expect(
        tidy > raw * 1.4,
        `rapikan tidak meluruskan: rapi ${tidy.toFixed(2)}, asli ${raw.toFixed(2)}`,
      );
      await h.page.click('input[type=checkbox]');

      await h.click('Urungkan');
      await h.page.waitForFunction(() => !document.querySelector('img[data-signature]'));
      await h.page.mouse.move(box.x + 30, box.y + 100);
      await h.page.mouse.down();
      for (let i = 0; i < 20; i++)
        await h.page.mouse.move(box.x + 30 + i * 12, box.y + 100 + Math.sin(i) * 30);
      await h.page.mouse.up();
      await h.page.waitForSelector('img[data-signature]');

      const page2 = await h.page.$('[data-page="2"]');
      await page2.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b2 = await page2.boundingBox();
      await h.page.mouse.click(b2.x + b2.width * 0.6, b2.y + b2.height * 0.45);
      await h.page.waitForSelector('[data-page="2"] [role=group]');
      await h.click('Simpan PDF');
      await h.results(1);
      const out = await h.download('teks-ttd.pdf');
      expect((await pagesOf(out)) === 4 && out.length > 3000, 'PDF bertanda tangan tidak valid');
    },
  },
  {
    name: 'tanda tangan PDF: foto ttd di kertas berbayang',
    path: '/tools/tanda-tangan-pdf',
    async run(h) {
      // Foto buatan: kertas abu-abu dengan bayangan, ttd miring ±12°, disimpan sebagai JPEG.
      const jpg = await h.page.evaluate(() => {
        const c = document.createElement('canvas');
        c.width = 900;
        c.height = 600;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 900, 0);
        g.addColorStop(0, '#eeeae2');
        g.addColorStop(1, '#9d988f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 900, 600);
        ctx.translate(450, 300);
        ctx.rotate((-12 * Math.PI) / 180);
        ctx.strokeStyle = '#1d2333';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-300, 20);
        for (let x = -300; x <= 300; x += 10) ctx.lineTo(x, 20 + Math.sin(x / 25) * 45);
        ctx.stroke();
        return c.toDataURL('image/jpeg', 0.85).split(',')[1];
      });
      fs.writeFileSync(h.fixture('ttd-kertas.jpg'), Buffer.from(jpg, 'base64'));

      await h.upload('teks.pdf');
      await h.page.waitForFunction(
        () => document.querySelectorAll('[data-page] img').length === 4,
        { timeout: 20000 },
      );
      await h.click('Foto ttd');
      const input = await h.page.$('input[type=file][accept="image/*"]');
      await input.uploadFile(h.fixture('ttd-kertas.jpg'));
      await h.page.waitForSelector('img[data-signature]', { timeout: 15000 });
      const sig = await h.page.$eval('img[data-signature]', async (img) => {
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let clear = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
        return { ratio: c.width / c.height, clear: clear / (d.length / 4), corner: d[3] };
      });
      // Kertas dan bayangan transparan, ttd diluruskan (lebar jauh melebihi tinggi).
      expect(
        sig.corner === 0 && sig.clear > 0.5,
        `kertas tidak transparan: ${JSON.stringify(sig)}`,
      );
      expect(sig.ratio > 4, `ttd foto tidak diluruskan: rasio ${sig.ratio.toFixed(2)}`);

      const page1 = await h.page.$('[data-page="1"]');
      await page1.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const b1 = await page1.boundingBox();
      await h.page.mouse.click(b1.x + b1.width * 0.5, b1.y + b1.height * 0.5);
      await h.page.waitForSelector('[data-page="1"] [role=group]');
      await h.click('Simpan PDF');
      await h.results(1);
      const out = await h.download('teks-ttd.pdf');
      expect((await pagesOf(out)) === 4, 'PDF bertanda tangan tidak valid');
      const png = await h.downloadVia('tanda-tangan.png', () => h.click('Unduh PNG'));
      expect(png.subarray(1, 4).toString('latin1') === 'PNG', 'bukan PNG');
    },
  },
];
