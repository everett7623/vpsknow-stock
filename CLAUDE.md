# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VPSKnow Stock is a real-time VPS restock monitoring and LowEndTalk offer aggregation platform. It monitors VPS provider inventory, scrapes LowEndTalk offers, and delivers instant notifications via Telegram channels and a public website (stock.vpsknow.com).

The system consists of three main services:
- **web**: Next.js public-facing stock website
- **worker**: Stock monitoring + LET scraping (BullMQ queues)
- **bot**: Telegram subscription bot

## Tech Stack

- **Monorepo**: Turborepo with pnpm workspaces
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js >=22
- **Frontend**: Next.js 15 with App Router, React 19, Tailwind 4
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis + BullMQ
- **Telegram**: grammy library
- **Deployment**: Docker Compose with Caddy reverse proxy

## Common Commands

### Development
```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode (web, worker, bot)
pnpm build                # Build all apps
pnpm typecheck            # Type-check all packages
pnpm lint                 # Lint all packages
pnpm test                 # Run all tests
```

### Per-App Development
```bash
cd apps/web && pnpm dev          # Next.js on port 3000
cd apps/worker && pnpm dev       # Worker with tsx watch
cd apps/bot && pnpm dev          # Bot with tsx watch
pnpm format                      # Format all files with Prettier
```

### Database Operations
```bash
cd packages/database
pnpm db:generate          # Generate Prisma Client
pnpm db:push              # Push schema changes (dev)
pnpm db:migrate           # Create and apply migration
pnpm db:deploy            # Apply migrations (production)
pnpm db:seed              # Seed providers
pnpm studio               # Open Prisma Studio
```

### Testing
```bash
pnpm test                 # Run all tests
cd apps/worker && pnpm test      # Run worker tests only
cd packages/providers && pnpm test   # Test provider adapters
```

### Production Operations
```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml restart worker
./scripts/backup-postgres.sh     # Create database backup
./scripts/restore-postgres.sh backups/postgres-*.dump
./scripts/verify-production.sh   # Verify deployment health
```

## Architecture

### Core Data Flow

1. **Stock Monitoring**: Worker schedules provider checks via BullMQ → Provider adapters fetch stock → Stock engine processes results → Detects restock events → Notifies Telegram channels + subscribers
2. **Offer Discovery**: Worker schedules LET scraping → LET parser extracts offers → Offers engine scores and filters → Pushes to Telegram offers channel
3. **Subscriptions**: Users interact with @vpsknow_stock_bot → Bot stores preferences in DB → Worker notifies matching subscribers on restock events

### Package Structure

- `packages/database`: Prisma schema and client (all apps depend on this)
- `packages/providers`: Provider-specific stock adapters (registry pattern)
- `packages/parsers`: LowEndTalk HTML parsing
- `packages/telegram`: Message formatting and sending utilities
- `packages/shared`: Types, constants (e.g., RESTOCK_COOLDOWN_MS, CONSECUTIVE_CONFIRMS_REQUIRED)
- `packages/config`: Shared ESLint and TypeScript configs

### Provider Adapters

Located in `packages/providers/src/adapters/`. Each adapter implements the `ProviderAdapter` interface:

```typescript
interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
```

Adapters scrape provider websites and return normalized `StockResult[]`. The registry in `packages/providers/src/registry.ts` exports all adapters. 

**Current providers by tier:**
- **S-Tier** (90-300s intervals): bandwagonhost, buyvm, dmit, greencloudvps, hosthatch, spartanhost, vmiss, vps, saltyfish, akilecloud
- **A-Tier** (180s intervals): racknerd, clouvider, liteserver, crunchbits, servarica, evoxt, alwyzon, dedirock, onidel
- **B-Tier** (300s intervals): tierhive, gullos, webhorizon

When adding a new provider:

1. Create `packages/providers/src/adapters/newprovider.ts`
2. Implement the `ProviderAdapter` interface
3. Add to registry exports
4. Seed the provider in `packages/database/prisma/seed.ts`
5. Add interval in `apps/worker/src/index.ts` PROVIDER_INTERVALS
6. Add tests in `packages/providers/src/adapters/newprovider.test.ts`

### Stock Check Lifecycle

The worker's stock engine (`apps/worker/src/stock-engine.ts`) implements a confidence-based restock detection system:

- **Consecutive confirmation**: Requires `CONSECUTIVE_CONFIRMS_REQUIRED` (default 2) consecutive in-stock checks before announcing a restock
- **Cooldown period**: `RESTOCK_COOLDOWN_MS` prevents duplicate notifications for the same product
- **State tracking**: `Product.consecutiveConfirm` tracks confirmation count, `Product.lastStockChangeAt` tracks state transitions

This prevents false positives from transient provider API issues.

### Database Schema Key Points

- **Provider**: Static provider metadata (slug, name, tier, isActive)
- **Product**: Tracked VPS products with stock state and history
- **StockCheck**: Raw check results (retained for N days, see maintenance.ts)
- **StockEvent**: Restock/sold-out events linked to Telegram messages
- **Offer**: LowEndTalk offers with confidence scoring
- **Subscription**: User preferences for targeted notifications
- **AffiliateLink**: URL shortener mappings for affiliate tracking

### Worker Job Scheduling

The worker (`apps/worker/src/index.ts`) uses BullMQ with provider-specific intervals defined in `PROVIDER_INTERVALS`. Jobs are scheduled with jitter to prevent thundering herd. Provider health tracking (`provider-health.ts`) pauses providers after repeated failures.

Key background jobs:
- **Stock checks**: Per-provider repeating jobs (see PROVIDER_INTERVALS)
- **LET scraping**: Every ~150s (with jitter)
- **Data retention**: Daily cleanup of old StockCheck records

### Telegram Integration

- `packages/telegram/src/send.ts`: sendChannelMessage, sendPrivateMessage
- `packages/telegram/src/templates.ts`: Message formatters (restock, offers)
- Worker sends to public channels (@vpsknow_stock, @vpsknow_offers)
- Worker notifies individual subscribers based on their filters
- Bot handles /start, /subscribe, /unsubscribe, /settings commands

## Development Guidelines

### TypeScript

- Strict mode enabled across all packages
- Use workspace protocol for internal packages: `"@vpsknow/database": "workspace:*"`
- Shared tsconfig in `packages/config/tsconfig.base.json`

### Linting

- Shared ESLint config in `packages/config/eslint.cjs`
- Apps extend this config (see `apps/*/package.json` lint scripts)
- Run `pnpm lint` from root to check all packages

### Testing

- Vitest for unit/integration tests
- Integration tests use real Prisma client (not mocked)
- Stock pipeline integration test: `apps/worker/src/stock-pipeline.integration.test.ts`
- Provider adapter tests verify parsing logic with fixtures
- Run single test file: `cd apps/worker && pnpm test stock-engine.test.ts`
- Watch mode: `cd packages/providers && pnpm test --watch`

### Adding Features

When adding features that span multiple packages:

1. Update database schema in `packages/database/prisma/schema.prisma`
2. Run `pnpm db:migrate` to create migration
3. Add shared types/constants to `packages/shared`
4. Implement business logic in worker engines or bot handlers
5. Update web UI if needed
6. Add tests for new logic

### Environment Variables

Required for development:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `TELEGRAM_BOT_TOKEN`: Bot API token
- `TELEGRAM_STOCK_CHANNEL_ID`: Stock channel (@vpsknow_stock)
- `TELEGRAM_OFFERS_CHANNEL_ID`: Offers channel (@vpsknow_offers)
- `TELEGRAM_ADMIN_CHAT_ID`: Admin notifications chat

See `.env.example` for complete list.

### Docker Development

Local development typically uses `pnpm dev` directly. Docker Compose is primarily for production deployment. To test production builds locally:

```bash
docker compose up -d --build
docker compose logs -f worker
```

## Deployment Notes

- Production runs on a single VPS via `docker-compose.production.yml`
- Caddy handles HTTPS termination and certificates
- PostgreSQL and Redis are not exposed to host
- Migrations run automatically via `migrate` service before app startup
- See `docs/DEPLOYMENT.md` for detailed deployment procedures
- Database backups via `scripts/backup-postgres.sh` (recommended daily cron)

## Important Constraints

- Provider check intervals in `PROVIDER_INTERVALS` should respect rate limits
- Stock checks retain for configurable days (see `runDataRetention` in maintenance.ts)
- Telegram rate limits apply: avoid sending more than ~20 messages/minute to channels
- Provider health system auto-pauses providers after `ADAPTER_PAUSED_THRESHOLD` consecutive failures
- Restock confidence system requires consecutive confirms to reduce false positives
