/**
 * Mesin soal tes IQ. Semua soal dibangkitkan secara prosedural dari seed acak, jadi setiap
 * percobaan mendapat soal berbeda: angka, gambar, dan urutan pilihan jawaban tidak bisa dihafal.
 *
 * Tiga jenis soal, masing-masing dengan tingkat 1-5:
 * - matrix: matriks gambar 3x3 ala Raven, cari sel kanan bawah yang hilang;
 * - series: deret angka, cari suku berikutnya;
 * - odd:    lima gambar, empat mengikuti satu aturan, pilih yang berbeda.
 *
 * Gambar dinyatakan sebagai data (Figure) dalam kotak 0-100 dan digambar oleh komponen Vue.
 */

// --- Acak ber-seed ----------------------------------------------------------------------------
export type Rng = () => number;

/** mulberry32: cepat, cukup acak untuk soal, dan bisa diulang dari seed yang sama. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Ambil n nilai berbeda secara acak. */
const sample = <T>(r: Rng, xs: readonly T[], n: number) => shuffle(r, xs).slice(0, n);

// --- Gambar -------------------------------------------------------------------------------------
export type Shape =
  'circle' | 'square' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'eff' | 'dot';
export type Fill = 'empty' | 'lines' | 'solid';

export interface Item {
  shape: Shape;
  x: number;
  y: number;
  /** Jari-jari dalam satuan kotak 0-100. */
  r: number;
  /** Rotasi dalam derajat. */
  rot: number;
  fill: Fill;
  /** Dicerminkan secara horizontal (untuk bentuk asimetris). */
  flip?: boolean;
}

export interface Figure {
  items: Item[];
  /** Ruas garis yang aktif (bitmask 8 ruas, lihat SEGMENTS). */
  segs?: number;
}

/** Delapan ruas garis untuk soal tumpang-tindih: 4 sisi, 2 diagonal, 2 garis tengah. */
export const SEGMENTS: readonly [number, number, number, number][] = [
  [20, 20, 80, 20],
  [80, 20, 80, 80],
  [80, 80, 20, 80],
  [20, 80, 20, 20],
  [20, 20, 80, 80],
  [80, 20, 20, 80],
  [50, 20, 50, 80],
  [20, 50, 80, 50],
];

/** Titik-titik sudut bentuk poligon (tidak termasuk lingkaran dan titik). */
export function shapePoints(it: Item): [number, number][] {
  const poly = (n: number, start: number, radii?: number[]) =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (i * 2 * Math.PI) / n;
      const rr = it.r * (radii ? radii[i % radii.length] : 1);
      return [Math.cos(a) * rr, Math.sin(a) * rr] as [number, number];
    });
  let pts: [number, number][];
  switch (it.shape) {
    case 'square':
      pts = poly(4, Math.PI / 4).map(([x, y]) => [x * 1.05, y * 1.05]);
      break;
    case 'triangle':
      pts = poly(3, -Math.PI / 2).map(([x, y]) => [x * 1.12, y * 1.12 + it.r * 0.15]);
      break;
    case 'diamond':
      pts = poly(4, -Math.PI / 2);
      break;
    case 'pentagon':
      pts = poly(5, -Math.PI / 2);
      break;
    case 'hexagon':
      pts = poly(6, 0);
      break;
    case 'star':
      pts = poly(10, -Math.PI / 2, [1, 0.45]);
      break;
    case 'eff':
      // Bentuk seperti huruf F: tidak simetris, jadi pencerminannya bisa dibedakan dari rotasi.
      pts = (
        [
          [-0.55, -1],
          [0.6, -1],
          [0.6, -0.55],
          [-0.1, -0.55],
          [-0.1, -0.15],
          [0.35, -0.15],
          [0.35, 0.3],
          [-0.1, 0.3],
          [-0.1, 1],
          [-0.55, 1],
        ] as [number, number][]
      ).map(([x, y]) => [x * it.r, y * it.r]);
      break;
    default:
      return [];
  }
  const rad = (it.rot * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return pts.map(([x0, y]) => {
    const x = it.flip ? -x0 : x0;
    return [it.x + x * c - y * s, it.y + x * s + y * c];
  });
}

