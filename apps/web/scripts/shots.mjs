// Ambil screenshot tool populer untuk etalase berjalan di beranda (src/assets/shots/).
// Butuh build (pnpm build) dan API lokal untuk tool server:
//   TOOLLAND_API_URL=http://127.0.0.1:8082 node scripts/shots.mjs
// Hasil: <slug>-<light|dark>.webp per bahasa, 720×540, kotak tool (lebar tablet) berisi hasil proses.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { makeFixtures } from '../e2e/fixtures.mjs';
import { startServer } from '../e2e/server.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.resolve(HERE, '../dist');
const NGINX = path.resolve(HERE, '../../../infra/nginx/web.conf');
const OUT = path.resolve(HERE, '../src/assets/shots');
const VIEW = 700;

/** Tool populer: slug ID, slug EN, file yang diunggah, dan tombol yang diklik setelahnya. */
const TOOLS = [
  { id: 'kompres-gambar', en: 'compress-image', files: ['batch-1.jpg', 'foto.webp', 'kecil.jpg'] },
  { id: 'heic-ke-jpg', en: 'heic-to-jpg', files: ['contoh.heic'] },
  { id: 'hapus-background', en: 'remove-background', files: ['benda.jpg'] },
  {
    id: 'gabung-pdf',
    en: 'merge-pdf',
    files: ['teks.pdf', 'foto.pdf'],
    click: ['Gabung PDF', 'Merge PDF'],
  },
  { id: 'kompres-pdf', en: 'compress-pdf', files: ['foto.pdf'] },
  { id: 'word-ke-pdf', en: 'word-to-pdf', files: ['surat.docx'] },
  { id: 'pdf-ke-word', en: 'pdf-to-word', files: ['teks.pdf'] },
];

const only = process.argv.slice(2);
const fixtures = await makeFixtures();
const { server, url } = await startServer(DIST, NGINX);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});

/** Foto contoh buatan sendiri (bukan foto orang): cangkir di latar polos. */
async function makeObjectPhoto(file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
    <defs>
      <linearGradient id="mug" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a3d1d"/><stop offset=".45" stop-color="#d0643a"/><stop offset="1" stop-color="#7c2f15"/></linearGradient>
      <linearGradient id="pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8e2d6"/><stop offset=".5" stop-color="#fffaf0"/><stop offset="1" stop-color="#c9c1b2"/></linearGradient>
      <radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="900" fill="#d7e3e6"/>
    <ellipse cx="610" cy="735" rx="190" ry="34" fill="url(#shadow)"/>
    <path d="M470 420 h260 v270 a40 40 0 0 1 -40 40 h-180 a40 40 0 0 1 -40 -40z" fill="url(#mug)"/>
    <ellipse cx="600" cy="420" rx="130" ry="26" fill="#6e2a12"/>
    <ellipse cx="600" cy="424" rx="112" ry="19" fill="#3b2012"/>
    <path d="M730 470 c95 0 95 170 0 170" fill="none" stroke="#a8452a" stroke-width="34"/>
  </svg>`;
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
  await page.close();
}

async function shoot(tool, locale, theme) {
  const page = await browser.newPage();
  // Lebar tablet: tulisan di kotak tool cukup besar untuk terbaca di kartu kecil.
  await page.setViewport({ width: VIEW, height: 1000 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  const slug = locale === 'id' ? tool.id : tool.en;
  await page.goto(`${url}${locale === 'id' ? '' : '/en'}/tools/${slug}`, {
    waitUntil: 'networkidle0',
  });
  // Scrollbar disembunyikan sejak awal (bukan saat memotret) agar lebar kotak tidak berubah.
  await page.evaluate(() => (document.documentElement.style.scrollbarWidth = 'none'));
  const input = (await page.$('input.peer[type=file]')) ?? (await page.$('input[type=file]'));
  await input.uploadFile(...tool.files.map((f) => path.join(fixtures, f)));
  if (tool.click) {
    const label = tool.click[locale === 'id' ? 0 : 1];
    const btn = await page.waitForSelector(
      `xpath/.//button[normalize-space()="${label}" and not(@disabled)]`,
      { timeout: 30000 },
    );
    await btn.click();
  }
  // Selesai bila ada tombol/tautan unduh dan tidak ada progres berjalan.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('a, button')].some((e) =>
        /^(Unduh|Download)$/.test(e.textContent.trim()),
      ) && !document.querySelector('progress, [role=progressbar]'),
    { timeout: 180000 },
  );
  // Kartu donasi ditutup supaya hasil tool yang terlihat.
  await page.evaluate(() => {
    document.querySelectorAll('button[aria-label]').forEach((b) => {
      if (/tutup|close/i.test(b.getAttribute('aria-label'))) b.click();
    });
    document.activeElement?.blur();
  });
  await new Promise((r) => setTimeout(r, 600));
  // Potong ke kotak tool (dropzone, pilihan, hasil), rasio 4:3.
  const box = await page.evaluate(() => {
    // Kotak tool dari ToolLayout: <section aria-label="..." class="... border ..."> pembungkus dropzone.
    const card = document.querySelector('[data-testid=dropzone]').closest('section[aria-label]');
    // Isi halaman di bawah kotak tool disembunyikan agar tidak ikut terpotong ke gambar.
    let next = card.nextElementSibling;
    for (; next; next = next.nextElementSibling) next.style.visibility = 'hidden';
    document.querySelector('footer')?.style.setProperty('visibility', 'hidden');
    const r = card.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  });
  // Garis tepi kotak tool dipotong; kartu di beranda punya garis tepinya sendiri.
  const pad = -1;
  const width = box.width + pad * 2;
  // Hasil 720 px lebar: atur lewat skala layar (opsi clip.scale tidak andal).
  await page.setViewport({ width: VIEW, height: 1000, deviceScaleFactor: 720 / width });
  await new Promise((r) => setTimeout(r, 300));
  const dir = path.join(OUT, locale);
  fs.mkdirSync(dir, { recursive: true });
  // Rasio 4:3. Kotak tinggi dipotong dari bawah (bagian hasil); kotak pendek tidak diberi sisa
  // kosong, kartu di beranda mengisi sisanya dengan warna latar yang sama.
  const full = Math.round((width * 3) / 4);
  const height = Math.min(full, box.height + pad * 2);
  await page.screenshot({
    path: path.join(dir, `${tool.id}-${theme}.webp`),
    type: 'webp',
    quality: 72,
    clip: { x: box.x - pad, y: box.y - pad + (box.height + pad * 2 - height), width, height },
    captureBeyondViewport: true,
  });
  await page.close();
  console.log(`  ✓ ${locale}/${tool.id}-${theme}`);
}

try {
  await makeObjectPhoto(path.join(fixtures, 'benda.jpg'));
  for (const tool of TOOLS) {
    if (only.length && !only.includes(tool.id)) continue;
    for (const locale of ['id', 'en'])
      for (const theme of ['light', 'dark']) await shoot(tool, locale, theme);
  }
} finally {
  await browser.close();
  server.close();
}
