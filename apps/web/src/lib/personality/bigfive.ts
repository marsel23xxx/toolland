/**
 * Big Five (OCEAN) dengan 50 pernyataan IPIP (Goldberg, 1992; International Personality Item
 * Pool, domain publik). Urutan dan kunci skor mengikuti IPIP-50 asli; faktor Emotional
 * Stability dibalik menjadi Neurotisisme agar sesuai singkatan OCEAN.
 */
import { fill } from '../format';
import { band, likertScores, ranked, type LikertItem, type Profile, type TestMeta } from './core';

export const TRAITS = ['O', 'C', 'E', 'A', 'N'] as const;
export type Trait = (typeof TRAITS)[number];

/** Kunci 50 pernyataan sesuai urutan IPIP-50: E, A, C, N, O berulang. 1 = pernyataan terbalik. */
// prettier-ignore
const IPIP_50: [Trait, 0 | 1][] = [
  ['E', 0], ['A', 1], ['C', 0], ['N', 0], ['O', 0],
  ['E', 1], ['A', 0], ['C', 1], ['N', 1], ['O', 1],
  ['E', 0], ['A', 1], ['C', 0], ['N', 0], ['O', 0],
  ['E', 1], ['A', 0], ['C', 1], ['N', 1], ['O', 1],
  ['E', 0], ['A', 1], ['C', 0], ['N', 0], ['O', 0],
  ['E', 1], ['A', 0], ['C', 1], ['N', 0], ['O', 1],
  ['E', 0], ['A', 1], ['C', 0], ['N', 0], ['O', 0],
  ['E', 1], ['A', 0], ['C', 1], ['N', 0], ['O', 0],
  ['E', 0], ['A', 0], ['C', 0], ['N', 0], ['O', 0],
  ['E', 1], ['A', 0], ['C', 0], ['N', 0], ['O', 0],
];
export const BIG_FIVE_KEYS: { dim: Trait; rev?: boolean }[] = IPIP_50.map(([dim, rev]) =>
  rev ? { dim, rev: true } : { dim },
);

interface BandText {
  desc: string;
  strength: string;
  /** Kosong = tidak ada saran khusus untuk tingkat ini. */
  growth: string;
}

export interface BigFiveText {
  meta: Omit<TestMeta, 'id'>;
  scale: string[];
  /** 50 pernyataan, sejajar dengan BIG_FIVE_KEYS. */
  items: string[];
  eyebrow: string;
  name: string;
  /** {top} dan {bottom}: nama sifat tertinggi dan terendah. */
  summary: string;
  barsTitle: string;
  bands: Record<'low' | 'mid' | 'high', string>;
  traits: Record<Trait, { name: string; low: BandText; mid: BandText; high: BandText }>;
  strengths: string;
  growth: string;
}

export interface BigFiveTest {
  type: 'bigfive';
  meta: TestMeta;
  scale: string[];
  items: LikertItem[];
  text: BigFiveText;
}

export function makeBigFive(text: BigFiveText): BigFiveTest {
  return {
    type: 'bigfive',
    meta: { id: 'big-five', ...text.meta },
    scale: text.scale,
    items: BIG_FIVE_KEYS.map((k, i) => ({ text: text.items[i], ...k })),
    text,
  };
}

export function bigFiveProfile(test: BigFiveTest, answers: (number | null)[]): Profile {
  const t = test.text;
  const s = likertScores(test.items, answers, TRAITS) as Record<Trait, number>;
  const order = ranked(s, TRAITS);
  const bands = TRAITS.map((k) => [k, t.traits[k][band(s[k])]] as const);
  return {
    eyebrow: t.eyebrow,
    name: t.name,
    summary: fill(t.summary, {
      top: t.traits[order[0]].name,
      bottom: t.traits[order[order.length - 1]].name,
    }),
    barsTitle: t.barsTitle,
    bars: TRAITS.map((k) => ({
      kind: 'uni' as const,
      label: `${t.traits[k].name} (${k})`,
      value: s[k],
      text: `${s[k]} · ${t.bands[band(s[k])]}`,
      note: t.traits[k][band(s[k])].desc,
      strong: k === order[0],
    })),
    sections: [
      { title: t.strengths, list: bands.map(([, b]) => b.strength) },
      { title: t.growth, list: bands.map(([, b]) => b.growth).filter(Boolean) },
    ].filter((x) => x.list.length),
    chips: TRAITS.map((k) => ({ label: k, value: String(s[k]) })),
    short: TRAITS.map((k) => `${k}${s[k]}`).join(' '),
  };
}
