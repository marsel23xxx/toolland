#!/bin/sh
# Kembali ke rilis frontend sebelumnya (atau ke versi tertentu).
# Pemakaian (di VPS): rollback.sh [versi] [folder-web]
set -eu
ROOT="${2:-/srv/toolland/web}"
CURRENT="$(basename "$(readlink "$ROOT/current")")"
TARGET="${1:-$(ls -1dt "$ROOT"/releases/*/ | xargs -n1 basename | grep -vx "$CURRENT" | head -n1)}"
[ -n "$TARGET" ] || { echo "tidak ada rilis lain" >&2; exit 1; }
exec "$(dirname "$0")/activate-release.sh" "$TARGET" "$ROOT"
