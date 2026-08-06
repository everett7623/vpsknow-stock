# VPSKnow Stock VPS Deployment

This deployment runs the complete application on one VPS:

```text
Internet -> Caddy (:80/:443) -> Web (:3000)
                         -> PostgreSQL
                         -> Redis -> Worker
Telegram Bot -> Bot
```

PostgreSQL and Redis are not published to the VPS host. Only Caddy exposes
ports `80` and `443`.

## Deployment authorization

Routine development ends after the requested documentation/code changes are committed and
pushed to `main`. A request to continue development, update documentation, commit, or push does
not authorize a production deployment.

Do not connect to the VPS, run Docker, pull production code, rebuild containers, restart
services, or otherwise change production unless the user explicitly requests deployment in the
current task. Local Docker is also not required for routine code/documentation updates unless a
specific validation step needs it and the user has asked for that validation.

## Requirements

- A Linux VPS with Docker Engine and the Compose plugin
- A DNS `A` or `AAAA` record pointing the site domain to the VPS
- Telegram bot token and channel/admin chat IDs
- At least 2 GB RAM recommended for the first deployment
- TCP ports 80 and 443 open in the VPS firewall

## First deployment

```bash
git clone https://github.com/everett7623/vpsknow-stock.git
cd vpsknow-stock
cp .env.example .env
```

Set these values in `.env`:

```env
POSTGRES_PASSWORD=use-a-long-random-password
SITE_DOMAIN=stock.example.com
NEXT_PUBLIC_SITE_URL=https://stock.example.com
ADMIN_DASHBOARD_TOKEN=use-another-long-random-secret
TELEGRAM_BOT_TOKEN=...
TELEGRAM_OFFERS_CHANNEL_ID=@vpsknow_offers
TELEGRAM_ADMIN_CHAT_ID=...
```

Use an alphanumeric or otherwise URL-safe PostgreSQL password because Compose
also embeds it in `DATABASE_URL`. Do not publish PostgreSQL port 5432 or Redis
port 6379 on the VPS firewall.

Start the stack:

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 migrate
./scripts/verify-production.sh
```

The `migrate` service applies versioned Prisma migrations and seeds providers before Web,
Worker, and Bot start. Caddy obtains and renews the TLS certificate when DNS
already points to the VPS.

After startup, verify `https://$SITE_DOMAIN`, the worker health state, and the
Telegram bot before enabling production channel notifications.

The smoke script validates Compose syntax and checks PostgreSQL, Redis, Worker
dependencies, and the public Web database health endpoint. A real Telegram
message to a test chat remains a manual deployment acceptance step.

## Updates

Run the following production commands only after an explicit deployment request. They are
operational references, not automatic follow-up steps after pushing `main`.

```bash
git pull --ff-only
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs --tail=100 worker
```

## Operations

```bash
docker compose -f docker-compose.production.yml logs -f web
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml restart worker
docker compose -f docker-compose.production.yml down
```

Do not remove the named volumes unless the PostgreSQL and Redis data is
backed up first.

## Cold standby migration

Keep daily Postgres dumps off the application VPS. To move to a replacement host:

1. Provision a new VPS and install Docker Engine + Compose
2. Clone this repository and copy the production `.env`
3. Restore the latest dump with `RESTORE_CONFIRM=YES ./scripts/restore-postgres.sh …`
4. Start the stack with `docker compose -f docker-compose.production.yml up -d --build`
5. Point `stock.vpsknow.com` at the new IP after `./scripts/verify-production.sh` passes

Do not run Worker/Bot on both hosts at the same time or Telegram alerts will duplicate.
A same-provider panel snapshot is useful for emergency rollback on that provider, but
cross-provider migration should use Compose + database restore, not a full disk image.

## Database backups

Create a compressed PostgreSQL backup and checksum:

```bash
./scripts/backup-postgres.sh
```

Backups remain under `backups/` for 14 days by default. Copy this directory to
separate storage; a backup kept only on the application VPS does not protect
against disk or VPS loss. Example daily cron entry:

```cron
0 3 * * * cd /opt/vpsknow-stock && ./scripts/backup-postgres.sh >> /var/log/vpsknow-backup.log 2>&1
```

Test restoration during a maintenance window:

```bash
RESTORE_CONFIRM=YES ./scripts/restore-postgres.sh backups/postgres-TIMESTAMP.dump
./scripts/verify-production.sh
```

The restore script stops Web, Worker, and Bot before replacing database
objects, verifies the checksum when present, and restarts the services.
