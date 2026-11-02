import wasmURL from 'esbuild-wasm/esbuild.wasm?url';

type Esbuild = typeof import('esbuild-wasm/esm/browser.js');
let loading: Promise<Esbuild> | undefined;

/**
 * Muat esbuild-wasm (sekitar 14 MB, terkompresi jauh lebih kecil) hanya saat dibutuhkan.
 * Dipanggil saat pengguna mulai mengetik (prefetch) dan saat menekan Minify.
 */
export function loadEsbuild(): Promise<Esbuild> {
  loading ??= (async () => {
    const esbuild = await import('esbuild-wasm/esm/browser.js');
    await esbuild.initialize({ wasmURL, worker: true });
    return esbuild;
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}

export interface MinifyError {
  message: string;
  line?: number;
  column?: number;
}

export async function minify(code: string, loader: 'css' | 'js'): Promise<string> {
  const esbuild = await loadEsbuild();
  const out = await esbuild.transform(code, { loader, minify: true, legalComments: 'none' });
  return out.code.trimEnd();
}

/** Ambil pesan dan lokasi error pertama dari error esbuild. */
export function toMinifyError(e: unknown): MinifyError {
  const first = (e as { errors?: { text: string; location?: { line: number; column: number } }[] })
    .errors?.[0];
  if (first)
    return {
      message: first.text,
      line: first.location?.line,
      column: (first.location?.column ?? 0) + 1,
    };
  return { message: (e as Error).message };
}
