/**
 * Ambil teks dari file yang diunggah, langsung di browser: TXT/MD/CSV/HTML, Word (.docx),
 * OpenDocument (.odt), dan PDF (lewat pdf.js). File .doc lama dan PDF hasil scan tidak didukung.
 */
import { unzipSync, strFromU8 } from 'fflate';

export const TEXT_ACCEPT = '.txt,.md,.markdown,.csv,.html,.htm,.rtf,.docx,.odt,.pdf,text/plain';
export const MAX_TEXT_FILE = 30 * 1024 * 1024;

export type ExtractError = 'tooBig' | 'unsupported' | 'legacyDoc' | 'empty' | 'broken';

export class TextExtractError extends Error {
  constructor(readonly code: ExtractError) {
    super(code);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10),
      );
    return ENTITIES[e] ?? m;
  });
}

/** Teks dari word/document.xml: satu paragraf per baris, tab dan ganti baris dipertahankan. */
export function docxXmlToText(xml: string): string {
  const body = xml.replace(/<w:(?:del|instrText)\b[\s\S]*?<\/w:(?:del|instrText)>/g, '');
  return body
    .split(/<\/w:p>/)
    .map((p) =>
      [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)]
        .map((m) => (m[2] === 'tab' ? '\t' : m[2] ? '\n' : decodeXml(m[1])))
        .join(''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Teks dari content.xml dokumen ODT. */
export function odtXmlToText(xml: string): string {
  const body = xml.replace(/<office:annotation\b[\s\S]*?<\/office:annotation>/g, '');
  return decodeXml(
    body
      .replace(/<text:tab\s*\/>/g, '\t')
      .replace(/<text:line-break\s*\/>/g, '\n')
      .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, n: string) => ' '.repeat(Number(n ?? 1)))
      .replace(/<\/text:(?:p|h)>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
  return (doc.body?.innerText ?? doc.body?.textContent ?? '').trim();
}

async function pdfToText(buf: ArrayBuffer): Promise<string> {
  const { openPdf, closePdf } = await import('./pdf/render');
  const doc = await openPdf(buf);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const it of content.items) {
        if (!('str' in it)) continue;
        line += it.str;
        if (it.hasEOL) {
          lines.push(line);
          line = '';
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }
    return pages.join('\n\n').trim();
  } finally {
    await closePdf(doc);
  }
}

function zipEntry(buf: ArrayBuffer, name: string): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === name });
  } catch {
    throw new TextExtractError('broken');
  }
  if (!files[name]) throw new TextExtractError('broken');
  return strFromU8(files[name]);
}

/** Ambil teks dari file. Melempar TextExtractError dengan kode yang bisa diterjemahkan. */
export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_TEXT_FILE) throw new TextExtractError('tooBig');
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  let text: string;
  if (ext === 'doc') throw new TextExtractError('legacyDoc');
  if (ext === 'docx') text = docxXmlToText(zipEntry(await file.arrayBuffer(), 'word/document.xml'));
  else if (ext === 'odt') text = odtXmlToText(zipEntry(await file.arrayBuffer(), 'content.xml'));
  else if (ext === 'pdf' || file.type === 'application/pdf') {
    try {
      text = await pdfToText(await file.arrayBuffer());
    } catch {
      throw new TextExtractError('broken');
    }
  } else if (ext === 'html' || ext === 'htm') text = htmlToText(await file.text());
  else if (
    ['txt', 'md', 'markdown', 'csv', 'rtf', ''].includes(ext) ||
    file.type.startsWith('text/')
  )
    text = (await file.text()).replace(/^\uFEFF/, '');
  else throw new TextExtractError('unsupported');
  if (!text.trim()) throw new TextExtractError('empty');
  return text;
}