/** Jumlah sisi bentuk (untuk aturan "jumlah sisi"). */
export const SIDES: Partial<Record<Shape, number>> = {
  triangle: 3,
  square: 4,
  diamond: 4,
  pentagon: 5,
  hexagon: 6,
};

/** Kunci pembanding dua gambar (sama persis secara visual). */
export function figureKey(f: Figure): string {
  const items = f.items
    .map(
      (i) =>
        `${i.shape}:${Math.round(i.x)}:${Math.round(i.y)}:${Math.round(i.r)}:${Math.round(i.rot) % 360}:${i.fill}:${i.flip ? 1 : 0}`,
    )
    .sort()
    .join('|');
  return `${f.segs ?? 0}#${items}`;
}

/** Posisi n benda dalam satu kotak (1-6). */
const LAYOUT: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [29, 50],
    [71, 50],
  ],
  3: [
    [50, 28],
    [27, 70],
    [73, 70],
  ],
  4: [
    [29, 29],
    [71, 29],
    [29, 71],
    [71, 71],
  ],
  5: [
    [25, 25],
    [75, 25],
    [50, 50],
    [25, 75],
    [75, 75],
  ],
  6: [
    [22, 32],
    [50, 32],
    [78, 32],
    [22, 68],
    [50, 68],
    [78, 68],
  ],
};
const COUNT_SCALE: Record<number, number> = { 1: 1, 2: 0.72, 3: 0.62, 4: 0.6, 5: 0.5, 6: 0.48 };

// --- Soal ---------------------------------------------------------------------------------------
export type Kind = 'matrix' | 'series' | 'odd';

/** Label aturan soal (dipakai tes unit untuk memeriksa jawaban; tidak ditampilkan ke pengguna). */
export interface Explain {
  key: string;
  params?: Record<string, string | number>;
}

interface Base {
  level: number;
  answer: number;
  explain: Explain[];
}
export interface MatrixQ extends Base {
  kind: 'matrix';
  /** Delapan sel pertama (baris demi baris); sel ke-9 adalah yang ditanyakan. */
  cells: Figure[];
  options: Figure[];
}
export interface SeriesQ extends Base {
  kind: 'series';
  terms: number[];
  options: number[];
}
export interface OddQ extends Base {
  kind: 'odd';
  options: Figure[];
}
export type Question = MatrixQ | SeriesQ | OddQ;

// --- Matriks 3x3 ----------------------------------------------------------------------------
const SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star'];
const FILLS: Fill[] = ['empty', 'lines', 'solid'];
const SIZE_R = [15, 20, 25];
/** Bentuk untuk matriks: tanpa bintang, karena arsiran sulit terlihat di bintang kecil. */
const MATRIX_SHAPES: Shape[] = ['circle', 'square', 'triangle', 'diamond', 'pentagon', 'hexagon'];

type Attr = 'shape' | 'count' | 'fill' | 'size';
type Rule = 'const' | 'row' | 'col' | 'latin' | 'latinRev';
interface Glyph {
  shape: Shape;
  count: number;
  fill: Fill;
  size: number;
}

function glyphFigure(g: Glyph): Figure {
  const r = SIZE_R[g.size] * COUNT_SCALE[g.count];
  return {
    items: LAYOUT[g.count].map(([x, y]) => ({ shape: g.shape, x, y, r, rot: 0, fill: g.fill })),
  };
}

function ruleIndex(rule: Rule, row: number, col: number): number {
  switch (rule) {
    case 'const':
      return 0;
    case 'row':
      return row;
    case 'col':
      return col;
    case 'latin':
      return (col + row) % 3;
    case 'latinRev':
      return (col - row + 3) % 3;
  }
}

