---
name: 'Inventaris & Gudang'
title: 'Template Excel Stok Barang & Gudang Gratis: Kartu Stok, Opname, Laporan'
description: 'Template Excel stok barang lengkap: barang masuk-keluar, kartu stok, stok per gudang, stok opname, HPP rata-rata, dan dashboard. Gratis, bisa diatur sebelum diunduh.'
summary: 'Stok barang, mutasi, kartu stok, stok opname, multi gudang, dan dashboard.'
category: 'operasional'
keywords:
  [
    'template excel stok barang',
    'kartu stok excel',
    'aplikasi gudang excel',
    'laporan persediaan barang excel',
    'stok opname excel',
    'barang masuk dan keluar excel',
    'inventory excel gratis',
    'hpp rata-rata excel',
  ]
sheets:
  - name: 'Menu'
    desc: 'Halaman awal berisi langkah mulai dan link ke setiap sheet.'
  - name: 'Dashboard'
    desc: 'Nilai persediaan, barang yang perlu dipesan, pembelian, penjualan, laba kotor, perputaran stok, dan 4 grafik.'
  - name: 'Barang'
    desc: 'Master barang: kode SKU, kategori, harga, stok minimum, lalu stok akhir, HPP rata-rata, nilai stok, status, dan saran pesan otomatis.'
  - name: 'Mutasi'
    desc: 'Jurnal stok: stok awal, barang masuk, keluar, koreksi, dan pindah gudang. Sumber semua angka.'
  - name: 'Kartu Stok'
    desc: 'Pilih satu barang (dan gudang), lalu lihat semua mutasinya dengan saldo berjalan seperti kartu stok fisik.'
  - name: 'Stok per Gudang'
    desc: 'Stok setiap barang di tiap gudang atau lokasi, sampai 6 gudang.'
  - name: 'Stok Opname'
    desc: 'Lembar hitung fisik yang bisa dicetak: stok sistem, stok fisik, selisih, dan nilai selisih.'
  - name: 'Laporan'
    desc: 'Pembelian, penjualan, HPP, laba kotor, koreksi, dan nilai stok per bulan, serta persediaan per kategori.'
  - name: 'Pengaturan'
    desc: 'Nama usaha, tahun, daftar gudang, kategori, satuan, dan pemasok.'
features:
  - 'Stok, nilai stok, dan laporan terhitung otomatis dari satu sheet Mutasi'
  - 'HPP metode rata-rata tertimbang, jadi laba kotor tetap akurat walau harga beli berubah'
  - 'Status Aman, Menipis, dan Habis, plus saran jumlah pesan untuk setiap barang'
  - 'Kartu stok per barang dan per gudang dengan saldo berjalan'
  - 'Sampai 6 gudang atau lokasi, termasuk pindah stok antar gudang'
  - 'Lembar stok opname siap cetak untuk menghitung selisih stok fisik'
  - 'Dashboard dengan 8 kartu angka, 4 grafik, dan daftar barang yang perlu dipesan ulang'
  - 'Bisa dibuka di Microsoft Excel, Google Sheets, WPS Office, dan LibreOffice'
previews:
  - file: 'dashboard'
    caption: 'Dashboard: nilai persediaan, pembelian, penjualan, dan grafik per bulan'
  - file: 'barang'
    caption: 'Barang: stok akhir, HPP rata-rata, nilai stok, dan status terisi otomatis'
  - file: 'kartu-stok'
    caption: 'Kartu stok satu barang dengan saldo berjalan'
  - file: 'laporan'
    caption: 'Laporan bulanan: pembelian, penjualan, HPP, laba kotor, dan nilai stok'
howTo:
  - 'Isi nama usaha, tahun, dan mata uang, lalu sesuaikan daftar gudang, kategori, dan satuan barang.'
  - 'Klik Unduh template. File Excel dibuat langsung di browsermu dalam beberapa detik.'
  - 'Isi daftar barang dan stok awal, lalu catat setiap barang masuk dan keluar. Stok dan laporan terisi sendiri.'
faq:
  - q: 'Apakah template stok barang ini gratis?'
    a: 'Ya, gratis sepenuhnya, tanpa daftar akun dan tanpa watermark. Boleh dipakai untuk usaha sendiri maupun usaha klien.'
  - q: 'Berapa banyak barang dan transaksi yang bisa dicatat?'
    a: 'Sheet Barang menampung 500 barang dan sheet Mutasi 3.000 baris mutasi. Itu cukup untuk setahun pencatatan sebagian besar toko dan gudang kecil. Bila penuh, simpan file sebagai arsip dan mulai file baru dengan stok akhir sebagai stok awal.'
  - q: 'Bagaimana cara menghitung HPP di template ini?'
    a: 'Template memakai metode rata-rata tertimbang: total nilai stok awal dan barang masuk dibagi total jumlahnya. Setiap barang keluar dinilai dengan HPP rata-rata itu, sehingga laba kotor dan nilai stok tetap akurat walau harga beli naik turun.'
  - q: 'Bagaimana mencatat hasil stok opname?'
    a: 'Isi kolom Stok fisik di sheet Stok Opname. Selisihnya muncul otomatis. Lalu catat selisih itu di sheet Mutasi dengan jenis Koreksi tambah (stok fisik lebih banyak) atau Koreksi kurang (barang rusak atau hilang), supaya stok sistem kembali sama dengan stok fisik.'
  - q: 'Bisa dibuka di Google Sheets atau HP?'
    a: 'Bisa. File berformat .xlsx biasa, jadi bisa dibuka di Microsoft Excel, Google Sheets (unggah ke Google Drive lalu buka), WPS Office di HP, dan LibreOffice. Rumus dan dropdown tetap jalan.'
  - q: 'Apakah data stok saya dikirim ke server Toolland?'
    a: 'Tidak. File Excel dibuat di browsermu, dan isian form tidak dikirim ke mana pun. Setelah diunduh, data yang kamu isi hanya ada di file milikmu sendiri.'
---

## Untuk siapa template ini?

Untuk toko, minimarket, online shop, dapur restoran, dan gudang kecil yang ingin tahu **berapa
stok setiap barang, berapa nilainya, dan kapan harus pesan lagi** tanpa membeli aplikasi
inventory. Cukup catat barang masuk dan keluar, sisanya dihitung otomatis.

## Cara kerjanya

Semua angka berasal dari satu sheet **Mutasi**. Setiap baris mencatat satu kejadian: stok awal,
barang masuk dari pemasok, barang keluar (terjual atau dipakai), koreksi hasil opname, atau
pindah gudang. Dari situ template menghitung stok akhir per barang dan per gudang, HPP rata-rata,
nilai persediaan, laba kotor, dan grafik bulanan.

## Bisa diatur sebelum diunduh

Pilih jenis usaha (gudang umum, toko, kuliner, atau online shop) untuk mendapat daftar gudang,
kategori, dan satuan yang cocok, lalu ubah sesuai kebutuhan. Centang **contoh data** untuk melihat
12 barang beserta mutasi setahun penuh sebelum memakai data sendiri.

## Tips agar stok selalu akurat

- Catat barang keluar setiap hari, jangan ditumpuk di akhir bulan.
- Isi stok minimum dengan jumlah yang habis selama barang dipesan sampai datang.
- Lakukan stok opname rutin, misalnya setiap akhir bulan, dan catat selisihnya sebagai koreksi.
