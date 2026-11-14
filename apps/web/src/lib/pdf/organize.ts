/** Daftar halaman untuk Atur Halaman PDF. Fungsi murni: selalu mengembalikan array baru. */

export interface PageItem {
  /** Id unik per kartu (halaman yang sama bisa diduplikat). */
  id: number;
  /** Indeks halaman di PDF asal, mulai 0. */
  index: number;
  /** Putaran tambahan searah jarum jam: 0, 90, 180, 270. */
  rotate: number;
}

export function initialPages(count: number): PageItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: i, index: i, rotate: 0 }));
}

const turn = (r: number, by: number) => (((r + by) % 360) + 360) % 360;

export function rotateOne(items: PageItem[], id: number, by: 90 | -90): PageItem[] {
  return items.map((p) => (p.id === id ? { ...p, rotate: turn(p.rotate, by) } : p));
}

export function rotateAll(items: PageItem[], by: 90 | -90): PageItem[] {
  return items.map((p) => ({ ...p, rotate: turn(p.rotate, by) }));
}

export function removePage(items: PageItem[], id: number): PageItem[] {
  return items.filter((p) => p.id !== id);
}

/** Salin halaman tepat di sebelahnya; id baru = id terbesar + 1. */
export function duplicatePage(items: PageItem[], id: number): PageItem[] {
  const i = items.findIndex((p) => p.id === id);
  if (i < 0) return items;
  const next = Math.max(...items.map((p) => p.id)) + 1;
  return [...items.slice(0, i + 1), { ...items[i], id: next }, ...items.slice(i + 1)];
}

/** Pindahkan kartu dari posisi `from` ke posisi `to` (indeks dalam daftar). */
export function movePage(items: PageItem[], from: number, to: number): PageItem[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const out = [...items];
  const [p] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, p);
  return out;
}

export function reversePages(items: PageItem[]): PageItem[] {
  return [...items].reverse();
}

/** Apakah ada perubahan dari PDF asal (urutan, putaran, atau jumlah halaman). */
export function isChanged(items: PageItem[], count: number): boolean {
  return items.length !== count || items.some((p, i) => p.index !== i || p.rotate !== 0);
}