function matrixGlyph(r: Rng, level: number): MatrixQ {
  const attrs: Attr[] = ['shape', 'count', 'fill', 'size'];
  const nVary = level <= 1 ? 1 : level <= 3 ? 2 : level === 4 ? 3 : 4;
  const vary = sample(r, attrs, nVary);
  const pools: Record<Attr, readonly (Shape | Fill | number)[]> = {
    shape: sample(r, MATRIX_SHAPES, 3),
    count: shuffle(r, [1, 2, 3]),
    fill: shuffle(r, FILLS),
    size: shuffle(r, [0, 1, 2]),
  };
  // Hitungan dan ukuran memakai urutan naik/turun agar terasa seperti progresi.
  if (r() < 0.75) pools.count = r() < 0.5 ? [1, 2, 3] : [3, 2, 1];
  if (r() < 0.75) pools.size = r() < 0.5 ? [0, 1, 2] : [2, 1, 0];
  const allowed: Rule[] =
    level <= 1
      ? ['col', 'row']
      : level === 2
        ? ['col', 'row', 'latin']
        : ['col', 'row', 'latin', 'latinRev'];
  const rules = {} as Record<Attr, Rule>;
  for (const a of attrs) rules[a] = vary.includes(a) ? pick(r, allowed) : 'const';
  // Tingkat 3 ke atas: setidaknya satu aturan latin (tiap baris berisi ketiga nilai).
  if (level >= 3 && !vary.some((a) => rules[a].startsWith('latin')))
    rules[vary[0]] = pick(r, ['latin', 'latinRev'] as Rule[]);
  const glyph = (row: number, col: number): Glyph => {
    const v = (a: Attr) => pools[a][ruleIndex(rules[a], row, col)];
    return {
      shape: v('shape') as Shape,
      count: v('count') as number,
      fill: v('fill') as Fill,
      size: v('size') as number,
    };
  };
  const grid: Glyph[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) grid.push(glyph(row, col));
  const ans = grid[8];

  // Pengecoh: ubah satu atribut dari jawaban, lalu sebagian diubah lagi satu atribut.
  const alter = (g: Glyph, a: Attr): Glyph => {
    const others = (
      a === 'shape'
        ? MATRIX_SHAPES
        : a === 'fill'
          ? FILLS
          : [0, 1, 2].map((x) => (a === 'count' ? x + 1 : x))
    ).filter((v) => v !== g[a]);
    // Utamakan nilai yang muncul di matriks agar pengecoh tampak masuk akal.
    const inPool = others.filter((v) => (pools[a] as readonly unknown[]).includes(v));
    return { ...g, [a]: pick(r, inPool.length && r() < 0.8 ? inPool : others) };
  };
  const seen = new Set([figureKey(glyphFigure(ans))]);
  const opts: Glyph[] = [];
  const add = (g: Glyph) => {
    const k = figureKey(glyphFigure(g));
    if (seen.has(k)) return;
    seen.add(k);
    opts.push(g);
  };
  const order = [
    ...shuffle(r, vary),
    ...shuffle(
      r,
      attrs.filter((a) => !vary.includes(a)),
    ),
  ];
  for (let i = 0; opts.length < 3 && i < 30; i++) add(alter(ans, order[i % order.length]));
  for (let i = 0; opts.length < 5 && i < 60; i++) {
    const base = opts.length ? pick(r, opts) : ans;
    add(alter(base, pick(r, attrs)));
  }
  const all = shuffle(r, [ans, ...opts]);
  const explain: Explain[] = vary.map((a) => ({
    key: `iq.ex.rule.${rules[a]}`,
    params: { attr: a },
  }));
  return {
    kind: 'matrix',
    level,
    cells: grid.slice(0, 8).map(glyphFigure),
    options: all.map(glyphFigure),
    answer: all.indexOf(ans),
    explain,
  };
}

const popcount = (n: number) => n.toString(2).replace(/0/g, '').length;

