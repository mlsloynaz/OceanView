# Operations page

Top-level desk for **option picks** on tickers with `isOperationEnable` and an `optimalRange`.

**Route:** `/operations`  
**Nav:** Operations (between Premarket and Admin)

---

## What it does

1. **Eligibility search** — search the full ticker catalog (`GET /tickers`) and enable/disable Operations with `PATCH /tickers/{symbol}` `{ isOperationEnable }`.
2. Loads the operations universe — `GET /operations/tickers` (enabled tickers + open position summary).
3. Lets you choose **CALL** or **PUT**, select symbols that have an optimal range, and run **Find picks**.
4. Shows nearest-expiration strikes inside each range (`GET /operations/option-picks`).
5. **Buy** places a live market order via `POST /operations/buy` (confirm dialog first).

Optimal ranges are imported on the API (`import_optimal_ranges.py`). Eligibility is managed only on this page (not Admin → Tickers).

---

## UI controls

| Control | Behavior |
|---------|----------|
| Eligibility search | Filter catalog by symbol/name; checkbox toggles `isOperationEnable` |
| CALL / PUT | Contract type for the next picks run |
| Select all eligible | Toggle all tickers that have `optimalRange` |
| Find picks | Calls option-picks for the selected symbols |
| Reload tickers | Refresh catalog + universe + positions |
| Buy | Confirms, then `POST /operations/buy` for that pick |

**Empty / blocked states**

- No operation-enabled tickers → empty universe (use eligibility search to enable)
- Ticker without optimal range → can be enabled, but not selectable for picks
- Open position (`bought` / `pending`) → Buy disabled

---

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/tickers` | Full catalog for eligibility search |
| `PATCH` | `/tickers/{symbol}` | `{ "isOperationEnable": true \| false }` |
| `GET` | `/operations/tickers` | Enabled tickers + `position` |
| `GET` | `/operations/option-picks?contractType=CALL\|PUT&symbols=` | Per-symbol pick results |
| `POST` | `/operations/buy` | Market buy for one option contract |

Mock flag: `VITE_USE_MOCK_OPERATIONS=true` (dev default).

---

## Source map

```
src/features/operations/
  OperationsPage.tsx
  types.ts
  api/operations-client.ts
  api/mock-data.ts
  hooks/useOperationsWorkspace.ts
  components/
    OperationsEligibilitySearch.tsx
    OperationsToolbar.tsx
    OperationsTickerList.tsx
    OptionPicksTable.tsx
```

---

## Prerequisites

- OceanView-API **Operations** + **Tickers** Lambdas deployed
- Tickers with `optimalRange` for picks (after enable)
- Schwab credentials for live chains / buys (not needed in mock mode)
