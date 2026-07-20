# VPSKnow Stock — Complete Development Document

> Last updated: 2026-07-20
> Status: Phase 1 — Not Started

---

## Table of Contents

- [Project Summary](#project-summary)
- [Technical Decisions](#technical-decisions)
- [Website Design System](#website-design-system)
- [Provider Adapter Deep Dive](#provider-adapter-deep-dive)
- [LET Parsing Strategy](#let-parsing-strategy)
- [Telegram Operations](#telegram-operations)
- [Monitoring & Observability](#monitoring--observability)
- [SEO & Growth](#seo--growth)
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

## Website Design System

### Design Philosophy

VPSKnow Stock targets a technical audience (developers, sysadmins, VPS enthusiasts). The site must feel like a **real-time dashboard / terminal tool** — not a generic hosting affiliate blog.

**Keywords**: Data-dense, real-time, precision, developer-grade, dark-first.

### Visual Language

| Element | Specification |
|---------|--------------|
| Theme | Dark-first (near-black `#0a0a0f` base) with optional light mode |
| Primary Surface | `#12121a` cards on `#0a0a0f` background |
| Accent | Emerald green `#10b981` for "in stock" / success |
| Danger | Red `#ef4444` for "sold out" |
| Warning | Amber `#f59e0b` for "limited" / "degraded" |
| Neutral | Cool gray scale `#6b7280` → `#f9fafb` |
| Typography | Inter for UI, JetBrains Mono for data/prices/timestamps |
| Border Radius | 8px cards, 6px buttons, 4px badges |
| Spacing | 4px base grid, 8/12/16/24/32/48 scale |

### Key UI Components

#### Real-Time Stock Badge

```text
┌─────────────────────────────┐
│ 🟢 IN STOCK    Las Vegas    │  ← Green pulse dot animation
│ 🔴 SOLD OUT    Tokyo        │  ← Static red dot
│ 🟡 LIMITED     Singapore    │  ← Amber slow pulse
│ ⚫ UNKNOWN     Dallas       │  ← Gray, no animation
└─────────────────────────────┘
```

The green dot uses a subtle CSS pulse animation (1.5s ease-in-out infinite) to convey "live monitoring". Respects `prefers-reduced-motion`.

#### Provider Card (Homepage)

```text
┌─────────────────────────────────────────┐
│  [Logo]  BuyVM                          │
│                                         │
│  ██████████░░░░  6/10 plans in stock    │  ← Progress bar
│                                         │
│  Last checked: 12s ago                  │  ← Live relative time
│  Last restock: 2h ago (Slice 1024 LV)   │
│                                         │
│  [View Plans →]          [🔔 Subscribe] │
└─────────────────────────────────────────┘
```

#### Stock Timeline (Provider Detail)

A vertical timeline showing state transitions:

```text
  ● 2026-07-20 12:36 UTC — RESTOCK
    Slice 1024 · Las Vegas · $3.50/mo
    Duration in stock: 4h 22m

  ○ 2026-07-20 08:14 UTC — SOLD OUT
    Slice 1024 · Las Vegas

  ● 2026-07-19 23:50 UTC — RESTOCK
    Slice 2048 · New York · $7.00/mo
    Duration in stock: 12h 5m
```

#### Plan Table (Provider Detail)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Plan          │ Location │ CPU │ RAM  │ Storage │ Price    │ Status  │
├──────────────────────────────────────────────────────────────────────┤
│ Slice 1024    │ LV       │ 1   │ 1 GB │ 20 SSD  │ $3.50/mo │ 🟢 Buy │
│ Slice 2048    │ LV       │ 1   │ 2 GB │ 40 SSD  │ $7.00/mo │ 🟢 Buy │
│ Slice 1024    │ NY       │ 1   │ 1 GB │ 20 SSD  │ $3.50/mo │ 🔴 OOS │
│ Storage 256   │ LU       │ 1   │ 512M │ 256 HDD │ $5.00/mo │ 🟡 Ltd │
└──────────────────────────────────────────────────────────────────────┘
```

"Buy" button links to affiliate URL. "OOS" shows "Notify Me" linking to bot.

#### LET Offer Card

```text
┌─────────────────────────────────────────────────────────────────┐
│  🔥 HostHatch — Annual VPS                      [2h ago]       │
│                                                                 │
│  4 GB RAM · 50 GB NVMe · 9 Locations                           │
│  $35/year (recurring)                                           │
│                                                                 │
│  Tags: [VPS] [Annual] [Limited] [Asia]                          │
│                                                                 │
│  [Order →]                    [View on LET →]                   │
└─────────────────────────────────────────────────────────────────┘
```

### Page Layouts

#### Homepage (`/`)

```text
[Header: Logo + Nav + Command Palette trigger (Cmd+K)]

[Hero: "VPS Restock Alerts in Real-Time" + TG channel CTA]

[Section: Live Monitor Dashboard]
  - Grid of provider cards showing real-time stock ratios
  - Auto-refreshes every 30s via SWR/React Query

[Section: Latest Restocks]
  - Feed of recent restock events, newest first
  - Each item: provider, plan, location, time, price, [Buy] button

[Section: Hot Offers]
  - LET offers tagged "limited" or from S-tier providers
  - Card layout, 2-3 columns

[Section: Recently Sold Out]
  - Reverse urgency: "These just sold out, subscribe to catch the next one"

[Footer: About · GitHub · Telegram · API Status]
```

#### Provider Detail (`/provider/[slug]`)

```text
[Breadcrumb: Home > Providers > BuyVM]

[Provider Header]
  - Logo, name, website, TG subscribe button
  - Stats row: X plans monitored · Y in stock · Last check Zs ago
  - Monitoring status indicator (healthy/degraded/paused)

[Tab: Current Stock]
  - Sortable/filterable plan table
  - Columns: Plan, Location, CPU, RAM, Storage, BW, Price, Status, Action

[Tab: Timeline]
  - Vertical timeline of all stock events
  - Filterable by plan/location

[Tab: Statistics]
  - Average restock frequency
  - Average time in stock before selling out
  - Most popular plans (by restock frequency)
  - Price history chart (if prices change over time)

[Sidebar: Quick Info]
  - Payment methods accepted
  - Test IP addresses
  - Looking glass URL
  - Data centers list
  - Affiliate disclosure
```

#### Offers Page (`/offers`)

```text
[Filter Bar]
  - Provider dropdown (multi-select)
  - Category chips: VPS · Dedicated · NAT VPS · Storage
  - Location chips: Asia · US · EU
  - Billing: Monthly · Annual · All
  - Price slider: $0 – $100/yr
  - Sort: Newest · Price Low · Price High

[Results Grid]
  - LET Offer cards in 2-column layout
  - Infinite scroll or pagination
  - "New" badge for posts < 1h old
```

### Interaction Patterns

| Pattern | Behavior |
|---------|----------|
| Real-time updates | Homepage stock badges refresh via polling (30s) or WebSocket (Phase 4) |
| "Notify Me" | Click on OOS plan → deeplink to TG bot with pre-filled provider filter |
| Command palette | `Cmd+K` → search providers, plans, jump to pages |
| Copy plan specs | Click to copy formatted specs (for sharing in groups) |
| Share restock | Share button generates TG/Twitter-ready snippet |
| Relative timestamps | "12s ago", "2h ago", auto-updates client-side |
| Skeleton loading | All data sections show skeleton states during fetch |

### Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| `≥1280px` | Full dashboard: sidebar + main + aside |
| `≥768px` | 2-column cards, collapsible sidebar |
| `<768px` | Single column, bottom nav, swipeable tabs |

### Accessibility

- All interactive elements: `min-size 44×44px`
- Focus rings visible on keyboard nav
- Stock status conveyed by text + color (not color alone)
- `aria-live="polite"` on real-time stock updates
- `prefers-reduced-motion`: disable pulse animations, use static indicators
- `prefers-color-scheme`: auto light/dark, manual toggle persisted

### Tech Stack (Frontend Detail)

| Concern | Choice |
|---------|--------|
| Framework | Next.js 14+ App Router |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (dark theme customized) |
| Icons | Lucide |
| Charts | Recharts (lightweight, SSR-friendly) |
| Data Fetching | TanStack Query (React Query) |
| Real-time | SWR polling (v1), WebSocket upgrade (v4) |
| Fonts | Inter (Variable) + JetBrains Mono |
| Animation | Framer Motion (minimal, opt-in) |
| Search | Command palette via cmdk |

---

## Provider Adapter Deep Dive

### Architecture: How Adapters Work

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BullMQ Job  │────▶│   Adapter    │────▶│  HTTP/HTML   │
│  (scheduled) │     │  .check()    │     │  Provider    │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ StockResult[]│
                    └──────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  Comparator   │ ← compares with last known state in DB
                    └───────┬───────┘
                            │
               ┌────────────┼────────────┐
               ▼            ▼            ▼
        [No Change]   [RESTOCK]    [SOLD OUT]
          (noop)     (event+push)  (event only)
```

### Per-Provider Implementation Notes

#### BuyVM

- **URL**: `https://my.frantech.ca/cart.php?gid=X` (multiple group IDs for different locations)
- **Method**: HTTP GET → parse HTML table for "Order Now" vs "Out of Stock" buttons
- **Granularity**: Per-plan, per-location (LV, NY, LU, MI)
- **Challenge**: Multiple pages to check (one per product group)
- **Products to monitor**:
  - KVM Slices (512MB–32GB) across 4 locations
  - Storage Slices (256GB–4TB) across 4 locations
  - DDoS Protected Slices
- **Detection signal**: Presence of `<a>` with "Order Now" text vs "Out of Stock" span

#### HostHatch

- **URL**: `https://hosthatch.com/vps` + location-specific pages
- **Method**: HTTP GET → parse product grid for availability indicators
- **Challenge**: Promotional pages are separate URLs that appear/disappear
- **Products to monitor**:
  - NVMe VPS (multiple locations)
  - Storage VPS (Amsterdam, Stockholm)
  - Special yearly deals (appear seasonally)
- **Detection signal**: "Order" button vs "Sold Out" badge or missing plan entirely

#### GreenCloudVPS

- **URL**: `https://greencloudvps.com/billing/store/` + category pages
- **Method**: HTTP GET → parse WHMCS store pages
- **Challenge**: Uses WHMCS, some plans behind category navigation
- **Products to monitor**:
  - Budget KVM (multiple DCs)
  - Japan/Singapore/Hong Kong specific plans
  - Storage VPS
  - Annual specials
- **Detection signal**: WHMCS "Order Now" link present vs "Out of Stock" label

#### BandwagonHost

- **URL**: `https://bandwagonhost.com/vps-hosting.php`
- **Method**: HTTP GET → parse plan table
- **Challenge**: Limited plans often unlisted when OOS, only appear on restock
- **Products to monitor**:
  - THE PLAN (limited annual)
  - DC6 CN2 GIA-E plans
  - DC9 CN2 GIA plans
  - Hong Kong plans
- **Detection signal**: Plan row appears in table with "Order" link = in stock; plan row missing = OOS
- **Special**: Some plans only accessible via direct URL; maintain a list of known plan URLs

#### DMIT

- **URL**: `https://www.dmit.io/pages/pricing` + per-product pages
- **Method**: HTTP GET → parse pricing page sections
- **Challenge**: Multiple product lines (PVM, Premium, Eyeball) with location variants
- **Products to monitor**:
  - PVM.LAX (Los Angeles Premium)
  - PVM.HKG (Hong Kong)
  - PVM.TYO (Tokyo)
  - Eyeball plans
- **Detection signal**: "Deploy Now" button active vs "Sold Out" or "Waitlist" state

#### Netcup

- **URL**: `https://www.netcup.de/vserver/` + special pages
- **Method**: HTTP GET → parse product listing
- **Challenge**: German language site; special offers on separate anniversary/event pages
- **Products to monitor**:
  - VPS (piko, nano, mikro, etc.)
  - Root Server (RS series)
  - Special offers (appear periodically)
- **Detection signal**: "Bestellen" (Order) button vs "ausverkauft" (sold out)
- **Note**: Netcup specials appear on `netcup.de/sonderangebote/` — separate scraper target

### Adapter Testing Strategy

Each adapter needs:

1. **Fixture files**: Real HTML snapshots saved in `packages/providers/fixtures/`
   - `buyvm-lv-in-stock.html`
   - `buyvm-lv-out-of-stock.html`
   - `buyvm-error-page.html`
   - `buyvm-cf-challenge.html`

2. **Unit tests**: Parse fixtures → assert correct `StockResult[]`

3. **Integration test** (CI-optional): Real HTTP call with timeout, just verify shape (not stock state)

4. **Error case tests**: Verify adapter handles:
   - Empty response body
   - 403/503 status
   - Cloudflare challenge page
   - Timeout
   - Malformed HTML (partial load)
   - Unexpected page structure change

### Anti-Bot Strategies by Provider

| Provider | Protection | Strategy |
|----------|-----------|----------|
| BuyVM | None | Direct HTTP |
| HostHatch | Light rate limiting | Polite interval + UA |
| GreenCloudVPS | WHMCS default | Standard HTTP |
| BandwagonHost | Moderate | Rotate UA, respect rate |
| DMIT | Cloudflare (sometimes) | Playwright fallback |
| SpartanHost | None | Direct HTTP |
| VMISS | Light | Standard HTTP |
| Netcup | Regional blocking possible | EU proxy if needed |
| AkileCloud | None | Direct HTTP |
| V.PS | None | Direct HTTP |

### Adapter Health Metrics (per provider)

Track in `provider_health` table or as Redis counters:

```text
success_count_1h        — successful checks in last hour
failure_count_1h        — failed checks in last hour
consecutive_failures    — current failure streak
avg_response_time_ms    — rolling average
last_success_at         — timestamp
last_failure_at         — timestamp
last_error_message      — most recent error
adapter_status          — healthy | degraded | paused | broken
```

---

## LET Parsing Strategy

### Post Structure Analysis

A typical LET Offer post follows a pattern:

```text
[Title]: Provider Name — Plan Description / Event Type

[Body]:
- Provider intro (1-2 lines)
- Plan specs table or list
- Pricing
- Locations
- Order link
- Coupon code (if any)
- Terms / limitations
- Test IP / Looking glass
```

### Parsing Pipeline Detail

```text
Raw HTML
    │
    ▼
[Stage 1: Sanitize]
    - Strip scripts, ads, signatures
    - Normalize whitespace
    - Extract first post only (ignore replies)
    │
    ▼
[Stage 2: Provider Detection]
    - Match against known provider names/aliases
    - Check post author against LET usernames in provider DB
    - Fallback: extract from title prefix
    │
    ▼
[Stage 3: Specs Extraction]
    - Pattern match for structured data:
      - "X GB RAM" / "X vCPU" / "X TB BW"
      - Table rows (<tr>/<td> parsing)
      - Markdown-style tables
      - Bullet lists with specs
    - Currency + price extraction: $X.XX/mo, €X/yr, $X biennially
    │
    ▼
[Stage 4: Metadata Extraction]
    - Location: match against known DC locations dictionary
    - Coupon: regex for "coupon", "code:", "promo:"
    - Order URL: first external link to provider domain
    - Flags:
      - "limited" / "limited stock" → is_limited_stock
      - "recurring" / "renewal same price" → is_recurring
      - "pre-order" / "coming soon" → is_preorder
    │
    ▼
[Stage 5: Confidence Score]
    - Each extracted field gets a confidence (0-1)
    - Overall score = weighted average
    - score < 0.4 → skip (log for manual review)
    - score 0.4-0.7 → store but don't push to TG
    - score > 0.7 → store + push
```

### Location Dictionary

Maintain a comprehensive mapping:

```ts
const LOCATION_ALIASES: Record<string, string> = {
  'lax': 'Los Angeles',
  'la': 'Los Angeles',
  'sjc': 'San Jose',
  'sea': 'Seattle',
  'dal': 'Dallas',
  'chi': 'Chicago',
  'mia': 'Miami',
  'nyc': 'New York',
  'ash': 'Ashburn',
  'ams': 'Amsterdam',
  'fra': 'Frankfurt',
  'lon': 'London',
  'par': 'Paris',
  'hkg': 'Hong Kong',
  'sgp': 'Singapore',
  'tyo': 'Tokyo',
  'nrt': 'Tokyo Narita',
  'icn': 'Seoul',
  'syd': 'Sydney',
  'lux': 'Luxembourg',
  'buf': 'Buffalo',
  // ... extensive list
};

const REGION_MAP: Record<string, string> = {
  'Los Angeles': 'US West',
  'Tokyo': 'Asia',
  'Hong Kong': 'Asia',
  'Singapore': 'Asia',
  'Amsterdam': 'Europe',
  // ...
};
```

### Price Normalization

All prices stored as cents in USD equivalent:

```ts
interface NormalizedPrice {
  amount_cents: number;       // in original currency
  currency: string;           // USD, EUR, GBP, etc.
  billing_cycle: BillingCycle;
  monthly_equivalent_cents: number; // normalized for comparison
}

type BillingCycle = 'monthly' | 'quarterly' | 'semi-annually' | 'annually' | 'biennially' | 'triennially';

// Conversion: annually $35 → monthly equivalent = 3500/12 = 292 cents
```

### Known LET Post Patterns to Handle

| Pattern | Example | Handling |
|---------|---------|----------|
| Multi-plan table | RackNerd flash sale | Extract each row as separate offer entry |
| Location list | "Available in: LAX, NYC, AMS" | Split into individual location tags |
| Tiered pricing | "Starting at $X" | Use lowest price as representative |
| Multiple coupons | "Code A: 20% off, Code B: 30% off" | Store best coupon |
| Update edits | "[UPDATE] Back in stock" | Detect edit timestamp, re-evaluate |
| Referral requirement | "Must use affiliate link" | Flag, still include |
| Pre-order | "Ships in 2 weeks" | Mark `is_preorder: true` |

---

## Telegram Operations

### Channel Strategy

```text
@vpsknow_stock (Restock Channel)
├── Only state transition events
├── ~5-20 messages/day (varies by market activity)
├── High signal, zero noise
├── Users join for: "Tell me when X is back"
└── Retention strategy: quality over quantity

@vpsknow_offers (Offers Channel)
├── New LET deals + provider announcements
├── ~10-30 messages/day
├── Curated (filtered, not raw dump)
├── Users join for: "Show me new deals I'd miss"
└── Retention strategy: save time vs. browsing LET directly

@vpsknow_stock_bot (Subscription Bot)
├── Personal notifications based on filters
├── Users set: providers + locations + budget
├── Only sends what matches their criteria
└── Retention strategy: precision = no unsubscribe
```

### Message Design Principles

1. **Scannable in 2 seconds**: Provider name, price, location visible without scrolling
2. **Actionable**: One-tap to order (affiliate link as button)
3. **No walls of text**: Specs in tree format, not paragraphs
4. **Time-sensitive context**: "Detected 30s ago" creates urgency
5. **Consistent format**: Users build pattern recognition over time

### Enhanced Message Templates

#### Restock — Rich Format

```text
🟢 RESTOCK — BuyVM

━━━━━━━━━━━━━━━━━━━━
📍 Las Vegas, US
💻 KVM Slice 1024

   CPU    1 Core (Ryzen)
   RAM    1 GB DDR4
   SSD    20 GB NVMe
   BW     1 TB @ 1Gbps
   IPv4   1 Dedicated
   Price  $3.50/mo

⏱ Detected 45s ago
📊 Avg time in stock: ~6h
🔄 Last restock: 3 days ago
━━━━━━━━━━━━━━━━━━━━

[💳 Order Now]  [🔔 Track This Plan]
```

Inline keyboard buttons:
- "Order Now" → `go.uukk.de/buyvm-slice-1024-lv`
- "Track This Plan" → deeplink to bot with pre-configured filter

#### Sold Out Alert (Optional — only for tracked plans)

```text
🔴 SOLD OUT — BuyVM

📍 Las Vegas · KVM Slice 1024
⏱ Was in stock for: 4h 22m
📊 Next restock estimate: 2-5 days

[🔔 Notify on Restock]
```

#### LET Offer — Structured

```text
🔥 NEW OFFER — HostHatch

━━━━━━━━━━━━━━━━━━━━
📦 Annual NVMe VPS

   RAM    4 GB DDR4
   SSD    50 GB NVMe
   BW     4 TB @ 1Gbps
   IPv4   1 Dedicated
   Locs   LAX, AMS, LDN, SIN, TYO + 4 more

💰 $35.00/year (recurring)
🏷️ #VPS #Annual #Limited #Asia

⚡ Posted 12 min ago on LowEndTalk
━━━━━━━━━━━━━━━━━━━━

[💳 Order]  [📋 LET Thread]  [🔔 Track Provider]
```

#### Flash Sale / Time-Limited

```text
⚡ FLASH SALE — Netcup

━━━━━━━━━━━━━━━━━━━━
🎯 Root Server RS 2000 G11

   CPU    6 Cores (dedicated)
   RAM    16 GB DDR5
   SSD    512 GB NVMe
   BW     Unlimited @ 2.5Gbps
   IPv4   1 + /64 IPv6

💰 €8.16/mo (was €13.99)
🏷️ Code: 36nc19517585760
⏰ Expires: 2026-07-25

[💳 Order]  [📋 Details]
━━━━━━━━━━━━━━━━━━━━
```

### Telegram Inline Keyboard Layouts

```text
Restock message:
┌─────────────────────────────────────┐
│  💳 Order Now    │  🔔 Track Plan   │
└─────────────────────────────────────┘

Offer message:
┌─────────────────────────────────────────────────┐
│  💳 Order  │  📋 LET Thread  │  🔔 Track Prov  │
└─────────────────────────────────────────────────┘

Bot subscription confirmation:
┌─────────────────────────────────────┐
│  ✅ Done    │  ✏️ Edit Filters     │
└─────────────────────────────────────┘
```

### Bot Conversation Flow

```text
User: /start
Bot:  Welcome to VPSKnow Stock Bot! 🖥️

      I'll send you personalized VPS restock alerts
      and LET offers based on your preferences.

      Quick setup:
      /subscribe — Set up your filters
      /providers — See monitored providers
      /help — All commands

---

User: /subscribe
Bot:  Let's set up your alerts.

      1️⃣ What do you want to receive?
      [🟢 Restocks Only]
      [🔥 Offers Only]
      [📦 Both]

User: [Both]
Bot:  2️⃣ Which providers? (select multiple)
      [BuyVM] [HostHatch] [GreenCloud]
      [DMIT] [SpartanHost] [BandwagonHost]
      [VMISS] [Netcup] [AkileCloud] [V.PS]
      [✅ All Providers]
      [→ Next]

User: [BuyVM] [DMIT] [→ Next]
Bot:  3️⃣ Which regions?
      [🌏 Asia] [🇺🇸 US] [🇪🇺 Europe] [🌍 All]

User: [Asia] [US]
Bot:  4️⃣ Maximum monthly budget?
      [$5/mo] [$10/mo] [$20/mo] [$50/mo] [No Limit]

User: [$10/mo]
Bot:  ✅ Subscription active!

      Your filters:
      • Events: Restocks + Offers
      • Providers: BuyVM, DMIT
      • Regions: Asia, US
      • Budget: ≤ $10/mo

      You'll receive ~3-8 alerts/day based on current activity.

      [✏️ Edit] [🔇 Mute 8h] [❌ Unsubscribe]
```

### Rate Limiting & Spam Prevention

| Rule | Value |
|------|-------|
| Max messages per user per minute | 2 |
| Max messages per channel per hour | 60 |
| Cooldown between same-product restocks | 60 min |
| Cooldown between same-provider offers | 15 min |
| Bot response timeout | 30s |
| Stale subscription cleanup | 90 days inactive |

### Channel Growth Tactics

1. **Pin a "How This Works" message** with example alerts
2. **Cross-link**: Every restock message has bot deeplink; every offer has website link
3. **Frequency control**: Users stay because signal-to-noise is high
4. **Chinese community**: Translate key parts of offers into Chinese summary (Phase 4)
5. **Attribution on LET**: If you post on LET, mention the TG channel
6. **SEO → TG**: Website stock pages link to "Get notified" → TG channel

---

## Monitoring & Observability

### System Health Dashboard

The worker needs its own internal health monitoring:

```text
┌─────────────────────────────────────────────────────────────┐
│  VPSKnow Stock — Worker Health                              │
├─────────────────────────────────────────────────────────────┤
│  Providers: 10 active / 0 degraded / 0 paused               │
│  Checks (1h): 342 success / 2 failed (99.4%)                │
│  Events (24h): 5 restocks / 3 sold-out                      │
│  TG Messages (24h): 8 sent / 0 failed                       │
│  Queue depth: 0 pending / 2 active                          │
│  Memory: 128 MB / 512 MB                                    │
│  Uptime: 14d 6h 32m                                         │
└─────────────────────────────────────────────────────────────┘
```

### Structured Logging

All worker logs in JSON format:

```json
{
  "ts": "2026-07-20T12:36:45.123Z",
  "level": "info",
  "service": "worker-stock",
  "event": "stock_check_complete",
  "provider": "buyvm",
  "duration_ms": 1245,
  "products_checked": 24,
  "changes_detected": 1,
  "details": {
    "product_id": "buyvm-slice-1024-lv",
    "transition": "oos_to_in_stock"
  }
}
```

Use `pino` for structured logging with log levels:

| Level | Usage |
|-------|-------|
| `fatal` | Process must exit |
| `error` | Check failed, adapter broken, TG send failed |
| `warn` | Consecutive failures, rate limited, slow response |
| `info` | Successful checks, state transitions, messages sent |
| `debug` | Raw responses, parsing details, queue events |

### Alerting (Admin Notifications)

Send critical alerts to a private admin TG chat:

```text
⚠️ ADAPTER DEGRADED — BuyVM
Consecutive failures: 5
Last error: HTTP 503 — Service Unavailable
Last success: 12 min ago
Action: Will pause after 20 failures

🛑 ADAPTER PAUSED — GreenCloudVPS
Consecutive failures: 20
Last error: Cloudflare challenge detected
Requires: Manual intervention (Playwright or proxy)

📊 DAILY DIGEST
Checks: 4,892 (99.2% success)
Restocks detected: 12
Offers parsed: 34 (28 pushed, 6 low-confidence)
TG messages: 40 (0 failed)
New subscribers: +8
```

### Metrics to Track (Redis counters / TimescaleDB)

```text
Operational:
  stock_checks_total{provider, status}
  stock_check_duration_seconds{provider}
  stock_events_total{provider, type}
  telegram_messages_total{channel, status}
  let_offers_parsed_total{status}
  let_offers_pushed_total
  adapter_consecutive_failures{provider}

Business:
  affiliate_clicks_total{provider}
  telegram_subscribers_total{channel}
  bot_active_subscriptions
  website_page_views{page}
  offers_conversion_rate{provider}
```

### Health Check Endpoint

Worker exposes a simple HTTP health endpoint (for Docker health checks):

```text
GET /health

200 OK
{
  "status": "healthy",
  "uptime_seconds": 1234567,
  "providers": {
    "total": 10,
    "healthy": 9,
    "degraded": 1,
    "paused": 0
  },
  "last_check": "2026-07-20T12:36:45Z",
  "queue_depth": 0
}
```

Docker Compose health check:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

---

## SEO & Growth

### SEO Strategy

The website should rank for high-intent searches:

| Target Keyword | Page |
|---------------|------|
| "buyvm in stock" | `/provider/buyvm` |
| "buyvm restock" | `/provider/buyvm` |
| "hosthatch stock" | `/provider/hosthatch` |
| "vps restock alerts" | `/` |
| "lowendtalk offers" | `/offers` |
| "greencloud vps stock" | `/provider/greencloudvps` |
| "bandwagonhost limited plan" | `/provider/bandwagonhost` |
| "cheap vps in stock" | `/restocks` |
| "dmit vps available" | `/provider/dmit` |

### Technical SEO

- **SSR/SSG**: All pages server-rendered with real-time data hydration
- **Structured Data**: `Product` schema with `availability` for each plan
- **Dynamic OG images**: Per-provider, per-plan stock status images
- **Sitemap**: Auto-generated, includes all provider pages and active plans
- **robots.txt**: Allow all, disallow admin routes
- **Canonical URLs**: No duplicate content across filter combinations
- **Internal linking**: Every plan links to provider, every provider links to related plans
- **Page speed**: Target <1.5s FCP, <2.5s LCP (Vercel Edge + static shell)

### Structured Data Example

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "BuyVM Slice 1024 — Las Vegas",
  "description": "1 Core, 1 GB RAM, 20 GB SSD VPS in Las Vegas",
  "brand": { "@type": "Brand", "name": "BuyVM" },
  "offers": {
    "@type": "Offer",
    "price": "3.50",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://stock.vpsknow.com/provider/buyvm/slice-1024-lv"
  }
}
```

When out of stock, change to `https://schema.org/OutOfStock`.

### Dynamic OG Image

Generate per-provider OG images at build/request time:

```text
┌──────────────────────────────────────────┐
│                                          │
│  [BuyVM Logo]                            │
│                                          │
│  6 / 10 plans in stock                   │
│                                          │
│  ██████████░░░░░░░░                      │
│                                          │
│  stock.vpsknow.com                       │
│                                          │
└──────────────────────────────────────────┘
```

Use `@vercel/og` or `satori` for generation.

### Content Strategy for Growth

1. **Auto-generated provider pages** rank for "[provider] stock" queries
2. **Stock history** creates evergreen content (historical data pages)
3. **Weekly digest blog post** (auto-generated): "VPS Restocks This Week"
4. **Integration with VPSKnow blog**: Link from reviews → stock status
5. **LET participation**: Post useful stock data back to community (builds backlinks)
6. **Reddit /r/selfhosted, /r/webhosting**: Share notable restocks
7. **Chinese community (Nodeseek, V2EX)**: Cross-post significant events

### Analytics

- Cloudflare Web Analytics (privacy-first, no cookies)
- Track per-page: provider pages, offer pages, affiliate clicks
- Track conversions: page view → affiliate click (via redirect logging)
- Monthly report: top providers by traffic, top plans by clicks

---

## Phase 1 — MVP

**Goal**: 3 providers monitored (BandwagonHost, DMIT, BuyVM), restock push to Telegram, minimal website.
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
- [ ] Seed script: 3 providers (BandwagonHost, DMIT, BuyVM) with known products
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
  - `bandwagonhost.ts` — Parse plan table + direct URLs, detect limited plan availability
  - `dmit.ts` — Parse pricing page sections, detect per-product-line stock status
  - `buyvm.ts` — Parse order page, detect slice availability by location
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
  - BandwagonHost: 1–2 min (limited plans sell fast)
  - DMIT: 2–3 min
  - BuyVM: 1–2 min
  - All with ±20% random jitter
- [ ] Error handling:
  - 5 consecutive failures → mark "degraded"
  - 20 consecutive failures → pause job, log alert
  - Exponential backoff on retries
- [ ] Max 1 concurrent request per provider domain
- [ ] Graceful shutdown on SIGTERM

**Done when**: Worker runs in Docker, checks BandwagonHost + DMIT + BuyVM on schedule, correctly logs stock_checks and fires stock_events on simulated state changes.

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

- [ ] `hosthatch.ts` — Parse product/pricing pages for active plans
- [ ] `greencloud.ts` — Parse WHMCS store pages, detect stock per location
- [ ] `spartanhost.ts`
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

| # | Provider | Focus | Interval | Phase |
|---|----------|-------|----------|-------|
| 1 | **BandwagonHost** | Limited plans, DC6/DC9, HK, restocks | 1–2 min | **Phase 1** |
| 2 | **DMIT** | PVM, Premium, Eyeball, by location | 2–3 min | **Phase 1** |
| 3 | **BuyVM** | Slice, Storage Slice, location stock | 1–2 min | **Phase 1** |
| 4 | HostHatch | Annual deals, Storage, Asia | 2–3 min | Phase 2 |
| 5 | GreenCloudVPS | Tokyo, SG, HK, Storage, annual | 2–3 min | Phase 2 |
| 6 | SpartanHost | Seattle, Dallas, AMD, routing | 2–3 min | Phase 2 |
| 7 | VMISS | CN2, BGP, HK, JP, LA | 5 min | Phase 2 |
| 8 | Netcup | VPS/RS specials, limited promos | 5 min | Phase 2 |
| 9 | AkileCloud | HK, JP, SG, optimized routing | 5 min | Phase 2 |
| 10 | V.PS | JP, SG, EU limited plans | 5 min | Phase 2 |

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

- [ ] 3 providers (BandwagonHost, DMIT, BuyVM) checked on schedule
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

## Security & Resilience

### Data Protection

- No user PII stored beyond Telegram user ID
- Bot tokens and DB credentials in environment variables only
- No secrets in code, logs, or error messages
- API endpoints (if exposed) require rate limiting + API key

### Resilience Patterns

| Pattern | Implementation |
|---------|---------------|
| Circuit breaker | Per-provider: open after 5 failures, half-open after 5 min, close on success |
| Retry with backoff | 3 retries, exponential: 1s → 4s → 16s |
| Timeout | HTTP: 15s, Playwright: 30s, TG API: 10s |
| Graceful degradation | Website shows cached data if DB is slow; "Last updated X ago" |
| Dead letter queue | Failed TG messages go to DLQ for manual retry |
| Data retention | `stock_checks` older than 30 days → archive to cold storage or delete |
| Backup | PostgreSQL daily pg_dump to object storage |

### Deployment Safety

- Worker auto-restarts on crash (Docker `restart: unless-stopped`)
- Blue-green deploy for website (Vercel handles this)
- Worker version pinning: don't auto-deploy breaking adapter changes
- Canary testing: new adapter runs in "dry-run" mode for 24h before activating push

---

## Competitive Analysis & Differentiation

### Existing Solutions

| Service | What it does | Gap we fill |
|---------|-------------|-------------|
| BuyVM Stock Bot (3rd party) | Single provider only | We cover 10+ providers |
| GreenCloud Stock Tracker | Single provider | Unified platform |
| `@lowendtalk_new` TG | Raw post dump, no filtering | Curated, structured, Chinese-friendly |
| VPSPulse | General VPS hosting | No real-time stock monitoring |
| LET email alerts | Vanilla forum notifications | Structured, filtered, multi-channel |

### Our Differentiation

1. **Multi-provider unified monitoring** — one place for all VPS stock
2. **Precision targeting** — subscribe to specific providers + locations + budget
3. **Chinese-market aware** — providers popular in Chinese community prioritized
4. **Structured data extraction** — not raw text, but parsed specs/prices
5. **Affiliate integration** — monetizable from day one via `go.uukk.de`
6. **Historical data** — restock patterns, average availability duration
7. **Professional presentation** — not a hobby script, but a polished product

---

## Glossary

| Term | Definition |
|------|-----------|
| Restock | A product transitioning from out-of-stock to in-stock |
| OOS | Out of Stock |
| LET | LowEndTalk forum |
| Adapter | A module that checks a specific provider's stock status |
| Stock Event | A recorded state change (restock or sold-out) |
| Offer | A new deal/promotion discovered from LET or provider announcement |
| Confidence Score | 0-1 metric indicating how reliably an LET post was parsed |
| Dedup | Deduplication — preventing the same event from being notified twice |
| Jitter | Random time offset added to scheduled checks to avoid burst patterns |
| DLQ | Dead Letter Queue — failed jobs stored for manual review |
| Provider Slug | URL-safe identifier for a provider (e.g., `greencloudvps`) |

---

## Quick Reference

### Commands Cheat Sheet

```bash
# Development
pnpm install                    # Install all dependencies
pnpm dev                        # Start all apps in dev mode
pnpm --filter web dev           # Start only website
pnpm --filter worker dev        # Start only worker
pnpm --filter bot dev           # Start only bot

# Database
pnpm --filter database db:push  # Apply schema to DB
pnpm --filter database db:seed  # Seed initial data
pnpm --filter database studio   # Open Prisma Studio

# Testing
pnpm test                       # Run all tests
pnpm --filter providers test    # Test adapters only
pnpm lint                       # Lint all packages
pnpm typecheck                  # TypeScript check

# Docker
docker compose up -d            # Start full stack
docker compose logs -f worker   # Tail worker logs
docker compose restart worker   # Restart worker only

# Deployment
pnpm --filter web build         # Build website for production
docker compose -f docker-compose.prod.yml up -d  # Production deploy
```

### Key URLs

| Resource | URL |
|----------|-----|
| Website (prod) | `https://stock.vpsknow.com` |
| GitHub Repo | `https://github.com/everett7623/vpsknow-stock` |
| Worker Health | `http://localhost:3001/health` |
| Prisma Studio | `http://localhost:5555` |
| Redis Commander | `http://localhost:8081` (dev only) |
| BullMQ Dashboard | `http://localhost:3002` (dev only) |

### File Ownership

| Path | Owner | Description |
|------|-------|-------------|
| `apps/web/` | Frontend | Next.js website |
| `apps/worker/` | Backend | Stock + LET monitoring engine |
| `apps/bot/` | Backend | Telegram bot service |
| `packages/providers/` | Backend | One file per provider adapter |
| `packages/parsers/` | Backend | LET post parsing logic |
| `packages/database/` | Shared | Schema, migrations, client |
| `packages/telegram/` | Shared | Message templates, TG SDK wrapper |
| `packages/shared/` | Shared | Types, utils, constants |
| `docs/` | All | Specifications, tasks, guides |

---

## Future Considerations (Post-MVP)

### Short-term (3-6 months)

- Discord integration (parallel to Telegram)
- Email digest (weekly restock summary)
- Browser push notifications via Web Push API
- Public REST API for stock status (`/api/v1/stock/:provider`)
- Chinese language option for TG messages and website
- Webhook integration (users provide their own webhook URL)

### Medium-term (6-12 months)

- Provider comparison tool (side-by-side specs + price)
- Historical pricing analytics and trends
- Community voting on provider reliability
- Integration with VPSKnow blog posts (auto-embed stock widget)
- Mobile app (React Native) with push notifications
- Premium tier: faster alerts (30s vs 3min), more providers, API access

### Long-term (12+ months)

- AI-powered deal scoring ("Is this a good deal?" rating)
- Automated LET post replies (stock status updates in threads)
- Provider partnership program (verified stock feeds)
- White-label API for other hosting review sites
- Predictive restocking (ML model based on historical patterns)

---

*Document Version: 2.0*
*Created: 2026-07-20*
*Project: VPSKnow Stock*
*Status: Planning — Phase 1 Not Started*

*Reference: `docs/SPEC.md` for detailed technical specification (DB schema, interfaces, message formats).*
