/**
 * Cek kemiripan dua dokumen (deteksi plagiarisme antar dokumen). Teks dipecah menjadi kata,
 * lalu dicari rangkaian kata yang sama persis di kedua dokumen (minimal `k` kata berturut-turut,
 * mengabaikan huruf besar, tanda baca, dan aksen). Urutan paragraf tidak berpengaruh, jadi
 * kalimat yang dipindah tempat tetap terdeteksi.
 */

export interface Token {
  /** Bentuk ternormalisasi untuk dibandingkan. */
  norm: string;
  /** Posisi karakter di teks asli. */
  start: number;
  end: number;
}

export interface Passage {
  id: number;
  /** Indeks kata awal di dokumen A dan B, serta panjangnya (kata). */
  a: number;
  b: number;
  len: number;
  /** Cuplikan teks dari dokumen A. */
  text: string;
}

export interface Segment {
  text: string;
  /** Nomor passage bila bagian ini sama dengan dokumen lain, selain itu null. */
  id: number | null;
}

export interface SimilarityResult {
  wordsA: number;
  wordsB: number;
  /** Persentase kata dokumen A yang juga ada di B (0-100), begitu juga sebaliknya. */
  coverA: number;
  coverB: number;
  /** Kemiripan gabungan: kata yang cocok di kedua dokumen dibagi total kata. */
  overall: number;
  passages: Passage[];
  segA: Segment[];
  segB: Segment[];
}

/** Pecah teks menjadi kata (huruf dan angka, termasuk huruf non-Latin). */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu)) {
    const norm = m[0].normalize('NFKD').replace(/\p{M}/gu, '').replace(/['’]/g, '').toLowerCase();
    out.push({ norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Bagi teks menjadi potongan biasa dan potongan yang cocok, berdasarkan tanda per kata. */
function segments(text: string, toks: Token[], mark: Int32Array): Segment[] {
  const segs: Segment[] = [];
  let pos = 0;
  let i = 0;
  while (i < toks.length) {
    const id = mark[i];
    if (id < 0) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < toks.length && mark[j + 1] === id) j++;
    if (toks[i].start > pos) segs.push({ text: text.slice(pos, toks[i].start), id: null });
    segs.push({ text: text.slice(toks[i].start, toks[j].end), id });
    pos = toks[j].end;
    i = j + 1;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), id: null });
  return segs;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

/**
 * Bandingkan dua teks. `k` = panjang minimal rangkaian kata yang dianggap sama (3 = sensitif,
 * 5 = normal, 8 = longgar).
 */
export function compareTexts(textA: string, textB: string, k = 5): SimilarityResult {
  const A = tokenize(textA);
  const B = tokenize(textB);
  const markA = new Int32Array(A.length).fill(-1);
  const markB = new Int32Array(B.length).fill(-1);
  const passages: Passage[] = [];

  if (A.length >= k && B.length >= k) {
    // Indeks semua rangkaian k kata di B.
    const index = new Map<string, number[]>();
    for (let j = 0; j + k <= B.length; j++) {
      const key = B.slice(j, j + k)
        .map((t) => t.norm)
        .join(' ');
      const list = index.get(key);
      if (list) list.push(j);
      else index.set(key, [j]);
    }
    // Telusuri A, ambil kecocokan terpanjang di setiap posisi (greedy).
    let i = 0;
    while (i + k <= A.length) {
      const key = A.slice(i, i + k)
        .map((t) => t.norm)
        .join(' ');
      const cands = index.get(key);
      if (!cands) {
        i++;
        continue;
      }
      let best = -1;
      let bestLen = 0;
      let bestFresh = false;
      // Batasi kandidat agar teks yang sangat berulang tetap cepat.
      for (const j of cands.length > 64 ? cands.slice(0, 64) : cands) {
        let len = k;
        while (i + len < A.length && j + len < B.length && A[i + len].norm === B[j + len].norm)
          len++;
        // Bila sama panjang, utamakan bagian B yang belum dipakai kecocokan lain.
        const fresh = markB[j] < 0;
        if (len > bestLen || (len === bestLen && fresh && !bestFresh)) {
          best = j;
          bestLen = len;
          bestFresh = fresh;
        }
      }
      const id = passages.length;
      passages.push({
        id,
        a: i,
        b: best,
        len: bestLen,
        text: textA.slice(A[i].start, A[i + bestLen - 1].end),
      });
      for (let x = 0; x < bestLen; x++) {
        markA[i + x] = id;
        if (markB[best + x] < 0) markB[best + x] = id;
      }
      i += bestLen;
    }
  }

  const coveredA = markA.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
  const coveredB = markB.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
  return {
    wordsA: A.length,
    wordsB: B.length,
    coverA: pct(coveredA, A.length),
    coverB: pct(coveredB, B.length),
    overall: pct(coveredA + coveredB, A.length + B.length),
    passages,
    segA: segments(textA, A, markA),
    segB: segments(textB, B, markB),
  };
}

export type Level = 'low' | 'medium' | 'high';

/** Kategori kasar: di bawah 15% rendah, 15-40% sedang, di atas 40% tinggi. */
export function similarityLevel(p: number): Level {
  return p >= 40 ? 'high' : p >= 15 ? 'medium' : 'low';
}
