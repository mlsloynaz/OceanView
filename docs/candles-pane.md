# Candles Pane (Admin)

Operational panel for **candle (OHLC bar) collection** — incremental refresh, full reset, and per-ticker status. Replaces the legacy InvestJournal **Ticker Context** pane, scoped to candles only (no earning calendar, no foundation eval, no strategy eval).

**Route:** `/admin`  
**UI title:** Candles  
**Subtitle:** Monitor ticker price data intake  

**Related repos (future):**

| Repo | Role |
|------|------|
| `OceanView` | React UI — this pane |
| `OceanView-API` | API Gateway + Python Lambdas — `candles/*` and `admin/tickers` |
| `FinanceAI` | Reference repo — port Python patterns; AWS stack deleted when OceanView replaces it |

---

## Scope

### In scope

- Load last **candles job** summary and per-symbol candle context
- **Refresh candles** (incremental D / 1h / 15m intake)
- **Reset candles** (full re-fetch)
- **Refresh status** (read current collection state without starting a job)
- Per-row **Refresh one ticker**
- English labels only

### Out of scope (other panes / APIs)

- Earning calendar
- Foundation / BB15 / pipeline eval
- Strategy eval (Result Now)
- MySQL / InvestJournal catalog

---

## UI → API overview

All **candles** endpoints accept a **`tickers`** array from the UI (uppercase symbols). The UI builds that list from the admin ticker catalog (all rows, or a future selection).

```mermaid
flowchart TB
  subgraph UI["OceanView Admin — Candles Pane"]
    Load["Panel open"]
    BtnStatus["Refresh status"]
    BtnRefresh["Refresh candles"]
    BtnReset["Reset candles"]
    BtnRow["Refresh one ticker"]
  end

  subgraph Catalog["Admin catalog"]
    T["GET /admin/tickers"]
  end

  subgraph Candles["OceanView API — candles"]
    R["POST /candles/result"]
    S["POST /candles/status"]
    F["POST /candles/refresh"]
    X["POST /candles/reset"]
  end

  Load --> T
  T --> Load
  Load --> R
  BtnStatus --> S
  BtnRefresh --> F
  BtnReset --> X
  BtnRow --> F
```

**No client-side polling.** The UI never loops on `candles/status`. After **Refresh candles** or **Reset candles**, show the API acknowledgment only. The user updates rows via **Refresh status** (or by reloading the pane → `candles/result`).

---

## Button → API matrix

| UI control | When | API | Purpose |
|------------|------|-----|---------|
| *(panel open)* | After catalog loads | `GET /admin/tickers` | Symbol list, name, favorite flag |
| *(panel open)* | Immediately after | `POST /candles/result` | Last **candles job** outcome + per-symbol candle context |
| **Refresh status** | User click | `POST /candles/status` | Live collection state for requested tickers (no new job) |
| **Refresh candles** | User click | `POST /candles/refresh` | Start incremental intake; show acknowledgment message |
| **Reset candles** | User click (after confirm) | `POST /candles/reset` | Start full reset intake; show acknowledgment message |
| **Refresh** (row) | Per ticker | `POST /candles/refresh` `{ tickers: ["AAPL"] }` | Same as bulk, one symbol |

**After refresh/reset:** Do **not** poll. Display `202` message (e.g. job started). User clicks **Refresh status** when they want updated rows, or collapses/reopens the pane to reload `candles/result`.

---

## API reference (OceanView-API)

Base path: `/api` or same-origin `/` (CloudFront → API Gateway). All requests use JSON and **`Content-Type: application/json`**. Auth: Cognito JWT (TBD) — omitted from examples.

### Shared request field

```json
{
  "tickers": ["AAPL", "MSFT", "NVDA"]
}
```

| Rule | Detail |
|------|--------|
| `tickers` | Required on all `candles/*` endpoints |
| Normalization | Server uppercases, dedupes, drops empty strings |
| Empty array | `400` — at least one symbol required |
| Unknown symbol | Included in response with `outcome: "unknown"` (not a hard error) |

---

### `GET /admin/tickers`

**Purpose:** Catalog for the pane — not candle data.

**Response `200`:**

```json
{
  "tickers": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "isFavorite": true
    }
  ]
}
```

**Used by:** Panel open only.

---

### `POST /candles/result`

**Purpose:** Return the **last completed candles job** (or current session result) and **per-symbol candle context** — only fields related to candle collection, not full platform TickerContext.

**Request:**

```json
{
  "tickers": ["AAPL", "MSFT"]
}
```

**Response `200`:**

