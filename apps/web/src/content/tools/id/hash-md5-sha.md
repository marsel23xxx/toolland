---
name: 'Hash MD5 SHA'
title: 'Hash MD5, SHA-1, SHA-256, SHA-512 Online'
description: 'Hitung hash MD5, SHA-1, SHA-256, SHA-384, dan SHA-512 untuk teks atau file, lalu cocokkan checksum. File tidak diunggah ke server.'
summary: 'Hash MD5 dan SHA untuk teks atau file, cek checksum.'
category: 'developer'
keywords: ['md5 generator', 'sha256', 'checksum', 'hash file', 'sha512', 'sha1']
howTo:
  - 'Pilih Teks atau File, lalu ketik teks atau pilih file.'
  - 'Hash MD5, SHA-1, SHA-256, SHA-384, dan SHA-512 dihitung otomatis.'
  - 'Tempel checksum dari situs unduhan untuk memastikan file tidak rusak atau diubah.'
faq:
  - q: 'Apakah file saya diunggah?'
    a: 'Tidak. File dibaca bertahap dan di-hash di browser kamu, jadi file berukuran besar pun tidak pernah meninggalkan perangkat.'
  - q: 'Bagaimana cara memeriksa checksum file unduhan?'
    a: 'Pilih file di tab File, lalu tempel checksum dari situs resmi di kolom Cocokkan dengan hash. Toolland memberi tahu apakah cocok dan dengan algoritma apa.'
  - q: 'Apakah MD5 masih aman?'
    a: 'MD5 dan SHA-1 tidak aman lagi untuk keamanan kriptografis, tapi masih wajar untuk mengecek file rusak. Untuk keamanan, gunakan SHA-256 atau lebih tinggi.'
  - q: 'Apakah hash bisa dikembalikan ke teks asli?'
    a: 'Tidak. Hash adalah fungsi satu arah. Untuk menyimpan password, gunakan algoritma khusus seperti Argon2 atau bcrypt, bukan hash biasa.'
  - q: 'Apakah ada batas ukuran file?'
    a: 'Tidak ada batas tetap. File dibaca per bagian 4 MB, sehingga memori tetap hemat walau file berukuran gigabyte.'
related: ['base64-encode-decode']
---

## Memastikan file tetap utuh

Hash adalah sidik jari digital. Satu bit saja berubah, hasil hash akan berbeda total. Karena itu
hash dipakai untuk memastikan file unduhan, ISO sistem operasi, atau backup tidak rusak.
