import { PDFDocument } from 'pdf-lib';
import { expect } from '../expect.mjs';

// Butuh API Rust + Gotenberg berjalan: TOOLLAND_API_URL=http://127.0.0.1:8082 pnpm e2e server
const skip = !process.env.TOOLLAND_API_URL;

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
];
