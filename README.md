# VPSKnow Stock

> VPS Restock & Offer Alerts Platform

Real-time VPS restock monitoring and LowEndTalk offer aggregation, powered by [VPSKnow](https://vpsknow.com).

## Overview

VPSKnow Stock monitors VPS provider inventory and LowEndTalk offers, delivering instant notifications via Telegram and a public-facing stock status website.

- **Website**: `stock.vpsknow.com`
- **Restock Channel**: `@vpsknow_stock`
- **Offers Channel**: `@vpsknow_offers`
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
- **Deployment**: Vercel (web) + VPS Docker (workers/bot)

## Development

```bash
pnpm install
pnpm dev
```

## License

MIT
