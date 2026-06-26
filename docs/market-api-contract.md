# Market API contract (proposed)

OceanView Market UI is built against **mock JSON** today. When integrating a live backend, prefer a **single OceanView BFF** (`OceanView-API`) rather than calling FinanceAI from the browser (API keys must stay server-side).

This contract is **OceanView-native** — names are stable for the UI even if the BFF adapts FinanceAI / InvestJournal internals.

**Executive plan (pipeline, load sequence, phases):** [market-backend-plan.md](./market-backend-plan.md)

---

## Architecture — evaluate once, serve many views

The backend runs a **single evaluation pipeline**, persists the **canonical result**, then **projects** that store into lean snapshot payloads (grids) or full detail payloads (modals). The UI never needs the full `results[]` tree on initial page load.

### Internal pipeline (OceanView-API)

Same mental model as FinanceAI, simplified to four stages:

```
candles → evaluate-foundation → evaluate-checks → assess-strategies → persist run
```

| Stage | Input | Output (stored) |
|-------|--------|-----------------|
| **1. Candles** | `OceanView-Candles`, `OceanView-CandleStatus` | OHLC bars + coverage window |
| **2. Evaluate foundation** | bars + `simulationTimeEt` | session context, gaps, trade date, per-symbol bar availability |
| **3. Evaluate checks** | foundation + rule definitions | per `(symbol, ruleKey)` status, `metAtEt`, evidence |
| **4. Assess strategies** | checks + strategy catalog | per `(symbol, strategyId)` quality, direction, rule rollups, `achievedAtEt` |

**Persist** the run as a single document keyed by `runId` (DynamoDB `OceanView-MarketEval` or job result blob). All read endpoints below are **projections** of that store — not re-runs of FinanceAI unless `POST /market/evaluate` is called.

### UI load pattern

| When | What the UI calls | Payload size |
|------|-------------------|--------------|
| Page open | `GET /market/envelope` | Tiny — coverage, last run metadata, summary counts |
| Grid (By strategy) | `GET /market/strategies/snapshot` | Lean — one card per strategy |
| Grid (By ticker) | `GET /market/tickers/snapshot` | Lean — one card per ticker |
| Grid (By rule) | `GET /market/rules/snapshot` | Lean — one card per rule |
| **View detail** click | `GET /market/strategies/{id}/detail` or `GET /market/tickers/{symbol}/detail` | Full rows + all rules for that pivot |
| **Assess** click | `POST /market/evaluate` → poll `GET /market/evaluate/{runId}` | Writes new run; UI re-fetches envelope + active snapshot |

### URL routes + localStorage (UI)

| Route | View mode | Snapshot API |
|-------|-----------|--------------|
| `/market` | redirect | → last mode from `localStorage` key `oceanview.market.viewMode` |
| `/market/strategies` | By strategy | `GET /market/strategies/snapshot` |
| `/market/tickers` | By ticker | `GET /market/tickers/snapshot` |
| `/market/rules` | By rule | `GET /market/rules/snapshot` |

Mode changes update **both** the URL and `localStorage` so refresh and deep links behave the same.

### Endpoint summary

| Endpoint | Purpose | When |
|----------|---------|------|
| `GET /market/envelope` | Page bootstrap: coverage, last `runId`, summary counts, catalog version | Always on load |
| `GET /market/strategies` | Strategy + rule definitions (catalog) | Once; cacheable |
| `GET /market/strategies/snapshot` | Thumbnail grid for **By strategy** | After envelope |
| `GET /market/tickers/snapshot` | Thumbnail grid for **By ticker** | After envelope |
| `GET /market/rules/snapshot` | Thumbnail grid for **By rule** | After envelope |
| `GET /market/strategies/{id}/detail` | Full ticker table + rules for one strategy | View detail |
| `GET /market/tickers/{symbol}/detail` | Full strategy accordion + rules for one ticker | View detail |
| `GET /market/rules/{ruleKey}/detail` | All tickers for one rule (optional v2) | View detail on rule card |
| `POST /market/evaluate` | Run pipeline at `simulationTimeEt` | Assess button |
| `GET /market/evaluate/{runId}` | Poll async eval job | Large batches |
| `GET /tickers` | Active ticker catalog | Universe for eval |

