import { unzipSync, strFromU8 } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { expect } from '../expect.mjs';

// Butuh API Rust + Gotenberg berjalan: TOOLLAND_API_URL=http://127.0.0.1:8082 pnpm e2e server
const skip = !process.env.TOOLLAND_API_URL;

/** Isi word/document.xml dari file DOCX. */
function docxText(buf) {
  const files = unzipSync(new Uint8Array(buf));
  expect(files['word/document.xml'], 'bukan DOCX');
  return strFromU8(files['word/document.xml']);
}

export const tests = [
  {
    name: 'Word ke PDF (API Rust + Gotenberg)',
    path: '/tools/word-ke-pdf',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.upload('surat.docx');
      const [c] = await h.results(1, 90000);
      expect(c.includes('surat.pdf'), c);
      const pdf = await h.download('surat.pdf');
      expect((await PDFDocument.load(pdf)).getPageCount() === 1, 'PDF hasil tidak valid');
      return [c];
    },
  },
  ...[
    ['Excel ke PDF', '/tools/excel-ke-pdf', 'tabel.xlsx', 'tabel.pdf'],
    ['PowerPoint ke PDF', '/tools/ppt-ke-pdf', 'slide.pptx', 'slide.pdf'],
  ].map(([name, path, input, output]) => ({
    name: `${name} (API Rust + Gotenberg)`,
    path,
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.upload(input);
      const [c] = await h.results(1, 90000);
      expect(c.includes(output), c);
      const pdf = await h.download(output);
      expect((await PDFDocument.load(pdf)).getPageCount() >= 1, 'PDF hasil tidak valid');
      return [c];
    },
  })),
  {
    name: 'ODT ke DOCX (API Rust + converter LibreOffice)',
    path: '/tools/odt-ke-docx',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.upload('surat.odt');
      const [c] = await h.results(1, 90000);
      expect(c.includes('surat.docx'), c);
      const xml = docxText(await h.download('surat.docx'));
      expect(
        ['Surat Undangan Rapat', 'Ruang Melati', 'Hadir tepat waktu'].every((t) => xml.includes(t)),
        'isi DOCX tidak lengkap',
      );
      expect(xml.includes('<w:tbl>'), 'tabel hilang');
      return [c];
    },
  },
  {
    name: 'PDF ke Word (API Rust + converter pdf2docx)',
    path: '/tools/pdf-ke-word',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.upload('teks.pdf');
      const [c] = await h.results(1, 90000);
      expect(c.includes('teks.docx'), c);
      const xml = docxText(await h.download('teks.docx'));
      // Halaman 3 diputar sehingga teksnya tampil vertikal; pdf2docx memang melewati teks vertikal.
      for (const i of [1, 2, 4])
        expect(xml.includes(`Dokumen uji - halaman ${i}`), `teks halaman ${i} hilang`);
      // Halaman 3 tetap menjadi halaman landscape tersendiri (4 bagian halaman).
      expect((xml.match(/<w:sectPr/g) ?? []).length === 4, 'jumlah halaman berubah');
      return [c];
    },
  },
  {
    name: 'PDF ke Word: PDF hasil scan diberi pesan jelas',
    path: '/tools/pdf-ke-word',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.upload('foto.pdf');
      await h.page.waitForFunction(() => document.body.innerText.includes('hasil scan'), {
        timeout: 90000,
      });
      // Respons 422 memang diharapkan; browser mencatatnya sebagai "Failed to load resource".
      h.problems.length = 0;
    },
  },
  {
    name: 'kompres PDF maksimal (Ghostscript)',
    path: '/tools/kompres-pdf-maksimal',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.page.select('#sc-level', 'high');
      await h.upload('foto.pdf');
      const [c] = await h.results(1, 90000);
      expect(/hemat \d+%/.test(c), c);
      const pdf = await h.download('foto-kecil.pdf');
      expect((await PDFDocument.load(pdf)).getPageCount() === 2, 'PDF hasil rusak');
      return [c];
    },
  },
  {
    name: 'server menolak file palsu dengan pesan jelas',
    path: '/tools/word-ke-pdf',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      // Dropzone memfilter ekstensi; kirim langsung lewat helper agar validasi server yang diuji.
      const status = await h.page.evaluate(async () => {
        const form = new FormData();
        form.append(
          'file',
          new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])], 'palsu.docx'),
        );
        const r = await fetch('/api/tools/v1/office-to-pdf', { method: 'POST', body: form });
        return `${r.status} ${await r.text()}`;
      });
      expect(status.startsWith('415') && status.includes('unsupported'), status);
      // Respons 415 memang diharapkan; browser mencatatnya sebagai "Failed to load resource".
      h.problems.length = 0;
    },
  },
  {
    name: 'Cek WHOIS (API Rust + RDAP registry, butuh internet)',
    path: '/tools/cek-whois',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.type('#whois-domain', 'https://www.julian-marcell.com/tools');
      await h.page.click('form button[type=submit]');
      await h.page.waitForSelector('section[aria-label="Hasil WHOIS"]', { timeout: 30000 });
      const t = await h.text('section[aria-label="Hasil WHOIS"]');
      expect(
        t.includes('julian-marcell.com') && /Kedaluwarsa/.test(t) && /sisa \d+ hari/.test(t),
        t,
      );
      await h.type('#whois-domain', 'belum-terdaftar-toolland-0a9z.com');
      await h.page.click('form button[type=submit]');
      await h.page.waitForSelector('#whois-free', { timeout: 30000 });
      const err = await h.text('#whois-free');
      expect(/belum terdaftar/.test(err), err);
      return [t.replace(/\s+/g, ' ').slice(0, 160)];
    },
  },
  {
    name: 'Cek Website (API Rust, butuh internet): nilai, sertifikat, teknologi, alamat lokal ditolak',
    path: '/tools/cek-website',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      await h.type('#sc-host', 'https://julian-marcell.com/tools');
      await h.page.click('form button[type=submit]');
      const sel = 'section[aria-label="Hasil cek website"]';
      await h.page.waitForSelector(sel, { timeout: 40000 });
      const grade = await h.text('[data-sc-grade]');
      expect(/^[A-F]$/.test(grade.trim()), grade);
      const https = await h.page.$eval('[data-check="https"]', (el) => el.dataset.status);
      expect(https === 'pass', `https: ${https}`);
      const tech = await h.text('[data-sc-tech]');
      expect(/Cloudflare/.test(tech), tech);
      const t = await h.text(sel);
      expect(/Sertifikat SSL/.test(t) && /sisa \d+ hari/.test(t), t.slice(0, 300));

      // Domain yang mengarah ke 127.0.0.1 ditolak server (403), bukan dibuka.
      await h.type('#sc-host', 'localtest.me');
      await h.page.click('form button[type=submit]');
      await h.page.waitForSelector('#sc-error', { timeout: 30000 });
      const err = await h.text('#sc-error');
      expect(/jaringan lokal/.test(err), err);
      h.problems.length = 0;
      return [`nilai ${grade.trim()}`, tech.replace(/\s+/g, ' ').slice(0, 120)];
    },
  },
  {
    name: 'rapat online: tamu menunggu, host menerima, video mengalir, chat, kunci, blur',
    path: '/tools/rapat-online',
    async run(h) {
      if (skip) return ['dilewati: TOOLLAND_API_URL tidak diisi'];
      const { page } = h;
      const enterName = async (p, name) => {
        await p.waitForSelector('[data-meet-name-input]');
        await p.$eval('[data-meet-name-input]', (e) => (e.value = ''));
        await p.type('[data-meet-name-input]', name);
        await p.click('[data-meet-join]');
      };
      const others = [];
      const guest = async (room, name) => {
        const ctx = await h.browser.createBrowserContext();
        others.push(ctx);
        const p = await ctx.newPage();
        await p.goto(`${h.base}/tools/rapat-online#r=${room}`, { waitUntil: 'networkidle0' });
        await enterName(p, name);
        return p;
      };
      try {
        await page.click('[data-meet-new]');
        await enterName(page, 'Ana');
        await page.waitForSelector('[data-meet-room-view]');
        const room = await page.evaluate(() => location.hash.slice(3));
        expect(/^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/.test(room), room);

        // Tamu menunggu sampai host menerima.
        const budi = await guest(room, 'Budi');
        await budi.waitForSelector('[data-meet-waiting]');
        await page.waitForSelector('[data-meet-knock]');
        expect((await h.text('[data-meet-knock]')).includes('Budi'), 'nama tamu tidak muncul');
        await page.click('[data-meet-admit]');
        await budi.waitForSelector('[data-meet-room-view]');

        // Video tamu benar-benar mengalir ke host dan sebaliknya (peer-to-peer).
        const flowing = () =>
          [...document.querySelectorAll('[data-meet-tile] video')].length === 2 &&
          [...document.querySelectorAll('[data-meet-tile] video')][1].videoWidth > 0;
        await page.waitForFunction(flowing, { timeout: 20000 });
        await budi.waitForFunction(flowing, { timeout: 20000 });
        const names = await page.$$eval('[data-meet-name]', (e) => e.map((x) => x.textContent));
        expect(
          names.some((n) => n.includes('Budi')),
          names.join(', '),
        );

        // Chat: tamu melihat tanda belum dibaca, lalu pesannya.
        await page.click('[data-meet-chat-btn]');
        await page.type('[data-meet-chat-input]', 'Halo dari Ana');
        await page.keyboard.press('Enter');
        await budi.waitForFunction(() =>
          document.querySelector('[data-meet-chat-btn]')?.textContent?.includes('1'),
        );
        await budi.click('[data-meet-chat-btn]');
        await budi.waitForFunction(() =>
          document.querySelector('[data-meet-chat]')?.textContent?.includes('Halo dari Ana'),
        );

        // Kunci rapat: orang ketiga ditolak.
        await page.click('[data-meet-people-btn]');
        await page.click('[data-meet-lock]');
        await h.sleep(300);
        const citra = await guest(room, 'Citra');
        await citra.waitForSelector('[data-meet-ended][data-reason="locked"]');

        // Blur latar di host: video ke tamu tetap mengalir.
        await page.click('[data-meet-room-view] [data-meet-blur]');
        await page.waitForFunction(
          () =>
            document
              .querySelector('[data-meet-room-view] [data-meet-blur]')
              ?.getAttribute('aria-pressed') === 'true' &&
            !document.querySelector('[data-meet-room-view] [data-meet-blur]')?.disabled,
          { timeout: 30000 },
        );
        await h.sleep(1500);
        await budi.waitForFunction(flowing, { timeout: 10000 });

        // Tamu keluar: host kembali sendirian.
        await budi.click('[data-meet-leave]');
        await page.waitForFunction(
          () => document.querySelectorAll('[data-meet-tile]').length === 1,
          { timeout: 10000 },
        );
      } finally {
        for (const c of others) await c.close();
      }
    },
  },
];
