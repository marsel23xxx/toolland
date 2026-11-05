import { expect } from '../expect.mjs';

export const tests = [
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
    name: 'ubah ukuran: preset Instagram',
    path: '/tools/ubah-ukuran-gambar',
    async run(h) {
      await h.click('Preset media sosial');
      await h.upload('foto.jpg');
      const [c] = await h.results(1);
      expect(c.includes('1080×1080'), c);
    },
  },
  {
    name: 'pas foto 3x4 (cropperjs)',
    path: '/tools/pas-foto',
    async run(h) {
      await h.upload('foto.jpg');
      await h.page.waitForSelector('cropper-selection', { timeout: 15000 });
      await h.sleep(500);
      await h.click('Potong dan simpan');
      const [c] = await h.results(1);
      expect(c.includes('354×472'), c);
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
  {
    name: 'potong gambar (tab di Ubah Ukuran)',
    path: '/tools/ubah-ukuran-gambar',
    async run(h) {
      await h.page.click('[data-tab="crop"]');
      await h.page.waitForSelector('input[type=file]');
      await h.upload('foto.jpg');
      await h.page.waitForSelector('cropper-selection', { timeout: 15000 });
      await h.sleep(500);
      await h.click('1:1');
      await h.sleep(300);
      await h.click('Potong dan simpan');
      const [c] = await h.results(1);
      const m = /(\d+)×(\d+)/.exec(c);
      expect(m && m[1] === m[2], c);
    },
  },
];