function matrixLines(r: Rng, level: number): MatrixQ {
  type Op = 'or' | 'xor' | 'diff';
  const op: Op =
    level <= 4 ? pick(r, ['or', 'or', 'xor'] as Op[]) : pick(r, ['xor', 'diff'] as Op[]);
  const apply = (a: number, b: number) => (op === 'or' ? a | b : op === 'xor' ? a ^ b : a & ~b);
  const randSegs = () => {
    let m = 0;
    while (popcount(m) < int(r, 2, 4)) m |= 1 << int(r, 0, 7);
    return m;
  };
  const rows: number[][] = [];
  for (let tries = 0; rows.length < 3 && tries < 5000; tries++) {
    const a = randSegs();
    const b = randSegs();
    const c = apply(a, b);
    // Hasil harus tidak kosong dan berbeda dari kedua masukan, agar aturannya terlihat.
    if (!c || c === a || c === b || popcount(c) > 6) continue;
    // Untuk XOR dan selisih, kedua gambar harus berbagi ruas (kalau tidak, sama saja dengan OR).
    if (op !== 'or' && !(a & b)) continue;
    if (rows.some((rw) => rw[0] === a && rw[1] === b)) continue;
    rows.push([a, b, c]);
  }
  if (rows.length < 3) return matrixGlyph(r, level);
  const fig = (segs: number): Figure => ({ items: [], segs });
  const ans = rows[2][2];
  const [a, b] = rows[2];
  const cand = new Set<number>();
  // Pengecoh terbaik: hasil dari operasi lain pada baris yang sama.
  for (const alt of [a | b, a ^ b, a & ~b, b & ~a, a & b]) if (alt && alt !== ans) cand.add(alt);
  const flips = shuffle(r, [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const bit of flips) {
    const v = ans ^ (1 << bit);
    if (v) cand.add(v);
  }
  const opts = shuffle(
    r,
    [...cand].filter((v) => v !== ans),
  ).slice(0, 5);
  const all = shuffle(r, [ans, ...opts]);
  return {
    kind: 'matrix',
    level,
    cells: rows.flat().slice(0, 8).map(fig),
    options: all.map(fig),
    answer: all.indexOf(ans),
    explain: [{ key: `iq.ex.lines.${op}` }],
  };
}

export function matrixQuestion(r: Rng, level: number): MatrixQ {
  if (level >= 5 || (level === 4 && r() < 0.5)) return matrixLines(r, level);
  return matrixGlyph(r, level);
}

// --- Deret angka ------------------------------------------------------------------------------
interface SeriesDef {
  terms: number[];
  next: number;
  explain: Explain;
}

type SeriesGen = (r: Rng) => SeriesDef;

const SERIES: Record<number, SeriesGen[]> = {
  1: [
    (r) => {
      const a = int(r, 1, 30);
      const d = int(r, 2, 9);
      const t = Array.from({ length: 6 }, (_, i) => a + d * i);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.add', params: { d } } };
    },
    (r) => {
      const d = int(r, 2, 8);
      const a = int(r, 7 * d, 11 * d);
      const t = Array.from({ length: 6 }, (_, i) => a - d * i);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.sub', params: { d } } };
    },
    (r) => {
      const a = int(r, 1, 6);
      const t = Array.from({ length: 6 }, (_, i) => a * 2 ** i);
      return {
        terms: t.slice(0, 5),
        next: t[5],
        explain: { key: 'iq.ex.s.mul', params: { k: 2 } },
      };
    },
  ],
  2: [
    (r) => {
      const a = int(r, 1, 4);
      const k = pick(r, [2, 3]);
      const t = Array.from({ length: 6 }, (_, i) => a * k ** i);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.mul', params: { k } } };
    },
    (r) => {
      const a = int(r, 1, 20);
      const d = int(r, 1, 4);
      const t = [a];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + d + i - 1);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.grow', params: { d } } };
    },
    (r) => {
      const s = int(r, 1, 4);
      const t = Array.from({ length: 6 }, (_, i) => (s + i) ** 2);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.square' } };
    },
  ],
  3: [
    (r) => {
      const a = int(r, 1, 15);
      const b = int(r, 20, 40);
      const d1 = int(r, 2, 6);
      const d2 = -int(r, 1, 5);
      const t = Array.from({ length: 7 }, (_, i) =>
        i % 2 === 0 ? a + d1 * (i / 2) : b + d2 * ((i - 1) / 2),
      );
      return { terms: t.slice(0, 6), next: t[6], explain: { key: 'iq.ex.s.interleave' } };
    },
    (r) => {
      const t = [int(r, 1, 5), int(r, 2, 8)];
      for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2]);
      return { terms: t.slice(0, 6), next: t[6], explain: { key: 'iq.ex.s.fib' } };
    },
    (r) => {
      const k = pick(r, [2, 3]);
      const c = pick(r, [1, -1, 2]);
      const t = [int(r, 2, 5)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] * k + c);
      return {
        terms: t.slice(0, 5),
        next: t[5],
        explain: { key: 'iq.ex.s.mulAdd', params: { k, c: c > 0 ? `+ ${c}` : `− ${-c}` } },
      };
    },
  ],
  4: [
    (r) => {
      const p = int(r, 2, 6);
      const k = pick(r, [2, 3]);
      const t = [int(r, 1, 6)];
      for (let i = 1; i < 7; i++) t.push(i % 2 ? t[i - 1] + p : t[i - 1] * k);
      return {
        terms: t.slice(0, 6),
        next: t[6],
        explain: { key: 'iq.ex.s.alt', params: { p, k } },
      };
    },
    (r) => {
      const d = int(r, 1, 3);
      const t = [int(r, 1, 10)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + d * 2 ** (i - 1));
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.diffDouble' } };
    },
    (r) => {
      const s = int(r, 1, 3);
      const c = int(r, -2, 3);
      const t = Array.from({ length: 6 }, (_, i) => (s + i) ** 3 + c);
      return {
        terms: t.slice(0, 5),
        next: t[5],
        explain: {
          key: 'iq.ex.s.cube',
          params: { c: c === 0 ? '' : c > 0 ? ` + ${c}` : ` − ${-c}` },
        },
      };
    },
  ],
  5: [
    (r) => {
      const c = int(r, 1, 3);
      const t = [int(r, 1, 4), int(r, 2, 5)];
      for (let i = 2; i < 7; i++) t.push(t[i - 1] + t[i - 2] + c);
      return {
        terms: t.slice(0, 6),
        next: t[6],
        explain: { key: 'iq.ex.s.fibPlus', params: { c } },
      };
    },
    (r) => {
      const a = int(r, 1, 3);
      const b = int(r, 2, 9);
      const d = int(r, 3, 7);
      const t = Array.from({ length: 7 }, (_, i) =>
        i % 2 === 0 ? a * 2 ** (i / 2) : b + d * ((i - 1) / 2),
      );
      return {
        terms: t.slice(0, 6),
        next: t[6],
        explain: { key: 'iq.ex.s.interleaveMul', params: { d } },
      };
    },
    (r) => {
      // Selisih bertambah sebagai deret kuadrat: +1, +4, +9, ...
      const t = [int(r, 1, 10)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] + i * i);
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.diffSquare' } };
    },
    (r) => {
      const t = [int(r, 1, 4)];
      for (let i = 1; i < 6; i++) t.push(t[i - 1] * (i + 1));
      return { terms: t.slice(0, 5), next: t[5], explain: { key: 'iq.ex.s.mulInc' } };
    },
  ],
};

