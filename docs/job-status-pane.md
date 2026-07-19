# Job Status pane — Admin

Read-only Admin pane that shows the latest run for each backend job type via `GET /jobs/status`.

**Route:** `/admin` → thumbnail **Job Status** (hash `#admin-job-status-pane`)

**Integration status:** **Implemented** — live API client, mock mode (`VITE_USE_MOCK_JOBS_STATUS`).

---

## UI

| Control | Behavior |
|---------|----------|
| Admin thumbnail **Job Status** | Expands `JobsStatusPane` |
| **Reload** | Re-fetches `GET /jobs/status` |
| Cards | One per `jobType` (Candles, Market assess, Premarket, Tickers SemiFinal, Movement profiles, …) |

**Empty:** “No job status records yet.”  
**Error:** API/message shown as alert; mock banner when `VITE_USE_MOCK_JOBS_STATUS=true`.

---

## API

| Method | Path | When |
|--------|------|------|
| `GET` | `/jobs/status` | Pane open / Reload |

Known `jobType` labels in UI: `candles`, `market`, `premarket`, `preselection`, `movement_profiles`. Unknown types show the raw key.

Production URL: [aws-urls.md](./aws-urls.md).

---

## Environment

| Flag | Purpose |
|------|---------|
| `VITE_USE_MOCK_JOBS_STATUS` | `true` → mock payload; unset/`false` → live API |

See [environment.md](./environment.md).

---

## Source file map

| File | Role |
|------|------|
| `src/features/admin/AdminPage.tsx` | Wires pane into Admin thumbnails |
| `src/features/admin/admin-panes.ts` | Pane id `job-status`, hash `#admin-job-status-pane` |
| `src/features/admin/job-status/JobsStatusPane.tsx` | Expanded pane + Reload |
| `src/features/admin/job-status/JobStatusCard.tsx` | Per-job card |
| `src/features/admin/job-status/display.ts` | Titles, banner tone, card models |
| `src/features/admin/job-status/hooks/useJobsStatusPane.ts` | Load on open |
| `src/features/admin/job-status/api/jobs-status-client.ts` | `GET /jobs/status` + mock flag |
| `src/features/admin/job-status/api/mock-data.ts` | Dev mock |
