# Deploy Toolland ke VPS

Setelah setup sekali di bawah ini, setiap push ke `main` yang lolos CI otomatis:

1. membangun image API dan mengirimnya ke GitHub Container Registry (`ghcr.io/marsel23xxx/toolland-api`),
2. mengirim hasil build frontend ke `/srv/toolland/web/releases/<commit>/`,
3. memindah symlink `current` ke rilis baru (atomik, tanpa downtime),
4. menjalankan ulang container API, lalu memeriksa health check.

## 1. Siapkan VPS (sekali)

```sh
# user khusus deploy, boleh menjalankan docker
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/toolland/web/releases
sudo chown -R deploy:deploy /srv/toolland

# file .env (isi dari .env.example, tanpa rahasia di repo)
sudo -u deploy cp .env.example /srv/toolland/.env   # lalu sesuaikan isinya
```

Catatan: anggota grup `docker` setara root di VPS. Pakai key SSH khusus untuk deploy saja.

Bila package GHCR `toolland-api` masih private, login sekali sebagai user deploy:
`docker login ghcr.io -u marsel23xxx` (pakai Personal Access Token dengan izin `read:packages`).
Atau jadikan package publik di GitHub (repo memang publik).

## 2. Key SSH untuk GitHub Actions

```sh
ssh-keygen -t ed25519 -f toolland-deploy -C "github-actions" -N ""
# isi toolland-deploy.pub ke /home/deploy/.ssh/authorized_keys di VPS
ssh-keyscan -t ed25519 <IP-VPS>      # hasilnya untuk DEPLOY_KNOWN_HOSTS
```

## 3. Secret di GitHub

Buka repo, **Settings → Environments → New environment** bernama `production`, lalu tambahkan secret:

| Secret               | Isi                                         |
| -------------------- | ------------------------------------------- |
| `DEPLOY_HOST`        | IP VPS (bukan domain, karena domain lewat Cloudflare) |
| `DEPLOY_USER`        | `deploy`                                    |
| `DEPLOY_SSH_KEY`     | isi file `toolland-deploy` (private key)    |
| `DEPLOY_KNOWN_HOSTS` | hasil `ssh-keyscan` di atas                 |

Lindungi branch `main` di **Settings → Branches**: wajib pull request dan CI hijau.

## 4. Nginx host, sertifikat, dan logrotate (sekali, sebagai root)

```sh
sudo cp infra/nginx/host/julian-marcell.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/julian-marcell.com.conf /etc/nginx/sites-enabled/
sudo cp infra/logrotate/toolland /etc/logrotate.d/toolland
sudo nginx -t && sudo systemctl reload nginx
```

Sertifikat Origin Certificate dan CA Authenticated Origin Pulls ditaruh di `/etc/ssl/cloudflare/`
(nama file ada di komentar `julian-marcell.com.conf`). Langkah memindah DNS ke Cloudflare ada di PRD,
bagian Infrastruktur.

## Rollback

```sh
ssh deploy@<IP-VPS> /srv/toolland/infra/scripts/rollback.sh          # ke rilis sebelumnya
ssh deploy@<IP-VPS> /srv/toolland/infra/scripts/rollback.sh <commit> # ke rilis tertentu
```

Backend: jalankan ulang compose dengan tag commit sebelumnya,

```sh
API_IMAGE=ghcr.io/marsel23xxx/toolland-api:<commit> \
CONVERTER_IMAGE=ghcr.io/marsel23xxx/toolland-converter:<commit> \
docker compose --env-file ../.env up -d api converter
```
