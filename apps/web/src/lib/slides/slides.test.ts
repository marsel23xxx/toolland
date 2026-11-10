import { strFromU8, unzipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DocAssets, DocValues } from '../docs/form';
import { COMPANY_FORM, buildDeck as company } from '../templates/ppt-company-profile';
import { LAPORAN_FORM, buildDeck as laporan } from '../templates/ppt-laporan';
import { PITCH_FORM, buildDeck as pitch } from '../templates/ppt-pitch-deck';
import { SKRIPSI_FORM, buildDeck as skripsi } from '../templates/ppt-skripsi';
import { renderDeckPdf } from './pdf';
import { SAMPLE_PHOTOS, sampleName } from './photos';
import { renderPptx } from './pptx';

const DUMP = process.env.PPT_DUMP;

/** Foto contoh dari public/templates/photos, seperti yang dimuat browser. */
function sampleAssets(v: DocValues): DocAssets {
  const out: DocAssets = {};
  for (const [k, val] of Object.entries(v)) {
    const name = typeof val === 'string' ? sampleName(val) : undefined;
    if (!name) continue;
    const { w, h } = SAMPLE_PHOTOS[name];
    out[k] = {
      data: new Uint8Array(readFileSync(`public/templates/photos/${name}.jpg`)),
      type: 'jpeg',
      w,
      h,
    };
  }
  return out;
}

const cases = [
  ['skripsi', skripsi, SKRIPSI_FORM, {}],
  ['sempro', skripsi, SKRIPSI_FORM, { kind: 'sempro' }],
  ['pitch', pitch, PITCH_FORM, {}],
  ['company', company, COMPANY_FORM, {}],
  ['laporan', laporan, LAPORAN_FORM, {}],
] as const;

describe('ppt templates', () => {
  it('every sample photo file exists', () => {
    for (const name of Object.keys(SAMPLE_PHOTOS))
      expect(readFileSync(`public/templates/photos/${name}.jpg`).length).toBeGreaterThan(10_000);
  });

  for (const [name, build, form, extra] of cases)
    for (const lang of ['id', 'en'] as const)
      it(`${name} (${lang}) has at least 15 slides and renders to PDF and PPTX`, async () => {
        const v = { ...form[lang].sample, ...extra };
        const spec = build(v, sampleAssets(v));
        expect(spec.slides.length).toBeGreaterThanOrEqual(15);
        const { bytes } = await renderDeckPdf(spec);
        const pptx = await renderPptx(spec);
        const files = unzipSync(pptx);
        const xml = Object.keys(files)
          .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
          .map((k) => strFromU8(files[k]))
          .join('');
        expect(
          Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)),
        ).toHaveLength(spec.slides.length);
        expect(xml).not.toMatch(/undefined|NaN|Infinity/);
        expect(xml).toContain('<p:pic>');
        if (DUMP && lang === 'id') {
          writeFileSync(`${DUMP}/${name}.pdf`, bytes);
          writeFileSync(`${DUMP}/${name}.pptx`, pptx);
        }
      });

  it('styles render for every template', async () => {
    for (const style of ['geo', 'minimal', 'gradient'])
      for (const [, build, form, extra] of cases) {
        const v = { ...form.id.sample, ...extra, style };
        const { pages } = await renderDeckPdf(build(v, {}));
        expect(pages).toBeGreaterThanOrEqual(15);
      }
  });
});
