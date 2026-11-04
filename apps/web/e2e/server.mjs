// Server statis untuk uji: meniru infra/nginx/web.conf (URL tanpa .html, 404, COOP/COEP halaman media).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

/** Halaman yang butuh COOP/COEP, dibaca dari map $media_page di Nginx agar selalu sinkron. */
export function isolatedPages(nginxConf) {
  const block =
    /map \$req_path \$media_page \{([\s\S]*?)\n\}/.exec(fs.readFileSync(nginxConf, 'utf8'))?.[1] ??
    '';
  return [...block.matchAll(/^\s*~(\S+)\s+1;/gm)].map((m) => new RegExp(m[1]));
}

export function startServer(dist, nginxConf) {
  const isolated = isolatedPages(nginxConf);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (urlPath.length > 1 && urlPath.endsWith('/')) {
      res.writeHead(301, { location: urlPath.slice(0, -1) }).end();
      return;
    }
    const candidates =
      urlPath === '/' ? ['/index.html'] : [urlPath, `${urlPath}.html`, `${urlPath}/index.html`];
    const found = candidates
      .map((c) => path.join(dist, c))
      .find((f) => f.startsWith(dist) && fs.existsSync(f) && fs.statSync(f).isFile());
    const headers = {
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    };
    if (isolated.some((r) => r.test(urlPath))) {
      headers['cross-origin-opener-policy'] = 'same-origin';
      headers['cross-origin-embedder-policy'] = 'require-corp';
    }
    const file = found ?? path.join(dist, '404.html');
    // Seperti Nginx: aset (/_astro, /vendor) membawa COEP agar worker bisa dibuat di halaman terisolasi.
    if (/^\/(_astro|vendor)\//.test(urlPath))
      headers['cross-origin-embedder-policy'] = 'require-corp';
    headers['content-type'] = TYPES[path.extname(file)] ?? 'application/octet-stream';
    res.writeHead(found ? 200 : 404, headers);
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}
