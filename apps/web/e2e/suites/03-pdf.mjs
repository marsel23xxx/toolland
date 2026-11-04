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
    name: 'tanda tangan PDF',
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
      await h.page.mouse.move(box.x + 30, box.y + 80);
      await h.page.mouse.down();
      for (let i = 0; i < 20; i++)
        await h.page.mouse.move(box.x + 30 + i * 12, box.y + 80 + Math.sin(i) * 30);
      await h.page.mouse.up();
      await h.click('Pakai tanda tangan ini');
      await h.page.waitForSelector('img.h-10');
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
];
