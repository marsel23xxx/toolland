/**
 * Format Daftar Pustaka: APA 7, IEEE, Harvard (Cite Them Right), dan Chicago author-date (edisi
 * 17), dalam bahasa Indonesia atau Inggris (istilah seperti "dkk.", "hlm.", "Diakses"). Hasilnya
 * berupa potongan teks (run) dengan penanda miring, supaya bisa dirender ke HTML, Word, dan teks.
 */
import type { Person, Ref, ThesisKind } from './model';

export type Style = 'apa' | 'ieee' | 'harvard' | 'chicago';
export const STYLES: Style[] = ['apa', 'ieee', 'harvard', 'chicago'];
export type Lang = 'id' | 'en';

export interface Run {
  text: string;
  i?: boolean;
}

const MONTHS = {
  id: 'Januari Februari Maret April Mei Juni Juli Agustus September Oktober November Desember'.split(
    ' ',
  ),
  en: 'January February March April May June July August September October November December'.split(
    ' ',
  ),
};
const MONTHS_SHORT = {
  id: 'Jan. Feb. Mar. Apr. Mei Jun. Jul. Agu. Sep. Okt. Nov. Des.'.split(' '),
  en: 'Jan. Feb. Mar. Apr. May Jun. Jul. Aug. Sep. Oct. Nov. Dec.'.split(' '),
};

interface Terms {
  and: string;
  etAl: string;
  nd: string;
  ed: string;
  eds: string;
  pp: string;
  in: string;
  editedBy: string;
  retrieved: (date: string, url: string) => string;
  accessed: string;
  online: string;
  available: string;
  edition: (n: number, style: Style) => string;
  thesis: Record<ThesisKind, Record<Style, string>>;
}

const TERMS: Record<Lang, Terms> = {
  id: {
    and: 'dan',
    etAl: 'dkk.',
    nd: 't.t.',
    ed: 'Ed.',
    eds: 'Ed.',
    pp: 'hlm.',
    in: 'Dalam',
    editedBy: 'disunting oleh',
    retrieved: (d, u) => `Diakses pada ${d}, dari ${u}`,
    accessed: 'Diakses',
    online: 'Daring',
    available: 'Tersedia',
    edition: (n, s) =>
      s === 'apa' ? `Edisi ke-${n}` : s === 'ieee' ? `ed. ke-${n}` : `Edisi ke-${n}`,
    thesis: {
      skripsi: { apa: 'Skripsi', ieee: 'Skripsi', harvard: 'Skripsi', chicago: 'Skripsi' },
      tesis: { apa: 'Tesis', ieee: 'Tesis', harvard: 'Tesis', chicago: 'Tesis' },
      disertasi: {
        apa: 'Disertasi',
        ieee: 'Disertasi',
        harvard: 'Disertasi',
        chicago: 'Disertasi',
      },
    },
  },
  en: {
    and: 'and',
    etAl: 'et al.',
    nd: 'n.d.',
    ed: 'Ed.',
    eds: 'Eds.',
    pp: 'pp.',
    in: 'In',
    editedBy: 'edited by',
    retrieved: (d, u) => `Retrieved ${d}, from ${u}`,
    accessed: 'Accessed',
    online: 'Online',
    available: 'Available',
    edition: (n, s) => `${ordinal(n)} ${s === 'harvard' ? 'edn' : 'ed'}.`,
    thesis: {
      skripsi: {
        apa: 'Undergraduate thesis',
        ieee: 'B.S. thesis',
        harvard: 'Undergraduate thesis',
        chicago: "Bachelor's thesis",
      },
      tesis: {
        apa: "Master's thesis",
        ieee: 'M.S. thesis',
        harvard: 'MA thesis',
        chicago: "Master's thesis",
      },
      disertasi: {
        apa: 'Doctoral dissertation',
        ieee: 'Ph.D. dissertation',
        harvard: 'PhD thesis',
        chicago: 'PhD diss.',
      },
    },
  },
};

