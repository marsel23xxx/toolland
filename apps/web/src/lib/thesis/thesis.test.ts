import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { checkDocx, chapterNumber, classify } from './check';
import { readDocx, W } from './docx-read';
import { fixDocx, PPR_ORDER, RPR_ORDER, SECT_ORDER } from './fix';
import { decodeRules, encodeRules, normalizeRules, PRESETS } from './rules';

const NS = `xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"`;

const p = (text: string, pPr = '', rPr = '') =>
  `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const LONG =
  'Penelitian ini membahas pengaruh penggunaan media pembelajaran digital terhadap hasil belajar siswa sekolah menengah atas di kota Bandung.';

/** Skripsi kecil dengan format yang sengaja berantakan. */
function messyThesis(extraBody = ''): Uint8Array {
  const body = [
    p('SKRIPSI', '<w:jc w:val="center"/>', '<w:b/><w:sz w:val="32"/>'),
    p('Kata Pengantar'),
    p(LONG),
    p('DAFTAR ISI'),
    p('BAB I PENDAHULUAN ........ 1'),
    p('BAB II TINJAUAN PUSTAKA\t5'),
    p('BAB I', '<w:jc w:val="center"/>', '<w:b/>'),
    p('PENDAHULUAN', '<w:jc w:val="center"/>', '<w:b/>'),
    p('1.1 Latar Belakang'),
    p(LONG),
    // Kata asing miring harus tetap miring setelah dirapikan.
    `<w:p><w:r><w:t xml:space="preserve">${LONG} </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>blended learning</w:t></w:r></w:p>`,
    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Data</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
    p('Tabel 1.1 Data responden'),
    p('Tabel 1.3 Data lanjutan'),
    p('Gambar 2.1 Kerangka berpikir'),
    p('', '', '').replace('<w:t xml:space="preserve"></w:t>', '<w:br w:type="page"/>'),
    p('BAB II', '<w:jc w:val="center"/>', '<w:b/>'),
    p('TINJAUAN PUSTAKA', '<w:jc w:val="center"/>', '<w:b/>'),
    p(LONG, '<w:ind w:firstLine="709"/><w:jc w:val="both"/>'),
    extraBody,
    p('DAFTAR PUSTAKA', '<w:jc w:val="center"/>', '<w:b/>'),
    p('Sugiyono. (2019). Metode Penelitian Kuantitatif. Bandung: Alfabeta.'),
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
  ].join('');
  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    'word/_rels/document.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document ${NS}><w:body>${body}</w:body></w:document>`,
    ),
    'word/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`,
    ),
    'word/theme/theme1.xml': strToU8(
      '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:fontScheme><a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>',
    ),
  };
  return zipSync(files);
}

/** Pastikan anak pPr/rPr/sectPr urut sesuai skema (Word menolak urutan yang salah). */
function orderErrors(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const errs: string[] = [];
  for (const [tag, order] of [
    ['pPr', PPR_ORDER],
    ['rPr', RPR_ORDER],
    ['sectPr', SECT_ORDER],
  ] as const)
    for (const el of doc.getElementsByTagNameNS(W, tag)) {
      const idx = [...el.children].map((c) => order.indexOf(c.localName));
      if (idx.some((v) => v < 0) || idx.some((v, i) => i > 0 && v < idx[i - 1]))
        errs.push(`${tag}: ${[...el.children].map((c) => c.localName).join(',')}`);
    }
  return errs;
}

const rules = PRESETS.umum;

describe('readDocx', () => {
  it('menurunkan format dari docDefaults dan font tema', () => {
    const m = readDocx(messyThesis());
    const body = m.paras.find((x) => x.text === LONG)!;
    expect(body.runs[0]).toMatchObject({ font: 'Calibri', size: 11, bold: false });
    expect(body.line).toEqual({ rule: 'auto', val: 1.08 });
    expect(body.after).toBe(8);
    expect(m.sections).toHaveLength(1);
    expect(m.sections[0]).toMatchObject({ w: 12240, h: 15840, page: null });
    const bab2 = m.paras.find((x) => x.text === 'BAB II')!;
    expect(bab2.afterBreak).toBe(true);
  });
});

describe('classify', () => {
  it('mengenali judul BAB, judul depan, subjudul, isi, keterangan, sel, dan pustaka', () => {
    const blocks = classify(readDocx(messyThesis()));
    const kind = (t: string) => blocks.find((b) => b.p.text === t)?.kind;
    expect(kind('Kata Pengantar')).toBe('frontTitle');
    // Daftar isi manual bukan judul BAB; teks bagian awal hanya dicek fontnya.
    expect(kind('BAB I PENDAHULUAN ........ 1')).toBe('front');
    expect(kind('BAB II TINJAUAN PUSTAKA\t5')).toBe('front');
    expect(blocks.find((b) => b.p.text === LONG)?.kind).toBe('front');
    expect(kind('BAB I')).toBe('chapter');
    expect(kind('PENDAHULUAN')).toBe('chapterTitle');
    expect(kind('1.1 Latar Belakang')).toBe('sub');
    expect(kind('Tabel 1.1 Data responden')).toBe('caption');
    expect(kind('Data')).toBe('cell');
    expect(kind('DAFTAR PUSTAKA')).toBe('frontTitle');
    expect(kind('Sugiyono. (2019). Metode Penelitian Kuantitatif. Bandung: Alfabeta.')).toBe('ref');
    expect(blocks.find((b) => b.p.text === 'TINJAUAN PUSTAKA')?.chapter).toBe(2);
    expect([chapterNumber('IV'), chapterNumber('IX'), chapterNumber('12')]).toEqual([4, 9, 12]);
  });
});

