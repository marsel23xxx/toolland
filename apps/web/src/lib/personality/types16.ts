/**
 * Tes 16 tipe kepribadian berdasarkan teori tipe psikologis Carl Jung: empat dimensi dua kutub
 * (E/I, S/N, T/F, J/P). Pernyataan, nama tipe, dan deskripsi ditulis sendiri oleh Toolland; tes
 * ini tidak berafiliasi dengan MBTI® (merek dagang The Myers-Briggs Company).
 */
import { fill } from '../format';
import { likertScores, type LikertItem, type Profile, type TestMeta } from './core';

export const AXES = ['EI', 'SN', 'TF', 'JP'] as const;
export type Axis = (typeof AXES)[number];
export const LETTERS = ['E', 'I', 'S', 'N', 'T', 'F', 'J', 'P'] as const;
export type Letter = (typeof LETTERS)[number];

/** Semua 16 kode tipe, urut seperti tabel tipe yang umum. */
// prettier-ignore
export const TYPE_CODES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const;
export type TypeCode = (typeof TYPE_CODES)[number];

/** Pernyataan per kutub; 6 per huruf. */
export const PER_LETTER = 6;

export interface TypeText {
  name: string;
  summary: string;
  strengths: string[];
  challenges: string[];
  careers: string[];
}

export interface Types16Text {
  meta: Omit<TestMeta, 'id'>;
  scale: string[];
  /** Pernyataan per huruf: setuju berarti condong ke huruf itu. */
  items: Record<Letter, string[]>;
  letters: Record<Letter, { name: string; desc: string }>;
  types: Record<TypeCode, TypeText>;
  eyebrow: string;
  barsTitle: string;
  /** {n} persen, {name} nama kutub. */
  lean: string;
  strengths: string;
  challenges: string;
  careers: string;
}

export interface Types16Test {
  type: 'types16';
  meta: TestMeta;
  scale: string[];
  items: LikertItem[];
  text: Types16Text;
}

/**
 * Urutan pernyataan: keempat dimensi bergiliran, dan kutub kiri/kanan bergantian setiap putaran,
 * supaya pernyataan serupa tidak muncul berurutan. Kutub kiri = skor dimensi naik.
 */
export function makeTypes16(text: Types16Text): Types16Test {
  const items: LikertItem[] = [];
  for (let k = 0; k < PER_LETTER; k++)
    for (const side of [0, 1] as const)
      for (const axis of AXES) {
        const letter = axis[side] as Letter;
        items.push({ text: text.items[letter][k], dim: axis, ...(side ? { rev: true } : {}) });
      }
  return {
    type: 'types16',
    meta: { id: '16-types', ...text.meta },
    scale: text.scale,
    items,
    text,
  };
}

/** Persen ke kutub kiri tiap dimensi dan kode tipenya (seri 50% condong ke kutub kiri). */
export function types16Scores(test: Types16Test, answers: (number | null)[]) {
  const s = likertScores(test.items, answers, AXES) as Record<Axis, number>;
  const code = AXES.map((a) => (s[a] >= 50 ? a[0] : a[1])).join('') as TypeCode;
  return { scores: s, code };
}

export function types16Profile(test: Types16Test, answers: (number | null)[]): Profile {
  const t = test.text;
  const { scores, code } = types16Scores(test, answers);
  const ty = t.types[code];
  return {
    eyebrow: t.eyebrow,
    code,
    name: ty.name,
    summary: ty.summary,
    barsTitle: t.barsTitle,
    bars: AXES.map((a) => {
      const left = a[0] as Letter;
      const right = a[1] as Letter;
      const lead = scores[a] >= 50 ? left : right;
      const pct = lead === left ? scores[a] : 100 - scores[a];
      return {
        kind: 'bi' as const,
        left: `${t.letters[left].name} (${left})`,
        right: `${t.letters[right].name} (${right})`,
        value: scores[a],
        note: `${fill(t.lean, { n: pct, name: t.letters[lead].name })} ${t.letters[lead].desc}`,
      };
    }),
    sections: [
      { title: t.strengths, list: ty.strengths },
      { title: t.challenges, list: ty.challenges },
      { title: t.careers, list: ty.careers },
    ],
    short: code,
  };
}
