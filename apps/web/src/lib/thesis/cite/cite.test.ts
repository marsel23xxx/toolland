import { describe, expect, it } from 'vitest';
import { formatRef, initials, inText, ordered, plainText, type Style } from './format';
import {
  emptyRef,
  normalizeDoi,
  normalizeIsbn,
  normalizePages,
  parsePeople,
  parsePerson,
  sortKey,
  type Ref,
} from './model';

const ref = (over: Partial<Ref>): Ref => ({ ...emptyRef(), ...over });

const journal = ref({
  type: 'journal',
  authors: [
    { family: 'Smith', given: 'John A.' },
    { family: 'Doe', given: 'Jane' },
  ],
  year: '2020',
  title: 'Learning in groups',
  container: 'Journal of Education',
  volume: '12',
  issue: '3',
  pages: '45–67',
  doi: '10.1234/jed.2020.003',
});
const book = ref({
  type: 'book',
  authors: [{ family: 'Sugiyono' }],
  year: '2019',
  title: 'Metode Penelitian Kuantitatif, Kualitatif, dan R&D',
  edition: '2',
  publisher: 'Alfabeta',
  place: 'Bandung',
});
const chapter = ref({
  type: 'chapter',
  authors: [{ family: 'Brown', given: 'Alice' }],
  year: '2018',
  title: 'Assessment design',
  container: 'Handbook of Testing',
  editors: [
    { family: 'Lee', given: 'Kim' },
    { family: 'Park', given: 'Sun' },
  ],
  pages: '100–120',
  publisher: 'Routledge',
  place: 'London',
});
const web = ref({
  type: 'web',
  authors: [{ literal: 'Badan Pusat Statistik' }],
  year: '2023',
  title: 'Statistik Pendidikan 2023',
  container: 'BPS',
  url: 'https://www.bps.go.id/x',
  accessed: '2024-05-12',
});
const thesis = ref({
  type: 'thesis',
  authors: [{ family: 'Wulandari', given: 'Rina' }],
  year: '2021',
  title: 'Pengaruh Motivasi terhadap Kinerja Karyawan',
  institution: 'Universitas Gadjah Mada',
  thesisKind: 'skripsi',
});

const txt = (r: Ref, s: Style, l: 'id' | 'en' = 'en') => plainText(formatRef(r, s, l));
const italics = (r: Ref, s: Style, l: 'id' | 'en' = 'en') =>
  formatRef(r, s, l)
    .filter((x) => x.i)
    .map((x) => x.text);

describe('masukan', () => {
  it('nama penulis', () => {
    expect(parsePerson('Sugiyono')).toEqual({ family: 'Sugiyono' });
    expect(parsePerson('Muhammad Rizki Pratama')).toEqual({
      family: 'Pratama',
      given: 'Muhammad Rizki',
    });
    expect(parsePerson('Smith, John A.')).toEqual({ family: 'Smith', given: 'John A.' });
    expect(parsePerson('Ludwig van Beethoven')).toEqual({
      family: 'van Beethoven',
      given: 'Ludwig',
    });
    expect(parsePerson('Badan Pusat Statistik')).toEqual({ literal: 'Badan Pusat Statistik' });
    expect(parsePerson('{Tim Penyusun}')).toEqual({ literal: 'Tim Penyusun' });
    expect(parsePeople('A Satu\nDua, B\n\n')).toHaveLength(2);
    expect(parsePeople('Smith, J.; Doe, K.')).toHaveLength(2);
  });

  it('inisial', () => {
    expect(initials('Muhammad Rizki')).toBe('M. R.');
    expect(initials('John A.')).toBe('J. A.');
    expect(initials('Jean-Paul')).toBe('J.-P.');
    expect(initials('Muhammad Rizki', '')).toBe('M.R.');
  });

  it('DOI, ISBN, halaman', () => {
    expect(normalizeDoi('https://doi.org/10.1038/nature12373')).toBe('10.1038/nature12373');
    expect(normalizeDoi('doi: 10.1000/xyz123.')).toBe('10.1000/xyz123');
    expect(normalizeDoi('bukan doi')).toBeNull();
    expect(normalizeIsbn('978-602-289-533-6')).toBe('9786022895336');
    expect(normalizeIsbn('0-306-40615-2')).toBe('0306406152');
    expect(normalizeIsbn('978-602-289-533-7')).toBeNull();
    expect(normalizePages('12 - 25')).toBe('12–25');
  });
});