describe('checkDocx', () => {
  it('menemukan semua masalah dokumen berantakan', () => {
    const r = checkDocx(readDocx(messyThesis()), rules);
    const codes = new Set(r.issues.map((i) => i.code));
    for (const c of [
      'paper',
      'margin',
      'pagenumMissing',
      'font',
      'size',
      'line',
      'after',
      'indent',
      'align',
      'headSize',
      'headBold',
      'headCaps',
      'headCenter',
      'chapterPage',
      'subBold',
      'captionAlign',
      'captionPos',
      'captionSeq',
      'captionNum',
    ] as const)
      // prettier-ignore
      expect(codes, c).toContain(c);
    // BAB II sudah diawali page break: hanya BAB I yang dilaporkan.
    const page = r.issues.find((i) => i.code === 'chapterPage')!;
    expect(page.paras).toHaveLength(1);
    expect(r.issues.find((i) => i.code === 'captionSeq')!.vals).toMatchObject({
      label: 'Tabel 1.3',
      want: 'Tabel 1.2',
    });
    expect(r.chapters).toEqual(['BAB I', 'BAB II']);
    expect(r.hasRefs).toBe(true);
    // Masalah yang sama digabung: satu baris font untuk semua paragraf Calibri.
    expect(r.issues.filter((i) => i.code === 'font')).toHaveLength(1);
  });
});

describe('fixDocx', () => {
  it('setelah dirapikan hanya tersisa masalah yang harus dibetulkan manual', () => {
    const fixed = fixDocx(messyThesis(), rules);
    const r = checkDocx(readDocx(fixed), rules);
    expect(r.issues.filter((i) => i.fix).map((i) => i.code)).toEqual([]);
    expect(r.issues.map((i) => i.code).sort()).toEqual(['captionNum', 'captionPos', 'captionSeq']);
  });

  it('nomor halaman: romawi di awal, BAB I mulai 1, footer tengah, XML tetap valid', () => {
    const fixed = fixDocx(messyThesis(), rules);
    const files = unzipSync(fixed);
    const m = readDocx(fixed);
    expect(m.sections).toHaveLength(2);
    expect(m.sections.map((s) => [s.fmt, s.start])).toEqual([
      ['lowerRoman', null],
      ['decimal', 1],
    ]);
    expect(m.sections.every((s) => s.page?.where === 'footer' && s.page.jc === 'center')).toBe(
      true,
    );
    expect(m.sections[1]).toMatchObject({ w: 11906, h: 16838 });
    expect(m.paras.find((x) => x.text === 'BAB I')!.section).toBe(1);
    expect(strFromU8(files['[Content_Types].xml'])).toContain('/word/footer1.xml');
    expect(orderErrors(strFromU8(files['word/document.xml']))).toEqual([]);
    expect(orderErrors(strFromU8(files['word/styles.xml']))).toEqual([]);
    // Teks dan cetak miring tidak berubah.
    const italic = m.paras.find((x) => x.text.endsWith('blended learning'))!;
    expect(italic.text).toBe(`${LONG} blended learning`);
    expect(strFromU8(files['word/document.xml'])).toContain('<w:i/>');
  });

  it('nomor halaman kanan atas dipindah ke header', () => {
    const fixed = fixDocx(messyThesis(), {
      ...rules,
      pageNum: { front: 'lowerRoman', pos: 'top-right' },
    });
    const m = readDocx(fixed);
    expect(m.sections.every((s) => s.page?.where === 'header' && s.page.jc === 'right')).toBe(true);
    // Dirapikan dua kali tidak membuat header kedua.
    const again = readDocx(
      fixDocx(fixed, { ...rules, pageNum: { front: 'lowerRoman', pos: 'top-right' } }),
    );
    expect(Object.keys(again.files).filter((f) => /word\/header\d+\.xml/.test(f))).toHaveLength(1);
  });
});

describe('rules', () => {
  it('link pedoman bolak-balik dan nilai aneh dibersihkan', () => {
    const r = { ...rules, font: 'Arial', line: 1.5 };
    expect(decodeRules(encodeRules(r))).toEqual(r);
    expect(decodeRules('bukan-base64!!')).toBeNull();
    const n = normalizeRules({ size: 99, paper: 'A3', margin: { top: -1 }, font: '' });
    expect(n).toMatchObject({ size: 20, paper: 'A4', font: 'Times New Roman' });
    expect(n.margin.top).toBe(0.5);
  });
});
