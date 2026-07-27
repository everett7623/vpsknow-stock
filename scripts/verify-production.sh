#!/bin/sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

if [ ! -f .env ]; then
  echo "Missing .env. Create it from .env.example and set production secrets." >&2
  exit 1
fi

set -a
. ./.env
set +a

if [ -z "${SITE_DOMAIN:-}" ]; then
  echo "SITE_DOMAIN is required in .env." >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

echo "Validating Compose configuration..."
compose config --quiet

echo "Checking service state..."
compose ps

echo "Checking PostgreSQL..."
compose exec -T postgres pg_isready -U "${POSTGRES_USER:-vpsknow}" -d "${POSTGRES_DB:-vpsknow_stock}"

echo "Checking Redis..."
redis_status="$(compose exec -T redis redis-cli ping)"
if [ "$redis_status" != "PONG" ]; then
  echo "Redis returned: $redis_status" >&2
  exit 1
fi

echo "Checking Worker dependencies..."
compose exec -T worker node -e "fetch('http://127.0.0.1:3001/health').then(async (response) => { console.log(await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"

echo "Checking public Web endpoint..."
curl --fail --silent --show-error --retry 10 --retry-delay 3 "https://${SITE_DOMAIN}/api/health"
echo

echo "Production smoke checks passed."
