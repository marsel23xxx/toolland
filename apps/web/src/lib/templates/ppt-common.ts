/**
 * Potongan bersama template PPT: field gaya, palet, dan huruf; pembaca isian berformat
 * "judul | penjelasan"; dan pembungkus DeckSpec.
 */
import { choice, lines, longText, type DocField, type DocValues } from '../docs/form';
import type { DeckSpec } from '../slides/model';
import { Deck, PALETTES, STYLE_IDS, STYLE_NAMES, type StyleId } from '../slides/kit';
import type { Locale } from '../format';

export function lookFields(locale: Locale): DocField[] {
  const id = locale === 'id';
  return [
    {
      key: 'style',
      kind: 'select',
      label: id ? 'Gaya desain' : 'Design style',
      options: STYLE_IDS.map((s) => ({ value: s, label: STYLE_NAMES[s][locale] })),
    },
    {
      key: 'font',
      kind: 'select',
      label: id ? 'Huruf' : 'Font',
      options: [
        { value: 'sans', label: 'Arial / Helvetica' },
        { value: 'serif', label: 'Times New Roman' },
      ],
    },
    {
      key: 'palette',
      kind: 'swatch',
      label: id ? 'Palet warna' : 'Colour palette',
      span: 2,
      options: PALETTES.map((p) => ({ value: p.primary, label: p.name[locale] })),
    },
  ];
}

/** Buat Deck sesuai pilihan gaya dan palet di isian. */
export function deckFromValues(v: DocValues, footer: string): Deck {
  const style = choice(v, 'style', STYLE_IDS, 'geo') as StyleId;
  const pal = PALETTES.find((p) => p.primary === v.palette) ?? PALETTES[0];
  return new Deck(style, pal, footer);
}

export function deckSpec(deck: Deck, v: DocValues, title: string, author: string): DeckSpec {
  const p = deck.p;
  return {
    title,
    author,
    lang: choice(v, 'lang', ['id', 'en'] as const, 'id'),
    font: choice(v, 'font', ['sans', 'serif'] as const, 'sans'),
    slides: deck.slides,
    colors: [p.primary, p.secondary, p.accent, p.dark, p.light, '888888'],
  };
}

/** Baris "Judul | penjelasan" -> { title, text }. */
export function pairs(v: DocValues, key: string, max = 6): { title: string; text: string }[] {
  return lines(longText(v, key, 3000), max).map((l) => {
    const [title, ...rest] = l.split('|');
    return { title: title.trim(), text: rest.join('|').trim() };
  });
}

/** Baris "kolom | kolom | kolom" -> string[][]. */
export function rows(v: DocValues, key: string, max = 8): string[][] {
  return lines(longText(v, key, 3000), max).map((l) => l.split('|').map((x) => x.trim()));
}

/** Baris "label | angka" -> batang grafik. Angka boleh memakai titik/koma ribuan. */
export function bars(v: DocValues, key: string, max = 12): { label: string; value: number }[] {
  return lines(longText(v, key, 2000), max).map((l) => {
    const [label, val = ''] = l.split('|');
    const num = Number(
      val
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.'),
    );
    return { label: label.trim(), value: Number.isFinite(num) ? num : 0 };
  });
}

export const list = (v: DocValues, key: string, max = 8) => lines(longText(v, key, 3000), max);

/** Teks bantuan untuk field berformat "judul | penjelasan". */
export function pipeHint(locale: Locale, example: string) {
  return locale === 'id'
    ? `Satu per baris, pisahkan judul dan penjelasan dengan tanda | . Contoh: ${example}`
    : `One per line; separate the title and description with | . Example: ${example}`;
}

/** Field teks panjang (satu poin per baris) untuk form PPT. */
export function area(
  locale: Locale,
  key: string,
  label: { id: string; en: string },
  rows = 4,
  hint?: string,
): DocField {
  return {
    key,
    kind: 'textarea',
    label: label[locale],
    rows,
    span: 2,
    max: 3000,
    hint: hint ?? (locale === 'id' ? 'Satu poin per baris.' : 'One point per line.'),
  };
}

export function textField(
  key: string,
  label: { id: string; en: string },
  locale: Locale,
  extra: Partial<DocField> = {},
): DocField {
  return { key, kind: 'text', label: label[locale], max: 200, ...extra };
}

export function imageField(
  key: string,
  label: { id: string; en: string },
  locale: Locale,
  kind: 'logo' | 'photo' = 'photo',
): DocField {
  return {
    key,
    kind: 'image',
    image: kind === 'logo' ? 'logo' : 'cover',
    label: label[locale],
    span: 2,
  };
}

/** Format angka grafik sesuai bahasa presentasi. */
export const numberFormat = (v: DocValues) => {
  const loc = v.lang === 'en' ? 'en-US' : 'id-ID';
  return (n: number) => n.toLocaleString(loc);
};

const num = (s = '') => {
  const n = Number(
    s
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(n) ? n : 0;
};

/** Baris "waktu | judul | keterangan" -> item linimasa. */
export function timelineItems(v: DocValues, key: string, max = 6) {
  return rows(v, key, max).map(([when = '', title = '', text = '']) => ({ when, title, text }));
}

/** Baris "label | persen | catatan" -> bilah progres. */
export function percents(v: DocValues, key: string, max = 6) {
  return rows(v, key, max).map(([label = '', value = '', note = '']) => ({
    label,
    value: num(value),
    note,
  }));
}

/** Baris "nama | harga | periode | fitur; fitur; fitur" -> paket harga. */
export function plans(v: DocValues, key: string, max = 3) {
  return rows(v, key, max).map(([name = '', price = '', period = '', features = '']) => ({
    name,
    price,
    period,
    features: features
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean),
  }));
}

/** Baris "huruf/judul: poin; poin" untuk SWOT, satu kuadran per baris. */
export function quads(v: DocValues, key: string) {
  return lines(longText(v, key, 3000), 4).map((l) => {
    const [head, ...rest] = l.split(':');
    return {
      head: head.trim(),
      items: rest
        .join(':')
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean),
    };
  });
}

/** Field foto dengan foto contoh bawaan (bisa diganti pengguna). */
export function photoField(
  key: string,
  label: { id: string; en: string },
  locale: Locale,
): DocField {
  return {
    key,
    kind: 'image',
    image: 'cover',
    label: label[locale],
    span: 2,
    hint:
      locale === 'id'
        ? 'Berisi foto contoh bebas pakai (CC0). Ganti dengan fotomu sendiri atau hapus.'
        : 'Starts with a free-to-use sample photo (CC0). Replace it with your own or remove it.',
  };
}
