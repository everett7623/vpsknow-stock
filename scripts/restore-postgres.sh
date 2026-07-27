#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
backup_file="${1:-}"

if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "Usage: RESTORE_CONFIRM=YES $0 backups/postgres-TIMESTAMP.dump" >&2
  exit 1
fi
if [ "${RESTORE_CONFIRM:-}" != "YES" ]; then
  echo "Restore replaces the current database. Set RESTORE_CONFIRM=YES to continue." >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "Missing .env." >&2
  exit 1
fi

set -a
. ./.env
set +a

if [ -f "$backup_file.sha256" ]; then
  backup_dir="$(cd "$(dirname "$backup_file")" && pwd -P)"
  backup_name="$(basename "$backup_file")"
  (cd "$backup_dir" && sha256sum --check "$backup_name.sha256")
fi

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Stopping application services..."
compose stop web worker bot
trap 'compose start web worker bot >/dev/null 2>&1 || true' EXIT

echo "Restoring PostgreSQL from $backup_file..."
compose exec -T postgres pg_restore \
  -U "${POSTGRES_USER:-vpsknow}" \
  -d "${POSTGRES_DB:-vpsknow_stock}" \
  --clean --if-exists --no-owner --no-privileges \
  < "$backup_file"

compose start web worker bot
trap - EXIT
echo "Restore complete. Run ./scripts/verify-production.sh next."
