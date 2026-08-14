#!/usr/bin/env bash
# Creates a verified logical PostgreSQL backup on the separately mounted volume.
# This is a local recovery layer, not a substitute for an encrypted off-server copy.

set -euo pipefail
umask 077

BACKUP_ROOT="${ZHANGAK_BACKUP_ROOT:-/mnt/HC_Volume_106608581/zhangak-backups}"
POSTGRES_CONTAINER="${ZHANGAK_POSTGRES_CONTAINER:-zhangak-postgres}"
POSTGRES_USER="${ZHANGAK_POSTGRES_USER:-zhangak}"
POSTGRES_DATABASE="${ZHANGAK_POSTGRES_DATABASE:-zhangak}"
RETENTION_DAYS="${ZHANGAK_BACKUP_RETENTION_DAYS:-14}"

if ! [[ "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "ZHANGAK_BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 64
fi

if ! mountpoint -q "$(dirname "$BACKUP_ROOT")" && ! mountpoint -q "$BACKUP_ROOT"; then
  echo "Backup root is not located on a mounted filesystem: $BACKUP_ROOT" >&2
  exit 69
fi

backup_dir="$BACKUP_ROOT/postgres"
install -d -m 0700 "$backup_dir"

exec 9>"$backup_dir/.backup.lock"
if ! flock -n 9; then
  echo "Another Zhangak PostgreSQL backup is already running" >&2
  exit 75
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="$backup_dir/.zhangak-$timestamp.dump.partial"
archive="$backup_dir/zhangak-$timestamp.dump"
checksum="$archive.sha256"

cleanup_partial() {
  rm -f -- "$temporary"
}
trap cleanup_partial EXIT

docker inspect --type container "$POSTGRES_CONTAINER" >/dev/null

docker exec "$POSTGRES_CONTAINER" pg_dump \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DATABASE" \
  --format=custom \
  --no-owner \
  --no-acl > "$temporary"

test -s "$temporary"

# Validate the archive structure before publishing it. This does not restore data.
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list < "$temporary" >/dev/null

mv -- "$temporary" "$archive"
sha256sum "$archive" > "$checksum"
trap - EXIT

# Retain at least the configured number of recent daily archives and checksums.
find "$backup_dir" -maxdepth 1 -type f \( -name 'zhangak-*.dump' -o -name 'zhangak-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -print -delete

echo "Zhangak PostgreSQL backup complete: $archive"