export function seriesQuestion(r: Rng, level: number): SeriesQ {
  const def = pick(r, SERIES[Math.min(5, Math.max(1, level))])(r);
  const { terms, next } = def;
  const last = terms[terms.length - 1];
  const diff = last - terms[terms.length - 2];
  const cand = new Set<number>();
  // Pengecoh: tebakan "naif" (selisih terakhir diulang) dan angka di sekitar jawaban.
  for (const v of [
    last + diff,
    next + 1,
    next - 1,
    next + 2,
    next - 2,
    next + diff,
    next - diff,
    Math.round(next * 1.1),
    Math.round(next * 0.9),
    next + 10,
    next - 10,
    next + 3,
    next + 4,
    next * 2,
  ])
    if (v !== next && v >= 0) cand.add(v);
  const opts = shuffle(r, [...cand]).slice(0, 4);
  const all = shuffle(r, [next, ...opts]);
  return {
    kind: 'series',
    level,
    terms,
    options: all,
    answer: all.indexOf(next),
    explain: [def.explain],
  };
}

// --- Pilih yang berbeda -----------------------------------------------------------------------
/** Pilih n nilai acak dengan syarat tidak ada nilai yang muncul tepat n-1 kali. */
function noSplit<T>(r: Rng, xs: readonly T[], n: number): T[] {
  for (let tries = 0; tries < 100; tries++) {
    const out = Array.from({ length: n }, () => pick(r, xs));
    const counts = new Map<T, number>();
    for (const v of out) counts.set(v, (counts.get(v) ?? 0) + 1);
    if (![...counts.values()].some((c) => c === n - 1)) return out;
  }
  return Array.from({ length: n }, (_, i) => xs[i % xs.length]);
}

