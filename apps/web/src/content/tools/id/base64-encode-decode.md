---
name: 'Base64 & URL Encode'
title: 'Base64 Encode/Decode, URL Encode, dan Gambar ke Base64'
description: 'Encode dan decode Base64 (UTF-8, URL-safe), encode URL, atau ubah gambar jadi Data URL Base64. Satu halaman, diproses di browser.'
summary: 'Base64, URL encode, dan gambar ke Data URL.'
category: 'developer'
keywords: ['base64 encoder', 'base64 decoder', 'url encode', 'url decode', 'gambar ke base64', 'data url', 'encodeURIComponent']
howTo:
  - 'Pilih tab: Teks ↔ Base64, URL encode, atau Gambar ke Base64.'
  - 'Ketik, tempel, atau tarik gambar. Hasil langsung muncul.'
  - 'Salin hasilnya, atau klik Tukar untuk memproses balik.'
faq:
  - q: 'Apakah Base64 itu enkripsi?'
    a: 'Bukan. Base64 hanya mengubah data menjadi huruf dan angka agar aman dikirim lewat teks. Siapa pun bisa men-decode-nya, jadi jangan dipakai untuk menyembunyikan rahasia.'
  - q: 'Apa itu Base64 URL-safe?'
    a: 'Versi yang mengganti + dengan - dan / dengan _ serta menghapus tanda =, sehingga aman dipakai di URL dan token seperti JWT.'
  - q: 'Apa beda bagian URL dan URL lengkap di tab URL encode?'
    a: 'Bagian URL (encodeURIComponent) meng-encode semua karakter khusus termasuk / ? & =, cocok untuk nilai parameter. URL lengkap (encodeURI) membiarkan struktur URL tetap utuh.'
  - q: 'Kapan memakai gambar Base64?'
    a: 'Untuk ikon dan gambar kecil (di bawah sekitar 10 KB), email HTML, atau data JSON. Base64 sekitar 33% lebih besar dari file aslinya.'
  - q: 'Apakah data saya dikirim ke server?'
    a: 'Tidak. Semua proses berjalan di browser kamu.'
related: ['hash-md5-sha', 'json-formatter', 'buat-qr-code']
---

## Satu tempat untuk encode dan decode

Base64 dipakai di email, header HTTP, token JWT, dan file konfigurasi. URL encoding membuat spasi dan
karakter khusus aman di link. Gambar Base64 memungkinkan ikon kecil disisipkan langsung di CSS atau HTML.
Ketiganya ada di satu halaman ini.