```json
{
  "job": {
    "jobId": "candles-20260624-001",
    "kind": "refresh",
    "status": "completed",
    "startedAt": "2026-06-24T09:15:00Z",
    "finishedAt": "2026-06-24T09:18:22Z",
    "summary": {
      "total": 2,
      "succeeded": 2,
      "failed": 0,
      "skipped": 0
    }
  },
  "banner": {
    "kind": "ok",
    "title": "Candle intake",
    "body": "Last run completed for 2 tickers."
  },
  "symbols": [
    {
      "symbol": "AAPL",
      "context": {
        "status": "ready",
        "lastBarAt": "2026-06-24T15:45:00-04:00",
        "intervals": {
          "daily": { "count": 120, "lastAt": "2026-06-23T16:00:00-04:00" },
          "hourly": { "count": 48, "lastAt": "2026-06-24T15:00:00-04:00" },
          "min15": { "count": 96, "lastAt": "2026-06-24T15:45:00-04:00" }
        },
        "error": null
      },
      "outcome": "success",
      "message": null
    },
    {
      "symbol": "MSFT",
      "context": {
        "status": "missing",
        "lastBarAt": null,
        "intervals": {},
        "error": null
      },
      "outcome": "skipped",
      "message": "No bars returned for session"
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `job` | Last candles job metadata (refresh or reset) |
| `banner` | Alert strip at top of pane (`ok` \| `warn` \| `error` \| `running` \| `none`) |
| `symbols[].context` | **Candles-only** context slice (not full Dynamo TickerContext) |
| `symbols[].outcome` | This symbol’s result in that job: `success` \| `failed` \| `skipped` \| `unknown` |

**Used by:** Panel open; after refresh/reset completes.

---

### `POST /candles/status`

**Purpose:** **Live** collection state for the requested tickers — **Refresh status** button only (no polling loop in the UI).

**Request:**

```json
{
  "tickers": ["AAPL"]
}
```

Single-ticker and multi-ticker use the **same endpoint** (pass one element for one row).

**Response `200`:**

```json
{
  "job": {
    "jobId": "candles-20260624-002",
    "kind": "refresh",
    "status": "running",
    "startedAt": "2026-06-24T10:00:00Z",
    "finishedAt": null,
    "progress": {
      "completed": 1,
      "total": 3
    }
  },
  "symbols": [
    {
      "symbol": "AAPL",
      "context": {
        "status": "ready",
        "lastBarAt": "2026-06-24T15:45:00-04:00",
        "intervals": {
          "daily": { "count": 120, "lastAt": "2026-06-23T16:00:00-04:00" },
          "hourly": { "count": 48, "lastAt": "2026-06-24T15:00:00-04:00" },
          "min15": { "count": 96, "lastAt": "2026-06-24T15:45:00-04:00" }
        },
        "error": null
      },
      "outcome": "success",
      "message": null
    }
  ]
}
```

| `job.status` | UI behavior |
|--------------|-------------|
| `running` | Show running banner (user may click **Refresh status** again later) |
| `completed` | Show ok banner; update rows from `symbols` |
| `failed` | Show error banner |
| `partial` | Show warn banner; update rows from `symbols` |
| `idle` | No active job — `symbols` still returned |

**Used by:** **Refresh status** button only.

---

### `POST /candles/refresh`

**Purpose:** Start **incremental** candle intake (D + 1h + 15m) for the given tickers.

**Request:**

```json
{
  "tickers": ["AAPL", "MSFT"]
}
```

**Response `202`:**

```json
{
  "jobId": "candles-20260624-002",
  "kind": "refresh",
  "status": "running",
  "message": "Candle refresh started. Use Refresh status when ready.",
  "tickers": ["AAPL", "MSFT"]
}
```

**Used by:** **Refresh candles**; per-row **Refresh**.

---

### `POST /candles/reset`

**Purpose:** Start **full reset** re-fetch of candles for the given tickers.

**Request:**

```json
{
  "tickers": ["AAPL", "MSFT"]
}
```

**Response `202`:** Same shape as refresh; `"kind": "reset"`.

**Used by:** **Reset candles** (destructive — confirm in UI).

---

## Sequence diagrams

### Panel open

```mermaid
sequenceDiagram
  participant Pane as Candles Pane
  participant API as OceanView API

  Pane->>API: GET /admin/tickers
  API-->>Pane: catalog[]
  Pane->>API: POST /candles/result { tickers: catalog symbols }
  API-->>Pane: job, banner, symbols[]
  Pane->>Pane: Render banner + table rows
```

### Refresh candles (bulk) — no polling

```mermaid
sequenceDiagram
  participant Pane as Candles Pane
  participant API as OceanView API

  Pane->>API: POST /candles/refresh { tickers }
  API-->>Pane: 202 jobId, acknowledgment message
  Pane->>Pane: Show success toast (no auto follow-up)
  Note over Pane: User clicks Refresh status when ready
  Pane->>API: POST /candles/status { tickers }
  API-->>Pane: job, symbols[]
  Pane->>Pane: Update banner + rows
```

### Refresh status (no job)

```mermaid
sequenceDiagram
  participant Pane as Candles Pane
  participant API as OceanView API

  Pane->>API: POST /candles/status { tickers }
  API-->>Pane: job (idle or last), symbols[]
  Pane->>Pane: Update Ctx badges + last bar columns