type OddRule = 'count' | 'sides' | 'dots' | 'mirror' | 'balance';
const ODD_RULES: Record<number, OddRule[]> = {
  1: ['count', 'sides'],
  2: ['sides', 'dots'],
  3: ['dots', 'mirror'],
  4: ['mirror', 'balance'],
  5: ['mirror', 'balance'],
};

function scatter(
  n: number,
  shape: (i: number) => Shape,
  fill: (i: number) => Fill,
  rBase: number,
): Item[] {
  return LAYOUT[n].map(([x, y], i) => ({
    shape: shape(i),
    x,
    y,
    r: rBase * COUNT_SCALE[n],
    rot: 0,
    fill: fill(i),
  }));
}

export function oddQuestion(r: Rng, level: number): OddQ {
  const rule = pick(r, ODD_RULES[Math.min(5, Math.max(1, level))]);
  const N = 5;
  const oddAt = int(r, 0, N - 1);
  const figs: Figure[] = [];
  const fills = noSplit(r, FILLS, N);
  const sizes = noSplit(r, [17, 22, 27], N);
  let explain: Explain;

  if (rule === 'count') {
    const k = int(r, 2, 4);
    const oddK = r() < 0.5 ? k + 1 : k - 1;
    const pool = sample(r, SHAPES, 3);
    for (let i = 0; i < N; i++) {
      const n = i === oddAt ? oddK : k;
      figs.push({
        items: scatter(
          n,
          () => pick(r, pool),
          () => fills[i],
          20,
        ),
      });
    }
    explain = { key: 'iq.ex.o.count', params: { n: k } };
  } else if (rule === 'sides') {
    const n = int(r, 3, 5);
    const oddN = n === 3 ? 4 : r() < 0.5 ? n + 1 : n - 1;
    const byN: Record<number, Shape[]> = {
      3: ['triangle'],
      4: ['square', 'diamond'],
      5: ['pentagon'],
      6: ['hexagon'],
    };
    const rots = noSplit(r, [0, 15, 30, 45, 60, 75], N);
    for (let i = 0; i < N; i++) {
      const shape = pick(r, byN[i === oddAt ? oddN : n]);
      figs.push({
        items: [{ shape, x: 50, y: 52, r: sizes[i] + 6, rot: rots[i], fill: fills[i] }],
      });
    }
    explain = { key: 'iq.ex.o.sides', params: { n } };
  } else if (rule === 'dots') {
    const shapes = noSplit(r, ['triangle', 'square', 'pentagon', 'hexagon'] as Shape[], N);
    for (let i = 0; i < N; i++) {
      const sides = SIDES[shapes[i]]!;
      const dots = i === oddAt ? (r() < 0.5 || sides <= 3 ? sides + 1 : sides - 1) : sides;
      const items: Item[] = [{ shape: shapes[i], x: 50, y: 52, r: 36, rot: 0, fill: 'empty' }];
      const ring = dots <= 3 ? 9 : 13;
      for (let d = 0; d < dots; d++) {
        const a = -Math.PI / 2 + (d * 2 * Math.PI) / dots;
        items.push({
          shape: 'dot',
          x: 50 + Math.cos(a) * ring,
          y: 54 + Math.sin(a) * ring,
          r: 3.6,
          rot: 0,
          fill: 'solid',
        });
      }
      figs.push({ items });
    }
    explain = { key: 'iq.ex.o.dots' };
  } else if (rule === 'mirror') {
    const rots = sample(r, [0, 45, 90, 135, 180, 225, 270, 315], N);
    const flipAll = r() < 0.5;
    for (let i = 0; i < N; i++) {
      figs.push({
        items: [
          {
            shape: 'eff',
            x: 50,
            y: 50,
            r: level >= 5 ? sizes[i] + 6 : 30,
            rot: rots[i],
            fill: level >= 5 ? fills[i] : 'solid',
            flip: (i === oddAt) !== flipAll,
          },
        ],
      });
    }
    explain = { key: 'iq.ex.o.mirror' };
  } else {
    // balance: jumlah benda hitam sama dengan benda putih, kecuali satu gambar.
    const totals = noSplit(r, [4, 6], N);
    const pool = sample(
      r,
      ['circle', 'square', 'triangle', 'diamond'] as Shape[],
      level >= 5 ? 3 : 2,
    );
    for (let i = 0; i < N; i++) {
      const n = totals[i];
      let solid = n / 2;
      if (i === oddAt) solid += r() < 0.5 ? 1 : -1;
      const order = shuffle(
        r,
        Array.from({ length: n }, (_, j) => (j < solid ? 'solid' : 'empty') as Fill),
      );
      figs.push({
        items: scatter(
          n,
          () => pick(r, pool),
          (j) => order[j],
          22,
        ),
      });
    }
    explain = { key: 'iq.ex.o.balance' };
  }
  // Gambar kembar membingungkan: ulangi dengan acakan baru.
  if (new Set(figs.map(figureKey)).size < N) return oddQuestion(r, level);
  return { kind: 'odd', level, options: figs, answer: oddAt, explain: [explain] };
}

