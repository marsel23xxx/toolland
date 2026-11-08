---
name: 'Cari Subdomain'
title: 'Cari Subdomain Online: Temukan Semua Subdomain Sebuah Domain'
description: 'Temukan subdomain sebuah domain (api, mail, staging, dan lainnya) dari log sertifikat SSL publik. Pasif, tanpa memindai server target, gratis tanpa daftar.'
summary: 'Daftar subdomain dari log sertifikat SSL publik.'
category: 'developer'
processing: 'browser'
keywords:
  [
    'subdomain finder',
    'cari subdomain',
    'cek subdomain',
    'subdomain scanner',
    'certificate transparency',
    'crt.sh',
    'enumerasi subdomain',
    'daftar subdomain',
  ]
howTo:
  - 'Ketik nama domain, misalnya contoh.co.id. Alamat lengkap atau email juga bisa ditempel.'
  - 'Klik Cari subdomain. Browsermu mengambil data dari log sertifikat SSL publik (crt.sh).'
  - 'Saring daftar bila perlu, lalu salin atau unduh hasilnya sebagai TXT atau CSV.'
faq:
  - q: 'Dari mana daftar subdomain ini berasal?'
    a: 'Dari log Certificate Transparency, yaitu catatan publik semua sertifikat SSL yang pernah diterbitkan. Setiap kali sebuah subdomain memakai HTTPS, namanya tercatat di sana. Toolland membacanya lewat crt.sh, dan memakai Certspotter sebagai cadangan bila crt.sh sedang tidak menjawab.'
  - q: 'Apakah tool ini memindai atau menyerang server target?'
    a: 'Tidak. Pencarian ini pasif: yang dibaca hanya catatan sertifikat publik, server milik domain tersebut tidak dihubungi sama sekali. Karena itu aman dan legal dipakai untuk mendata aset sendiri atau riset keamanan.'
  - q: 'Kenapa ada subdomain yang tidak muncul?'
    a: 'Subdomain yang tidak pernah memakai sertifikat SSL sendiri tidak tercatat, misalnya yang hanya dilindungi sertifikat wildcard (*.contoh.com) atau yang hanya dipakai di jaringan internal. Sebaliknya, subdomain lama yang sudah tidak aktif bisa tetap muncul karena catatannya permanen.'
  - q: 'Kenapa dibatasi 10 pencarian per jam?'
    a: 'Data diambil dari layanan publik gratis yang dikelola pihak lain. Batas ini menjaga agar layanan tersebut tidak terbebani sehingga tetap bisa dipakai semua orang. Domain yang sudah dicari di halaman yang sama bisa dibuka lagi tanpa memakai jatah.'
  - q: 'Apakah domain yang saya cari disimpan Toolland?'
    a: 'Tidak. Pencarian tidak lewat server Toolland: browsermu menghubungi crt.sh (atau Certspotter) secara langsung, jadi nama domain hanya terlihat oleh layanan tersebut. Toolland hanya menyimpan hitungan jatah pencarian di browsermu.'
related: ['cek-whois', 'json-formatter', 'hash-md5-sha']
---

## Kapan perlu mencari subdomain?

- **Mendata aset sendiri**: perusahaan sering lupa punya subdomain lama seperti _staging_ atau
  _dev_ yang masih menyala. Daftar ini membantu menemukannya sebelum orang lain.
- **Riset keamanan dan bug bounty**: langkah pertama pengujian yang diizinkan biasanya memetakan
  semua subdomain milik target.
- **Pindah hosting atau mengganti sertifikat**: pastikan tidak ada subdomain yang terlewat.

## Arti tanggal di samping subdomain

Tanggal menunjukkan kapan sertifikat terbaru untuk nama itu berakhir. Bila masih berlaku,
subdomain itu kemungkinan besar masih aktif. Bila sudah lama berakhir, subdomain itu mungkin
sudah tidak dipakai, tapi tetap layak dicek agar tidak disalahgunakan orang lain.
