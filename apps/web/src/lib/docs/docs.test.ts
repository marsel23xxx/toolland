import { strFromU8, unzipSync, zlibSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderDocx } from './docx';
import { fillTokens, longDate, period } from './form';
import { renderPdf } from './pdf';
import { CV_ATS_FORM, buildDoc as ats } from '../templates/cv-ats';
import { buildDoc as pro } from '../templates/cv-profesional';
import { LETTER_FORM, buildDoc as letter } from '../templates/surat-lamaran';
import { RESIGN_FORM, addDays, buildDoc as resign } from '../templates/surat-resign';

/** PNG RGB polos ukuran n x n untuk foto uji. */
function testPng(n: number, rgb = [180, 140, 110]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, k) => {
    let c = k;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, n);
  dv.setUint32(4, n);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(n * (1 + n * 3));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) raw.set(rgb, y * (1 + n * 3) + 1 + x * 3);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibSync(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const all = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  return all;
}

const DUMP = process.env.DOC_DUMP;

describe('form helpers', () => {
  it('formats dates and periods', () => {
    expect(longDate('2026-11-10', 'id')).toBe('10 November 2026');
    expect(longDate('2026-11-10', 'en')).toBe('November 10, 2026');
    expect(period('2021-03', '', 'id')).toBe('Mar 2021 – Sekarang');
    expect(period('2019-08', '2023-07', 'en')).toBe('Aug 2019 – Jul 2023');
    expect(fillTokens('A {posisi} di {x}', { posisi: 'Staf' })).toBe('A Staf di {x}');
  });
});

describe('surat lamaran', () => {
  for (const style of ['formal', 'modern']) {
    it(`renders ${style} letter to one-page PDF and valid DOCX`, async () => {
      const v = { ...LETTER_FORM.id.sample, style, date: '2026-11-10' };
      const spec = letter(v, {});
      const { bytes, pages } = await renderPdf(spec);
      expect(pages).toBe(1);
      const pdf = await PDFDocument.load(bytes);
      expect(pdf.getTitle()).toContain('Staf Administrasi Keuangan');
      const docx = renderDocx(spec);
      const files = unzipSync(docx);
      const xml = strFromU8(files['word/document.xml']);
      expect(xml).toContain('PT Maju Bersama Nusantara');
      expect(xml).not.toContain('{posisi}');
      if (DUMP) {
        writeFileSync(`${DUMP}/lamaran-${style}.pdf`, bytes);
        writeFileSync(`${DUMP}/lamaran-${style}.docx`, docx);
      }
    });
  }
});

describe('CV', () => {
  const photo = testPng(64);
  const assets = {
    photo: { data: photo, type: 'png' as const, w: 64, h: 64 },
    'photo:circle': { data: photo, type: 'png' as const, w: 64, h: 64 },
  };
  for (const [name, build] of [
    ['ats', ats],
    ['pro', pro],
  ] as const)
    for (const lang of ['id', 'en'] as const)
      it(`renders ${name} CV (${lang}) on one page`, async () => {
        const v = { ...CV_ATS_FORM[lang].sample };
        const spec = build(v, assets);
        const { bytes, pages } = await renderPdf(spec);
        expect(pages).toBe(1);
        const docx = renderDocx(spec);
        const xml = strFromU8(unzipSync(docx)['word/document.xml']);
        expect(xml).toContain('Rina Pratama');
        expect(xml).toContain(lang === 'id' ? 'Pengalaman Kerja' : 'Work Experience');
        if (name === 'pro') expect(Object.keys(unzipSync(docx))).toContain('word/media/image1.png');
        if (DUMP) {
          writeFileSync(`${DUMP}/cv-${name}-${lang}.pdf`, bytes);
          writeFileSync(`${DUMP}/cv-${name}-${lang}.docx`, docx);
        }
      });

  it('flows long CVs onto more pages', async () => {
    const v = { ...CV_ATS_FORM.id.sample };
    const exp = (v.experience as Record<string, string>[])[0];
    v.experience = Array.from({ length: 9 }, () => exp);
    for (const build of [ats, pro])
      expect((await renderPdf(build(v, {}))).pages).toBeGreaterThan(1);
  });
});

describe('surat resign', () => {
  it('adds 30 days when no last day is given', () => {
    expect(addDays('2026-11-10', 30)).toBe('2026-12-10');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
  });
  for (const lang of ['id', 'en'] as const)
    for (const style of ['formal', 'modern'])
      it(`renders ${style} (${lang}) on one page`, async () => {
        const v = { ...RESIGN_FORM[lang].sample, style, date: '2026-11-10' };
        const spec = resign(v, {});
        const { bytes, pages } = await renderPdf(spec);
        expect(pages).toBe(1);
        const xml = strFromU8(unzipSync(renderDocx(spec))['word/document.xml']);
        expect(xml).toContain(lang === 'id' ? '10 Desember 2026' : 'December 10, 2026');
        expect(xml).not.toMatch(/\{[a-z_]+\}/);
        if (DUMP) writeFileSync(`${DUMP}/resign-${style}-${lang}.pdf`, bytes);
      });
});
