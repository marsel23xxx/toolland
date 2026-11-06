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
];
