---
name: 'Regex Tester'
title: 'Regex Tester Online (JavaScript)'
description: 'Uji regular expression JavaScript dengan sorotan kecocokan, grup tangkapan, dan fitur ganti teks. Aman dari regex yang membuat browser macet.'
summary: 'Uji regular expression dengan sorotan dan grup.'
category: 'developer'
keywords: ['regex', 'regular expression', 'regexp tester', 'regex javascript', 'uji regex']
howTo:
  - 'Tulis pola regex dan pilih flag yang dibutuhkan.'
  - 'Tempel teks uji. Kecocokan langsung disorot beserta grup tangkapannya.'
  - 'Aktifkan Ganti dengan untuk mencoba penggantian teks memakai $1 atau $<nama>.'
faq:
  - q: 'Regex versi apa yang dipakai?'
    a: 'Regex JavaScript (ECMAScript) bawaan browser, sama persis dengan yang dipakai di kode JavaScript dan TypeScript kamu.'
  - q: 'Bagaimana jika regex membuat proses sangat lama?'
    a: 'Regex dijalankan di Web Worker terpisah dengan batas waktu 1 detik. Bila lewat, proses dihentikan dan halaman tetap responsif.'
  - q: 'Apa itu flag g, i, m, s, u, dan y?'
    a: 'g mencari semua kecocokan, i mengabaikan huruf besar/kecil, m membuat ^ dan $ berlaku per baris, s membuat titik cocok dengan baris baru, u mengaktifkan Unicode, dan y mencocokkan tepat di posisi terakhir.'
  - q: 'Bagaimana memakai grup bernama?'
    a: 'Tulis (?<nama>pola), lalu di kolom ganti gunakan $<nama>. Nilai grup bernama juga ditampilkan di daftar kecocokan.'
related: ['url-encode-decode', 'json-formatter', 'bandingkan-teks']
---

## Menguji regex sebelum dipakai di kode

Regular expression mudah salah. Dengan sorotan langsung dan daftar grup tangkapan, kamu bisa
melihat persis bagian teks yang cocok sebelum regex dipakai untuk validasi form atau
pengolahan data.
