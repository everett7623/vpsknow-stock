# VPSKnow Stock — Development Specification

> VPS Restock & Offer Alerts Platform

---

## 1. Project Overview

### 1.1 Positioning

VPSKnow Stock is a sub-product of VPSKnow, focused on real-time VPS restock monitoring and LowEndTalk offer aggregation. It is NOT a standalone brand — it leverages VPSKnow's existing audience, affiliate links, and content ecosystem.

### 1.2 Naming & Domains

| Item | Value |
|------|-------|
| Project Name | VPSKnow Stock |
| Website | `stock.vpsknow.com` |
| Restock Channel | `@vpsknow_stock` |
| Offers Channel | `@vpsknow_offers` |
| Subscription Bot | `@vpsknow_stock_bot` |
| Affiliate Base | `go.uukk.de` |

> Telegram usernames require registration-time availability check.

### 1.3 Core Principle

**Restock ≠ Offers.** These are two distinct event types:

- **Restock**: State transition `OUT_OF_STOCK → IN_STOCK` for a known product.
- **Offer**: A new post/deal discovered from LowEndTalk or a provider's announcement.

They share infrastructure but serve different user intents and are delivered to separate channels.

---

## 2. Architecture

### 2.1 Monorepo Structure

```text
vpsknow-stock/
├── apps/
│   ├── web/                  # Next.js — public-facing stock website
│   ├── worker/               # Node.js — stock monitoring + LET scraping
│   └── bot/                  # Telegram Bot — channel push + user subscriptions
│
├── packages/
│   ├── database/             # Prisma schema, migrations, client
│   ├── providers/            # Per-provider stock check adapters
│   ├── parsers/              # LET post parser, product page extractors
│   ├── telegram/             # Message templates, send utilities
│   ├── shared/               # Types, constants, utilities
│   └── config/               # Shared ESLint, TSConfig, Prettier
│
├── docker-compose.yml
├── turbo.json                # Turborepo config
├── package.json              # Root workspace
└── README.md
```

### 2.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL |
| ORM | Prisma |
| Queue | Redis + BullMQ |
| Monitoring | Node.js workers in Docker |
| Browser Automation | Playwright (when needed) |
| Telegram | grammy or telegraf |
| Package Manager | pnpm (workspace) |
| Build System | Turborepo |
| Deployment (web) | Vercel |
| Deployment (workers/bot) | VPS + Docker Compose |
| Node.js | >=22 |

### 2.3 Deployment Topology

```text
┌─────────────────────────────────────────────┐
│  Vercel                                     │
│  └── apps/web (stock.vpsknow.com)           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  VPS (Docker Compose)                       │
│  ├── apps/worker (stock + offers engine)    │
│  ├── apps/bot (Telegram bot)                │
│  ├── PostgreSQL                             │
│  └── Redis                                  │
└─────────────────────────────────────────────┘
```

Website crashes do NOT affect monitoring. Worker crashes do NOT affect the bot. Services are independently restartable.

---

## 3. Database Schema

### 3.1 Core Tables

```text
providers
├── id, slug, name, logo_url
├── website_url, affiliate_url
├── let_username
├── monitor_enabled, stock_push_enabled, offer_push_enabled
├── check_interval_seconds
└── created_at, updated_at

products
├── id, provider_id
├── slug, name, category (vps|vds|dedicated|nat_vps|storage)
├── location, datacenter
├── cpu, ram_mb, storage_gb, storage_type
├── bandwidth_tb, ipv4, ipv6
├── price_cents, currency, billing_cycle
├── order_url, affiliate_url
├── in_stock, last_stock_change_at
├── monitor_enabled
└── created_at, updated_at

stock_checks
├── id, product_id
├── checked_at
├── in_stock (boolean)
├── raw_response_hash
└── error (nullable)

stock_events
├── id, product_id
├── event_type (restock|sold_out)
├── detected_at
├── notified_at (nullable)
├── telegram_message_id (nullable)
└── suppressed (boolean, for dedup)

offers
├── id, provider_id (nullable)
├── source (lowendtalk|provider_blog|manual)
├── source_id (discussion_id for LET)
├── source_url
├── title, body_excerpt
├── price_cents, currency, billing_cycle
├── category, location
├── coupon_code (nullable)
├── order_url, affiliate_url
├── is_limited_stock, is_recurring
├── published_at
├── notified_at (nullable)
└── created_at

subscriptions
├── id, telegram_user_id
├── filter_providers (jsonb)
├── filter_locations (jsonb)
├── filter_max_price_cents (nullable)
├── filter_categories (jsonb)
├── notify_restocks, notify_offers
└── created_at, updated_at

telegram_messages
├── id, channel, message_id
├── event_type (restock|offer)
├── reference_id (stock_event_id or offer_id)
└── sent_at

affiliate_links
├── id, provider_id
├── short_url (go.uukk.de/xxx)
├── target_url
└── created_at
```

