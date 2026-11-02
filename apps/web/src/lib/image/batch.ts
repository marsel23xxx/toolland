import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { MIME, outputName } from './format';
import { CancelledError, ImagePool } from './pool';
import type { ImageJob } from './types';

export type ItemStatus = 'queued' | 'processing' | 'done' | 'error';

export interface BatchItem {
  id: number;
  file: File;
  status: ItemStatus;
  /** Kode error dari worker: unsupported, decode, memory, encode. */
  error?: string;
  result?: {
    blob: Blob;
    url: string;
    name: string;
    width: number;
    height: number;
    unchanged: boolean;
  };
  ms?: number;
}

/**
 * Antrean banyak file gambar: diproses paralel di ImagePool, hasil disimpan sebagai Blob
 * dengan object URL (dilepas saat item dihapus atau komponen ditutup).
 */
export function useImageBatch(options: { suffix?: string } = {}) {
  const pool = new ImagePool();
  const items = ref<BatchItem[]>([]);
  let nextId = 0;
  let generation = 0;

  function revoke(item: BatchItem) {
    if (item.result) URL.revokeObjectURL(item.result.url);
  }

  async function run(item: BatchItem, job: ImageJob) {
    const gen = generation;
    item.status = 'processing';
    item.error = undefined;
    const start = performance.now();
    try {
      // Objek reaktif Vue (Proxy) tidak bisa dikirim ke worker; kirim salinan biasa.
      const plain = JSON.parse(JSON.stringify(job)) as ImageJob;
      const r = await pool.run((api) => api.process(item.file, plain));
      if (gen !== generation) return;
      revoke(item);
      const blob = new Blob([r.buffer], { type: MIME[r.format] });
      item.result = {
        blob,
        url: URL.createObjectURL(blob),
        name: outputName(item.file.name, r.format, options.suffix),
        width: r.width,
        height: r.height,
        unchanged: r.unchanged,
      };
      item.ms = performance.now() - start;
      item.status = 'done';
    } catch (e) {
      if (gen !== generation || e instanceof CancelledError) return;
      item.status = 'error';
      item.error = (e as Error).message;
    }
  }

  /** Tambah file dan langsung proses dengan job saat ini. */
  function add(files: File[], job: ImageJob) {
    for (const file of files) {
      items.value.push({ id: nextId++, file, status: 'queued' });
      void run(items.value[items.value.length - 1], job);
    }
  }

  /** Proses ulang semua file dengan pengaturan baru. */
  function rerun(job: ImageJob) {
    for (const item of items.value) void run(item, job);
  }

  function remove(id: number) {
    const item = items.value.find((i) => i.id === id);
    if (item) revoke(item);
    items.value = items.value.filter((i) => i.id !== id);
  }

  function cancel() {
    generation++;
    pool.cancel();
    for (const item of items.value) {
      if (item.status === 'queued' || item.status === 'processing')
        item.status = item.result ? 'done' : 'error';
      if (item.status === 'error' && !item.error) item.error = 'cancelled';
    }
  }

  function clear() {
    cancel();
    items.value.forEach(revoke);
    items.value = [];
  }

  onBeforeUnmount(() => {
    pool.destroy();
    items.value.forEach(revoke);
  });

  const busy = computed(() =>
    items.value.some((i) => i.status === 'queued' || i.status === 'processing'),
  );
  const done = computed(() => items.value.filter((i) => i.status === 'done'));

  /** Estimasi sisa waktu (detik) dari rata-rata waktu proses per file. */
  const eta = computed(() => {
    const finished = done.value.filter((i) => i.ms !== undefined);
    const pending = items.value.filter(
      (i) => i.status === 'queued' || i.status === 'processing',
    ).length;
    if (!finished.length || !pending) return undefined;
    const avg = finished.reduce((s, i) => s + i.ms!, 0) / finished.length;
    return Math.ceil((avg * pending) / pool.size / 1000);
  });

  const totals = computed(() => {
    const before = done.value.reduce((s, i) => s + i.file.size, 0);
    const after = done.value.reduce((s, i) => s + i.result!.blob.size, 0);
    return { before, after };
  });

  return reactive({ items, busy, done, eta, totals, add, rerun, remove, cancel, clear, pool });
}
