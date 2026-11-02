---
name: 'Base64'
title: 'Base64 Encode dan Decode Online'
description: 'Encode teks ke Base64 atau decode Base64 ke teks, mendukung UTF-8 dan format URL-safe. Gratis, instan, dan diproses di browser.'
summary: 'Encode dan decode Base64, mendukung UTF-8 dan URL-safe.'
category: 'developer'
keywords: ['base64 encoder', 'base64 decoder', 'base64 url safe', 'decode base64']
howTo:
  - 'Pilih Encode atau Decode.'
  - 'Ketik atau tempel teks. Hasil langsung muncul di kolom kanan.'
  - 'Salin hasilnya, atau klik Tukar untuk memproses balik.'
faq:
  - q: 'Apakah Base64 itu enkripsi?'
    a: 'Bukan. Base64 hanya mengubah data menjadi huruf dan angka agar aman dikirim lewat teks. Siapa pun bisa men-decode-nya, jadi jangan dipakai untuk menyembunyikan rahasia.'
  - q: 'Apa itu Base64 URL-safe?'
    a: 'Versi yang mengganti + dengan - dan / dengan _ serta menghapus tanda =, sehingga aman dipakai di URL dan token seperti JWT.'
  - q: 'Apakah emoji dan huruf non-Latin didukung?'
    a: 'Ya. Teks diubah ke UTF-8 terlebih dahulu, sehingga emoji dan huruf seperti é atau 日本 tetap utuh setelah di-decode.'
  - q: 'Kenapa muncul pesan Base64 tidak valid?'
    a: 'Input mengandung karakter di luar alfabet Base64, panjangnya tidak sesuai, atau hasil decode bukan teks UTF-8, misalnya data gambar.'
related: ['url-encode-decode', 'hash-md5-sha', 'json-formatter']
---

## Di mana Base64 dipakai?

Base64 dipakai untuk menyisipkan data di email, header HTTP Basic Auth, token JWT, dan file
konfigurasi. Alat ini membantu membaca dan membuat nilai Base64 dengan cepat saat debugging.
