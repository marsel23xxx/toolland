# Kebijakan Keamanan

## Melaporkan celah keamanan

Jangan laporkan celah keamanan lewat issue publik.

Gunakan **Private vulnerability reporting** di GitHub:
buka tab **Security** di repo ini, lalu pilih **Report a vulnerability**.

Sertakan:

- Bagian yang terdampak (halaman tool, endpoint API, konfigurasi infra)
- Langkah untuk mereproduksi
- Dampak yang mungkin terjadi

Laporan akan ditanggapi secepatnya. Mohon beri waktu perbaikan sebelum
mempublikasikan detail celah.

## Prinsip

- File pengguna tidak pernah disimpan ke disk atau database.
- Tidak ada rahasia (token, kredensial) di repo; semuanya lewat environment
  variable atau Docker secrets.
