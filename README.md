# Toolland

Kumpulan tools online gratis di [julian-marcell.com](https://julian-marcell.com) untuk gambar, PDF,
teks, developer, dan media. File diproses di perangkat pengguna dan tidak pernah disimpan.

## Struktur

| Folder                | Isi                                                        |
| --------------------- | ---------------------------------------------------------- |
| `apps/web`            | Frontend Astro (output statis) + island Vue 3 + Tailwind v4 |
| `apps/api`            | Backend Rust (Axum), stateless                             |
| `crates/tools-core`   | Fungsi Rust bersama (WASM untuk browser + native untuk API) |
| `infra/`              | Docker Compose, konfigurasi Nginx, monitoring              |
| `.github/workflows/`  | CI                                                         |

## Pengembangan

Butuh Node 22.23+ dan pnpm, serta Rust stable (lihat `rust-toolchain.toml`).

```sh
pnpm install
pnpm dev          # http://localhost:4321
pnpm lint         # ESLint + Prettier
pnpm check        # TypeScript (astro check)
pnpm test         # Vitest
pnpm build        # hasil di apps/web/dist

cargo test        # backend
cargo run -p toolland-api   # http://localhost:8082/api/tools/v1/health
```

## Lisensi

[AGPL-3.0](LICENSE). Laporan keamanan: lihat [SECURITY.md](SECURITY.md).
