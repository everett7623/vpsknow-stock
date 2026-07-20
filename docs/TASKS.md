# VPSKnow Stock — Development Task Document

> Last updated: 2026-07-20
> Status: Phase 1 — Not Started

---

## Table of Contents

- [Project Summary](#project-summary)
- [Technical Decisions](#technical-decisions)
- [Phase 1 — MVP](#phase-1--mvp)
- [Phase 2 — LET + Full First Batch](#phase-2--let--full-first-batch)
- [Phase 3 — Bot + Subscriptions](#phase-3--bot--subscriptions)
- [Phase 4 — Polish + Scale](#phase-4--polish--scale)
- [Provider Registry](#provider-registry)
- [Constraints & Anti-Patterns](#constraints--anti-patterns)
- [Acceptance Criteria](#acceptance-criteria)

---

## Project Summary

| Key | Value |
|-----|-------|
| Name | VPSKnow Stock |
| Repo | `everett7623/vpsknow-stock` (private) |
| Website | `stock.vpsknow.com` |
| Restock Channel | `@vpsknow_stock` |
| Offers Channel | `@vpsknow_offers` |
| Subscription Bot | `@vpsknow_stock_bot` |
| Affiliate Base | `go.uukk.de` |

**Core principle**: Restock (state transition `OOS → IN_STOCK`) and Offer (new LET post / deal) are distinct event types, pushed to separate channels, sharing the same infrastructure.

---

## Technical Decisions

| Layer | Choice | Notes |
|-------|--------|-------|
| Monorepo | Turborepo + pnpm | `apps/` + `packages/` |
| Frontend | Next.js (App Router) | Deployed to Vercel |
| Language | TypeScript strict | No `any`, no `@ts-ignore` |
| Database | PostgreSQL | Prisma ORM |
| Queue | Redis + BullMQ | Job scheduling, retry, dedup |
| Telegram | grammy | Channel push + bot |
| Browser | Playwright | Only for Cloudflare-protected pages |
| Deployment (web) | Vercel | `stock.vpsknow.com` |
| Deployment (worker/bot) | VPS + Docker Compose | Independently restartable |
| Node.js | >=22 | |

### Monorepo Layout

```text
vpsknow-stock/
├── apps/
│   ├── web/                  # Next.js website
│   ├── worker/               # Stock check + LET scraping
│   └── bot/                  # Telegram bot
├── packages/
│   ├── database/             # Prisma schema, client, migrations
│   ├── providers/            # Per-provider stock adapters
│   ├── parsers/              # LET post parser, product page extractors
│   ├── telegram/             # Message templates, send utilities
│   ├── shared/               # Types, constants, utilities
│   └── config/               # ESLint, TSConfig, Prettier
├── docker-compose.yml
├── turbo.json
├── package.json
└── README.md
```

### Deployment Topology

```text
Vercel ──── apps/web (stock.vpsknow.com)

VPS (Docker Compose)
├── apps/worker
├── apps/bot
├── PostgreSQL
└── Redis
```

Website, worker, bot are independently deployable. A worker crash does not affect the website or bot.

### Database Tables

```text
providers          — Merchant info, affiliate, monitoring config
products           — Individual plans: specs, price, stock status
stock_checks       — Per-product check log (timestamp, result, error)
stock_events       — Restock / sold-out state transitions
offers             — LET offers + manual deals
subscriptions      — Telegram user subscription filters
telegram_messages  — Sent message log (dedup, audit)
affiliate_links    — go.uukk.de short links per provider
```

Full schema definition: see `docs/SPEC.md` §3.

---

## Phase 1 — MVP

**Goal**: 3 providers monitored, restock push to Telegram, minimal website.
**Duration**: 4–6 weeks.

### Task 1.1 — Monorepo Scaffold

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | — |

- [ ] Init Turborepo + pnpm workspace
- [ ] Create `apps/web`, `apps/worker`, `apps/bot` stubs
- [ ] Create `packages/database`, `packages/providers`, `packages/parsers`, `packages/telegram`, `packages/shared`, `packages/config`
- [ ] Root `turbo.json` with `build`, `dev`, `lint`, `typecheck` pipelines
- [ ] Shared `tsconfig.json` base in `packages/config`
- [ ] ESLint + Prettier config in `packages/config`
- [ ] Root `docker-compose.yml` with PostgreSQL + Redis services
- [ ] `.env.example` with all required env vars

**Done when**: `pnpm install && pnpm build` passes from root with no errors.

---

### Task 1.2 — Database Schema + Prisma

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | 1.1 |

- [ ] Prisma schema in `packages/database/prisma/schema.prisma`
- [ ] Tables: `providers`, `products`, `stock_checks`, `stock_events`, `affiliate_links`, `telegram_messages`
- [ ] Seed script: 3 providers (BuyVM, HostHatch, GreenCloudVPS) with known products
- [ ] `packages/database` exports generated Prisma client
- [ ] Migration runs clean against local Docker PostgreSQL

**Done when**: `pnpm --filter database db:push && pnpm --filter database db:seed` succeeds, tables visible in psql.

---

### Task 1.3 — Provider Adapter Framework

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | 1.1 |

- [ ] Define `StockResult` and `ProviderAdapter` interfaces in `packages/providers/src/types.ts`
- [ ] Implement adapter registry: `getAdapter(slug) → ProviderAdapter`
- [ ] Implement 3 adapters:
  - `buyvm.ts` — Parse order page, detect slice availability by location
  - `hosthatch.ts` — Parse product/pricing pages for active plans
  - `greencloud.ts` — Parse product pages, detect stock per location
- [ ] Each adapter returns `StockResult[]`
- [ ] Unit tests per adapter with mocked HTML fixtures

**Adapter interface**:

```ts
export interface StockResult {
  provider: string;
  productId: string;
  planName: string;
  location: string;
  price: number;          // cents
  currency: string;
  billingCycle: string;   // monthly | quarterly | annually
  inStock: boolean;
  orderUrl: string;
  raw?: unknown;
}

export interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
```

**Done when**: `pnpm --filter providers test` passes, each adapter returns valid `StockResult[]` against fixture HTML.

---

### Task 1.4 — Stock Check Worker

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | 1.2, 1.3 |

- [ ] BullMQ queue: `stock-check` with per-provider repeatable jobs
- [ ] Job processor: call adapter → compare with DB → detect state transitions
- [ ] Restock detection logic:
  - Require ≥2 consecutive `inStock: true` checks
  - Reject error pages, CF challenges, login walls
  - Dedup: same product not re-notified within 60 min
- [ ] Write `stock_checks` row per check
- [ ] Write `stock_events` row on state transition
- [ ] Update `products.in_stock` and `products.last_stock_change_at`
- [ ] Check intervals:
  - BuyVM: 1–2 min
  - HostHatch, GreenCloud: 2–3 min
  - All with ±20% random jitter
- [ ] Error handling:
  - 5 consecutive failures → mark "degraded"
  - 20 consecutive failures → pause job, log alert
  - Exponential backoff on retries
- [ ] Max 1 concurrent request per provider domain
- [ ] Graceful shutdown on SIGTERM

**Done when**: Worker runs in Docker, checks 3 providers on schedule, correctly logs stock_checks and fires stock_events on simulated state changes.

---

### Task 1.5 — Telegram Channel Push

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | 1.4 |

- [ ] `packages/telegram` module: message formatter + send client (grammy)
- [ ] Restock message template:
  ```
  🟢 RESTOCK — {provider}

  📍 {location}
  💻 {planName}
  ├── CPU: {cpu}
  ├── RAM: {ram}
  ├── Storage: {storage}
  └── Price: {price}/{cycle}

  ⏱ Detected: {timestamp} UTC
  🔗 Order: {affiliateUrl}
  ```
- [ ] On `stock_events.event_type = restock` → format + send to `@vpsknow_stock`
- [ ] Record `telegram_messages` row with message_id
- [ ] Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_STOCK_CHANNEL_ID`
- [ ] Retry on Telegram API failure (3 attempts, 5s backoff)

**Done when**: A simulated restock event sends a correctly formatted message to a test Telegram channel.

---

### Task 1.6 — Minimal Website

| Item | Detail |
|------|--------|
| Priority | P1 |
| Depends on | 1.2 |

- [ ] Next.js App Router in `apps/web`
- [ ] Pages:
  - `/` — Homepage: latest restocks, provider list
  - `/providers` — Provider directory
  - `/provider/[slug]` — Provider detail: current stock, plans, last check time
- [ ] Homepage sections:
  - Latest Restocks (from `stock_events`)
  - Popular Providers (static for v1)
  - Recently Sold Out
- [ ] Provider page:
  - In Stock plans (sorted by price)
  - Sold Out plans (greyed)
  - Last check timestamp
  - Order link (affiliate)
  - Telegram subscribe button
- [ ] Responsive, dark theme, clean developer-tool aesthetic
- [ ] All order links go through `go.uukk.de`
- [ ] "Last checked" timestamp visible per provider
- [ ] If adapter stale >30 min → show "Status Unknown"

**Done when**: `pnpm --filter web build` succeeds, pages render with real DB data.

---

### Task 1.7 — Docker Compose + Deploy

| Item | Detail |
|------|--------|
| Priority | P1 |
| Depends on | 1.4, 1.5, 1.6 |

- [ ] `docker-compose.yml`:
  - `postgres` (PostgreSQL 16)
  - `redis` (Redis 7)
  - `worker` (apps/worker)
  - `bot` (apps/bot, placeholder for Phase 3)
- [ ] Dockerfiles for worker and bot
- [ ] `.env.example` with all required vars
- [ ] `docker compose up` starts full local stack
- [ ] Vercel project setup for `apps/web` → `stock.vpsknow.com`
- [ ] VPS deployment script or guide for worker stack

**Done when**: Full stack runs locally via `docker compose up`. Website accessible at localhost. Worker checks providers and sends test Telegram messages.

---

## Phase 2 — LET + Full First Batch

**Goal**: All 10 S-tier providers + LowEndTalk Offer engine.
**Duration**: 2–3 weeks.
**Depends on**: Phase 1 complete.

### Task 2.1 — Remaining 7 Provider Adapters

| Item | Detail |
|------|--------|
| Priority | P0 |

- [ ] `spartanhost.ts`
- [ ] `bandwagonhost.ts`
- [ ] `dmit.ts`
- [ ] `vmiss.ts`
- [ ] `netcup.ts`
- [ ] `akilecloud.ts`
- [ ] `vps.ts` (V.PS)
- [ ] Unit tests per adapter with HTML fixtures
- [ ] Register all in adapter registry
- [ ] Add BullMQ jobs with appropriate intervals

**Done when**: All 10 providers running in worker, stock_checks accumulating.

---

### Task 2.2 — LowEndTalk Offer Engine

| Item | Detail |
|------|--------|
| Priority | P0 |

Discovery pipeline (4 layers):

- [ ] **Layer 1 — RSS**: Poll `https://lowendtalk.com/categories/offers/feeds.rss` every 2–3 min. Extract discussion ID, title, author, timestamp, URL.
- [ ] **Layer 2 — HTML Fallback**: Scrape `https://lowendtalk.com/categories/offers` page. Same fields. Dedup by discussion ID. Catches RSS outages.
- [ ] **Layer 3 — Post Detail**: For new discussion IDs, fetch post body. Extract:
  - Provider name
  - Category (VPS / VDS / Dedicated / NAT VPS / Storage)
  - Price + billing cycle
  - CPU, RAM, Storage, Bandwidth
  - Location(s)
  - Coupon code
  - Order URL
  - Flags: `is_limited_stock`, `is_recurring`, `is_preorder`
- [ ] **Layer 4 — Filter Rules**:
  - **Include**: VPS/VDS/NAT VPS/Dedicated + has pricing + (whitelisted provider OR title matches `Limited|Flash|Restock|Stock|LET Special`)
  - **Exclude**: Shared Hosting, Domain, Email, SSL, Service Transfers, WTB, free proxy/VPN, no-price posts
- [ ] Write to `offers` table
- [ ] Dedup key: LET Discussion ID only (NEVER use "last reply time")
- [ ] Only process discussions created after worker's first-run timestamp

**Done when**: Worker discovers and parses LET Offers, writes to DB, filters correctly.

---

### Task 2.3 — Offers Telegram Push

| Item | Detail |
|------|--------|
| Priority | P0 |
| Depends on | 2.2 |

- [ ] Offer message template:
  ```
  🔥 NEW OFFER — {provider}

  📦 {specs summary}
  📍 {locations}
  💰 {price}/{cycle}

  ├── Category: {category}
  ├── Billing: {billing}
  ├── Source: LowEndTalk
  └── Posted: {date}

  🔗 Order: {affiliateUrl}
  🔗 Thread: {letUrl}
  ```
- [ ] Push filtered offers to `@vpsknow_offers`
- [ ] Record in `telegram_messages`

**Done when**: New LET offers appear in test Telegram channel with correct formatting.

---

### Task 2.4 — Website Offers Pages

| Item | Detail |
|------|--------|
| Priority | P1 |
| Depends on | 2.2 |

- [ ] `/offers` — All offers, filterable
- [ ] `/provider/[slug]/[plan]` — Plan detail: specs, price, stock timeline
- [ ] Filters: Provider, Category, Location, Billing, Price range, IPv4
- [ ] Homepage add: "LowEndTalk New Offers" and "Limited Offers" sections

**Done when**: Offers pages render with real data from DB, filters work.

---

## Phase 3 — Bot + Subscriptions

**Goal**: Users can self-serve subscribe to specific providers/locations/prices.
**Duration**: 2–3 weeks.
**Depends on**: Phase 2 complete.

### Task 3.1 — Subscription Bot

| Item | Detail |
|------|--------|
| Priority | P0 |

- [ ] grammy bot in `apps/bot`
- [ ] Commands:
  - `/start` — Welcome + guide
  - `/subscribe` — Interactive filter setup (inline keyboards)
  - `/providers` — List monitored providers
  - `/status` — Show current subscription filters
  - `/mute [hours]` — Temporarily mute
  - `/unmute` — Resume
  - `/help` — Reference
- [ ] Subscription filters stored in `subscriptions` table:
  - Provider whitelist
  - Location whitelist
  - Category whitelist
  - Max price
  - Event types (restocks, offers, both)
- [ ] On restock/offer event → check all subscriptions → send matching users
- [ ] Rate limit: max 1 message per user per 30 seconds

**Done when**: Bot responds to commands, stores filters, delivers personalized notifications.

---

## Phase 4 — Polish + Scale

**Goal**: Second batch providers, analytics, admin, hardening.
**Duration**: Ongoing.

- [ ] Second batch provider adapters (9 Tier A + 3 Tier B)
- [ ] Price history charts on provider/plan pages
- [ ] Admin dashboard: provider management, manual stock override, adapter health
- [ ] Proxy rotation for CF-protected providers
- [ ] Playwright integration for JS-rendered pages
- [ ] Error alerting (dead adapters, API changes → admin notification)
- [ ] SEO: meta tags, structured data, sitemap
- [ ] Mobile-responsive refinement
- [ ] Hetzner Server Auction monitor (special case)
- [ ] Performance: DB indexes, query optimization, cache layer

---

## Provider Registry

### S-Tier — Phase 1+2 (Restock Monitoring)

| # | Provider | Focus | Interval |
|---|----------|-------|----------|
| 1 | BuyVM | Slice, Storage Slice, location stock | 1–2 min |
| 2 | HostHatch | Annual deals, Storage, Asia | 2–3 min |
| 3 | GreenCloudVPS | Tokyo, SG, HK, Storage, annual | 2–3 min |
| 4 | SpartanHost | Seattle, Dallas, AMD, routing | 2–3 min |
| 5 | BandwagonHost | Limited plans, DC6/DC9, restocks | 2–3 min |
| 6 | DMIT | PVM, Premium, Eyeball, by location | 5 min |
| 7 | VMISS | CN2, BGP, HK, JP, LA | 5 min |
| 8 | Netcup | VPS/RS specials, limited promos | 5 min |
| 9 | AkileCloud | HK, JP, SG, optimized routing | 5 min |
| 10 | V.PS | JP, SG, EU limited plans | 5 min |

### A-Tier — Phase 4 (Offers + Limited Stock)

RackNerd, DediRock, Onidel, Evoxt, Crunchbits, ServaRICA, Alwyzon, LiteServer, Clouvider.

### B-Tier — Phase 4 (NAT VPS Niche)

TierHive, Gullo's Hosting, WebHorizon.

### Directory Only (No Monitoring)

Hetzner Cloud, Vultr, DigitalOcean, UpCloud, InterServer, Raksmart, LightLayer, 华纳云, Kinsta, Cloudways, SiteGround.

Exception: Hetzner Server Auction + special dedicated → monitor in Phase 4.

---

## Constraints & Anti-Patterns

### Must Do

- All check intervals include ±20% random jitter
- Max 1 concurrent request per provider domain
- Restock requires ≥2 consecutive `inStock` confirmations
- Same product not re-notified within 60 min
- "Last checked" timestamp always visible to users
- Stale adapter (>30 min) shows "Status Unknown" on website
- All order links through `go.uukk.de` affiliate
- Exponential backoff on consecutive failures
- LET dedup by Discussion ID only, NEVER "last reply time"

### Must NOT Do

- ❌ Monitor all providers at once — start with 10
- ❌ Use 机场/代理-related domains
- ❌ Dump all LET posts into restock channel
- ❌ Treat always-in-stock cloud providers as restock targets
- ❌ Build user accounts, payment, or premium tiers in v1
- ❌ Put monitoring logic in Next.js / Vercel Cron
- ❌ Run all services in single process
- ❌ Push "in stock" every check cycle — only on state transitions
- ❌ Use "last reply time" for LET newness
- ❌ Fabricate stock events or push stale data as new

---

## Acceptance Criteria

### Phase 1 MVP — Ready When

- [ ] 3 providers (BuyVM, HostHatch, GreenCloudVPS) checked on schedule
- [ ] Restock correctly detected (consecutive confirmation, dedup)
- [ ] Telegram restock message sent to channel with correct format
- [ ] Website shows homepage, provider list, provider detail with live data
- [ ] Docker Compose runs full local stack
- [ ] Worker runs >24h without crash or memory leak
- [ ] False positive rate <5% over 48h test run
- [ ] `pnpm build` passes all apps
- [ ] `pnpm lint && pnpm typecheck` clean

### Phase 1 Success Metrics

| Metric | Target |
|--------|--------|
| Providers monitored | 10 (by end of Phase 2) |
| Check uptime | >99% |
| Restock detection latency | <3 min |
| False positive rate | <5% |
| TG subscribers (month 1) | 200+ |
| Website daily visitors (month 1) | 100+ |
| Affiliate click-through | Tracked per provider |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/vpsknow_stock

# Redis
REDIS_URL=redis://localhost:6379

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_STOCK_CHANNEL_ID=
TELEGRAM_OFFERS_CHANNEL_ID=

# Affiliate
AFFILIATE_BASE_URL=https://go.uukk.de

# App
NODE_ENV=development
LOG_LEVEL=info
```

---

## Future Considerations (Post-MVP)

- Discord integration
- Email digest (weekly restock summary)
- Browser push notifications
- Public API for stock status
- Provider comparison tool
- Historical pricing analytics
- Community voting on provider reliability
- Integration with VPSKnow blog posts

---

*Reference: `docs/SPEC.md` for full technical specification.*
*This document tracks development tasks and their status.*
