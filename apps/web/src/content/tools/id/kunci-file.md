---
name: 'Kunci File & Teks'
title: 'Kunci File dan Teks dengan Password (Enkripsi AES-256)'
description: 'Ubah teks atau file jadi kode terkunci dengan password. Penerima membukanya di Toolland. Diproses di browser, tidak ada data yang dikirim ke server.'
summary: 'Kunci teks atau file jadi kode rahasia berpassword.'
category: 'developer'
keywords:
  [
    'enkripsi file',
    'enkripsi teks',
    'kunci file',
    'password file',
    'kirim file rahasia',
    'pesan rahasia',
    'aes',
    'dekripsi',
  ]
howTo:
  - 'Pilih Teks atau File, lalu isi teks atau pilih file yang ingin dikunci.'
  - 'Pakai password yang dibuatkan otomatis atau ganti sendiri, lalu tekan Kunci sekarang.'
  - 'Kirim kode atau file .toolland ke penerima, dan beri tahu passwordnya lewat jalur lain. Penerima membukanya di tab Buka.'
faq:
  - q: 'Apakah data saya dikirim ke server Toolland?'
    a: 'Tidak. Penguncian dan pembukaan terjadi di browser kamu. Data hanya ada di dalam kode atau file .toolland yang kamu kirim sendiri, jadi Toolland tidak menyimpan dan tidak bisa melihat apa pun.'
  - q: 'Seberapa aman kodenya?'
    a: 'Data dienkripsi dengan AES-256-GCM, dan password diolah dengan PBKDF2-SHA256 sebanyak 600.000 putaran sehingga sangat lambat untuk ditebak. Kekuatannya bergantung pada password: password otomatis Toolland cukup kuat, password pendek seperti tanggal lahir mudah ditebak.'
  - q: 'Kenapa hasilnya kadang berupa file, bukan kode?'
    a: 'Kode menjadi sepanjang ukuran datanya. Teks dan file kecil (sekitar 40 KB) muat sebagai kode yang bisa ditempel di chat. File yang lebih besar dijadikan file .toolland agar tetap bisa dikirim lewat WhatsApp atau email.'
  - q: 'Bagaimana kalau password lupa?'
    a: 'Data tidak bisa dibuka lagi oleh siapa pun, termasuk Toolland, karena password tidak pernah disimpan. Catat password di tempat aman sebelum mengirim kode.'
  - q: 'Bagaimana cara aman mengirim password?'
    a: 'Kirim lewat jalur berbeda dari kodenya. Misalnya kode lewat email dan password lewat telepon atau pesan terpisah. Dengan begitu, orang yang hanya melihat satu pesan tidak bisa membuka datanya.'
  - q: 'Apakah ada batas ukuran file?'
    a: 'Sampai 200 MB per file, supaya memori HP tidak habis. Semakin besar file, semakin lama proses penguncian di perangkat kamu.'
related: ['hash-md5-sha', 'base64-encode-decode']
---

## Kirim data rahasia tanpa takut bocor

Nomor rekening, foto KTP, atau dokumen kontrak sering dikirim lewat chat dan tersimpan
selamanya di riwayat pesan. Dengan Kunci File & Teks, yang terkirim hanya kode acak. Isinya
baru bisa dibaca oleh orang yang tahu password-nya.

- **Teks**: pesan pendek jadi kode yang bisa ditempel di WhatsApp, Telegram, atau email.
- **File**: foto, PDF, atau dokumen dikunci jadi file `.toolland`.
- **Tanpa akun dan tanpa server**: tidak ada yang diunggah, jadi tidak ada yang bisa bocor dari
  server kami.

## Tips agar tetap aman

Gunakan password otomatis atau password panjang buatan sendiri. Jangan kirim password di pesan
yang sama dengan kodenya. Setelah penerima selesai membuka data, kamu bisa menghapus pesan berisi
kode dari chat.
