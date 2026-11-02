export const CASE_MODES = [
  'upper',
  'lower',
  'title',
  'sentence',
  'camel',
  'pascal',
  'snake',
  'kebab',
  'constant',
] as const;
export type CaseMode = (typeof CASE_MODES)[number];

const LOCALE = 'id';

/** Pecah teks menjadi kata untuk gaya pemrograman (camelCase, snake_case, ...). */
function codeWords(text: string): string[] {
  return (
    text
      // batas huruf kecil -> besar: "fooBar" -> "foo Bar", "HTMLParser" -> "HTML Parser"
      .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, '$1 $2')
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .map((w) => w.toLocaleLowerCase(LOCALE))
  );
}

const capitalize = (w: string) => w.charAt(0).toLocaleUpperCase(LOCALE) + w.slice(1);

/** Ubah gaya huruf. Gaya pemrograman diterapkan per baris agar daftar tetap rapi. */
export function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper':
      return text.toLocaleUpperCase(LOCALE);
    case 'lower':
      return text.toLocaleLowerCase(LOCALE);
    case 'title':
      return text
        .toLocaleLowerCase(LOCALE)
        .replace(
          /(^|[\s\-(["'])(\p{L})/gu,
          (_, p: string, c: string) => p + c.toLocaleUpperCase(LOCALE),
        );
    case 'sentence':
      return text
        .toLocaleLowerCase(LOCALE)
        .replace(
          /(^\s*|[.!?]\s+|\n\s*)(\p{L})/gu,
          (_, p: string, c: string) => p + c.toLocaleUpperCase(LOCALE),
        );
    default:
      return text
        .split('\n')
        .map((line) => {
          const words = codeWords(line);
          if (words.length === 0) return line.trim();
          switch (mode) {
            case 'camel':
              return words[0] + words.slice(1).map(capitalize).join('');
            case 'pascal':
              return words.map(capitalize).join('');
            case 'snake':
              return words.join('_');
            case 'kebab':
              return words.join('-');
            case 'constant':
              return words.join('_').toLocaleUpperCase(LOCALE);
          }
        })
        .join('\n');
  }
}
