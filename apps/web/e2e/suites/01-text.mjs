import { strFromU8, unzipSync } from 'fflate';
import jsQR from 'jsqr';
import { expect } from '../expect.mjs';

// Kata DISC gaya D dan C (bahasa Indonesia), untuk memilih kata tanpa bergantung pada urutan.
const D_WORDS = [
  'Tegas',
  'Berani',
  'Kompetitif',
  'Lugas',
  'Ambisius',
  'Mandiri',
  'Gigih',
  'Suka memimpin',
  'Pantang menyerah',
  'Berorientasi hasil',
  'Percaya diri',
  'Blak-blakan',
  'Berani ambil risiko',
  'Keras kepala',
  'Tidak sabaran',
  'Menuntut',
  'Cepat bertindak',
  'Tangguh',
  'Agresif',
  'Berkemauan keras',
  'Suka menantang',
  'Pelopor',
  'Berwibawa',
  'Suka tantangan',
];
const C_WORDS = [
  'Teliti',
  'Hati-hati',
  'Sistematis',
  'Analitis',
  'Perfeksionis',
  'Logis',
  'Tertib',
  'Detail',
  'Disiplin',
  'Objektif',
  'Akurat',
  'Waspada',
  'Taat aturan',
  'Kritis',
  'Pemilih',
  'Terlalu berhati-hati',
  'Terencana',
  'Cermat',
  'Rapi',
  'Berpikir mendalam',
  'Skeptis',
  'Berstandar tinggi',
  'Tepat waktu',
  'Penuh pertimbangan',
];

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
    name: 'tes kepribadian Big Five: lanjut setelah reload, hasil 5 sifat, kartu PNG',
    path: '/tools/tes-kepribadian',
    async run(h) {
      const { page } = h;
      // Mulai bersih (riwayat dari percobaan sebelumnya di browser yang sama).
      await page.evaluate(() => localStorage.removeItem('toolland-persona-big-five'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.click('[data-pt-start]');
      await page.waitForSelector('[data-pt-options]');
      const answer = async (n, from) => {
        for (let i = 0; i < n; i++) {
          await page.keyboard.press(String(((from + i) % 5) + 1));
          await h.sleep(300);
        }
      };
      await answer(10, 0);
      expect(
        (await h.text('[data-pt-progress]')).startsWith('11 '),
        await h.text('[data-pt-progress]'),
      );
      // Progres tersimpan: setelah reload ada tombol lanjutkan.
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-pt-resume]');
      expect(
        (await h.text('[data-pt-resume]')).includes('10/50'),
        await h.text('[data-pt-resume]'),
      );
      await page.click('[data-pt-resume]');
      await page.waitForSelector('[data-pt-options]');
      // Kembali satu langkah dengan panah kiri, lalu jawab lagi.
      await page.keyboard.press('ArrowLeft');
      expect(
        (await h.text('[data-pt-progress]')).startsWith('10 '),
        await h.text('[data-pt-progress]'),
      );
      await answer(1, 9);
      await answer(40, 10);
      await page.waitForSelector('[data-pt-result]');
      const bars = await page.$$eval('[data-pt-bar]', (els) => els.length);
      expect(bars === 5, `batang ${bars}`);
      expect(!(await page.$('[data-pt-code]')), 'Big Five tidak punya kode tipe');
      const txt = await h.text('[data-pt-result]');
      for (const t of [
        'Keterbukaan',
        'Ketelitian',
        'Ekstraversi',
        'Keramahan',
        'Neurotisisme',
        'Kekuatanmu',
      ])
        expect(txt.includes(t), `tidak ada ${t}`);
      const png = await h.downloadVia(/^hasil-tes-big-five-\d{8}-\d{4}\.png$/, () =>
        page.click('[data-save="png"]'),
      );
      expect(png.subarray(1, 4).toString() === 'PNG', 'kartu Big Five bukan PNG');
      // Hasil terakhir bisa dibuka lagi dari layar pembuka (reload memulihkan posisi gulir,
      // jadi kembali ke atas agar island terlihat dan aktif).
      await page.reload({ waitUntil: 'networkidle0' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForSelector('[data-pt-last]');
      await page.click('[data-pt-last]');
      await page.waitForSelector('[data-pt-result]');
    },
  },
  {
    name: 'tes 16 tipe: semua sangat sesuai menghasilkan ESTJ seimbang',
    path: '/tools/tes-16-kepribadian',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-persona-16-types'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.click('[data-pt-start]');
      await page.waitForSelector('[data-pt-options]');
      // Klik juga berfungsi, bukan hanya tombol angka.
      await page.click('[data-pt-option="5"]');
      await h.sleep(300);
      for (let i = 1; i < 48; i++) {
        await page.keyboard.press('5');
        await h.sleep(260);
      }
      await page.waitForSelector('[data-pt-result]');
      // Pernyataan kedua kutub disetujui semua: tiap dimensi 50%, seri condong ke kiri.
      expect((await h.text('[data-pt-code]')) === 'ESTJ', await h.text('[data-pt-code]'));
      expect(
        (await h.text('[data-pt-name]')) === 'Pengelola Andal',
        await h.text('[data-pt-name]'),
      );
      const txt = await h.text('[data-pt-result]');
      expect(txt.includes('50%') && txt.includes('Pekerjaan yang cocok'), txt.slice(0, 300));
      const pdf = await h.downloadVia(/^hasil-tes-16-tipe-\d{8}-\d{4}\.pdf$/, () =>
        page.click('[data-save="pdf"]'),
      );
      expect(pdf.subarray(0, 5).toString() === '%PDF-', 'kartu 16 tipe bukan PDF');
    },
  },
  {
    name: 'tes DISC: paling dan paling tidak sesuai, grafik 4 gaya',
    path: '/tools/tes-disc',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-persona-disc'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.click('[data-pt-start]');
      await page.waitForSelector('[data-pt-most="0"]');
      // Kata yang sama tidak bisa dipilih untuk + dan −.
      await page.click('[data-pt-most="0"]');
      await page.click('[data-pt-least="0"]');
      const pressed = await page.$$eval('[aria-pressed="true"]', (b) => b.length);
      expect(pressed === 1, `tombol aktif ${pressed}`);
      expect(
        (await h.text('[data-pt-progress]')).startsWith('1 '),
        'pindah sebelum + dan − dipilih',
      );
      // Pilih kata dengan gaya D sebagai paling sesuai dan C sebagai paling tidak di semua kelompok.
      for (let i = 0; i < 24; i++) {
        const words = await page.$$eval('[data-pt-word]', (els) =>
          els.map((e) => e.textContent.trim()),
        );
        const most = words.findIndex((w) => D_WORDS.includes(w));
        const least = words.findIndex((w) => C_WORDS.includes(w));
        expect(most >= 0 && least >= 0, words.join(', '));
        await page.click(`[data-pt-most="${most}"]`);
        await page.click(`[data-pt-least="${least}"]`);
        await h.sleep(480);
      }
      await page.waitForSelector('[data-pt-result]');
      expect((await h.text('[data-pt-code]')) === 'D', await h.text('[data-pt-code]'));
      const bars = await page.$$eval('[data-pt-bar]', (els) => els.map((e) => e.textContent));
      expect(
        bars.length === 4 && bars[0].includes('+24') && bars[3].includes('-24'),
        bars.join(' | '),
      );
    },
  },
  {
    name: 'tes minat bakat: kode Holland 3 huruf dan saran jurusan',
    path: '/tools/tes-minat-bakat',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-persona-riasec'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.click('[data-pt-start]');
      await page.waitForSelector('[data-pt-options]');
      // Urutan kegiatan R, I, A, S, E, C bergiliran: sukai I dan A, lalu S.
      const like = [1, 5, 4, 3, 1, 1];
      for (let i = 0; i < 48; i++) {
        await page.keyboard.press(String(like[i % 6]));
        await h.sleep(260);
      }
      await page.waitForSelector('[data-pt-result]');
      expect((await h.text('[data-pt-code]')) === 'IAS', await h.text('[data-pt-code]'));
      const txt = await h.text('[data-pt-result]');
      expect(
        txt.includes('Jurusan kuliah yang cocok') && txt.includes('Kedokteran'),
        txt.slice(0, 300),
      );
    },
  },
  {
    name: 'cek format skripsi: deteksi masalah, ganti pedoman, rapikan, link pedoman',
    path: '/tools/cek-format-skripsi',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-thesis-rules'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-tf-summary]');
      await h.upload('skripsi.docx');
      await page.waitForSelector('[data-tf-result]');
      const detected = await h.text('[data-tf-detected]');
      expect(detected.includes('BAB I, BAB II') && detected.includes('Daftar Pustaka'), detected);
      const count = Number(await h.text('[data-tf-count]'));
      expect(count >= 10, `masalah ${count}`);
      for (const code of [
        'paper',
        'margin',
        'pagenumMissing',
        'font',
        'line',
        'chapterPage',
        'captionSeq',
      ])
        expect(!!(await page.$(`[data-tf-issue="${code}"]`)), `tidak ada ${code}`);
      const font = await h.text('[data-tf-issue="font"]');
      expect(font.includes('Calibri') && font.includes('Times New Roman'), font);
      // Nomor tabel tidak bisa dirapikan otomatis.
      expect((await h.text('[data-tf-issue="captionSeq"]')).includes('Manual'), 'label manual');
      // Lokasi masalah melompat ke pratinjau.
      await page.click('[data-tf-issue="chapterPage"] button');
      await page.click('[data-tf-issue="chapterPage"] li button');
      expect(!!(await page.$('[data-tp].bg-brand-600\\/15')), 'paragraf tidak disorot');
      // Ganti preset ke spasi 1,5: pesan spasi ikut berubah.
      await page.click('[data-tf-preset="spasi15"]');
      await h.sleep(200);
      expect(
        (await h.text('[data-tf-issue="line"]')).includes('1,5'),
        await h.text('[data-tf-issue="line"]'),
      );
      // Ubah pedoman: nomor halaman kanan atas.
      await page.click('[data-tf-edit]');
      await page.select('[data-tf-pos]', 'top-right');
      await h.sleep(200);
      const out = await h.downloadVia(/^skripsi-rapi\.docx$/, () => page.click('[data-tf-fix]'));
      expect(out.subarray(0, 2).toString() === 'PK', 'hasil bukan docx');
      const files = unzipSync(new Uint8Array(out));
      const docXml = strFromU8(files['word/document.xml']);
      expect(
        docXml.includes('Times New Roman') && docXml.includes('w:pgSz w:w="11906"'),
        'format belum dirapikan',
      );
      expect(!!files['word/header1.xml'], 'header nomor halaman tidak dibuat');
      await page.waitForSelector('[data-tf-after]');
      const after = await h.text('[data-tf-after]');
      expect(after.includes('Tabel 1.3') && !after.includes('Calibri'), after);
      // Link pedoman membawa pengaturan ke halaman baru.
      await page.evaluate(() => {
        window.__copied = '';
        navigator.clipboard.writeText = async (t) => {
          window.__copied = t;
        };
      });
      await page.click('[data-tf-share]');
      const link = await page.evaluate(() => window.__copied);
      expect(/#p=[\w-]+$/.test(link), link);
      await page.evaluate(() => localStorage.removeItem('toolland-thesis-rules'));
      // Halaman kosong dulu supaya link (yang hanya beda hash) benar-benar dimuat ulang.
      await page.goto('about:blank');
      await page.goto(link, { waitUntil: 'networkidle0' });
      await page.waitForFunction(() =>
        document.querySelector('[data-tf-summary]')?.textContent?.includes('1,5'),
      );
    },
  },
  {
    name: 'kalkulator sampel: slovin, lemeshow, langkah, cadangan, strata',
    path: '/tools/kalkulator-sampel',
    async run(h) {
      const { page } = h;
      await page.waitForSelector('[data-ss-result="slovin"]');
      const n = (id) => h.text(`[data-ss-result="${id}"] [data-ss-n]`);
      const setNum = async (sel, v) => {
        // Klik tiga kali tidak memilih isi <input type="number">; pakai Ctrl+A.
        await page.click(sel);
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.type(sel, v);
      };
      expect((await n('slovin')) === '80', await n('slovin'));
      expect((await n('krejcie')) === '80', await n('krejcie'));
      const steps = await h.text('[data-ss-steps]');
      expect(steps.includes('100 / (1 + 100 × 0,05²)') && steps.includes('80 responden'), steps);
      // Populasi 1000: Slovin 286.
      await setNum('[data-ss-pop]', '1000');
      await h.sleep(100);
      expect((await n('slovin')) === '286', await n('slovin'));
      // Pilih Krejcie-Morgan: langkah ikut berganti.
      await page.click('[data-ss-result="krejcie"]');
      expect((await h.text('[data-ss-steps]')).includes('χ²'), 'langkah krejcie');
      // Populasi tidak diketahui: hanya Lemeshow, 385 pada 95% dan 5%.
      await page.click('[data-ss-known="no"]');
      await page.waitForSelector('[data-ss-result="lemeshow"]');
      expect(!(await page.$('[data-ss-result="slovin"]')), 'slovin masih tampil');
      expect((await n('lemeshow')) === '385', await n('lemeshow'));
      // Salin langkah.
      await page.evaluate(() => {
        window.__copied = '';
        navigator.clipboard.writeText = async (t) => {
          window.__copied = t;
        };
      });
      await page.click('[data-ss-copy]');
      const copied = await page.evaluate(() => window.__copied);
      expect(copied.startsWith('Lemeshow') && copied.includes('Keterangan:'), copied);
      // Populasi 325, e 10%, cadangan 10%: Slovin 77, disebar ke 86, lalu bagi ke 3 strata.
      await page.click('[data-ss-known="yes"]');
      await setNum('[data-ss-pop]', '325');
      await setNum('[data-ss-error]', '10');
      await page.click('[data-ss-result="slovin"]');
      await setNum('[data-ss-dropout]', '10');
      await h.sleep(100);
      expect((await n('slovin')) === '77', await n('slovin'));
      expect((await h.text('[data-ss-final]')).includes('86'), await h.text('[data-ss-final]'));
      for (const [name, size] of [
        ['X', '120'],
        ['XI', '110'],
        ['XII', '95'],
      ]) {
        await page.click('[data-ss-add]');
        const rows = await page.$$('[data-ss-row]');
        const inputs = await rows[rows.length - 1].$$('input');
        await inputs[0].type(name);
        await inputs[1].type(size);
      }
      await h.sleep(100);
      const alloc = await page.$$eval('[data-ss-alloc]', (els) =>
        els.map((e) => e.textContent.trim()),
      );
      expect(alloc.join(',') === '32,29,25', alloc.join(','));
      expect((await h.text('[data-ss-alloc-total]')) === '86', 'total alokasi');
    },
  },
  {
    name: 'tabel statistik: r, t, F, chi-square, nilai hitung, rentang, unduh',
    path: '/tools/tabel-statistik',
    async run(h) {
      const { page } = h;
      // Kosongkan lewat DOM: klik bisa meleset saat tabel sedang bergulir.
      const setNum = async (sel, v) => {
        await page.$eval(sel, (el) => {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.type(sel, v);
        await h.sleep(80);
      };
      const value = () => h.text('[data-st-value]');
      await page.waitForSelector('[data-st-value]');
      // Tabel r: N = 30 → df 28 → 0,3610.
      expect((await value()) === '0,3610', await value());
      expect(
        (await h.text('[data-st-found]')).includes('df = 28'),
        await h.text('[data-st-found]'),
      );
      await setNum('[data-st-stat]', '0.45');
      const dec = await h.text('[data-st-decision]');
      expect(dec.includes('signifikan') && dec.includes('valid') && !dec.includes('tidak'), dec);
      expect(!!(await page.$('[data-st-hi][data-st-row="28"]')), 'baris df 28 tidak disorot');
      // Tabel t: df 10 → 2,2281 dua sisi, 1,8125 satu sisi.
      await page.click('[data-st-kind="t"]');
      await setNum('[data-st-df]', '10');
      expect((await value()) === '2,2281', await value());
      await page.click('[data-st-tails="1"]');
      expect((await value()) === '1,8125', await value());
      // Tabel F: df1 3, df2 20 → 3,0984; tunjukkan di tabel.
      await page.click('[data-st-kind="f"]');
      await setNum('[data-st-df1]', '3');
      await setNum('[data-st-df2]', '20');
      expect((await value()) === '3,0984', await value());
      await page.click('[data-st-show]');
      await page.waitForSelector('[data-st-hi][data-st-row="20"]');
      // Chi-square: df 10 → 18,3070; nilai hitung 15 tidak signifikan.
      await page.click('[data-st-kind="chi"]');
      await setNum('[data-st-df]', '10');
      expect((await value()) === '18,3070', await value());
      await setNum('[data-st-stat]', '15');
      expect(
        (await h.text('[data-st-decision]')).includes('tidak signifikan'),
        await h.text('[data-st-decision]'),
      );
      // Rentang dibatasi 500 baris.
      await setNum('[data-st-to]', '2000');
      const rows = await page.$$eval('[data-st-row]', (els) => els.length);
      expect(rows === 500, `baris ${rows}`);
      await setNum('[data-st-to]', '30');
      // Salin dan unduh.
      await page.evaluate(() => {
        window.__copied = '';
        navigator.clipboard.writeText = async (t) => {
          window.__copied = t;
        };
      });
      await page.click('[data-st-copy]');
      const tsv = await page.evaluate(() => window.__copied);
      expect(tsv.startsWith('Tabel Chi-Square') && tsv.includes('18,307'), tsv.slice(0, 200));
      const xlsx = await h.downloadVia(/^tabel-chi-df-1-30\.xlsx$/, () =>
        page.click('[data-st-xlsx]'),
      );
      expect(xlsx.subarray(0, 2).toString() === 'PK', 'bukan xlsx');
      const pdf = await h.downloadVia(/^tabel-chi-df-1-30\.pdf$/, () =>
        page.click('[data-st-pdf]'),
      );
      expect(pdf.subarray(0, 4).toString() === '%PDF', 'bukan pdf');
      // Link dengan #f langsung membuka tabel F.
      await page.goto('about:blank');
      await page.goto(`${h.base}/tools/tabel-statistik#f`, { waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-st-kind="f"][aria-selected="true"]');
    },
  },
  {
    name: 'uji validitas & reliabilitas: data contoh, per variabel, salin, unduh, simpan',
    path: '/tools/uji-validitas-reliabilitas',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-validity-data'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-vt-sample]');
      await page.click('[data-vt-sample]');
      await page.waitForSelector('[data-vt-result]');
      const info = await h.text('[data-vt-info]');
      expect(info.includes('30 responden × 10 item') && info.includes('No'), info);
      expect((await h.text('[data-vt-rtable]')) === '0,361', await h.text('[data-vt-rtable]'));
      expect((await h.text('[data-vt-valid-count]')) === '9 / 10', 'jumlah item valid');
      expect(
        (await h.text('[data-vt-item="P7"] [data-vt-verdict]')) === 'Tidak valid',
        'P7 seharusnya tidak valid',
      );
      expect((await h.text('[data-vt-item="P1"] [data-vt-verdict]')) === 'Valid', 'P1 valid');
      const interp = await h.text('[data-vt-interp]');
      expect(interp.includes('P7') && interp.includes('dinyatakan reliabel'), interp);
      // Salin kalimat interpretasi.
      await page.evaluate(() => {
        window.__copied = '';
        navigator.clipboard.writeText = async (t) => {
          window.__copied = t;
        };
      });
      await page.click('[data-vt-copy-interp]');
      expect((await page.evaluate(() => window.__copied)) === interp, 'kalimat tersalin');
      // Corrected item-total: P7 tetap tidak valid.
      await page.select('[data-vt-method]', 'corrected');
      await h.sleep(100);
      expect(
        (await h.text('[data-vt-item="P7"] [data-vt-verdict]')) === 'Tidak valid',
        'P7 corrected',
      );
      // Data tersimpan setelah muat ulang.
      await h.sleep(600);
      await page.reload({ waitUntil: 'networkidle0' });
      // Posisi gulir dipulihkan di bawah tool; gulir ke atas supaya island client:visible aktif.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForSelector('[data-vt-result]');
      // Nama kolom X1.* dan Y.*: uji per variabel.
      await page.$eval('[data-vt-data]', (el) => {
        const lines = el.value.split('\n');
        lines[0] = [
          'No',
          'X1.1',
          'X1.2',
          'X1.3',
          'X1.4',
          'X1.5',
          'Y.1',
          'Y.2',
          'Y.3',
          'Y.4',
          'Y.5',
        ].join('\t');
        el.value = lines.join('\n');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => document.querySelectorAll('[data-vt-result]').length === 2);
      await page.click('[data-vt-grouped]');
      await page.waitForFunction(() => document.querySelectorAll('[data-vt-result]').length === 1);
      await page.click('[data-vt-grouped]');
      await page.waitForFunction(() => document.querySelectorAll('[data-vt-result]').length === 2);
      // Unduh Excel: 3 sheet.
      const out = await h.downloadVia(/^uji-validitas-reliabilitas\.xlsx$/, () =>
        page.click('[data-vt-xlsx]'),
      );
      const files = unzipSync(new Uint8Array(out));
      const wb = strFromU8(files['xl/workbook.xml']);
      expect(
        wb.includes('Validitas') && wb.includes('Reliabilitas') && wb.includes('Interpretasi'),
        wb,
      );
    },
  },
  {
    name: 'daftar pustaka: DOI, ISBN, manual, gaya, salin, unduh, simpan',
    path: '/tools/daftar-pustaka',
    async run(h) {
      const { page } = h;
      // Crossref, Google Books, dan Open Library disimulasikan. CSP tetap diuji: intersepsi
      // terjadi setelah browser mengizinkan connect-src.
      const cors = { 'Access-Control-Allow-Origin': '*' };
      const json = (r, body, status = 200) =>
        r.respond({
          status,
          headers: cors,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        const u = r.url();
        if (u.startsWith('https://api.crossref.org/works/'))
          return json(r, {
            message: {
              type: 'journal-article',
              title: ['Nanometre-scale thermometry in a living cell'],
              author: [
                { given: 'Georg', family: 'Kucsko' },
                { given: 'Peter C.', family: 'Maurer' },
              ],
              'container-title': ['Nature'],
              volume: '500',
              issue: '7460',
              page: '54-58',
              issued: { 'date-parts': [[2013, 7, 31]] },
              DOI: '10.1038/nature12373',
            },
          });
        if (u.startsWith('https://www.googleapis.com/books/'))
          return u.includes('9786022895336')
            ? json(r, {
                items: [
                  {
                    volumeInfo: {
                      title: 'Metode Penelitian Kuantitatif',
                      authors: ['Sugiyono'],
                      publishedDate: '2019',
                    },
                  },
                ],
              })
            : json(r, { totalItems: 0 });
        if (u.startsWith('https://openlibrary.org/'))
          return u.includes('9786022895336')
            ? json(r, {
                'ISBN:9786022895336': {
                  publishers: [{ name: 'Alfabeta' }],
                  publish_places: [{ name: 'Bandung' }],
                },
              })
            : json(r, {});
        return r.continue();
      });
      await page.evaluate(() => localStorage.removeItem('toolland-bibliography'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-bib-query]');
      const search = async (q) => {
        await page.$eval('[data-bib-query]', (el) => {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.type('[data-bib-query]', q);
        await page.click('[data-bib-search]');
        await page.waitForSelector('[data-bib-form]');
        await page.waitForFunction(() => document.querySelector('[data-bib-msg]'));
      };
      // DOI.
      await search('https://doi.org/10.1038/nature12373');
      const pv = await h.text('[data-bib-preview]');
      expect(pv.startsWith('Kucsko, G., & Maurer, P. C. (2013).') && pv.includes('54–58'), pv);
      await page.click('[data-bib-save]');
      // ISBN: Google Books dilengkapi Open Library.
      await search('978-602-289-533-6');
      expect(
        (await h.text('[data-bib-preview]')) ===
          'Sugiyono. (2019). Metode Penelitian Kuantitatif. Alfabeta.',
        await h.text('[data-bib-preview]'),
      );
      await page.click('[data-bib-save]');
      // ISBN tidak ditemukan: form tetap terbuka dengan ISBN terisi.
      await search('0-306-40615-2');
      expect(
        (await h.text('[data-bib-msg]')).includes('tidak ditemukan'),
        await h.text('[data-bib-msg]'),
      );
      expect(
        (await page.$eval('[data-bib-field="isbn"]', (el) => el.value)) === '0306406152',
        'ISBN tidak terisi',
      );
      // Isi manual: halaman web lembaga.
      await page.click('[data-bib-new="web"]');
      await page.type('[data-bib-authors]', 'Badan Pusat Statistik');
      await page.type('[data-bib-title]', 'Statistik Pendidikan 2023');
      await page.type('[data-bib-year]', '2023');
      await page.type('[data-bib-field="container"]', 'BPS');
      await page.type('[data-bib-field="url"]', 'https://www.bps.go.id/x');
      await page.click('[data-bib-save]');
      // APA: urut abjad.
      const texts = () =>
        page.$$eval('[data-bib-text]', (els) => els.map((e) => e.textContent.trim()));
      let list = await texts();
      expect(list.length === 3, `jumlah ${list.length}`);
      expect(
        list[0].startsWith('Badan Pusat Statistik. (2023).') &&
          list[1].startsWith('Kucsko') &&
          list[2].startsWith('Sugiyono'),
        list.join(' | '),
      );
      expect(
        (await page.$$eval('[data-bib-cite] strong', (els) => els.map((e) => e.textContent)))[2] ===
          '(Sugiyono, 2019)',
        'kutipan dalam teks',
      );
      // IEEE: urutan masukan dan bernomor (istilah Indonesia: "dan", "hlm.").
      await page.click('[data-bib-style="ieee"]');
      list = await texts();
      expect(
        list[0].startsWith('[1]') && list[0].includes('G. Kucsko dan P. C. Maurer, “Nanometre'),
        list[0],
      );
      expect(list[0].includes('hlm. 54–58, 2013'), list[0]);
      expect(
        list[1].startsWith('[2]') &&
          list[1].includes('Sugiyono, Metode Penelitian Kuantitatif. Bandung: Alfabeta, 2019.'),
        list[1],
      );
      // Salin semua sebagai HTML berformat.
      await page.evaluate(() => {
        window.__html = '';
        navigator.clipboard.write = async (items) => {
          window.__html = await (await items[0].getType('text/html')).text();
        };
      });
      await page.click('[data-bib-copy]');
      await page.waitForFunction(() => window.__html);
      const html = await page.evaluate(() => window.__html);
      expect(html.includes('<i>Nature</i>') && html.includes('[1]'), html.slice(0, 300));
      // Unduh Word, BibTeX, RIS.
      const docx = await h.downloadVia(/^daftar-pustaka\.docx$/, () =>
        page.click('[data-bib-docx]'),
      );
      const doc = strFromU8(unzipSync(new Uint8Array(docx))['word/document.xml']);
      expect(doc.includes('DAFTAR PUSTAKA') && doc.includes('w:hanging="720"'), 'docx');
      const bib = await h.downloadVia(/^daftar-pustaka\.bib$/, () => page.click('[data-bib-bib]'));
      expect(
        bib.toString().includes('@article{kucsko2013nanometrescale,'),
        bib.toString().slice(0, 200),
      );
      const ris = await h.downloadVia(/^daftar-pustaka\.ris$/, () => page.click('[data-bib-ris]'));
      expect(ris.toString().includes('TY  - BOOK'), 'ris');
      // Daftar dan gaya tersimpan.
      await page.reload({ waitUntil: 'networkidle0' });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForFunction(() => document.querySelectorAll('[data-bib-text]').length === 3);
      expect(
        !!(await page.$('[data-bib-style="ieee"][aria-checked="true"]')),
        'gaya tidak tersimpan',
      );
    },
  },
  {
    name: 'editor diagram: seret, sambung, teks, format, undo, ekspor, buka .drawio, simpan otomatis',
    path: '/tools/editor-diagram',
    async run(h) {
      const { page } = h;
      page.on('dialog', (d) => d.accept());
      await page.evaluate(() => localStorage.removeItem('toolland-diagram'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-dg-item="fcDecision"] svg');
      await page.$eval('[data-dg-full]', (e) => e.click());
      await h.sleep(300);
      expect(
        await page.$eval('[data-dg-root]', (e) => e.classList.contains('fixed')),
        'tidak layar penuh',
      );
      const cb = await (await page.$('[data-dg-canvas]')).boundingBox();
      const drag = async (id, x, y) => {
        const it = await (await page.$(`[data-dg-item="${id}"]`)).boundingBox();
        await page.mouse.move(it.x + it.width / 2, it.y + it.height / 2);
        await page.mouse.down();
        await page.mouse.move(cb.x + x, cb.y + y, { steps: 12 });
        await page.mouse.up();
        await h.sleep(150);
      };
      const typeAt = async (x, y, text) => {
        await page.mouse.click(cb.x + x, cb.y + y, { count: 2 });
        await h.sleep(150);
        await page.keyboard.type(text);
        await page.mouse.click(cb.x + 900, cb.y + 650);
        await h.sleep(150);
      };
      await drag('fcTerminator', 300, 100);
      await drag('fcProcess', 300, 260);
      await typeAt(300, 100, 'Mulai');
      await typeAt(300, 260, 'Hitung');
      expect(!(await page.$('[data-dg-empty]')), 'petunjuk kanvas kosong masih tampil');
      // Garis dari titik sambung bawah terminator ke proses.
      await page.mouse.move(cb.x + 300, cb.y + 100);
      await h.sleep(150);
      await page.mouse.move(cb.x + 300, cb.y + 125);
      await h.sleep(150);
      await page.mouse.down();
      await page.mouse.move(cb.x + 300, cb.y + 232, { steps: 8 });
      await h.sleep(150);
      await page.mouse.up();
      await h.sleep(150);
      // Format: pilih proses, beri warna isi.
      await page.mouse.click(cb.x + 300, cb.y + 260);
      await page.waitForSelector('[data-dg-selcount]');
      await page.$eval('[data-dg-format] button[title="#bfdbfe"]', (e) => e.click());
      await h.sleep(900);
      // Simpanan berisi semua halaman; `xml` = halaman aktif.
      const read = async () => {
        const st = JSON.parse(await page.evaluate(() => localStorage.getItem('toolland-diagram')));
        return { ...st, xml: st.pages[st.current].xml };
      };
      let saved = await read();
      expect(saved.xml.includes('Mulai') && saved.xml.includes('Hitung'), 'teks tidak tersimpan');
      expect(saved.xml.includes('fillColor=#bfdbfe'), 'warna isi tidak tersimpan');
      const edge = /<mxCell id="([^"]*)"[^>]*edge="1"[^>]*source="\d+" target="\d+"/.exec(
        saved.xml,
      );
      expect(edge && edge[1] !== '', 'garis tidak tersambung atau id kosong');
      // Undo menghapus warna.
      await page.$eval('[data-dg-undo]', (e) => e.click());
      await h.sleep(900);
      saved = await read();
      expect(!saved.xml.includes('fillColor=#bfdbfe'), 'undo gagal');
      // Simpan .drawio, ekspor SVG dan PNG.
      await h.type('[data-dg-title]', 'Alur Uji');
      const drawio = await h.downloadVia(/^alur-uji\.drawio$/, () =>
        page.$eval('[data-dg-save]', (e) => e.click()),
      );
      expect(
        drawio.toString().startsWith('<mxfile') && drawio.toString().includes('Mulai'),
        'drawio',
      );
      await page.$eval('[data-dg-export]', (e) => e.click());
      const svg = await h.downloadVia(/^alur-uji\.svg$/, () =>
        page.$eval('[data-dg-export-svg]', (e) => e.click()),
      );
      expect(svg.toString().includes('<svg') && svg.toString().includes('Hitung'), 'svg');
      await page.$eval('[data-dg-export]', (e) => e.click());
      const png = await h.downloadVia(/^alur-uji\.png$/, () =>
        page.$eval('[data-dg-export-png]', (e) => e.click()),
      );
      expect(png.subarray(1, 4).toString() === 'PNG', 'png');
      // Buka .drawio terkompresi berisi dua halaman.
      const input = await page.$('[data-dg-file]');
      await input.uploadFile(h.fixture('diagram.drawio'));
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-page]').length === 2);
      const tabs = await page.$$eval('[data-dg-page]', (e) => e.map((x) => x.textContent.trim()));
      expect(tabs.join('|') === 'IoT|Kedua', tabs.join('|'));
      await h.sleep(900);
      saved = await read();
      expect(
        saved.xml.includes('ESP32') &&
          saved.xml.includes('shape=process') &&
          saved.title === 'diagram',
        saved.xml.slice(0, 200),
      );
      // Muat ulang: diagram dipulihkan.
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-dg-status]');
      await page.waitForFunction(() =>
        document.querySelector('[data-dg-status]')?.textContent?.includes('dipulihkan'),
      );
      expect((await page.$eval('[data-dg-title]', (e) => e.value)) === 'diagram', 'judul');
    },
  },
  {
    name: 'editor diagram: pustaka teknik, pencarian, kabel otomatis antar pin',
    path: '/tools/editor-diagram',
    async run(h) {
      const { page } = h;
      await page.evaluate(() => localStorage.removeItem('toolland-diagram'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-dg-item="rect"] svg');
      await page.$eval('[data-dg-full]', (e) => e.click());
      await h.sleep(300);
      // Semua grup pustaka ada dan setiap item punya pratinjau.
      const groups = await page.$$eval('[data-dg-library] section > button', (bs) =>
        bs.map((b) => b.textContent.trim()),
      );
      for (const g of ['Elektronika', 'Gerbang logika', 'IoT', 'Jaringan', 'UML', 'ERD'])
        expect(groups.includes(g), `grup ${g} tidak ada: ${groups.join(', ')}`);
      // Pencarian menemukan simbol teknik.
      await h.type('[data-dg-search]', 'resistor');
      await page.waitForSelector('[data-dg-item="elResistor"] svg');
      await h.type('[data-dg-search]', 'esp32');
      await page.waitForSelector('[data-dg-item="iotEsp"] svg');
      await h.type('[data-dg-search]', '');
      await page.$$eval('[data-dg-library] section > button[aria-expanded="false"]', (bs) =>
        bs.forEach((b) => b.click()),
      );
      await h.sleep(200);
      const missing = await page.$$eval('[data-dg-item]', (els) =>
        els.filter((e) => !e.querySelector('svg')).map((e) => e.dataset.dgItem),
      );
      expect(!missing.length, `tanpa pratinjau: ${missing.join(', ')}`);
      // Resistor dan LED, lalu tarik kabel dari pin kanan resistor ke pin kiri LED.
      const cb = await (await page.$('[data-dg-canvas]')).boundingBox();
      const drag = async (id, x, y) => {
        const el = await page.$(`[data-dg-item="${id}"]`);
        await el.scrollIntoView();
        const it = await el.boundingBox();
        await page.mouse.move(it.x + it.width / 2, it.y + it.height / 2);
        await page.mouse.down();
        await page.mouse.move(cb.x + x, cb.y + y, { steps: 12 });
        await page.mouse.up();
        await h.sleep(150);
      };
      await drag('elResistor', 300, 300);
      await drag('elLed', 500, 300);
      await page.mouse.click(cb.x + 700, cb.y + 600);
      // Simpanan berisi semua halaman; `xml` = halaman aktif.
      const read = async () => {
        const st = JSON.parse(await page.evaluate(() => localStorage.getItem('toolland-diagram')));
        return { ...st, xml: st.pages[st.current].xml };
      };
      await h.sleep(800);
      // Baca geometri dan garis dari XML tersimpan.
      const cellsOf = (xml) =>
        page.evaluate((x) => {
          const d = new DOMParser().parseFromString(x, 'text/xml');
          return [...d.querySelectorAll('mxCell')].map((c) => {
            const g = c.querySelector('mxGeometry');
            return {
              style: c.getAttribute('style') ?? '',
              edge: c.getAttribute('edge') === '1',
              source: c.getAttribute('source'),
              target: c.getAttribute('target'),
              geo: g
                ? ['x', 'y', 'width', 'height'].map((k) => Number(g.getAttribute(k) ?? 0))
                : null,
            };
          });
        }, xml);
      const geo = (cells, shape) => cells.find((c) => c.style.includes(`shape=${shape};`))?.geo;
      let saved = await read();
      let cells = await cellsOf(saved.xml);
      const res = geo(cells, 'tl.el.resistor');
      const led = geo(cells, 'tl.el.led');
      expect(res && led, saved.xml.slice(0, 300));
      // Koordinat diagram = layar - 40 (translate awal); pin: resistor (1, 0.5), LED (0, 0.625).
      const sx = cb.x + 40 + res[0] + res[2];
      const sy = cb.y + 40 + res[1] + res[3] / 2;
      const tx = cb.x + 40 + led[0];
      const ty = cb.y + 40 + led[1] + led[3] * 0.625;
      await page.mouse.move(sx - 20, sy);
      await h.sleep(150);
      await page.mouse.move(sx, sy);
      await h.sleep(150);
      await page.mouse.down();
      await page.mouse.move(tx, ty, { steps: 10 });
      await h.sleep(150);
      await page.mouse.up();
      await h.sleep(900);
      saved = await read();
      cells = await cellsOf(saved.xml);
      const edge = cells.find((c) => c.edge && c.source && c.target);
      expect(edge, `kabel tidak tersambung: ${saved.xml.slice(-500)}`);
      expect(edge.style.includes('endArrow=none') && edge.style.includes('rounded=0'), edge.style);
      expect(
        edge.style.includes('exitX=1') && edge.style.includes('entryX=0'),
        `bukan pin: ${edge.style}`,
      );
    },
  },
  {
    name: 'editor diagram: template, halaman, cari-ganti, tata letak, layer, tabel, minimap, PDF',
    path: '/tools/editor-diagram',
    async run(h) {
      const { page } = h;
      page.on('dialog', (d) => d.accept());
      await page.evaluate(() => localStorage.removeItem('toolland-diagram'));
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[data-dg-item="rect"] svg');
      await page.$eval('[data-dg-full]', (e) => e.click());
      await h.sleep(300);
      const click = (sel) => page.$eval(sel, (e) => e.click());
      const tabs = () => page.$$eval('[data-dg-page]', (e) => e.map((x) => x.textContent.trim()));
      const read = async () => {
        await h.sleep(800);
        return JSON.parse(await page.evaluate(() => localStorage.getItem('toolland-diagram')));
      };
      // Template dibuka sebagai halaman baru, dengan pratinjau.
      await click('[data-dg-templates]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-tpl] svg').length >= 9);
      await click('[data-dg-tpl="flowLogin"]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-page]').length === 2);
      expect((await tabs()).join('|') === 'Halaman 1|Flowchart login', (await tabs()).join('|'));
      let saved = await read();
      expect(saved.current === 1 && saved.pages[1].xml.includes('Data valid?'), 'template');
      // Tambah, duplikat, ganti nama, hapus halaman.
      await click('[data-dg-add-page]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-page]').length === 3);
      await page.$$eval('[data-dg-page]', (e) => e[1].click());
      await click('[data-dg-page-menu]');
      await click('[data-dg-page-dup]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-page]').length === 4);
      expect((await tabs())[2] === 'Flowchart login (salinan)', (await tabs()).join('|'));
      await page.$$eval('[data-dg-page]', (e) =>
        e[2].dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
      );
      await page.waitForSelector('[data-dg-page-rename]');
      await page.$eval('[data-dg-page-rename]', (e) => {
        e.value = 'Login v2';
        e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-dg-page]')].some(
          (e) => e.textContent.trim() === 'Login v2',
        ),
      );
      await page.$$eval('[data-dg-page]', (e) => e[3].click());
      await click('[data-dg-page-menu]');
      await click('[data-dg-page-del]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-page]').length === 3);
      // Kembali ke Login v2: cari dan ganti.
      await page.$$eval('[data-dg-page]', (e) => e[2].click());
      await h.sleep(200);
      await click('[data-dg-find]');
      await page.waitForSelector('[data-dg-find-input]');
      await page.type('[data-dg-find-input]', 'tampilkan');
      await page.waitForFunction(() =>
        document.querySelector('[data-dg-find-count]')?.textContent?.includes('1 dari 2'),
      );
      await page.type('[data-dg-replace-input]', 'Munculkan');
      await click('[data-dg-replace-all]');
      expect(
        (await h.text('[data-dg-find-note]')).includes('2 label'),
        await h.text('[data-dg-find-note]'),
      );
      saved = await read();
      expect(
        saved.pages[2].name === 'Login v2' && saved.pages[2].xml.includes('Munculkan dasbor'),
        saved.pages[2].xml.slice(0, 300),
      );
      expect(saved.pages[1].xml.includes('Tampilkan dasbor'), 'halaman lain ikut berubah');
      // Tata letak hierarki bisa diurungkan.
      const before = saved.pages[2].xml;
      await click('[data-dg-layout]');
      await click('[data-dg-layout-kind="horizontal"]');
      saved = await read();
      expect(saved.pages[2].xml !== before, 'tata letak tidak mengubah posisi');
      await click('[data-dg-undo]');
      saved = await read();
      expect(saved.pages[2].xml === before, 'undo tata letak');
      // Layer: tambah, kunci; tabel masuk ke layer aktif.
      await page.keyboard.press('Escape');
      await page.mouse.click(5, 5);
      await page.evaluate(() => document.querySelector('[data-dg-canvas]').focus());
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-dg-add-layer]');
      await click('[data-dg-add-layer]');
      await page.waitForFunction(() => document.querySelectorAll('[data-dg-layer]').length === 2);
      await click('[data-dg-insert]');
      await click('[data-dg-insert-table]');
      await h.sleep(200);
      await page.evaluate(() => document.querySelector('[data-dg-canvas]').focus());
      await page.keyboard.press('Escape');
      await page.waitForSelector('[data-dg-lock-layer]');
      await page.$$eval('[data-dg-lock-layer]', (e) => e[0].click());
      saved = await read();
      const doc = saved.pages[2].xml;
      expect(/<mxCell id="[^"]+" value="Layer 2" style="locked=1;/.test(doc), doc.slice(0, 400));
      expect(doc.includes('&lt;table'), 'tabel tidak tersimpan');
      // Minimap dan PDF semua halaman (halaman kosong dilewati).
      await click('[data-dg-minimap]');
      await page.waitForSelector('[data-dg-map] svg');
      await click('[data-dg-export]');
      const pdf = await h.downloadVia(/^diagram-tanpa-judul\.pdf$/, () =>
        click('[data-dg-export-pdf]'),
      );
      expect(pdf.subarray(0, 4).toString() === '%PDF', 'pdf');
      const { PDFDocument } = await import('pdf-lib');
      const n = (await PDFDocument.load(pdf)).getPageCount();
      expect(n === 2, `halaman pdf ${n}`);
      // Simpan .drawio berisi semua halaman.
      const file = await h.downloadVia(/^diagram-tanpa-judul\.drawio$/, () =>
        click('[data-dg-save]'),
      );
      expect((file.toString().match(/<diagram /g) ?? []).length === 3, 'drawio 3 halaman');
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
