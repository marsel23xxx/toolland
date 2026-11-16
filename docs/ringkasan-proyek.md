# Ringkasan Proyek Toolland

Dokumen ini merangkum cara kerja Toolland untuk siapa pun yang akan merawatnya: struktur repo,
cara deploy, dan langkah menangani error di CI/CD. Detail penyiapan VPS pertama kali ada di
[infra/DEPLOY.md](../infra/DEPLOY.md). Isi dokumen ini sesuai keadaan repo pada November 2026.

## 1. Gambaran singkat

Toolland adalah kumpulan tools online gratis di **julian-marcell.com**, dalam bahasa Indonesia
(`/`) dan Inggris (`/en/`). Kategorinya: Gambar, PDF, Teks (termasuk grup Skripsi & Penelitian dan
Tes), Developer (termasuk Editor Diagram), Media (termasuk Rapat Online), serta Template dokumen.

Prinsip utamanya: **file diproses di browser pengguna**. Hanya sedikit tool yang butuh server,
misalnya konversi Office ke PDF, kompres PDF maksimal, cek website/WHOIS, dan signaling Rapat
Online. Server tidak menyimpan file dan tidak punya database.

### Alur request

```
Pengguna
   │  HTTPS
   ▼
Cloudflare  (SSL Full strict + Authenticated Origin Pulls)
   │
   ▼
Nginx host di VPS  (infra/nginx/host/toolland.conf; menolak koneksi yang bukan dari Cloudflare)
   ├── /                    → container web   127.0.0.1:8081  (nginx:alpine, file statis)
   └── /api/tools/v1/...    → container api   127.0.0.1:8082  (Rust/Axum)
                                  ├── gotenberg  (Office → PDF, jaringan internal)
                                  └── converter  (ODT/PDF → DOCX, jaringan internal)
Uptime Kuma (monitoring)    → 127.0.0.1:3021  (hanya lewat SSH tunnel)
```

Semua port container hanya dibuka ke `127.0.0.1`. Jangan diubah menjadi `0.0.0.0`, karena Docker
melewati aturan firewall ufw.

## 2. Struktur proyek

```
toolland/
├── apps/
│   ├── web/                 Frontend: Astro (situs statis) + island Vue 3 + Tailwind v4
│   │   ├── src/
│   │   │   ├── pages/       Satu file .astro per halaman (tools/…, en/tools/…, template/…)
│   │   │   ├── components/
│   │   │   │   ├── tools/   Komponen Vue setiap tool (mis. diagram/DiagramEditor.vue)
│   │   │   │   ├── ui/      Komponen bersama (ToolPage, ToolIcon, Dropzone, …)
│   │   │   │   ├── pages/   Bagian halaman (beranda, baris tool)
│   │   │   │   └── templates/  Halaman template dokumen
│   │   │   ├── content/     Konten SEO Markdown per tool dan template (id/, en/)
│   │   │   ├── lib/         Logika tanpa UI, beserta unit test (*.test.ts)
│   │   │   │   ├── diagram/ Editor Diagram (maxGraph, stencil, .drawio, PDF, template)
│   │   │   │   ├── thesis/  Tool skripsi (format, sampel, tabel statistik, validitas, pustaka)
│   │   │   │   ├── meet/    Rapat Online (signaling, WebRTC mesh, blur latar)
│   │   │   │   └── …        pdf, image, media, templates, personality, dll.
│   │   │   ├── i18n/        Teks antarmuka id.json dan en.json (kunci harus sama)
│   │   │   ├── layouts/, styles/, workers/, assets/
│   │   │   └── content.config.ts  Skema konten (judul, deskripsi maks 170, FAQ 4–6, …)
│   │   ├── e2e/             Uji browser Chrome headless (run.mjs, suites/01-…09-*.mjs)
│   │   ├── scripts/vendor.mjs  Menyiapkan aset besar ke public/vendor/ (tidak masuk git)
│   │   └── astro.config.mjs CSP halaman (termasuk connect-src), proxy dev
│   ├── api/                 Backend Rust (Axum): routes/ (endpoint), services/ (logika)
│   └── converter/           Service Python + LibreOffice untuk konversi ke DOCX
├── crates/tools-core/       Fungsi Rust bersama (cadangan bila ada bottleneck)
├── infra/
│   ├── docker-compose.yml   web, api, gotenberg, converter, uptime-kuma
│   ├── nginx/web.conf, security-headers.conf   Nginx container web (ikut deploy otomatis)
│   ├── nginx/host/toolland.conf               Nginx host (TIDAK ikut deploy, salin manual)
│   ├── scripts/             activate-release.sh, rollback.sh, reload-web.sh
│   ├── logrotate/, monitoring/
│   └── DEPLOY.md            Penyiapan VPS, secret GitHub, keamanan server
├── docs/                    Dokumen proyek (roadmap Edit Video, roadmap Editor Diagram, ini)
├── .github/workflows/       ci.yml dan deploy.yml
├── package.json, pnpm-workspace.yaml, eslint.config.js
└── Cargo.toml, rust-toolchain.toml
```

