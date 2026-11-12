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
    name: 'game mengetik: tembak musuh, jeda, selesai, hasil',
    path: '/tools/tes-kecepatan-mengetik',
    async run(h) {
      // Tab game tampil secara bawaan.
      await h.page.waitForSelector('[data-ty-start]');
      await h.page.click('[data-ty-start]');
      await h.page.waitForSelector('[data-ty-banner]');
      // Tembak 3 musuh: ketik kata musuh terdekat dari daftar target.
      let destroyed = 0;
      const deadline = Date.now() + 25_000;
      while (destroyed < 3 && Date.now() < deadline) {
        const words = await h.page.$$eval('[data-ty-targets] li', (els) =>
          els.map((e) => e.dataset.word),
        );
        if (words.length) {
          await h.page.keyboard.type(words[0]);
          destroyed++;
        }
        await h.sleep(250);
      }
      expect(destroyed === 3, `musuh yang ditembak ${destroyed}`);
      await h.page.waitForFunction(
        () => Number(document.querySelector('[data-ty-score]').innerText.replace(/\D/g, '')) > 0,
        { timeout: 5000 },
      );
      // Salah ketik: tidak ada musuh berawalan huruf ini yang dikunci.
      await h.page.keyboard.type('qqq');
      // Esc menjeda, Selesai mengakhiri.
      await h.page.keyboard.press('Escape');
      await h.page.waitForSelector('[data-ty-paused]');
      await h.page.click('[data-ty-quit]');
      await h.page.waitForSelector('[data-ty-result]');
      expect(
        Number(await h.text('[data-ty-destroyed]')) >= 3,
        `hancur ${await h.text('[data-ty-destroyed]')}`,
      );
      expect((await h.text('[data-ty-acc]')) !== '100%', 'salah ketik tidak tercatat');
      expect(Number(await h.text('[data-ty-wpm]')) > 0, 'KPM game 0');
      expect(!!(await h.page.$('[data-ty-highscore]')), 'skor tertinggi pertama tidak ditandai');
      expect(!!(await h.page.$('[data-ty-result] svg path')), 'grafik tidak tampil');
      // Simpan hasil sebagai gambar dan PDF.
      const png = await h.downloadVia(/^hasil-tes-mengetik-\d{8}-\d{4}\.png$/, () =>
        h.page.click('[data-save="png"]'),
      );
      expect(png.subarray(1, 4).toString() === 'PNG' && png.length > 20_000, `PNG ${png.length} B`);
      const pdf = await h.downloadVia(/^hasil-tes-mengetik-\d{8}-\d{4}\.pdf$/, () =>
        h.page.click('[data-save="pdf"]'),
      );
      expect(pdf.subarray(0, 5).toString() === '%PDF-', 'bukan PDF');
      // Main lagi kembali ke permainan.
      await h.page.click('[data-ty-again]');
      await h.page.waitForSelector('[data-ty-score]');
    },
  },
  {
    name: 'game mengetik: layar penuh membesarkan arena, keluar menjeda',
    path: '/tools/tes-kecepatan-mengetik',
    async run(h) {
      await h.page.waitForSelector('[data-ty-start]');
      const width = () => h.page.$eval('[data-ty-game]', (e) => e.getBoundingClientRect().width);
      const before = await width();
      await h.page.click('[data-ty-fullscreen]');
      await h.page.waitForSelector('[data-ty-fs]');
      await h.sleep(300);
      const vh = await h.page.evaluate(() => window.innerHeight);
      const box = await h.page.$eval('[data-ty-game]', (e) => {
        const r = e.getBoundingClientRect();
        return { w: r.width, h: r.height, bottom: r.bottom };
      });
      expect(box.bottom <= vh + 1, `arena melewati layar: ${box.bottom} > ${vh}`);
      expect(Math.abs(box.w / box.h - 960 / 600) < 0.02, `proporsi arena ${box.w}x${box.h}`);
      expect(box.w >= before - 1, `arena mengecil: ${before} -> ${box.w}`);
      // Main sebentar dalam layar penuh, lalu keluar: game otomatis dijeda.
      await h.page.click('[data-ty-start]');
      await h.page.waitForSelector('[data-ty-banner]');
      await h.page.click('[data-ty-fullscreen]');
      await h.page.waitForFunction(() => !document.querySelector('[data-ty-fs]'));
      await h.page.waitForSelector('[data-ty-paused]');
    },
  },
  {
    name: 'tes IQ: 30 soal acak, konfirmasi selesai, hasil tanpa kunci jawaban, simpan',
    path: '/tools/tes-iq',
    async run(h) {
      const { page } = h;
      await page.click('[data-iq-start]');
      await page.waitForSelector('[data-iq-options]');
      expect(
        (await h.text('[data-iq-timer]')).includes('20:00') ||
          (await h.text('[data-iq-timer]')).includes('19:5'),
        'timer tidak mulai dari 20 menit',
      );
      const first = await page.$eval('[data-iq-test]', (e) => e.innerHTML);
      // Jawab 20 soal dengan tombol angka (lanjut otomatis), sisanya dibiarkan kosong.
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press(String((i % 5) + 1));
        await h.sleep(380);
      }
      expect(
        (await h.text('[data-iq-progress]')).includes('21'),
        await h.text('[data-iq-progress]'),
      );
      // Selesai dengan soal kosong meminta konfirmasi dulu.
      await page.click('[data-iq-finish]');
      await page.waitForSelector('[data-iq-confirm]');
      await page.click('[data-iq-confirm-yes]');
      await page.waitForSelector('[data-iq-result]');
      const iq = Number(await h.text('[data-iq-score]'));
      expect(iq >= 70 && iq <= 145, `IQ ${iq}`);
      expect(
        (await h.text('[data-iq-correct]')).endsWith('/30'),
        await h.text('[data-iq-correct]'),
      );
      expect(!(await page.$('[data-iq-review]')), 'pembahasan/kunci jawaban masih tampil');
      const png = await h.downloadVia(/^hasil-tes-iq-\d{8}-\d{4}\.png$/, () =>
        page.click('[data-save="png"]'),
      );
      expect(png.subarray(1, 4).toString() === 'PNG', 'kartu IQ bukan PNG');
      const pdf = await h.downloadVia(/^hasil-tes-iq-\d{8}-\d{4}\.pdf$/, () =>
        page.click('[data-save="pdf"]'),
      );
      expect(pdf.subarray(0, 5).toString() === '%PDF-', 'kartu IQ bukan PDF');
      // Tes lagi memberi soal baru.
      await page.click('[data-iq-again]');
      await page.waitForSelector('[data-iq-options]');
      const second = await page.$eval('[data-iq-test]', (e) => e.innerHTML);
      expect(first !== second, 'soal tidak berubah saat tes diulang');
    },
  },
  {
    name: 'tes mengetik klasik: mode kata, hasil, dan rekor',
    path: '/tools/tes-kecepatan-mengetik',
    async run(h) {
      await h.page.click('[data-ty-tab="classic"]');
      await h.page.waitForSelector('[data-ty-mode="words"]');
      await h.page.click('[data-ty-mode="words"]');
      await h.page.click('[data-ty-count="25"]');
      await h.page.click('[data-ty-lang="id"]');
      await h.page.click('[data-ty-area]');
      const words = await h.page.$$eval('[data-word]', (els) =>
        els.map((e) => e.getAttribute('data-word')),
      );
      expect(words.length === 25, `jumlah kata ${words.length}`);
      for (const w of words) await h.page.keyboard.type(`${w} `);
      await h.page.waitForSelector('[data-ty-result]', { timeout: 5000 });
      expect((await h.text('[data-ty-acc]')) === '100%', await h.text('[data-ty-acc]'));
      const wpm = parseInt(await h.text('[data-ty-wpm]'), 10);
      expect(wpm > 0, `KPM ${wpm}`);
      expect(['S', 'A', 'B', 'C', 'D'].includes(await h.text('[data-ty-grade]')), 'nilai huruf');
      // Akurasi 100% dengan tempo e2e seharusnya memecahkan rekor pertama.
      expect(!!(await h.page.$('[data-ty-best]')), 'lencana rekor baru tidak tampil');
      const card = await h.downloadVia(/^hasil-tes-mengetik-\d{8}-\d{4}\.png$/, () =>
        h.page.click('[data-save="png"]'),
      );
      expect(card.subarray(1, 4).toString() === 'PNG', 'kartu hasil klasik bukan PNG');
      expect(!!(await h.page.$('[data-ty-result] svg path')), 'grafik tidak tampil');
      // Ulangi: kembali ke arena dengan kata baru.
      await h.page.click('[data-ty-again]');
      await h.page.waitForSelector('[data-ty-area]');
      expect((await h.page.$$('[data-word]')).length === 25, 'kata tidak dibuat ulang');
      // Salah ketik menurunkan akurasi dan tercatat di hasil.
      await h.page.keyboard.type('zzz ');
      const w2 = await h.page.$$eval('[data-word]', (els) =>
        els.map((e) => e.getAttribute('data-word')),
      );
      for (const w of w2) await h.page.keyboard.type(`${w} `);
      await h.page.waitForSelector('[data-ty-result]');
      expect((await h.text('[data-ty-acc]')) !== '100%', 'salah ketik tidak tercatat');
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
      await h.page.click('[data-df-view="words"]');
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
    name: 'bandingkan teks: unggah DOCX/PDF dan cek kemiripan (plagiarisme)',
    path: '/tools/bandingkan-teks',
    async run(h) {
      const { page } = h;
      // Unggah Word ke kolom kanan pada tab Perbedaan.
      await (await page.$('[data-df-file="b"]')).uploadFile(h.fixture('surat.docx'));
      await page.waitForFunction(() =>
        document.querySelector('#df-b').value.includes('Surat uji Toolland'),
      );
      expect((await h.text('[data-df-meta="b"]')).includes('surat.docx'), 'nama file tidak tampil');
      // Kemiripan: PDF di kiri, teks yang sebagian sama di kanan.
      await (await page.$('[data-df-file="a"]')).uploadFile(h.fixture('teks.pdf'));
      await page.waitForFunction(() => document.querySelector('#df-a').value.includes('halaman 4'));
      await h.type(
        '#df-b',
        'Ini kalimat lain. DOKUMEN UJI, halaman 2! Dokumen uji - halaman 3 selesai.',
      );
      await page.waitForSelector('[data-sim-overall]');
      await page.click('[data-df-view="similar"]');
      await page.waitForSelector('[data-sim-panel="a"]');
      const overall = parseFloat((await h.text('[data-sim-overall]')).replace(',', '.'));
      expect(overall > 30 && overall < 100, `kemiripan ${overall}`);
      const marksA = await page.$$eval('[data-sim-panel="a"] mark', (e) => e.length);
      const marksB = await page.$$eval('[data-sim-panel="b"] mark', (e) => e.length);
      expect(marksA >= 1 && marksB >= 1, `sorotan ${marksA}/${marksB}`);
      await page.click('[data-sim-passage]');
      expect(!!(await page.$('mark.ring-2')), 'bagian yang diklik tidak disorot');
      // Kepekaan longgar (8 kata) tetap menemukan rangkaian 8 kata yang sama.
      await page.click('[data-sim-k="8"]');
      await h.sleep(200);
      expect(
        (await page.$$('[data-sim-passage]')).length >= 1,
        'mode longgar kehilangan kecocokan',
      );
      // Pilihan tampilan diingat setelah halaman dimuat ulang.
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(
        () =>
          document.querySelector('[data-df-view="similar"]')?.getAttribute('aria-pressed') ===
          'true',
      );
    },
  },
  {
    name: 'gambar ke teks (OCR): screenshot dan PDF scan, bahasa Indonesia',
    path: '/tools/gambar-ke-teks',
    async run(h) {
      const { page } = h;
      // Buat gambar uji: tangkapan layar teks hitam di latar putih.
      await page.evaluate(() => {
        const d = document.createElement('div');
        d.id = 'ocr-uji';
        d.textContent = 'Selamat pagi Indonesia, kegiatan belajar dimulai pukul tujuh.';
        d.className = 'fixed left-0 top-0 z-[999] bg-white p-6 text-3xl text-black';
        document.body.append(d);
      });
      await (await page.$('#ocr-uji')).screenshot({ path: h.fixture('ocr-uji.png') });
      await page.evaluate(() => document.getElementById('ocr-uji').remove());
      await page.click('[data-ocr-lang="ind"]');
      await h.upload('ocr-uji.png');
      await page.waitForSelector('[data-ocr-text]', { timeout: 90_000 });
      const text = await page.$eval('[data-ocr-text]', (e) => e.value.toLowerCase());
      for (const w of ['selamat', 'indonesia', 'belajar', 'tujuh'])
        expect(text.includes(w), `OCR tidak menemukan "${w}": ${text}`);
      // PDF: tiap halaman dirender lalu dibaca.
      await h.upload('surat.pdf');
      await page.waitForFunction(() => document.querySelectorAll('[data-ocr-text]').length === 2, {
        timeout: 90_000,
      });
      const pdfText = await page.$$eval('[data-ocr-text]', (e) => e[1].value);
      expect(/SURAT KETERANGAN/i.test(pdfText) && /Budi/.test(pdfText), pdfText);
    },
  },
  {
    name: 'teleprompter: hitung mundur, bergulir, jeda, ulang, cermin, file, tersimpan',
    path: '/tools/teleprompter',
    async run(h) {
      const { page } = h;
      const progress = async () => parseInt(await h.text('[data-tp-progress]'), 10);
      // Naskah contoh terisi saat pertama dibuka.
      expect(
        (await page.$eval('[data-tp-script]', (e) => e.value)).length > 50,
        'naskah contoh kosong',
      );
      // Kecepatan maksimal lewat keyboard (fokus di halaman, bukan di kolom teks).
      await page.click('h1');
      for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowUp');
      expect((await h.text('[data-tp-speed]')) === '20', 'kecepatan tidak naik');
      await page.click('[data-tp-play]');
      await page.waitForSelector('[data-tp-countdown]');
      await page.waitForFunction(() => !document.querySelector('[data-tp-countdown]'), {
        timeout: 5000,
      });
      await h.sleep(1200);
      const p1 = await progress();
      expect(p1 > 0, `tidak bergulir (${p1}%)`);
      // Spasi menjeda: posisi tidak berubah lagi.
      await page.keyboard.press('Space');
      const p2 = await progress();
      await h.sleep(600);
      expect((await progress()) === p2, 'masih bergulir setelah jeda');
      // R kembali ke awal.
      await page.keyboard.press('r');
      expect((await progress()) === 0, 'tidak kembali ke awal');
      // Mode cermin membalik teks.
      await page.click('[data-tp-mirror]');
      expect(
        await page.$eval('[data-tp-content]', (e) =>
          e.parentElement.classList.contains('-scale-x-100'),
        ),
        'mode cermin tidak aktif',
      );
      // Buka naskah dari file .txt.
      const file = h.fixture('naskah.txt');
      (await import('node:fs')).writeFileSync(file, 'Halo semuanya, ini naskah dari file.');
      await (await page.$('[data-tp-file]')).uploadFile(file);
      await page.waitForFunction(() =>
        document.querySelector('[data-tp-content]').textContent.includes('naskah dari file'),
      );
      // Pengaturan dan naskah tersimpan setelah dimuat ulang.
      await h.sleep(600);
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(
        () => document.querySelector('[data-tp-speed]')?.textContent.trim() === '20',
      );
      expect(
        (await page.$eval('[data-tp-script]', (e) => e.value)).includes('naskah dari file'),
        'naskah tidak tersimpan',
      );
    },
  },
  {
    name: 'teleprompter: unduh teks bergulir sebagai video MP4',
    path: '/tools/teleprompter',
    async run(h) {
      const { page } = h;
      await page.click('h1');
      for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowUp');
      await page.click('[data-tp-shape="square"]');
      await h.sleep(500);
      const est = await h.text('[data-tp-estimate]');
      await page.click('[data-tp-export]');
      await page.waitForSelector('[data-tp-download]', { timeout: 120_000 });
      // Durasi video yang jadi sesuai perkiraan.
      const dur = await page.$eval('[data-tp-result] video', (v) =>
        v.readyState >= 1
          ? v.duration
          : new Promise((r) => v.addEventListener('loadedmetadata', () => r(v.duration))),
      );
      const [mm, ss] = est
        .match(/(\d+):(\d\d)/)
        .slice(1)
        .map(Number);
      expect(Math.abs(dur - (mm * 60 + ss)) <= 1.5, `durasi ${dur} vs perkiraan ${est}`);
      const mp4 = await h.downloadVia(/^teleprompter-\d{8}-\d{4}\.mp4$/, () =>
        page.click('[data-tp-download]'),
      );
      expect(
        mp4.subarray(4, 8).toString() === 'ftyp' && mp4.length > 10_000,
        `MP4 ${mp4.length} B`,
      );
      return [`video ${dur.toFixed(1)} dtk, ${(mp4.length / 1024).toFixed(0)} KB`];
    },
  },
  {
    name: 'QR bergaya: semua bentuk titik × mata dan logo tetap terbaca',
    path: '/tools/buat-qr-code',
    async run(h) {
      const { page } = h;
      const url = 'https://julian-marcell.com/tools/buat-qr-code?uji=gaya';
      await h.type('#qr-text', url);
      const status = async () => {
        await page.waitForFunction(
          () => document.querySelector('[data-qr-check]')?.dataset.qrCheck !== 'checking',
          { timeout: 10_000 },
        );
        await h.sleep(50);
        return page.$eval('[data-qr-check]', (e) => e.dataset.qrCheck);
      };
      const shapes = ['square', 'rounded', 'dots', 'diamond', 'heart', 'star'];
      const eyes = ['square', 'rounded', 'circle', 'leaf'];
      const failed = [];
      for (const sh of shapes)
        for (const e of eyes) {
          await page.click(`[data-qr-shape="${sh}"]`);
          await page.click(`[data-qr-eye="${e}"]`);
          if ((await status()) !== 'ok') failed.push(`${sh}/${e}`);
        }
      expect(!failed.length, `tidak terbaca: ${failed.join(', ')}`);
      // Logo di tengah (ukuran bawaan) untuk setiap bentuk titik.
      await (await page.$('[data-qr-logo]')).uploadFile(h.fixture('foto.jpg'));
      await page.waitForSelector('[data-qr-logo-size]');
      expect(
        await page.$eval('#qr-level', (e) => e.disabled && e.value === 'H'),
        'koreksi error tidak dikunci saat ada logo',
      );
      const logoFailed = [];
      for (const sh of shapes) {
        await page.click(`[data-qr-shape="${sh}"]`);
        if ((await status()) !== 'ok') logoFailed.push(sh);
      }
      expect(!logoFailed.length, `logo membuat tidak terbaca: ${logoFailed.join(', ')}`);
      // Logo maksimal 30%: catat hasilnya; bila gagal, unduhan wajib terkunci.
      await page.$eval('[data-qr-logo-size]', (el) => {
        el.value = el.max;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await h.sleep(300);
      const big = await status();
      if (big !== 'ok')
        expect(await page.$eval('[data-qr-png]', (b) => b.disabled), 'unduhan tidak dikunci');
      // Gaya hati + logo: unduh PNG dan pindai ulang di luar halaman.
      await page.$eval('[data-qr-logo-size]', (el) => {
        el.value = '0.22';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.click('[data-qr-preset="heart"]');
      expect((await status()) === 'ok', 'gaya hati tidak terbaca');
      const png = await h.downloadVia('qr-code.png', () => page.click('[data-qr-png]'));
      const decoded = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        return { w: c.width, h: c.height, data: Array.from(d.data) };
      }, png.toString('base64'));
      const code = jsQR(Uint8ClampedArray.from(decoded.data), decoded.w, decoded.h);
      expect(code?.data === url, `PNG unduhan terbaca: ${code?.data}`);
      // Warna terbalik/pucat ditolak dan unduhan dikunci.
      await page.$eval('#qr-fg', (el) => {
        el.value = '#ffffff';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect((await status()) === 'contrast', 'kontras buruk tidak terdeteksi');
      expect(await page.$eval('[data-qr-png]', (b) => b.disabled), 'unduhan tidak dikunci');
      return [`logo 30%: ${big}`];
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
      await h.page.waitForSelector('img[src^="data:image/svg"]');
      await h.sleep(300);
      const img = await h.page.$eval('img[src^="data:image/svg"]', async (el) => {
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
  {
    name: 'cari subdomain: crt.sh, cadangan Certspotter, saringan, unduh, batas per jam',
    path: '/tools/cari-subdomain',
    async run(h) {
      // Sumber data disimulasikan supaya tes tidak bergantung pada crt.sh (sering 502).
      // CSP tetap diuji: intersepsi terjadi setelah browser mengizinkan connect-src.
      const hits = [];
      const cors = { 'Access-Control-Allow-Origin': '*' };
      await h.page.setRequestInterception(true);
      h.page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith('https://crt.sh/')) {
          hits.push(u);
          if (u.includes('besar.id')) return r.respond({ status: 502, headers: cors, body: '' });
          return r.respond({
            status: 200,
            headers: cors,
            contentType: 'application/json',
            body: JSON.stringify([
              { name_value: 'contoh.co.id\nwww.contoh.co.id', not_after: '2099-01-01T00:00:00' },
              {
                name_value: '*.api.contoh.co.id\nstaging.contoh.co.id',
                not_after: '2020-03-01T00:00:00',
              },
              { name_value: 'api-lama.contoh.co.id\nbukan.org', not_after: '2021-01-01T00:00:00' },
            ]),
          });
        }
        if (u.startsWith('https://api.certspotter.com/')) {
          hits.push(u);
          const body = u.includes('after=')
            ? []
            : [
                {
                  id: '7',
                  dns_names: ['besar.id', 'mail.besar.id'],
                  not_after: '2099-01-01T00:00:00Z',
                },
              ];
          return r.respond({
            status: 200,
            headers: cors,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
        }
        return r.continue();
      });
      const search = async (q) => {
        await h.type('#sub-domain', q);
        await h.page.click('form button[type=submit]');
      };

      await search('https://www.contoh.co.id/halaman');
      await h.page.waitForSelector('#sub-count', { timeout: 15000 });
      const count = await h.text('#sub-count');
      expect(count === '5 subdomain untuk contoh.co.id', count);
      expect(hits[0] === 'https://crt.sh/?q=%25.contoh.co.id&output=json', hits[0]);
      expect(await h.bodyHas('crt.sh (Sectigo)'), 'sumber crt.sh tidak tampil');
      expect(await h.bodyHas('Sisa jatah: 9 dari 10'), await h.text('#sub-quota'));
      const list = await h.text('#sub-list');
      expect(/www\.contoh\.co\.id sertifikat berlaku s\.d\./.test(list), list);
      expect(/staging\.contoh\.co\.id sertifikat terakhir berakhir/.test(list), list);
      expect(!list.includes('bukan.org'), list);

      await h.type('#sub-filter', 'api');
      const rows = await h.page.$$eval('#sub-list li', (els) => els.length);
      expect(rows === 2, `saringan api: ${rows} baris`);
      const txt = String(await h.downloadVia('subdomain-contoh.co.id.txt', () => h.click('TXT')));
      expect(txt === 'api.contoh.co.id\napi-lama.contoh.co.id\n', txt);

      // crt.sh gagal: pindah ke Certspotter.
      await search('besar.id');
      await h.page.waitForFunction(
        () => document.querySelector('#sub-count')?.textContent.includes('besar.id'),
        { timeout: 15000 },
      );
      expect(await h.bodyHas('Certspotter (SSLMate)'), 'cadangan Certspotter tidak tampil');
      expect(
        (await h.text('#sub-count')) === '2 subdomain untuk besar.id',
        await h.text('#sub-count'),
      );

      // Respons 502 dari crt.sh memang disimulasikan; browser mencatatnya di console.
      for (let i = h.problems.length - 1; i >= 0; i--)
        if (h.problems[i].includes('status of 502')) h.problems.splice(i, 1);

      // Jatah habis (misalnya dari tab lain): pencarian baru ditolak tanpa menghubungi sumber.
      await h.page.evaluate(() =>
        localStorage.setItem(
          'toolland.subdomain.searches',
          JSON.stringify(Array.from({ length: 10 }, (_, i) => Date.now() - 600_000 + i)),
        ),
      );
      const before = hits.length;
      await search('lain.com');
      await h.page.waitForSelector('[role=alert]', { timeout: 5000 });
      const err = await h.text('[role=alert]');
      expect(/Jatah 10 pencarian per jam sudah habis\. Coba lagi dalam 50 menit/.test(err), err);
      expect(hits.length === before, 'sumber data tetap dihubungi walau jatah habis');
      // Domain yang sudah dicari di halaman ini tetap bisa dibuka lagi.
      await search('contoh.co.id');
      await h.page.waitForFunction(
        () => document.querySelector('#sub-count')?.textContent.includes('contoh.co.id'),
        { timeout: 5000 },
      );
      expect(hits.length === before, 'pencarian ulang memakai jatah');
      return [count, err.slice(0, 70)];
    },
  },
];
