# Operations page

Top-level desk for **option picks** on tickers with `isOperationEnable` and an `optimalRange`.

**Route:** `/operations`  
**Nav:** Operations (between Premarket and Admin)

---

## What it does

1. Loads the operations universe — `GET /operations/tickers` (enabled tickers + open position summary).
2. Lets you choose **CALL** or **PUT**, select symbols that have an optimal range, and run **Find picks**.
3. Shows nearest-expiration strikes inside each range (`GET /operations/option-picks`).
4. **Buy** places a live market order via `POST /operations/buy` (confirm dialog first).

Enable symbols in **Admin → Tickers** (Operation checkbox). Optimal ranges are imported on the API (`import_optimal_ranges.py`).

---

## UI controls

| Control | Behavior |
|---------|----------|
| CALL / PUT | Contract type for the next picks run |
| Select all eligible | Toggle all tickers that have `optimalRange` |
| Find picks | Calls option-picks for the selected symbols |
| Reload tickers | Refresh universe + positions |
| Buy | Confirms, then `POST /operations/buy` for that pick |

**Empty / blocked states**

- No operation-enabled tickers → prompt to enable in Admin → Tickers
- Ticker without optimal range → listed but not selectable for picks
- Open position (`bought` / `pending`) → Buy disabled

---

## APIs

| Method | Path | Purpose |
|--------|------|---------|
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
    OperationsToolbar.tsx
    OperationsTickerList.tsx
    OptionPicksTable.tsx
```

---

## Prerequisites

- OceanView-API **Operations** Lambda deployed (`/operations/*`)
- Tickers with `isOperationEnable: true` and `optimalRange`
- Schwab credentials for live chains / buys (not needed in mock mode)
