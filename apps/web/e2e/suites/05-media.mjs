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
    name: 'edit video: di HP hanya keterangan, editor tidak dibuka',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      expect(!(await page.$('[data-desktop-only]')), 'keterangan muncul di desktop');
      await page.setViewport({ width: 390, height: 844 });
      await page.waitForSelector('[data-desktop-only]');
      expect(!(await page.$('[data-editor]')), 'editor tetap terbuka di HP');
      expect(await h.bodyHas('hanya bisa dibuka di desktop'), 'teks keterangan tidak ada');
      // Tablet mendatar (1024 px) membuka editor lagi.
      await page.setViewport({ width: 1024, height: 768 });
      await page.waitForSelector('[data-editor]');
    },
  },
  {
    name: 'edit video: timeline interaktif (tarik, geser, scrub, menu, keyboard)',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      const drag = async (x1, y1, x2, y2) => {
        await page.mouse.move(x1, y1);
        await page.mouse.down();
        await page.mouse.move(x2, y2, { steps: 12 });
        await page.mouse.up();
      };
      const clips = () =>
        page.$$eval('[data-clip]', (els) =>
          els
            .map((e) => ({
              media: e.dataset.media,
              len: Number(e.dataset.len),
              x: e.getBoundingClientRect().x,
            }))
            .sort((a, b) => a.x - b.x),
        );
      await h.upload('klip.mp4', 'foto.jpg');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      await page.$eval('[data-tl]', (e) => e.scrollIntoView({ block: 'center' }));
      // Filmstrip video muncul.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-clip] span')].filter((s) =>
            s.style.backgroundImage.startsWith('url("blob:'),
          ).length > 2,
        { timeout: 30000 },
      );
      const before = await clips();

      // Tarik ujung kanan klip pertama ke kiri: klip lebih pendek.
      const out = await (await page.$('[data-clip] [data-trim="out"]')).boundingBox();
      await drag(out.x + 4, out.y + 20, out.x + 4 - 60, out.y + 20);
      const trimmed = await clips();
      expect(trimmed[0].len < before[0].len - 0.2, `potong: ${before[0].len} -> ${trimmed[0].len}`);

      // Geser klip kedua (foto) ke awal.
      const firstBox = await (
        await page.$(`[data-clip][data-media="${before[0].media}"]`)
      ).boundingBox();
      const second = await (
        await page.$(`[data-clip][data-media="${before[1].media}"]`)
      ).boundingBox();
      await drag(second.x + second.width / 2, second.y + 30, firstBox.x + 3, second.y + 30);
      await page.waitForFunction(
        (m) => {
          const els = [...document.querySelectorAll('[data-clip]')].sort(
            (a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x,
          );
          return els[0]?.dataset.media === m;
        },
        { timeout: 5000 },
        before[1].media,
      );

      // Scrub di penggaris mengubah waktu.
      const ruler = await (await page.$('[data-ruler]')).boundingBox();
      await drag(ruler.x + 20, ruler.y + 10, ruler.x + ruler.width * 0.5, ruler.y + 10);
      const shown = await h.text('[data-time]');
      expect(!shown.startsWith('0:00 /'), `scrub: ${shown}`);

      // Keyboard: Home lalu Shift+→ = 1 detik.
      await page.keyboard.press('Home');
      await page.keyboard.down('Shift');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.up('Shift');
      expect((await h.text('[data-time]')).startsWith('0:01 /'), await h.text('[data-time]'));

      // Teks: geser bar teks ke kanan.
      await page.keyboard.press('Home');
      await page.click('[data-add-text]');
      const bar = await (await page.$('[data-text]')).boundingBox();
      await drag(bar.x + bar.width / 2, bar.y + 8, bar.x + bar.width / 2 + 80, bar.y + 8);
      expect(Number(await h.value('#ed-ts')) > 0.2, `teks mulai ${await h.value('#ed-ts')}`);

      // Menu klik kanan: duplikat klip.
      const first = await (await page.$('[data-clip]')).boundingBox();
      await page.mouse.click(first.x + first.width / 2, first.y + 30, { button: 'right' });
      await page.click('[data-menu="duplicate"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 3);

      // Undo mengembalikan langkah terakhir.
      await page.click('[data-undo]');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2);
    },
  },
  {
    name: 'edit video: panel klip (kecepatan, warna, bingkai, latar) sampai ekspor',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('klip.mp4', 'foto.jpg');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      const lenOf = () => page.$eval('[data-clip]', (e) => Number(e.dataset.len));
      const before = await lenOf();
      // Klip video: kecepatan 2× membuat klip setengah panjang.
      await page.click('[data-clip]');
      await page.click('[data-speed="2"]');
      await page.waitForFunction(
        (b) => Math.abs(Number(document.querySelector('[data-clip]').dataset.len) - b / 2) < 0.01,
        {},
        before,
      );
      await page.click('[data-preset="bw"]');
      await page.click('[data-fit="blur"]');
      await page.click('[data-rotate]');
      await page.click('[data-mute]');
      // Pratinjau memakai filter warna SVG dan latar blur.
      await page.waitForSelector('[data-stage] filter feColorMatrix');
      await page.waitForSelector('[data-stage] canvas.object-cover');
      // Foto: Ken Burns dan warna latar proyek.
      await (await page.$$('[data-clip]'))[1].click();
      await page.select('[data-ken-burns]', 'in');
      await page.click('[data-tab="media"]');
      await h.type('[data-bg]', '#224488');
      await page.click('[data-export]');
      const [c] = await h.results(1, 180000);
      const mp4 = await h.download('proyek-video.mp4');
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');
      // Simpan ringan: pengaturan baru ikut tersimpan (versi 2).
      await page.click('[data-save]');
      const light = await h.downloadVia('proyek-video.ayu', () => page.click('[data-save-light]'));
      const doc = JSON.parse(light.toString('utf8'));
      const [v, img] = doc.project.clips;
      expect(doc.version >= 4, `versi ${doc.version}`);
      expect(
        v.speed === 2 && v.preset === 'bw' && v.fit === 'blur' && v.rotate === 90 && v.volume === 0,
        JSON.stringify(v),
      );
      expect(img.kenBurns === 'in' && doc.project.settings.bg === '#224488', JSON.stringify(img));
      return [c];
    },
  },
  {
    name: 'edit video: crossfade bertumpuk (pratinjau dua lapisan dan ekspor xfade)',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('klip.mp4', 'foto.jpg');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      const totalText = () => h.text('[data-time]').then((s) => s.split('/')[1].trim());
      const before = await totalText();
      await page.click('[data-clip]');
      await page.select('[data-transition]', 'cross');
      // Durasi total berkurang (klip bertumpuk).
      await page.waitForFunction(
        (b) => document.querySelector('[data-time]').innerText.split('/')[1].trim() !== b,
        {},
        before,
      );
      // Di tengah transisi kedua lapisan terlihat.
      const second = await page.$$eval('[data-clip]', (els) =>
        Math.min(...els.map((e) => e.getBoundingClientRect().x).filter((x, i) => i === 1)),
      );
      const rulerBox = await (await page.$('[data-ruler]')).boundingBox();
      await page.mouse.click(second + 6, rulerBox.y + 10);
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('[data-layer]')].filter(
            (l) => getComputedStyle(l).visibility === 'visible',
          ).length === 2,
        { timeout: 5000 },
      );
      await page.click('[data-export]');
      const [c] = await h.results(1, 180000);
      const mp4 = await h.download('proyek-video.mp4');
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');
      return [c, `${before} -> ${await totalText()}`];
    },
  },
  {
    name: 'edit video: overlay (stiker, geser/ubah ukuran di pratinjau, video PiP) sampai ekspor',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('foto.jpg', 'klip.mp4');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      // Stiker emoji muncul di jalur overlay dan pratinjau.
      await page.click('[data-tab="overlay"]');
      await page.click('[data-emoji="⭐"]');
      await page.waitForSelector('[data-overlay-bar]');
      const sticker = await page.waitForSelector('[data-stage] [data-overlay]');
      // Geser stiker ke kiri atas, lalu perbesar lewat titik sudut.
      const b = await sticker.boundingBox();
      const stage = await (await page.$('[data-stage]')).boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width * 0.2, stage.y + stage.height * 0.3, {
        steps: 8,
      });
      await page.mouse.up();
      const x = Number(await h.value('[data-overlay-slider="x"]'));
      expect(x > 0.15 && x < 0.25, `posisi x ${x}`);
      const handle = await (await page.$('[data-overlay-resize]')).boundingBox();
      await page.mouse.move(handle.x + 6, handle.y + 6);
      await page.mouse.down();
      await page.mouse.move(handle.x + 66, handle.y + 6, { steps: 6 });
      await page.mouse.up();
      const w = Number(await h.value('[data-overlay-slider="w"]'));
      expect(w > 0.2, `ukuran ${w}`);
      // Video jadi overlay PiP dari galeri.
      await page.click('[data-tab="media"]');
      const vid = await page.$$eval('[data-as-overlay]', (els) =>
        els.map((e) => e.dataset.asOverlay),
      );
      await page.click(`[data-as-overlay="${vid[1]}"]`);
      await page.waitForFunction(
        () => document.querySelectorAll('[data-overlay-bar]').length === 2,
      );
      await page.click('[data-layer-down]');
      await page.click('[data-export]');
      const [c] = await h.results(1, 180000);
      const mp4 = await h.download('proyek-video.mp4');
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');
      await page.click('[data-save]');
      const light = await h.downloadVia('proyek-video.ayu', () => page.click('[data-save-light]'));
      const doc = JSON.parse(light.toString('utf8'));
      const kinds = doc.project.overlays.map((o) => o.kind).join(',');
      expect(doc.version >= 5 && kinds === 'media,emoji', `versi ${doc.version}, urutan ${kinds}`);
      return [c];
    },
  },
  {
    name: 'edit video: rekam narasi (mikrofon uji), ekspor, simpan beserta rekaman',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('foto.jpg', 'klip.mp4');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      await page.click('[data-tab="music"]');
      await page.click('[data-record]');
      await page.waitForSelector('[data-record-stop]', { timeout: 10000 });
      await h.sleep(1500);
      await page.click('[data-record-stop]');
      await page.waitForSelector('[data-audio-bar]', { timeout: 10000 });
      // Simpan ringan memberi peringatan karena rekaman tidak ada di perangkat.
      await page.click('[data-save]');
      expect(await h.bodyHas('narasi rekaman'), 'peringatan rekaman tidak muncul');
      await page.click('[data-save]');
      await page.click('[data-export]');
      const [c] = await h.results(1, 180000);
      const mp4 = await h.download('proyek-video.mp4');
      expect(mp4.subarray(4, 8).toString('latin1') === 'ftyp', 'bukan MP4');
      // Beserta video: rekaman ikut tersimpan dan terbuka lagi tanpa sambung ulang.
      await page.click('[data-save]');
      const bundle = await h.downloadVia('proyek-video.ayu', () =>
        page.click('[data-save-bundle]'),
      );
      expect(bundle.subarray(0, 2).toString('latin1') === 'PK', 'bukan arsip');
      await page.goto(page.url(), { waitUntil: 'networkidle0' });
      await (
        await page.waitForSelector('[data-open-input]')
      ).uploadFile(path.join(h.downloads, 'proyek-video.ayu'));
      await page.waitForSelector('[data-audio-bar]', { timeout: 10000 });
      expect(!(await page.$('[data-relink]')), 'rekaman meminta sambung ulang');
      return [c];
    },
  },
  {
    name: 'edit video: panel teks (gaya, font, animasi) dan galeri seret ke timeline',
    path: '/tools/edit-video',
    async run(h) {
      const { page } = h;
      await ready(h);
      await h.upload('klip.mp4', 'foto.jpg');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2, {
        timeout: 30000,
      });
      // Seret foto dari galeri ke awal timeline.
      await page.evaluate(() => {
        const items = document.querySelectorAll('[data-media-item]');
        const item = items[items.length - 1];
        const tl = document.querySelector('[data-tl]');
        const r = tl.getBoundingClientRect();
        const dt = new DataTransfer();
        item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
        const at = {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: r.left + 14,
          clientY: r.top + 40,
        };
        tl.dispatchEvent(new DragEvent('dragover', at));
        tl.dispatchEvent(new DragEvent('drop', at));
      });
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 3);
      await page.click('[data-tab="media"]');
      const usedBadge = await page.$eval('[data-gallery]', (g) => g.innerText.includes('2×'));
      expect(usedBadge, 'penanda pemakaian 2× tidak muncul');

      // Teks: gaya Judul, font Pacifico, animasi masuk Naik.
      await page.click('[data-add-text]');
      await page.click('[data-text-style="title"]');
      expect((await h.value('#ed-tz')) === 'l', 'gaya judul tidak diterapkan');
      await page.click('[data-font="pacifico"]');
      await page.select('[data-anim-in]', 'fade');
      await page.click('[data-text-box]');
      await page.waitForSelector('#ed-bo');
      // Font Pacifico termuat.
      await page.waitForFunction(() => document.fonts.check('400 20px "Pacifico"'), {
        timeout: 10000,
      });
      await page.click('[data-save]');
      const light = await h.downloadVia('proyek-video.ayu', () => page.click('[data-save-light]'));
      const doc = JSON.parse(light.toString('utf8'));
      const t = doc.project.texts[0];
      expect(doc.version >= 4, `versi ${doc.version}`);
      expect(
        t.font === 'pacifico' && t.animIn === 'fade' && t.box === true && t.size === 'l',
        JSON.stringify(t),
      );
      expect(doc.project.clips[0].mediaId !== doc.project.clips[1].mediaId, 'foto tidak disisip');
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
      // Undo mengembalikan potongan, redo mengulanginya.
      await h.sleep(500);
      await page.click('[data-undo]');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 2);
      await page.click('[data-redo]');
      await page.waitForFunction(() => document.querySelectorAll('[data-clip]').length === 3);
      // Transisi dari klip pertama.
      await page.click('[data-clip]');
      await page.select('[data-transition]', 'black');
      await page.waitForSelector('[data-trans-mark]');
      // Layar penuh menutupi seluruh jendela.
      await page.click('[data-fullscreen]');
      const box = await (await page.$('[data-editor]')).boundingBox();
      expect(box.width >= 1270 && box.y <= 1, `layar penuh ${JSON.stringify(box)}`);
      await page.click('[data-fullscreen]');
      await page.click('[data-add-text]');
      await h.type('[data-text-input]', 'Halo Toolland');
      // Geser teks di pratinjau: posisi jadi bebas.
      const stage = await (await page.$('[data-stage]')).boundingBox();
      await page.mouse.click(stage.x + stage.width * 0.3, stage.y + stage.height * 0.25);
      expect((await h.value('#ed-tp')) === 'custom', 'teks tidak pindah ke posisi bebas');
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
      expect(doc.project.clips[0].trans === 'black', 'transisi tidak tersimpan');
      expect(Math.abs(doc.project.texts[0].x - 0.3) < 0.02, 'posisi teks tidak tersimpan');
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
