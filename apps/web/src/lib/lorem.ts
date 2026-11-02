const WORDS = (
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et ' +
  'dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea ' +
  'commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur ' +
  'excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum ' +
  'curabitur pretium tincidunt lacus nunc pulvinar sapien ligula malesuada vitae porta mauris integer ' +
  'vehicula viverra tortor feugiat quam maecenas tristique arcu volutpat facilisis morbi vulputate'
).split(' ');

export type LoremUnit = 'paragraphs' | 'sentences' | 'words';
export const LOREM_START = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

type Rand = () => number;

const int = (rand: Rand, min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = (rand: Rand) => WORDS[Math.floor(rand() * WORDS.length)];

function words(rand: Rand, n: number): string[] {
  return Array.from({ length: n }, () => pick(rand));
}

function sentence(rand: Rand): string {
  const w = words(rand, int(rand, 6, 14));
  // sesekali beri koma di tengah kalimat
  if (w.length > 8 && rand() < 0.5) w[int(rand, 3, w.length - 4)] += ',';
  const s = w.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}

function paragraph(rand: Rand): string {
  return Array.from({ length: int(rand, 4, 7) }, () => sentence(rand)).join(' ');
}

/** Buat teks Lorem Ipsum. Paragraf dipisah baris kosong. */
export function lorem(
  count: number,
  unit: LoremUnit,
  startWithLorem = true,
  rand: Rand = Math.random,
): string {
  const n = Math.max(1, Math.floor(count));
  let out: string;
  if (unit === 'words') {
    out = words(rand, n).join(' ');
  } else if (unit === 'sentences') {
    out = Array.from({ length: n }, () => sentence(rand)).join(' ');
  } else {
    out = Array.from({ length: n }, () => paragraph(rand)).join('\n\n');
  }
  if (!startWithLorem) return out;

  if (unit === 'words') {
    const start = LOREM_START.replace(',', '').toLowerCase().split(' ');
    const rest = out.split(' ').slice(start.length);
    const all = [...start, ...rest].slice(0, n);
    all[0] = 'Lorem';
    return all.join(' ');
  }
  // ganti awal kalimat pertama dengan pembuka klasik
  return out.replace(/^[^.]*\./, `${LOREM_START}.`);
}
