/**
 * Model sumber pustaka untuk Daftar Pustaka: jenis sumber, penulis, dan kolom-kolomnya, serta
 * pembaca masukan (nama penulis, DOI, ISBN, halaman).
 */

export type RefType = 'journal' | 'book' | 'chapter' | 'web' | 'thesis';
export const REF_TYPES: RefType[] = ['journal', 'book', 'chapter', 'web', 'thesis'];

export type ThesisKind = 'skripsi' | 'tesis' | 'disertasi';

/** Penulis perorangan (family + given) atau lembaga (literal). */
export interface Person {
  family?: string;
  given?: string;
  literal?: string;
}

export interface Ref {
  id: string;
  type: RefType;
  authors: Person[];
  /** Tahun terbit; kosong = "t.t." / "n.d.". */
  year: string;
  title: string;
  /** Jurnal (journal), judul buku (chapter), atau nama situs (web). */
  container: string;
  volume: string;
  issue: string;
  /** Halaman, misalnya "12–25". */
  pages: string;
  publisher: string;
  /** Kota terbit (dipakai Harvard dan Chicago). */
  place: string;
  /** Edisi (angka), kosong untuk edisi pertama. */
  edition: string;
  /** Editor buku (untuk bab buku). */
  editors: Person[];
  doi: string;
  url: string;
  /** Tanggal akses untuk sumber web, format YYYY-MM-DD. */
  accessed: string;
  /** Tanggal terbit lengkap untuk sumber web, format YYYY-MM-DD (opsional). */
  date: string;
  isbn: string;
  /** Universitas (untuk skripsi/tesis/disertasi). */
  institution: string;
  thesisKind: ThesisKind;
}

export function emptyRef(type: RefType = 'journal'): Ref {
  return {
    id: newId(),
    type,
    authors: [],
    year: '',
    title: '',
    container: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    place: '',
    edition: '',
    editors: [],
    doi: '',
    url: '',
    accessed: '',
    date: '',
    isbn: '',
    institution: '',
    thesisKind: 'skripsi',
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const ORG_RE =
  /\b(badan|kementerian|kemenkes|kemendikbud|departemen|dinas|direktorat|lembaga|universitas|institut|sekolah|pemerintah|bank|komisi|dewan|majelis|organisasi|perserikatan|yayasan|asosiasi|ikatan|pusat|bps|who|unicef|unesco|world|organization|organisation|association|institute|university|ministry|department|agency|council|committee|society|foundation|corporation|inc\.?|ltd\.?|company)\b/i;

/**
 * Baca satu nama penulis. "Belakang, Depan" atau "Depan Tengah Belakang"; satu kata (umum untuk
 * nama Indonesia, misalnya "Sugiyono") menjadi nama keluarga saja. Nama lembaga (atau teks dalam
 * kurung kurawal, misalnya "{Tim Penyusun}") dipakai apa adanya.
 */
export function parsePerson(raw: string): Person | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const braced = /^\{(.+)\}$/.exec(s);
  if (braced) return { literal: braced[1].trim() };
  if (ORG_RE.test(s) && !s.includes(',')) return { literal: s };
  if (s.includes(',')) {
    const [family, ...rest] = s.split(',');
    const given = rest.join(',').trim();
    return given ? { family: family.trim(), given } : { family: family.trim() };
  }
  const words = s.split(' ');
  if (words.length === 1) return { family: s };
  // Partikel nama keluarga: "van", "de", "von", "bin", "binti", "al-".
  let k = words.length - 1;
  while (k > 1 && /^(van|von|de|der|den|da|di|del|la|le|bin|binti)$/i.test(words[k - 1])) k--;
  return { family: words.slice(k).join(' '), given: words.slice(0, k).join(' ') };
}

/** Satu penulis per baris (atau dipisah titik koma). */
export function parsePeople(text: string): Person[] {
  const parts = text.includes('\n') || !text.includes(';') ? text.split('\n') : text.split(';');
  return parts.map(parsePerson).filter((p): p is Person => p !== null);
}

export function personText(p: Person): string {
  if (p.literal) return `{${p.literal}}`;
  return p.given ? `${p.family}, ${p.given}` : (p.family ?? '');
}

export function peopleText(list: Person[]): string {
  return list.map(personText).join('\n');
}

/** Ambil DOI dari teks bebas: "10.xxxx/...", "doi:10...", atau link doi.org. */
export function normalizeDoi(input: string): string | null {
  const m = /\b(10\.\d{4,9}\/[^\s"<>]+)/i.exec(decodeURIComponent(input.trim()));
  return m ? m[1].replace(/[.,;)\]]+$/, '') : null;
}

/** Ambil ISBN-10/13 yang valid (checksum) dari teks; hasil tanpa tanda hubung. */
export function normalizeIsbn(input: string): string | null {
  const s = input.toUpperCase().replace(/[^0-9X]/g, '');
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    const sum = [...s].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : null;
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, d, i) => a + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }
  return null;
}

/** Rapikan rentang halaman: "12-25" → "12–25". */
export function normalizePages(p: string): string {
  return p.trim().replace(/\s*[-–—]+\s*/g, '–');
}

/** Bersihkan judul dari tag HTML/MathML dan entitas (Crossref kadang mengirim <i>…</i>). */
export function cleanText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nama keluarga (atau lembaga) penulis pertama, untuk urutan abjad. */
export function sortKey(r: Ref): string {
  const a = r.authors[0];
  const name = a ? (a.literal ?? a.family ?? '') : r.title;
  return `${name} ${r.year} ${r.title}`.toLocaleLowerCase('id').normalize('NFKD');
}
