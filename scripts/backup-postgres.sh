#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [ ! -f .env ]; then
  echo "Missing .env." >&2
  exit 1
fi

case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2; exit 1 ;;
esac

set -a
. ./.env
set +a

mkdir -p "$BACKUP_DIR"
repo_dir="$(pwd -P)"
backup_dir="$(cd "$BACKUP_DIR" && pwd -P)"
case "$backup_dir" in
  "$repo_dir"/*) ;;
  *) echo "BACKUP_DIR must resolve inside the repository." >&2; exit 1 ;;
esac

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/postgres-$timestamp.dump"
temporary="$(mktemp "$backup_dir/.postgres-$timestamp.XXXXXX")"
trap 'rm -f "$temporary"' EXIT

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-vpsknow}" -d "${POSTGRES_DB:-vpsknow_stock}" --format=custom \
  > "$temporary"

if [ ! -s "$temporary" ]; then
  echo "Backup is empty." >&2
  exit 1
fi

mv "$temporary" "$target"
trap - EXIT
(
  cd "$backup_dir"
  sha256sum "$(basename "$target")" > "$(basename "$target").sha256"
)

find "$backup_dir" -type f \( -name 'postgres-*.dump' -o -name 'postgres-*.dump.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

echo "Backup created: $target"