describe('APA 7', () => {
  it('jurnal', () => {
    expect(txt(journal, 'apa')).toBe(
      'Smith, J. A., & Doe, J. (2020). Learning in groups. Journal of Education, 12(3), 45–67. https://doi.org/10.1234/jed.2020.003',
    );
    expect(italics(journal, 'apa')).toEqual(['Journal of Education', '12']);
  });
  it('buku (Indonesia)', () => {
    expect(txt(book, 'apa', 'id')).toBe(
      'Sugiyono. (2019). Metode Penelitian Kuantitatif, Kualitatif, dan R&D (Edisi ke-2). Alfabeta.',
    );
    expect(italics(book, 'apa', 'id')).toEqual([book.title]);
  });
  it('bab buku', () => {
    expect(txt(chapter, 'apa')).toBe(
      'Brown, A. (2018). Assessment design. In K. Lee & S. Park (Eds.), Handbook of Testing (pp. 100–120). Routledge.',
    );
  });
  it('web lembaga dengan tanggal akses (Indonesia)', () => {
    expect(txt(web, 'apa', 'id')).toBe(
      'Badan Pusat Statistik. (2023). Statistik Pendidikan 2023. BPS. Diakses pada 12 Mei 2024, dari https://www.bps.go.id/x',
    );
  });
  it('skripsi', () => {
    expect(txt(thesis, 'apa', 'id')).toBe(
      'Wulandari, R. (2021). Pengaruh Motivasi terhadap Kinerja Karyawan [Skripsi, Universitas Gadjah Mada].',
    );
    expect(txt(thesis, 'apa', 'en')).toContain('[Undergraduate thesis, Universitas Gadjah Mada]');
  });
  it('tanpa tahun dan tanpa penulis', () => {
    const r = ref({ type: 'web', title: 'Panduan', container: 'Situs', url: 'https://x.id' });
    expect(txt(r, 'apa', 'id')).toBe('Panduan. (t.t.). Situs. https://x.id');
  });
  it('tiga penulis', () => {
    const r = { ...journal, authors: [...journal.authors, { family: 'Roe', given: 'Rick' }] };
    expect(txt(r, 'apa')).toMatch(/^Smith, J\. A\., Doe, J\., & Roe, R\. \(2020\)/);
  });
});

describe('IEEE', () => {
  it('jurnal', () => {
    expect(txt(journal, 'ieee')).toBe(
      'J. A. Smith and J. Doe, “Learning in groups,” Journal of Education, vol. 12, no. 3, pp. 45–67, 2020, doi: 10.1234/jed.2020.003.',
    );
  });
  it('buku (Indonesia)', () => {
    expect(txt(book, 'ieee', 'id')).toBe(
      'Sugiyono, Metode Penelitian Kuantitatif, Kualitatif, dan R&D, ed. ke-2. Bandung: Alfabeta, 2019.',
    );
  });
  it('web (Indonesia)', () => {
    expect(txt(web, 'ieee', 'id')).toBe(
      'Badan Pusat Statistik, “Statistik Pendidikan 2023,” BPS. Diakses: 12 Mei 2024. [Daring]. Tersedia: https://www.bps.go.id/x',
    );
  });
  it('lebih dari 6 penulis', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ family: `F${i}`, given: 'Ann' }));
    expect(txt({ ...journal, authors: many }, 'ieee')).toMatch(/^A\. F0 et al\., “/);
  });
});

describe('Harvard', () => {
  it('jurnal', () => {
    expect(txt(journal, 'harvard')).toBe(
      'Smith, J.A. and Doe, J. (2020) ‘Learning in groups’, Journal of Education, 12(3), pp. 45–67. Available at: https://doi.org/10.1234/jed.2020.003.',
    );
  });
  it('buku (Indonesia)', () => {
    expect(txt(book, 'harvard', 'id')).toBe(
      'Sugiyono (2019) Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Edisi ke-2. Bandung: Alfabeta.',
    );
  });
  it('web (Indonesia)', () => {
    expect(txt(web, 'harvard', 'id')).toBe(
      'Badan Pusat Statistik (2023) Statistik Pendidikan 2023. Tersedia di: https://www.bps.go.id/x (Diakses: 12 Mei 2024).',
    );
  });
});

describe('Chicago author-date', () => {
  it('jurnal', () => {
    expect(txt(journal, 'chicago')).toBe(
      'Smith, John A., and Jane Doe. 2020. “Learning in groups.” Journal of Education 12 (3): 45–67. https://doi.org/10.1234/jed.2020.003.',
    );
  });
  it('buku (Indonesia)', () => {
    expect(txt(book, 'chicago', 'id')).toBe(
      'Sugiyono. 2019. Metode Penelitian Kuantitatif, Kualitatif, dan R&D. Edisi ke-2. Bandung: Alfabeta.',
    );
  });
  it('bab buku', () => {
    expect(txt(chapter, 'chicago')).toBe(
      'Brown, Alice. 2018. “Assessment design.” In Handbook of Testing, edited by Kim Lee and Sun Park, 100–120. London: Routledge.',
    );
  });
});

describe('kutipan dan urutan', () => {
  it('kutipan dalam teks', () => {
    expect(inText(book, 'apa', 'id', 1)).toBe('(Sugiyono, 2019)');
    expect(inText(journal, 'apa', 'en', 1)).toBe('(Smith & Doe, 2020)');
    expect(inText(journal, 'harvard', 'id', 1)).toBe('(Smith dan Doe, 2020)');
    expect(inText(journal, 'chicago', 'en', 1)).toBe('(Smith and Doe 2020)');
    expect(inText(journal, 'ieee', 'en', 3)).toBe('[3]');
    const three = { ...journal, authors: [...journal.authors, { family: 'Roe' }] };
    expect(inText(three, 'apa', 'id', 1)).toBe('(Smith dkk., 2020)');
  });
  it('abjad untuk APA, urutan masukan untuk IEEE', () => {
    const list = [journal, book, web];
    expect(ordered(list, 'apa', sortKey).map((r) => r.year)).toEqual(['2023', '2020', '2019']);
    expect(ordered(list, 'ieee', sortKey)).toEqual(list);
  });
});
