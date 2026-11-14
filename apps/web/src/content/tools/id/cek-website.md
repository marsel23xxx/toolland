---
name: 'Cek Website'
title: 'Cek Website: Keamanan, SSL, Header, dan Teknologi yang Dipakai'
description: 'Cek keamanan website (SSL, HTTPS, header keamanan, SPF, DMARC) lengkap dengan nilai A sampai F, plus teknologi yang dipakai seperti WordPress, Laravel, atau Next.js.'
summary: 'Nilai keamanan, sertifikat SSL, dan tech stack sebuah situs.'
category: 'developer'
processing: 'server'
keywords:
  [
    'cek website',
    'cek keamanan website',
    'cek ssl',
    'security headers',
    'cek tech stack website',
    'website pakai apa',
    'cek teknologi website',
    'cek hsts',
    'cek spf dmarc',
  ]
howTo:
  - 'Ketik domain, misalnya contoh.co.id. Alamat lengkap dengan https:// juga bisa ditempel.'
  - 'Klik Cek Website. Server Toolland membuka halaman depan situs itu sekali, seperti pengunjung biasa.'
  - 'Lihat nilai keamanan, daftar pemeriksaan beserta saran perbaikannya, detail sertifikat SSL, dan teknologi yang terdeteksi.'
faq:
  - q: 'Apa saja yang diperiksa?'
    a: 'HTTPS dan pengalihan dari http, sertifikat SSL dan versi TLS, header keamanan (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), flag cookie, kebocoran versi software, konten campuran, security.txt, serta catatan DNS email SPF, DMARC, dan CAA.'
  - q: 'Bagaimana nilai A sampai F dihitung?'
    a: 'Setiap pemeriksaan punya bobot. Aman mendapat nilai penuh, perlu dicek setengah, dan bermasalah nol. Skor 90 ke atas mendapat A. Situs tanpa https atau dengan sertifikat tidak valid langsung mendapat F, karena browser sudah memperingatkan pengunjungnya.'
  - q: 'Apakah ini memindai celah keamanan atau menyerang situs?'
    a: 'Tidak. Toolland hanya membuka halaman depan, alamat http, dan /.well-known/security.txt dengan permintaan biasa, persis seperti pengunjung. Tidak ada pemindaian port, uji celah, atau percobaan login. Jadi aman dipakai untuk situs milik siapa pun.'
  - q: 'Bagaimana cara mendeteksi teknologinya?'
    a: 'Dari ciri yang terlihat publik: header seperti Server dan X-Powered-By, nama cookie, tag meta generator, serta alamat script di HTML. Toolland mengenali lebih dari 100 teknologi, termasuk Midtrans dan Xendit. Teknologi yang disembunyikan pemilik situs tidak akan terlihat.'
  - q: 'Kenapa situs lokal atau alamat IP tidak bisa dicek?'
    a: 'Demi keamanan, Toolland menolak alamat IP langsung serta domain yang mengarah ke jaringan lokal atau privat. Hanya situs publik di port standar (80 dan 443) yang bisa diperiksa.'
  - q: 'Apakah situs yang saya cek disimpan?'
    a: 'Tidak dicatat di log. Hasilnya disimpan sementara di RAM server paling lama 10 menit agar situs yang sama tidak dibuka berulang kali, lalu terhapus.'
related: ['cek-whois', 'cari-subdomain', 'hash-md5-sha']
---

## Kapan perlu cek website?

- **Setelah membuat atau pindah hosting**: pastikan https, pengalihan, dan header keamanan sudah
  terpasang dengan benar.
- **Sebelum sertifikat habis**: Toolland menampilkan sisa hari sertifikat SSL dan memberi tanda
  bila tinggal 14 hari.
- **Mengecek email domain**: tanpa SPF dan DMARC, orang lain mudah mengirim email palsu atas nama
  domainmu.
- **Penasaran situs lain dibuat pakai apa**: lihat CMS, framework, hosting, CDN, sampai alat
  analitik dan pembayaran yang dipakai.

## Arti tiap status

**Aman** berarti pengaturannya sudah sesuai praktik terbaik. **Perlu dicek** berarti ada yang
bisa diperkuat, dan saran perbaikannya ditulis tepat di bawahnya. **Bermasalah** perlu segera
dibenahi. **Info** adalah pengaturan opsional yang tidak memengaruhi nilai.
