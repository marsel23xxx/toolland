// Uji end-to-end di Chrome headless dengan build produksi (pnpm build dulu).
// Pemakaian: pnpm e2e            -> semua suite
//            pnpm e2e pdf image  -> suite tertentu
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { expect } from './expect.mjs';
import { makeFixtures } from './fixtures.mjs';
import { startServer } from './server.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.resolve(HERE, '../dist');
const NGINX = path.resolve(HERE, '../../../infra/nginx/web.conf');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist belum ada, jalankan pnpm build dulu');
  process.exit(1);
}

const wanted = process.argv.slice(2);
const suiteFiles = fs
  .readdirSync(path.join(HERE, 'suites'))
  .filter((f) => f.endsWith('.mjs'))
  .sort();
const fixtures = await makeFixtures();
const downloads = fs.mkdtempSync(path.join(fixtures, 'dl-'));
const { server, url } = await startServer(DIST, NGINX);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  // Mikrofon palsu (nada uji) tanpa dialog izin, untuk uji rekam narasi.
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Konteks untuk setiap tes: halaman baru, pencatat masalah (CSP, error console), dan helper. */
async function context(urlPath) {
  // Context baru per tes (seperti jendela incognito): izin dan batas unduhan tidak terbawa antar-tes.
  // Folder unduhan sendiri per tes agar file bernama sama dari tes lain tidak tertimpa/terhitung.
  const dlDir = fs.mkdtempSync(path.join(downloads, 't-'));
  const ctx = await browser.createBrowserContext({
    downloadBehavior: { policy: 'allow', downloadPath: dlDir },
  });
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const problems = [];
  page.on('console', (m) => {
    // MediaPipe/TFLite menulis log informasi (INFO:, W0000 ...) lewat console.error; itu bukan error.
    if (m.type() === 'error' && !/^(INFO|WARNING|[IW]\d{4})[: ]/.test(m.text()))
      problems.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.evaluateOnNewDocument(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP ${e.violatedDirective} ${e.blockedURI} @${e.sourceFile}:${e.lineNumber}`),
    ),
  );
  await ctx.overridePermissions(url, [
    'clipboard-read',
    'clipboard-write',
    'clipboard-sanitized-write',
  ]);
  await page.goto(url + urlPath, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => [...document.querySelectorAll('astro-island')].every((i) => !i.hasAttribute('ssr')),
    { timeout: 15000 },
  );

  const h = {
    page,
    problems,
    sleep,
    fixture: (name) => path.join(fixtures, name),
    downloads: dlDir,
    async upload(...names) {
      // Kotak upload utama (Dropzone) diutamakan; tool bisa punya input file lain.
      const input = (await page.$('input.peer[type=file]')) ?? (await page.$('input[type=file]'));
      await input.uploadFile(...names.map(h.fixture));
    },
    async type(selector, value) {
      await page.$eval(
        selector,
        (e, v) => {
          e.value = v;
          e.dispatchEvent(new Event('input', { bubbles: true }));
          e.dispatchEvent(new Event('change', { bubbles: true }));
        },
        value,
      );
    },
    async click(text) {
      await page.waitForFunction(
        (t) =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent.trim() === t && !b.disabled,
          ),
        { timeout: 30000 },
        text,
      );
      await page.evaluate(
        (t) =>
          [...document.querySelectorAll('button')]
            .find((b) => b.textContent.trim() === t && !b.disabled)
            .click(),
        text,
      );
    },
    value: (selector) => page.$eval(selector, (e) => e.value),
    text: (selector) => page.$eval(selector, (e) => e.innerText.replace(/\s+/g, ' ').trim()),
    bodyHas: (s) => page.evaluate((x) => document.body.innerText.includes(x), s),
    /** Kartu hasil (punya tombol hapus berlabel), tanpa kartu "Cara pakai". */
    async results(n, timeout = 60000) {
      await page.waitForFunction(
        (n) => {
          const cards = [...document.querySelectorAll('li.card')].filter((c) =>
            c.querySelector('button[aria-label^="Hapus"], button[aria-label^="Remove"]'),
          );
          return (
            cards.length >= n &&
            cards.every((c) => !c.querySelector('progress, [role=progressbar]'))
          );
        },
        { timeout },
        n,
      );
      return page.$$eval('li.card', (els) =>
        els
          .filter((c) =>
            c.querySelector('button[aria-label^="Hapus"], button[aria-label^="Remove"]'),
          )
          .map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
      );
    },
    /** Unduh file hasil dengan nama tertentu lalu kembalikan isinya. */
    async download(name) {
      await page.waitForSelector(`a[download="${name}"]`, { timeout: 60000 });
      return h.downloadVia(name, () => page.$eval(`a[download="${name}"]`, (a) => a.click()));
    },
    /** Jalankan aksi yang memicu unduhan (misalnya klik tombol), lalu kembalikan isi file.
     *  `name` boleh berupa RegExp untuk nama yang memuat waktu. */
    async downloadVia(name, action) {
      const before = new Set(fs.readdirSync(dlDir));
      await action();
      for (let i = 0; i < 150; i++) {
        const f = fs.readdirSync(dlDir).find((x) => !before.has(x) && !x.endsWith('.crdownload'));
        if (f) {
          const ok = name instanceof RegExp ? name.test(f) : f === name;
          expect(ok, `nama unduhan ${f}, seharusnya ${name}`);
          return fs.readFileSync(path.join(dlDir, f));
        }
        await sleep(100);
      }
      throw new Error(`unduhan ${name} tidak muncul`);
    },
  };
  return h;
}

let failed = 0;
let passed = 0;
for (const file of suiteFiles) {
  const suite = file.replace(/^\d+-|\.mjs$/g, '');
  if (wanted.length && !wanted.includes(suite)) continue;
  const { tests } = await import(path.join(HERE, 'suites', file));
  console.log(`\n# ${suite}`);
  for (const t of tests) {
    const started = Date.now();
    let h;
    try {
      h = await context(t.path);
      const notes = (await t.run(h)) ?? [];
      if (h.problems.length)
        throw new Error(`masalah di console/CSP:\n      ${h.problems.join('\n      ')}`);
      passed++;
      console.log(
        `  ✓ ${t.name} (${((Date.now() - started) / 1000).toFixed(1)} dtk)${notes.length ? `\n      ${notes.join('\n      ')}` : ''}`,
      );
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.name}\n      ${e.message.split('\n').join('\n      ')}`);
      if (h)
        await h.page
          .screenshot({ path: path.join(fixtures, `gagal-${t.name.replace(/\W+/g, '-')}.png`) })
          .catch(() => {});
    } finally {
      await h?.page
        .browserContext()
        .close()
        .catch(() => {});
    }
  }
}

await browser.close();
server.close();
console.log(`\n${passed} lulus, ${failed} gagal${failed ? ` (screenshot di ${fixtures})` : ''}`);
if (!failed) fs.rmSync(fixtures, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
