---
name: 'Generator Password'
title: 'Generator Password Kuat dan Acak'
description: 'Buat password acak yang kuat dengan panjang dan jenis karakter sesuai kebutuhan. Dibuat di browser, tidak pernah dikirim atau disimpan.'
summary: 'Password acak yang kuat, dibuat di perangkatmu.'
category: 'developer'
keywords: ['password generator', 'buat password', 'random password', 'password kuat']
howTo:
  - 'Atur panjang password dan jenis karakter yang dipakai.'
  - 'Password baru langsung dibuat. Klik tombol putar untuk membuat ulang.'
  - 'Klik Salin, lalu simpan di password manager kamu.'
faq:
  - q: 'Apakah password ini aman?'
    a: 'Ya. Password dibuat dengan crypto.getRandomValues, generator acak kriptografis di browser, tanpa bias, dan tidak pernah dikirim ke server.'
  - q: 'Berapa panjang password yang disarankan?'
    a: 'Minimal 16 karakter dengan huruf besar, huruf kecil, angka, dan simbol. Untuk akun penting, 20 karakter atau lebih lebih baik.'
  - q: 'Apa arti entropi?'
    a: 'Entropi mengukur seberapa sulit password ditebak, dalam bit. Di atas 80 bit sudah sangat kuat untuk hampir semua kebutuhan.'
  - q: 'Untuk apa opsi tanpa karakter mirip?'
    a: 'Opsi ini membuang karakter yang mudah tertukar seperti 0 dan O atau 1, l, dan I, berguna bila password perlu diketik ulang secara manual.'
related: ['generator-uuid', 'hash-md5-sha', 'base64-encode-decode']
---

## Password kuat tanpa perlu berpikir

Password yang dibuat manusia cenderung mudah ditebak. Generator ini membuat kombinasi acak
yang benar-benar tidak terduga, dan menjamin setiap jenis karakter yang kamu pilih muncul
minimal sekali.