---

## 4. Provider Monitoring

### 4.1 First Batch — 10 Providers (S-Tier)

| # | Provider | Focus |
|---|----------|-------|
| 1 | BuyVM | Slice, Storage Slice, location stock |
| 2 | HostHatch | Annual deals, Storage, Asia locations |
| 3 | GreenCloudVPS | Tokyo, Singapore, HK, Storage, annual |
| 4 | SpartanHost | Seattle, Dallas, AMD, routing plans |
| 5 | BandwagonHost | Limited plans, DC6/DC9, restocks |
| 6 | DMIT | PVM, Premium, Eyeball, by location |
| 7 | VMISS | CN2, BGP, HK, JP, LA |
| 8 | Netcup | VPS/RS specials, limited promos |
| 9 | AkileCloud | HK, JP, SG, optimized routing |
| 10 | V.PS | JP, SG, EU limited plans |

### 4.2 Provider Adapter Interface

```ts
// packages/providers/types.ts

export interface StockResult {
  provider: string;
  productId: string;
  planName: string;
  location: string;
  price: number;          // cents
  currency: string;       // USD, EUR, etc.
  billingCycle: string;   // monthly, quarterly, annually
  inStock: boolean;
  orderUrl: string;
  raw?: unknown;          // for debugging
}

export interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
```

Each provider gets its own file:

```text
packages/providers/src/
├── index.ts
├── types.ts
├── buyvm.ts
├── hosthatch.ts
├── greencloud.ts
├── spartanhost.ts
├── bandwagonhost.ts
├── dmit.ts
├── vmiss.ts
├── netcup.ts
├── akilecloud.ts
└── vps.ts
```

### 4.3 Check Frequency

| Tier | Providers | Interval |
|------|-----------|----------|
| Hot | BuyVM, limited plans | 1–2 min |
| Active | HostHatch, GreenCloud, SpartanHost | 2–3 min |
| Standard | Others | 5–10 min |
| LET RSS | LowEndTalk Offers | 2–3 min |
| Price Pages | Provider pricing | 30–60 min |

All intervals include random jitter (±20%) to avoid synchronized bursts.

### 4.4 False Positive Prevention

A restock event fires ONLY when ALL conditions are met:

1. **Consecutive confirmation**: ≥2 consecutive checks return `inStock: true`.
2. **Valid product signal**: Buy button / product ID / add-to-cart exists.
3. **Not an error page**: Not a login wall, 403, 503, Cloudflare challenge, or empty response.
4. **Deduplication**: Same product not notified within the last 60 minutes.
5. **Sold-out events**: Only update DB status; do NOT push to channel unless configured.

---

## 5. LowEndTalk Offer Engine

### 5.1 Discovery Pipeline

```text
Layer 1: RSS Feed
    URL: https://lowendtalk.com/categories/offers/feeds.rss
    Poll: every 2–3 min
    Extract: discussion ID, title, author, timestamp, URL

Layer 2: HTML Fallback
    URL: https://lowendtalk.com/categories/offers
    Purpose: catch posts missed by RSS (known RSS reliability issues)
    Dedup by: discussion ID

Layer 3: Post Detail Fetch
    Trigger: new discussion ID discovered
    Extract: full body, structured fields (see below)

Layer 4: Rule-Based Filter
    Pass → DB insert → push to @vpsknow_offers
    Reject → skip silently
```

### 5.2 Extracted Fields

From each LET Offer post, extract:

- Provider name
- Category: VPS / VDS / Dedicated / NAT VPS / Storage
- Lowest price + billing cycle
- CPU, RAM, Storage, Bandwidth
- Location(s)
- Coupon code (if any)
- Order URL
- Flags: `is_limited_stock`, `is_recurring`, `is_preorder`

### 5.3 Filter Rules (v1)

**Include** if:

- Category is VPS, VDS, NAT VPS, or Dedicated Server
- Has explicit pricing
- Provider is in whitelist OR title contains: `Limited`, `Flash`, `Restock`, `Stock`, `LET Special`

**Exclude**:

