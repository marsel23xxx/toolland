import { GraphDataModel, ModelXmlSerializer } from '@maxgraph/core';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { styleToString } from './drawio';
import { labelText } from './editor';
import { diagramPdf } from './pdf';
import { TEMPLATES } from './templates';

// PNG 1×1 piksel.
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

describe('template', () => {
  it('setiap template menghasilkan diagram yang bisa dibaca dalam dua bahasa', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(9);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES)
      for (const lang of ['id', 'en'] as const) {
        const xml = t.build(lang);
        const model = new GraphDataModel();
        new ModelXmlSerializer(model).import(xml);
        const cells = model.getRoot()!.getChildAt(0).children;
        const edges = cells.filter((c) => c.isEdge());
        expect(cells.length, `${t.id}/${lang}`).toBeGreaterThan(3);
        // Semua garis tersambung ke dua sel.
        for (const e of edges) {
          expect(e.getTerminal(true), `${t.id}: garis tanpa sumber`).toBeTruthy();
          expect(e.getTerminal(false), `${t.id}: garis tanpa tujuan`).toBeTruthy();
        }
      }
  });

  it('teks template mengikuti bahasa', () => {
    const login = TEMPLATES.find((t) => t.id === 'flowLogin')!;
    expect(login.build('id')).toContain('Mulai');
    expect(login.build('en')).toContain('Start');
  });
});

describe('PDF', () => {
  it('ukuran sesuai diagram dan A4 dengan orientasi otomatis', async () => {
    const pages = [
      { png: PNG, width: 400, height: 200 },
      { png: PNG, width: 300, height: 900 },
    ];
    const fit = await PDFDocument.load(await diagramPdf(pages, 'fit', 'Uji'));
    expect(fit.getPageCount()).toBe(2);
    expect(fit.getPage(0).getSize()).toEqual({ width: 300, height: 150 });
    const a4 = await PDFDocument.load(await diagramPdf(pages, 'a4', 'Uji'));
    expect(a4.getPage(0).getWidth()).toBeGreaterThan(a4.getPage(0).getHeight());
    expect(a4.getPage(1).getHeight()).toBeGreaterThan(a4.getPage(1).getWidth());
    expect(a4.getTitle()).toBe('Uji');
  });
});

describe('label dan gambar', () => {
  it('teks polos dari label HTML', () => {
    expect(labelText('<b>Halo</b><br>dunia &amp; <i>kamu</i>')).toBe('Halo dunia & kamu');
    expect(labelText(null)).toBe('');
  });

  it('gambar data: disimpan tanpa ;base64 seperti .drawio', () => {
    expect(styleToString({ shape: 'image', image: 'data:image/png;base64,AAAA' })).toBe(
      'shape=image;image=data:image/png,AAAA;',
    );
  });
});
