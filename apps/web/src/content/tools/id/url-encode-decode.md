---
name: 'URL Encode'
title: 'URL Encode dan Decode Online'
description: 'Encode teks agar aman dipakai di URL dan query string, atau decode URL yang berisi %20 dan sejenisnya. Gratis dan langsung di browser.'
summary: 'Encode dan decode teks untuk URL dan query string.'
category: 'developer'
keywords: ['url encoder', 'url decoder', 'percent encoding', 'encodeURIComponent']
howTo:
  - 'Pilih Encode atau Decode.'
  - 'Ketik atau tempel teks atau URL. Hasil langsung muncul.'
  - 'Salin hasilnya untuk dipakai di link atau kode.'
faq:
  - q: 'Apa beda bagian URL dan URL lengkap?'
    a: 'Mode bagian URL (encodeURIComponent) meng-encode semua karakter khusus termasuk / ? & =, cocok untuk nilai parameter. Mode URL lengkap (encodeURI) membiarkan karakter struktur URL tetap utuh.'
  - q: 'Kenapa spasi menjadi %20 atau +?'
    a: 'Standar URL memakai %20 untuk spasi. Form HTML lama memakai +. Saat decode, aktifkan opsi Anggap + sebagai spasi untuk data dari form.'
  - q: 'Kenapa decode gagal?'
    a: 'Ada tanda % yang tidak diikuti dua digit heksadesimal yang valid, misalnya %G1 atau % di akhir teks.'
  - q: 'Apakah data saya dikirim ke server?'
    a: 'Tidak. Proses encode dan decode berjalan di browser kamu.'
related: ['base64-encode-decode', 'regex-tester', 'buat-qr-code']
---

## Kenapa URL perlu di-encode?

URL hanya boleh berisi karakter tertentu. Spasi, huruf beraksen, dan tanda seperti & atau =
di dalam nilai parameter harus diubah ke format persen (%) agar link tidak rusak.