- Shared Hosting, Domain, Email, SSL
- Service Transfers
- WTB (Want to Buy) posts
- Free proxy/VPN offers
- Hosting company sales (business transfers)
- Posts with no clear pricing

### 5.4 Deduplication

- Key: LET Discussion ID
- NEVER use "last reply time" as a newness signal (old threads get bumped constantly)
- Only process discussions created after the worker's first-run timestamp

---

## 6. Telegram Integration

### 6.1 Channel Message Formats

#### Restock Notification (`@vpsknow_stock`)

```text
🟢 RESTOCK — BuyVM

📍 Las Vegas
💻 Slice 1024
├── CPU: 1 Core
├── RAM: 1 GB
├── Storage: 20 GB SSD
└── Price: $3.50/mo

⏱ Detected: 2026-07-20 12:36 UTC
🔗 Order: go.uukk.de/buyvm
```

#### LET Offer (`@vpsknow_offers`)

```text
🔥 NEW OFFER — HostHatch

📦 4 GB RAM / 50 GB NVMe
📍 9 Locations
💰 $35/year (recurring)

├── Category: VPS
├── Billing: Annual
├── Source: LowEndTalk
└── Posted: 2026-07-20

🔗 Order: go.uukk.de/hosthatch
🔗 Thread: lowendtalk.com/discussion/xxxxx
```

### 6.2 Bot Commands (`@vpsknow_stock_bot`)

```text
/start          — Welcome + setup guide
/subscribe      — Interactive filter setup
/providers      — List available providers
/status         — Current subscription filters
/mute [hours]   — Temporarily mute notifications
/unmute         — Resume notifications
/help           — Command reference
```

### 6.3 Subscription Filters

Users can subscribe by:

- Provider (e.g., only BuyVM + DMIT)
- Location (e.g., only Asia)
- Category (e.g., only VPS + NAT VPS)
- Max price (e.g., ≤ $5/mo or ≤ $50/yr)
- Event type (restocks only, offers only, or both)

---

## 7. Website Pages

### 7.1 Page Structure

```text
/                           — Homepage: latest restocks, limited offers, popular providers
/restocks                   — All restock events, filterable
/offers                     — All offers (LET + provider), filterable
/providers                  — Provider directory
/provider/[slug]            — Provider detail: current stock, history, plans
/provider/[slug]/[plan]     — Plan detail: specs, price, stock timeline
/about                      — About VPSKnow Stock
```

### 7.2 Homepage Sections

1. **Latest Restocks** — Most recent restock events
2. **Limited Offers** — Offers tagged as limited stock
3. **LowEndTalk New Offers** — Latest LET posts that passed filters
4. **Popular Providers** — Top monitored providers by user interest
5. **Recently Sold Out** — Products that just went OOS (creates urgency)

### 7.3 Provider Page (`/provider/[slug]`)

- Provider info: name, logo, website, affiliate link
- **In Stock** plans (sorted by price)
- **Sold Out** plans (greyed out)
- Last check timestamp
- Restock history timeline
- Price history chart
- Quick subscribe button (links to bot)

### 7.4 Filters (available on /restocks and /offers)

- Provider
- Category: VPS / VDS / Dedicated / NAT VPS / Storage
- Location: Asia / Europe / US / Other
- Billing: Monthly / Quarterly / Annual
- Price range
- IPv4 included
- Stock status

---

## 8. Second Batch Providers

Add after MVP is stable and first batch proves the model:

### Tier A — Offers + Limited Stock

| Provider | Monitor Focus |
|----------|--------------|
| RackNerd | Annual deals, Black Friday, flash sales |
| DediRock | Low-price annual, Storage, LET deals |
| Onidel | LET specials, limited plans |
| Evoxt | New locations, promos |
| Crunchbits | Large storage, dedicated, limited events |
| ServaRICA | Storage VPS, VDS, dedicated stock |
| Alwyzon | EU VPS, Storage, new deals |
| LiteServer | NL VPS, Storage plans |
| Clouvider | EU VPS, dedicated deals |

### Tier B — NAT VPS Niche

| Provider | Monitor Focus |
|----------|--------------|
| TierHive | NAT VPS category |
| Gullo's Hosting | NAT VPS, small RAM annual |
| WebHorizon | NAT VPS, IPv6, budget plans |

### Not Monitored (Directory Only)

These providers are always in stock; they appear in the provider directory and coupon pages but NOT in restock monitoring:

- Hetzner Cloud (exception: Server Auction & special dedicated)
- Vultr, DigitalOcean, UpCloud
- InterServer, Raksmart, LightLayer
- 华纳云 (HuaWeiYun)
- Managed hosting: Kinsta, Cloudways, SiteGround

