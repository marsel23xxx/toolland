---
name: 'Generator UUID'
title: 'Generator UUID v4 dan v7 Online'
description: 'Buat UUID v4 acak atau UUID v7 yang urut waktu, sampai 1.000 sekaligus. Memakai generator acak kriptografis browser.'
summary: 'Buat UUID v4 atau v7, sampai 1.000 sekaligus.'
category: 'developer'
keywords: ['uuid generator', 'guid generator', 'uuid v4', 'uuid v7', 'random uuid']
howTo:
  - 'Pilih versi UUID dan jumlah yang dibutuhkan.'
  - 'Atur format: huruf besar atau tanpa tanda hubung bila perlu.'
  - 'Salin semua UUID atau unduh sebagai file .txt.'
faq:
  - q: 'Apa beda UUID v4 dan v7?'
    a: 'UUID v4 sepenuhnya acak. UUID v7 diawali waktu pembuatan sehingga urut, lebih baik untuk primary key database karena indeks tidak cepat terfragmentasi.'
  - q: 'Apakah UUID yang dibuat benar-benar unik?'
    a: 'UUID dibuat dengan generator acak kriptografis browser (crypto.randomUUID dan crypto.getRandomValues). Peluang dua UUID sama sangat kecil sehingga bisa diabaikan.'
  - q: 'Apakah UUID sama dengan GUID?'
    a: 'Ya. GUID adalah sebutan Microsoft untuk UUID. Formatnya sama.'
  - q: 'Apakah UUID dicatat oleh Toolland?'
    a: 'Tidak. UUID dibuat di browser kamu dan tidak dikirim ke mana pun.'
related: ['generator-password', 'hash-md5-sha', 'lorem-ipsum']
---

## UUID untuk ID yang unik

UUID adalah ID 128-bit yang bisa dibuat di mana saja tanpa koordinasi dengan server pusat,
sehingga cocok untuk ID database, nama file, ID transaksi, dan data uji.
