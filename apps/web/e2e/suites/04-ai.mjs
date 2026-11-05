import fs from 'node:fs';
import { expect } from '../expect.mjs';

const hasFace = (h) => fs.existsSync(h.fixture('wajah.jpg'));

export const tests = [
  {
    name: 'hapus background (model AI lokal, worker, multi-thread)',
    path: '/tools/hapus-background',
    async run(h) {
      if (!hasFace(h)) return ['dilewati: foto uji tidak tersedia (offline)'];
      expect(
        await h.page.evaluate(() => crossOriginIsolated),
        'halaman tidak cross-origin isolated',
      );
      const t0 = Date.now();
      await h.upload('wajah.jpg');
      await h.page.waitForFunction(
        () => document.querySelectorAll('ul.grid .checker img').length === 1,
        {
          timeout: 180000,
        },
      );
      const first = (Date.now() - t0) / 1000;
      const out = await h.page.$eval('ul.grid .checker img', async (img) => {
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const corner = ctx.getImageData(5, 5, 1, 1).data[3];
        const center = ctx.getImageData(c.width / 2, c.height * 0.25, 1, 1).data[3];
        return { w: c.width, h: c.height, corner, center };
      });
      // pojok (latar) transparan, wajah di tengah atas tetap utuh
      expect(out.corner < 20 && out.center > 200, JSON.stringify(out));
      const device = await h.page.evaluate(() =>
        document.body.innerText.includes('Memakai GPU') ? 'GPU' : 'CPU',
      );
      return [`${out.w}×${out.h}, ${device}, ${first.toFixed(1)} dtk termasuk memuat model`];
    },
  },
];
