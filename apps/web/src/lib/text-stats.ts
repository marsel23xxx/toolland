export interface TextStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  /** Menit baca pada 200 kata per menit, dibulatkan ke atas. */
  readingMinutes: number;
}

const segmenters = new Map<string, Record<'word' | 'grapheme' | 'sentence', Intl.Segmenter>>();

function getSegmenters(locale: string) {
  let s = segmenters.get(locale);
  if (!s) {
    s = {
      word: new Intl.Segmenter(locale, { granularity: 'word' }),
      grapheme: new Intl.Segmenter(locale, { granularity: 'grapheme' }),
      sentence: new Intl.Segmenter(locale, { granularity: 'sentence' }),
    };
    segmenters.set(locale, s);
  }
  return s;
}

/** Statistik teks memakai Intl.Segmenter: emoji dan huruf beraksen dihitung satu karakter. */
export function textStats(text: string, locale = 'id'): TextStats {
  const seg = getSegmenters(locale);

  let words = 0;
  for (const s of seg.word.segment(text)) if (s.isWordLike) words++;

  let characters = 0;
  let charactersNoSpaces = 0;
  for (const { segment } of seg.grapheme.segment(text)) {
    characters++;
    if (!/^\s+$/.test(segment)) charactersNoSpaces++;
  }

  let sentences = 0;
  for (const { segment } of seg.sentence.segment(text))
    if (/[\p{L}\p{N}]/u.test(segment)) sentences++;

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim() !== '').length;

  return {
    words,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    readingMinutes: words === 0 ? 0 : Math.ceil(words / 200),
  };
}