function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? 'th'}`;
}

/** Inisial nama depan: "Muhammad Rizki" → "M. R." (atau "M.R." bila tanpa spasi). */
export function initials(given: string, sep = ' '): string {
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split('-')
        .map((p) => (p.endsWith('.') && p.length <= 3 ? p : `${p[0].toUpperCase()}.`))
        .join('-'),
    )
    .join(sep);
}

function dateParts(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** Tanggal sesuai gaya: APA/Chicago EN "May 12, 2024", ID "12 Mei 2024", IEEE "May 12, 2024". */
function dateText(iso: string, style: Style, lang: Lang): string {
  const p = dateParts(iso);
  if (!p) return iso;
  if (lang === 'id') return `${p.d} ${MONTHS.id[p.m - 1]} ${p.y}`;
  if (style === 'harvard') return `${p.d} ${MONTHS.en[p.m - 1]} ${p.y}`;
  if (style === 'ieee') return `${MONTHS_SHORT.en[p.m - 1]} ${p.d}, ${p.y}`;
  return `${MONTHS.en[p.m - 1]} ${p.d}, ${p.y}`;
}

const lastName = (p: Person) => p.literal ?? p.family ?? '';

/** Gabung daftar: "A, B, & C" / "A, B and C" / "A, B, dan C". */
function joinList(items: string[], conj: string, serial: boolean): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2)
    return `${items[0]}${serial && conj === '&' ? ',' : ''} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}${serial ? ',' : ''} ${conj} ${items[items.length - 1]}`;
}

// --- Nama penulis per gaya -----------------------------------------------------------------------

function apaName(p: Person): string {
  if (p.literal) return p.literal;
  return p.given ? `${p.family}, ${initials(p.given)}` : (p.family ?? '');
}
function ieeeName(p: Person): string {
  if (p.literal) return p.literal;
  return p.given ? `${initials(p.given)} ${p.family}` : (p.family ?? '');
}
function harvardName(p: Person): string {
  if (p.literal) return p.literal;
  return p.given ? `${p.family}, ${initials(p.given, '')}` : (p.family ?? '');
}
function chicagoName(p: Person, first: boolean): string {
  if (p.literal) return p.literal;
  if (!p.given) return p.family ?? '';
  return first ? `${p.family}, ${p.given}` : `${p.given} ${p.family}`;
}
/** Editor dengan inisial di depan: "E. E. Editor" (APA, Chicago memakai nama lengkap). */
function editorName(p: Person, style: Style): string {
  if (p.literal) return p.literal;
  if (!p.given) return p.family ?? '';
  if (style === 'chicago') return `${p.given} ${p.family}`;
  if (style === 'harvard') return `${p.family}, ${initials(p.given, '')}`;
  return `${initials(p.given)} ${p.family}`;
}

function authorList(list: Person[], style: Style, t: Terms): string {
  switch (style) {
    case 'apa': {
      const names = list.map(apaName);
      if (names.length > 20)
        return `${names.slice(0, 19).join(', ')}, … ${names[names.length - 1]}`;
      return joinList(names, '&', true);
    }
    case 'ieee':
      if (list.length > 6) return `${ieeeName(list[0])} ${t.etAl}`;
      return joinList(list.map(ieeeName), t.and, true);
    case 'harvard':
      if (list.length >= 4) return `${harvardName(list[0])} ${t.etAl}`;
      return joinList(list.map(harvardName), t.and, false);
    case 'chicago': {
      const names = list.map((p, i) => chicagoName(p, i === 0));
      if (names.length > 10) return `${names.slice(0, 7).join(', ')}, ${t.etAl}`;
      // Nama pertama dibalik ("Smith, John"), jadi dua penulis pun dipisah koma sebelum "and".
      if (names.length === 2 && list[0].given) return `${names[0]}, ${t.and} ${names[1]}`;
      return joinList(names, t.and, true);
    }
  }
}

// --- Pembangun run ------------------------------------------------------------------------------

class Builder {
  runs: Run[] = [];
  add(text: string, i = false): this {
    if (!text) return this;
    const last = this.runs[this.runs.length - 1];
    if (last && !!last.i === i) last.text += text;
    else this.runs.push(i ? { text, i: true } : { text });
    return this;
  }
  /** Tambah titik penutup kecuali teks sudah diakhiri tanda baca akhir. */
  dot(): this {
    return /[.?!]["”’]?$/.test(this.plain()) ? this : this.add('.');
  }
  plain(): string {
    return this.runs.map((r) => r.text).join('');
  }
}

/** Teks dengan titik di akhir kecuali sudah ada tanda baca akhir. */
const withDot = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
const link = (r: Ref) => (r.doi ? `https://doi.org/${r.doi}` : r.url);
const edNum = (r: Ref) => {
  const n = parseInt(r.edition, 10);
  return Number.isFinite(n) && n > 1 ? n : 0;
};

// --- APA 7 ---------------------------------------------------------------------------------------

