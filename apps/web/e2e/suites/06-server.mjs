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
];