// --- Rangkaian tes ----------------------------------------------------------------------------
export const TEST_SIZE = 30;
export const TEST_MS = 20 * 60 * 1000;
const KINDS: Kind[] = ['matrix', 'series', 'odd'];

/** Bangun 30 soal: tingkat naik tiap 6 soal, ketiga jenis bergiliran. */
export function buildTest(seed: number, size = TEST_SIZE): Question[] {
  const r = makeRng(seed);
  const offset = int(r, 0, 2);
  const perLevel = size / 5;
  return Array.from({ length: size }, (_, i) => {
    const level = Math.min(5, 1 + Math.floor(i / perLevel));
    const kind = KINDS[(i + offset) % 3];
    return kind === 'matrix'
      ? matrixQuestion(r, level)
      : kind === 'series'
        ? seriesQuestion(r, level)
        : oddQuestion(r, level);
  });
}

// --- Skor -------------------------------------------------------------------------------------
export interface IqResult {
  iq: number;
  /** Persentil (0-100) dari distribusi normal rata-rata 100, SD 15. */
  percentile: number;
  band: 'vhigh' | 'high' | 'above' | 'avg' | 'below' | 'low';
  correct: number;
  total: number;
  byKind: Record<Kind, { correct: number; total: number }>;
  byLevel: { correct: number; total: number }[];
}

/** Fungsi distribusi kumulatif normal standar (pendekatan Abramowitz-Stegun). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export const IQ_MIN = 70;
export const IQ_MAX = 145;

/**
 * Perkiraan IQ dari skor berbobot (soal tingkat 5 bernilai 5 kali soal tingkat 1). Ini bukan
 * norma resmi: pemetaan linear sederhana dengan 50% skor berbobot = 100.
 */
export function scoreTest(qs: readonly Question[], answers: readonly (number | null)[]): IqResult {
  let w = 0;
  let max = 0;
  let correct = 0;
  const byKind = {
    matrix: { correct: 0, total: 0 },
    series: { correct: 0, total: 0 },
    odd: { correct: 0, total: 0 },
  };
  const byLevel = Array.from({ length: 5 }, () => ({ correct: 0, total: 0 }));
  qs.forEach((q, i) => {
    const ok = answers[i] === q.answer;
    max += q.level;
    byKind[q.kind].total++;
    byLevel[q.level - 1].total++;
    if (ok) {
      w += q.level;
      correct++;
      byKind[q.kind].correct++;
      byLevel[q.level - 1].correct++;
    }
  });
  const p = max ? w / max : 0;
  const iq = Math.round(Math.min(IQ_MAX, Math.max(IQ_MIN, 100 + (p - 0.5) * 100)));
  const band: IqResult['band'] =
    iq >= 130
      ? 'vhigh'
      : iq >= 120
        ? 'high'
        : iq >= 110
          ? 'above'
          : iq >= 90
            ? 'avg'
            : iq >= 80
              ? 'below'
              : 'low';
  const percentile = Math.round(normCdf((iq - 100) / 15) * 1000) / 10;
  return { iq, percentile, band, correct, total: qs.length, byKind, byLevel };
}