```

---

## UI specification

### Header

| Element | Text |
|---------|------|
| Title | Candles |
| Subtitle | Monitor ticker price data intake |
| **Refresh status** | Was “Consultar AWS” — reads `candles/status` |
| **Refresh candles** | Was “Actualizar barras” |
| **Reset candles** | Was “Reset barras” |

Removed from legacy pane: Request Earning Calendar, Refresh + foundation.

### Table columns

| Column | Source |
|--------|--------|
| ★ | `GET /admin/tickers` → `isFavorite` |
| Symbol / name | Catalog |
| Intake outcome | `symbols[].outcome` from `result` or `status` |
| Context | `symbols[].context.status` (`ready` / `missing` / `error`) |
| Last bar | `symbols[].context.lastBarAt` |
| Intervals detail | `symbols[].context.intervals` (expandable) |
| Actions | Row **Refresh** → `candles/refresh` with single ticker |

### Banner mapping

| `banner.kind` | Style |
|---------------|-------|
| `ok` | Green — last job succeeded |
| `warn` | Amber — partial failures |
| `error` | Red — job failed |
| `running` | Amber — job in progress |
| `none` | Gray — no job today |

---

## OceanView UI file plan

```
src/features/admin/
  AdminPage.tsx                 # hosts CandlesPane
  candles/
    CandlesPane.tsx             # collapsible panel + toolbar
    CandlesTable.tsx            # ticker rows
    CandlesBanner.tsx           # job summary alert
    types.ts                    # mirrors API DTOs
    api/
      candles-client.ts         # fetch wrappers (mock flag for dev)
      mock-data.ts              # until OceanView-API exists
    hooks/
      useCandlesPane.ts         # load, button handlers (no polling)
src/shared/components/
  CollapsibleSection.tsx        # reusable header + chevron
```

---

## OceanView-API file plan (later)

```
OceanView-API/
  template.yaml
  openapi/candles.yaml
  src/handlers/
    admin_tickers.py
    candles_result.py
    candles_status.py
    candles_refresh.py
    candles_reset.py
  src/application/
    candles_service.py          # orchestration, polling state
  src/infrastructure/
    ticker_store.py             # DynamoDB catalog
    candles_job_store.py        # job + per-symbol outcomes
    financeai_adapter.py        # temporary bridge during migration
```

---

## Implementation plan

### Now (OceanView UI only)

#### Phase 0 — Spec ✅

- [x] API names and button mapping
- [x] Request/response shapes
- [x] No client-side polling

#### Phase 1 — UI shell ✅

- [x] `CollapsibleSection` (ocean theme)
- [x] `CandlesPane` layout, English copy, mock catalog
- [x] Types + mock client returning fixture JSON
- [x] Wire into `AdminPage.tsx`

#### Phase 2 — UI behavior (mock client) ✅

- [x] `useCandlesPane`: catalog → `result` on open
- [x] **Refresh status** → single `status` call (no loop)
- [x] **Refresh candles** / row refresh → mock `refresh`; show acknowledgment only
- [x] **Reset candles** → confirm dialog → mock `reset`; show acknowledgment only
- [x] Row-level refresh (single ticker in `tickers` array)

**Explicitly out of Phase 2:** polling, timers, interval refetch, live API wiring.

---

### Later (not started — do not implement yet)

See **[plan.md](./plan.md)** for the full roadmap and **[oceanview-api-setup.md](./oceanview-api-setup.md)** for step-by-step repo creation, SAM deploy, and Phase 3–5 checklist.

#### Phase 3 — OceanView-API read paths

- `GET /admin/tickers`
- `POST /candles/result`
- `POST /candles/status`
- Point UI `VITE_API_BASE_URL` at API

#### Phase 4 — OceanView-API write paths

- `POST /candles/refresh` (async job, 202)
- `POST /candles/reset`
- Job tracking in `candles/status`
- FinanceAI bridge during migration

#### Phase 5 — Infra

- Cognito authorizer
- CloudFront `/api/*`
- Retire FinanceAI bar paths

---

## Migration note (FinanceAI reference only)

OceanView-API is built as a **new stack** with `OceanView-*` DynamoDB tables. FinanceAI is used to **port Python logic** (bar intake, Schwab client), not as a runtime API or shared database.

See [oceanview-api-setup.md §1b](./oceanview-api-setup.md) for which AWS resources to create vs avoid.

External contract for OceanView UI is **always** `candles/*` — never expose legacy FinanceAI paths to the browser.

---

## Cursor prompts (copy later)

**Build API:**

> Implement OceanView-API per `OceanView/docs/candles-pane.md`: `GET /admin/tickers`, `POST /candles/result`, `POST /candles/status`, `POST /candles/refresh`, `POST /candles/reset`. All candles routes require `{ "tickers": string[] }`. Python SAM, thin handlers.

**Build UI (Phases 1–2 only):**

> Implement Admin Candles Pane per `OceanView/docs/candles-pane.md`. English labels. Mock client only. No polling. Subtitle: "Monitor ticker price data intake". Reset requires confirm dialog. After refresh/reset show message only; user clicks Refresh status to update rows.
