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
TELEGRAM_STOCK_CHANNEL_ID=@vpsknow_stock
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
```

The `migrate` service applies versioned Prisma migrations and seeds providers before Web,
Worker, and Bot start. Caddy obtains and renews the TLS certificate when DNS
already points to the VPS.

After startup, verify `https://$SITE_DOMAIN`, the worker health state, and the
Telegram bot before enabling production channel notifications.

## Updates

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
