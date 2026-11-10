/**
 * Simpan otomatis proyek editor video ke IndexedDB browser (tidak pernah ke server), agar
 * pekerjaan bisa dipulihkan setelah tab tertutup atau browser crash. File media ikut disimpan
 * sampai batas tertentu (rekaman narasi selalu, karena tidak ada aslinya di perangkat); file
 * lain diminta disambungkan ulang seperti membuka .ayu ringan.
 */
import type { MediaItem } from './project';

const DB = 'toolland-editor';
const VERSION = 1;
/** Total ukuran file media yang ikut disimpan otomatis. */
export const AUTOSAVE_FILE_BUDGET = 1024 ** 3;
/** File tunggal lebih besar dari ini tidak disimpan (kecuali rekaman). */
export const AUTOSAVE_FILE_MAX = 300 * 1024 ** 2;

export interface Snapshot {
  savedAt: number;
  json: string;
  files: Map<string, File>;
}

/** Media mana yang filenya ikut disimpan: rekaman dulu, lalu dari yang terkecil, sampai batas. */
export function pickStoredFiles(
  media: Pick<MediaItem, 'id' | 'size' | 'recorded'>[],
  budget = AUTOSAVE_FILE_BUDGET,
  max = AUTOSAVE_FILE_MAX,
): Set<string> {
  const out = new Set<string>();
  let used = 0;
  const sorted = [...media].sort(
    (a, b) => Number(!!b.recorded) - Number(!!a.recorded) || a.size - b.size,
  );
  for (const m of sorted) {
    if (!m.recorded && (m.size > max || used + m.size > budget)) continue;
    out.add(m.id);
    used += m.size;
  }
  return out;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('project')) db.createObjectStore('project');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Kunci file: ID media + ukuran + waktu ubah, agar file pengganti ikut tersimpan ulang. */
const fileKey = (id: string, f: File) => `${id}|${f.size}|${f.lastModified}`;

/**
 * Simpan proyek dan file yang diizinkan. File yang sudah tersimpan tidak ditulis ulang; file
 * yang tidak dipakai lagi dihapus. Gagal diam-diam (mode privat, kuota penuh).
 */
export async function saveSnapshot(
  json: string,
  files: Map<string, File>,
  keep: Set<string>,
): Promise<boolean> {
  try {
    const db = await open();
    const existing = new Set(
      (await req(db.transaction('files').objectStore('files').getAllKeys())) as string[],
    );
    const want = new Map<string, File>();
    for (const id of keep) {
      const f = files.get(id);
      if (f) want.set(fileKey(id, f), f);
    }
    // Tulis file baru dalam transaksi terpisah per file agar transaksi tidak terlalu besar.
    for (const [key, f] of want)
      if (!existing.has(key)) {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(f, key);
        await done(tx);
      }
    const tx = db.transaction(['files', 'project'], 'readwrite');
    for (const key of existing) if (!want.has(key)) tx.objectStore('files').delete(key);
    tx.objectStore('project').put({ savedAt: Date.now(), json }, 'current');
    await done(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const db = await open();
    const tx = db.transaction(['project', 'files']);
    const p = (await req(tx.objectStore('project').get('current'))) as
      { savedAt: number; json: string } | undefined;
    if (!p) {
      db.close();
      return null;
    }
    const keys = (await req(tx.objectStore('files').getAllKeys())) as string[];
    const files = new Map<string, File>();
    for (const key of keys) {
      const f = (await req(tx.objectStore('files').get(key))) as File | undefined;
      if (f) files.set(key.split('|')[0], f);
    }
    db.close();
    return { savedAt: p.savedAt, json: p.json, files };
  } catch {
    return null;
  }
}

export async function clearSnapshot(): Promise<void> {
  try {
    const db = await open();
    const tx = db.transaction(['project', 'files'], 'readwrite');
    tx.objectStore('project').clear();
    tx.objectStore('files').clear();
    await done(tx);
    db.close();
  } catch {
    // Tidak ada yang perlu dibersihkan.
  }
}