**Deprecated for v1 UI:** monolithic `GET /market/snapshot` with full `results[]` — keep only for admin/debug or backward compat; prefer envelope + snapshot + detail.

---

## Backend data requirements (complete inventory)

Everything the Market page needs from the backend, grouped by domain. Types align with `src/features/market/types.ts`.

### Summary — endpoints → data

| Endpoint | Purpose | Required for UI |
|----------|---------|-----------------|
| `GET /tickers` | Active ticker catalog (symbol, name) | Yes — universe for eval |
| `GET /market/envelope` | Bootstrap: coverage, last run, summary | Yes — every page load |
| `GET /market/strategies` | Strategy + rule definitions | Yes — detail modals, rule labels |
| `GET /market/strategies/snapshot` | Strategy thumbnail grid | Yes — `/market/strategies` |
| `GET /market/tickers/snapshot` | Ticker thumbnail grid | Yes — `/market/tickers` |
| `GET /market/rules/snapshot` | Rule thumbnail grid | Yes — `/market/rules` |
| `GET /market/strategies/{id}/detail` | Full eval for one strategy | Yes — View detail |
| `GET /market/tickers/{symbol}/detail` | Full eval for one ticker | Yes — View detail |
| `POST /market/evaluate` | Run eval at `simulationTimeEt` | Yes — **Assess** button |
| `GET /market/evaluate/{runId}` | Poll async eval job | Yes — large ticker batches |
| `GET /market/snapshot` | Full canonical run (debug) | Optional — prefer snapshots |

---

### 1. Ticker catalog (existing Admin API)

Used to know **which symbols** to evaluate and display names on cards/rows.