---

## 9. Development Phases

### Phase 1 — MVP (4–6 weeks)

- [ ] Monorepo setup (Turborepo + pnpm)
- [ ] Database schema + Prisma setup
- [ ] 3 provider adapters (BuyVM, HostHatch, GreenCloudVPS)
- [ ] Stock check worker with BullMQ
- [ ] Basic restock detection logic (consecutive confirmation)
- [ ] Telegram channel push (restock only)
- [ ] Minimal website: homepage + provider pages
- [ ] Docker Compose for worker + bot + DB + Redis
- [ ] Deploy web to Vercel, workers to VPS

### Phase 2 — LET + Full First Batch (2–3 weeks)

- [ ] Remaining 7 S-tier provider adapters
- [ ] LowEndTalk RSS + HTML scraper
- [ ] LET post parser (structured field extraction)
- [ ] Filter engine for LET offers
- [ ] `@vpsknow_offers` channel push
- [ ] /offers page on website
- [ ] Plan detail pages with stock timeline

### Phase 3 — Bot + Subscriptions (2–3 weeks)

- [ ] `@vpsknow_stock_bot` with subscription management
- [ ] User filter storage (provider, location, price, category)
- [ ] Personalized push delivery
- [ ] /subscribe interactive flow
- [ ] Mute/unmute functionality

### Phase 4 — Polish + Scale (ongoing)

- [ ] Second batch providers
- [ ] Price history charts
- [ ] Admin dashboard (provider management, manual overrides)
- [ ] Rate limiting, proxy rotation, Cloudflare bypass strategies
- [ ] Error alerting (dead adapters, API changes)
- [ ] SEO optimization for stock pages
- [ ] Mobile-responsive design refinement

---

## 10. Operational Rules

### 10.1 Affiliate Links

- All "Order" / "Buy" links route through `go.uukk.de` short links.
- Affiliate links are stored in DB per provider.
- If no affiliate exists for a provider, link directly to the product page.
- Never hide or obscure that links are affiliate links (legal compliance).

### 10.2 Content Integrity

- Stock status must reflect real-time checks, not cached assumptions.
- "Last checked" timestamp must be visible to users.
- If a provider adapter is broken/stale (>30 min without successful check), mark status as "Unknown" on the website.
- Never fabricate stock events or push stale data as new.

### 10.3 Rate Limiting & Politeness

- Respect `robots.txt` where applicable.
- Use appropriate User-Agent identifying the bot.
- Implement exponential backoff on consecutive failures.
- Maximum 1 concurrent request per provider domain.
- Random jitter on all check intervals.

### 10.4 Error Handling

- Failed checks increment a per-provider error counter.
- After 5 consecutive failures: mark provider as "degraded" in admin.
- After 20 consecutive failures: pause monitoring, alert admin.
- All errors are logged with timestamp, provider, HTTP status, and error message.
- Cloudflare challenges or CAPTCHAs: log and escalate to admin (may need Playwright or manual intervention).

---

## 11. What NOT to Do (v1)

- ❌ Do NOT monitor all providers at once — start with 10.
- ❌ Do NOT use 机场-related domains for this project.
- ❌ Do NOT dump all LET posts into the restock channel.
- ❌ Do NOT treat always-in-stock cloud providers as restock targets.
- ❌ Do NOT build user accounts, payment, or premium tiers in v1.
- ❌ Do NOT put monitoring logic inside Next.js or Vercel Cron.
- ❌ Do NOT run all services in a single process.
- ❌ Do NOT push "in stock" every check cycle — only on state transitions.
- ❌ Do NOT use "last reply time" for LET newness detection.

---

## 12. Success Metrics (Phase 1)

| Metric | Target |
|--------|--------|
| Providers monitored | 10 |
| Check uptime | >99% |
| Restock detection latency | <3 min from actual restock |
| False positive rate | <5% |
| Telegram channel subscribers (month 1) | 200+ |
| Website daily visitors (month 1) | 100+ |
| Affiliate click-through | Track per provider |

---

## 13. Future Considerations (Post-MVP)

- Discord integration (parallel to Telegram)
- Email digest (weekly restock summary)
- Browser push notifications
- Public API for stock status
- Provider comparison tool
- Historical pricing analytics
- Community voting on provider reliability
- Integration with VPSKnow blog posts

---

*Document Version: 1.0*
*Created: 2026-07-20*
*Project: VPSKnow Stock*
*Status: Planning*
