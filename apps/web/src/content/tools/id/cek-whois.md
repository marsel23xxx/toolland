---
name: 'Cek WHOIS'
title: 'Cek WHOIS Domain Online: .com, .id, .co.id, dan Lainnya'
description: 'Cek data pendaftaran domain: registrar, tanggal daftar, kapan kedaluwarsa, nameserver, dan status. Memakai RDAP resmi dari registry, gratis tanpa daftar.'
summary: 'Registrar, tanggal kedaluwarsa, dan nameserver domain.'
category: 'developer'
processing: 'server'
keywords:
  [
    'whois',
    'cek domain',
    'whois domain',
    'rdap',
    'cek kedaluwarsa domain',
    'cek registrar',
    'nameserver',
    'domain lookup',
    'cek domain id',
  ]
howTo:
  - 'Ketik nama domain, misalnya contoh.co.id. Alamat lengkap atau email juga bisa ditempel.'
  - 'Klik Cek WHOIS. Toolland menanyakan data ke server registry resmi domain tersebut.'
  - 'Lihat registrar, tanggal daftar dan kedaluwarsa, nameserver, dan status domain. Salin hasilnya bila perlu.'
faq:
  - q: 'Apa itu WHOIS dan RDAP?'
    a: 'WHOIS adalah data pendaftaran sebuah domain: siapa registrarnya, kapan didaftarkan, kapan habis, dan nameserver yang dipakai. RDAP adalah versi modern WHOIS yang ditetapkan ICANN, dengan format data yang rapi. Toolland memakai RDAP langsung dari registry, misalnya Verisign untuk .com dan PANDI untuk .id.'
  - q: 'Kenapa nama pemilik domain tidak muncul?'
    a: 'Sebagian besar registry menyembunyikan nama, alamat, dan kontak pemilik domain demi privasi (aturan seperti GDPR dan kebijakan PANDI). Toolland hanya menampilkan data yang memang dibuka untuk umum.'
  - q: 'Domain saya tidak ditemukan, artinya apa?'
    a: 'Artinya registry tidak punya catatan domain itu, jadi kemungkinan besar domain tersebut belum terdaftar dan masih bisa dibeli. Pastikan juga ejaannya benar.'
  - q: 'Ekstensi domain apa saja yang didukung?'
    a: 'Semua ekstensi yang registry-nya menyediakan RDAP, termasuk .com, .net, .org, .id, .co.id, .my.id, .web.id, dan ratusan lainnya. Beberapa ekstensi negara belum punya RDAP dan akan diberi tahu.'
  - q: 'Apakah domain yang saya cek disimpan?'
    a: 'Tidak dicatat di log. Hasil pengecekan hanya disimpan sementara di RAM server paling lama 1 jam agar registry tidak ditanya berulang kali, lalu terhapus.'
related: ['json-formatter', 'hash-md5-sha', 'base64-encode-decode']
---

## Kapan perlu cek WHOIS?

- **Sebelum membeli domain**: lihat apakah nama yang kamu incar sudah dipakai orang lain.
- **Mengingat tanggal perpanjangan**: domain yang lupa diperpanjang bisa mati dan diambil orang.
  Toolland menampilkan sisa hari sampai kedaluwarsa dan memberi tanda bila tinggal 30 hari.
- **Pindah hosting atau mengecek DNS**: pastikan nameserver sudah mengarah ke penyedia yang benar.
- **Mengecek situs yang mencurigakan**: domain yang baru berumur beberapa hari dan meniru nama
  bank atau toko online patut diwaspadai.

## Arti status domain

Status seperti _client transfer prohibited_ berarti domain dikunci agar tidak bisa dipindah ke
registrar lain tanpa izin pemilik. Ini normal dan justru melindungi domain. Status _redemption
period_ atau _pending delete_ berarti domain sudah lewat masa aktif dan sebentar lagi dilepas.