**Source today:** `GET /api/tickers` (OceanView-API → `OceanView-Tickers`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `symbol` | string | yes | Keys, search, cards |
| `name` | string \| null | no | Subtitle on ticker rows/cards |
| `isFavorite` | boolean | no | Future: sort/filter |
| `active` | boolean | yes | Only `active !== false` enter Market eval |

---

### 2. Strategy catalog

Static or slow-changing definitions. One row per strategy in **By strategy** grid.

**Source:** `GET /market/strategies` (BFF; may mirror FinanceAI `GET /context/strategies` + playbooks)

#### Catalog envelope

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `version` | string | yes | Cache busting |
| `updatedAt` | string (date) | yes | Display / cache |
| `strategies` | array | yes | Grid count, cards |

#### Strategy object (`strategies[]`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `id` | string | yes | Stable key (`estrategia-01`, `change-trend-15m`, …) |
| `name` | string | yes | Card title, modal title |
| `shortName` | string | no | Compact labels |
| `description` | string | yes | Strategy detail modal subtitle |
| `entryWindow` | string | no | Card subtitle, detail header |
| `rules` | array | yes | Rule list in expanded criteria |

#### Rule object (`rules[]`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `id` | string | yes | Internal id (may equal `ruleKey`) |
| `ruleKey` | string | yes | Join key to eval results |
| `label` | string | yes | Rule row text |
| `type` | `"required"` \| `"extra"` | yes | Required vs extra badge; scoring weight |
| `timeframe` | string | no | `"D"`, `"1h"`, `"15m"`, `"execution"` — display only |

**Current strategies (5):** `estrategia-02` Midpoint Bounce, `estrategia-01` Hourly Trend Change, `change-trend-15m` Change Trend 15M, `bolinger-15-change-trend` Inside Bollinger 15M, `estrategia-03` Magnet Effect.

---

### 3. Candle coverage (assessment window)

Constrains the **Assess at** datetime control. User cannot evaluate at a time before the earliest or after the latest collected bar.

**Source:** `GET /market/candle-coverage`  
**Derived from:** `OceanView-Candles` + `OceanView-CandleStatus` (after Admin Candles refresh)

#### Coverage envelope

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `timezone` | string | yes | Always `"America/New_York"` for ET display |
| `earliestAt` | ISO8601 | yes | Datetime input `min` |
| `latestAt` | ISO8601 | yes | Datetime input `max`; default “now” clamped here |
| `tradeDate` | `YYYY-MM-DD` | no | Session context |
| `perSymbol` | array | no | Debug / per-ticker gaps; optional for v1 |

#### Per-symbol coverage (`perSymbol[]`, optional)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `symbol` | string | yes | Ticker |
| `earliestAt` | ISO8601 | yes | Symbol-specific min |
| `latestAt` | ISO8601 | yes | Symbol-specific max |
| `intervals.daily` | string | no | Last daily bar date |
| `intervals.hourly` | ISO8601 | no | Last hourly bar timestamp |
| `intervals.min15` | ISO8601 | no | Last 15m bar timestamp |

**Validation:** `POST /market/evaluate` and snapshot/detail reads with `simulationTimeEt` outside `[earliestAt, latestAt]` → **400**.

**Note:** `candleCoverage` is returned inside `GET /market/envelope` (and may be duplicated on snapshot responses). A standalone `GET /market/candle-coverage` is optional.

---

### 3b. Market envelope (page bootstrap)

Single round-trip for header, assessment control, and which run to query.

**Source:** `GET /market/envelope`  
**Query:** optional `simulationTimeEt` — if omitted, server returns **latest completed run** for today (or nearest prior run).

#### Envelope response

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `runId` | string | yes | Pass to snapshot/detail endpoints |
| `evaluatedAt` | ISO8601 | yes | Server completion time |
| `simulationTimeEt` | ISO8601 | yes | Assessment moment (summary strip) |
| `tradeDate` | `YYYY-MM-DD` | yes | Session date |
| `signalThresholdPct` | number | yes | Signal badge threshold (default 50) |
| `catalogVersion` | string | yes | Match against cached strategies |
| `status` | enum | yes | `complete` \| `running` \| `failed` \| `stale` |
| `candleCoverage` | object | yes | §3 shape — datetime min/max |
| `summary.strategyCount` | number | yes | Summary strip |
| `summary.tickerCount` | number | yes | Summary strip |
| `summary.activeSignals` | number | yes | Cross `(symbol, strategy)` above threshold |
| `summary.ruleCount` | number | no | Rules mode |

**Example**

```json
{
  "runId": "mkt-20260624-143022",
  "evaluatedAt": "2026-06-24T18:30:22Z",
  "simulationTimeEt": "2026-06-24T14:30:00-04:00",
  "tradeDate": "2026-06-24",
  "signalThresholdPct": 50,
  "catalogVersion": "1",
  "status": "complete",
  "candleCoverage": {
    "timezone": "America/New_York",
    "earliestAt": "2026-06-20T09:30:00-04:00",
    "latestAt": "2026-06-24T14:30:00-04:00"
  },
  "summary": {
    "strategyCount": 5,
    "tickerCount": 12,
    "activeSignals": 7,
    "ruleCount": 28
  }
}
```

---

### 4. Snapshot endpoints (thumbnail grids)

All snapshots share query params:

| Query | Type | Notes |
|-------|------|-------|
| `runId` | string | Preferred — from envelope |
| `simulationTimeEt` | string | Alternative lookup if no `runId` |
| `search` | string | Optional server-side filter (UI filters client-side today) |

#### 4a. `GET /market/strategies/snapshot`

One object per strategy — everything **StrategyCard** needs without detail click.

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `runId` | string | yes | Correlation |
| `items[].strategyId` | string | yes | Card key |
| `items[].name` | string | yes | Title |
| `items[].shortName` | string | no | Compact label |
| `items[].entryWindow` | string | no | Subtitle |
| `items[].signalCount` | number | yes | Badge |
| `items[].previewTickers[]` | array | yes | Up to 4 `{ symbol, qualityPct, achievedAtEt? }` |

#### 4b. `GET /market/tickers/snapshot`

One object per ticker — everything **TickerCard** needs.

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `items[].symbol` | string | yes | Card key |
| `items[].name` | string \| null | no | Subtitle |
| `items[].signalCount` | number | yes | Badge |
| `items[].bestSignal` | object \| null | no | `{ strategyId, strategyName, qualityPct, direction, achievedAtEt? }` |
| `items[].topStrategyEval` | object | no | Highest quality eval for rule icon strip: `{ strategyId, qualityPct, rules[] }` where `rules[]` is lean `{ ruleKey, status, metAtEt? }` |

#### 4c. `GET /market/rules/snapshot`

One object per `(strategyId, ruleKey)` — everything **RuleCard** needs.

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `items[].ruleKey` | string | yes | Card key (with strategyId) |
| `items[].label` | string | yes | Title |
| `items[].type` | `"required"` \| `"extra"` | yes | Badge |
| `items[].timeframe` | string | no | Display |
| `items[].strategyId` | string | yes | Parent strategy |
| `items[].strategyName` | string | yes | Subtitle |
| `items[].metCount` | number | yes | "N of M tickers met" |
| `items[].totalSymbols` | number | yes | Denominator |
| `items[].previewSymbols[]` | array | yes | Up to 4 `{ symbol, status, metAtEt? }` |

---

### 5. Detail endpoints (View detail)

Fetched on demand when user opens a modal. Includes **full rule lists** with evidence.

#### 5a. `GET /market/strategies/{strategyId}/detail`

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `strategy` | object | yes | Full catalog strategy (§2) |
| `runId` | string | yes | Correlation |
| `rows[]` | array | yes | Sorted ticker table |

Each `rows[]` item:

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `symbol` | string | yes | Row key |
| `name` | string \| null | no | Subtitle |
| `qualityPct` | number | yes | Quality badge |
| `direction` | `"CALL"` \| `"PUT"` \| null | no | Direction pill |
| `metCount` / `totalCount` | number | yes | Criteria column |
| `achievedAtEt` | string | no | Achieved column |
| `rules[]` | array | yes | Full § Rule eval — expand row |

#### 5b. `GET /market/tickers/{symbol}/detail`

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `symbol` | string | yes | Modal title |
| `name` | string \| null | no | Subtitle |
| `runId` | string | yes | Correlation |
| `strategies[]` | array | yes | One accordion section per strategy |

Each `strategies[]` item matches **Strategy eval** (§6 below): `strategyId`, `qualityPct`, `direction`, counts, `achievedAtEt`, full `rules[]`.

#### 5c. `GET /market/rules/{ruleKey}/detail` (optional v2)

Query: `strategyId` (required if ruleKey is not globally unique).

Returns all tickers with full status/evidence for that rule — powers a future rule detail modal.

---

### 6. Canonical evaluation store (internal / debug)

The **full run** written by the pipeline. Snapshot and detail endpoints **project** from this document; the UI should not download it on page load.

**Source:** `GET /market/snapshot?runId=` (admin/debug) or `GET /market/evaluate/{runId}` when complete  
**Query/body:** `tradeDate`, `simulationTimeEt`, optional `symbols`

#### Snapshot envelope

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `version` | string | yes | Schema version |
| `evaluatedAt` | ISO8601 | yes | When eval completed (server clock) |
| `tradeDate` | `YYYY-MM-DD` | yes | Session date |
| `simulationTimeEt` | ISO8601 or `HH:mm` | yes | **Assessment moment** shown in summary (“Live …” / “Assessed …”) |
| `signalThresholdPct` | number | yes | Default `50` — “signal today” badge threshold |
| `runId` | string | no | Job correlation |
| `status` | string | no | `complete` \| `running` \| `failed` \| `partial` |
| `candleCoverage` | object | no | May embed same shape as §3 for single round-trip |
| `results` | array | yes | All ticker eval rows |

#### Ticker result (`results[]`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `symbol` | string | yes | Row/card key |
| `name` | string \| null | no | From ticker catalog |
| `strategies` | array | yes | One eval per strategy for this ticker |

#### Strategy eval (`results[].strategies[]`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `strategyId` | string | yes | Join to catalog |
| `qualityPct` | number 0–100 | yes | Quality badge, signal filter, sort |
| `direction` | `"CALL"` \| `"PUT"` \| null | no | Direction pill on ticker cards / detail |
| `metCount` | number | yes | Criteria column `3/6` (numerator) |
| `totalCount` | number | yes | Criteria column `3/6` (denominator) |
| `metRequired` | number | no | Required-rules met count |
| `totalRequired` | number | no | Required-rules total |
| `achievedAtEt` | string | no | **Achieved** column when `qualityPct >= threshold` (ET, e.g. `"10:42 AM"`) |
| `rules` | array | yes | Icon strip + expanded rule list |

#### Rule eval (`rules[]`)

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `ruleKey` | string | yes | Join to catalog rule |
| `status` | enum | yes | Icon: ✓ ○ · G (see below) |
| `metAtEt` | string | no | **Pass time** beside rule when `status === "met"` |
| `evidence` | string | no | Secondary line under rule (optional) |

#### Enums

**`status` (rule):**

| Value | UI icon | Meaning |
|-------|---------|---------|
| `met` | ✓ | Rule passed |
| `partial` | ○ (amber) | Near / partial |
| `not_met` | ○ (orange) | Not met |
| `pending` | · | Not yet evaluable at assessment time |
| `about_to_cross` | G | About to cross BB mid (Mov15m) |

**Signal:** ticker/strategy is a “signal today” when `qualityPct >= signalThresholdPct`.

---

### 5. Evaluate request (write)

Sent when user clicks **Assess** (and on initial load if auto-eval enabled later).

**Source:** `POST /market/evaluate`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `symbols` | string[] | yes | Active catalog symbols; max ~50 per batch |
| `strategyIds` | string[] | no | Default: all catalog strategies |
| `tradeDate` | `YYYY-MM-DD` | no | Default: today ET |
| `simulationTimeEt` | string | no | Assessment moment in ET; omit = now clamped to `latestAt` |
| `options.signalThresholdPct` | number | no | Default 50 |
| `options.includeExtraRules` | boolean | no | Include `extra` rules in counts |

---

### 6. Async job (large batches)

Same pattern as Admin Candles.

**Source:** `GET /market/evaluate/{runId}`

| Field | Type | Required | UI use |
|-------|------|----------|--------|
| `runId` | string | yes | Poll key |
| `status` | enum | yes | `running` \| `complete` \| `failed` \| `partial` |
| `progress.completed` | number | no | Progress (future) |
| `progress.total` | number | no | Progress (future) |
| `summary.symbols` | number | no | Summary strip |
| `summary.signals` | number | no | Active signals count |
| `summary.failed` | number | no | Error banner |
| `snapshot` | object | when complete | Full §4 payload |

---

### 7. Data the UI derives today (client-side from mock)

With live APIs, the backend **should pre-compute** snapshot and detail shapes so the UI does not pivot full `results[]`:

| View | Mock (today) | Live API |
|------|--------------|----------|
| Strategy grid cards | `buildStrategyCards()` | `GET /market/strategies/snapshot` |
| Ticker grid cards | `buildTickerCards()` | `GET /market/tickers/snapshot` |
| Rule grid cards | `buildRuleCards()` | `GET /market/rules/snapshot` |
| Strategy detail table | `tickersForStrategy()` | `GET /market/strategies/{id}/detail` |
| Ticker detail accordion | one `results[]` row | `GET /market/tickers/{symbol}/detail` |
| Rule labels in eval | `mergeRuleDisplay()` | detail responses include merged labels |

---

### 8. Upstream dependencies (backend implementation)

| Dependency | Provides | Required before Market eval |
|------------|----------|----------------------------|
| `OceanView-Tickers` | Symbol catalog | Yes |
| `OceanView-Candles` | OHLC bars (D, 1h, 15m) | Yes |
| `OceanView-CandleStatus` | Per-symbol bar freshness | Yes — for coverage window |
| FinanceAI (via BFF) | Rule evaluation engine | Yes — strategy logic |
| `OceanView-JobsStatus` (optional) | Persist market eval jobs | Recommended for async |

**Without candles:** return `status: "skipped"` or `pending` for affected tickers; do not fail entire batch.

**FinanceAI mapping (adapter only):**

| OceanView field | FinanceAI source |
|-----------------|------------------|
| `simulationTimeEt` | `POST /tickers/check` simulation time |
| `results[].strategies[]` | `strategyChecklist.strategies[]` |
| `rules[].status` | checklist item `status` |
| `rules[].metAtEt` | checklist item `metAtEt` |
| `qualityPct` | derived from checklist scoring / `probabilityPct` |
| `direction` | strategy `direction` |
| Inside Bollinger 15M | `POST /context/mov15m/status` (special case) |

---

### 9. Error responses

| Code | When | UI behavior |
|------|------|-------------|
| `400` | Invalid symbols, `simulationTimeEt` outside coverage, empty body | Show error on datetime control or banner |
| `409` | Eval job already running | Disable Assess, show message |
| `504` | Sync timeout | Retry async job |

```json
{ "error": "Human-readable message", "code": "MARKET_EVAL_OUT_OF_COVERAGE" }
```

Suggested `code` values: `MARKET_EVAL_OUT_OF_COVERAGE`, `MARKET_EVAL_CONFLICT`, `MARKET_NO_CANDLES`, `MARKET_INVALID_SYMBOL`.

---

## Principles

1. **Evaluate once, serve many** — pipeline writes one canonical run; BFF projects envelope, snapshots, and detail.
2. **Catalog vs eval** — strategy definitions change rarely; eval results refresh often.
3. **Lean first load** — envelope + one snapshot endpoint per active view mode; no full `results[]` on grid load.
4. **Detail on demand** — full rules + evidence only when user opens View detail.
5. **Rule keys are stable** — `ruleKey` matches catalog; eval returns status per key.
6. **Async batch eval** — large ticker sets use job + poll (like candles refresh).
7. **URL + localStorage** — view mode is shareable (`/market/tickers`) and sticky across visits.

---

## Base URL (future)

| Environment | Base |
|-------------|------|
| Production | `GET/POST /api/market/*` via CloudFront |
| Local dev | Vite proxy → OceanView-API or mock JSON |

---

## 1. Strategy catalog

### `GET /market/strategies`

Static or slow-changing list of strategies and rules.

**Response `200`**

```json
{
  "version": "1",
  "updatedAt": "2026-06-25",
  "strategies": [
    {
      "id": "estrategia-01",
      "name": "Hourly Trend Change",
      "shortName": "Trend Change 1H",
      "description": "Hourly trendline break with 15m confirmation.",
      "entryWindow": "9:30–11:00 ET (1H break + 15m confirm)",
      "rules": [
        {
          "id": "prior_trend_1h",
          "ruleKey": "prior_trend_1h",
          "label": "Prior hourly trend",
          "type": "required",
          "timeframe": "1h"
        }
      ]
    }
  ]
}
```

**Maps today:** `/data/strategies.json`

**FinanceAI source (BFF adapter):** `GET /context/strategies` + playbook metadata

---

## 2. Market snapshot (read)

### `GET /market/snapshot`

Latest completed evaluation for the active ticker universe.

**Query params**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `tradeDate` | `YYYY-MM-DD` | today ET | Session date |
| `simulationTimeEt` | ISO8601 or `YYYY-MM-DDTHH:mm` | now ET | Point-in-time assessment (must fall within candle coverage) |
| `symbols` | comma list | catalog active | Subset filter |

**Response `200`**

```json
{
  "version": "1",
  "evaluatedAt": "2026-06-25T14:30:00-04:00",
  "tradeDate": "2026-06-25",
  "simulationTimeEt": "2026-06-25T14:30:00-04:00",
  "signalThresholdPct": 50,
  "candleCoverage": {
    "timezone": "America/New_York",
    "earliestAt": "2026-06-20T09:30:00-04:00",
    "latestAt": "2026-06-25T16:00:00-04:00"
  },
  "runId": "market-20260625-143000",
  "status": "complete",
  "results": [
    {
      "symbol": "LOW",
      "name": "Lowe's Companies, Inc.",
      "strategies": [
        {
          "strategyId": "estrategia-02",
          "qualityPct": 50,
          "direction": null,
          "metCount": 3,
          "totalCount": 6,
          "metRequired": 2,
          "totalRequired": 3,
          "achievedAtEt": "10:42 AM",
          "rules": [
            { "ruleKey": "daily_trend_context", "status": "met", "metAtEt": "09:15", "evidence": null }
          ]
        }
      ]
    }
  ]
}
```

**Maps today:** `/data/market-snapshot.json`

**Rule status enum:** `met` | `partial` | `not_met` | `pending` | `about_to_cross`

**Direction enum:** `CALL` | `PUT` | `null`

---

## 2b. Candle coverage (assessment window)

### `GET /market/candle-coverage`

Returns the valid time range for point-in-time assessment based on **collected candles** in DynamoDB (`OceanView-Candles` + `OceanView-CandleStatus`).

**Query params:** optional `symbols` (comma list) — if omitted, union across active catalog.

**Response `200`**

```json
{
  "timezone": "America/New_York",
  "earliestAt": "2026-06-20T09:30:00-04:00",
  "latestAt": "2026-06-25T16:00:00-04:00",
  "tradeDate": "2026-06-25",
  "perSymbol": [
    {
      "symbol": "AAPL",
      "earliestAt": "2026-06-20T09:30:00-04:00",
      "latestAt": "2026-06-25T15:45:00-04:00",
      "intervals": { "daily": "2026-06-24", "hourly": "2026-06-25T15:00:00-04:00", "min15": "2026-06-25T15:45:00-04:00" }
    }
  ]
}
```

UI uses `earliestAt` / `latestAt` as `min`/`max` on the assessment datetime control. Assessment requests with `simulationTimeEt` outside this window return **400**.

**Maps today:** `candleCoverage` on `/data/market-snapshot.json`

---

## 3. Run evaluation (write)

### `POST /market/evaluate`

Start or refresh evaluation for tickers × strategies.

**Request body**

```json
{
  "symbols": ["AAPL", "NVDA", "LOW"],
  "strategyIds": ["estrategia-01", "estrategia-02"],
  "tradeDate": "2026-06-25",
  "simulationTimeEt": "09:45",
  "options": {
    "signalThresholdPct": 50,
    "includeExtraRules": true
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `symbols` | yes | Max ~50 per request (batch) |
| `strategyIds` | no | Default: all active strategies |
| `tradeDate` | no | Default: today ET |
| `simulationTimeEt` | no | Point-in-time eval in ET; must be within `candleCoverage`. Omit = now (clamped to latest bar). |
| `options.signalThresholdPct` | no | UI signal badge threshold |

**Response `202`** (async — preferred for large sets)

```json
{
  "runId": "market-20260625-143000",
  "status": "running",
  "message": "Market evaluation started.",
  "symbols": ["AAPL", "NVDA", "LOW"],
  "strategyIds": ["estrategia-01", "estrategia-02"]
}
```

**Response `200`** (sync — small sets only)

Same body as `GET /market/snapshot`.

---

## 4. Poll evaluation job

### `GET /market/evaluate/{runId}`

**Response `200`**

```json
{
  "runId": "market-20260625-143000",
  "status": "running | complete | failed | partial",
  "progress": { "completed": 12, "total": 50 },
  "summary": { "symbols": 50, "signals": 3, "failed": 1 },
  "snapshot": null
}
```

When `status === "complete"`, include full `snapshot` object (same shape as `GET /market/snapshot`).

**FinanceAI adapter mapping**

| OceanView | FinanceAI (today) |
|-----------|-------------------|
| `POST /market/evaluate` | `POST /tickers/check` |
| `GET /market/evaluate/{runId}` | `GET /tickers/check/result` |
| Single ticker refresh | `POST /tickers/{symbol}/check` |
| Mov15m inside strategy | `POST /context/mov15m/status` (special case) |

BFF normalizes FinanceAI `strategyChecklist.strategies[]` + `checklist[]` into OceanView `TickerStrategyEval`.

---

## 5. Single ticker detail (optional shortcut)

### `GET /market/tickers/{symbol}`

Returns one row from snapshot + catalog merge. Useful for deep links.

**Query:** `tradeDate`, `refresh=true` (triggers single-ticker eval)

---

## 6. Single strategy detail (optional shortcut)

### `GET /market/strategies/{strategyId}/results`

Returns `{ strategy, tickers: [...] }` — server-side pivot of snapshot.

---

## Error shape (all routes)

```json
{
  "error": "Human-readable message",
  "code": "MARKET_EVAL_CONFLICT"
}
```

| HTTP | When |
|------|------|
| 400 | Invalid symbols, empty body |
| 409 | Eval already running (`MARKET_EVAL_CONFLICT`) |
| 504 | Sync eval timeout — client should use async |

---

## UI integration checklist (later)

- [ ] Replace `loadMarketWorkspaceData()` with `GET /market/strategies` + `GET /market/snapshot`
- [ ] Add “Refresh eval” button → `POST /market/evaluate` + poll
- [ ] Keep mock fallback via `VITE_USE_MOCK_MARKET=true`
- [ ] BFF holds FinanceAI API key in Secrets Manager

---

## Mock files (current)

| File | Backend section replaced |
|------|--------------------------|
| `data/strategies.json` | §2 Strategy catalog |
| `data/market-snapshot.json` | §3 Coverage + §4 Snapshot |

Types: `src/features/market/types.ts`