function apa(r: Ref, t: Terms, lang: Lang): Run[] {
  const b = new Builder();
  const year = r.year || t.nd;
  const dateSuffix = (() => {
    if (r.type !== 'web' || !r.date) return '';
    const p = dateParts(r.date);
    if (!p) return '';
    return lang === 'id' ? `, ${p.d} ${MONTHS.id[p.m - 1]}` : `, ${MONTHS.en[p.m - 1]} ${p.d}`;
  })();
  const italicTitle = r.type === 'book' || r.type === 'web' || r.type === 'thesis';
  const titleRuns = (bb: Builder) => {
    bb.add(r.title, italicTitle);
    if (r.type === 'book' && edNum(r)) bb.add(` (${t.edition(edNum(r), 'apa')})`);
    if (r.type === 'thesis')
      bb.add(` [${t.thesis[r.thesisKind].apa}${r.institution ? `, ${r.institution}` : ''}]`);
  };
  if (r.authors.length) {
    const names = authorList(r.authors, 'apa', t);
    b.add(names.endsWith('.') ? `${names} ` : `${names}. `);
    b.add(`(${year}${dateSuffix}). `);
    titleRuns(b);
    b.dot();
  } else {
    titleRuns(b);
    b.dot().add(` (${year}${dateSuffix}).`);
  }
  switch (r.type) {
    case 'journal':
      if (r.container) {
        b.add(' ').add(r.container, true);
        if (r.volume) b.add(', ').add(r.volume, true);
        if (r.issue) b.add(`(${r.issue})`);
        if (r.pages) b.add(`, ${r.pages}`);
        b.add('.');
      }
      break;
    case 'chapter': {
      b.add(` ${t.in} `);
      if (r.editors.length) {
        const eds = joinList(
          r.editors.map((p) => editorName(p, 'apa')),
          '&',
          r.editors.length > 2,
        );
        b.add(`${eds} (${r.editors.length > 1 ? t.eds : t.ed}), `);
      }
      b.add(r.container, true);
      const extra = [
        edNum(r) ? t.edition(edNum(r), 'apa') : '',
        r.pages ? `${t.pp} ${r.pages}` : '',
      ]
        .filter(Boolean)
        .join(', ');
      if (extra) b.add(` (${extra})`);
      b.add('.');
      if (r.publisher) b.add(` ${withDot(r.publisher)}`);
      break;
    }
    case 'book':
      if (r.publisher) b.add(` ${withDot(r.publisher)}`);
      break;
    case 'web':
      if (r.container && lastName(r.authors[0] ?? {}) !== r.container)
        b.add(` ${withDot(r.container)}`);
      break;
    case 'thesis':
      break;
  }
  const url = link(r);
  if (r.type === 'web' && r.accessed && !r.doi)
    b.add(` ${t.retrieved(dateText(r.accessed, 'apa', lang), url)}`);
  else if (url) b.add(` ${url}`);
  return b.runs;
}

// --- IEEE ----------------------------------------------------------------------------------------

function ieee(r: Ref, t: Terms, lang: Lang): Run[] {
  const b = new Builder();
  if (r.authors.length) b.add(`${authorList(r.authors, 'ieee', t)}, `);
  const quoted = (s: string) => `“${s},” `;
  const year = r.year || t.nd;
  switch (r.type) {
    case 'journal': {
      b.add(quoted(r.title));
      const parts: string[] = [];
      if (r.volume) parts.push(`vol. ${r.volume}`);
      if (r.issue) parts.push(`no. ${r.issue}`);
      if (r.pages) parts.push(`${t.pp} ${r.pages}`);
      parts.push(year);
      b.add(r.container, true);
      b.add(`, ${parts.join(', ')}`);
      if (r.doi) b.add(`, doi: ${r.doi}.`);
      else b.add('.');
      break;
    }
    case 'book': {
      b.add(r.title, true);
      if (edNum(r)) b.add(`, ${t.edition(edNum(r), 'ieee')}`);
      b.add('. ');
      const pub = [r.place, r.publisher].filter(Boolean).join(': ');
      b.add(pub ? `${pub}, ${year}.` : `${year}.`);
      break;
    }
    case 'chapter': {
      b.add(quoted(r.title));
      b.add(`${t.in.toLowerCase()} `).add(r.container, true);
      if (edNum(r)) b.add(`, ${t.edition(edNum(r), 'ieee')}`);
      if (r.editors.length) {
        const eds = joinList(
          r.editors.map((p) => editorName(p, 'ieee')),
          t.and,
          true,
        );
        b.add(`, ${eds}, ${r.editors.length > 1 ? t.eds : t.ed}`);
      }
      b.add('. ');
      const pub = [r.place, r.publisher].filter(Boolean).join(': ');
      b.add(pub ? `${pub}, ${year}` : year);
      if (r.pages) b.add(`, ${t.pp} ${r.pages}`);
      b.add('.');
      break;
    }
    case 'web': {
      b.add(quoted(r.title));
      if (r.container) b.add(r.container, true).add('. ');
      if (r.accessed) b.add(`${t.accessed}: ${dateText(r.accessed, 'ieee', lang)}. `);
      b.add(`[${t.online}]. ${t.available}: ${link(r)}`);
      break;
    }
    case 'thesis': {
      b.add(quoted(r.title));
      const parts = [t.thesis[r.thesisKind].ieee, r.institution, r.place, year].filter(Boolean);
      b.add(`${parts.join(', ')}.`);
      if (link(r)) b.add(` [${t.online}]. ${t.available}: ${link(r)}`);
      break;
    }
  }
  if (r.type === 'book' && link(r))
    b.add(` ${r.doi ? `doi: ${r.doi}.` : `[${t.online}]. ${t.available}: ${r.url}`}`);
  if (r.type === 'chapter' && r.doi) b.add(` doi: ${r.doi}.`);
  return b.runs;
}

