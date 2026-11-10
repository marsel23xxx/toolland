# Roadmap Edit Video

Rencana bertahap untuk tool **Edit Video** (`/tools/edit-video`, `/en/tools/video-editor`).
Fitur ini di luar PRD dan disetujui pemilik proyek pada 2026-11-10.

Status per 2026-11-10: **Fase 0, 1, dan 2 selesai**, berikutnya **Fase 3** (atau Fase 4 lebih dulu).

## Prinsip yang berlaku di semua fase

1. **Semua proses di browser pengguna.** Video tidak pernah dikirim ke server. Server hanya
   mengirim file situs dan ffmpeg.wasm, jadi bebannya tidak bertambah berapa pun ukuran video.
2. **Pratinjau = hasil ekspor.** Setiap efek dibuat dua kali dengan rumus yang sama: sekali untuk
   pratinjau (CSS/canvas) dan sekali untuk ffmpeg. Rumusnya ditaruh di `lib/editor/` sebagai fungsi
   murni yang dipakai keduanya dan dites.
3. **File .ayu tetap bisa dibuka.** Setiap perubahan model data menaikkan `AYU_VERSION`, dan
   proyek lama tetap terbuka (nilai baru diisi bawaan di `sanitizeProject`).
4. **Desktop dulu.** Editor hanya terbuka di layar minimal 1024 px. Versi HP baru dipikirkan
   setelah Fase 3, kalau memang dibutuhkan.
5. **Selesai = teruji.** Setiap fase punya unit test untuk logika dan perintah ffmpeg, satu e2e
   untuk alur utamanya, dan dicek di Chrome serta Firefox sungguhan oleh pemilik proyek.

Ukuran fase: **S** kecil, **M** sedang, **L** besar (perkiraan kerja relatif, bukan tanggal).

---

## Fase 0: Editor dasar (selesai)

- Timeline satu jalur: klip video/foto berurutan, teks, satu musik latar.
- Potong klip (angka masuk/keluar, potong di playhead), ubah urutan, duplikat, hapus.
- Teks: isi, waktu, posisi atas/tengah/bawah atau bebas (seret di pratinjau), ukuran, warna, kotak.
- Transisi pudar lewat hitam/putih, fade awal/akhir, rasio 16:9, 9:16, 1:1, 4:5, kualitas 480–1080p.
- Undo/redo, layar penuh, pintasan keyboard.
- Simpan/buka `.ayu` ringan atau beserta video, sambung ulang media yang hilang.
- Ekspor MP4 (H.264 + AAC) dengan ffmpeg.wasm.

**Kekurangan yang dikeluhkan:** timeline kaku (tidak bisa geser/tarik), panel samping minim.

---

## Fase 1: Timeline interaktif (L), selesai

Tujuan: semua penyuntingan dasar bisa dilakukan langsung di timeline dengan mouse, tanpa mengetik
angka.

**Fitur**
- **Tarik ujung klip** untuk memotong awal/akhir. Pratinjau menampilkan bingkai di titik potong
  selama ditarik.
- **Geser klip** untuk mengubah urutan dengan pointer events: ada bayangan klip, klip lain menyingkir
  dengan animasi, dan bisa dipakai dengan pena/touchpad. Ini mengganti drag-and-drop HTML yang
  sekarang.
- **Geser playhead** (scrub) di penggaris maupun di jalur mana pun. Bingkai diperbarui selama digeser.
- **Bar teks**: geser untuk memindah waktu, tarik ujung untuk mengubah durasi.
- **Bar musik**: geser untuk memilih bagian lagu yang diputar. (Memotong musik dipindah ke Fase 2,
  karena butuh perubahan model data.)
- **Snapping (magnet)** ke playhead, tepi klip, dan tepi teks. Bisa dimatikan.
- **Zoom** dengan Ctrl + scroll dan tombol "muat semua". Saat diputar, timeline ikut menggulir
  mengikuti playhead.
- **Filmstrip**: beberapa gambar kecil per klip (bukan satu), dibuat bertahap di latar belakang.
- **Gelombang suara** pada bar musik dan klip video yang punya audio (Web Audio API).
- **Menu klik kanan** pada klip/teks: potong, duplikat, hapus, salin pengaturan.
- **Keyboard tambahan**: ← → maju/mundur satu bingkai, Shift + ← → satu detik, Home/End,
  Ctrl+C/Ctrl+V klip.

