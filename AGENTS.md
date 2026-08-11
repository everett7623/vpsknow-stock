# AGENTS.md — VPSKnow Stock

> AI coding agent instructions for this repository.
> Read this file completely before making any changes.

---

## Project Overview

**VPSKnow Stock** is a real-time VPS restock monitoring platform with Telegram push notifications and a public website. It monitors VPS provider inventory, detects state transitions (out-of-stock → in-stock), and pushes structured alerts to Telegram channels.

- **Website**: `stock.vpsknow.com`
- **Alerts Channel**: `@vpsknow_offers`
- **Subscription Bot**: `@vpsknow_stock_bot`
- **Affiliate**: All order links go through `go.uukk.de`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm 11 |
| Language | TypeScript 5.8+ (strict, no `any`, no `@ts-ignore`) |
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Database | PostgreSQL 17, Prisma ORM 6 |
| Queue | Redis 7 + BullMQ 5 |
| Telegram | grammy 1.x |
| Scraping | cheerio (HTML parsing), Playwright (CF-protected only) |
| Logging | pino |
| Testing | vitest |
| Deployment | VPS Docker Compose (Caddy/web/worker/bot/DB/Redis) |
| Node.js | >=22 |

---

## Repository Structure

```
vpsknow-stock/
├── apps/
│   ├── web/                  # Next.js website (stock.vpsknow.com)
│   ├── worker/               # Stock check scheduler + LET scraping (BullMQ)
│   └── bot/                  # Telegram subscription bot (@vpsknow_stock_bot)
├── packages/
│   ├── config/               # Shared TSConfig, ESLint, Prettier configs
│   ├── database/             # Prisma schema, client, migrations, seed
│   ├── providers/            # Per-provider stock adapters (one file each)
│   ├── parsers/              # LET post parser, product page extractors
│   ├── telegram/             # Message templates, send utilities
│   └── shared/               # Types, constants, utilities
├── docs/
│   ├── TASKS.md              # Complete development document (phase roadmap)
│   └── SPEC.md               # Detailed technical specification
├── docker-compose.yml        # Local dev: PostgreSQL + Redis
├── turbo.json                # Turborepo task config
├── pnpm-workspace.yaml       # Workspace definition
├── .env.example              # Required environment variables
└── AGENTS.md                 # This file
```

---

## Development Commands

```bash
pnpm install                    # Install all dependencies
pnpm build                      # Build all packages and apps
pnpm dev                        # Start all apps in dev mode
pnpm --filter web dev           # Start only website
pnpm --filter worker dev        # Start only worker
pnpm --filter bot dev           # Start only bot
pnpm lint                       # Lint all packages
pnpm typecheck                  # TypeScript strict check
pnpm test                       # Run all tests (vitest)
pnpm --filter providers test    # Test adapters only

# Database
pnpm --filter database db:generate  # Generate Prisma client
pnpm --filter database db:push      # Apply schema to DB
pnpm --filter database db:deploy    # Apply versioned migrations in production
pnpm --filter database db:seed      # Seed initial data (3 providers)
pnpm --filter database studio       # Open Prisma Studio

# Docker (local infrastructure)
docker compose up -d            # Start PostgreSQL + Redis
docker compose down             # Stop all services
```

---

## Architecture Principles

1. **Separate concerns**: Website, worker, and bot are independent services. A worker crash must NOT affect the website or bot.
2. **State-transition driven**: Only push notifications on state changes (OOS → IN_STOCK), never on every check cycle.
3. **False positive prevention**: Require ≥2 consecutive `inStock` confirmations before firing a restock event.
4. **Deduplication**: Same product not re-notified within 60 minutes.
5. **Jitter**: All check intervals include ±20% random offset.
6. **Rate limiting**: Max 1 concurrent request per provider domain.
7. **Resilience**: Circuit breaker per provider (open after 5 failures, half-open after 5 min).

---

## Key Domain Concepts

| Term | Definition |
|------|-----------|
| **Restock** | Product transitions from out-of-stock to in-stock |
| **Adapter** | Module that checks a specific provider's stock status |
| **StockResult** | Return type from adapter: provider, plan, location, specs, price, inStock |
| **Stock Event** | Recorded state change (restock or sold-out) |
| **Offer** | A new LET deal/promotion (distinct from restock) |
| **Confidence Score** | 0–1 metric for LET post parse quality |
| **Provider Slug** | URL-safe identifier (e.g., `bandwagonhost`, `dmit`, `buyvm`) |

---

## Current Status

**Phase 1 — MVP (acceptance) + Phase 4 polish (in progress)**

Monitoring allowlist: **19 active** providers (shared `MONITORED_PROVIDERS` drives seed + worker + bot).
VMISS is website-inactive; restocks are ingested from a public TG preview into `@vpsknow_offers` with our aff links.
Recent polish on `main`: provider spec filters, offers region/limited, bot coarse regions + `subscribe_{slug}`, product `ipv4` / `bandwidthLabel` / catalog `Unknown` status.

### Remaining
- [ ] 24h stability test run
- [ ] Live end-to-end integration / false-positive rate check
- [x] VMISS TG-preview restock ingest (site hidden; push via our restock template + aff)
- [ ] HighEndNetwork adapter (blocked on CF challenge)

---

## Phase 1 Provider Priority

| # | Provider | Focus | Check Interval |
|---|----------|-------|---------------|
| 1 | **BandwagonHost** | Limited plans, DC6/DC9/HK, restocks | 1–2 min |
| 2 | **DMIT** | PVM, Premium, Eyeball, by location | 2–3 min |
| 3 | **BuyVM** | KVM Slice, Storage Slice, location stock | 1–2 min |

