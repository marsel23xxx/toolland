declare module 'libheif-js/libheif-wasm/libheif-bundle.mjs' {
  interface HeifImage {
    get_width(): number;
    get_height(): number;
    display(
      target: { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number },
      callback: (result: { data: Uint8ClampedArray<ArrayBuffer> } | null) => void,
    ): void;
    free?(): void;
  }
  interface LibHeif {
    HeifDecoder: new () => { decode(data: Uint8Array): HeifImage[] };
  }
  const factory: (options?: object) => Promise<LibHeif> | LibHeif;
  export default factory;
}