**Catatan teknis**
- Komponen timeline dipecah: `TimelineRuler`, `ClipTrack`, `TextTrack`, `AudioTrack`, serta
  composable `useTimelineDrag` untuk geser/tarik/snap. Logika snap dan trim ditaruh di
  `lib/editor/timeline.ts` sebagai fungsi murni.
- Filmstrip memakai satu elemen `<video>` tersembunyi dengan antrean seek, lalu disimpan sebagai
  object URL per media.
- Gelombang suara dihitung sekali per media (`decodeAudioData`, diringkas jadi sekitar 1.000 titik).
  Untuk video besar dibatasi supaya memori aman.
- Model data tidak berubah, jadi `.ayu` tetap versi 1.

**Selesai bila:** potong, susun, atur teks, dan atur musik bisa dikerjakan hanya dengan mouse; e2e
memakai gerakan mouse sungguhan.

**Hasil:** semua poin di atas sudah dibuat. Logika ada di `lib/editor/timeline.ts`, filmstrip dan
gelombang suara di `useMediaPreviews.ts`. Saat ditarik dari kiri, klip lain tetap di tempat lalu
merapat setelah dilepas.

---

## Fase 2: Panel samping lengkap (L), selesai

Tujuan: panel kanan jadi "inspektur" yang kaya seperti editor populer, tetap sederhana.

**Media**
- Galeri gambar kecil (grid), durasi, ukuran, dan penanda "dipakai".
- Seret dari galeri ke posisi tertentu di timeline.

**Klip**
- **Kecepatan** 0,25×–4× (ffmpeg `setpts` + `atempo`; pratinjau memakai `playbackRate`).
- Volume, bisu, fade in/out audio per klip.
- **Putar/balik** (90°, 180°, cermin) dan **crop/zoom** manual.
- **Penyesuaian warna**: kecerahan, kontras, saturasi, plus beberapa filter siap pakai (hangat,
  sejuk, hitam-putih). ffmpeg `eq`/`colorchannelmixer`, pratinjau CSS `filter`.
- **Ken Burns** untuk foto: zoom/geser pelan (`zoompan`).
- **Latar blur** untuk mode Pas: bingkai hitam diganti versi blur dari video itu sendiri (populer
  untuk Reels/TikTok).

**Teks**
- Beberapa font yang disimpan sendiri di situs (tanpa Google Fonts saat runtime, aman CSP), rata
  kiri/tengah/kanan, garis tepi dan bayangan, warna dan transparansi kotak.
- **Animasi masuk/keluar**: pudar, geser, muncul membesar.
- Preset gaya: judul, keterangan bawah, kutipan.

**Musik dan audio**
- Fade in, potong, dan **ducking** (musik otomatis mengecil saat ada suara di video).

**Proyek**
- Warna latar, frame rate 24/30/60.

**Catatan teknis**
- Model berubah (speed, rotate, color, anim, font), jadi `.ayu` naik ke versi 2. Proyek versi 1
  tetap terbuka.
- Font teks disalin ke PNG saat ekspor (cara sekarang), jadi font apa pun yang tampil di pratinjau
  akan sama di hasil.
- Animasi teks butuh banyak bingkai PNG atau filter `overlay` dengan ekspresi. Pilihan dibuat saat
  mulai fase ini, setelah diukur.

**Selesai bila:** setiap pengaturan di panel terlihat sama di pratinjau dan di MP4 (diuji
per efek dengan perbandingan bingkai).

**Hasil:** semua poin dibuat, dalam dua tahap (2a klip, 2b teks/musik/galeri). Font yang dipilih
pemilik proyek: Plus Jakarta Sans, Bebas Neue, Montserrat, Playfair Display, Caveat, Pacifico.
Animasi teks dibuat sebagai fade alpha + posisi overlay (tanpa "muncul membesar"). Ducking
memakai otomasi volume yang sama di pratinjau dan ekspor (bukan sidechain), sehingga hasilnya bisa
diprediksi. Rumus ada di `lib/editor/look.ts` dan `lib/editor/textfx.ts`. Format `.ayu` sekarang
versi 3.

---

## Fase 3: Banyak jalur dan overlay (L)

Tujuan: menumpuk lebih dari satu video/gambar/audio.

