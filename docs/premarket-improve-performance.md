# Plan — premarket improve performance

**Status:** Proposal — premarket evaluate works for a small catalog (e.g. AAPL only) but will not scale without async + parallel fetch.

**Canonical plan** (this file). API implementation details: `OceanView-API/docs/premarket-improve-performance.md` (mirror).

**Related:**

| Doc | Repo | Role |
|-----|------|------|
| [premarket-page.md](./premarket-page.md) | OceanView | UI routes, client, hooks |
| [premarket-evaluate.md](https://github.com/mlsloynaz/OceanView-API/blob/main/docs/premarket-evaluate.md) | OceanView-API | API contract |

---

## UI today (bottleneck)

`usePremarketWorkspace` → `postPremarketStart()` **awaits a single HTTP response** until the full batch finishes (`premarket-client.ts`). That matches the API’s synchronous `POST /premarket/evaluate/start`.

| Risk | When |
|------|------|
| Browser / proxy timeout | 10+ active tickers (~1–3 s each) |
| API Gateway **504** | ~29 s integration limit (Lambda may still complete) |
| Blocked UI | User can Stop, but Start stays pending for entire run |

**Minimum fix for UI:** Phase 2 — `start` returns **202** quickly; poll `GET /premarket/evaluate/result` until `status` is terminal.

---

## 1. Problem statement

`POST /premarket/evaluate/start` runs a **synchronous** batch on the API:

```text
for each active ticker:
  read Dynamo candles
  Schwab fetch (today extended-hours 15m)
  merge bars in memory
  assess_symbol (foundation → rules → strategies)
  write JobsStatus progress
write MarketEval context + final JobsStatus
```

### Hard limits

| Layer | Limit | Risk |
|-------|-------|------|
| **API Gateway** | ~**29 s** | `start` → **504** while Lambda may still run |
| **Premarket Lambda** | **300 s** | Job can finish after client timeout |
| **Schwab** | Rate limits (undocumented) | 429 if parallelized too aggressively |
| **UI** | `startPending` until full `200` | Poor UX for long runs |

**Rough cost:** ~1–3 s × N symbols. **40 symbols** → 504 likely on sync `start`.

---

## 2. Goals

| Priority | Goal | Success metric |
|----------|------|----------------|
| **G1** | `start` does not block on API Gateway | UI gets `202` + `runId` in &lt; 2 s; polls `result` |
| **G2** | Full catalog within Lambda timeout | 50 symbols &lt; 240 s P95 |
| **G3** | Respect Schwab limits | Bounded concurrency + backoff |
| **G4** | Visible progress | `progress.completed / progress.total` every 2–5 s |
| **G5** | No regression | Premarket still **never** persists live bars to Admin candles |

---

## 3. Recommended phases

```text
P0 measure → P1 API quick wins → P2 async (API + UI) → P3 parallel Schwab → P4 batch Dynamo → P5 CPU (if needed)
```

### Phase 0 — Baseline (API, 0.5 day)

- Per-symbol timing logs (`dynamo_ms`, `schwab_ms`, `assess_ms`)
- `scripts/premarket_bench.ps1`
- Bench table: 1 / 5 / 10 active tickers

### Phase 1 — API quick wins (1 day, sync-compatible)

- Hoist Schwab token once per run
- Throttle JobsStatus writes (every 2 s, not every symbol)
- Fewer stop-flag Dynamo reads

### Phase 2 — Async start (1–2 days) **do this before growing catalog**

**API**

- `POST /premarket/evaluate/start` → **`202`** `{ runId, status: "running" }`
- Batch continues in Lambda (async invoke or background)
- Optional `options.sync: true` for local debug only

**UI** (`src/features/premarket/`)

| File | Change |
|------|--------|
| `api/premarket-client.ts` | `postPremarketStart` accepts `202`; return `{ runId, status }` not full result |
| `hooks/usePremarketWorkspace.ts` | After start: poll `fetchPremarketResult(runId)` every 1–2 s until terminal |
| `components/PremarketToolbar.tsx` | Progress: `completed / total` from poll payload |
| `docs/premarket-page.md` | Update “start is sync” → async + poll |

**Poll stop condition:** `status` ∈ `complete` | `partial` | `failed` | `stopped`

### Phase 3 — Parallel Schwab (API, 1–2 days)

- `PREMARKET_SCHWAB_CONCURRENCY=3` (default)
- Retry/backoff on 429
- UI unchanged (still polls `result`)

### Phase 4 — Dynamo batch reads (API, 0.5–1 day)

- `BatchGetItem` for all symbols before fetch loop

---

## 4. UI contract after Phase 2

### Start — `202`

```json
{
  "runId": "premkt-20260629-142530",
  "status": "running",
  "message": "Premarket evaluate started."
}
```

### Poll — `GET /premarket/evaluate/result?runId=`

Same shape as today; use `progress` + `status` while running.

### Hook sketch

```ts
const { runId, status } = await postPremarketStart(body);
if (status === "running") {
  await pollPremarketUntilDone(runId, { intervalMs: 1500, onProgress: setResult });
}
```

---

## 5. UI task checklist

- [ ] Handle `202` on start in `premarket-client.ts`
- [ ] Add `pollPremarketResult(runId, options)` with backoff
- [ ] Refactor `startEvaluate` to poll instead of awaiting full result
- [ ] Show progress bar from `result.progress`
- [ ] Keep Stop working during poll (`POST /stop`)
- [ ] Handle 504 on legacy sync path (message: “Job may still be running — Refresh result”)
- [ ] Update [premarket-page.md](./premarket-page.md)

---

## 6. API task checklist (OceanView-API)

See full detail in `OceanView-API/docs/premarket-improve-performance.md`:

- [ ] Phase 0–1: logging, token hoist, throttled JobsStatus
- [ ] Phase 2: async `202`, worker
- [ ] Phase 3: concurrency pool
- [ ] Phase 4: `batch_get_bars`
- [ ] `pytest tests/test_premarket_*.py` green

---

## 7. Configuration (proposed)

| Env var | Default | Purpose |
|---------|---------|---------|
| `PREMARKET_SCHWAB_CONCURRENCY` | `3` | Parallel Schwab fetches |
| `PREMARKET_PROGRESS_WRITE_INTERVAL_S` | `2` | JobsStatus write throttle |
| `PREMARKET_SYNC_START` | `false` | Legacy blocking `200` (local only) |

---

## 8. Testing

| Test | Owner |
|------|-------|
| AAPL-only: start → complete, grouped strategies | API + UI |
| Async: 202 &lt; 2 s, poll until complete | API + UI |
| Stop mid-run: partial results | API + UI |
| 10+ symbols: no UI hang / no 504 on async path | API + UI |
| `VITE_USE_MOCK_PREMARKET=true` still works | UI |

---

## 9. Appendix — baseline (fill after Phase 0)

| Active symbols | Wall time (s) | Notes |
|----------------|---------------|-------|
| 1 (AAPL) | | |
| 5 | | |
| 10 | | |
