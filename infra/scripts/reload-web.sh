#!/bin/sh
# Terapkan perubahan konfigurasi nginx container web (web.conf, security-headers.conf).
#
# Kedua file di-mount sebagai file tunggal. rsync mengganti file dengan file baru, sedangkan
# container tetap memegang file lama, jadi perubahan baru aktif setelah container dibuat ulang.
# Skrip ini menguji konfigurasi baru dulu, lalu membuat ulang container web hanya bila isinya
# berubah sejak terakhir diterapkan (deploy biasa tidak menyebabkan jeda).
#
# Pemakaian (di VPS):
#   reload-web.sh check   uji konfigurasi baru saja (dipakai sebelum rilis diaktifkan)
#   reload-web.sh apply   uji, lalu buat ulang container web bila konfigurasi berubah
set -eu
MODE="${1:-apply}"
INFRA="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$INFRA/../.nginx-applied"

# Uji di container sementara dengan file baru (container web yang berjalan tidak tersentuh).
docker run --rm \
  -v "$INFRA/nginx/web.conf:/etc/nginx/conf.d/default.conf:ro" \
  -v "$INFRA/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  nginx:alpine nginx -t -q
echo "konfigurasi nginx valid"
[ "$MODE" = check ] && exit 0

NEW="$(cat "$INFRA/nginx/web.conf" "$INFRA/nginx/security-headers.conf" | sha256sum | cut -d' ' -f1)"
OLD="$(cat "$STAMP" 2>/dev/null || true)"
if [ "$NEW" = "$OLD" ]; then
  echo "konfigurasi nginx tidak berubah"
  exit 0
fi
cd "$INFRA"
docker compose --env-file ../.env up -d --force-recreate --no-deps web
echo "$NEW" > "$STAMP"
echo "container web dibuat ulang dengan konfigurasi baru"
