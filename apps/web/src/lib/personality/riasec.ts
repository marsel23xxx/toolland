/**
 * Tes minat karier berdasarkan teori RIASEC John L. Holland: enam tipe minat (Realistic,
 * Investigative, Artistic, Social, Enterprising, Conventional), 8 kegiatan per tipe. Kegiatan,
 * jurusan, dan pekerjaan ditulis sendiri oleh Toolland untuk konteks Indonesia.
 */
import { fill } from '../format';
import { likertScores, ranked, type LikertItem, type Profile, type TestMeta } from './core';

export const RIASEC = ['R', 'I', 'A', 'S', 'E', 'C'] as const;
export type Riasec = (typeof RIASEC)[number];
export const PER_TYPE = 8;

interface InterestText {
  name: string;
  short: string;
  summary: string;
  majors: string[];
  careers: string[];
}

export interface RiasecText {
  meta: Omit<TestMeta, 'id'>;
  scale: string[];
  items: Record<Riasec, string[]>;
  types: Record<Riasec, InterestText>;
  eyebrow: string;
  barsTitle: string;
  /** {b} dan {c}: nama tipe kedua dan ketiga. */
  mix: string;
  majors: string;
  careers: string;
  /** {name}: nama tipe kedua/ketiga. */
  second: string;
  third: string;
}

export interface RiasecTest {
  type: 'riasec';
  meta: TestMeta;
  scale: string[];
  items: LikertItem[];
  text: RiasecText;
}

/** Keenam tipe bergiliran agar kegiatan sejenis tidak berurutan. */
export function makeRiasec(text: RiasecText): RiasecTest {
  const items: LikertItem[] = [];
  for (let k = 0; k < PER_TYPE; k++)
    for (const dim of RIASEC) items.push({ text: text.items[dim][k], dim });
  return { type: 'riasec', meta: { id: 'riasec', ...text.meta }, scale: text.scale, items, text };
}

export function riasecScores(test: RiasecTest, answers: (number | null)[]) {
  const scores = likertScores(test.items, answers, RIASEC) as Record<Riasec, number>;
  return { scores, top: ranked(scores, RIASEC).slice(0, 3) };
}

export function riasecProfile(test: RiasecTest, answers: (number | null)[]): Profile {
  const t = test.text;
  const { scores, top } = riasecScores(test, answers);
  const [a, b, c] = top.map((k) => t.types[k]);
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    eyebrow: t.eyebrow,
    code: top.join(''),
    name: a.name,
    summary: `${a.summary} ${fill(t.mix, { b: b.name, c: c.name })}`,
    barsTitle: t.barsTitle,
    bars: RIASEC.map((k) => ({
      kind: 'uni' as const,
      label: `${t.types[k].name} (${k})`,
      value: scores[k],
      text: String(scores[k]),
      note: t.types[k].short,
      strong: top.includes(k),
    })),
    sections: [
      { title: t.majors, list: uniq([...a.majors, ...b.majors.slice(0, 3)]) },
      { title: t.careers, list: uniq([...a.careers, ...b.careers.slice(0, 3)]) },
      { title: fill(t.second, { name: b.name }), text: b.summary },
      { title: fill(t.third, { name: c.name }), text: c.summary },
    ],
    short: top.join(''),
  };
}
