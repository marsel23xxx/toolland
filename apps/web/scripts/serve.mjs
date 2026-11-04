// Jalankan hasil build (dist) seperti di produksi: URL tanpa .html, CSP, COOP/COEP halaman media,
// dan /api diteruskan ke API Rust lokal. Pemakaian: pnpm build && pnpm serve
import path from 'node:path';
import { startServer } from '../e2e/server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
process.env.TOOLLAND_API_URL ??= 'http://127.0.0.1:8082';
const port = Number(process.env.PORT ?? 4321);
const { url } = await startServer(
  path.join(root, 'dist'),
  path.resolve(root, '../../infra/nginx/web.conf'),
  port,
);
console.log(`Toolland berjalan di ${url}  (API: ${process.env.TOOLLAND_API_URL})`);
