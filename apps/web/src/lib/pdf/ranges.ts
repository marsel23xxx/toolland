/**
 * Parse rentang halaman seperti "1-3, 5, 8-" menjadi daftar grup (halaman mulai dari 1).
 * "8-" berarti sampai halaman terakhir. Melempar Error berisi teks bagian yang salah.
 */
export function parseRanges(input: string, pageCount: number): number[][] {
  const groups: number[][] = [];
  for (const raw of input.split(/[,;]/)) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(part);
    const start = m[1] ? Number(m[1]) : 1;
    const end = m[2] ? (m[3] ? Number(m[3]) : pageCount) : start;
    if (start < 1 || end < start || end > pageCount) throw new Error(part);
    groups.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }
  if (!groups.length) throw new Error(input);
  return groups;
}
