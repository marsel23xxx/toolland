/** Buat ZIP dari banyak file. Gambar sudah terkompresi, jadi disimpan tanpa kompresi ulang (cepat). */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const { zip } = await import('fflate');
  const used = new Map<string, number>();
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of files) {
    // Nama kembar diberi nomor: foto.jpg, foto (2).jpg
    const n = (used.get(f.name) ?? 0) + 1;
    used.set(f.name, n);
    const name = n === 1 ? f.name : f.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    entries[name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  }
  const data = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) =>
    zip(entries, (err, out) => (err ? reject(err) : resolve(out as Uint8Array<ArrayBuffer>))),
  );
  return new Blob([data], { type: 'application/zip' });
}
