# OceanView documentation

Index of docs in this repo. Feature pages are the **source of truth** for UI behavior and the APIs each page uses.

---

## Feature docs (update when code changes)

| Doc | Area | Route |
|-----|------|-------|
| [market-page.md](./market-page.md) | Market — strategies, tickers, rules, alarm, Assess | `/market/*` |
| [premarket-page.md](./premarket-page.md) | Premarket — evaluate + BestResult strike monitor + Alarm | `/premarket` |
| [operations-page.md](./operations-page.md) | Operations — option picks and buy | `/operations` |
| [candles-pane.md](./candles-pane.md) | Admin — candle intake and status | `/admin` |
| [job-status-pane.md](./job-status-pane.md) | Admin — latest job runs (`GET /jobs/status`) | `/admin#admin-job-status-pane` |

Agent rule [update-documentation](../.cursor/rules/update-documentation.mdc) requires updating these when fixing bugs or adding functionality.

---

## Operations and environment

| Doc | Purpose |
|-----|---------|
| [aws-urls.md](./aws-urls.md) | Production CloudFront + API Gateway URLs, smoke tests |
| [deploy-aws.md](./deploy-aws.md) | S3, CloudFront, GitHub Actions, `/api` origin wiring |
| [environment.md](./environment.md) | `VITE_*` vars, local vs production, secrets policy |

---

## Cursor (agent config)

| Doc | Purpose |
|-----|---------|
| [cursor-rules-skills.md](./cursor-rules-skills.md) | Project rules and skills in `.cursor/` |

---

## Backend (OceanView-API repo)

| Doc | Purpose |
|-----|---------|
| `OceanView-API/docs/market-plan.md` | Market Lambda routes and eval pipeline |
| `OceanView-API/docs/best-result-monitor.md` | BestResult strike monitor (COGER + 12% move) |
| `OceanView-API/docs/premarket-alarm.md` | Premarket Alarm one-shot check |
| `OceanView-API/README.md` | API deploy and smoke tests |

---

## How the app fits together

```
Admin (/admin)          Market (/market)        Premarket (/premarket)     Operations (/operations)
  candles/*               market/*                  premarket/evaluate/*       operations/*
  tickers catalog    →    Assess + snapshots   ←   pre-open grouped scan       option picks + buy
       ↓                        ↑                        ↑                           ↑
   OceanView-Candles ──────────┴────────────────────────┘ (read + in-memory)   Schwab chains / orders
```

1. **Admin** — refresh candle data for active tickers ([candles-pane.md](./candles-pane.md)); toggle Operation on tickers.
2. **Market** — run **Assess** at a point in time; browse results by strategy, ticker, or rule ([market-page.md](./market-page.md)).
3. **Premarket** — **Start evaluate** at 9:25 ET; **Start best strikes** monitors COGER picks on Best results ([premarket-page.md](./premarket-page.md)).
4. **Operations** — option picks for operation-enabled tickers with optimal ranges ([operations-page.md](./operations-page.md)).

Local full-stack: `npm run dev:local` — see [cursor-rules-skills.md](./cursor-rules-skills.md).

**Shell layout:** Main pages use the full width of `<main>`. From `lg` up, Tools is a fixed left column; below `lg`, Tools is a floating drawer (bottom-left toggle) so each view stays full-width on tablet/phone. TopNav collapses to a Menu button below `md`. Root type is `html { font-size: 18px }` in `src/index.css`; main padding is `p-2 md:p-3` in `AppShell`.
