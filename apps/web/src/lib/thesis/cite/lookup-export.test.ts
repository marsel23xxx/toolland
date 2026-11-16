import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bibKeys, entries, toBibtex, toDocx, toHtml, toPlain, toRis } from './export';
import {
  detectInput,
  fromCrossref,
  fromUrl,
  LookupFailed,
  lookupDoi,
  lookupIsbn,
  mergeRefs,
} from './lookup';
import { emptyRef, type Ref } from './model';

const crossref = {
  type: 'journal-article',
  title: ['Nanometre-scale thermometry in a <i>living</i> cell'],
  author: [
    { given: 'G.', family: 'Kucsko' },
    { given: 'P. C.', family: 'Maurer' },
  ],
  'container-title': ['Nature'],
  volume: '500',
  issue: '7460',
  page: '54-58',
  publisher: 'Springer Science and Business Media LLC',
  issued: { 'date-parts': [[2013, 7, 31]] },
  DOI: '10.1038/nature12373',
};

describe('pemetaan data', () => {
  it('Crossref: jurnal', () => {
    const r = fromCrossref(crossref);
    expect(r.type).toBe('journal');
    expect(r.title).toBe('Nanometre-scale thermometry in a living cell');
    expect(r.authors).toEqual([
      { family: 'Kucsko', given: 'G.' },
      { family: 'Maurer', given: 'P. C.' },
    ]);
    expect([r.year, r.container, r.volume, r.issue, r.pages]).toEqual([
      '2013',
      'Nature',
      '500',
      '7460',
      '54–58',
    ]);
  });

  it('Crossref: bab buku dan lembaga', () => {
    const r = fromCrossref({
      type: 'book-chapter',
      title: ['Bab Satu'],
      subtitle: ['Sebuah Pengantar'],
      author: [{ name: 'World Health Organization' }],
      editor: [{ given: 'Ani', family: 'Rahma' }],
      'container-title': ['Buku Induk'],
    });
    expect(r.type).toBe('chapter');
    expect(r.title).toBe('Bab Satu: Sebuah Pengantar');
    expect(r.authors).toEqual([{ literal: 'World Health Organization' }]);
    expect(r.editors).toEqual([{ family: 'Rahma', given: 'Ani' }]);
  });

  it('jenis masukan dan URL', () => {
    expect(detectInput('https://doi.org/10.1038/nature12373')).toBe('doi');
    expect(detectInput('978-602-289-533-6')).toBe('isbn');
    expect(detectInput('https://kompas.com/berita')).toBe('url');
    expect(detectInput('halo')).toBeNull();
    const r = fromUrl('https://www.kompas.com/berita', '2024-05-12');
    expect([r.type, r.container, r.accessed]).toEqual(['web', 'kompas.com', '2024-05-12']);
  });

  it('gabung hasil ISBN', () => {
    const a = { ...emptyRef('book'), title: 'Judul', publisher: '' };
    const b = { ...emptyRef('book'), title: 'Lain', publisher: 'Alfabeta', place: 'Bandung' };
    const m = mergeRefs(a, b)!;
    expect([m.title, m.publisher, m.place]).toEqual(['Judul', 'Alfabeta', 'Bandung']);
  });
});

describe('lookup lewat fetch', () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (map: Record<string, unknown>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const key = Object.keys(map).find((k) => url.includes(k));
        if (!key) return new Response('', { status: 404 });
        const v = map[key];
        if (v instanceof Error) throw v;
        return new Response(JSON.stringify(v), { status: 200 });
      }),
    );

  it('DOI dari Crossref', async () => {
    respond({ 'api.crossref.org/works/10.1038%2Fnature12373': { message: crossref } });
    const r = await lookupDoi('doi:10.1038/nature12373');
    expect(r.doi).toBe('10.1038/nature12373');
  });

  it('DOI tidak ada', async () => {
    respond({});
    await expect(lookupDoi('10.9999/tidakada')).rejects.toMatchObject({ code: 'notfound' });
  });

  it('ISBN: Google Books dilengkapi Open Library', async () => {
    respond({
      googleapis: {
        items: [
          {
            volumeInfo: {
              title: 'Metode Penelitian',
              authors: ['Sugiyono'],
              publishedDate: '2019',
            },
          },
        ],
      },
      openlibrary: {
        'ISBN:9786022895336': {
          title: 'X',
          publishers: [{ name: 'Alfabeta' }],
          publish_places: [{ name: 'Bandung' }],
        },
      },
    });
    const r = await lookupIsbn('978-602-289-533-6');
    expect([r.title, r.year, r.publisher, r.place]).toEqual([
      'Metode Penelitian',
      '2019',
      'Alfabeta',
      'Bandung',
    ]);
    expect(r.authors).toEqual([{ family: 'Sugiyono' }]);
  });

  it('ISBN: jaringan gagal semua', async () => {
    respond({ googleapis: new TypeError('fail'), openlibrary: new TypeError('fail') });
    const err = await lookupIsbn('9786022895336').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LookupFailed);
    expect((err as LookupFailed).code).toBe('network');
  });

  it('ISBN tidak valid', async () => {
    await expect(lookupIsbn('123')).rejects.toMatchObject({ code: 'invalid' });
  });
});

describe('ekspor', () => {
  const book: Ref = {
    ...emptyRef('book'),
    authors: [{ family: 'Sugiyono' }],
    year: '2019',
    title: 'Metode Penelitian R&D',
    publisher: 'Alfabeta',
    place: 'Bandung',
    pages: '',
  };
  const art: Ref = { ...fromCrossref(crossref), url: '' };

  it('HTML berformat dan teks biasa', () => {
    const list = entries([book, art], 'ieee', 'id');
    const html = toHtml(list);
    expect(html).toContain('<i>Metode Penelitian R&amp;D</i>');
    expect(html).toContain('text-indent:-0.5in');
    expect(html).toContain('[2]');
    expect(toPlain(list).split('\n\n')[0].startsWith('[1] Sugiyono, ')).toBe(true);
  });

  it('docx dengan hanging indent dan miring', () => {
    const files = unzipSync(toDocx(entries([book], 'apa', 'id'), 'DAFTAR PUSTAKA'));
    const doc = strFromU8(files['word/document.xml']);
    expect(doc).toContain('w:hanging="720"');
    expect(doc).toContain('<w:i/>');
    expect(doc).toContain('Metode Penelitian R&amp;D');
    expect(doc).toContain('DAFTAR PUSTAKA');
    expect(Object.keys(files)).toContain('[Content_Types].xml');
  });

  it('BibTeX', () => {
    const bib = toBibtex([book, art]);
    expect(bib).toContain('@book{sugiyono2019metode,');
    expect(bib).toContain('title = {Metode Penelitian R\\&D}');
    expect(bib).toContain('@article{kucsko2013nanometrescale,');
    expect(bib).toContain('author = {Kucsko, G. and Maurer, P. C.}');
    expect(bib).toContain('pages = {54--58}');
    expect(bibKeys([book, book])).toEqual(['sugiyono2019metode', 'sugiyono2019metodeb']);
  });

  it('RIS', () => {
    const ris = toRis([art]);
    expect(ris.split('\r\n')).toEqual(
      expect.arrayContaining(['TY  - JOUR', 'AU  - Kucsko, G.', 'SP  - 54', 'EP  - 58', 'ER  - ']),
    );
  });
});
