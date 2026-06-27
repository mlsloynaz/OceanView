# OceanView documentation

Index of docs in this repo. Feature pages are the **source of truth** for UI behavior and the APIs each page uses.

---

## Feature docs (update when code changes)

| Doc | Area | Route |
|-----|------|-------|
| [market-page.md](./market-page.md) | Market — strategies, tickers, rules, Assess | `/market/*` |
| [candles-pane.md](./candles-pane.md) | Admin — candle intake and status | `/admin` |

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
| `OceanView-API/README.md` | API deploy and smoke tests |

---

## How the app fits together

```
Admin (/admin)          Market (/market)
  candles/*               market/*
  tickers catalog    →    Assess + strategy eval
       ↓                        ↑
   OceanView-Candles ────────────┘ (coverage + bars)
```

1. **Admin** — refresh candle data for active tickers ([candles-pane.md](./candles-pane.md)).
2. **Market** — run **Assess** at a point in time; browse results by strategy, ticker, or rule ([market-page.md](./market-page.md)).

Local full-stack: `npm run dev:local` — see [cursor-rules-skills.md](./cursor-rules-skills.md).