// --- Harvard (Cite Them Right) -------------------------------------------------------------------

function harvard(r: Ref, t: Terms, lang: Lang): Run[] {
  const b = new Builder();
  const year = r.year || t.nd;
  const q = (s: string) => `‘${s}’`;
  const lead = r.authors.length ? authorList(r.authors, 'harvard', t) : '';
  const italicTitle = r.type === 'book' || r.type === 'web' || r.type === 'thesis';
  if (lead) b.add(`${lead} (${year}) `);
  if (italicTitle) b.add(r.title, true);
  else b.add(q(r.title));
  if (!lead) b.add(` (${year})`);
  switch (r.type) {
    case 'journal':
      b.add(', ').add(r.container, true);
      if (r.volume) b.add(`, ${r.volume}${r.issue ? `(${r.issue})` : ''}`);
      if (r.pages) b.add(`, ${t.pp} ${r.pages}`);
      b.add('.');
      break;
    case 'book':
      b.dot();
      if (edNum(r)) b.add(` ${t.edition(edNum(r), 'harvard')}${lang === 'id' ? '.' : ''}`);
      if (r.place || r.publisher) b.add(` ${[r.place, r.publisher].filter(Boolean).join(': ')}.`);
      break;
    case 'chapter': {
      b.add(`, ${t.in.toLowerCase()} `);
      if (r.editors.length) {
        const eds = joinList(
          r.editors.map((p) => editorName(p, 'harvard')),
          t.and,
          false,
        );
        b.add(`${eds} (${r.editors.length > 1 ? (lang === 'id' ? 'ed.' : 'eds.') : 'ed.'}) `);
      }
      b.add(r.container, true).add('.');
      if (r.place || r.publisher) b.add(` ${[r.place, r.publisher].filter(Boolean).join(': ')}`);
      if (r.pages) b.add(`, ${t.pp} ${r.pages}`);
      b.add('.');
      break;
    }
    case 'web':
      b.dot();
      break;
    case 'thesis':
      b.dot().add(` ${t.thesis[r.thesisKind].harvard}.`);
      if (r.institution) b.add(` ${withDot(r.institution)}`);
      break;
  }
  const url = link(r);
  if (url) {
    b.add(` ${t.available}${lang === 'id' ? ' di' : ' at'}: ${url}`);
    if (r.accessed && !r.doi) b.add(` (${t.accessed}: ${dateText(r.accessed, 'harvard', lang)})`);
    b.add('.');
  }
  return b.runs;
}

// --- Chicago author-date -------------------------------------------------------------------------

