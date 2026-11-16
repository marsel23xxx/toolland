/**
 * Isi otomatis data pustaka dari DOI (Crossref) atau ISBN (Google Books, Open Library sebagai
 * pelengkap). Dipanggil langsung dari browser pengguna; domainnya diizinkan di connect-src CSP
 * (astro.config.mjs). Yang dikirim hanya DOI/ISBN.
 */
import {
  cleanText,
  emptyRef,
  normalizeDoi,
  normalizeIsbn,
  normalizePages,
  parsePerson,
  type Person,
  type Ref,
  type RefType,
} from './model';

export type LookupError = 'notfound' | 'network' | 'invalid';

export class LookupFailed extends Error {
  constructor(readonly code: LookupError) {
    super(code);
  }
}

const TIMEOUT = 12_000;

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    throw new LookupFailed('network');
  }
  if (res.status === 404) throw new LookupFailed('notfound');
  if (!res.ok) throw new LookupFailed('network');
  return res.json();
}

// --- Crossref ------------------------------------------------------------------------------------

interface CrossrefPerson {
  given?: string;
  family?: string;
  name?: string;
}
export interface CrossrefWork {
  type?: string;
  title?: string[];
  subtitle?: string[];
  author?: CrossrefPerson[];
  editor?: CrossrefPerson[];
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  'publisher-location'?: string;
  issued?: { 'date-parts'?: (number | null)[][] };
  'published-print'?: { 'date-parts'?: (number | null)[][] };
  'published-online'?: { 'date-parts'?: (number | null)[][] };
  DOI?: string;
  ISBN?: string[];
  edition?: string;
  institution?: { name?: string }[];
}

function crossrefType(t = ''): RefType {
  if (/chapter|section|reference-entry|part/.test(t)) return 'chapter';
  if (/^(book|monograph|edited-book|reference-book|book-set|book-series)$/.test(t)) return 'book';
  if (t === 'dissertation') return 'thesis';
  return 'journal';
}

const crossrefPerson = (p: CrossrefPerson): Person | null =>
  p.family
    ? p.given
      ? { family: p.family, given: p.given }
      : { family: p.family }
    : p.name
      ? { literal: p.name }
      : null;

export function fromCrossref(w: CrossrefWork): Ref {
  const r = emptyRef(crossrefType(w.type));
  const year =
    w.issued?.['date-parts']?.[0]?.[0] ??
    w['published-print']?.['date-parts']?.[0]?.[0] ??
    w['published-online']?.['date-parts']?.[0]?.[0];
  const title = cleanText(w.title?.[0] ?? '');
  const subtitle = cleanText(w.subtitle?.[0] ?? '');
  r.title = subtitle && !title.includes(subtitle) ? `${title}: ${subtitle}` : title;
  r.authors = (w.author ?? []).map(crossrefPerson).filter((p): p is Person => p !== null);
  r.editors = (w.editor ?? []).map(crossrefPerson).filter((p): p is Person => p !== null);
  r.year = year ? String(year) : '';
  r.container = cleanText(w['container-title']?.[0] ?? '');
  r.volume = w.volume ?? '';
  r.issue = w.issue ?? '';
  r.pages = normalizePages(w.page ?? '');
  r.publisher = w.publisher ?? '';
  r.place = w['publisher-location'] ?? '';
  r.doi = w.DOI ?? '';
  r.isbn = w.ISBN?.[0] ?? '';
  r.edition = /^\d+$/.test(w.edition ?? '') ? (w.edition as string) : '';
  if (r.type === 'thesis') r.institution = w.institution?.[0]?.name ?? r.publisher;
  return r;
}

export async function lookupDoi(input: string): Promise<Ref> {
  const doi = normalizeDoi(input);
  if (!doi) throw new LookupFailed('invalid');
  const data = (await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)) as {
    message?: CrossrefWork;
  };
  if (!data.message) throw new LookupFailed('notfound');
  return fromCrossref(data.message);
}

// --- ISBN ----------------------------------------------------------------------------------------

export interface GoogleVolume {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
}

