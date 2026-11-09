// Template Excel: navbar dropdown, katalog, dan unduhan .xlsx yang dibuat di browser.
import { strFromU8, unzipSync } from 'fflate';
import { expect } from '../expect.mjs';

const year = new Date().getFullYear();

/** Isi file .xlsx: nama sheet dan semua teks (shared strings). */
function readXlsx(buf) {
  const files = unzipSync(new Uint8Array(buf));
  const wb = strFromU8(files['xl/workbook.xml']);
  return {
    sheets: [...wb.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]),
    strings: strFromU8(files['xl/sharedStrings.xml']),
    charts: Object.keys(files).filter((k) => k.startsWith('xl/charts/')).length,
  };
}

export const tests = [
  {
    name: 'navbar: dropdown per kategori dan Template',
    path: '/',
    async run(h) {
      const triggers = await h.page.$$('header ul details[data-nav-dd] > summary');
      expect(triggers.length === 6, `jumlah dropdown ${triggers.length}`);
      // Dropdown PDF berisi kartu tool lengkap dengan keterangan.
      await triggers[1].click();
      const pdf = await h.page.$$eval('header ul details[open] .nav-tile', (as) =>
        as.map((a) => a.getAttribute('href')),
      );
      expect(pdf.length === 15 && pdf.includes('/tools/gabung-pdf'), pdf.join(', '));
      // Panel tidak boleh keluar dari layar.
      const right = await h.page.$eval('header details[open] .nav-panel', (p) =>
        Math.round(p.getBoundingClientRect().right),
      );
      expect(right <= 1280, `panel melewati layar: ${right}`);
      // Membuka dropdown lain menutup yang pertama.
      await triggers[5].click();
      const open = await h.page.$$eval('header details[open]', (d) => d.length);
      expect(open === 1, `dropdown terbuka: ${open}`);
      const items = await h.page.$$eval('header ul details[open] .nav-tile', (as) =>
        as.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      );
      expect(items[0].startsWith('Keuangan UMKM'), items.join(' | '));
      expect(items.filter((x) => x.includes('Segera')).length === 3, items.join(' | '));
      await h.page.keyboard.press('Escape');
      expect((await h.page.$$('header details[open]')).length === 0, 'Esc tidak menutup dropdown');
      await triggers[5].click();
      await Promise.all([
        h.page.waitForNavigation(),
        h.page.click('header ul details[open] a.nav-tile[href$="/keuangan-umkm"]'),
      ]);
      const url = h.page.url();
      expect(url.endsWith('/template/keuangan-umkm'), url);
    },
  },
  {
    name: 'navbar HP: accordion kategori',
    path: '/',
    async run(h) {
      await h.page.setViewport({ width: 390, height: 844 });
      await h.page.click('header nav > details > summary');
      await h.page.click('header details.nav-acc[data-cat=media] > summary');
      const media = await h.page.$$eval('header details.nav-acc[open] .nav-tile', (as) =>
        as.map((a) => a.getAttribute('href')),
      );
      expect(media.length === 3 && media.includes('/tools/kompres-video'), media.join(', '));
    },
  },
  {
    name: 'katalog template: tersedia dan segera hadir',
    path: '/template',
    async run(h) {
      expect(await h.bodyHas('Keuangan UMKM'), 'template keuangan tidak tampil');
      expect(await h.bodyHas('8 sheet'), 'jumlah sheet tidak tampil');
      const soon = await h.page.$$eval(
        'li',
        (els) => els.filter((e) => e.textContent.includes('Segera hadir')).length,
      );
      expect(soon === 3, `segera hadir: ${soon}`);
    },
  },
  {
    name: 'keuangan umkm: atur lalu unduh .xlsx',
    path: '/template/keuangan-umkm',
    async run(h) {
      await h.type('#fin-business', 'Warung Bu Sri');
      await h.page.click('label:has(input[value="kuliner"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#fin-income').value.startsWith('Penjualan makan di tempat'),
      );
      await h.type('#fin-accounts', 'Kas laci\nBank BRI');
      await h.page.click('input[type=checkbox]');
      const summary = await h.page.evaluate(
        () =>
          document.body.innerText.match(
            /\d+ akun · \d+ kategori pemasukan · \d+ kategori pengeluaran/,
          )?.[0],
      );
      expect(summary === '2 akun · 4 kategori pemasukan · 11 kategori pengeluaran', summary);
      const name = `Keuangan-UMKM-Warung-Bu-Sri-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#fin-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Transaksi|Piutang|Utang|Anggaran|Laba Rugi|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of [
        'Warung Bu Sri',
        'Kas laci',
        'Bank BRI',
        'Bahan baku',
        'Pindah dana antar akun',
        'TRX-0001',
      ])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
      await h.page.waitForSelector('[role=status]');
      expect((await h.text('[role=status]')).includes(name), await h.text('[role=status]'));
    },
  },
  {
    name: 'small business finance (EN): unduh tanpa nama usaha',
    path: '/en/templates/small-business-finance',
    async run(h) {
      expect((await h.value('#fin-currency')) === 'USD', await h.value('#fin-currency'));
      const x = readXlsx(
        await h.downloadVia(`Small-Business-Finance-${year}.xlsx`, () =>
          h.page.click('#fin-download'),
        ),
      );
      expect(
        x.sheets.includes('Transactions') && x.sheets.includes('Profit and Loss'),
        x.sheets.join('|'),
      );
      expect(x.strings.includes('Your Business Name'), 'nama usaha bawaan tidak ada');
      expect(!x.strings.includes('TRX-0001'), 'contoh data ikut padahal tidak dicentang');
    },
  },
];
