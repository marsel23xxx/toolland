# Monitoring

Uptime Kuma berjalan dari `infra/docker-compose.yml`, UI hanya di `127.0.0.1:3001`.
Buka lewat SSH tunnel: `ssh -L 3001:127.0.0.1:3001 <user>@<vps>`, lalu http://localhost:3001.

Monitor yang dibuat (interval 60 detik, notifikasi Telegram):

| Nama        | Tipe                | URL                                                 |
| ----------- | ------------------- | --------------------------------------------------- |
| Halaman     | HTTP(s)             | https://julian-marcell.com/                         |
| API health  | HTTP(s) - Keyword   | https://julian-marcell.com/api/tools/v1/health (`"ok"`) |

Metrics Prometheus dari API ditambahkan di Fase 3.
