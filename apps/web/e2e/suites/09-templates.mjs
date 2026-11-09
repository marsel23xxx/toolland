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
      const triggers = await h.page.$$('header ul [data-nav-dd] > button');
      expect(triggers.length === 6, `jumlah dropdown ${triggers.length}`);
      // Kursor di atas tombol membuka dropdown, keluar dari area menutupnya.
      await triggers[0].hover();
      await h.page.waitForSelector('header ul [data-nav-dd][data-open]', { timeout: 2000 });
      await h.page.mouse.move(640, 700);
      await h.page.waitForFunction(() => !document.querySelector('header [data-open]'), {
        timeout: 2000,
      });
      // Dropdown PDF berisi kartu tool lengkap dengan keterangan.
      await triggers[1].click();
      expect(
        (await h.page.$eval('header ul [data-open] > button', (b) => b.ariaExpanded)) === 'true',
        'aria-expanded tidak berubah',
      );
      const pdf = await h.page.$$eval('header ul [data-nav-dd][data-open] .nav-tile', (as) =>
        as.map((a) => a.getAttribute('href')),
      );
      expect(pdf.length === 15 && pdf.includes('/tools/gabung-pdf'), pdf.join(', '));
      // Panel tidak boleh keluar dari layar.
      const right = await h.page.$eval('header [data-nav-dd][data-open] .nav-panel', (p) =>
        Math.round(p.getBoundingClientRect().right),
      );
      expect(right <= 1280, `panel melewati layar: ${right}`);
      // Membuka dropdown lain menutup yang pertama.
      await triggers[5].click();
      const open = await h.page.$$eval('header [data-nav-dd][data-open]', (d) => d.length);
      expect(open === 1, `dropdown terbuka: ${open}`);
      const items = await h.page.$$eval('header ul [data-nav-dd][data-open] .nav-tile', (as) =>
        as.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      );
      expect(
        items.some((x) => x.startsWith('Keuangan UMKM')),
        items.join(' | '),
      );
      // Semua template di navbar sudah tersedia (tidak ada label "Segera").
      expect(items.length >= 5 && items.some((x) => x.startsWith('Invoice')), items.join(' | '));
      expect(!items.some((x) => x.includes('Segera')), items.join(' | '));
      await h.page.keyboard.press('Escape');
      expect(
        (await h.page.$$('header [data-nav-dd][data-open]')).length === 0,
        'Esc tidak menutup dropdown',
      );
      await triggers[5].click();
      await Promise.all([
        h.page.waitForNavigation(),
        h.page.click('header ul [data-nav-dd][data-open] a.nav-tile[href$="/keuangan-umkm"]'),
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
      await h.page.click('header [data-mobile] > button');
      await h.page.click('header .nav-acc[data-cat=media] > button');
      const media = await h.page.$$eval('header .nav-acc[data-cat=media] .nav-tile', (as) =>
        as.map((a) => a.getAttribute('href')),
      );
      expect(media.length === 3 && media.includes('/tools/kompres-video'), media.join(', '));
      const acc = await h.page.$eval('header .nav-acc[data-cat=media]', (d) => ({
        expanded: d.querySelector('button').ariaExpanded,
        inert: d.querySelector('.nav-acc-body').inert,
      }));
      expect(acc.expanded === 'true' && !acc.inert, JSON.stringify(acc));
      // Link di dalam accordion bisa diklik dan membuka halaman tool.
      await Promise.all([
        h.page.waitForNavigation(),
        h.page.click('header .nav-acc[data-cat=media] a[href="/tools/kompres-video"]'),
      ]);
      expect(h.page.url().endsWith('/tools/kompres-video'), h.page.url());
    },
  },
  {
    name: 'katalog template: keempat template tersedia',
    path: '/template',
    async run(h) {
      for (const name of [
        'Keuangan UMKM',
        'Inventaris & Gudang',
        'SDM & Penggajian',
        'Keuangan Pribadi',
      ])
        expect(await h.bodyHas(name), `${name} tidak tampil`);
      expect(await h.bodyHas('8 sheet'), 'jumlah sheet tidak tampil');
      const soon = await h.page.$$eval(
        'li',
        (els) => els.filter((e) => e.textContent.includes('Segera hadir')).length,
      );
      expect(soon === 0, `segera hadir: ${soon}`);
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
  {
    name: 'inventaris & gudang: preset kuliner + contoh data lalu unduh .xlsx',
    path: '/template/inventaris-gudang',
    async run(h) {
      await h.type('#inv-business', 'Dapur Bu Sri');
      await h.page.click('label:has(input[value="kuliner"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#inv-warehouses').value.startsWith('Gudang kering'),
      );
      await h.page.click('input[type=checkbox]');
      const summary = await h.page.evaluate(
        () => document.body.innerText.match(/\d+ gudang · \d+ kategori · \d+ satuan/)?.[0],
      );
      expect(summary === '2 gudang · 6 kategori · 7 satuan', summary);
      const name = `Inventaris-Gudang-Dapur-Bu-Sri-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#inv-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Barang|Mutasi|Kartu Stok|Stok per Gudang|Stok Opname|Laporan|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Dapur Bu Sri', 'Gudang kering', 'Ayam potong', 'BRG-001', 'SA-0001'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 4, `grafik: ${x.charts}`);
      await h.page.waitForSelector('[role=status]');
      expect((await h.text('[role=status]')).includes(name), await h.text('[role=status]'));
    },
  },
  {
    name: 'inventory & warehouse (EN): unduh bawaan tanpa contoh',
    path: '/en/templates/inventory-warehouse',
    async run(h) {
      const x = readXlsx(
        await h.downloadVia(`Inventory-Warehouse-${year}.xlsx`, () =>
          h.page.click('#inv-download'),
        ),
      );
      expect(x.sheets.includes('Movements') && x.sheets.includes('Stock Card'), x.sheets.join('|'));
      expect(x.strings.includes('Main warehouse'), 'gudang bawaan tidak ada');
      expect(!x.strings.includes('SKU-001'), 'contoh data ikut padahal tidak dicentang');
    },
  },
  {
    name: 'sdm & penggajian: risiko JKK + contoh data lalu unduh .xlsx',
    path: '/template/sdm-penggajian',
    async run(h) {
      await h.type('#pay-company', 'PT Sinar Jaya');
      await h.page.select('#pay-jkk', '0.89');
      await h.page.click('input[type=checkbox]');
      const name = `SDM-Penggajian-PT-Sinar-Jaya-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#pay-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Karyawan|Penggajian|Slip Gaji|Rekap Bulanan|Rekap Karyawan|Tarif &amp; BPJS|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['PT Sinar Jaya', 'Budi Santoso', 'K-001', 'TK/0', 'Slip Gaji'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
      await h.page.waitForSelector('[role=status]');
      expect((await h.text('[role=status]')).includes(name), await h.text('[role=status]'));
    },
  },
  {
    name: 'hr & payroll (EN): unduh bawaan tanpa contoh',
    path: '/en/templates/hr-payroll',
    async run(h) {
      const x = readXlsx(
        await h.downloadVia(`HR-Payroll-${year}.xlsx`, () => h.page.click('#pay-download')),
      );
      expect(x.sheets.includes('Payroll') && x.sheets.includes('Payslip'), x.sheets.join('|'));
      expect(x.strings.includes('Your Company Name'), 'nama perusahaan bawaan tidak ada');
      expect(!x.strings.includes('E-001'), 'contoh data ikut padahal tidak dicentang');
    },
  },
  {
    name: 'keuangan pribadi: profil keluarga + contoh data lalu unduh .xlsx',
    path: '/template/keuangan-pribadi',
    async run(h) {
      await h.type('#per-name', 'Keluarga Andi');
      await h.page.click('label:has(input[value="keluarga"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#per-income').value.startsWith('Gaji utama'),
      );
      await h.page.click('input[type=checkbox]');
      const summary = await h.page.evaluate(
        () =>
          document.body.innerText.match(
            /\d+ dompet · \d+ kategori pemasukan · \d+ kategori pengeluaran/,
          )?.[0],
      );
      expect(summary === '3 dompet · 4 kategori pemasukan · 13 kategori pengeluaran', summary);
      const name = `Keuangan-Pribadi-Keluarga-Andi-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#per-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Transaksi|Anggaran|Laporan Tahunan|Target Tabungan|Utang &amp; Cicilan|Kekayaan Bersih|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Keluarga Andi', 'Belanja dapur', 'Kebutuhan', 'Dana darurat', 'KPR rumah'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
      await h.page.waitForSelector('[role=status]');
      expect((await h.text('[role=status]')).includes(name), await h.text('[role=status]'));
    },
  },
  {
    name: 'personal finance (EN): unduh bawaan tanpa contoh',
    path: '/en/templates/personal-finance',
    async run(h) {
      expect((await h.value('#per-currency')) === 'USD', await h.value('#per-currency'));
      const x = readXlsx(
        await h.downloadVia(`Personal-Finance-${year}.xlsx`, () => h.page.click('#per-download')),
      );
      expect(
        x.sheets.includes('Savings Goals') && x.sheets.includes('Net Worth'),
        x.sheets.join('|'),
      );
      expect(x.strings.includes('Your Name'), 'nama bawaan tidak ada');
      expect(!x.strings.includes('Emergency fund'), 'contoh data ikut padahal tidak dicentang');
    },
  },
  {
    name: 'invoice & penawaran: form generik, contoh data, unduh .xlsx',
    path: '/template/invoice-penawaran',
    async run(h) {
      await h.type('#tf-business', 'Studio Nusa');
      await h.page.click('input[type=checkbox]');
      const name = `Invoice-Penawaran-Studio-Nusa-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Cetak|Dokumen|Rincian|Pelanggan|Produk|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Studio Nusa', 'PT Sinar Abadi', 'DSN-LOGO', 'Penawaran', 'sebelas'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
      await h.page.waitForSelector('[role=status]');
      expect((await h.text('[role=status]')).includes(name), await h.text('[role=status]'));
    },
  },
  {
    name: 'invoices & quotes (EN): unduh bawaan dengan produk dari form',
    path: '/en/templates/invoices-quotes',
    async run(h) {
      const x = readXlsx(
        await h.downloadVia(`Invoices-Quotes-${year}.xlsx`, () => h.page.click('#tf-download')),
      );
      expect(x.sheets.includes('Print') && x.sheets.includes('Line Items'), x.sheets.join('|'));
      expect(x.strings.includes('Logo design'), 'produk dari form tidak ada');
      expect(!x.strings.includes('Brightline Ltd'), 'contoh data ikut padahal tidak dicentang');
    },
  },
  {
    name: 'rab proyek: jenis proyek bangun rumah lalu unduh .xlsx',
    path: '/template/rab-proyek',
    async run(h) {
      await h.type('#tf-project', 'Rumah Pak Budi');
      await h.page.click('label:has(input[value="bangun"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#tf-sections').value.includes('Pekerjaan Plafon'),
      );
      const name = 'RAB-Rumah-Pak-Budi.xlsx';
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Rekapitulasi|RAB|Analisa Harga|Harga Dasar|Realisasi|Kurva S|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Rumah Pak Budi', 'Pekerjaan Plafon', 'Semen PC 50 kg', 'AN-06'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
    },
  },
];
