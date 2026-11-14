/**
 * Tes DISC berdasarkan model William Moulton Marston (1928): 24 kelompok berisi empat kata, satu
 * untuk tiap gaya (Dominance, Influence, Steadiness, Conscientiousness). Pengguna memilih satu
 * kata yang paling sesuai dan satu yang paling tidak sesuai; skor gaya = paling - paling tidak.
 * Kata-kata ditulis sendiri oleh Toolland, tidak terkait produk DISC komersial mana pun.
 */
import { fill } from '../format';
import {
  discScores,
  ranked,
  type DiscAnswer,
  type DiscDim,
  type DiscGroup,
  type Profile,
  type TestMeta,
} from './core';

export const DISC = ['D', 'I', 'S', 'C'] as const;
export const DISC_GROUPS = 24;
/** Batas skala batang: selisih ±12 sudah mentok. */
const SPAN = 12;

/** Semua 24 permutasi D/I/S/C, satu per kelompok, agar posisi tiap gaya tidak bisa ditebak. */
function permutations(xs: readonly DiscDim[]): DiscDim[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]),
  );
}
const PERMS = permutations(DISC);
/** 7 relatif prima terhadap 24, jadi setiap permutasi terpakai tepat sekali. */
export const DISC_ORDER: DiscDim[][] = PERMS.map((_, i) => PERMS[(i * 7 + 3) % 24]);

interface StyleText {
  name: string;
  /** Penggalan untuk kalimat gaya kedua. */
  short: string;
  summary: string;
  strengths: string[];
  challenges: string[];
  environment: string;
  comms: string[];
  careers: string[];
}

export interface DiscText {
  meta: Omit<TestMeta, 'id'>;
  /** Satu kata per gaya untuk tiap kelompok. */
  groups: Record<DiscDim, string>[];
  styles: Record<DiscDim, StyleText>;
  eyebrow: string;
  barsTitle: string;
  /** {a} gaya utama, {b} gaya kedua, {bdesc} penggalan gaya kedua. */
  blend: string;
  strengths: string;
  challenges: string;
  environment: string;
  comms: string;
  careers: string;
}

export interface DiscTest {
  type: 'disc';
  meta: TestMeta;
  groups: DiscGroup[];
  text: DiscText;
}

export function makeDisc(text: DiscText): DiscTest {
  return {
    type: 'disc',
    meta: { id: 'disc', ...text.meta },
    groups: text.groups.map((g, i) => ({
      words: DISC_ORDER[i].map((dim) => ({ text: g[dim], dim })),
    })),
    text,
  };
}

/** Gaya utama dan (kalau ada) gaya kedua yang juga di atas garis tengah. */
export function discCode(diff: Record<DiscDim, number>): DiscDim[] {
  const order = ranked(diff, DISC);
  return order[1] && diff[order[1]] > 0 ? [order[0], order[1]] : [order[0]];
}

export function discProfile(test: DiscTest, answers: DiscAnswer[]): Profile {
  const t = test.text;
  const { diff } = discScores(test.groups, answers);
  const code = discCode(diff);
  const main = t.styles[code[0]];
  const second = code[1] ? t.styles[code[1]] : undefined;
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return {
    eyebrow: t.eyebrow,
    code: code.join(''),
    name: main.name,
    summary: second
      ? `${main.summary} ${fill(t.blend, { a: main.name, b: second.name, bdesc: second.short })}`
      : main.summary,
    barsTitle: t.barsTitle,
    bars: DISC.map((d) => ({
      kind: 'uni' as const,
      label: `${t.styles[d].name} (${d})`,
      value: Math.round(50 + (Math.max(-SPAN, Math.min(SPAN, diff[d])) / SPAN) * 50),
      text: signed(diff[d]),
      note: t.styles[d].short,
      mid: true,
      strong: d === code[0],
    })),
    sections: [
      { title: t.strengths, list: main.strengths },
      { title: t.challenges, list: main.challenges },
      { title: t.comms, list: main.comms },
      { title: t.careers, list: main.careers },
      { title: t.environment, text: main.environment },
    ],
    short: code.join(''),
  };
}
