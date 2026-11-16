/**
 * Ekspor Daftar Pustaka: HTML berformat (untuk disalin ke Word/Google Docs dengan miring dan
 * hanging indent), Word .docx, BibTeX, dan RIS (untuk Mendeley/Zotero).
 */
import { strToU8, zipSync } from 'fflate';
import { xmlEscape } from '../../docs/docx';
import { formatRef, type Lang, type Run, type Style } from './format';
import type { Person, Ref } from './model';

export interface Entry {
  ref: Ref;
  runs: Run[];
  /** Nomor IEEE, atau 0 untuk gaya tanpa nomor. */
  n: number;
}

export function entries(refs: Ref[], style: Style, lang: Lang): Entry[] {
  return refs.map((ref, i) => ({
    ref,
    runs: formatRef(ref, style, lang),
    n: style === 'ieee' ? i + 1 : 0,
  }));
}

const escHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML untuk clipboard: Word dan Google Docs mempertahankan miring dan hanging indent. */
export function toHtml(list: Entry[]): string {
  const ps = list.map((e) => {
    const body = e.runs.map((r) => (r.i ? `<i>${escHtml(r.text)}</i>` : escHtml(r.text))).join('');
    const num = e.n ? `[${e.n}]&nbsp;&nbsp;` : '';
    return `<p style="margin:0 0 12pt 0;padding-left:0.5in;text-indent:-0.5in;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.15">${num}${body}</p>`;
  });
  return `<div>${ps.join('')}</div>`;
}

export function toPlain(list: Entry[]): string {
  return list
    .map((e) => `${e.n ? `[${e.n}] ` : ''}${e.runs.map((r) => r.text).join('')}`)
    .join('\n\n');
}

// --- Word ----------------------------------------------------------------------------------------

function runXml(text: string, italic = false): string {
  return `<w:r>${italic ? '<w:rPr><w:i/><w:iCs/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

export function toDocx(list: Entry[], heading: string): Uint8Array {
  const para = (e: Entry) =>
    `<w:p><w:pPr><w:spacing w:after="240" w:line="240" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/></w:pPr>${
      e.n ? `${runXml(`[${e.n}]`)}<w:r><w:tab/></w:r>` : ''
    }${e.runs.map((r) => runXml(r.text, r.i)).join('')}</w:p>`;
  const title = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="480"/></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${xmlEscape(heading)}</w:t></w:r></w:p>`;
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${title}${list.map(para).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="2268" w:right="1701" w:bottom="1701" w:left="2268" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/_rels/document.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(document),
    'word/styles.xml': strToU8(styles),
  };
  return zipSync(files);
}

// --- BibTeX dan RIS ------------------------------------------------------------------------------

const ascii = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');

const bibEsc = (s: string) => s.replace(/([&%$#_{}])/g, '\\$1');

function bibName(p: Person): string {
  if (p.literal) return `{${bibEsc(p.literal)}}`;
  return p.given ? `${bibEsc(p.family ?? '')}, ${bibEsc(p.given)}` : bibEsc(p.family ?? '');
}

/** Kunci unik: namakeluarga + tahun + kata pertama judul ("sugiyono2019metode"). */
export function bibKeys(refs: Ref[]): string[] {
  const used = new Map<string, number>();
  return refs.map((r) => {
    const a = r.authors[0];
    const name = ascii(a ? (a.family ?? a.literal?.split(' ')[0] ?? '') : '') || 'anon';
    const word = ascii(
      r.title.split(/\s+/).find((w) => w.length > 3) ?? r.title.split(/\s+/)[0] ?? '',
    );
    const base = `${name}${r.year || 'nd'}${word}`.toLowerCase();
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}${String.fromCharCode(97 + n)}` : base;
  });
}

export function toBibtex(refs: Ref[]): string {
  const keys = bibKeys(refs);
  return refs
    .map((r, i) => {
      const type =
        r.type === 'journal'
          ? 'article'
          : r.type === 'book'
            ? 'book'
            : r.type === 'chapter'
              ? 'incollection'
              : r.type === 'thesis'
                ? r.thesisKind === 'disertasi'
                  ? 'phdthesis'
                  : 'mastersthesis'
                : 'misc';
      const f: [string, string][] = [];
      const add = (k: string, v: string, raw = false) => {
        if (v) f.push([k, raw ? v : bibEsc(v)]);
      };
      if (r.authors.length) f.push(['author', r.authors.map(bibName).join(' and ')]);
      add('title', r.title);
      if (r.type === 'journal') add('journal', r.container);
      if (r.type === 'chapter') add('booktitle', r.container);
      if (r.type === 'web') add('howpublished', r.container);
      if (r.editors.length) f.push(['editor', r.editors.map(bibName).join(' and ')]);
      add('year', r.year);
      add('volume', r.volume);
      add('number', r.issue);
      add('pages', r.pages.replace('–', '--'));
      add('edition', r.edition);
      add('publisher', r.publisher);
      add('address', r.place);
      if (r.type === 'thesis') {
        add('school', r.institution);
        if (r.thesisKind === 'skripsi') add('type', 'Skripsi');
        if (r.thesisKind === 'tesis') add('type', 'Tesis');
      }
      add('isbn', r.isbn);
      add('doi', r.doi, true);
      add('url', r.url, true);
      add('urldate', r.accessed);
      const body = f.map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
      return `@${type}{${keys[i]},\n${body}\n}`;
    })
    .join('\n\n');
}

const RIS_TYPE = { journal: 'JOUR', book: 'BOOK', chapter: 'CHAP', web: 'ELEC', thesis: 'THES' };

function risName(p: Person): string {
  return p.literal ?? (p.given ? `${p.family}, ${p.given}` : (p.family ?? ''));
}

export function toRis(refs: Ref[]): string {
  return refs
    .map((r) => {
      const lines: string[] = [`TY  - ${RIS_TYPE[r.type]}`];
      const add = (tag: string, v: string) => {
        if (v) lines.push(`${tag}  - ${v}`);
      };
      for (const a of r.authors) add('AU', risName(a));
      for (const e of r.editors) add('ED', risName(e));
      add('TI', r.title);
      if (r.type === 'journal') add('JO', r.container);
      else if (r.type === 'chapter') add('T2', r.container);
      else if (r.type === 'web') add('T2', r.container);
      add('PY', r.year);
      add('VL', r.volume);
      add('IS', r.issue);
      const [sp, ep] = r.pages.split('–');
      add('SP', sp ?? '');
      add('EP', ep ?? '');
      add('ET', r.edition);
      add('PB', r.type === 'thesis' ? r.institution : r.publisher);
      add('CY', r.place);
      if (r.type === 'thesis')
        add(
          'M3',
          r.thesisKind === 'skripsi' ? 'Skripsi' : r.thesisKind === 'tesis' ? 'Tesis' : 'Disertasi',
        );
      add('SN', r.isbn);
      add('DO', r.doi);
      add('UR', r.url || (r.doi ? `https://doi.org/${r.doi}` : ''));
      add('Y2', r.accessed);
      lines.push('ER  - ');
      return lines.join('\r\n');
    })
    .join('\r\n\r\n');
}
