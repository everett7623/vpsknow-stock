# Acceptance Baseline — 2026-08-10

> T0 snapshot: **2026-08-10 14:46 UTC**（上海 22:46）  
> Code: `main` @ `59c4d32`  
> Window start for 24h stability: worker/web recreate ≈ **2026-08-10 13:45 UTC**（部署后）  
> Recheck: `python scripts/acceptance-snapshot.py`

## Pass / watch criteria

| Check | Target | T0 |
|------|--------|----|
| Public `/api/health` | 200 + DB healthy | ✅ |
| Worker `/health` | database + redis healthy | ✅ |
| Compose | web/worker/bot/postgres/redis/caddy Up | ✅ |
| Worker crash / recreate | none over 24h after T0 | ⏳ running |
| Worker RSS trend | no unbounded climb | T0 ≈ **560 MiB** (CPU busy ~55% during checks) |
| Disk | headroom | **58%** of 99G |
| Queue wait backlog | near empty | ✅ wait keys empty |
| Failed jobs | investigate, not growing unbounded | stock-check **36**, offer-discovery **70** (mostly historical LET 403) |
| TG send 24h | failures ≈ 0 | **8 sent / 0 failed** |
| Restock false positives | <5% over 48h (manual spot-check) | ⏳ see notes |

## Event volume (DB)

| Window | Events | Restock | Sold-out | Manual |
|--------|--------|---------|----------|--------|
| 24h | 23 | 8 | 15 | 0 |
| 48h | 41 | — | — | — |

Recent notified restocks (48h): DediRock / ZgoCloud / SpartanHost / BageVM / SpeedyPage — all `notified=t`. No VMISS/DMIT restock spam (good for CF fail-closed).

## Provider freshness (active 21)

- Most providers `lastChecked` within minutes; `stale_30m` mostly on large catalogs (GreenCloud 29 / BuyVM 18 / V.PS 8 / BWH 7) where not every SKU returns every cycle — **expected**, watch if whole provider goes stale.
- **VMISS**: all 60 rows `availabilitySource=catalog`, `inStock=true` still in DB (catalog path does not rewrite stock). Site should show **Unknown**, not live In Stock. PID-watch currently **0/16** without proxy.
- **V.PS**: many category URLs CF 403; partial catalog still checks.
- **DMIT**: checks completing with products; keep watching for 403 freeze.

## Known noise (do not count as restock FP)

1. LowEndTalk offer detail **HTTP 403** → offer-discovery failures (LEB/LES still run).
2. VMISS / V.PS Cloudflare challenges → warnings, not restock pushes.
3. ZgoCloud Tokyo Premium metadata shows absurd `ramMb` (~61e6) — **parser QA**, not a stock FP.

## 24h / 48h checklist

**T+24h** (`python scripts/acceptance-snapshot.py`):

- [ ] Worker container Created time ≥ 24h (no unexpected recreate)
- [ ] MemUsage not >> 2× T0 without reason
- [ ] `bull:stock-check:wait` still ~0; failed count not exploding
- [ ] Spot-check every `restock`+`notified=t` since T0 against provider cart page
- [ ] Confirm no VMISS catalog-driven restock notifications

**T+48h**:

- [ ] False-positive rate among notified restocks &lt; 5%
- [ ] Decide: keep observing / configure `VMISS_PROXY_URL` / pause noisy provider

## Commands

```bash
python scripts/acceptance-snapshot.py
# optional: save under docs/ with a dated name (redacted — script already strips host/password)
```
