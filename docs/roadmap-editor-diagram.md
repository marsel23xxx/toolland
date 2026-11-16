# Roadmap: Editor Diagram (menu Developer)

Editor diagram buatan Toolland di atas [maxGraph](https://github.com/maxGraph/maxGraph)
(`@maxgraph/core`, Apache 2.0). Semua berjalan di browser. Halaman `/tools/editor-diagram`
(EN `/en/tools/diagram-editor`), bisa layar penuh.

Keputusan pengguna (2026-11-16):

- Bangun sendiri dengan maxGraph, bukan meng-hosting draw.io. Repo open source draw.io sejak
  v32.5.5 menyebut dirinya "test version" dan menawarkan versi berbayar untuk produksi.
- Jangan memakai nama atau logo draw.io sebagai merek. Menyebut "bisa membuka file .drawio"
  sebagai fakta kompatibilitas boleh.

Catatan teknis:

- CSP situs (style-src dengan hash, tanpa 'unsafe-inline') memblokir style label maxGraph yang
  ditulis lewat setAttribute/innerHTML. `lib/diagram/csp-dom.ts` mengalihkannya ke CSSOM
  (`style.cssText`), hanya di halaman editor. Tes e2e gagal bila ada pelanggaran CSP.
- maxGraph 0.25 membuat garis dari ConnectionHandler dengan id `''`; editor memaksanya `null`
  dan penulis .drawio mengganti id kosong/ganda.
- Ekspor PNG memuat SVG sebagai `data:` URL (bukan `blob:`) supaya canvas tidak "tercemar".
- Gambar bawaan maxGraph (point.gif) disalin `scripts/vendor.mjs` ke `/vendor/maxgraph/<versi>/`.

Format file: `.drawio` (XML `mxGraphModel`, style berupa string `k=v;`). maxGraph bisa membaca
format ini; penulisnya dibuat sendiri (`lib/diagram/drawio.ts`), termasuk membaca diagram yang
dikompres (deflate + base64).

## Tahap 1: editor inti (selesai 2026-11-16)

- Kanvas: grid dan snap, garis bantu (guides), seleksi kotak, geser kanvas (spasi + seret, tombol
  tengah), zoom (Ctrl + roda, tombol), ubah ukuran dan putar shape.
- Konektor: panah muncul saat shape disorot, gaya siku (orthogonal) sebagai bawaan, titik belok,
  label pada garis.
- Panel shape kiri dengan pencarian: Umum dan Flowchart.
- Panel format kanan: isi, garis, tebal, putus-putus, sudut membulat, bayangan, opasitas, teks
  (ukuran, warna, tebal/miring, perataan), panah awal/akhir, gaya garis. Susun: rata, sebar,
  depan/belakang, grup. Tanpa seleksi: grid, warna latar.
- Toolbar: baru, buka, simpan `.drawio`, ekspor PNG dan SVG, undo/redo, zoom, hapus, layar penuh.
- Pintasan keyboard (Delete, Ctrl+Z/Y, Ctrl+C/X/V/D, Ctrl+A, Ctrl+G, panah untuk menggeser).
- Simpan otomatis di browser dan pulihkan saat dibuka lagi.

## Tahap 2: pustaka shape teknik (selesai 2026-11-16)

- Elektronika/kelistrikan: resistor, kapasitor, induktor, dioda, LED, transistor, IC, sumber,
  ground, saklar, sekering, motor, lampu, gerbang logika.
- IoT: mikrokontroler, sensor, aktuator, relay, modul WiFi/Bluetooth/LoRa, gateway, cloud,
  perangkat pengguna.
- Jaringan: router, switch, server, PC, laptop, firewall, access point, database, internet.
- UML (class, use case, sequence dasar), ERD, BPMN dasar.
- Dibuat sebagai stencil maxGraph (XML) dengan titik sambung per pin.

## Tahap 3: dokumen besar

- Banyak halaman (tab) dan layer.
- Template siap pakai (flowchart, rangkaian, arsitektur IoT, jaringan, ERD).
- Ekspor PDF, minimap, cari dan ganti, tata letak otomatis (hierarki, pohon).
- Sisipkan gambar dan tabel.

## Tahap 4: perangkat sentuh dan pemolesan

- Gestur sentuh (cubit untuk zoom, tekan lama untuk menu).
- Menu klik kanan lengkap, panel pintasan, aksesibilitas.