- **Jalur overlay**: video atau gambar di atas video utama (picture-in-picture, logo milik
  pengguna). Posisi dan ukuran diseret langsung di pratinjau.
- **Jalur audio tambahan**: rekam **suara narasi** langsung dari mikrofon (MediaRecorder) dan efek
  suara.
- **Crossfade sungguhan** (dua klip saling menumpuk) dan transisi lain: geser, sapu, zoom (`xfade`).
  Durasi total berkurang sebesar transisi, jadi rumus waktu di timeline ikut berubah.
- Bentuk sederhana dan stiker (emoji/ikon).
- Urutan lapisan (naik/turun).

**Catatan teknis**
- Model berubah besar: dari "klip berurutan" menjadi "jalur berisi item dengan waktu mulai".
  `.ayu` versi 3 dengan migrasi dari versi 1/2.
- Pratinjau butuh lebih dari satu elemen video sekaligus. Kemungkinan pindah ke penggambaran
  canvas/WebCodecs (lihat Fase 4) bila elemen video terlalu berat.
- Perintah ffmpeg makin panjang. Batas jumlah item per proyek perlu diukur ulang.

**Selesai bila:** proyek dengan 3 jalur video + 2 jalur audio bisa dipratinjau lancar dan diekspor.

---

## Fase 4: Kinerja, format, dan keamanan kerja (M)

- **Video HEVC dan format lain yang tidak bisa diputar browser**: ffmpeg.wasm membuat salinan
  H.264 kecil khusus pratinjau. Ekspor tetap memakai file asli.
- **Proxy untuk video besar** (4K, bitrate tinggi) supaya pratinjau lancar di laptop biasa.
- **Simpan otomatis** ke IndexedDB setiap beberapa detik. Setelah browser tertutup atau crash,
  proyek bisa dipulihkan (media dipilih ulang, atau otomatis di Chrome lewat File System Access).
  `.ayu` tetap jadi cara memindah proyek.
- **Opsi ekspor**: frame rate, bitrate, sebagian rentang waktu saja, audio saja (MP3), GIF, perkiraan
  sisa waktu.
- **WebCodecs** (bila didukung) untuk ekspor yang jauh lebih cepat daripada ffmpeg.wasm, dengan
  ffmpeg.wasm sebagai cadangan.
- Uji beban: proyek 30 menit, 100 klip, laptop RAM 8 GB.

---

## Fase 5: Fitur pintar dan template (opsional, M–L)

Semua tetap di browser; model AI diunduh sekali dan disimpan di cache.

- **Subtitle otomatis** dari suara (Whisper kecil via transformers.js/ONNX), bisa diedit, impor/ekspor
  **SRT**. Perlu dicek kualitas bahasa Indonesia dan ukuran model (sekitar 40–150 MB).
- **Hapus jeda hening otomatis** (ffmpeg `silencedetect`). Cocok untuk video bicara/tutorial.
- **Template proyek**: slideshow foto + musik, Reels berketerangan, video ulang tahun. Bisa
  terhubung dengan bagian Template di Toolland.
- Potong foto mengikuti ketukan musik (beat detection).

---

## Urutan dan keputusan yang masih terbuka

| Fase | Isi singkat                      | Ukuran | Ubah format .ayu |
| ---- | -------------------------------- | ------ | ---------------- |
| 1    | Timeline geser/tarik, snap, zoom | L      | Tidak            |
| 2    | Panel kaya: speed, warna, teks   | L      | Versi 2          |
| 3    | Multi-jalur, overlay, crossfade  | L      | Versi 3          |
| 4    | HEVC, proxy, autosave, ekspor    | M      | Tidak            |
| 5    | Subtitle otomatis, template      | M–L    | Mungkin          |

Fase 4 bisa dikerjakan lebih awal (misalnya sesudah Fase 1) kalau banyak pengguna mengeluh soal
video HEVC dari iPhone atau kehilangan progres.

Keputusan yang perlu diambil pemilik proyek saat fasenya tiba:
- Fase 2: font apa saja yang disediakan (lisensi harus bebas, misalnya OFL).
- Fase 3: apakah boleh menaikkan batas memori/jumlah jalur, dan apakah WebCodecs dipakai untuk
  pratinjau.
- Fase 5: apakah model AI ±100 MB boleh diunduh pengguna (dengan peringatan ukuran).
