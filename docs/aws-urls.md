# OceanView — AWS URLs (production)

Quick reference for hosted OceanView in **us-east-1**. Region and IDs match the current deploy; update this file if CloudFront or API Gateway is recreated.

---

## At a glance

| What | URL | Notes |
|------|-----|--------|
| **UI (open this in the browser)** | **https://d1xsxf8zu41xgt.cloudfront.net** | React app — Market, Premarket, Operations, Admin |
| **API (direct, for curl/tools)** | https://7bko9drijd.execute-api.us-east-1.amazonaws.com/prod | Backend only — **not** a web page |
| **API (via UI, same origin)** | https://d1xsxf8zu41xgt.cloudfront.net/api/… | What the production app uses |

---

## UI — CloudFront

| Item | Value |
|------|--------|
| **Public URL** | https://d1xsxf8zu41xgt.cloudfront.net |
| Distribution ID | `E59WI60V6JCPO` |
| S3 bucket | `oceanview-ui-prod` |
| Region | `us-east-1` |

**Example routes**

| Page | URL |
|------|-----|
| Home (redirects to Market) | https://d1xsxf8zu41xgt.cloudfront.net/ |
| Market | https://d1xsxf8zu41xgt.cloudfront.net/market |
| Market — by strategy | https://d1xsxf8zu41xgt.cloudfront.net/market/strategies |
| Market — by ticker | https://d1xsxf8zu41xgt.cloudfront.net/market/tickers |
| Market — by rule | https://d1xsxf8zu41xgt.cloudfront.net/market/rules |
| Admin | https://d1xsxf8zu41xgt.cloudfront.net/admin |
| Premarket | https://d1xsxf8zu41xgt.cloudfront.net/premarket |
| Operations | https://d1xsxf8zu41xgt.cloudfront.net/operations |

Deploy: push to `main` → GitHub Actions → S3 sync → CloudFront invalidation. See [deploy-aws.md](./deploy-aws.md).

---

## API — API Gateway (OceanView-API)

| Item | Value |
|------|--------|
| **Base URL** | https://7bko9drijd.execute-api.us-east-1.amazonaws.com/prod |
| Stack | `oceanview-api` |
| Stage | `prod` |
| Repo | `OceanView-API` |

### Important: root path returns an error

Opening **only** the base URL (no path after `/prod`) returns **403** with:

```json
{"message":"Missing Authentication Token"}
```

That is expected. API Gateway has no route on `/prod` itself — only on named paths below.

### Live routes (today)

**Health, tickers, jobs, candles**

| Method | Path | Example |
|--------|------|---------|
| `GET` | `/health` | https://7bko9drijd.execute-api.us-east-1.amazonaws.com/prod/health |
| `GET` | `/tickers` | …/prod/tickers |
| `GET` | `/jobs/status` | …/prod/jobs/status |
| `POST` | `/candles/result` | …/prod/candles/result |
| `POST` | `/candles/status` | …/prod/candles/status |
| `POST` | `/candles/refresh` | …/prod/candles/refresh |
| `POST` | `/candles/reset` | …/prod/candles/reset |

**Market** (used by the Market page when `VITE_USE_MOCK_MARKET=false`)

| Method | Path | Example |
|--------|------|---------|
| `GET` | `/market/envelope` | …/prod/market/envelope |
| `GET` | `/market/strategies` | …/prod/market/strategies |
| `GET` | `/market/strategies/snapshot` | …/prod/market/strategies/snapshot |
| `GET` | `/market/tickers/snapshot` | …/prod/market/tickers/snapshot |
| `GET` | `/market/rules/snapshot` | …/prod/market/rules/snapshot |
| `GET` | `/market/strategies/{strategyId}/detail` | …/prod/market/strategies/estrategia-01/detail |
| `GET` | `/market/tickers/{symbol}/detail` | …/prod/market/tickers/AAPL/detail |
| `POST` | `/market/evaluate` | …/prod/market/evaluate |
| `GET` | `/market/evaluate/{runId}` | …/prod/market/evaluate/{runId} |

