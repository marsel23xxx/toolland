/// <reference lib="webworker" />
/**
 * Hapus background dengan @imgly/background-removal (model ISNet, ONNX Runtime) di Web Worker.
 * WebGPU dipakai bila tersedia (model fp16), selain itu CPU WASM (model quint8, unduhan lebih kecil).
 * Model dan runtime di-host sendiri di /vendor (lihat scripts/vendor.mjs).
 */
import { expose, transfer } from 'comlink';

export type Progress = (stage: 'download' | 'process', current: number, total: number) => void;

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
    const device = await api.device();
    const blob = await removeBackground(file, {
      publicPath,
      device,
      model: device === 'gpu' ? 'isnet_fp16' : 'isnet_quint8',
      proxyToWorker: false,
      output: { format: 'image/png' },
      progress: (key: string, current: number, total: number) => {
        onProgress(key.startsWith('compute') ? 'process' : 'download', current, total);
      },
    });
    const png = await blob.arrayBuffer();
    return transfer({ png, device }, [png]);
  },
};

export type BgWorkerApi = typeof api;
expose(api);
