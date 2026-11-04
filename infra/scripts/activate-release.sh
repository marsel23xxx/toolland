#!/bin/sh
# Aktifkan rilis frontend secara atomik: symlink current dipindah ke releases/<versi>.
# Container web me-mount folder induknya, jadi perubahan langsung aktif tanpa restart.
# Pemakaian (di VPS): activate-release.sh <versi> [folder-web]
set -eu
VERSION="$1"
ROOT="${2:-/srv/toolland/web}"
KEEP=5

test -f "$ROOT/releases/$VERSION/index.html" || { echo "rilis $VERSION tidak lengkap" >&2; exit 1; }
ln -sfn "releases/$VERSION" "$ROOT/current.tmp"
mv -Tf "$ROOT/current.tmp" "$ROOT/current"
echo "aktif: $VERSION"

# Simpan 5 rilis terbaru untuk rollback, hapus sisanya (rilis aktif tidak pernah dihapus).
ls -1dt "$ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r dir; do
  [ "$(basename "$dir")" = "$VERSION" ] || rm -rf "$dir"
done
