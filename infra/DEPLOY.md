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

## 5. Keamanan VPS (sekali, sebagai root)

Pintu masuk ke server adalah SSH, jadi bagian ini yang paling penting. VPS dipakai bersama project
lain: cek dulu port yang dipakai project lain sebelum menyalakan firewall.

```sh
# SSH hanya dengan key, tanpa password, tanpa login root.
# Pastikan key SSH kamu sendiri sudah bisa login sebelum menjalankan ini.
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  | sudo tee /etc/ssh/sshd_config.d/90-hardening.conf
sudo sshd -t && sudo systemctl reload ssh

# Firewall: hanya SSH, HTTP, HTTPS (tambahkan port project lain bila ada).
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable

# Update keamanan sistem otomatis, dan blokir IP yang menebak-nebak password SSH.
sudo apt install -y unattended-upgrades fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```

Docker melewati aturan ufw untuk port yang dibuka container. Karena itu semua port Toolland di
`docker-compose.yml` sengaja hanya dibuka ke `127.0.0.1` (8081, 8082, 3001); jangan diubah menjadi
`0.0.0.0` atau tanpa IP.

Di Cloudflare: SSL/TLS mode **Full (strict)** dan **Authenticated Origin Pulls** aktif. Nginx host
menolak koneksi tanpa sertifikat Cloudflare (`ssl_verify_client on`), jadi orang yang tahu IP VPS
tetap tidak bisa membuka situs atau API secara langsung tanpa melewati Cloudflare.

Di GitHub, **Settings → Environments → production → Deployment branches**: hanya `main`, supaya
secret deploy tidak bisa dipakai dari branch lain.

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