function chicago(r: Ref, t: Terms, lang: Lang): Run[] {
  const b = new Builder();
  const year = r.year || t.nd;
  const q = (s: string) => `“${withDot(s)}”`;
  if (r.authors.length) {
    b.add(`${withDot(authorList(r.authors, 'chicago', t))} ${year}. `);
  }
  const italicTitle = r.type === 'book' || r.type === 'web';
  if (italicTitle) b.add(r.title, true).dot();
  else b.add(q(r.title));
  if (!r.authors.length) b.add(` ${year}.`);
  switch (r.type) {
    case 'journal':
      b.add(' ').add(r.container, true);
      if (r.volume) b.add(` ${r.volume}`);
      if (r.issue) b.add(` (${r.issue})`);
      if (r.pages) b.add(`: ${r.pages}`);
      b.add('.');
      break;
    case 'book':
      if (edNum(r)) b.add(` ${t.edition(edNum(r), 'chicago')}${lang === 'id' ? '.' : ''}`);
      if (r.place || r.publisher) b.add(` ${[r.place, r.publisher].filter(Boolean).join(': ')}.`);
      break;
    case 'chapter': {
      b.add(` ${t.in} `).add(r.container, true);
      if (r.editors.length) {
        const eds = joinList(
          r.editors.map((p) => editorName(p, 'chicago')),
          t.and,
          r.editors.length > 2,
        );
        b.add(`, ${t.editedBy} ${eds}`);
      }
      if (r.pages) b.add(`, ${r.pages}`);
      b.add('.');
      if (r.place || r.publisher) b.add(` ${[r.place, r.publisher].filter(Boolean).join(': ')}.`);
      break;
    }
    case 'web':
      if (r.container) b.add(` ${withDot(r.container)}`);
      if (r.date) b.add(` ${dateText(r.date, 'chicago', lang)}.`);
      else if (r.accessed) b.add(` ${t.accessed} ${dateText(r.accessed, 'chicago', lang)}.`);
      break;
    case 'thesis':
      b.add(` ${t.thesis[r.thesisKind].chicago}${r.institution ? `, ${r.institution}` : ''}.`);
      break;
  }
  const url = link(r);
  if (url) b.add(` ${withDot(url)}`);
  return b.runs;
}

// --- Publik --------------------------------------------------------------------------------------

export function formatRef(r: Ref, style: Style, lang: Lang): Run[] {
  const t = TERMS[lang];
  const runs =
    style === 'apa'
      ? apa(r, t, lang)
      : style === 'ieee'
        ? ieee(r, t, lang)
        : style === 'harvard'
          ? harvard(r, t, lang)
          : chicago(r, t, lang);
  return tidy(runs);
}

/** Rapikan spasi ganda dan tanda baca bertumpuk ("..", " ,") tanpa mengubah penanda miring. */
function tidy(runs: Run[]): Run[] {
  const out = runs
    .map((r) => ({ ...r, text: r.text.replace(/\s{2,}/g, ' ') }))
    .filter((r) => r.text);
  for (let k = 0; k < out.length; k++) {
    out[k].text = out[k].text.replace(/\.\.(?!\.)/g, '.').replace(/ ([,.])/g, '$1');
    if (k > 0 && out[k].text.startsWith('.') && /[.?!]$/.test(out[k - 1].text))
      out[k].text = out[k].text.slice(1);
  }
  if (out.length) out[0].text = out[0].text.trimStart();
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.trimEnd();
  return out.filter((r) => r.text);
}

export function plainText(runs: Run[]): string {
  return runs.map((r) => r.text).join('');
}

/** Kutipan dalam teks: "(Sugiyono, 2019)", "(Sugiyono 2019)", atau "[1]" untuk IEEE. */
export function inText(r: Ref, style: Style, lang: Lang, index: number): string {
  if (style === 'ieee') return `[${index}]`;
  const t = TERMS[lang];
  const names = r.authors.map(lastName);
  const year = r.year || t.nd;
  let who: string;
  if (!names.length) who = r.title.split(/\s+/).slice(0, 4).join(' ');
  else if (names.length === 1) who = names[0];
  else if (names.length === 2) who = `${names[0]} ${style === 'apa' ? '&' : t.and} ${names[1]}`;
  else if (names.length === 3 && style !== 'apa')
    who = `${names[0]}, ${names[1]}${style === 'chicago' ? ',' : ''} ${t.and} ${names[2]}`;
  else who = `${names[0]} ${t.etAl}`;
  return style === 'chicago' ? `(${who} ${year})` : `(${who}, ${year})`;
}

/** Urutan daftar: abjad untuk APA/Harvard/Chicago, urutan kutipan (sesuai daftar) untuk IEEE. */
export function ordered<T extends Ref>(refs: T[], style: Style, key: (r: T) => string): T[] {
  if (style === 'ieee') return refs.slice();
  return refs.slice().sort((a, b) => key(a).localeCompare(key(b), 'id'));
}
