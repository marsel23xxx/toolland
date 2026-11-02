import type { Remote } from 'comlink';
import type { ImageWorkerApi } from '../../workers/image.worker';

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

interface Slot {
  worker: Worker;
  api: Promise<Remote<ImageWorkerApi>>;
  busy: boolean;
}

interface Task<R> {
  run: (api: Remote<ImageWorkerApi>) => Promise<R>;
  resolve: (v: R) => void;
  reject: (e: unknown) => void;
}

/**
 * Kumpulan worker gambar. Jumlah worker mengikuti jumlah core, maksimal 4 agar HP tidak kepanasan.
 * Worker dibuat saat dibutuhkan dan dipakai ulang untuk semua file.
 */
export class ImagePool {
  private slots: Slot[] = [];
  private queue: Task<unknown>[] = [];
  readonly size = Math.max(1, Math.min(4, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1));

  private spawn(): Slot {
    const worker = new Worker(new URL('../../workers/image.worker.ts', import.meta.url), {
      type: 'module',
    });
    // Comlink dimuat saat worker pertama dibuat, bukan saat halaman dibuka.
    const api = import('comlink').then(({ wrap }) => wrap<ImageWorkerApi>(worker));
    const slot = { worker, api, busy: false };
    this.slots.push(slot);
    return slot;
  }

  /** Siapkan satu worker dan codec untuk format tertentu lebih awal. */
  warmup(format: Parameters<ImageWorkerApi['warmup']>[0]): void {
    const slot = this.slots[0] ?? this.spawn();
    void slot.api.then((api) => api.warmup(format));
  }

  run<R>(fn: (api: Remote<ImageWorkerApi>) => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ run: fn, resolve, reject } as Task<unknown>);
      this.pump();
    });
  }

  private pump(): void {
    while (this.queue.length) {
      let slot = this.slots.find((s) => !s.busy);
      if (!slot && this.slots.length < this.size) slot = this.spawn();
      if (!slot) return;
      const task = this.queue.shift()!;
      const s = slot;
      s.busy = true;
      s.api
        .then((api) => task.run(api))
        .then(task.resolve, task.reject)
        .finally(() => {
          s.busy = false;
          this.pump();
        });
    }
  }

  /** Hentikan semua proses: worker dimatikan, antrean dibatalkan. */
  cancel(): void {
    for (const t of this.queue) t.reject(new CancelledError());
    this.queue = [];
    for (const s of this.slots) s.worker.terminate();
    this.slots = [];
  }

  destroy(): void {
    this.cancel();
  }
}
