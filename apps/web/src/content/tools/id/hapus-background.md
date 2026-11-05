---
name: 'Hapus Background'
title: 'Hapus Background Foto Otomatis (AI)'
description: 'Hapus latar belakang foto otomatis dengan AI yang berjalan di browser. Hasil PNG transparan atau latar warna. Foto tidak diunggah ke server.'
summary: 'Latar foto hilang otomatis dengan AI.'
category: 'gambar'
popular: true
keywords: ['remove background', 'hapus latar', 'remove bg', 'background transparan', 'foto produk', 'ganti background']
howTo:
  - 'Pilih atau tarik foto ke kotak di atas.'
  - 'Tunggu AI memisahkan objek dari latar. Pertama kali, model AI diunduh dulu lalu tersimpan di browser.'
  - 'Pilih latar transparan, putih, atau warna lain, lalu unduh hasilnya.'
faq:
  - q: 'Apakah foto saya diunggah ke server?'
    a: 'Tidak. Model AI (ISNet) berjalan langsung di browser kamu memakai WebGPU atau WebAssembly. Foto tidak pernah meninggalkan perangkat.'
  - q: 'Kenapa pertama kali lama?'
    a: 'Model AI berukuran sekitar 44–88 MB diunduh sekali, lalu disimpan di browser. Pemakaian berikutnya langsung memproses tanpa mengunduh lagi.'
  - q: 'Berapa lama prosesnya?'
    a: 'Dengan WebGPU (Chrome atau Edge terbaru), biasanya beberapa detik per foto. Tanpa GPU prosesnya memakai CPU dan bisa lebih lama.'
  - q: 'Bisakah mengganti latar menjadi merah atau biru untuk pas foto?'
    a: 'Bisa. Pilih Warna lain, tentukan warnanya, lalu unduh. Setelah itu potong dengan tool Pas Foto.'
  - q: 'Foto seperti apa yang hasilnya paling bagus?'
    a: 'Objek utama yang jelas dengan kontras cukup terhadap latar, misalnya foto produk, orang, atau hewan.'
related: ['pas-foto', 'kompres-gambar', 'blur-wajah']
---

## Foto produk dan pas foto tanpa aplikasi edit

Latar belakang yang bersih membuat foto produk di marketplace lebih menarik, dan pas foto dengan
latar merah atau biru sering diminta untuk dokumen resmi. AI di Toolland memisahkan objek dari latar
secara otomatis, tanpa perlu memotong manual di aplikasi edit foto.
