# Toolland

Kumpulan tools online gratis di [julian-marcell.com](https://julian-marcell.com) untuk gambar, PDF,
teks, developer, dan media, dalam bahasa Indonesia (`/`) dan Inggris (`/en/`). Hampir semua tools
memproses file langsung di perangkat pengguna; file tidak pernah disimpan.

## Tools

| Kategori  | Tools                                                                                                    | Diproses di |
| --------- | -------------------------------------------------------------------------------------------------------- | ----------- |
| Gambar    | konversi JPG/PNG/WebP/AVIF/HEIC, kompres | browser     |
| Gambar AI | hapus background (ISNet, WebGPU/WASM) | browser     |
| PDF       | gabung, pisah, kompres cepat, PDF ke JPG, JPG ke PDF, buat tanda tangan, watermark, nomor halaman            | browser     |
| PDF       | Word/Excel/PowerPoint ke PDF (Gotenberg), ODT ke DOCX (LibreOffice), PDF ke Word (pdf2docx), kompres PDF maksimal (Ghostscript), maks 15 MB | server      |
| Teks      | hitung kata, ubah huruf, bandingkan teks | browser     |
| Developer | JSON formatter, JSON↔CSV, Base64 & URL encode (termasuk gambar ke Base64), hash, QR code | browser     |
| Media     | video ke GIF, kompres video, ekstrak audio (ffmpeg.wasm, sampai 1 GB) | browser     |

## Struktur

| Folder              | Isi                                                                       |
| ------------------- | ------------------------------------------------------------------------- |
| `apps/web`          | Frontend Astro (statis) + island Vue 3 + Tailwind v4                      |
| `apps/web/e2e`      | Uji browser (Chrome headless) untuk semua tools                           |
| `apps/api`          | Backend Rust (Axum): Office ke PDF, ke DOCX, dan kompres PDF, stateless, tanpa DB |
| `apps/converter`    | Service internal ODT/PDF ke DOCX (Python + LibreOffice Writer + pdf2docx) |
| `crates/tools-core` | Tempat fungsi Rust bersama (WASM + native), diisi bila ada bottleneck     |
| `infra/`            | Docker Compose, Nginx, logrotate, skrip rilis, [panduan deploy](infra/DEPLOY.md) |

## Pengembangan

Butuh Node 22.23+, pnpm, Rust stable, dan Docker (untuk Gotenberg dan converter).

```sh
pnpm install
pnpm dev            # http://localhost:4321 (aset vendor besar disiapkan otomatis)
pnpm lint           # ESLint + Prettier
pnpm check          # TypeScript (astro check + vue-tsc)
pnpm test           # Vitest
pnpm build          # hasil di apps/web/dist
pnpm --filter web e2e   # uji browser (setelah build)

cargo test                  # backend
cargo run -p toolland-api   # http://localhost:8082/api/tools/v1/health
```

Uji tools server secara lokal:

```sh
cd infra && WEB_ROOT=/tmp API_IMAGE=toolland-api:local docker compose up -d --build api gotenberg
TOOLLAND_API_URL=http://127.0.0.1:8082 pnpm --filter web e2e server
```

### Aset vendor

Model AI, ffmpeg core, serta wasm pdf.js dan MediaPipe (sekitar 260 MB) tidak disimpan di git.
`apps/web/scripts/vendor.mjs` menyalinnya dari `node_modules` atau mengunduhnya (diverifikasi
SHA-256) ke `apps/web/public/vendor/<paket>/<versi>/` sebelum `dev` dan `build`.

## Lisensi

[AGPL-3.0](LICENSE). Laporan keamanan: lihat [SECURITY.md](SECURITY.md).
