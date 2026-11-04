import { onBeforeUnmount, ref } from 'vue';

export interface FileResult {
  id: number;
  name: string;
  blob: Blob;
  url: string;
  /** Teks tambahan, misalnya "12 halaman" atau "hemat 40%". */
  detail?: string;
}

/** Daftar file hasil dengan object URL yang dilepas saat dihapus atau komponen ditutup. */
export function useFileResults() {
  const items = ref<FileResult[]>([]);
  let nextId = 0;

  function add(name: string, blob: Blob, detail?: string): FileResult {
    const item = { id: nextId++, name, blob, url: URL.createObjectURL(blob), detail };
    items.value.push(item);
    return item;
  }
  function remove(id: number) {
    const item = items.value.find((i) => i.id === id);
    if (item) URL.revokeObjectURL(item.url);
    items.value = items.value.filter((i) => i.id !== id);
  }
  function clear() {
    items.value.forEach((i) => URL.revokeObjectURL(i.url));
    items.value = [];
  }
  onBeforeUnmount(clear);
  return { items, add, remove, clear };
}

/** Nama file dengan akhiran: laporan.pdf -> laporan-gabung.pdf */
export function withSuffix(name: string, suffix: string, ext?: string): string {
  const m = /^(.*?)(\.[^.]+)?$/.exec(name)!;
  return `${m[1] || 'file'}${suffix}${ext ?? m[2] ?? ''}`;
}
