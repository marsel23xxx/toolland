/** Alamat sel gaya A1: kolom huruf, baris angka (keduanya mulai dari 1). */

export function colName(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n;
}

export function parseRef(ref: string): { c: number; r: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(ref);
  if (!m) throw new Error(`Alamat sel tidak valid: ${ref}`);
  return { c: colIndex(m[1]), r: Number(m[2]) };
}

export function cellRef(c: number, r: number): string {
  return `${colName(c)}${r}`;
}

/** "B5:D9" -> sudut kiri atas dan kanan bawah. Satu sel ("B5") juga boleh. */
export function parseRange(range: string): { c1: number; r1: number; c2: number; r2: number } {
  const [a, b = a] = range.split(':');
  const p = parseRef(a);
  const q = parseRef(b);
  return {
    c1: Math.min(p.c, q.c),
    r1: Math.min(p.r, q.r),
    c2: Math.max(p.c, q.c),
    r2: Math.max(p.r, q.r),
  };
}

/** Nama sheet di dalam rumus, selalu diberi kutip: 'Laba Rugi'. */
export function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** Rentang absolut lintas sheet: 'Transaksi'!$B$5:$B$1004. */
export function absRange(sheet: string, range: string): string {
  const abs = range
    .split(':')
    .map((r) => {
      const { c, r: row } = parseRef(r);
      return `$${colName(c)}$${row}`;
    })
    .join(':');
  return `${quoteSheet(sheet)}!${abs}`;
}

/** Tanggal kalender -> nomor seri Excel (sistem 1900). */
export function excelDate(y: number, m: number, d: number): number {
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export function escXml(s: string): string {
  return (
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      // Karakter kontrol tidak sah di XML 1.0.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  );
}