Phase 2 adds: GreenCloudVPS, SpartanHost, VMISS, V.PS, SaltyFish

---

## Coding Rules

### TypeScript
- **Strict mode**: No `any`, no `@ts-ignore`, no `as unknown as X` hacks.
- **Node16 module resolution** for all non-Next.js packages.
- **Explicit return types** for exported functions.
- **Use `.js` extension** in relative imports (ESM compat): `import { foo } from './bar.js'`

### Provider Adapters
- One file per provider in `packages/providers/src/adapters/`.
- Must implement the `ProviderAdapter` interface (slug, name, check()).
- Must return `StockResult[]` — even if empty.
- Must handle HTTP errors gracefully (throw with descriptive message).
- Must include `User-Agent: VPSKnow-Stock/1.0` header.
- Must use `AbortSignal.timeout(15_000)` for HTTP requests.
- Must be registered in `packages/providers/src/registry.ts`.
- Each adapter should have unit tests with mocked HTML fixtures.

### Telegram Messages
- Restock and LET Offers → `@vpsknow_offers` channel
- Keep Restock and Offer as distinct event types for formatting and Bot subscriptions.
- Format: structured text with emoji, not raw data dumps.
- All order links MUST go through `go.uukk.de` affiliate.

### Database
- Schema lives in `packages/database/prisma/schema.prisma`.
- Always use `prisma` client exported from `@vpsknow/database`.
- Migrations via `prisma migrate dev`.
- Seed script in `packages/database/prisma/seed.ts`.

### Testing
- Use vitest for unit tests.
- Mock HTML fixtures for adapter tests (don't hit real URLs in tests).
- Test file location: alongside source or in `__tests__/` directory.

---

## Anti-Patterns — NEVER Do These

- ❌ Push "in stock" every check cycle — only on state transitions
- ❌ Monitor always-in-stock cloud providers (Vultr, DO, Hetzner Cloud)
- ❌ Put monitoring logic in Next.js / Vercel Cron
- ❌ Run all services in single process
- ❌ Use "last reply time" for LET newness (use Discussion ID dedup)
- ❌ Conflate Restock and Offer event types because they share one public channel
- ❌ Fabricate stock events or push stale data as new
- ❌ Hard-code API keys or secrets in source files
- ❌ Use `any` type or disable TypeScript checks
- ❌ Make breaking changes to adapter interface without updating all adapters

---

## Environment Variables

Required env vars (see `.env.example`):

```
DATABASE_URL          # PostgreSQL connection string
REDIS_URL             # Redis connection string
TELEGRAM_BOT_TOKEN    # Bot token from @BotFather
TELEGRAM_OFFERS_CHANNEL_ID  # @vpsknow_offers
TELEGRAM_ADMIN_CHAT_ID      # Admin notifications
AFFILIATE_BASE_URL          # https://go.uukk.de
NODE_ENV              # development | production
LOG_LEVEL             # info | debug | warn | error
```

Optional provider proxies (Cloudflare-blocked scrapes; never commit credentials):

```
DMIT_PROXY_URL        # Preferred egress for DMIT HTTP/curl/Playwright
VMISS_PROXY_URL       # Preferred egress for VMISS HTTP/curl fetches
VPS_PROXY_URL         # Preferred egress for V.PS
PROVIDER_PROXY_URL    # Shared fallback for providers that honor resolveProviderProxyUrl()
```

---

## Key Interfaces

### StockResult (packages/providers/src/types.ts)

```typescript
interface StockResult {
  provider: string;
  productId: string;
  planName: string;
  location: string;
  category: ProductCategory;
  cpu: string;
  ramMb: number;
  storageGb: number;
  storageType: string;
  bandwidthTb: number;
  ipv4: boolean;
  ipv6: boolean;
  price: number;          // cents
  currency: string;
  billingCycle: BillingCycle;
  inStock: boolean;
  orderUrl: string;
  raw?: unknown;
}
```

### ProviderAdapter (packages/providers/src/types.ts)

```typescript
interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
```

---

## Reference Documents

- `docs/TASKS.md` — Full development roadmap with all phases and detailed tasks
- `docs/SPEC.md` — Technical specification (DB schema, interfaces, message formats)
- `README.md` — Public-facing project overview

---

## Adding a New Provider Adapter

1. Create `packages/providers/src/adapters/{slug}.ts`
2. Implement `ProviderAdapter` interface
3. Register in `packages/providers/src/registry.ts`
4. Add entry to `packages/shared/src/monitored-providers.ts` (`MONITORED_PROVIDERS`)
5. Add seed provider/affiliate records in `packages/database/prisma/seed.ts`
6. Add HTML fixture test in `packages/providers/src/adapters/__tests__/`
7. Update Provider Registry table in `docs/TASKS.md`

---

## Deployment

### Local Development
```bash
docker compose up -d        # Start PostgreSQL + Redis
pnpm --filter database db:push && pnpm --filter database db:seed
pnpm dev                    # Start all services
```

### Production
- **Complete stack**: Caddy, website, worker, bot, PostgreSQL, and Redis run through `docker-compose.production.yml` on the VPS
- **Public ports**: Only Caddy exposes 80/443; PostgreSQL and Redis stay on the private Docker network
- **New adapter**: Run in "dry-run" mode for 24h before activating push
- **Local deployment credentials**: Read VPS connection settings from the git-ignored project file `.env.deploy.local`
- **Credential handling**: Use the `VPSKNOW_DEPLOY_*` variables without printing, committing, or copying their values into commands, logs, or tracked files
