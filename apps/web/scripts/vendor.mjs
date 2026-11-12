// Siapkan aset besar yang di-host sendiri (CSP hanya mengizinkan domain sendiri):
// public/vendor/<nama>/<versi>/...  (folder ini tidak masuk git)
//
// - pdf.js: cmaps, standard_fonts, wasm, iccs (dari node_modules)
// - ffmpeg core single-thread dan multi-thread (dari node_modules)
// - @imgly/background-removal: runtime ONNX + model isnet_fp16 & isnet_quint8 (unduh, diverifikasi SHA-256)
// - tesseract.js (OCR): worker, core WASM khusus LSTM, dan data bahasa Indonesia + Inggris
//
// Unduhan disimpan di cache (~/.cache/toolland-vendor) agar build berikutnya tidak mengunduh ulang.
// Menulis src/lib/vendor.ts berisi path versi yang dipakai kode.

import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE =
  process.env.TOOLLAND_VENDOR_CACHE ?? path.join(os.homedir(), '.cache/toolland-vendor');

// Dependensi langsung apps/web selalu ada di node_modules (symlink pnpm).
const pkgDir = (name) => path.join(root, 'node_modules', name);
const version = async (name) =>
  JSON.parse(await readFile(path.join(pkgDir(name), 'package.json'), 'utf8')).version;
const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function copy(from, to) {
  if (await exists(to)) return;
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

/** Unduh ke cache (bila belum ada), verifikasi hash bila diberikan, lalu salin ke tujuan. */
async function fetchCached(url, to, expectedSha) {
  if (await exists(to)) return;
  const cached = path.join(CACHE, sha256(Buffer.from(url)));
  let data;
  if (await exists(cached)) {
    data = await readFile(cached);
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`gagal unduh ${url}: ${res.status}`);
    data = Buffer.from(await res.arrayBuffer());
  }
  if (expectedSha && sha256(data) !== expectedSha) throw new Error(`hash tidak cocok: ${url}`);
  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, data);
  await mkdir(path.dirname(to), { recursive: true });
  await writeFile(to, data);
}

const v = {
  pdfjs: await version('pdfjs-dist'),
  ffmpegCore: await version('@ffmpeg/core'),
  ffmpegCoreMt: await version('@ffmpeg/core-mt'),
  imgly: await version('@imgly/background-removal'),
  tesseract: await version('tesseract.js'),
};

const paths = {
  pdfjs: `/vendor/pdfjs/${v.pdfjs}/`,
  ffmpegCore: `/vendor/ffmpeg-core/${v.ffmpegCore}/`,
  ffmpegCoreMt: `/vendor/ffmpeg-core-mt/${v.ffmpegCoreMt}/`,
  imgly: `/vendor/imgly/${v.imgly}/`,
  tesseract: `/vendor/tesseract/${v.tesseract}/`,
};
const dest = (p) => path.join(root, 'public', p);

// Hapus versi lama yang tidak dipakai lagi.
for (const p of Object.values(paths)) {
  const parent = path.dirname(dest(p));
  const keep = path.basename(dest(p));
  for (const entry of await readdir(parent).catch(() => [])) {
    if (entry !== keep) await rm(path.join(parent, entry), { recursive: true, force: true });
  }
}

// pdf.js
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  await copy(path.join(pkgDir('pdfjs-dist'), dir), path.join(dest(paths.pdfjs), dir));
}

// ffmpeg core
await copy(path.join(pkgDir('@ffmpeg/core'), 'dist/esm'), dest(paths.ffmpegCore));
await copy(path.join(pkgDir('@ffmpeg/core-mt'), 'dist/esm'), dest(paths.ffmpegCoreMt));

// tesseract.js: worker klasik (importScripts), tiga varian core LSTM (dipilih otomatis sesuai
// dukungan SIMD browser), dan data bahasa versi best_int (LSTM, ukuran kecil).
await copy(
  path.join(pkgDir('tesseract.js'), 'dist/worker.min.js'),
  path.join(dest(paths.tesseract), 'worker.min.js'),
);
for (const variant of ['', 'simd-', 'relaxedsimd-']) {
  const file = `tesseract-core-${variant}lstm.wasm.js`;
  await copy(
    path.join(pkgDir('tesseract.js-core'), file),
    path.join(dest(paths.tesseract), 'core', file),
  );
}
for (const lang of ['ind', 'eng']) {
  await copy(
    path.join(pkgDir(`@tesseract.js-data/${lang}`), '4.0.0_best_int', `${lang}.traineddata.gz`),
    path.join(dest(paths.tesseract), 'lang', `${lang}.traineddata.gz`),
  );
}

// @imgly/background-removal: hanya model dan runtime yang dipakai.
const imglyBase = `https://staticimgly.com/@imgly/background-removal-data/${v.imgly}/dist/`;
const resourcesPath = path.join(dest(paths.imgly), 'resources.json');
await fetchCached(`${imglyBase}resources.json`, resourcesPath);
const resources = JSON.parse(await readFile(resourcesPath, 'utf8'));
const WANTED = [
  '/models/isnet_fp16',
  '/models/isnet_quint8',
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm',
  '/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs',
];
let count = 0;
for (const key of WANTED) {
  const entry = resources[key];
  if (!entry) throw new Error(`resource imgly tidak ada: ${key}`);
  for (const chunk of entry.chunks) {
    await fetchCached(
      `${imglyBase}${chunk.name}`,
      path.join(dest(paths.imgly), chunk.name),
      chunk.name,
    );
    count++;
  }
}

// Ditulis dengan gaya Prettier proyek (kutip tunggal) agar lint tidak gagal setelah build.
const entries = Object.entries(paths)
  .map(([k, p]) => `  ${k}: '${p}',`)
  .join('\n');
await writeFile(
  path.join(root, 'src/lib/vendor.ts'),
  `// Dibuat otomatis oleh scripts/vendor.mjs. Jangan diedit manual.\nexport const VENDOR = {\n${entries}\n} as const;\n`,
);
console.log(`vendor siap: ${Object.keys(paths).join(', ')} (${count} potongan model imgly)`);
