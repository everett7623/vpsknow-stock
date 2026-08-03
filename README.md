# VPSKnow Stock

> VPS Restock & Offer Alerts Platform

Real-time VPS restock monitoring and LowEndTalk offer aggregation, powered by [VPSKnow](https://vpsknow.com).

## Overview

VPSKnow Stock monitors VPS provider inventory and LowEndTalk offers, delivering instant notifications via Telegram and a public-facing stock status website.

- **Website**: `stock.vpsknow.com`
- **Alerts Channel**: `@vpsknow_offers`
- **Subscription Bot**: `@vpsknow_stock_bot`

## Architecture

```text
apps/
├── web/          # Next.js — public stock website
├── worker/       # Stock monitoring + LET scraping
└── bot/          # Telegram bot

packages/
├── database/     # Prisma schema & client
├── providers/    # Per-provider stock adapters
├── parsers/      # LET & product page parsers
├── telegram/     # Message templates & send utils
├── shared/       # Types, constants, utilities
└── config/       # Shared ESLint, TSConfig
```

## Tech Stack

- **Frontend**: Next.js (App Router)
- **Language**: TypeScript (strict)
- **Database**: PostgreSQL
- **Queue**: Redis + BullMQ
- **ORM**: Prisma
- **Telegram**: grammy
- **Monorepo**: Turborepo + pnpm
- **Deployment**: Full VPS Docker Compose (web, worker, bot, PostgreSQL, Redis, Caddy)

## Development

```bash
pnpm install
pnpm dev
```

## Production on a VPS

The complete stack runs on one VPS. Caddy terminates HTTPS, while Web, Worker,
Bot, PostgreSQL, and Redis remain on the private Docker network.

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD, TELEGRAM_* secrets, SITE_DOMAIN,
# NEXT_PUBLIC_SITE_URL, and ADMIN_DASHBOARD_TOKEN in .env.
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f worker
./scripts/verify-production.sh
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for first deployment and updates.

## License

MIT