### Teknologi utama

| Bagian     | Teknologi                                                                       |
| ---------- | ------------------------------------------------------------------------------- |
| Frontend   | Astro 7, Vue 3.5, Tailwind 4, TypeScript; Node 24 di CI, pnpm 12                 |
| Di browser | pdf-lib, pdf.js, ffmpeg.wasm, tesseract.js, MediaPipe, maxGraph 0.25 (diagram)   |
| Backend    | Rust stable, Axum 0.8 (HTTP + WebSocket), Tokio                                  |
| Server     | Docker Compose, Nginx, Gotenberg, LibreOffice, Ghostscript, Uptime Kuma          |
| Uji        | Vitest (unit), Puppeteer + Chrome (e2e), cargo test, Lighthouse (pull request)   |

### Cara menambah tool baru

1. Logika di `apps/web/src/lib/<area>/` beserta unit test-nya.
2. Komponen Vue di `apps/web/src/components/tools/`.
3. Halaman `src/pages/tools/<slug>.astro` dan `src/pages/en/tools/<slug-en>.astro`.
4. Konten `src/content/tools/id/<slug>.md` dan `en/<slug-en>.md` (versi EN memakai `idSlug`).
5. Teks antarmuka di `src/i18n/id.json` dan `en.json`, ikon di `components/ui/ToolIcon.astro`.
6. Tes e2e di `e2e/suites/`. Bila tool masuk navbar, cek tes yang menghitung jumlah menu
   (`09-templates.mjs`).
7. Bila tool memanggil layanan luar dari browser, tambahkan domainnya ke `connect-src` di
   `astro.config.mjs`.

## 3. Pengembangan dan pemeriksaan sebelum commit

```sh
pnpm install
pnpm dev                         # http://localhost:4321
cargo run -p toolland-api        # http://localhost:8082/api/tools/v1/health
```

Jalankan semua pemeriksaan ini sebelum commit. Urutannya sama dengan CI, jadi yang lolos di
lokal hampir pasti lolos di CI:

```sh
pnpm lint                        # ESLint + Prettier (format hanya file yang diubah)
pnpm check                       # astro check + vue-tsc (vue-tsc menangkap error di .vue)
pnpm test                        # Vitest
pnpm build
cd apps/web && node e2e/run.mjs text templates en pages   # suite yang paling sering terdampak
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Suite e2e bisa dipilih dengan nama tanpa nomor urut: `text`, `image`, `pdf`, `ai`, `media`,
`server`, `en`, `pages`, `templates`. Tanpa argumen, semua suite dijalankan. Suite `en` dan
`pages` membuka setiap halaman dan gagal bila ada error console, hydration mismatch, atau
pelanggaran CSP.

Aturan versi dependensi: hanya pakai versi paket npm/crate yang dirilis **minimal 2 minggu**
sebelumnya.

## 4. Cara deployment

### Alur otomatis

Setiap push ke `main` menjalankan **CI** (`.github/workflows/ci.yml`):

| Job                                  | Isi                                                        |
| ------------------------------------ | ---------------------------------------------------------- |
| Frontend (lint, test, build)         | install, lint, type check, unit test, build, e2e           |
| Backend (fmt, clippy, test, build)   | cargo fmt, clippy `-D warnings`, test, build release       |
| Audit dependensi Rust                | `cargo audit` (celah keamanan di crate)                    |
| Lighthouse (performa ≥ 95)           | hanya untuk pull request                                   |

Bila CI di `main` hijau, **Deploy** (`.github/workflows/deploy.yml`) berjalan otomatis:

1. Build image Docker `toolland-api` dan `toolland-converter`, lalu push ke GHCR dengan tag commit
   dan `latest`.
2. Build frontend (`pnpm build`).
3. Siapkan SSH dari secret environment `production`.
4. `rsync` folder `infra/` ke VPS (kecuali `nginx/host/`).
5. Uji konfigurasi nginx web (`reload-web.sh check`). Bila salah, deploy berhenti di sini,
   sebelum rilis baru aktif.
6. Upload frontend ke `/srv/toolland/web/releases/<commit>/`. File yang sama dengan rilis aktif
   di-hardlink, tidak dikirim ulang.
7. Pindahkan symlink `current` ke rilis baru (atomik, tanpa downtime).
8. `docker compose pull` dan `up -d` untuk api, converter, dan gotenberg.
9. Terapkan konfigurasi nginx web bila berubah (container web dibuat ulang).
10. Health check API (`:8082/api/tools/v1/health`) dan web (`:8081/`), dicoba sampai 20 kali.

Bila CI gagal, Deploy tetap muncul di daftar run tetapi berstatus **skipped**.

### Memantau dan memastikan deploy

```sh
gh run list --limit 5                      # status CI dan Deploy terbaru
gh run watch <run-id> --exit-status        # tunggu sampai selesai
curl -s -o /dev/null -w '%{http_code}\n' https://julian-marcell.com/api/tools/v1/health
```

Setelah deploy, buka beberapa halaman yang baru diubah di browser (versi ID dan EN), lalu pastikan
tidak ada error di console.

### Deploy manual dan rollback

- **Menjalankan ulang deploy** tanpa push baru: tab **Actions → Deploy → Run workflow**
  (`workflow_dispatch`). Run manual tidak menunggu CI, jadi pastikan commit itu memang sudah lolos.
- **Rollback frontend** (rilis sebelumnya atau commit tertentu):

  ```sh
  ssh -p 2222 deploy@<IP-VPS> /srv/toolland/infra/scripts/rollback.sh
  ssh -p 2222 deploy@<IP-VPS> /srv/toolland/infra/scripts/rollback.sh <commit>
  ```

- **Rollback backend**: di VPS, folder `/srv/toolland/infra`:

  ```sh
  API_IMAGE=ghcr.io/marsel23xxx/toolland-api:<commit> \
  CONVERTER_IMAGE=ghcr.io/marsel23xxx/toolland-converter:<commit> \
  docker compose --env-file ../.env up -d api converter
  ```

### Yang TIDAK otomatis

- **Nginx host** (`infra/nginx/host/toolland.conf`) tidak ikut rsync. Bila diubah, misalnya
  menambah location baru untuk API, salin manual dari laptop lalu uji:

  ```sh
  scp -P 2222 infra/nginx/host/toolland.conf <user>@<IP-VPS>:/tmp/
  # di VPS, sebagai root:
  cp /tmp/toolland.conf /etc/nginx/sites-available/toolland.conf
  nginx -t && systemctl reload nginx
  ```

- **Secret, file `.env` di VPS, sertifikat Cloudflare, dan pengaturan Cloudflare** diatur
  langsung oleh pemilik server. Private key tidak pernah ditaruh di repo atau dikirim lewat chat;
  pemilik menempelkannya sendiri ke GitHub Secrets atau ke server.

## 5. Menangani error di CI/CD

### Cara membaca log

```sh
gh run list --limit 5
gh run view <run-id>                                     # job dan langkah mana yang gagal
gh api repos/{owner}/{repo}/actions/jobs/<job-id>/logs > ci.log   # log lengkap satu job
grep -nE "✗|gagal|error" ci.log
```

`gh run view --log-failed` kadang kosong untuk job panjang; ambil log lewat `gh api` seperti di
atas. Bila e2e gagal, screenshot tes yang gagal diunggah sebagai artifact **e2e-screenshots**
(halaman run → Artifacts, disimpan 7 hari).

Prinsip umum: **reproduksi di lokal dengan perintah yang sama**, perbaiki, jalankan ulang semua
pemeriksaan, lalu push. Push baru otomatis menjalankan CI dan Deploy lagi.

### CI: Frontend

| Langkah gagal | Penyebab umum | Penanganan |
| --- | --- | --- |
| Lint dan format | Format Prettier atau aturan ESLint | `npx prettier --write <file yang diubah>`, lalu `pnpm lint`. Jangan memformat ulang seluruh `src`. |
| Type check | Error TypeScript, terutama di `.vue`, yang hanya tertangkap `vue-tsc` (contoh nyata: `TS2724` karena tipe diimpor dari file yang salah) | Jalankan `pnpm check` (bukan hanya `astro check`), perbaiki impor atau tipe. |
| Test | Unit test Vitest gagal | `pnpm test`, atau `npx vitest run <path>` untuk satu file. |
| Build | Skema konten (deskripsi > 170 karakter, FAQ di luar 4–6), aset vendor gagal diunduh atau hash tidak cocok | Baca pesan Astro; untuk vendor, cek koneksi dan versi di `scripts/vendor.mjs`. Cache vendor CI berkunci `pnpm-lock.yaml`. |
| Uji browser (e2e) | Lihat tabel berikutnya | `pnpm build`, lalu `node e2e/run.mjs <suite>` di `apps/web`. |

### CI: penyebab e2e yang pernah terjadi

| Gejala | Penyebab | Penanganan |
| --- | --- | --- |
| Jumlah menu navbar tidak sesuai (mis. Media 7, ternyata 8) | Tool baru menambah menu, sedangkan tes menghitung angka tetap | Perbarui angka di `e2e/suites/09-templates.mjs`. |
| `Hydration completed but contains mismatches` di halaman EN | Komponen `client:visible` memformat angka/teks memakai `pageLocale()` saat render server (selalu `id`) | Kirim bahasa dari halaman sebagai prop `locale="en"`/`"id"`. |
| `Applying inline style violates ... style-src` | Kode (atau pustaka) menulis atribut `style` lewat `innerHTML`/`setAttribute`; CSP situs tidak mengizinkan style inline | Terapkan gaya lewat CSSOM (`el.style.x = …`). Untuk maxGraph sudah ada shim `lib/diagram/csp-dom.ts`. |
| `Refused to connect` (connect-src) | Tool memanggil domain luar yang belum diizinkan | Tambahkan domain ke `connect-src` di `astro.config.mjs`. |
| Elemen tidak ditemukan setelah reload | Island `client:visible` belum aktif karena posisi gulir dipulihkan di bawahnya | Di tes, panggil `window.scrollTo(0, 0)` setelah reload. |
| Tes klik dua kali tidak bereaksi | Puppeteer baru: `clickCount` tidak lagi mengirim dblclick | Pakai `page.mouse.click(x, y, { count: 2 })`. |

### CI: Backend dan audit

| Langkah gagal | Penanganan |
| --- | --- |
| Format | `cargo fmt --all` |
| Clippy | Perbaiki peringatan; CI memakai `-D warnings`, jadi semua peringatan menggagalkan build. |
| Test | `cargo test`. Test kompres PDF butuh Ghostscript (dipasang di CI). |
| Audit dependensi Rust | `cargo audit` menemukan celah: update crate yang terdampak (perhatikan aturan umur 2 minggu). Bila belum ada perbaikan, catat alasannya sebelum mengabaikan advisory. |

### Deploy

| Gejala | Penyebab | Penanganan |
| --- | --- | --- |
| Deploy **skipped** | CI gagal | Perbaiki CI lalu push ulang; atau jalankan Deploy manual setelah yakin commit lolos. |
| Build image gagal | Error kompilasi di Dockerfile, atau fitur BuildKit (`--mount`) tidak tersedia saat build lokal | Di CI memakai buildx. Untuk uji lokal, jalankan API dengan `cargo run`. |
| Gagal login/push GHCR | Izin `packages: write` atau token | Cek `permissions` di `deploy.yml` dan pengaturan package di GitHub. |
| Gagal SSH/rsync | Secret `DEPLOY_HOST`, `DEPLOY_PORT` (2222), `DEPLOY_USER`, `DEPLOY_SSH_KEY`, atau `DEPLOY_KNOWN_HOSTS` salah/kedaluwarsa | Periksa di Settings → Environments → production. Bila kunci host VPS berubah, isi ulang `DEPLOY_KNOWN_HOSTS` dari `ssh-keyscan -p 2222 <IP>`. |
| `Uji konfigurasi nginx web` gagal | Sintaks salah di `infra/nginx/web.conf` atau `security-headers.conf` | Rilis lama tetap aktif. Perbaiki konfigurasi lalu push. Uji lokal dengan `docker run nginx:alpine nginx -t`, seperti di `reload-web.sh`. |
| `docker compose pull/up` gagal | Image belum terbit, `.env` di VPS kurang variabel, disk penuh | Cek `docker compose ps` dan `docker compose logs api` di VPS, serta `df -h`. |
| Health check gagal | API tidak hidup atau error saat start | Lihat `docker compose logs --tail=100 api`. Bila mendesak, jalankan `rollback.sh` untuk frontend dan rollback image backend (bagian 4). |
| Endpoint baru 404/400 padahal deploy hijau | Nginx host belum punya `location` untuk endpoint itu (pernah terjadi pada WebSocket Rapat Online) | Salin `infra/nginx/host/toolland.conf` manual (bagian 4), lalu `nginx -t` dan reload. |

### Setelah deploy

| Gejala | Penanganan |
| --- | --- |
| Error console `cloudflareinsights.com/beacon.min.js` diblokir CSP | Cloudflare menyisipkan beacon Web Analytics otomatis. Proyek ini memakai analitik dashboard Cloudflare tanpa beacon: matikan sisipan otomatis di Cloudflare (Analytics & Logs → Web Analytics). |
| Koneksi WebSocket Rapat Online putus sekitar 100 detik | Batas idle WebSocket Cloudflare. Klien sudah mengirim ping tiap 20 detik dan server tiap 25 detik; pastikan perubahan kode tidak menghapusnya. |
| Situs atau API mati | Uptime Kuma mengirim notifikasi Telegram. Buka UI-nya lewat tunnel: `ssh -p 2222 -L 3001:127.0.0.1:3021 <user>@<IP-VPS>`, lalu http://localhost:3001. |

### Pull request Dependabot

Dependabot rutin membuka PR pembaruan paket. Sebelum merge:

1. Pastikan versi baru sudah dirilis minimal 2 minggu.
2. Pastikan CI PR hijau, termasuk Lighthouse.
3. Untuk crate Rust, pastikan versinya cocok dengan yang dipakai dependensi lain (misalnya
   `tokio-tungstenite` harus sama dengan versi yang dipakai `axum`).

## 6. Checklist rilis

1. Semua pemeriksaan di bagian 3 lulus di lokal.
2. Commit hanya file yang relevan, dengan pesan yang menjelaskan perubahan.
3. Push ke `main`, lalu pantau CI dan Deploy (`gh run list`).
4. Bila nginx host berubah, salin manual dan reload.
5. Buka halaman yang berubah di situs live (ID dan EN) dan cek console.
6. Bila ada masalah: rollback dulu, cari penyebab kemudian.

## 7. Dokumen terkait

- [infra/DEPLOY.md](../infra/DEPLOY.md): penyiapan VPS, secret, dan keamanan server.
- [infra/monitoring/README.md](../infra/monitoring/README.md): monitor Uptime Kuma.
- [docs/roadmap-editor-diagram.md](roadmap-editor-diagram.md): tahap dan catatan teknis Editor
  Diagram.
- [docs/roadmap-edit-video.md](roadmap-edit-video.md): roadmap Edit Video.
- [README.md](../README.md): perintah pengembangan dan aset vendor.
