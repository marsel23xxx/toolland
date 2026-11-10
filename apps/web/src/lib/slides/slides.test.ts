import { strFromU8, unzipSync } from 'fflate';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { COMPANY_FORM, buildDeck as company } from '../templates/ppt-company-profile';
import { LAPORAN_FORM, buildDeck as laporan } from '../templates/ppt-laporan';
import { PITCH_FORM, buildDeck as pitch } from '../templates/ppt-pitch-deck';
import { SKRIPSI_FORM, buildDeck as skripsi } from '../templates/ppt-skripsi';
import { renderDeckPdf } from './pdf';
import { renderPptx } from './pptx';

const DUMP = process.env.PPT_DUMP;

describe('ppt sidang skripsi', () => {
  for (const style of ['geo', 'minimal', 'gradient'])
    it(`renders ${style} to PDF and PPTX`, async () => {
      const spec = skripsi({ ...SKRIPSI_FORM.id.sample, style }, {});
      expect(spec.slides.length).toBeGreaterThan(12);
      const { bytes } = await renderDeckPdf(spec);
      const pptx = await renderPptx(spec);
      const files = unzipSync(pptx);
      expect(files['ppt/slides/slide1.xml']).toBeTruthy();
      expect(strFromU8(files['ppt/slides/slide1.xml'])).toContain('Julian Marcell');
      if (DUMP) {
        writeFileSync(`${DUMP}/skripsi-${style}.pdf`, bytes);
        writeFileSync(`${DUMP}/skripsi-${style}.pptx`, pptx);
      }
    });
});

const photo = (name: string, w: number, h: number) => {
  const path = `${DUMP}/${name}`;
  return DUMP && existsSync(path)
    ? { data: new Uint8Array(readFileSync(path)), type: 'jpeg' as const, w, h }
    : undefined;
};

describe('ppt templates', () => {
  const assets = Object.fromEntries(
    Object.entries({
      coverPhoto: photo('photo1.jpg', 1200, 800),
      productPhoto: photo('photo2.jpg', 800, 1000),
      aboutPhoto: photo('photo2.jpg', 800, 1000),
      gallery1: photo('photo1.jpg', 1200, 800),
      gallery2: photo('photo2.jpg', 800, 1000),
      gallery3: photo('photo3.jpg', 1000, 700),
    }).filter(([, v]) => v),
  ) as Record<string, NonNullable<ReturnType<typeof photo>>>;
  const cases = [
    ['pitch', pitch, PITCH_FORM],
    ['company', company, COMPANY_FORM],
    ['laporan', laporan, LAPORAN_FORM],
  ] as const;
  for (const [name, build, form] of cases)
    for (const lang of ['id', 'en'] as const)
      it(`renders ${name} (${lang})`, async () => {
        const spec = build({ ...form[lang].sample }, assets);
        expect(spec.slides.length).toBeGreaterThan(8);
        const { bytes } = await renderDeckPdf(spec);
        const pptx = await renderPptx(spec);
        const files = unzipSync(pptx);
        const xml = Object.keys(files)
          .filter((k) => k.startsWith('ppt/slides/slide'))
          .map((k) => strFromU8(files[k]))
          .join('');
        expect(xml).not.toContain('undefined');
        expect(xml).not.toContain('NaN');
        if (DUMP && lang === 'id') {
          writeFileSync(`${DUMP}/${name}.pdf`, bytes);
          writeFileSync(`${DUMP}/${name}.pptx`, pptx);
        }
      });
});
