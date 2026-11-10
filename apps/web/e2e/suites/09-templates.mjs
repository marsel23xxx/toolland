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

/** Tunggu pratinjau dokumen selesai dirender dan kembalikan jumlah halamannya. */
async function docPages(h) {
  await h.page.waitForFunction(
    () => document.querySelectorAll('[data-doc-preview] canvas').length > 0,
    { timeout: 30000 },
  );
  await h.sleep(800);
  await h.page.waitForFunction(() => !document.body.innerText.includes('Memperbarui'), {
    timeout: 30000,
  });
  return h.page.$$eval('[data-doc-preview] canvas', (c) => c.length);
}

const docxText = (buf) => strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']);

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
      // Hanya format PPT yang masih "Segera"; template dokumen dan Excel sudah tersedia.
      const soonItems = items.filter((x) => x.includes('Segera'));
      expect(soonItems.length === 1 && soonItems[0].startsWith('PPT'), soonItems.join(' | '));
      for (const doc of [
        'Surat Lamaran Kerja',
        'CV ATS',
        'CV Profesional',
        'Surat Resign',
        'Surat Kuasa',
        'Kwitansi',
      ])
        expect(
          items.some((x) => x.startsWith(doc)),
          `${doc} tidak ada di navbar`,
        );
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
      expect(media.length === 4 && media.includes('/tools/kompres-video'), media.join(', '));
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
  {
    name: 'jadwal proyek: jenis acara + tim, unduh .xlsx',
    path: '/template/jadwal-proyek',
    async run(h) {
      await h.type('#tf-project', 'Festival Kopi');
      await h.page.click('label:has(input[value="acara"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#tf-phases').value.startsWith('Konsep & anggaran'),
      );
      await h.type('#tf-team', 'Ani\nBima');
      const name = 'Jadwal-Proyek-Festival-Kopi.xlsx';
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') === 'Menu|Dashboard|Tugas|Gantt|Beban Kerja|Tim|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Festival Kopi', 'Vendor &amp; venue', 'Bima'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
    },
  },
  {
    name: 'kasir & penjualan: toko kelontong, unduh .xlsx',
    path: '/template/kasir-penjualan',
    async run(h) {
      await h.type('#tf-shop', 'Toko Berkah');
      await h.page.click('label:has(input[value="toko"])');
      await h.page.waitForFunction(() =>
        document.querySelector('#tf-products').value.startsWith('Beras 5 kg'),
      );
      const name = `Kasir-Penjualan-Toko-Berkah-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Penjualan|Rekap Harian|Rekap Produk|Laporan Bulanan|Produk|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Toko Berkah', 'Beras 5 kg', 'Sembako', 'QRIS'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 4, `grafik: ${x.charts}`);
    },
  },
  {
    name: 'kas rt: daftar warga dari form, unduh .xlsx',
    path: '/template/kas-rt',
    async run(h) {
      await h.type('#tf-org', 'RT 07 Melati');
      await h.type('#tf-members', 'Budi | A-1\nSari | A-2');
      const name = `Kas-RT-RT-07-Melati-${year}.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Iuran|Kas|Laporan Bulanan|Anggota|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['RT 07 Melati', 'Budi', 'A-2', 'Keamanan'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
    },
  },
  {
    name: 'nilai siswa: kelas dan siswa dari form, unduh .xlsx',
    path: '/template/nilai-siswa',
    async run(h) {
      await h.type('#tf-subject', 'Biologi');
      await h.type('#tf-students', 'Citra | VII A\nDoni | VII B');
      const name = `Nilai-Siswa-Biologi.xlsx`;
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Nilai|Rapor Siswa|Rekap Kelas|Siswa|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Biologi', 'Citra', 'VII C', 'Remedial'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
    },
  },
  {
    name: 'rencana pernikahan: nama berdua dan tamu, unduh .xlsx',
    path: '/template/rencana-pernikahan',
    async run(h) {
      await h.type('#tf-partner1', 'Julian');
      await h.type('#tf-partner2', 'Ayudiyah');
      await h.type('#tf-guests', 'Keluarga Budi | Keluarga pria | 4');
      const name = 'Rencana-Pernikahan-Julian.xlsx';
      const x = readXlsx(await h.downloadVia(name, () => h.page.click('#tf-download')));
      expect(
        x.sheets.join('|') ===
          'Menu|Dashboard|Anggaran|Pembayaran|Tamu|Checklist|Pengaturan|_Daftar',
        x.sheets.join('|'),
      );
      for (const s of ['Julian', 'Ayudiyah', 'Keluarga Budi', 'Booking gedung / venue'])
        expect(x.strings.includes(s), `teks "${s}" tidak ada di file`);
      expect(x.charts === 3, `grafik: ${x.charts}`);
    },
  },
  {
    name: 'katalog template: tab format Dokumen dan Excel',
    path: '/template',
    async run(h) {
      const visible = () =>
        h.page.$$eval('li[data-fmt]', (els) =>
          els.filter((e) => !e.hidden).map((e) => e.dataset.fmt),
        );
      const all = await visible();
      expect(all.includes('dokumen') && all.includes('excel'), all.join(','));
      await h.page.click('[data-fmt-tab=dokumen]');
      const docs = await visible();
      expect(docs.length === 9 && docs.every((x) => x === 'dokumen'), docs.join(','));
      expect(h.page.url().endsWith('/template?format=dokumen'), h.page.url());
      expect(await h.bodyHas('PDF + Word'), 'label format dokumen tidak tampil');
      await h.page.click('[data-fmt-tab=excel]');
      const xl = await visible();
      expect(xl.length === 11 && xl.every((x) => x === 'excel'), xl.join(','));
      // Tab dibuka langsung dari URL.
      await h.page.goto(h.page.url().replace('format=excel', 'format=dokumen'));
      expect((await visible()).length === 9, 'filter dari URL tidak diterapkan');
    },
  },
  {
    name: 'surat lamaran: pratinjau, simpan isian, unduh PDF dan Word',
    path: '/template/surat-lamaran-kerja',
    async run(h) {
      expect((await docPages(h)) === 1, 'pratinjau contoh bukan 1 halaman');
      await h.type('#df-name', 'Budi Santoso');
      await h.type('#df-position', 'Desainer Grafis');
      await h.type('#df-company', 'CV Kreasi Mandiri');
      await docPages(h);
      const pdf = await h.downloadVia('Surat-Lamaran-Budi-Santoso.pdf', () =>
        h.page.click('[data-doc-pdf]'),
      );
      expect(pdf.subarray(0, 5).toString() === '%PDF-', 'bukan file PDF');
      const xml = docxText(
        await h.downloadVia('Surat-Lamaran-Budi-Santoso.docx', () =>
          h.page.click('[data-doc-docx]'),
        ),
      );
      for (const t of ['Budi Santoso', 'Desainer Grafis di CV Kreasi Mandiri', 'Dengan hormat,'])
        expect(xml.includes(t), `teks "${t}" tidak ada di Word`);
      // Ganti bahasa: paragraf contoh ikut berganti, isian sendiri tetap.
      await h.page.select('#df-lang', 'en');
      await h.page.waitForFunction(() =>
        document.querySelector('#df-opening').value.startsWith('I am writing'),
      );
      expect((await h.value('#df-name')) === 'Budi Santoso', 'nama hilang saat ganti bahasa');
      // Surat terlalu panjang memunculkan peringatan.
      await h.type('#df-body', 'Kalimat panjang untuk menguji. '.repeat(160));
      await h.page.waitForSelector('[data-doc-long]', { timeout: 30000 });
      // Isian tersimpan di browser setelah halaman dimuat ulang.
      await h.sleep(700);
      await h.page.reload({ waitUntil: 'networkidle0' });
      await h.page.waitForFunction(
        () => document.querySelector('#df-name')?.value === 'Budi Santoso',
        {
          timeout: 15000,
        },
      );
      // Isi contoh mengembalikan teks awal.
      await h.page.click('[data-doc-sample]');
      await h.page.waitForFunction(
        () => document.querySelector('#df-name').value === 'Julian Marcell',
      );
    },
  },
  {
    name: 'CV ATS dan CV profesional: data dipakai bersama, foto masuk ke file',
    path: '/template/cv-ats',
    async run(h) {
      await docPages(h);
      await h.type('#df-name', 'Sari Wulandari');
      await h.page.click('[data-doc-section=experience] summary');
      await h.page.click('[data-doc-add=experience]');
      await h.type('#df-experience-2-role', 'Kasir');
      await h.type('#df-experience-2-company', 'Toko Sinar');
      await docPages(h);
      const xml = docxText(
        await h.downloadVia('CV-ATS-Sari-Wulandari.docx', () => h.page.click('[data-doc-docx]')),
      );
      expect(xml.includes('Sari Wulandari'), 'nama tidak ada');
      expect(
        xml.includes('Pengalaman Kerja') && xml.includes('Toko Sinar'),
        'pengalaman baru tidak ada',
      );
      expect(!xml.includes('w:drawing'), 'CV ATS tidak boleh berisi gambar');
      await h.sleep(700);
      await h.page.goto(h.page.url().replace('/cv-ats', '/cv-profesional'), {
        waitUntil: 'networkidle0',
      });
      await h.page.waitForFunction(
        () => document.querySelector('#df-name')?.value === 'Sari Wulandari',
        { timeout: 15000 },
      );
      const input = await h.page.$('[data-doc-image=photo]');
      await input.uploadFile(h.fixture('foto.jpg'));
      await h.page.waitForSelector('[data-doc-section=me] img', { timeout: 15000 });
      await docPages(h);
      const files = unzipSync(
        new Uint8Array(
          await h.downloadVia('CV-Sari-Wulandari.docx', () => h.page.click('[data-doc-docx]')),
        ),
      );
      expect(!!files['word/media/image1.png'], Object.keys(files).join(','));
      const pdf = await h.downloadVia('CV-Sari-Wulandari.pdf', () =>
        h.page.click('[data-doc-pdf]'),
      );
      expect(pdf.includes('/Image'), 'foto tidak ada di PDF');
    },
  },
  {
    name: 'resignation letter (EN): hari terakhir otomatis',
    path: '/en/templates/resignation-letter',
    async run(h) {
      await docPages(h);
      await h.type('#df-date', '2026-11-10');
      await docPages(h);
      const xml = docxText(
        await h.downloadVia('Resignation-Letter-Julian-Marcell.docx', () =>
          h.page.click('[data-doc-docx]'),
        ),
      );
      expect(xml.includes('December 10, 2026'), 'hari terakhir otomatis tidak ada');
      expect(xml.includes('Sincerely,'), 'salam penutup tidak ada');
    },
  },
  {
    name: 'surat kuasa: preset keperluan mengisi ulang teks yang belum diubah',
    path: '/template/surat-kuasa',
    async run(h) {
      await docPages(h);
      await h.page.select('#df-type', 'ijazah');
      await h.page.waitForFunction(() =>
        document.querySelector('#df-purpose').value.startsWith('Untuk mengambil ijazah'),
      );
      // Teks yang sudah diubah sendiri tidak ditimpa preset.
      await h.type('#df-purpose', 'Untuk mengambil rapor adik saya.');
      await h.page.select('#df-type', 'paket');
      await h.sleep(300);
      expect(
        (await h.value('#df-purpose')) === 'Untuk mengambil rapor adik saya.',
        'teks sendiri tertimpa preset',
      );
      await docPages(h);
      const xml = docxText(
        await h.downloadVia('Surat-Kuasa-Julian-Marcell.docx', () =>
          h.page.click('[data-doc-docx]'),
        ),
      );
      for (const t of ['SURAT KUASA', 'Ayudiyah Pratiwi', 'rapor adik saya', 'w:val="dashed"'])
        expect(xml.includes(t), `"${t}" tidak ada di Word`);
    },
  },
  {
    name: 'kwitansi: terbilang otomatis dan meterai di atas Rp5 juta',
    path: '/template/kwitansi',
    async run(h) {
      await docPages(h);
      await h.type('#df-amount', '7.250.000');
      await docPages(h);
      const xml = docxText(
        await h.downloadVia('Kwitansi-Ayudiyah-Pratiwi.docx', () =>
          h.page.click('[data-doc-docx]'),
        ),
      );
      for (const t of ['Tujuh juta dua ratus lima puluh ribu rupiah', 'Rp7.250.000,-', 'Meterai'])
        expect(xml.includes(t), `"${t}" tidak ada di Word`);
      // A5 mendatar: lebar halaman 11906 twip, tinggi 8391.
      expect(xml.includes('w:h="8391"'), 'ukuran halaman bukan A5 mendatar');
    },
  },
];
