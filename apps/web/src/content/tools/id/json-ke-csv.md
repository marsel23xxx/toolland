---
name: 'JSON ke CSV'
title: 'Konversi JSON ke CSV dan CSV ke JSON'
description: 'Ubah JSON ke CSV untuk Excel atau Google Sheets, dan sebaliknya. Mendukung pemisah koma, titik koma, dan tab. Diproses di browser.'
summary: 'Konversi JSON ke CSV untuk Excel, dan sebaliknya.'
category: 'developer'
keywords: ['json to csv', 'csv to json', 'json excel', 'konversi csv']
howTo:
  - 'Pilih arah konversi: JSON ke CSV atau CSV ke JSON.'
  - 'Tempel data atau klik Buka file untuk memilih file .json atau .csv.'
  - 'Salin hasilnya atau unduh sebagai file baru.'
faq:
  - q: 'Kenapa CSV saya berantakan saat dibuka di Excel?'
    a: 'Excel dengan pengaturan Indonesia biasanya memakai titik koma sebagai pemisah. Pilih pemisah Titik koma (;) sebelum mengunduh agar kolom terbaca dengan benar.'
  - q: 'Bagaimana dengan JSON bertingkat?'
    a: 'Objek bertingkat diratakan menjadi kolom bertitik, misalnya alamat.kota. Array disimpan sebagai teks JSON di dalam satu sel.'
  - q: 'Apakah tipe data dikenali saat CSV diubah ke JSON?'
    a: 'Ya. Angka dan nilai true/false otomatis menjadi angka dan boolean, bukan teks.'
  - q: 'Apakah file saya diunggah?'
    a: 'Tidak. File dibaca dan dikonversi di browser kamu, tidak ada yang dikirim ke server.'
related: ['json-formatter', 'bandingkan-teks', 'hash-md5-sha']
---

## Jembatan antara API dan spreadsheet

Data dari API biasanya berbentuk JSON, sedangkan tim keuangan atau operasional lebih nyaman
dengan Excel. Alat ini mengubah keduanya bolak-balik tanpa perlu menulis skrip.