Contract and field shapes: [market-page.md](./market-page.md) (APIs section). Implementation notes: `OceanView-API/docs/market-plan.md`.

**Market bootstrap behavior:** `GET /market/envelope` may return `"runId": null` until someone runs **Assess** in the UI (`POST /market/evaluate`). Snapshot endpoints still respond without `runId` (fixture preview when no persisted run exists).

**Premarket** ([premarket-page.md](./premarket-page.md); deploy `PremarketFunction` with UI)

| Method | Path | Example |
|--------|------|---------|
| `POST` | `/premarket/evaluate/start` | …/prod/premarket/evaluate/start |
| `POST` | `/premarket/evaluate/stop` | …/prod/premarket/evaluate/stop |
| `GET` | `/premarket/evaluate/result` | …/prod/premarket/evaluate/result |

**Operations** ([operations-page.md](./operations-page.md); deploy `OperationsFunction`)

| Method | Path | Example |
|--------|------|---------|
| `GET` | `/operations/tickers` | …/prod/operations/tickers |
| `GET` | `/operations/option-picks` | …/prod/operations/option-picks?contractType=CALL |
| `POST` | `/operations/buy` | …/prod/operations/buy |

### Smoke test

```powershell
$api = "https://7bko9drijd.execute-api.us-east-1.amazonaws.com/prod"
curl.exe "$api/health"
curl.exe "$api/tickers"
curl.exe "$api/market/envelope"
curl.exe "$api/market/strategies/snapshot"
curl.exe -X POST "$api/premarket/evaluate/start" -H "Content-Type: application/json" -d "{}"
curl.exe "$api/premarket/evaluate/result"
```

---

## How UI and API connect in production

The browser loads the app from **CloudFront**. The built app uses `VITE_API_BASE_URL=/api` (see `.env.production`), so requests go to the **same host**:

```
https://d1xsxf8zu41xgt.cloudfront.net/api/tickers
https://d1xsxf8zu41xgt.cloudfront.net/api/market/envelope
```

CloudFront behavior:

1. **`/api/*`** → second origin (API Gateway `7bko9drijd…`, path `/prod`)
2. CloudFront Function strips the `/api` prefix (see [infrastructure/cloudfront-api-rewrite.js](../infrastructure/cloudfront-api-rewrite.js))
3. API Gateway receives `GET /tickers` (not `/api/tickers`)

```
Browser  →  CloudFront (UI + /api/*)  →  API Gateway /prod/*  →  Lambda
                ↓
            S3 (static files)
```

No CORS issues in production because API calls are same-origin (`/api` on the CloudFront domain).

---

## Local development (not AWS)

| Service | URL |
|---------|-----|
| UI (Vite) | http://localhost:5173 |
| API (SAM local) | http://127.0.0.1:3001 |
| UI → API proxy | `/api` → `127.0.0.1:3001` via `npm run dev:local` |

See [environment.md](./environment.md) and `.cursor/skills/oceanview-dev-local/SKILL.md`.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [README.md](./README.md) | Documentation index |
| [deploy-aws.md](./deploy-aws.md) | One-time AWS setup, GitHub Actions, CloudFront `/api` wiring |
| [environment.md](./environment.md) | `VITE_*` vars, local vs production |
| [candles-pane.md](./candles-pane.md) | Admin Candles pane (UI + API contract) |
| [market-page.md](./market-page.md) | Market page (UI, APIs, assess flow) |
| [cursor-rules-skills.md](./cursor-rules-skills.md) | Cursor project rules and skills |
| `OceanView-API/README.md` | API repo deploy and smoke tests |

---

## Custom domain

There is **no** custom domain (e.g. `app.oceanview.com`) configured today. Production entry point is the CloudFront URL above.

To add one later: ACM certificate + CloudFront alternate domain + DNS CNAME — document the new URL here when done.
