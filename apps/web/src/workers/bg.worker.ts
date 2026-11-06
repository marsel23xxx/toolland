/// <reference lib="webworker" />
/**
 * Hapus background dengan @imgly/background-removal (model ISNet, ONNX Runtime) di Web Worker.
 * WebGPU dipakai bila tersedia (model fp16), selain itu CPU WASM (model quint8, unduhan lebih kecil).
 * Model dan runtime di-host sendiri di /vendor (lihat scripts/vendor.mjs).
 */
import { expose, transfer } from 'comlink';

/** key dari imgly: `fetch:<file>` (byte) atau `compute:decode|inference|mask|encode` (langkah). */
export type Progress = (key: string, current: number, total: number) => void;

async function hasWebGpu(): Promise<boolean> {
  try {
    const gpu = (self.navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
      .gpu;
    return !!(gpu && (await gpu.requestAdapter()));
  } catch {
    return false;
  }
}

let gpu: Promise<boolean> | undefined;

const api = {
  async device(): Promise<'gpu' | 'cpu'> {
    gpu ??= hasWebGpu();
    return (await gpu) ? 'gpu' : 'cpu';
  },

  async remove(
    file: Blob,
    publicPath: string,
    onProgress: Progress,
  ): Promise<{ png: ArrayBuffer; device: 'gpu' | 'cpu' }> {
    const { removeBackground } = await import('@imgly/background-removal');
    const run = (device: 'gpu' | 'cpu') =>
      removeBackground(file, {
        publicPath,
        device,
        model: device === 'gpu' ? 'isnet_fp16' : 'isnet_quint8',
        proxyToWorker: false,
        output: { format: 'image/png' },
        // Jangan kembalikan Promise dari proxy Comlink ke imgly: cukup panggil lalu lanjut.
        progress: (key: string, current: number, total: number) => {
          void onProgress(key, current, total);
        },
      });
    let device = await api.device();
    let blob: Blob;
    try {
      blob = await run(device);
    } catch (e) {
      if (device !== 'gpu') throw e;
      // Sebagian HP melaporkan WebGPU tapi gagal saat model dijalankan: pakai CPU seterusnya.
      gpu = Promise.resolve(false);
      device = 'cpu';
      blob = await run(device);
    }
    const png = await blob.arrayBuffer();
    return transfer({ png, device }, [png]);
  },
};

export type BgWorkerApi = typeof api;
expose(api);
