import fs from 'node:fs';
import path from 'node:path';
import { expect } from '../expect.mjs';

async function ready(h) {
  expect(await h.page.evaluate(() => crossOriginIsolated), 'halaman tidak cross-origin isolated');
}

export const tests = [
  {
    name: 'video ke GIF (ffmpeg.wasm multi-thread)',
    path: '/tools/video-ke-gif',
    async run(h) {
      await ready(h);
      await h.upload('klip.mp4');
      await h.page.waitForSelector('video');
      await h.type('#gif-len', '1.5');
      await h.click('Buat GIF');
      const [c] = await h.results(1, 120000);
      expect(c.includes('klip.gif'), c);
      const gif = await h.download('klip.gif');
      expect(gif.subarray(0, 6).toString('latin1') === 'GIF89a', 'bukan GIF');
      expect(await h.bodyHas('Multi-thread aktif'), 'ffmpeg tidak multi-thread');
      return [c];
    },
  },
  {
    name: 'kompres video',
    path: '/tools/kompres-video',
    async run(h) {
      await ready(h);
      await h.upload('klip.mp4');
      await h.click('Kompres video');
      const [c] = await h.results(1, 120000);
      // Hasil lebih kecil diberi nama -kecil; jika tidak lebih kecil, file asli dipertahankan.
      expect(!c.includes('lebih besar'), `hasil lebih besar ditawarkan: ${c}`);
      const name = c.includes('klip-kecil.mp4') ? 'klip-kecil.mp4' : 'klip.mp4';
      if (name === 'klip.mp4') expect(c.includes('Sudah optimal'), c);
      const mp4 = await h.download(name);
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');
      return [c];
    },
  },
  {
    name: 'ekstrak audio dari video',
    path: '/tools/ekstrak-audio',
    async run(h) {
      await ready(h);
      await h.upload('klip.mp4');
      await h.click('Ekstrak audio');
      const [c] = await h.results(1, 120000);
      expect(c.includes('klip.mp3'), c);
      const mp3 = await h.download('klip.mp3');
      expect(mp3.length > 1000, 'MP3 kosong');
    },
  },
  {
    name: 'edit video: potong, teks, ekspor MP4, simpan dan buka .ayu',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('klip.mp4', 'foto.jpg');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      // Pindah ke tengah klip pertama lewat penggaris, lalu potong.
      const ruler = await page.$('[data-ruler]');
      const clipBox = await (await page.$('[data-clip]')).boundingBox();
      const rulerBox = await ruler.boundingBox();
      await ruler.click({ offset: { x: clipBox.x - rulerBox.x + clipBox.width / 2, y: 8 } });
      await page.click('[data-split]');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 3);
      await page.click('[data-add-text]');
      await h.type('[data-text-input]', 'Halo Toolland');
      await page.click('[data-export]');
      const [c] = await h.results(1, 180000);
      expect(c.includes('proyek-video.mp4'), c);
      const mp4 = await h.download('proyek-video.mp4');
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');

      // Simpan ringan: JSON proyek tanpa video.
      await page.click('[data-save]');
      const light = await h.downloadVia('proyek-video.ayu', () => page.click('[data-save-light]'));
      const doc = JSON.parse(light.toString('utf8'));
      expect(doc.format === 'toolland-ayu' && !doc.bundled, 'format .ayu ringan salah');
      expect(
        doc.project.clips.length === 3 && doc.project.texts[0].text === 'Halo Toolland',
        'isi proyek salah',
      );
      const lightPath = path.join(h.downloads, 'ringan.ayu');
      fs.renameSync(path.join(h.downloads, 'proyek-video.ayu'), lightPath);

      // Buka lagi: media harus disambungkan ulang.
      await page.goto(page.url(), { waitUntil: 'networkidle0' });
      await (await page.waitForSelector('[data-open-input]')).uploadFile(lightPath);
      await page.waitForSelector('[data-relink]');
      await (
        await page.$('[data-relink-input]')
      ).uploadFile(h.fixture('klip.mp4'), h.fixture('foto.jpg'));
      await page.waitForFunction(() => !document.querySelector('[data-relink]'));
      expect((await page.$$('[data-clip]')).length === 3, 'klip tidak kembali');

      // Simpan beserta video, lalu buka tanpa perlu menyambungkan ulang.
      await page.click('[data-save]');
      const bundle = await h.downloadVia('proyek-video.ayu', () =>
        page.click('[data-save-bundle]'),
      );
      expect(bundle.subarray(0, 2).toString('latin1') === 'PK', 'bukan arsip');
      await page.goto(page.url(), { waitUntil: 'networkidle0' });
      await (
        await page.waitForSelector('[data-open-input]')
      ).uploadFile(path.join(h.downloads, 'proyek-video.ayu'));
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 3);
      expect(!(await page.$('[data-relink]')), 'arsip meminta sambung ulang');
      return [c, `.ayu beserta video ${Math.round(bundle.length / 1024)} KB`];
    },
  },
];
