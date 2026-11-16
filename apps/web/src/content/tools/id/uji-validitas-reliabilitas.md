---
name: 'Uji Validitas & Reliabilitas'
title: 'Uji Validitas dan Reliabilitas Kuesioner Online (Cronbach Alpha)'
description: 'Uji validitas dan reliabilitas kuesioner tanpa SPSS: tempel data dari Excel, dapatkan r hitung, r tabel, Cronbach alpha, dan kalimat interpretasi siap pakai.'
summary: 'Uji validitas item dan Cronbach alpha tanpa SPSS.'
category: 'teks'
group: 'skripsi'
keywords:
  [
    'uji validitas',
    'uji reliabilitas',
    'cronbach alpha',
    'uji validitas kuesioner',
    'r hitung',
    'r tabel',
    'corrected item total correlation',
    'tanpa spss',
    'kuesioner skripsi',
  ]
howTo:
  - 'Blok data skor kuesioner di Excel atau Google Sheets (baris = responden, kolom = item), salin, lalu tempel ke kotak data.'
  - 'Atur taraf signifikansi, jenis korelasi, dan batas Cronbach alpha sesuai pedomanmu. Bila nama kolom seperti X1.1, X1.2, Y.1, uji dilakukan per variabel.'
  - 'Baca hasil r hitung, r tabel, dan alpha per item. Salin tabel dan kalimat interpretasi ke Bab IV, atau unduh semuanya sebagai Excel.'
faq:
  - q: 'Apakah hasilnya sama dengan SPSS?'
    a: 'Sama. r hitung memakai korelasi Pearson item dengan skor total, seperti menu Correlate → Bivariate. Corrected item-total dan Cronbach alpha sama dengan menu Reliability Analysis, termasuk kolom Cronbach alpha if item deleted.'
  - q: 'Apa bedanya Pearson item-total dan corrected item-total?'
    a: 'Pearson item-total mengorelasikan item dengan skor total yang ikut memuat item itu sendiri. Corrected item-total mengeluarkan item tersebut dari skor total, sehingga hasilnya lebih ketat (r lebih kecil). Pakai yang diminta dosen pembimbing atau buku rujukanmu.'
  - q: 'Bagaimana kalau ada item yang tidak valid?'
    a: 'Item tidak valid ditandai dan disebut di kalimat interpretasi. Cronbach alpha dihitung ulang tanpa item tersebut, karena umumnya item tidak valid tidak diikutkan dalam analisis selanjutnya.'
  - q: 'Berapa batas Cronbach alpha yang dipakai?'
    a: 'Banyak skripsi memakai 0,60, sedangkan sebagian pedoman memakai 0,70. Pilih batas yang sesuai di pengaturan; kalimat interpretasi ikut menyesuaikan.'
  - q: 'Apakah data kuesioner saya dikirim ke server?'
    a: 'Tidak. Semua perhitungan berjalan di browser. Data yang ditempel hanya disimpan di browsermu supaya tidak hilang saat halaman dimuat ulang. Klik Hapus untuk menghapusnya.'
related: ['tabel-statistik', 'daftar-pustaka', 'kalkulator-sampel']
---

## Uji instrumen penelitian tanpa SPSS

Sebelum data kuesioner dianalisis, instrumennya harus terbukti valid dan reliabel. Biasanya ini
dikerjakan di SPSS, yang tidak semua mahasiswa punya. Tool ini memberi hasil yang sama langsung
di browser: cukup salin data dari Excel lalu tempel.

## Yang dihitung

- **Validitas**: r hitung tiap item dibandingkan dengan r tabel (df = N − 2), lengkap dengan nilai
  Sig. Item valid bila r hitung ≥ r tabel.
- **Reliabilitas**: Cronbach alpha untuk semua item dan untuk item valid saja, serta alpha jika
  item dihapus untuk melihat item yang melemahkan instrumen.
- **Kalimat interpretasi**: paragraf siap tempel ke Bab IV, sudah memuat r tabel, item yang tidak
  valid, dan nilai alpha.

## Tips menyiapkan data

1. **Satu baris untuk satu responden**, satu kolom untuk satu item.
2. **Beri nama kolom per variabel**, misalnya X1.1 sampai X1.8 dan Y.1 sampai Y.6, supaya uji
   dilakukan per variabel sekaligus.
3. **Kolom nomor, nama, dan total boleh ikut disalin.** Kolom itu dikenali dan diabaikan.
