/**
 * Ekspor PDF Editor Diagram: setiap halaman diagram menjadi satu halaman PDF berisi gambar PNG
 * (resolusi 2×). Ukuran halaman mengikuti diagram, atau A4 dengan orientasi otomatis.
 */
import { PDFDocument } from 'pdf-lib';

export type PdfPaper = 'fit' | 'a4';

export interface PdfPage {
  png: Uint8Array;
  /** Ukuran diagram dalam piksel CSS (skala 1). */
  width: number;
  height: number;
}

const A4 = { w: 595.28, h: 841.89 };
const PX_TO_PT = 0.75;

export async function diagramPdf(
  pages: PdfPage[],
  paper: PdfPaper,
  title: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator('Toolland Editor Diagram');
  for (const p of pages) {
    const img = await doc.embedPng(p.png);
    const w = p.width * PX_TO_PT;
    const h = p.height * PX_TO_PT;
    if (paper === 'fit') {
      const page = doc.addPage([w, h]);
      page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      continue;
    }
    const landscape = w > h;
    const pw = landscape ? A4.h : A4.w;
    const ph = landscape ? A4.w : A4.h;
    const margin = 36;
    // Tidak diperbesar melebihi ukuran aslinya; diperkecil bila tidak muat.
    const k = Math.min(1, (pw - margin * 2) / w, (ph - margin * 2) / h);
    const page = doc.addPage([pw, ph]);
    page.drawImage(img, { x: (pw - w * k) / 2, y: (ph - h * k) / 2, width: w * k, height: h * k });
  }
  return doc.save();
}
