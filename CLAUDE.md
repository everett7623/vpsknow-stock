# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VPSKnow Stock is a real-time VPS restock monitoring and LowEndTalk offer aggregation platform. It monitors VPS provider inventory, scrapes LowEndTalk offers, and delivers instant notifications via Telegram channels and a public website (stock.vpsknow.com).

Three services:
- **web**: Next.js public-facing stock website
- **worker**: Stock monitoring + LET scraping (BullMQ queues)
- **bot**: Telegram subscription bot (@vpsknow_stock_bot)

## Tech Stack

- **Monorepo**: Turborepo with pnpm workspaces
- **Language**: TypeScript 5.8+ (strict mode — no `any`, no `@ts-ignore`)
- **Runtime**: Node.js >=22
- **Frontend**: Next.js 15 with App Router, React 19, Tailwind 4
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis + BullMQ
- **Scraping**: cheerio (HTML parsing), Playwright (Cloudflare-protected providers only)
- **Telegram**: grammy library
- **Deployment**: Docker Compose with Caddy reverse proxy

## Common Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start all apps in dev mode
pnpm build                # Build all apps
pnpm typecheck            # Type-check all packages
pnpm lint                 # Lint all packages
pnpm test                 # Run all tests
pnpm format               # Format all files with Prettier

# Target a single app or package
pnpm --filter web dev
pnpm --filter worker dev
pnpm --filter bot dev
pnpm --filter providers test
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
pnpm test                                               # All tests
cd apps/worker && pnpm test stock-engine.test.ts        # Single test file
cd packages/providers && pnpm test --watch              # Watch mode
```

### Production Operations
```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml restart worker
./scripts/backup-postgres.sh
./scripts/restore-postgres.sh backups/postgres-*.dump
./scripts/verify-production.sh
```

## Architecture

### Core Data Flow

1. **Stock Monitoring**: Worker schedules provider checks via BullMQ → Provider adapters fetch stock → Stock engine processes results → Detects restock events → Notifies Telegram channels + subscribers
2. **Offer Discovery**: Worker schedules LET scraping → LET parser extracts offers → Offers engine scores and filters → Pushes to Telegram offers channel
3. **Subscriptions**: Users interact with @vpsknow_stock_bot → Bot stores preferences in DB → Worker notifies matching subscribers on restock events

### Architecture Principles

- **State-transition driven**: Only push notifications on OOS → IN_STOCK transitions, never on every check cycle
- **False positive prevention**: Require `CONSECUTIVE_CONFIRMS_REQUIRED` (2) consecutive in-stock checks before firing a restock event
- **Deduplication**: `RESTOCK_COOLDOWN_MS` (60 min) prevents re-notifying the same product
- **Jitter**: All check intervals include ±20% random offset via `withJitter()`
- **Rate limiting**: Max 1 concurrent request per provider domain
- **Circuit breaker**: Auto-pauses provider after `ADAPTER_PAUSED_THRESHOLD` (5) consecutive failures; recovers after 30 min

### Package Structure

- `packages/database`: Prisma schema and client (all apps depend on this)
- `packages/providers`: Provider-specific stock adapters (registry pattern)
- `packages/parsers`: LowEndTalk HTML parsing
- `packages/telegram`: Message formatting and sending utilities
- `packages/shared`: Types, constants (RESTOCK_COOLDOWN_MS, CONSECUTIVE_CONFIRMS_REQUIRED, LOCATION_ALIASES, REGION_MAP)
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

The registry (`packages/providers/src/registry.ts`) maps slug → adapter instance. `HostHatchAdapter` is conditionally registered only when `HOSTHATCH_API_TOKEN` is set.

**Provider tiers and intervals:**
- **S-Tier** (90–300s): bandwagonhost (90s), buyvm (90s), dmit/hosthatch/spartanhost (150s), greencloudvps (180s), vmiss/vps/saltyfish/akilecloud (300s)
- **A-Tier** (180s): racknerd, clouvider, liteserver, crunchbits, servarica, evoxt, alwyzon, dedirock, onidel
- **B-Tier** (300s): tierhive, gullos, webhorizon

When adding a new provider:
1. Create `packages/providers/src/adapters/{slug}.ts`
2. Implement the `ProviderAdapter` interface
3. Register in `packages/providers/src/registry.ts`
4. Add seed data in `packages/database/prisma/seed.ts`
5. Add interval in `apps/worker/src/index.ts` PROVIDER_INTERVALS
6. Add HTML fixture test in `packages/providers/src/adapters/__tests__/`

### Stock Check Lifecycle

The worker's stock engine (`apps/worker/src/stock-engine.ts`) implements confidence-based restock detection:

- `Product.consecutiveConfirm` increments on each in-stock check; resets on out-of-stock
- Restock fires only when `consecutiveConfirm >= CONSECUTIVE_CONFIRMS_REQUIRED`
- `Product.lastStockChangeAt` gates the 60-minute cooldown deduplication

### Telegram Integration

- Restock events → `@vpsknow_stock` channel
- LET offers → `@vpsknow_offers` channel
- All order links **must** go through `go.uukk.de` affiliate URLs
- `packages/telegram/src/send.ts`: `sendChannelMessage`, `sendPrivateMessage`
- `packages/telegram/src/templates.ts`: message formatters
- Bot handles `/start`, `/subscribe`, `/unsubscribe`, `/settings`
- Telegram rate limit: avoid more than ~20 messages/minute to channels

## Coding Rules

### TypeScript

- Strict mode: no `any`, no `@ts-ignore`, no `as unknown as X` casts
- Use `.js` extension in all relative imports (ESM): `import { foo } from './bar.js'`
- Explicit return types on all exported functions

### Provider Adapters

- Include `User-Agent: VPSKnow-Stock/1.0` header on all HTTP requests
- Use `AbortSignal.timeout(15_000)` on all HTTP requests
- Return `StockResult[]` — even if empty on a valid response
- Throw with a descriptive message on HTTP/parse errors
- Unit tests must use mocked HTML fixtures; never hit real URLs in tests

## Anti-Patterns

- Never push "in stock" on every check cycle — only on OOS → IN_STOCK state transitions
- Never monitor always-in-stock cloud providers (Vultr, DigitalOcean, Hetzner Cloud)
- Never put monitoring logic in Next.js / Vercel Cron
- Never use `any` or disable TypeScript checks
- Never hard-code secrets in source files
- Never use LET last-reply time for deduplication — use Discussion ID
- Never push LET posts to the restock channel — they go to `@vpsknow_offers`
- Never make breaking changes to `ProviderAdapter` without updating all adapters

## Environment Variables

```
DATABASE_URL                 # PostgreSQL connection string
REDIS_URL                    # Redis connection string
TELEGRAM_BOT_TOKEN           # Bot API token from @BotFather
TELEGRAM_STOCK_CHANNEL_ID    # @vpsknow_stock
TELEGRAM_OFFERS_CHANNEL_ID   # @vpsknow_offers
TELEGRAM_ADMIN_CHAT_ID       # Admin notifications chat
AFFILIATE_BASE_URL           # https://go.uukk.de
NODE_ENV                     # development | production
LOG_LEVEL                    # info | debug | warn | error
HOSTHATCH_API_TOKEN          # Optional — enables authenticated HostHatch adapter
```

See `.env.example` for the complete list.

## Reference Documents

- `docs/TASKS.md` — Full development roadmap with all phases and detailed tasks
- `docs/SPEC.md` — Technical specification (DB schema, interfaces, message formats)
- `docs/DEPLOYMENT.md` — Production deployment procedures