export function fromGoogleBooks(v: GoogleVolume, isbn: string): Ref {
  const r = emptyRef('book');
  r.title = [v.title, v.subtitle].filter(Boolean).join(': ');
  r.authors = (v.authors ?? []).map(parsePerson).filter((p): p is Person => p !== null);
  r.publisher = v.publisher ?? '';
  r.year = /\d{4}/.exec(v.publishedDate ?? '')?.[0] ?? '';
  r.isbn = isbn;
  return r;
}

export interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: { name?: string }[];
  publishers?: { name?: string }[];
  publish_places?: { name?: string }[];
  publish_date?: string;
}

export function fromOpenLibrary(b: OpenLibraryBook, isbn: string): Ref {
  const r = emptyRef('book');
  r.title = [b.title, b.subtitle].filter(Boolean).join(': ');
  r.authors = (b.authors ?? [])
    .map((a) => parsePerson(a.name ?? ''))
    .filter((p): p is Person => p !== null);
  r.publisher = b.publishers?.[0]?.name ?? '';
  r.place = b.publish_places?.[0]?.name ?? '';
  r.year = /\d{4}/.exec(b.publish_date ?? '')?.[0] ?? '';
  r.isbn = isbn;
  return r;
}

/** Gabung dua hasil: kolom kosong di `a` diisi dari `b`. */
export function mergeRefs(a: Ref | null, b: Ref | null): Ref | null {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  for (const k of ['title', 'publisher', 'place', 'year'] as const) if (!out[k]) out[k] = b[k];
  if (!out.authors.length) out.authors = b.authors;
  return out;
}

/**
 * Google Books tanpa API key memakai kuota bersama yang sering habis (HTTP 429). Bila
 * PUBLIC_GOOGLE_BOOKS_KEY diisi saat build (key browser yang dibatasi HTTP referrer ke domain
 * Toolland), kuota sendiri yang dipakai. Tanpa key, Open Library tetap menjadi cadangan.
 */
function googleBooksUrl(isbn: string): string {
  const key = (import.meta.env.PUBLIC_GOOGLE_BOOKS_KEY as string | undefined) ?? '';
  return `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key ? `&key=${encodeURIComponent(key)}` : ''}`;
}

export async function lookupIsbn(input: string): Promise<Ref> {
  const isbn = normalizeIsbn(input);
  if (!isbn) throw new LookupFailed('invalid');
  const [g, o] = await Promise.allSettled([
    getJson(googleBooksUrl(isbn)).then((d) => {
      const v = (d as { items?: { volumeInfo?: GoogleVolume }[] }).items?.[0]?.volumeInfo;
      return v ? fromGoogleBooks(v, isbn) : null;
    }),
    getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`).then(
      (d) => {
        const b = (d as Record<string, OpenLibraryBook>)[`ISBN:${isbn}`];
        return b ? fromOpenLibrary(b, isbn) : null;
      },
    ),
  ]);
  const ref = mergeRefs(
    g.status === 'fulfilled' ? g.value : null,
    o.status === 'fulfilled' ? o.value : null,
  );
  if (ref?.title) return ref;
  const failed = [g, o].every((x) => x.status === 'rejected');
  throw new LookupFailed(failed ? 'network' : 'notfound');
}

/** Jenis masukan pencarian: DOI, ISBN, atau URL halaman web. */
export function detectInput(input: string): 'doi' | 'isbn' | 'url' | null {
  if (normalizeDoi(input)) return 'doi';
  if (normalizeIsbn(input)) return 'isbn';
  if (/^https?:\/\/\S+\.\S+/i.test(input.trim())) return 'url';
  return null;
}

/** Sumber web dari URL (isi halaman tidak bisa dibaca dari browser, jadi hanya URL dan situs). */
export function fromUrl(input: string, today: string): Ref {
  const r = emptyRef('web');
  r.url = input.trim();
  try {
    r.container = new URL(r.url).hostname.replace(/^www\./, '');
  } catch {
    // URL tidak valid: biarkan kosong.
  }
  r.accessed = today;
  return r;
}
