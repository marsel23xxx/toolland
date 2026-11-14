import fs from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
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
    name: 'atur halaman PDF: hapus, putar, seret, keyboard, simpan',
    path: '/tools/atur-halaman-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('teks.pdf');
      await page.waitForFunction(
        () => document.querySelectorAll('[data-org-grid] img').length === 4,
        {
          timeout: 20000,
        },
      );
      expect(
        await page.$eval('[data-org-reset]', (b) => b.disabled),
        'reset aktif sebelum ada perubahan',
      );
      const order = () =>
        page.$$eval('[data-org-pos]', (els) => els.map((e) => +e.dataset.orgIndex));
      // Hapus halaman 2, putar halaman 1 ke kanan.
      await page.click('[data-org-pos="1"] [data-org-del]');
      await page.click('[data-org-pos="0"] [data-org-cw]');
      expect(
        (await page.$eval('[data-org-pos="0"]', (e) => e.dataset.orgRotate)) === '90',
        'halaman 1 tidak berputar',
      );
      // Seret halaman 4 (posisi 3 setelah dihapus = 2) ke depan dengan mouse.
      const box = async (pos) => (await page.$(`[data-org-pos="${pos}"] img`)).boundingBox();
      const a = await box(2);
      const b = await box(0);
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
      await page.mouse.up();
      expect(JSON.stringify(await order()) === '[3,0,2]', `urutan setelah seret ${await order()}`);
      // Keyboard: panah kanan pada pegangan memindah halaman satu posisi.
      await page.focus('[data-org-pos="0"] [data-org-handle]');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowLeft');
      expect(
        JSON.stringify(await order()) === '[3,0,2]',
        `urutan setelah keyboard ${await order()}`,
      );
      await page.click('[data-org-save]');
      await h.results(1);
      const out = await h.download('teks-diatur.pdf');
      const doc = await PDFDocument.load(out);
      // Halaman 3 asli sudah berputar 90°; halaman 1 ditambah 90°.
      const rot = doc.getPages().map((p) => p.getRotation().angle);
      expect(JSON.stringify(rot) === '[0,90,90]', `putaran hasil ${rot}`);
      // Kembalikan semula.
      await page.click('[data-org-reset]');
      expect(JSON.stringify(await order()) === '[0,1,2,3]', 'reset gagal');
    },
  },
  {
    name: 'kunci PDF: password + larang cetak, PDF terkunci ditolak',
    path: '/tools/kunci-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('teks.pdf');
      await page.waitForSelector('[data-lock-state="none"]', { timeout: 20000 });
      await h.type('#pp-pw', 'Rahasia 123');
      await h.type('#pp-pw2', 'Rahasia 12');
      await page.waitForSelector('[data-pp-mismatch]');
      expect(
        await page.$eval('[data-pp-run]', (b) => b.disabled),
        'tombol aktif saat password beda',
      );
      await h.type('#pp-pw2', 'Rahasia 123');
      await page.click('[data-pp-noprint]');
      await page.click('[data-pp-run]');
      await h.results(1);
      const out = await h.download('teks-terkunci.pdf');
      const s = out.toString('latin1');
      expect(s.includes('/Encrypt') && s.includes('/AESV3'), 'tidak terenkripsi AES-256');
      let refused = false;
      try {
        await PDFDocument.load(out);
      } catch {
        refused = true;
      }
      expect(refused, 'PDF terkunci bisa dibuka tanpa password');
      fs.writeFileSync(h.fixture('terkunci.pdf'), out);
      // Mengunci PDF yang sudah terkunci diarahkan ke Buka Kunci PDF.
      await h.click('Ganti file');
      await h.upload('terkunci.pdf');
      await page.waitForSelector('[data-lock-state="password"]', { timeout: 20000 });
      expect(await page.$('a[href="/tools/buka-kunci-pdf"]'), 'link Buka Kunci PDF tidak ada');
      expect(!(await page.$('#pp-pw')), 'form password tetap muncul');
    },
  },
  {
    name: 'buka kunci PDF: password salah ditolak, password benar membuka',
    path: '/tools/buka-kunci-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('terkunci.pdf');
      await page.waitForSelector('[data-lock-state="password"]', { timeout: 20000 });
      await h.type('#pp-pw', 'salah');
      await page.click('[data-pp-run]');
      await page.waitForFunction(() => document.body.innerText.includes('Password salah'), {
        timeout: 20000,
      });
      await h.type('#pp-pw', 'Rahasia 123');
      await page.click('[data-pp-run]');
      await h.results(1);
      const out = await h.download('terkunci-terbuka.pdf');
      expect(!out.toString('latin1').includes('/Encrypt'), 'masih terenkripsi');
      expect((await pagesOf(out)) === 4, 'jumlah halaman berubah');
    },
  },
  {
    name: 'buka kunci PDF: hapus larangan cetak/salin tanpa password',
    path: '/tools/buka-kunci-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('dibatasi.pdf');
      await page.waitForSelector('[data-lock-state="restricted"]', { timeout: 20000 });
      expect(await h.bodyHas('tidak bisa dicetak'), 'jenis pembatasan tidak ditampilkan');
      expect(!(await page.$('#pp-pw')), 'password diminta untuk PDF yang hanya dibatasi');
      await h.click('Hapus pembatasan');
      await h.results(1);
      const out = await h.download('dibatasi-terbuka.pdf');
      expect(!out.toString('latin1').includes('/Encrypt'), 'pembatasan masih ada');
      // PDF biasa: diberi tahu tidak terkunci.
      await h.click('Ganti file');
      await h.upload('teks.pdf');
      await page.waitForSelector('[data-lock-state="none"]', { timeout: 20000 });
      expect(!(await page.$('[data-pp-run]')), 'tombol buka kunci muncul untuk PDF biasa');
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
    name: 'buat tanda tangan: gores miring dirapikan, unduh PNG dan PDF',
    path: '/tools/buat-tanda-tangan',
    async run(h) {
      await h.page.waitForSelector('canvas[aria-label]', { timeout: 10000 });
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

      const png = await h.downloadVia('tanda-tangan.png', () => h.click('Unduh PNG'));
      expect(png.subarray(1, 4).toString('latin1') === 'PNG', 'bukan PNG');
      const pdf = await h.downloadVia('tanda-tangan.pdf', () => h.click('Unduh PDF'));
      const doc = await PDFDocument.load(pdf);
      const { width, height } = doc.getPage(0).getSize();
      // Satu halaman seukuran ttd: lebar 180 pt, tinggi mengikuti bentuk ttd.
      expect(
        doc.getPageCount() === 1 && Math.round(width) === 180 && height < width,
        `PDF ttd tidak sesuai: ${doc.getPageCount()} hal, ${width}×${height}`,
      );
    },
  },
  {
    name: 'buat tanda tangan: foto ttd di kertas berbayang',
    path: '/tools/buat-tanda-tangan',
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

      const png = await h.downloadVia('tanda-tangan.png', () => h.click('Unduh PNG'));
      expect(png.subarray(1, 4).toString('latin1') === 'PNG', 'bukan PNG');
    },
  },
  {
    name: 'edit PDF: teks, kotak putih, gambar, halaman diputar (posisi sama dengan layar)',
    path: '/tools/edit-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('teks.pdf');
      await page.waitForFunction(
        () => document.querySelectorAll('section[aria-label^="Halaman"]').length === 4,
        { timeout: 20000 },
      );
      const sections = await page.$$('section[aria-label^="Halaman"]');
      const toolBtn = (label) =>
        page.evaluateHandle(
          (l) =>
            [...document.querySelectorAll('[role=toolbar] button')].find(
              (b) => b.textContent.trim() === l,
            ),
          label,
        );
      /** Klik alat (mouse), lalu klik halaman di titik relatif (fx, fy). */
      async function placeAt(label, sec, fx, fy) {
        await (await toolBtn(label)).click();
        await sec.scrollIntoView();
        const b = await sec.boundingBox();
        await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
      }
      await placeAt('Teks', sections[0], 0.2, 0.3);
      await page.keyboard.type('Halo Toolland');
      await placeAt('Kotak putih', sections[0], 0.5, 0.6);
      await placeAt('Teks', sections[2], 0.3, 0.25);
      await page.keyboard.type('Putar');
      // Gambar lewat pemilih file.
      await sections[1].scrollIntoView();
      const [chooser] = await Promise.all([
        page.waitForFileChooser(),
        (await toolBtn('Gambar / tanda tangan')).click(),
      ]);
      await chooser.accept([h.fixture('transparan.png')]);
      await page.waitForFunction(() =>
        document
          .querySelector('[role=toolbar] button[aria-pressed=true]')
          ?.textContent.includes('Gambar'),
      );
      const b2 = await sections[1].boundingBox();
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);

      // Posisi teks di layar (fraksi halaman) untuk dibandingkan dengan PDF.
      const onScreen = await page.$$eval('[role=textbox]', (els) =>
        els.map((e) => {
          const s = e.closest('section').getBoundingClientRect();
          const r = e.getBoundingClientRect();
          return {
            text: e.innerText,
            fx: (r.left - s.left) / s.width,
            fy: (r.top - s.top) / s.height,
          };
        }),
      );
      await h.click('Simpan PDF');
      await h.results(1);
      const out = await h.download('teks-diedit.pdf');

      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(out) }).promise;
      const found = [];
      for (const [n, want] of [
        [1, 'Halo Toolland'],
        [3, 'Putar'],
      ]) {
        const pg = await doc.getPage(n);
        const vp = pg.getViewport({ scale: 1 });
        const item = (await pg.getTextContent()).items.find((i) => i.str === want);
        expect(item, `teks "${want}" tidak ada di halaman ${n}`);
        // Titik baseline kiri dalam koordinat layar (sudah memperhitungkan rotasi halaman).
        const [a, b, c, d, e, f] = vp.transform;
        const [px, py] = [item.transform[4], item.transform[5]];
        const [x, y] = [a * px + c * py + e, b * px + d * py + f];
        const s = onScreen.find((o) => o.text === want);
        const size = 14;
        const dx = Math.abs(x - s.fx * vp.width);
        const dy = Math.abs(y - (s.fy * vp.height + 0.9 * size));
        expect(dx < 2 && dy < 3, `posisi "${want}" meleset ${dx.toFixed(1)}/${dy.toFixed(1)} pt`);
        found.push(`${want} selisih ${dx.toFixed(1)}, ${dy.toFixed(1)} pt`);
      }
      const lib = await PDFDocument.load(out);
      const xobj = lib.getPage(1).node.Resources().lookup(PDFName.of('XObject'));
      expect(xobj && xobj.keys().length === 1, 'gambar tidak ada di halaman 2');
      return found;
    },
  },
  {
    name: 'edit PDF: klik tulisan asli lalu ubah (font, warna, posisi sama)',
    path: '/tools/edit-pdf',
    async run(h) {
      const { page } = h;
      await h.upload('surat.pdf');
      await page.waitForSelector('[data-line][data-text=": Budi Santoso"]', { timeout: 20000 });
      const clickLine = async (text) => {
        const el = await page.$(`[data-line][data-text="${text}"]`);
        await el.scrollIntoView();
        const b = await el.boundingBox();
        await page.mouse.click(b.x + b.width - 2, b.y + b.height / 2);
        await page.waitForSelector('[role=textbox]:focus');
      };
      const selectAll = async () => {
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
      };
      // 1) Ganti nama.
      await clickLine(': Budi Santoso');
      expect(
        (await page.$eval('select', (s) => s.value)) === 'times',
        'font Times tidak terdeteksi',
      );
      await selectAll();
      await page.keyboard.type(': Siti Aminah');
      // 2) Baris biru di latar kuning: warna terdeteksi, lalu ditinggal tanpa diubah.
      await clickLine('Kode: A-17');
      const color = await page.$eval('[role=textbox]:focus', (e) => getComputedStyle(e).color);
      const [r, , b] = color.match(/\d+/g).map(Number);
      expect(b > 120 && r < 60 && b - r > 80, `warna tulisan biru tidak terdeteksi: ${color}`);
      const cover = await page.$$eval('.pointer-events-none.absolute', (els) =>
        els.map((e) => getComputedStyle(e).backgroundColor).find((c) => c !== 'rgba(0, 0, 0, 0)'),
      );
      // 3) Hapus baris jabatan dengan mengosongkannya (klik baris lain menutup baris biru).
      await clickLine(': Staf Gudang');
      expect(
        (await page.$$('[data-line][data-text="Kode: A-17"]')).length === 1,
        'baris yang tidak diubah tidak kembali seperti semula',
      );
      await selectAll();
      await page.keyboard.press('Backspace');
      await h.click('Simpan PDF');
      await h.results(1);
      const out = await h.download('surat-diedit.pdf');

      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(out), fontExtraProperties: true })
        .promise;
      const pg = await doc.getPage(1);
      await pg.getOperatorList();
      const items = (await pg.getTextContent()).items.filter((i) => i.str.trim());
      const count = (t) => items.filter((i) => i.str === t).length;
      const neu = items.find((i) => i.str === ': Siti Aminah');
      const old = items.find((i) => i.str === ': Budi Santoso');
      expect(neu, 'teks baru tidak ada');
      const dx = Math.abs(neu.transform[4] - old.transform[4]);
      const dy = Math.abs(neu.transform[5] - old.transform[5]);
      expect(dx < 0.6 && dy < 0.6, `posisi teks baru meleset ${dx.toFixed(2)}/${dy.toFixed(2)} pt`);
      const font = pg.commonObjs.get(neu.fontName).name;
      expect(/Times/.test(font), `font hasil ${font}, bukan Times`);
      expect(count('Kode: A-17') === 1, 'baris yang tidak diubah ikut ditulis ulang');
      expect(count('Staf Gudang') + count(': Staf Gudang') === 1, 'baris kosong ditulis ulang');
      return [
        `selisih posisi ${dx.toFixed(2)}, ${dy.toFixed(2)} pt · font ${font} · latar ${cover}`,
      ];
    },
  },
];
